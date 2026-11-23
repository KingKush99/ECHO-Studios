import { useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, Rss } from "lucide-react";
import { PodcastMetadata } from "../types";
import { exportPodcastFeed, publicHttpsUrl } from "../publish-feed";

type PublishTarget = {
  id: string;
  name: string;
  url: string;
  tone: string;
  summary: string;
};

type PublishingPlan = {
  title: string;
  description: string;
  tags: string[];
  targetPlatforms: string[];
  pipeline: string[];
};

const PUBLISH_TARGETS: PublishTarget[] = [
  {
    id: "apple",
    name: "Apple Podcasts",
    url: "https://podcastsconnect.apple.com/",
    tone: "bg-zinc-500/10 border-zinc-400/20 text-zinc-100",
    summary: "Submit a public RSS feed through Apple Podcasts Connect.",
  },
  {
    id: "spotify",
    name: "Spotify for Creators",
    url: "https://creators.spotify.com/",
    tone: "bg-[#1DB954]/10 border-[#1DB954]/20 text-[#8ff0b6]",
    summary: "Manage audio/video podcasts and distribution on Spotify.",
  },
  {
    id: "youtube",
    name: "YouTube Podcasts",
    url: "https://studio.youtube.com/",
    tone: "bg-red-500/10 border-red-500/20 text-red-200",
    summary: "Create a podcast and submit an RSS feed in YouTube Studio.",
  },
  {
    id: "amazon",
    name: "Amazon Music",
    url: "https://podcasters.amazon.com/",
    tone: "bg-cyan-500/10 border-cyan-500/20 text-cyan-200",
    summary: "Submit your podcast feed to Amazon Music for Podcasters.",
  },
];

const STOP_WORDS = new Set(["about", "after", "also", "and", "because", "from", "have", "into", "like", "podcast", "publish", "show", "that", "the", "their", "this", "through", "want", "with", "would", "your"]);

function titleFromBrief(brief: string) {
  const cleaned = brief
    .replace(/https?:\/\/\S+/g, "")
    .split(/[.!?\n]/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Untitled Podcast Release";
  return cleaned
    .split(" ")
    .slice(0, 10)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function uniqueTags(values: string[]) {
  const tags = values
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return Array.from(new Set(tags)).slice(0, 12);
}

function platformsFromBrief(brief: string) {
  const lowered = brief.toLowerCase();
  const selected = PUBLISH_TARGETS.filter((target) => lowered.includes(target.name.toLowerCase().split(" ")[0]));
  if (lowered.includes("youtube")) selected.push(PUBLISH_TARGETS.find((target) => target.id === "youtube")!);
  if (lowered.includes("apple")) selected.push(PUBLISH_TARGETS.find((target) => target.id === "apple")!);
  if (lowered.includes("spotify")) selected.push(PUBLISH_TARGETS.find((target) => target.id === "spotify")!);
  if (lowered.includes("amazon")) selected.push(PUBLISH_TARGETS.find((target) => target.id === "amazon")!);
  return Array.from(new Map(selected.map((target) => [target.id, target.name])).values()).slice(0, 4);
}

function buildPublishingPlan(data: PodcastMetadata | null, brief: string): PublishingPlan {
  const trimmedBrief = brief.trim();
  const title = data?.title || titleFromBrief(trimmedBrief);
  const descriptionSource = trimmedBrief || data?.description || "A podcast episode prepared for public release.";
  const description = data
    ? `${data.description}\n\nPublishing angle: ${descriptionSource}`
    : `${descriptionSource}\n\nPrepared with ECHO Studios publishing metadata.`;
  const tags = uniqueTags([title, descriptionSource, data?.tagline || "", data?.musicMood || ""]);
  const targetPlatforms = platformsFromBrief(trimmedBrief);
  const finalTargets = targetPlatforms.length > 0 ? targetPlatforms : ["Apple Podcasts", "Spotify for Creators", "YouTube Podcasts", "Amazon Music"];

  return {
    title,
    description,
    tags,
    targetPlatforms: finalTargets,
    pipeline: [
      "Confirm the final episode title, description, tags, category, explicit rating, and target platforms.",
      "Generate or attach cover art, final hosted audio, owner email, show website, and a public artwork URL.",
      "Export the RSS XML, transcript, show notes, metadata JSON, and voice-production script from this page.",
      "Host the final audio, artwork, and RSS XML at public HTTPS URLs.",
      "Open each selected platform, paste the public RSS feed or upload package, then review platform-specific warnings.",
      "Submit only after a human checks the public title, tags, description, artwork, audio, and ownership details.",
    ],
  };
}

function formatPublishingPlan(plan: PublishingPlan) {
  return [
    `Title: ${plan.title}`,
    "",
    "Description:",
    plan.description,
    "",
    `Tags: ${plan.tags.join(", ")}`,
    "",
    `Platforms: ${plan.targetPlatforms.join(", ")}`,
    "",
    "Pipeline:",
    ...plan.pipeline.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");
}

function saveFile(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function downloadText(name: string, text: string, type: string) {
  saveFile(name, new Blob([text], { type }));
}

async function encodePublishAudio(wav: Blob, signal: AbortSignal): Promise<{ blob: Blob; duration: number }> {
  const bytes = await wav.arrayBuffer();
  signal.throwIfAborted();
  const worker = new Worker(new URL("../mp3-export.worker.ts", import.meta.url), { type: "module" });
  let abort: () => void;
  try {
    return await new Promise((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      worker.onerror = () => reject(new Error("MP3 encoding failed."));
      worker.onmessage = ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else resolve({ blob: new Blob(data.blocks, { type: "audio/mpeg" }), duration: data.duration });
      };
      worker.postMessage(bytes, [bytes]);
    });
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
    worker.terminate();
  }
}

function formatTimestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function formatTranscript(data: PodcastMetadata) {
  const header = [`${data.title}`, data.tagline, "", data.description, "", "Transcript", ""].join("\n");
  const lines = data.script
    .map((line) => `[${formatTimestamp(line.estimatedStartSeconds)}] ${line.speakerName}: ${line.dialogue}`)
    .join("\n\n");

  return `${header}${lines}\n`;
}

function formatShowNotes(data: PodcastMetadata) {
  const chapters = data.chapters.map((chapter) => `- ${chapter.title} (${formatTimestamp(chapter.startSeconds)})`).join("\n");
  return `${data.title}\n\n${data.description}\n\nChapters\n${chapters}`;
}

function formatProductionScript(data: PodcastMetadata) {
  const speakerList = data.speakers.map((speaker) => `- ${speaker.name}: ${speaker.role}, ${speaker.style}`).join("\n");
  const voiceReferences = data.voiceReferences?.length
    ? `\n\n## Voice Reference\n${data.voiceReferences.map((reference) => `- ${reference.clonedVoiceName || reference.name}${reference.clonedVoiceId ? ` (${reference.cloneProvider === "elevenlabs" ? "ElevenLabs clone ready" : "Local clone ready"})` : " (reference only)"}`).join("\n")}`
    : "";
  const lines = data.script
    .map((line) => {
      const cue = line.soundEffect ? `\n  [${line.soundEffect}]` : "";
      return `${line.speakerName}: ${line.dialogue}${cue}`;
    })
    .join("\n\n[short pause]\n\n");

  return `# ${data.title}\n\n${data.description}\n\n## Voice Direction\nUse this as production copy for a human narrator or a higher-quality local/cloud TTS tool. Browser speech is only preview audio.\n\n${speakerList}${voiceReferences}\n\n## Script\n${lines}\n`;
}

export function PublishView({ data, onRenderAudio }: {
  data: PodcastMetadata | null;
  onRenderAudio: (episode: PodcastMetadata, signal: AbortSignal) => Promise<Blob>;
}) {
  const [fields, setFields] = useState({ author: "", email: "", website: "", audio: "", artwork: "", bytes: "", feed: "", category: "Technology" });
  const [explicit, setExplicit] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState<{ episode: PodcastMetadata; blob: Blob; duration: number } | null>(null);
  const [publishBrief, setPublishBrief] = useState("");
  const [publishingPlan, setPublishingPlan] = useState<PublishingPlan | null>(null);
  const [customDestination, setCustomDestination] = useState("");
  const renderRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    setRendered(null);
    setError("");
    setStatus("");
    setFields((current) => ({ ...current, audio: "", artwork: "", bytes: "" }));
    return () => renderRequest.current?.abort();
  }, [data?.script]);

  const safeTitle = data?.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "echo-episode";
  const hostedFeed = publicHttpsUrl(fields.feed);
  const render = rendered?.episode === data ? rendered : null;
  const update = (field: keyof typeof fields, value: string) => setFields((current) => ({ ...current, [field]: value }));
  const feed = data ? exportPodcastFeed(data, {
    ...fields, bytes: Number(fields.bytes), explicit, duration: render?.blob.size === Number(fields.bytes) ? render.duration : undefined,
  }) : "";

  async function downloadAudio() {
    if (!data) return;
    const controller = new AbortController();
    renderRequest.current?.abort();
    renderRequest.current = controller;
    setError("");
    setStatus("");
    setRendering(true);
    try {
      const wav = await onRenderAudio(data, controller.signal);
      const { blob, duration } = await encodePublishAudio(wav, controller.signal);
      setRendered({ episode: data, blob, duration });
      setFields((current) => ({ ...current, bytes: !current.bytes || current.bytes === String(render?.blob.size) ? String(blob.size) : current.bytes }));
      saveFile(safeTitle + ".mp3", blob);
      setStatus("MP3 ready to host. Paste its public URL below once it is online.");
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Audio export failed.");
    } finally {
      if (renderRequest.current === controller) { renderRequest.current = null; setRendering(false); }
    }
  }

  async function copy(text: string, message: string) {
    setError("");
    try { await navigator.clipboard.writeText(text); setStatus(message); }
    catch { setError("Clipboard unavailable. Select and copy the text manually."); }
  }

  const button = "inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40";
  const input = "w-full rounded-lg border border-white/15 bg-[#1a1624] px-3 py-2 text-sm text-white outline-none focus:border-brand-300";
  const cover = data?.coverArt?.dataUrl;
  const feedFields = [
    ["author", "Show owner", "text", "Your name or studio"],
    ["email", "Owner email", "email", "creator@example.com"],
    ["website", "Show website", "url", "https://your-show.com"],
    ["artwork", "Hosted cover URL", "url", "https://your-show.com/cover.jpg"],
    ["audio", "Hosted audio URL", "url", "https://your-show.com/episode.mp3"],
    ["bytes", "Hosted audio size in bytes", "number", "Exact size of the hosted file"],
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Publish</h1>
        <p className="mt-1 text-sm text-zinc-400">{data ? data.title : "Create or open an episode to export its audio and RSS."}</p>
      </header>

      {data && <>
        <section className="space-y-3 border-b border-white/10 pb-5">
          <h2 className="text-base font-semibold">1. Download your files</h2>
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={() => void downloadAudio()} disabled={rendering}><Download className="size-4" />{rendering ? "Rendering audio…" : "Download episode MP3"}</button>
            {rendering && <button className={button} onClick={() => renderRequest.current?.abort()}>Cancel export</button>}
            {cover && <a href={cover} download={safeTitle + "-cover.png"} className={button}><Download className="size-4" /> Cover art</a>}
          </div>
          <details className="text-sm text-zinc-300">
            <summary className="cursor-pointer">More exports</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={button} onClick={() => downloadText(safeTitle + "-transcript.txt", formatTranscript(data), "text/plain")}>Transcript</button>
              <button className={button} onClick={() => downloadText(safeTitle + "-metadata.json", JSON.stringify(data, null, 2), "application/json")}>Metadata</button>
              <button className={button} onClick={() => downloadText(safeTitle + "-voice-script.md", formatProductionScript(data), "text/markdown")}>Voice script</button>
              <button className={button} onClick={() => void copy(formatShowNotes(data), "Show notes copied.")}>Copy show notes</button>
            </div>
          </details>
        </section>

        <section className="space-y-3 border-b border-white/10 pb-5">
          <h2 className="text-base font-semibold">2. Create the RSS file</h2>
          <p className="text-sm text-zinc-400">Host the MP3 and cover somewhere publicly accessible, then enter their HTTPS links. Use the byte size of the hosted audio file.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {feedFields.map(([key, label, type, placeholder]) => <label key={key} className="grid gap-1 text-xs font-medium text-zinc-300">
              {label}<input value={fields[key]} onChange={(event) => update(key, event.target.value)} type={type} min={type === "number" ? 1 : undefined} placeholder={placeholder} className={input} />
            </label>)}
          </div>
          <details className="text-sm text-zinc-300">
            <summary className="cursor-pointer">Category and content settings</summary>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <select aria-label="Podcast category" value={fields.category} onChange={(event) => update("category", event.target.value)} className="rounded-lg border border-white/15 bg-[#1a1624] px-3 py-2">
                {["Technology", "Business", "Education", "Comedy", "Science", "Society & Culture", "Arts", "News"].map((category) => <option key={category}>{category}</option>)}
              </select>
              <label className="flex items-center gap-2"><input type="checkbox" checked={explicit} onChange={(event) => setExplicit(event.target.checked)} /> Mark explicit</label>
            </div>
          </details>
          <button className={button} disabled={!feed} onClick={() => {
            downloadText(safeTitle + "-rss.xml", feed, "application/rss+xml");
            setStatus("RSS downloaded. Host it and paste its public feed URL in the next step.");
          }}><Rss className="size-4" /> Download RSS</button>
        </section>
      </>}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{data ? "3. Submit to a platform" : "Submit an existing feed"}</h2>
        <label className="grid gap-1 text-xs font-medium text-zinc-300">
          Public RSS feed URL
          <input type="url" value={fields.feed} onChange={(event) => update("feed", event.target.value)} placeholder="https://your-show.com/rss.xml" className={input} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={!hostedFeed} onClick={() => void copy(hostedFeed, "RSS URL copied.")}><Copy className="size-4" /> Copy RSS URL</button>
          {PUBLISH_TARGETS.map((target) => <a key={target.id} className={button} href={target.url} title={target.summary} target="_blank" rel="noreferrer">{target.name}<ExternalLink className="size-3.5" /></a>)}
        </div>
        <details className="text-sm text-zinc-300">
          <summary className="cursor-pointer">Custom destination or release plan</summary>
          <div className="mt-3 space-y-3">
            <label className="grid gap-1">Custom platform URL<input type="url" value={customDestination} onChange={(event) => setCustomDestination(event.target.value)} className={input} /></label>
            {publicHttpsUrl(customDestination) && <a className={button} href={publicHttpsUrl(customDestination)} target="_blank" rel="noreferrer">Open custom platform <ExternalLink className="size-4" /></a>}
            <label className="grid gap-1">Release brief<textarea value={publishBrief} onChange={(event) => setPublishBrief(event.target.value)} rows={3} className={input} /></label>
            <button className={button} disabled={!publishBrief.trim() && !data} onClick={() => setPublishingPlan(buildPublishingPlan(data, publishBrief))}>Create release plan</button>
            {publishingPlan && <><pre className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{formatPublishingPlan(publishingPlan)}</pre><button className={button} onClick={() => void copy(formatPublishingPlan(publishingPlan), "Release plan copied.")}>Copy plan</button></>}
          </div>
        </details>
      </section>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {status && <p role="status" className="text-sm text-brand-300">{status}</p>}
    </div>
  );
}
