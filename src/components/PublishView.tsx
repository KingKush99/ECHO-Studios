import { useState } from "react";
import { AlertCircle, Check, ClipboardList, Copy, Download, ExternalLink, FileAudio, FileJson, FileText, Globe2, RadioTower, Rss, Tags, UploadCloud, Wand2 } from "lucide-react";
import { PodcastMetadata } from "../types";

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

function downloadText(filename: string, text: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatTimestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function getMimeTypeFromUrl(url: string) {
  const lowered = url.toLowerCase().split("?")[0];
  if (lowered.endsWith(".m4a")) return "audio/mp4";
  if (lowered.endsWith(".wav")) return "audio/wav";
  if (lowered.endsWith(".aac")) return "audio/aac";
  return "audio/mpeg";
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

function formatRssFeed({
  data,
  author,
  email,
  websiteUrl,
  audioUrl,
  imageUrl,
  category,
  explicit,
}: {
  data: PodcastMetadata;
  author: string;
  email: string;
  websiteUrl: string;
  audioUrl: string;
  imageUrl: string;
  category: string;
  explicit: boolean;
}) {
  const now = new Date().toUTCString();
  const duration = data.script.length > 0 ? data.script[data.script.length - 1].estimatedStartSeconds + data.script[data.script.length - 1].durationSeconds : 0;
  const showLink = websiteUrl || "https://example.com";
  const episodeAudio = audioUrl || "https://example.com/episode.mp3";
  const artwork = imageUrl || "https://example.com/podcast-cover.jpg";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xmlEscape(data.title)}</title>
    <link>${xmlEscape(showLink)}</link>
    <language>en-us</language>
    <copyright>${xmlEscape(`Copyright ${new Date().getFullYear()} ${author || "ECHO Studios Creator"}`)}</copyright>
    <itunes:author>${xmlEscape(author || "ECHO Studios Creator")}</itunes:author>
    <itunes:owner>
      <itunes:name>${xmlEscape(author || "ECHO Studios Creator")}</itunes:name>
      <itunes:email>${xmlEscape(email || "creator@example.com")}</itunes:email>
    </itunes:owner>
    <description>${xmlEscape(data.description)}</description>
    <itunes:summary>${xmlEscape(data.description)}</itunes:summary>
    <itunes:explicit>${explicit ? "true" : "false"}</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:image href="${xmlEscape(artwork)}" />
    <itunes:category text="${xmlEscape(category || "Technology")}" />
    <item>
      <title>${xmlEscape(data.title)}</title>
      <description>${xmlEscape(formatShowNotes(data))}</description>
      <content:encoded>${xmlEscape(formatShowNotes(data))}</content:encoded>
      <guid isPermaLink="false">${xmlEscape(`${data.title}-${data.script.length}-${duration}`)}</guid>
      <pubDate>${now}</pubDate>
      <itunes:duration>${Math.round(duration)}</itunes:duration>
      <itunes:explicit>${explicit ? "true" : "false"}</itunes:explicit>
      <enclosure url="${xmlEscape(episodeAudio)}" length="0" type="${getMimeTypeFromUrl(episodeAudio)}" />
    </item>
  </channel>
</rss>
`;
}

export function PublishView({ data }: { data: PodcastMetadata | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [hostedAudioUrl, setHostedAudioUrl] = useState("");
  const [rssFeedUrl, setRssFeedUrl] = useState("");
  const [creatorName, setCreatorName] = useState("ECHO Studios Creator");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("Technology");
  const [explicit, setExplicit] = useState(false);
  const [customDestination, setCustomDestination] = useState("");
  const [publishBrief, setPublishBrief] = useState("");
  const [publishingPlan, setPublishingPlan] = useState<PublishingPlan | null>(null);

  const copyValue = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const openTarget = (targetUrl: string) => {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const createPublishingPlan = () => {
    const plan = buildPublishingPlan(data, publishBrief);
    setPublishingPlan(plan);
  };

  const gatewayPanel = (
    <div className="rounded-2xl border border-brand-400/20 bg-brand-500/10 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-xl font-display font-bold text-white">
            <Wand2 className="h-5 w-5 text-brand-200" /> Publishing Gateway
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-100/75">
            Describe the release once. ECHO drafts the title, tags, platforms, and steps.
          </p>
        </div>
        <button onClick={createPublishingPlan} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white hover:bg-brand-500">
          <ClipboardList className="h-4 w-4" /> Create Pipeline
        </button>
      </div>

      <textarea
        value={publishBrief}
        onChange={(event) => setPublishBrief(event.target.value)}
        placeholder="Example: YouTube + Spotify launch for founders. Tags: AI voice, automation, creator tools."
        className="min-h-32 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-gray-500 focus:border-brand-400/60"
      />

      {publishingPlan ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-4">
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-200">Generated title</div>
              <div className="text-lg font-bold text-white">{publishingPlan.title}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-200">Description</div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">{publishingPlan.description}</p>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-200">
                <Tags className="h-4 w-4" /> Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {publishingPlan.tags.length > 0 ? publishingPlan.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white">{tag}</span>
                )) : <span className="text-sm text-gray-500">Add a more specific brief to generate tags.</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copyValue("gateway-title", publishingPlan.title)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
                {copied === "gateway-title" ? "Copied title" : "Copy title"}
              </button>
              <button onClick={() => copyValue("gateway-description", publishingPlan.description)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
                {copied === "gateway-description" ? "Copied description" : "Copy description"}
              </button>
              <button onClick={() => copyValue("gateway-tags", publishingPlan.tags.join(", "))} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
                {copied === "gateway-tags" ? "Copied tags" : "Copy tags"}
              </button>
              <button onClick={() => copyValue("gateway-plan", formatPublishingPlan(publishingPlan))} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
                {copied === "gateway-plan" ? "Copied plan" : "Copy full plan"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-200">Target platforms</div>
              <div className="space-y-2">
                {publishingPlan.targetPlatforms.map((platform) => (
                  <div key={platform} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white">{platform}</div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-200">Pipeline</div>
              <ol className="space-y-2">
                {publishingPlan.pipeline.map((step, index) => (
                  <li key={step} className="grid grid-cols-[24px_1fr] gap-2 text-xs leading-relaxed text-gray-300">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-[11px] font-black text-brand-100">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
          No pipeline generated yet. Add a publishing brief and click Create Pipeline.
        </div>
      )}
    </div>
  );

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-6 pb-32 space-y-8">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Publish Episode</h1>
          <p className="text-gray-400 text-sm">Choose a platform now. Generate an episode when you are ready to export RSS, artwork, transcript, and metadata.</p>
        </div>

        {gatewayPanel}

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <UploadCloud className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-amber-200">Episode assets needed</h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
                Platform links stay available below. Create a podcast first to generate the RSS XML, cover PNG, show notes, and public-feed checklist.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
            <RadioTower className="w-4 h-4" /> Publish Destinations
          </h3>
          <p className="text-sm text-gray-400">Open one of four primary platforms, or use a custom directory URL for another podcast host.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PUBLISH_TARGETS.map((target) => (
              <div key={target.id} className={`rounded-xl border p-4 space-y-3 ${target.tone}`}>
                <div>
                  <h4 className="font-bold text-white">{target.name}</h4>
                  <p className="text-xs opacity-80 mt-1">{target.summary}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openTarget(target.url)} className="flex-1 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 text-xs font-bold text-white flex items-center justify-center gap-2">
                    Open <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => copyValue(target.id, "Create and host your podcast RSS feed, then submit that public RSS URL to this platform.")} className="w-10 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center text-white" aria-label={`Copy RSS instructions for ${target.name}`}>
                    {copied === target.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-brand-300" /> Custom platform
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <input value={customDestination} onChange={(event) => setCustomDestination(event.target.value)} placeholder="https://platform.example.com/submit" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              <button disabled={!customDestination.trim()} onClick={() => openTarget(customDestination)} className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-bold text-white flex items-center justify-center gap-2">
                Open <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const transcript = formatTranscript(data);
  const showNotes = formatShowNotes(data);
  const productionScript = formatProductionScript(data);
  const rssXml = formatRssFeed({
    data,
    author: creatorName,
    email: creatorEmail,
    websiteUrl,
    audioUrl: hostedAudioUrl,
    imageUrl,
    category,
    explicit,
  });
  const safeTitle = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "echo-episode";
  const coverImage = data.coverArt?.dataUrl || data.promptImages?.[0]?.dataUrl;
  const hasHostedAudio = /^https?:\/\/.+/i.test(hostedAudioUrl.trim());
  const hasCreatorEmail = /\S+@\S+\.\S+/.test(creatorEmail.trim());
  const hasPublicArtwork = /^https?:\/\/.+/i.test(imageUrl.trim());
  const hasPublicFeed = /^https?:\/\/.+/i.test(rssFeedUrl.trim());
  const generatedFeedReady = hasHostedAudio && hasCreatorEmail && hasPublicArtwork;
  const internetReady = hasPublicFeed || generatedFeedReady;
  const readinessItems = [
    {
      label: "Hosted final audio",
      ready: hasHostedAudio,
      detail: hasHostedAudio ? "Audio URL is public." : "Paste a public MP3, M4A, WAV, or AAC URL.",
    },
    {
      label: "Public artwork URL",
      ready: hasPublicArtwork,
      detail: hasPublicArtwork ? "Artwork URL is public." : data.coverArt ? "Cover is generated; host it and paste its URL." : "Generate or upload cover art, host it, then paste its URL.",
    },
    {
      label: "Owner verification email",
      ready: hasCreatorEmail,
      detail: hasCreatorEmail ? "Email is ready for platform verification." : "Add the show owner email.",
    },
    {
      label: "Public RSS path",
      ready: hasPublicFeed || generatedFeedReady,
      detail: hasPublicFeed ? "Hosted RSS URL is ready to submit." : generatedFeedReady ? "RSS XML can be exported and hosted." : "Complete the fields above before hosting the RSS XML.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 pb-32 space-y-8">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-display font-bold text-white tracking-tight">Publish Episode</h1>
        <p className="text-gray-400 text-sm">Prepare a feed, export your assets, then submit to any podcast platform.</p>
      </div>

      {gatewayPanel}

      <div className={`rounded-2xl border p-4 sm:p-5 ${internetReady ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="flex-1">
            <h2 className={`text-sm font-bold uppercase tracking-widest flex items-center gap-2 ${internetReady ? "text-emerald-200" : "text-amber-200"}`}>
              {internetReady ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              Internet publishing status
            </h2>
            <p className={`mt-2 text-sm leading-relaxed ${internetReady ? "text-emerald-100/80" : "text-amber-100/80"}`}>
              {hasPublicFeed
                ? "A public RSS feed URL is ready for Apple Podcasts, Spotify, YouTube, Amazon, Pocket Casts, Podcast Index, or a custom directory."
                : generatedFeedReady
                  ? "The RSS XML export has the required public audio, artwork, and owner fields. Host the XML file publicly, then paste its public RSS URL."
                  : "Podcast platforms cannot publish browser-only preview audio or local files. Host the final audio, artwork, and RSS feed publicly first."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:w-[520px]">
            {readinessItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  {item.ready ? <Check className="w-4 h-4 text-emerald-300" /> : <AlertCircle className="w-4 h-4 text-amber-300" />}
                  {item.label}
                </div>
                <p className="mt-1 text-xs text-gray-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="w-full aspect-square rounded-xl shadow-lg border border-white/10 overflow-hidden bg-gradient-to-tr from-brand-600 to-purple-800">
              {coverImage ? (
                <img src={coverImage} alt={data.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full p-5 flex flex-col justify-end">
                  <span className="text-xs font-bold text-white uppercase tracking-widest bg-black/40 self-start px-2 py-0.5 rounded backdrop-blur-md">ECHO</span>
                  <span className="text-white text-sm font-medium leading-tight mt-2 line-clamp-3">{data.title}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-display font-bold text-white">{data.title}</h2>
              <p className="text-sm text-gray-400 line-clamp-4">{data.description}</p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2">
              <FileAudio className="w-4 h-4" /> Production Audio Required
            </h3>
            <p className="text-xs text-amber-100/80 leading-relaxed">
              Browser speech is preview audio. For Apple, Spotify, YouTube, Amazon, and most directories, produce or host a final MP3/M4A/WAV file and paste its public URL below.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
              <Rss className="w-4 h-4" /> Feed Setup
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Creator / show owner</span>
                <input value={creatorName} onChange={(event) => setCreatorName(event.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Owner email for feed verification</span>
                <input value={creatorEmail} onChange={(event) => setCreatorEmail(event.target.value)} placeholder="creator@example.com" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-gray-400">Hosted final audio URL</span>
                <input value={hostedAudioUrl} onChange={(event) => setHostedAudioUrl(event.target.value)} placeholder="https://your-host.com/episode.mp3" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Public show website</span>
                <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://your-show.com" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Public artwork URL</span>
                <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://your-show.com/cover.jpg" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none">
                  <option>Technology</option>
                  <option>Business</option>
                  <option>Education</option>
                  <option>Comedy</option>
                  <option>Science</option>
                  <option>Society &amp; Culture</option>
                  <option>Arts</option>
                  <option>News</option>
                </select>
              </label>
              <label className="flex items-center gap-3 pt-6">
                <input type="checkbox" checked={explicit} onChange={(event) => setExplicit(event.target.checked)} className="w-4 h-4 accent-brand-500" />
                <span className="text-sm text-gray-300">Mark explicit</span>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-gray-400">Already hosted RSS feed URL</span>
                <input value={rssFeedUrl} onChange={(event) => setRssFeedUrl(event.target.value)} placeholder="https://your-show.com/rss.xml" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-brand-200 uppercase">Export Pack</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => downloadText(`${safeTitle}-transcript.txt`, transcript, "text/plain;charset=utf-8")} className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors">
                <span className="font-bold text-blue-300 flex items-center gap-3">
                  <FileText className="w-5 h-5" /> Transcript
                </span>
                <Download className="w-5 h-5 text-blue-300" />
              </button>
              <button onClick={() => downloadText(`${safeTitle}-metadata.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8")} className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                <span className="font-bold text-emerald-300 flex items-center gap-3">
                  <FileJson className="w-5 h-5" /> Metadata
                </span>
                <Download className="w-5 h-5 text-emerald-300" />
              </button>
              <button onClick={() => downloadText(`${safeTitle}-rss.xml`, rssXml, "application/rss+xml;charset=utf-8")} className="flex items-center justify-between p-4 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 transition-colors">
                <span className="font-bold text-orange-300 flex items-center gap-3">
                  <Rss className="w-5 h-5" /> RSS XML
                </span>
                <Download className="w-5 h-5 text-orange-300" />
              </button>
              <button onClick={() => downloadText(`${safeTitle}-voice-production.md`, productionScript, "text/markdown;charset=utf-8")} className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-colors">
                <span className="font-bold text-purple-300 flex items-center gap-3">
                  <FileAudio className="w-5 h-5" /> Voice Script
                </span>
                <Download className="w-5 h-5 text-purple-300" />
              </button>
              {data.coverArt && (
                <button onClick={() => {
                  const anchor = document.createElement("a");
                  anchor.href = data.coverArt!.dataUrl;
                  anchor.download = `${safeTitle}-cover.png`;
                  document.body.appendChild(anchor);
                  anchor.click();
                  anchor.remove();
                }} className="sm:col-span-2 flex items-center justify-between p-4 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 transition-colors">
                  <span className="font-bold text-pink-200 flex items-center gap-3">
                    <Download className="w-5 h-5" /> Download podcast cover PNG
                  </span>
                  <Download className="w-5 h-5 text-pink-200" />
                </button>
              )}
              <button onClick={() => copyValue("notes", showNotes)} className="sm:col-span-2 flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                <span className="font-bold text-gray-200 flex items-center gap-3">
                  <Copy className="w-5 h-5" /> Copy show notes
                </span>
                {copied === "notes" ? <Check className="w-5 h-5 text-gray-200" /> : <Copy className="w-5 h-5 text-gray-200" />}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
              <RadioTower className="w-4 h-4" /> Publish Destinations
            </h3>
            <p className="text-sm text-gray-400">Choose one of four primary platforms, or use a custom directory URL for another podcast host.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PUBLISH_TARGETS.map((target) => (
                <div key={target.id} className={`rounded-xl border p-4 space-y-3 ${target.tone}`}>
                  <div>
                    <h4 className="font-bold text-white">{target.name}</h4>
                    <p className="text-xs opacity-80 mt-1">{target.summary}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openTarget(target.url)} className="flex-1 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 text-xs font-bold text-white flex items-center justify-center gap-2">
                      Open <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => copyValue(target.id, rssFeedUrl || "Host your rss.xml file publicly, then paste that public RSS URL into this platform.")} className="w-10 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center text-white" aria-label={`Copy RSS URL for ${target.name}`}>
                      {copied === target.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-brand-300" /> Custom platform
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <input value={customDestination} onChange={(event) => setCustomDestination(event.target.value)} placeholder="https://platform.example.com/submit" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                <button disabled={!customDestination.trim()} onClick={() => openTarget(customDestination)} className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-bold text-white flex items-center justify-center gap-2">
                  Open <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
