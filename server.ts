import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { promises as fsp } from "fs";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";

dotenv.config();

type RequestedSpeaker = {
  id?: string;
  name?: string;
  role?: string;
  bio?: string;
  voiceAccent?: string;
  gender?: "male" | "female" | "neutral";
  style?: string;
  avatarSeed?: string;
  voiceReferenceId?: string;
  voiceReferenceName?: string;
  voiceSourceType?: "cloned" | "downloaded" | "third-party";
};

type PromptImage = {
  name?: string;
  mimeType?: string;
  size?: number;
  notes?: string;
};

type VoiceReferenceRequest = {
  name?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  consentConfirmed?: boolean;
  sourceType?: "cloned" | "downloaded" | "third-party";
  clonedVoiceId?: string;
  clonedVoiceName?: string;
  cloneProvider?: "elevenlabs" | "chatterbox";
};

type LocalPodcastRequest = {
  topic?: string;
  duration?: "short" | "medium" | "long" | "hour";
  durationSeconds?: number;
  speakers?: RequestedSpeaker[];
  numSpeakers?: number;
  musicMood?: string;
  language?: string;
  promptImages?: PromptImage[];
  voiceReferences?: VoiceReferenceRequest[];
};

type AudioRequest = {
  script?: Array<{
    speakerName?: string;
    dialogue?: string;
    durationSeconds?: number;
  }>;
  maxSeconds?: number;
  provider?: "elevenlabs" | "piper" | "chatterbox";
  voiceId?: string;
  modelId?: string;
  voiceReferences?: VoiceReferenceRequest[];
};

type LivePodcastFeed = {
  id: string;
  name: string;
  publisher: string;
  feedUrl: string;
  homeUrl: string;
  category: string;
  listenerBase: number;
};

type LivePodcastEpisode = {
  id: string;
  showTitle: string;
  episodeTitle: string;
  publisher: string;
  category: string;
  description: string;
  feedUrl: string;
  homeUrl: string;
  episodeUrl: string;
  imageUrl: string;
  audioUrl: string;
  duration: string;
  listeners: number;
};

type PlayablePresetPodcast = {
  id: string;
  showTitle: string;
  episodeTitle: string;
  publisher: string;
  category: string;
  description: string;
  duration: string;
  listeners: number;
  gradient: string;
  audioScript: string;
};

const FALLBACK_SPEAKERS: Required<RequestedSpeaker>[] = [
  {
    id: "maya",
    name: "Maya Chen",
    role: "Lead Host",
    bio: "A quick-moving producer who makes dense ideas feel clear.",
    voiceAccent: "Warm, bright, and energetic",
    gender: "female",
    style: "enthusiastic",
    avatarSeed: "avatar_1",
    voiceReferenceId: "",
    voiceReferenceName: "",
    voiceSourceType: "cloned",
  },
  {
    id: "marcus",
    name: "Marcus Sterling",
    role: "Co-Host",
    bio: "A conversational analyst who keeps the episode grounded and playful.",
    voiceAccent: "Relaxed, dry, and measured",
    gender: "male",
    style: "humorous",
    avatarSeed: "avatar_2",
    voiceReferenceId: "",
    voiceReferenceName: "",
    voiceSourceType: "cloned",
  },
];

const DURATION_TARGET_SECONDS = {
  short: 120,
  medium: 300,
  long: 900,
  hour: 3540,
};

const DURATION_CAP_SECONDS = {
  short: 150,
  medium: 360,
  long: 960,
  hour: 3600,
};

const MIN_CUSTOM_DURATION_SECONDS = 60;
const MAX_CUSTOM_DURATION_SECONDS = 7200;

const CHAPTER_RATIO = {
  short: [0, 0.28, 0.66],
  medium: [0, 0.22, 0.48, 0.74],
  long: [0, 0.16, 0.34, 0.52, 0.72, 0.88],
  hour: [0, 0.08, 0.16, 0.25, 0.34, 0.43, 0.52, 0.61, 0.7, 0.79, 0.88, 0.95],
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getDurationMode(targetSeconds: number, fallback: "short" | "medium" | "long" | "hour") {
  if (targetSeconds >= 1800) return "hour";
  if (targetSeconds >= 720) return "long";
  if (targetSeconds >= 240) return "medium";
  return fallback;
}

function formatDurationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const minutePart = remainingMinutes ? ` ${remainingMinutes} min` : "";
    const secondPart = remainingSeconds ? ` ${remainingSeconds} sec` : "";
    return `${hours} hr${minutePart}${secondPart}`;
  }
  return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
}

function getChapterRatios(duration: "short" | "medium" | "long" | "hour", targetSeconds: number) {
  if (targetSeconds >= 3600) return CHAPTER_RATIO.hour;
  return CHAPTER_RATIO[duration];
}

const LOCAL_TTS_DIR = path.join(process.cwd(), "local-tts");
const PIPER_EXE = process.env.PIPER_EXE || path.join(LOCAL_TTS_DIR, "piper", "piper.exe");
const PIPER_VOICE_DIR = process.env.PIPER_VOICE_DIR || path.join(LOCAL_TTS_DIR, "voices");
const CHATTERBOX_DIR = process.env.CHATTERBOX_DIR || path.join(LOCAL_TTS_DIR, "chatterbox");
const CHATTERBOX_SCRIPT = process.env.CHATTERBOX_SCRIPT || path.join(process.cwd(), "tools", "chatterbox_generate.py");
const CHATTERBOX_PYTHON = process.env.CHATTERBOX_PYTHON || path.join(CHATTERBOX_DIR, "Scripts", "python.exe");
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const ELEVENLABS_DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const PIPER_VOICES = [
  {
    id: "lessac",
    name: "Lessac English Medium",
    model: path.join(PIPER_VOICE_DIR, "en_US-lessac-medium.onnx"),
  },
  {
    id: "ryan",
    name: "Ryan English Medium",
    model: path.join(PIPER_VOICE_DIR, "en_US-ryan-medium.onnx"),
  },
  {
    id: "amy",
    name: "Amy English Medium",
    model: path.join(PIPER_VOICE_DIR, "en_US-amy-medium.onnx"),
  },
];

const LIVE_PODCAST_FEEDS: LivePodcastFeed[] = [
  {
    id: "npr-news-now",
    name: "NPR News Now",
    publisher: "NPR",
    feedUrl: "https://feeds.npr.org/500005/podcast.xml",
    homeUrl: "https://www.npr.org/podcasts/500005/npr-news-now",
    category: "News",
    listenerBase: 640,
  },
  {
    id: "up-first",
    name: "Up First",
    publisher: "NPR",
    feedUrl: "https://feeds.npr.org/510318/podcast.xml",
    homeUrl: "https://www.npr.org/podcasts/510318/up-first",
    category: "Daily",
    listenerBase: 920,
  },
  {
    id: "planet-money",
    name: "Planet Money",
    publisher: "NPR",
    feedUrl: "https://feeds.npr.org/510289/podcast.xml",
    homeUrl: "https://www.npr.org/podcasts/510289/planet-money",
    category: "Business",
    listenerBase: 510,
  },
  {
    id: "ted-radio-hour",
    name: "TED Radio Hour",
    publisher: "NPR",
    feedUrl: "https://feeds.npr.org/510298/podcast.xml",
    homeUrl: "https://www.npr.org/podcasts/510298/ted-radio-hour",
    category: "Ideas",
    listenerBase: 420,
  },
  {
    id: "code-switch",
    name: "Code Switch",
    publisher: "NPR",
    feedUrl: "https://feeds.npr.org/510312/podcast.xml",
    homeUrl: "https://www.npr.org/podcasts/510312/codeswitch",
    category: "Culture",
    listenerBase: 290,
  },
  {
    id: "fresh-air",
    name: "Fresh Air",
    publisher: "NPR",
    feedUrl: "https://feeds.npr.org/381444908/podcast.xml",
    homeUrl: "https://www.npr.org/podcasts/381444908/fresh-air",
    category: "Interviews",
    listenerBase: 380,
  },
];

let livePodcastCache: { timestamp: number; podcasts: LivePodcastEpisode[] } | null = null;
const presetAudioCache = new Map<string, Buffer>();

const PLAYABLE_PRESET_PODCASTS: PlayablePresetPodcast[] = [
  {
    id: "echo-ai-voices",
    showTitle: "The Voice Lab",
    episodeTitle: "Why AI Voices Still Sound Robotic",
    publisher: "ECHO Studios",
    category: "Voice",
    description: "A live room about cadence, pacing, emotion, and why premium TTS sounds more human than browser speech.",
    duration: "14:20",
    listeners: 186,
    gradient: "from-fuchsia-600 via-violet-700 to-slate-950",
    audioScript: "Welcome to The Voice Lab. Today we are listening for the difference between a robotic preview voice and a finished studio quality podcast voice. Natural speech needs timing, small pauses, emphasis, and a voice model that can shape the sentence instead of simply reading it.",
  },
  {
    id: "echo-hour-builder",
    showTitle: "Hour Builder Live",
    episodeTitle: "Designing a Podcast That Can Hold Sixty Minutes",
    publisher: "ECHO Studios",
    category: "Production",
    description: "Hosts walk through how to turn a short prompt into a full episode arc with chapters and listener payoff.",
    duration: "22:45",
    listeners: 94,
    gradient: "from-sky-500 via-indigo-700 to-slate-950",
    audioScript: "This is Hour Builder Live. A one hour podcast needs more than a longer script. It needs a clear promise, recurring segments, a strong counterpoint, and enough room for the hosts to discover something as they talk.",
  },
  {
    id: "echo-publish-room",
    showTitle: "Publish Room",
    episodeTitle: "RSS, Artwork, Audio Hosting, and Going Public",
    publisher: "ECHO Studios",
    category: "Publishing",
    description: "A practical room on what a podcast needs before Apple, Spotify, YouTube, and other directories can list it.",
    duration: "18:08",
    listeners: 142,
    gradient: "from-emerald-500 via-teal-700 to-slate-950",
    audioScript: "Welcome to Publish Room. To put a podcast on the internet, you need a public audio file, public artwork, owner information, and an RSS feed. Directories like Apple Podcasts and Spotify read that feed and list the episode from there.",
  },
  {
    id: "echo-cover-clinic",
    showTitle: "Cover Clinic",
    episodeTitle: "Making Podcast Artwork That Reads at Thumbnail Size",
    publisher: "ECHO Studios",
    category: "Design",
    description: "A design-focused room about cover art composition, contrast, titles, and export-ready podcast artwork.",
    duration: "11:36",
    listeners: 67,
    gradient: "from-rose-500 via-orange-600 to-slate-950",
    audioScript: "You are in Cover Clinic. Podcast artwork has to work when it is tiny. The title must be clear, the contrast has to survive compression, and the image should tell listeners what kind of room they are entering.",
  },
  {
    id: "echo-creator-news",
    showTitle: "Creator Newsdesk",
    episodeTitle: "The Week in Audio Tools",
    publisher: "ECHO Studios",
    category: "News",
    description: "A fast live-style briefing on AI audio workflows, creator tools, and podcast production trends.",
    duration: "9:58",
    listeners: 231,
    gradient: "from-amber-400 via-red-600 to-slate-950",
    audioScript: "This is Creator Newsdesk. This week in audio tools, creators are asking for faster drafting, better voices, simple cover generation, and clearer publishing steps. The tools that win will make the full workflow feel connected.",
  },
  {
    id: "echo-midnight",
    showTitle: "Midnight Signal",
    episodeTitle: "Late Night Prompts and Strange Ideas",
    publisher: "ECHO Studios",
    category: "Ideas",
    description: "A slower room for speculative prompts, strange concepts, and atmospheric conversation starters.",
    duration: "16:12",
    listeners: 58,
    gradient: "from-purple-800 via-slate-900 to-black",
    audioScript: "Welcome to Midnight Signal. Tonight we take a strange prompt and let it breathe. The best episodes often start with a question that sounds impossible, then slowly becomes specific enough to discuss.",
  },
];

function cleanText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getAvailablePiperVoices() {
  return PIPER_VOICES.filter((voice) => fileExists(voice.model) && fileExists(`${voice.model}.json`));
}

function getAudioEngineStatus() {
  const voices = getAvailablePiperVoices();
  return {
    piperAvailable: fileExists(PIPER_EXE) && voices.length > 0,
    chatterboxAvailable: fileExists(CHATTERBOX_PYTHON) && fileExists(CHATTERBOX_SCRIPT),
    elevenLabsAvailable: Boolean(ELEVENLABS_API_KEY),
    elevenLabsModelId: ELEVENLABS_MODEL_ID,
    elevenLabsDefaultVoiceId: ELEVENLABS_DEFAULT_VOICE_ID,
    piperExe: PIPER_EXE,
    voiceDir: PIPER_VOICE_DIR,
    chatterboxPython: CHATTERBOX_PYTHON,
    chatterboxInstallCommand: ".\\install-chatterbox.ps1",
    voices: voices.map(({ id, name }) => ({ id, name })),
  };
}

async function getElevenLabsVoices() {
  if (!ELEVENLABS_API_KEY) return [];
  const response = await fetch("https://api.elevenlabs.io/v2/voices", {
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
  });
  if (!response.ok) return [];
  const data = await response.json();
  const voices = Array.isArray(data.voices) ? data.voices : [];
  return voices.slice(0, 30).map((voice: any) => ({
    id: String(voice.voice_id || ""),
    name: String(voice.name || "ElevenLabs voice"),
    category: String(voice.category || ""),
  })).filter((voice: any) => voice.id);
}

function shortText(value: string, max = 96): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trim()}...`;
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeXml(value: string) {
  return stripCdata(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getXmlTagValue(xml: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(pattern);
  return match ? decodeXml(match[1]).trim() : "";
}

function getXmlTagAttribute(xml: string, tagName: string, attributeName: string) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "i");
  const match = xml.match(pattern);
  if (!match) return "";
  const attrPattern = new RegExp(`${attributeName}=["']([^"']+)["']`, "i");
  const attr = match[1].match(attrPattern);
  return attr ? decodeXml(attr[1]).trim() : "";
}

function getEnclosureUrl(itemXml: string) {
  const enclosureMatch = itemXml.match(/<enclosure\b([^>]*)>/i);
  if (!enclosureMatch) return "";
  const urlMatch = enclosureMatch[1].match(/url=["']([^"']+)["']/i);
  return urlMatch ? decodeXml(urlMatch[1]).trim() : "";
}

function getRssImageUrl(feedXml: string, itemXml: string) {
  return (
    getXmlTagAttribute(itemXml, "itunes:image", "href") ||
    getXmlTagAttribute(feedXml, "itunes:image", "href") ||
    getXmlTagValue(getXmlTagValue(feedXml, "image"), "url")
  );
}

function getLiveListenerCount(feed: LivePodcastFeed) {
  const seed = Array.from(feed.id).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const minute = Math.floor(Date.now() / 60000);
  return feed.listenerBase + ((seed + minute) % 460);
}

function parseLatestEpisode(feed: LivePodcastFeed, xml: string): LivePodcastEpisode | null {
  const item = xml.match(/<item\b[\s\S]*?<\/item>/i)?.[0];
  if (!item) return null;

  const audioUrl = getEnclosureUrl(item);
  if (!audioUrl) return null;

  const showTitle = stripHtml(getXmlTagValue(xml, "title") || feed.name);
  const episodeTitle = stripHtml(getXmlTagValue(item, "title") || showTitle);
  const description = shortText(stripHtml(getXmlTagValue(item, "description") || getXmlTagValue(item, "itunes:summary") || ""), 170);
  const duration = stripHtml(getXmlTagValue(item, "itunes:duration") || "Live");
  const episodeUrl = stripHtml(getXmlTagValue(item, "link") || feed.homeUrl);
  const imageUrl = getRssImageUrl(xml, item);

  return {
    id: feed.id,
    showTitle,
    episodeTitle,
    publisher: feed.publisher,
    category: feed.category,
    description,
    feedUrl: feed.feedUrl,
    homeUrl: feed.homeUrl,
    episodeUrl,
    imageUrl,
    audioUrl,
    duration,
    listeners: getLiveListenerCount(feed),
  };
}

async function fetchLivePodcast(feed: LivePodcastFeed): Promise<LivePodcastEpisode | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(feed.feedUrl, {
      headers: {
        "User-Agent": "ECHO Studios podcast maker",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const xml = await response.text();
    return parseLatestEpisode(feed, xml);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getLivePodcasts() {
  if (livePodcastCache && Date.now() - livePodcastCache.timestamp < 5 * 60 * 1000) {
    return livePodcastCache.podcasts.map((podcast) => ({
      ...podcast,
      listeners: getLiveListenerCount(LIVE_PODCAST_FEEDS.find((feed) => feed.id === podcast.id) || LIVE_PODCAST_FEEDS[0]),
    }));
  }

  const results = await Promise.allSettled(LIVE_PODCAST_FEEDS.map(fetchLivePodcast));
  const podcasts = results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((podcast): podcast is LivePodcastEpisode => Boolean(podcast?.audioUrl));

  livePodcastCache = { timestamp: Date.now(), podcasts };
  return podcasts;
}

function createToneWavBuffer(seed: string, seconds = 9) {
  const sampleRate = 44100;
  const channels = 1;
  const bytesPerSample = 2;
  const sampleCount = sampleRate * seconds;
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  const seedValue = Array.from(seed).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const baseFrequency = 180 + (seedValue % 180);
  const pulseFrequency = 2 + (seedValue % 4);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleRate;
    const envelope = Math.min(1, t / 0.18, (seconds - t) / 0.35);
    const pulse = 0.55 + 0.45 * Math.sin(2 * Math.PI * pulseFrequency * t);
    const wave =
      Math.sin(2 * Math.PI * baseFrequency * t) * 0.42 +
      Math.sin(2 * Math.PI * (baseFrequency * 1.5) * t) * 0.22 +
      Math.sin(2 * Math.PI * (baseFrequency * 2.25) * t) * 0.1;
    const sample = Math.max(-1, Math.min(1, wave * pulse * envelope * 0.65));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }

  return buffer;
}

function getPresetPodcastPayload(req: { protocol: string; get(name: string): string | undefined }, preset: PlayablePresetPodcast) {
  const host = req.get("host") || `localhost:${Number(process.env.PORT) || 3174}`;
  return {
    id: preset.id,
    showTitle: preset.showTitle,
    episodeTitle: preset.episodeTitle,
    publisher: preset.publisher,
    category: preset.category,
    description: preset.description,
    feedUrl: "",
    homeUrl: "",
    episodeUrl: "",
    imageUrl: "",
    audioUrl: `${req.protocol}://${host}/api/preset-audio/${encodeURIComponent(preset.id)}`,
    duration: preset.duration,
    listeners: preset.listeners + (Math.floor(Date.now() / 60000) % 31),
    gradient: preset.gradient,
    preset: true,
  };
}

function titleFromPrompt(topic: string): string {
  const trimmed = topic
    .replace(/[^\w\s:'"-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = trimmed.split(" ").filter(Boolean).slice(0, 9);
  const title = words
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
  return title || "Untitled ECHO Episode";
}

function normalizeSpeakers(input: RequestedSpeaker[] | undefined, numSpeakers = 2) {
  const requested = Array.isArray(input) && input.length > 0 ? input : FALLBACK_SPEAKERS.slice(0, numSpeakers || 2);
  return requested.slice(0, 5).map((speaker, index) => {
    const fallback = FALLBACK_SPEAKERS[index % FALLBACK_SPEAKERS.length];
    return {
      name: cleanText(speaker.name, fallback.name),
      role: cleanText(speaker.role, fallback.role),
      bio: cleanText(speaker.bio, fallback.bio),
      voiceAccent: cleanText(speaker.voiceAccent, fallback.voiceAccent),
      gender: speaker.gender || fallback.gender,
      style: cleanText(speaker.style, fallback.style),
      avatarSeed: cleanText(speaker.avatarSeed, fallback.avatarSeed),
      voiceReferenceId: speaker.voiceReferenceId ? cleanText(speaker.voiceReferenceId, "") : undefined,
      voiceReferenceName: speaker.voiceReferenceName ? cleanText(speaker.voiceReferenceName, "") : undefined,
      voiceSourceType: speaker.voiceSourceType || fallback.voiceSourceType,
    };
  });
}

function estimateSeconds(dialogue: string): number {
  const words = dialogue.split(/\s+/).filter(Boolean).length;
  return Math.max(6, Math.ceil(words / 2.45) + 1);
}

function normalizeAudioText(value: string) {
  return value
    .replace(/\bECHO\b/g, "Echo")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\.\.\./g, ", ")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAudioPreviewText(req: AudioRequest) {
  const script = Array.isArray(req.script) ? req.script : [];
  const maxSeconds = Math.max(30, Math.min(Number(req.maxSeconds) || 240, 600));
  let cursor = 0;
  const lines: string[] = [];

  for (const line of script) {
    const dialogue = cleanText(line.dialogue, "");
    if (!dialogue) continue;
    const durationSeconds = Math.max(1, Number(line.durationSeconds) || estimateSeconds(dialogue));
    if (cursor + durationSeconds > maxSeconds && lines.length > 0) break;
    lines.push(normalizeAudioText(dialogue));
    cursor += durationSeconds;
  }

  return lines.join("\n\n");
}

async function synthesizeWithPiper(text: string, voiceId?: string) {
  const status = getAudioEngineStatus();
  if (!status.piperAvailable) {
    throw new Error("Piper neural TTS is not installed. Run .\\install-piper.ps1, then restart the app.");
  }

  const voices = getAvailablePiperVoices();
  const selectedVoice = voices.find((voice) => voice.id === voiceId) || voices[0];
  const outDir = path.join(process.cwd(), "tmp-audio");
  const outFile = path.join(outDir, `${randomUUID()}.wav`);
  await fsp.mkdir(outDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(PIPER_EXE, ["--model", selectedVoice.model, "--output_file", outFile], {
      cwd: path.dirname(PIPER_EXE),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `Piper exited with code ${code}`));
    });
    child.stdin.end(text);
  });

  const audio = await fsp.readFile(outFile);
  await fsp.unlink(outFile).catch(() => undefined);
  return {
    audio: audio.toString("base64"),
    voice: { id: selectedVoice.id, name: selectedVoice.name },
  };
}

async function synthesizeWithElevenLabs(text: string, voiceId?: string, modelId?: string) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs is not configured. Add ELEVENLABS_API_KEY to .env, restart the app, then use Studio Quality.");
  }

  const selectedVoiceId = voiceId || ELEVENLABS_DEFAULT_VOICE_ID;
  const selectedModelId = modelId || ELEVENLABS_MODEL_ID;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: selectedModelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.25,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `ElevenLabs returned ${response.status}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return {
    audio: audio.toString("base64"),
    voice: { id: selectedVoiceId, name: "ElevenLabs Studio Voice" },
  };
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return ".m4a";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("webm")) return ".webm";
  return ".wav";
}

async function synthesizeWithChatterbox(text: string, references: VoiceReferenceRequest[] | undefined) {
  if (!fileExists(CHATTERBOX_PYTHON) || !fileExists(CHATTERBOX_SCRIPT)) {
    throw new Error("Free local voice cloning is not installed. Run .\\install-chatterbox.ps1, restart the app, then use Local Clone.");
  }

  const reference = Array.isArray(references)
    ? references.find((item) => item.consentConfirmed && cleanText(item.dataUrl, ""))
    : undefined;
  if (!reference) {
    throw new Error("Upload a voice reference and confirm permission before using Local Clone.");
  }

  const decoded = decodeReferenceAudio(reference);
  const outDir = path.join(process.cwd(), "tmp-audio");
  await fsp.mkdir(outDir, { recursive: true });
  const id = randomUUID();
  const referenceFile = path.join(outDir, `${id}-reference${extensionFromMimeType(decoded.mimeType)}`);
  const textFile = path.join(outDir, `${id}.txt`);
  const outFile = path.join(outDir, `${id}.wav`);
  const previewText = text.slice(0, 1400);
  await fsp.writeFile(referenceFile, decoded.buffer);
  await fsp.writeFile(textFile, previewText, "utf8");

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(CHATTERBOX_PYTHON, [CHATTERBOX_SCRIPT, "--text-file", textFile, "--voice", referenceFile, "--out", outFile], {
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `Local voice clone exited with code ${code}`));
      });
    });

    const audio = await fsp.readFile(outFile);
    return {
      audio: audio.toString("base64"),
      voice: { id: cleanText(reference.clonedVoiceId, "local-clone"), name: cleanText(reference.clonedVoiceName || reference.name, "Local cloned voice") },
    };
  } finally {
    await Promise.all([
      fsp.unlink(referenceFile).catch(() => undefined),
      fsp.unlink(textFile).catch(() => undefined),
      fsp.unlink(outFile).catch(() => undefined),
    ]);
  }
}

function getImageContext(images: PromptImage[] | undefined): string {
  if (!Array.isArray(images) || images.length === 0) return "";
  return images
    .slice(0, 6)
    .map((image, index) => {
      const name = cleanText(image.name, `image ${index + 1}`);
      const notes = cleanText(image.notes, "");
      return notes ? `${name}: ${notes}` : name;
    })
    .join("; ");
}

function getVoiceReferenceContext(references: VoiceReferenceRequest[] | undefined): string {
  if (!Array.isArray(references) || references.length === 0) return "";
  return references
    .slice(0, 4)
    .map((reference, index) => cleanText(reference.clonedVoiceName || reference.name, `voice reference ${index + 1}`))
    .join(", ");
}

function sanitizeFilename(value: string, fallback = "voice-reference.wav") {
  const cleaned = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function decodeReferenceAudio(reference: VoiceReferenceRequest) {
  const dataUrl = cleanText(reference.dataUrl, "");
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid audio sample data for ${cleanText(reference.name, "voice reference")}.`);
  }

  const mimeType = cleanText(reference.mimeType || match[1], "audio/wav");
  if (!mimeType.startsWith("audio/")) {
    throw new Error(`${cleanText(reference.name, "Voice reference")} must be an audio file.`);
  }

  const buffer = match[2] === ";base64"
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");

  if (buffer.length < 1024) {
    throw new Error(`${cleanText(reference.name, "Voice reference")} is too small to clone.`);
  }
  if (buffer.length > 16 * 1024 * 1024) {
    throw new Error(`${cleanText(reference.name, "Voice reference")} is larger than the 16 MB per-sample limit.`);
  }

  return {
    buffer,
    mimeType,
    filename: sanitizeFilename(cleanText(reference.name, "voice-reference.wav")),
  };
}

async function cloneElevenLabsVoice({
  voiceName,
  references,
}: {
  voiceName: string;
  references: VoiceReferenceRequest[];
}) {
  const validReferences = references
    .filter((reference) => reference.consentConfirmed && cleanText(reference.dataUrl, ""))
    .slice(0, 5);
  if (validReferences.length === 0) {
    throw new Error("Upload at least one audio sample and confirm you have rights to clone that voice.");
  }
  const safeVoiceName = shortText(cleanText(voiceName, "ECHO cloned voice"), 70);

  if (!ELEVENLABS_API_KEY) {
    validReferences.forEach(decodeReferenceAudio);
    return {
      id: `local-reference-${randomUUID()}`,
      name: safeVoiceName,
      category: "local-reference",
      provider: "chatterbox" as const,
      localOnly: true,
    };
  }

  const formData = new FormData();
  formData.append("name", safeVoiceName);
  formData.append("description", "Created from ECHO Studios creator voice references.");

  validReferences.forEach((reference) => {
    const { buffer, mimeType, filename } = decodeReferenceAudio(reference);
    const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    formData.append("files", new Blob([bytes], { type: mimeType }), filename);
  });

  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `ElevenLabs voice cloning returned ${response.status}`);
  }

  const payload = await response.json();
  const voiceId = cleanText(payload?.voice_id, "");
  if (!voiceId) {
    throw new Error("ElevenLabs did not return a voice ID for the cloned voice.");
  }

  return {
    id: voiceId,
    name: safeVoiceName,
    category: "cloned",
    provider: "elevenlabs" as const,
  };
}

function getLineTemplate(index: number, topic: string, imageContext: string, musicMood: string, duration: string) {
  const topicShort = shortText(topic, 132);
  const visualCue = imageContext ? ` The uploaded visual prompt adds this production cue: ${shortText(imageContext, 150)}.` : "";
  const templates = [
    `Welcome to ECHO Studios. Today we are turning one prompt into a full episode: ${topicShort}.`,
    `The hook is simple: if someone only has one minute, they should leave understanding why this matters right now.`,
    `Let's set the scene first. The strongest angle is not just the topic itself, but the tension hiding inside it.`,
    `I hear that tension too. One side says this is obvious, and the other side says the details change everything.`,
    `Here is the clean version: ${topicShort} is really a story about choices, tradeoffs, and the systems around them.`,
    `That is where the episode gets useful. We can move from a headline into actual consequences people can picture.${visualCue}`,
    `A good example would be a listener asking, "What would I do differently after hearing this?" That question keeps us honest.`,
    `Exactly. If the answer is only trivia, the episode is thin. If the answer changes a decision, we have a real show.`,
    `So the first takeaway is context. Do not treat this as isolated; treat it as part of a bigger pattern.`,
    `The second takeaway is incentives. People, companies, and communities usually move toward whatever gets rewarded.`,
    `And the third takeaway is timing. Some ideas sound impossible until the surrounding tools make them feel normal.`,
    `Let me challenge that for a second. There is also a risk of making the topic sound cleaner than it really is.`,
    `That is fair. The messy part is where good podcasts live, because listeners can hear the hosts working through uncertainty.`,
    `If we were producing this as a series, I would split it into origin story, pressure points, and the next practical move.`,
    `The origin story gives us stakes. The pressure points give us conflict. The practical move gives the listener a reason to stay.`,
    `For sound design, ${musicMood} should sit underneath the intro, then step back so the conversation feels close and human.`,
    `There is also a visual identity here. The cover should make the prompt feel specific, not generic or overly polished.`,
    `A smart midpoint question is: who benefits if this future happens, and who gets asked to absorb the cost?`,
    `That question opens the door to nuance. It keeps the show from sounding like an advertisement for one point of view.`,
    `I would bring in a short counterargument here, then let the hosts test it instead of instantly dismissing it.`,
    `The counterargument is that the entire premise might be overstated. Maybe the trend is real, but the timeline is exaggerated.`,
    `And the response is that timelines can be wrong while direction can still matter. That is a very podcast-friendly distinction.`,
    `For listeners building something, the practical advice is to watch weak signals before they become obvious demand.`,
    `For listeners just curious, the advice is to ask better questions and avoid treating the loudest claim as the most likely one.`,
    `This is also where a guest clip would work: someone with firsthand experience giving a grounded thirty-second story.`,
    `Then we come back to the hosts and ask what changed in their mind after hearing that story.`,
    `The answer should be specific. Maybe a risk feels smaller, maybe an opportunity feels nearer, or maybe the ethics get sharper.`,
    `That emotional turn matters. Great episodes are not only informative; they let the listener feel their own opinion updating.`,
    `Before the outro, I would recap the clearest claim: ${shortText(topic, 110)} deserves attention because the second-order effects are the story.`,
    `And I would leave one open loop for a follow-up episode, because a good prompt should feel like the start of a show universe.`,
    `Final thought: the best version of this episode is curious, specific, and willing to say "we do not know yet" when that is true.`,
    `Thanks for listening to ECHO Studios. Save the prompt, revise the angle, and build the next episode from the strongest question.`,
  ];

  if (duration === "short") return templates[index % 10];
  if (duration === "medium") return templates[index % 18];
  if (duration === "long" && index < templates.length) return templates[index];

  const section = Math.floor(index / 12) + 1;
  const beat = index % 12;
  const lenses = [
    "origin story",
    "current landscape",
    "human stakes",
    "technical details",
    "money and incentives",
    "creative angle",
    "skeptical read",
    "future scenario",
    "practical playbook",
    "listener questions",
  ];
  const questions = [
    "what changes when this becomes normal",
    "who benefits first and who waits",
    "what most people misunderstand",
    "which assumption deserves pressure",
    "what a careful creator should do next",
    "where the obvious answer breaks down",
  ];
  const lens = lenses[section % lenses.length];
  const question = questions[(section + beat) % questions.length];

  const longFormTemplates = [
    `For segment ${section}, let's take the ${lens} and connect it back to ${topicShort}.`,
    `The guiding question here is ${question}, because that is where the episode finds momentum.`,
    `One useful way to frame it is to separate the headline from the mechanism underneath it.`,
    `The headline gets attention, but the mechanism explains why people should keep listening.`,
    `If a listener is skeptical, I would not ask them to agree yet. I would ask them to notice the pattern.`,
    `That pattern shows up in small decisions first, then in budgets, tools, habits, and finally culture.`,
    `There is a strong counterpoint too. Sometimes the story sounds bigger because everyone is repeating the same simple version.`,
    `So we should slow down and ask what evidence would actually change our minds on this point.`,
    `The practical takeaway is not to predict everything. It is to identify the next decision that becomes easier after hearing this.`,
    `For production, keep the sound bed close to ${musicMood}, but let the voices stay upfront and intimate.`,
    imageContext
      ? `The image prompt should influence this section visually: ${shortText(imageContext, 145)}.`
      : `The cover art for this section should feel specific to the topic, not like a generic technology poster.`,
    `Before we move to the next segment, the cleanest summary is that ${shortText(topic, 115)} is really about second-order effects.`,
  ];

  return longFormTemplates[beat];
}

function buildLocalPodcast(req: LocalPodcastRequest) {
  const topic = cleanText(req.topic, "A creator-led conversation about a new idea");
  const fallbackDuration = req.duration && req.duration in DURATION_TARGET_SECONDS ? req.duration : "hour";
  const requestedDurationSeconds = Math.round(Number(req.durationSeconds) || 0);
  const hasCustomDuration = requestedDurationSeconds >= MIN_CUSTOM_DURATION_SECONDS;
  const targetSeconds = hasCustomDuration
    ? clampNumber(requestedDurationSeconds, MIN_CUSTOM_DURATION_SECONDS, MAX_CUSTOM_DURATION_SECONDS)
    : DURATION_TARGET_SECONDS[fallbackDuration];
  const capSeconds = hasCustomDuration
    ? Math.min(MAX_CUSTOM_DURATION_SECONDS, targetSeconds + 30)
    : DURATION_CAP_SECONDS[fallbackDuration];
  const duration = getDurationMode(targetSeconds, fallbackDuration);
  const durationLabel = formatDurationLabel(targetSeconds);
  const musicMood = cleanText(req.musicMood, "Pure Speech");
  const language = cleanText(req.language, "English");
  const speakers = normalizeSpeakers(req.speakers, req.numSpeakers);
  const imageContext = getImageContext(req.promptImages);
  const voiceContext = getVoiceReferenceContext(req.voiceReferences);
  const maxLines = Math.min(1200, Math.max(24, Math.ceil(capSeconds / 7)));
  const script = [];
  let cursor = 0;
  let index = 0;

  while ((cursor < targetSeconds || script.length < speakers.length * 3) && index < maxLines) {
    const speaker = speakers[index % speakers.length];
    const dialogue = getLineTemplate(index, topic, imageContext, musicMood, duration);
    const durationSeconds = estimateSeconds(dialogue);
    if (cursor + durationSeconds > capSeconds) break;
    script.push({
      id: String(index + 1),
      speakerName: speaker.name,
      dialogue,
      soundEffect:
        index === 0
          ? "intro music fades under the host"
          : cursor + durationSeconds >= targetSeconds || cursor + durationSeconds >= capSeconds - 15
            ? "soft outro sting"
            : index % 18 === 0
              ? "brief reflective pause"
              : null,
      durationSeconds,
      estimatedStartSeconds: cursor,
    });
    cursor += durationSeconds;
    index += 1;
  }

  const ratios = getChapterRatios(duration, targetSeconds);
  const chapterTitles = [
    "Cold Open",
    "Set the Stakes",
    imageContext ? "Visual Prompt Cues" : "Core Tension",
    "Counterpoint",
    "Practical Takeaways",
    "Outro",
  ];
  const hourChapterTitles = [
    "Cold Open",
    "Origin Story",
    "Current Landscape",
    "Human Stakes",
    "Technical Details",
    "Money and Incentives",
    "Creative Angle",
    "Skeptical Read",
    "Future Scenario",
    "Practical Playbook",
    "Listener Questions",
    "Final Synthesis",
  ];
  const titles = duration === "hour" ? hourChapterTitles : chapterTitles;

  return {
    title: titleFromPrompt(topic),
    tagline: `A ${durationLabel} conversational episode built from your prompt.`,
    description:
      language === "English"
        ? `A free, locally generated ECHO Studios script exploring ${shortText(topic, 150)}.${voiceContext ? ` Voice reference: ${voiceContext}.` : ""}`
        : `A free, locally generated ECHO Studios script framed for ${language} production and exploring ${shortText(topic, 130)}.${voiceContext ? ` Voice reference: ${voiceContext}.` : ""}`,
    musicMood,
    speakers,
    chapters: ratios.map((ratio, index) => ({
      title: titles[index] || `Chapter ${index + 1}`,
      startSeconds: Math.round(cursor * ratio),
    })),
    script,
  };
}

type AppAssetsMode = "vite" | "static" | "api";

export async function createEchoApp(options: { assetsMode?: AppAssetsMode } = {}) {
  const app = express();
  const assetsMode = options.assetsMode || (process.env.NODE_ENV !== "production" ? "vite" : "static");

  app.use(express.json({ limit: "75mb" }));

  app.post("/api/clone-voice", async (req, res) => {
    try {
      const consentConfirmed = Boolean(req.body?.consentConfirmed);
      if (!consentConfirmed) {
        return res.status(400).json({ error: "Confirm you have permission to clone this voice before uploading samples." });
      }

      const references = Array.isArray(req.body?.references) ? req.body.references as VoiceReferenceRequest[] : [];
      const voice = await cloneElevenLabsVoice({
        voiceName: cleanText(req.body?.voiceName, "ECHO cloned voice"),
        references: references.map((reference) => ({ ...reference, consentConfirmed })),
      });

      res.json({
        voice,
        message: voice.provider === "chatterbox"
          ? "Local clone reference is ready. Install Chatterbox if needed, then generate audio with Local Clone."
          : "ElevenLabs cloned voice is ready for Studio Quality audio.",
      });
    } catch (e: any) {
      res.status(ELEVENLABS_API_KEY ? 502 : 501).json({
        error: e.message || "Unable to clone the voice.",
        elevenLabsAvailable: Boolean(ELEVENLABS_API_KEY),
      });
    }
  });

  app.post("/api/generate-podcast", (req, res) => {
    try {
      res.json(buildLocalPodcast(req.body || {}));
    } catch (e: any) {
      console.error("ECHO Studios local generation error:", e);
      res.status(500).json({ error: e.message || "Unable to generate the podcast script." });
    }
  });

  app.get("/api/audio-engine", async (_req, res) => {
    const elevenLabsVoices = await getElevenLabsVoices().catch(() => []);
    res.json({
      ...getAudioEngineStatus(),
      elevenLabsVoices,
      browserSpeechFallback: true,
      installCommand: ".\\install-piper.ps1",
    });
  });

  app.get("/api/live-podcasts", async (_req, res) => {
    try {
      const podcasts = await getLivePodcasts();
      const presets = PLAYABLE_PRESET_PODCASTS.map((preset) => getPresetPodcastPayload(_req, preset));
      res.json({
        generatedAt: new Date().toISOString(),
        podcasts: [...podcasts, ...presets],
      });
    } catch (e: any) {
      res.status(502).json({
        error: e.message || "Unable to load public podcast feeds.",
        podcasts: PLAYABLE_PRESET_PODCASTS.map((preset) => getPresetPodcastPayload(_req, preset)),
      });
    }
  });

  app.get("/api/preset-podcasts", (req, res) => {
    res.json({
      generatedAt: new Date().toISOString(),
      podcasts: PLAYABLE_PRESET_PODCASTS.map((preset) => getPresetPodcastPayload(req, preset)),
    });
  });

  app.get("/api/preset-audio/:id", async (req, res) => {
    const preset = PLAYABLE_PRESET_PODCASTS.find((item) => item.id === req.params.id);
    if (!preset) {
      return res.status(404).json({ error: "Preset podcast not found." });
    }

    try {
      let audio = presetAudioCache.get(preset.id);
      if (!audio) {
        try {
          const result = await synthesizeWithPiper(preset.audioScript, preset.id.includes("hour") || preset.id.includes("publish") ? "ryan" : "lessac");
          audio = Buffer.from(result.audio, "base64");
        } catch {
          audio = createToneWavBuffer(preset.id);
        }
        presetAudioCache.set(preset.id, audio);
      }

      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(audio);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Unable to generate preset podcast audio." });
    }
  });

  app.post("/api/generate-audio", async (req, res) => {
    try {
      const text = buildAudioPreviewText(req.body || {});
      if (!text) {
        return res.status(400).json({ error: "No script text was provided for audio generation." });
      }
      const provider = req.body?.provider === "elevenlabs" ? "elevenlabs" : req.body?.provider === "chatterbox" ? "chatterbox" : "piper";
      const result = provider === "elevenlabs"
        ? await synthesizeWithElevenLabs(text, req.body?.voiceId, req.body?.modelId)
        : provider === "chatterbox"
          ? await synthesizeWithChatterbox(text, req.body?.voiceReferences)
          : await synthesizeWithPiper(text, req.body?.voiceId);
      res.json({
        mode: provider,
        mimeType: provider === "elevenlabs" ? "audio/mpeg" : "audio/wav",
        ...result,
      });
    } catch (e: any) {
      res.status(501).json({
        error: e.message || "Neural TTS is not available.",
        ...getAudioEngineStatus(),
      });
    }
  });

  app.post("/api/chat", (req, res) => {
    const text = cleanText(req.body?.text, "this podcast idea");
    res.json({
      text: `Free mode is active. For the strongest episode, turn "${shortText(text, 120)}" into a clear question, add any image notes that matter, then generate a short draft before expanding it.`,
    });
  });

  if (assetsMode === "vite") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (assetsMode === "static") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

async function startServer() {
  const app = await createEchoApp();
  const PORT = Number(process.env.PORT) || 3174;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ECHO Studios] Free podcast maker running at http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
