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
  id?: string;
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

type ResearchSource = {
  title: string;
  source: string;
  url: string;
  summary: string;
  published?: string;
  kind?: "encyclopedia" | "paper" | "scholarly-index";
};

type AudioRequest = {
  script?: Array<{
    speakerName?: string;
    dialogue?: string;
    durationSeconds?: number;
  }>;
  speakers?: RequestedSpeaker[];
  maxSeconds?: number;
  provider?: "elevenlabs" | "piper" | "chatterbox";
  voiceId?: string;
  modelId?: string;
  voiceReferences?: VoiceReferenceRequest[];
};

type AudioSegment = {
  speakerName: string;
  text: string;
  durationSeconds: number;
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
const CHATTERBOX_PACKAGE_DIR = path.join(CHATTERBOX_DIR, "Lib", "site-packages", "chatterbox");
const CHATTERBOX_CACHE_DIR = path.join(LOCAL_TTS_DIR, "model-cache");
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
const generatedAudioCache = new Map<string, { audio: Buffer; mimeType: string; createdAt: number }>();

function storeGeneratedAudio(audioBase64: string, mimeType: string) {
  const now = Date.now();
  for (const [id, entry] of generatedAudioCache) {
    if (now - entry.createdAt > 60 * 60 * 1000) generatedAudioCache.delete(id);
  }
  while (generatedAudioCache.size >= 24) {
    const oldestId = generatedAudioCache.keys().next().value;
    if (!oldestId) break;
    generatedAudioCache.delete(oldestId);
  }

  const id = randomUUID();
  generatedAudioCache.set(id, {
    audio: Buffer.from(audioBase64, "base64"),
    mimeType,
    createdAt: now,
  });
  return `/api/generated-audio/${id}`;
}

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
    chatterboxAvailable: fileExists(CHATTERBOX_PYTHON) && fileExists(CHATTERBOX_SCRIPT) && fileExists(CHATTERBOX_PACKAGE_DIR),
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

function cleanResearchText(value: unknown, fallback = "") {
  return stripHtml(String(value || fallback))
    .replace(/\s+/g, " ")
    .trim();
}

const RESEARCH_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "can",
  "create",
  "cover",
  "episode",
  "for",
  "from",
  "have",
  "into",
  "make",
  "podcast",
  "show",
  "talk",
  "that",
  "the",
  "this",
  "through",
  "with",
  "what",
  "when",
  "where",
  "which",
  "why",
]);

async function fetchJsonWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ECHO Studios research podcast maker (local app)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs = 5500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ECHO Studios research podcast maker (local app)",
        Accept: "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function getResearchTerms(topic: string) {
  const seen = new Set<string>();
  return topic
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .map((term) => term.replace(/^['-]+|['-]+$/g, ""))
    .filter((term) => term.length > 2 && !RESEARCH_STOPWORDS.has(term))
    .filter((term) => {
      if (seen.has(term)) return false;
      seen.add(term);
      return true;
    })
    .slice(0, 10);
}

function getResearchQuery(topic: string) {
  const terms = getResearchTerms(topic);
  return shortText(terms.join(" ") || topic.replace(/\s+/g, " ").trim() || topic, 120);
}

function getResearchTermVariants(term: string) {
  const variants = [term];
  if (term.endsWith("ies") && term.length > 5) variants.push(`${term.slice(0, -3)}y`);
  if (term.endsWith("s") && term.length > 4) variants.push(term.slice(0, -1));
  return variants;
}

function hasInformativeResearchSummary(source: ResearchSource) {
  const summary = source.summary.trim();
  return Boolean(
    summary.length > 90 &&
      !summary.startsWith("Scholarly metadata result for") &&
      !summary.startsWith("OpenAlex indexes this as a relevant scholarly work"),
  );
}

function sourceEvidenceBonus(source: ResearchSource) {
  if (hasInformativeResearchSummary(source)) return 3;
  if (source.kind === "encyclopedia") return 1;
  return 0;
}

function scoreResearchSource(source: ResearchSource, terms: string[]) {
  const title = `${source.title}`.toLowerCase();
  const body = `${source.title} ${source.summary} ${source.source}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    const variants = getResearchTermVariants(term);
    if (variants.some((variant) => title.includes(variant))) {
      score += 2;
    } else if (variants.some((variant) => body.includes(variant))) {
      score += 1;
    }
  }

  const compactTopic = terms.join(" ");
  if (compactTopic.length > 10 && body.includes(compactTopic)) {
    score += 4;
  }

  return score + sourceEvidenceBonus(source);
}

function kindPriority(kind: ResearchSource["kind"]) {
  if (kind === "paper") return 3;
  if (kind === "scholarly-index") return 2;
  if (kind === "encyclopedia") return 1;
  return 0;
}

function rankResearchSources(sources: ResearchSource[], terms: string[]) {
  const ranked = sources
    .map((source) => ({ source, score: scoreResearchSource(source, terms) }))
    .sort((a, b) => b.score - a.score || kindPriority(b.source.kind) - kindPriority(a.source.kind));

  const bestScore = ranked[0]?.score || 0;
  const minimumScore = bestScore >= 4 ? 2 : bestScore > 0 ? 1 : 0;
  return ranked
    .filter(({ score }) => bestScore === 0 || score >= minimumScore)
    .map(({ source }) => source);
}

async function fetchWikipediaResearch(query: string): Promise<ResearchSource[]> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=2&namespace=0&format=json&origin=*`;
  const searchPayload = await fetchJsonWithTimeout(searchUrl);
  const titles = Array.isArray(searchPayload?.[1]) ? searchPayload[1].slice(0, 2) : [];
  const sources: ResearchSource[] = [];

  for (const title of titles) {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(title))}`;
    const summaryPayload = await fetchJsonWithTimeout(summaryUrl);
    const pageTitle = cleanResearchText(summaryPayload?.title, String(title));
    const summary = cleanResearchText(summaryPayload?.extract, "");
    const url = cleanResearchText(summaryPayload?.content_urls?.desktop?.page, `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/\s+/g, "_"))}`);
    if (pageTitle && summary && !summaryPayload?.disambiguation) {
      sources.push({
        title: pageTitle,
        source: "Wikipedia",
        url,
        summary: shortText(summary, 420),
        kind: "encyclopedia",
      });
    }
  }

  return sources;
}

function getCrossrefPublishedYear(item: any) {
  const parts =
    item?.["published-print"]?.["date-parts"]?.[0] ||
    item?.["published-online"]?.["date-parts"]?.[0] ||
    item?.issued?.["date-parts"]?.[0] ||
    [];
  return parts[0] ? String(parts[0]) : undefined;
}

async function fetchCrossrefResearch(query: string): Promise<ResearchSource[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=3&select=title,DOI,URL,abstract,published-print,published-online,issued,container-title,author`;
  const payload = await fetchJsonWithTimeout(url, 5500);
  const items = Array.isArray(payload?.message?.items) ? payload.message.items : [];

  return items
    .map((item: any) => {
      const title = cleanResearchText(Array.isArray(item.title) ? item.title[0] : item.title, "");
      const journal = cleanResearchText(Array.isArray(item["container-title"]) ? item["container-title"][0] : item["container-title"], "Crossref indexed work");
      const abstract = cleanResearchText(item.abstract, "");
      const doi = cleanResearchText(item.DOI, "");
      const itemUrl = cleanResearchText(item.URL, doi ? `https://doi.org/${doi}` : "");
      const published = getCrossrefPublishedYear(item);
      if (!title || !itemUrl) return null;
      return {
        title,
        source: published ? `${journal}, ${published}` : journal,
        url: itemUrl,
        published,
        summary: abstract ? shortText(abstract, 360) : `Scholarly metadata result for ${title}.`,
        kind: "scholarly-index" as const,
      };
    })
    .filter(Boolean) as ResearchSource[];
}

function getOpenAlexAbstract(abstractIndex: unknown) {
  if (!abstractIndex || typeof abstractIndex !== "object") return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(abstractIndex as Record<string, unknown>)) {
    if (!Array.isArray(positions)) continue;
    positions.forEach((position) => {
      const index = Number(position);
      if (Number.isInteger(index) && index >= 0) {
        words[index] = word;
      }
    });
  }
  return cleanResearchText(words.filter(Boolean).join(" "), "");
}

async function fetchOpenAlexResearch(query: string): Promise<ResearchSource[]> {
  const params = new URLSearchParams({
    search: query,
    "per-page": "4",
  });
  const openAlexEmail = cleanText(process.env.OPENALEX_EMAIL, "");
  const openAlexKey = cleanText(process.env.OPENALEX_API_KEY, "");
  if (openAlexEmail) params.set("mailto", openAlexEmail);
  if (openAlexKey) params.set("api_key", openAlexKey);

  const payload = await fetchJsonWithTimeout(`https://api.openalex.org/works?${params.toString()}`, 6500);
  const items = Array.isArray(payload?.results) ? payload.results : [];

  return items
    .map((item: any) => {
      const title = cleanResearchText(item?.display_name, "");
      const abstract = getOpenAlexAbstract(item?.abstract_inverted_index);
      const year = item?.publication_year ? String(item.publication_year) : undefined;
      const sourceName = cleanResearchText(item?.primary_location?.source?.display_name, "OpenAlex indexed work");
      const doi = cleanResearchText(item?.doi, "");
      const itemUrl = cleanResearchText(item?.primary_location?.landing_page_url || doi || item?.id, "");
      if (!title || !itemUrl) return null;
      return {
        title,
        source: year ? `${sourceName}, ${year}` : sourceName,
        url: itemUrl,
        published: year,
        summary: abstract
          ? shortText(abstract, 460)
          : `OpenAlex indexes this as a relevant scholarly work: ${title}. Use the title and venue as a lead, then verify the full paper before treating it as a finding.`,
        kind: abstract ? "paper" as const : "scholarly-index" as const,
      };
    })
    .filter(Boolean) as ResearchSource[];
}

async function fetchArxivResearch(query: string): Promise<ResearchSource[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3&sortBy=relevance&sortOrder=descending`;
  const xml = await fetchTextWithTimeout(url, 6500);
  if (!xml) return [];

  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entries
    .map((entry) => {
      const title = cleanResearchText(getXmlTagValue(entry, "title"), "");
      const summary = cleanResearchText(getXmlTagValue(entry, "summary"), "");
      const published = cleanResearchText(getXmlTagValue(entry, "published"), "").slice(0, 10);
      const entryUrl = cleanResearchText(getXmlTagValue(entry, "id"), "");
      if (!title || !summary || !entryUrl) return null;
      return {
        title,
        source: published ? `arXiv, ${published}` : "arXiv",
        url: entryUrl,
        published,
        summary: shortText(summary, 420),
        kind: "paper" as const,
      };
    })
    .filter(Boolean) as ResearchSource[];
}

async function fetchTopicResearch(topic: string): Promise<ResearchSource[]> {
  const terms = getResearchTerms(topic);
  const query = getResearchQuery(topic);
  const results = await Promise.allSettled([
    fetchWikipediaResearch(query),
    fetchCrossrefResearch(query),
    fetchOpenAlexResearch(query),
    fetchArxivResearch(query),
  ]);
  const [wikipedia, crossref, openAlex, arxiv] = results.map((result) => (result.status === "fulfilled" ? result.value : []));
  const seen = new Set<string>();
  const dedupedSources = [...openAlex, ...arxiv, ...crossref, ...wikipedia]
    .filter((source) => {
      const key = `${source.title}|${source.url}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((source) => scoreResearchSource(source, terms) > 0 || terms.length === 0)
    .sort((a, b) => scoreResearchSource(b, terms) - scoreResearchSource(a, terms) || kindPriority(b.kind) - kindPriority(a.kind))
    .slice(0, 12);
  return rankResearchSources(dedupedSources, terms).slice(0, 7);
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

function fitScriptToTargetDuration(script: Array<{ durationSeconds: number; estimatedStartSeconds: number }>, targetSeconds: number) {
  if (script.length === 0) return 0;
  const rawTotal = script.reduce((sum, line) => sum + Math.max(1, Number(line.durationSeconds) || 1), 0);
  const scale = rawTotal > 0 ? targetSeconds / rawTotal : 1;
  let cursor = 0;

  for (const line of script) {
    line.estimatedStartSeconds = cursor;
    line.durationSeconds = Math.max(3, Math.round(line.durationSeconds * scale));
    cursor += line.durationSeconds;
  }

  let delta = targetSeconds - cursor;
  for (let index = script.length - 1; index >= 0 && delta !== 0; index -= 1) {
    const line = script[index];
    if (delta > 0) {
      line.durationSeconds += delta;
      delta = 0;
    } else {
      const reduction = Math.min(-delta, Math.max(0, line.durationSeconds - 3));
      line.durationSeconds -= reduction;
      delta += reduction;
    }
  }

  while (delta < 0 && script.length > 1) {
    const removed = script.pop();
    delta += removed?.durationSeconds || 0;
  }
  if (delta > 0 && script.length > 0) {
    script[script.length - 1].durationSeconds += delta;
  }

  cursor = 0;
  for (const line of script) {
    line.estimatedStartSeconds = cursor;
    cursor += line.durationSeconds;
  }
  return cursor;
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
  return buildAudioPreviewSegments(req).map((segment) => segment.text).join("\n\n");
}

function buildAudioPreviewSegments(req: AudioRequest): AudioSegment[] {
  const script = Array.isArray(req.script) ? req.script : [];
  const maxSeconds = Math.max(30, Math.min(Number(req.maxSeconds) || 240, MAX_CUSTOM_DURATION_SECONDS));
  let cursor = 0;
  const segments: AudioSegment[] = [];

  for (const line of script) {
    const dialogue = cleanText(line.dialogue, "");
    if (!dialogue) continue;
    const durationSeconds = Math.max(1, Number(line.durationSeconds) || estimateSeconds(dialogue));
    if (cursor + durationSeconds > maxSeconds && segments.length > 0) break;
    segments.push({
      speakerName: cleanText(line.speakerName, "Host"),
      text: normalizeAudioText(dialogue),
      durationSeconds,
    });
    cursor += durationSeconds;
  }

  return segments;
}

type PiperVoice = (typeof PIPER_VOICES)[number];

async function runPiperToFile(text: string, selectedVoice: PiperVoice, outFile: string) {
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
}

type WavFormat = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
};

function readWavData(buffer: Buffer): { format: WavFormat; data: Buffer } {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Piper returned an unsupported audio file.");
  }

  let offset = 12;
  let format: WavFormat | null = null;
  let data: Buffer | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = Math.min(chunkStart + chunkSize, buffer.length);

    if (chunkId === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        byteRate: buffer.readUInt32LE(chunkStart + 8),
        blockAlign: buffer.readUInt16LE(chunkStart + 12),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkId === "data") {
      data = buffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!format || !data) {
    throw new Error("Piper returned a WAV file without usable audio data.");
  }
  if (format.audioFormat !== 1) {
    throw new Error("Piper returned a compressed WAV format that cannot be stitched locally.");
  }

  return { format, data };
}

function sameWavFormat(a: WavFormat, b: WavFormat) {
  return a.audioFormat === b.audioFormat &&
    a.channels === b.channels &&
    a.sampleRate === b.sampleRate &&
    a.byteRate === b.byteRate &&
    a.blockAlign === b.blockAlign &&
    a.bitsPerSample === b.bitsPerSample;
}

function makeSilence(format: WavFormat, milliseconds: number) {
  const frameCount = Math.round((format.sampleRate * milliseconds) / 1000);
  return Buffer.alloc(frameCount * format.blockAlign);
}

function buildWav(format: WavFormat, data: Buffer) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(format.audioFormat, 20);
  header.writeUInt16LE(format.channels, 22);
  header.writeUInt32LE(format.sampleRate, 24);
  header.writeUInt32LE(format.byteRate, 28);
  header.writeUInt16LE(format.blockAlign, 32);
  header.writeUInt16LE(format.bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function getSpeakerIndex(speakerName: string, speakers: RequestedSpeaker[] | undefined) {
  if (!Array.isArray(speakers)) return -1;
  return speakers.findIndex((speaker) => cleanText(speaker.name, "") === speakerName);
}

function choosePiperVoiceForSpeaker(
  speakerName: string,
  speakers: RequestedSpeaker[] | undefined,
  voices: PiperVoice[],
  requestedVoiceId?: string,
) {
  const selectedVoice = voices.find((voice) => voice.id === requestedVoiceId);
  if (voices.length <= 1) return selectedVoice || voices[0];

  const speakerIndex = Math.max(0, getSpeakerIndex(speakerName, speakers));
  const speaker = Array.isArray(speakers) ? speakers[speakerIndex] : undefined;
  const style = `${speaker?.gender || ""} ${speaker?.style || ""} ${speakerName}`.toLowerCase();

  if (selectedVoice && speakerIndex === 0) return selectedVoice;
  if (style.includes("male")) return voices.find((voice) => voice.id === "ryan") || voices[speakerIndex % voices.length];
  if (style.includes("female")) return voices.find((voice) => voice.id === "amy") || voices.find((voice) => voice.id === "lessac") || voices[speakerIndex % voices.length];
  if (style.includes("skeptical")) return voices.find((voice) => voice.id === "ryan") || voices[speakerIndex % voices.length];
  if (style.includes("enthusiastic")) return voices.find((voice) => voice.id === "amy") || voices[speakerIndex % voices.length];
  return voices[(speakerIndex + hashString(speakerName)) % voices.length];
}

function compactPiperSegments(segments: AudioSegment[], maxSegments = 96) {
  if (segments.length <= maxSegments) return segments;
  const chunkSize = Math.ceil(segments.length / maxSegments);
  const compacted: AudioSegment[] = [];

  for (let index = 0; index < segments.length; index += chunkSize) {
    const chunk = segments.slice(index, index + chunkSize);
    compacted.push({
      speakerName: chunk[0]?.speakerName || "Host",
      text: chunk.map((segment) => segment.text).join("\n\n"),
      durationSeconds: chunk.reduce((sum, segment) => sum + segment.durationSeconds, 0),
    });
  }

  return compacted;
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

  await runPiperToFile(text, selectedVoice, outFile);

  const audio = await fsp.readFile(outFile);
  await fsp.unlink(outFile).catch(() => undefined);
  return {
    audio: audio.toString("base64"),
    voice: { id: selectedVoice.id, name: selectedVoice.name },
  };
}

async function synthesizeWithPiperCast(req: AudioRequest) {
  const status = getAudioEngineStatus();
  if (!status.piperAvailable) {
    throw new Error("Piper neural TTS is not installed. Run .\\install-piper.ps1, then restart the app.");
  }

  const voices = getAvailablePiperVoices();
  const segments = compactPiperSegments(buildAudioPreviewSegments(req));
  if (segments.length === 0) {
    throw new Error("No script text was provided for audio generation.");
  }
  if (voices.length < 2) {
    return synthesizeWithPiper(segments.map((segment) => segment.text).join("\n\n"), req.voiceId);
  }

  const outDir = path.join(process.cwd(), "tmp-audio");
  const batchId = randomUUID();
  const outputFiles: string[] = [];
  await fsp.mkdir(outDir, { recursive: true });

  try {
    let wavFormat: WavFormat | null = null;
    const audioParts: Buffer[] = [];

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const selectedVoice = choosePiperVoiceForSpeaker(segment.speakerName, req.speakers, voices, req.voiceId);
      const outFile = path.join(outDir, `${batchId}-${String(index).padStart(3, "0")}.wav`);
      outputFiles.push(outFile);
      await runPiperToFile(segment.text, selectedVoice, outFile);

      const wav = readWavData(await fsp.readFile(outFile));
      if (!wavFormat) {
        wavFormat = wav.format;
      } else if (!sameWavFormat(wavFormat, wav.format)) {
        throw new Error("Selected Piper voices use incompatible WAV formats.");
      }

      audioParts.push(wav.data);
      if (index < segments.length - 1) {
        audioParts.push(makeSilence(wavFormat, 140));
      }
    }

    if (!wavFormat) {
      throw new Error("Piper did not generate audio.");
    }

    const audio = buildWav(wavFormat, Buffer.concat(audioParts));
    const voiceNames = voices.map((voice) => voice.name.replace(/\s*English Medium$/i, "")).join(", ");
    return {
      audio: audio.toString("base64"),
      voice: { id: "piper-cast", name: `Piper Cast: ${voiceNames}` },
    };
  } finally {
    await Promise.all(outputFiles.map((file) => fsp.unlink(file).catch(() => undefined)));
  }
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

function compactChatterboxSegments(segments: AudioSegment[], maxCharacters = 1400, maxSegments = 18) {
  const compacted: AudioSegment[] = [];
  let usedCharacters = 0;

  for (const segment of segments) {
    if (usedCharacters >= maxCharacters || compacted.length >= maxSegments) break;
    const remainingCharacters = maxCharacters - usedCharacters;
    const text = segment.text.slice(0, remainingCharacters).trim();
    if (!text) continue;

    const previous = compacted[compacted.length - 1];
    if (previous?.speakerName === segment.speakerName && previous.text.length + text.length <= 360) {
      previous.text = `${previous.text} ${text}`;
      previous.durationSeconds += segment.durationSeconds;
    } else {
      compacted.push({ ...segment, text });
    }
    usedCharacters += text.length;
  }

  return compacted;
}

function findChatterboxReferenceForSpeaker(
  speakerName: string,
  speakers: RequestedSpeaker[] | undefined,
  references: VoiceReferenceRequest[],
) {
  if (references.length === 0) return undefined;
  const speakerIndex = Math.max(0, (speakers || []).findIndex((speaker) => cleanText(speaker.name, "") === speakerName));
  const speaker = (speakers || [])[speakerIndex];
  const referenceId = cleanText(speaker?.voiceReferenceId, "");
  const referenceName = cleanText(speaker?.voiceReferenceName, "").toLowerCase();

  const assignedReference = references.find((reference) => {
    const ids = [cleanText(reference.id, ""), cleanText(reference.clonedVoiceId, "")].filter(Boolean);
    const names = [cleanText(reference.name, ""), cleanText(reference.clonedVoiceName, "")]
      .filter(Boolean)
      .map((name) => name.toLowerCase());
    return (referenceId && ids.includes(referenceId)) || (referenceName && names.includes(referenceName));
  });

  if (assignedReference) return assignedReference;
  if (references.length === 1) return references[0];
  return references[speakerIndex % references.length];
}

async function synthesizeWithChatterbox(req: AudioRequest) {
  if (!getAudioEngineStatus().chatterboxAvailable) {
    throw new Error("Chatterbox HD is not installed. Run .\\install-chatterbox.ps1, restart the app, then generate HD audio.");
  }

  const segments = compactChatterboxSegments(buildAudioPreviewSegments(req));
  if (segments.length === 0) throw new Error("No script text was provided for Chatterbox generation.");

  const references = Array.isArray(req.voiceReferences)
    ? req.voiceReferences.filter((item) => item.consentConfirmed && cleanText(item.dataUrl, ""))
    : [];
  const outDir = path.join(process.cwd(), "tmp-audio");
  await Promise.all([
    fsp.mkdir(outDir, { recursive: true }),
    fsp.mkdir(CHATTERBOX_CACHE_DIR, { recursive: true }),
    fsp.mkdir(path.join(LOCAL_TTS_DIR, "temp"), { recursive: true }),
  ]);
  const id = randomUUID();
  const manifestFile = path.join(outDir, `${id}-segments.json`);
  const outFile = path.join(outDir, `${id}.wav`);
  const referenceFiles = new Map<VoiceReferenceRequest, string>();

  for (const [index, reference] of references.entries()) {
    const decoded = decodeReferenceAudio(reference);
    const referenceFile = path.join(outDir, `${id}-reference-${index}${extensionFromMimeType(decoded.mimeType)}`);
    await fsp.writeFile(referenceFile, decoded.buffer);
    referenceFiles.set(reference, referenceFile);
  }

  const manifest = {
    segments: segments.map((segment) => {
      const reference = findChatterboxReferenceForSpeaker(segment.speakerName, req.speakers, references);
      return {
        text: segment.text,
        voice: reference ? referenceFiles.get(reference) : undefined,
      };
    }),
  };
  await fsp.writeFile(manifestFile, JSON.stringify(manifest), "utf8");

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(CHATTERBOX_PYTHON, [CHATTERBOX_SCRIPT, "--segments-file", manifestFile, "--out", outFile], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          HF_HOME: CHATTERBOX_CACHE_DIR,
          HUGGINGFACE_HUB_CACHE: path.join(CHATTERBOX_CACHE_DIR, "hub"),
          TORCH_HOME: path.join(CHATTERBOX_CACHE_DIR, "torch"),
          TEMP: path.join(LOCAL_TTS_DIR, "temp"),
          TMP: path.join(LOCAL_TTS_DIR, "temp"),
        },
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
    const voiceNames = references
      .map((reference) => cleanText(reference.clonedVoiceName || reference.name, ""))
      .filter(Boolean);
    return {
      audio: audio.toString("base64"),
      voice: {
        id: voiceNames.length > 0 ? "chatterbox-cast" : "chatterbox-natural",
        name: voiceNames.length > 0 ? `Chatterbox Cast: ${voiceNames.join(", ")}` : "Chatterbox Natural Voice",
      },
    };
  } finally {
    await Promise.all([
      ...Array.from(referenceFiles.values()).map((referenceFile) => fsp.unlink(referenceFile).catch(() => undefined)),
      fsp.unlink(manifestFile).catch(() => undefined),
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

type EpisodeFormat = {
  id: "evidence-ladder" | "myth-check" | "source-debate" | "timeline" | "field-guide" | "case-file";
  title: string;
  chapterTitles: string[];
};

const EPISODE_FORMATS: EpisodeFormat[] = [
  {
    id: "evidence-ladder",
    title: "Evidence Ladder",
    chapterTitles: ["Cold Open", "Baseline Facts", "Finding One", "Finding Two", "Counterweight", "What Changes", "Final Claim"],
  },
  {
    id: "myth-check",
    title: "Myth Check",
    chapterTitles: ["The Claim", "What Sources Say", "What Gets Exaggerated", "What Holds Up", "Practical Read", "Verdict"],
  },
  {
    id: "source-debate",
    title: "Source Debate",
    chapterTitles: ["Opening Position", "Source A", "Source B", "The Disagreement", "Synthesis", "Listener Decision"],
  },
  {
    id: "timeline",
    title: "Timeline Investigation",
    chapterTitles: ["Where It Starts", "Early Evidence", "Recent Evidence", "Turning Point", "Current Read", "Next Question"],
  },
  {
    id: "field-guide",
    title: "Field Guide",
    chapterTitles: ["What To Notice", "Key Terms", "Evidence In The Wild", "Red Flags", "Useful Questions", "Takeaway"],
  },
  {
    id: "case-file",
    title: "Case File",
    chapterTitles: ["Exhibit A", "Exhibit B", "The Missing Piece", "Competing Theory", "What We Can Say", "Close"],
  },
];

function hashString(value: string) {
  return Array.from(value).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
}

function chooseEpisodeFormat(topic: string, sources: ResearchSource[], targetSeconds: number): EpisodeFormat {
  const key = `${topic}|${targetSeconds}|${sources.map((source) => source.title).join("|")}`;
  return EPISODE_FORMATS[hashString(key) % EPISODE_FORMATS.length];
}

function getSourceAt(sources: ResearchSource[], index: number) {
  if (sources.length === 0) return null;
  return sources[index % sources.length];
}

function sourceLabel(source: ResearchSource | null) {
  if (!source) return "the available research";
  return `${source.title} (${source.source})`;
}

function sourceFact(source: ResearchSource | null, max = 230) {
  if (!source) {
    return "live sources were not reachable, so this episode should treat claims as hypotheses and avoid pretending uncertainty is settled.";
  }
  return shortText(source.summary, max);
}

function getLineTemplate(
  index: number,
  topic: string,
  imageContext: string,
  musicMood: string,
  _duration: string,
  researchSources: ResearchSource[],
  episodeFormat: EpisodeFormat,
) {
  const topicShort = shortText(topic, 132);
  const source = getSourceAt(researchSources, index);
  const nextSource = getSourceAt(researchSources, index + 1);
  const contrastSource = getSourceAt(researchSources, index + 2);
  const sourceName = sourceLabel(source);
  const nextName = sourceLabel(nextSource);
  const contrastName = sourceLabel(contrastSource);
  const fact = sourceFact(source);
  const nextFact = sourceFact(nextSource);
  const contrastFact = sourceFact(contrastSource);
  const visualCue = imageContext ? ` The uploaded image cue adds this concrete production detail: ${shortText(imageContext, 150)}` : "";
  const section = Math.floor(index / 9) + 1;
  const beat = index % 9;
  const noSources = researchSources.length === 0;

  if (noSources) {
    const cautiousLines = [
      `Today we are treating "${topicShort}" as an open research question, because live source lookup did not return usable material.`,
      `That means the honest structure is different: separate what sounds plausible from what we can actually support.`,
      `The first pass is to name the claim clearly, then ask what evidence would be needed before repeating it as fact.`,
      `A careful episode should tell listeners where the confidence is low instead of filling the gap with certainty.`,
      `The useful move is to build a checklist: definitions, dates, named examples, opposing explanations, and what would falsify the story.`,
      `For production, keep ${musicMood} subtle and let the uncertainty become part of the episode rather than hiding it.`,
      visualCue || `The cover and show notes should flag this as an exploratory episode, not a settled report.`,
      `The takeaway is not a fake answer; it is a sharper question the listener can research next.`,
      `Before closing, restate the limits: this draft needs source review before publication.`,
    ];
    return cautiousLines[beat];
  }

  const formatLines: Record<EpisodeFormat["id"], string[]> = {
    "evidence-ladder": [
      `Open with the claim: ${topicShort}. Then ground it immediately in ${sourceName}, which says ${fact}`,
      `The next rung is ${nextName}. Its useful contribution is this: ${nextFact}`,
      `Now compare those two sources. If they agree, the episode can say the pattern is supported; if they differ, make that difference the story.`,
      `${contrastName} adds a third angle: ${contrastFact}`,
      `The practical question for listeners is what changes once those source claims are treated as evidence rather than vibes.`,
      `A skeptical read is still necessary: sources can describe a pattern without proving every causal claim people attach to it.`,
      visualCue || `For the sound bed, ${musicMood} should stay low so the evidence, not the music, carries the tension.`,
      `The cleanest midpoint summary is: ${sourceName} gives context, ${nextName} gives a second anchor, and the episode should not go beyond those anchors.`,
      `Close this section by asking what new source would most change the conclusion.`,
    ],
    "myth-check": [
      `Start with the popular version of ${topicShort}, then test it against ${sourceName}: ${fact}`,
      `Myth check number one: if the source only supports a narrower claim, say the narrower claim out loud.`,
      `${nextName} gives the second check: ${nextFact}`,
      `The part that often gets exaggerated is the jump from "there is evidence" to "the whole story is settled."`,
      `${contrastName} keeps us honest because it frames the issue this way: ${contrastFact}`,
      `The verdict so far is mixed: the topic is real enough to investigate, but each source limits what we can responsibly claim.`,
      visualCue || `The cover art should feel like a fact-check file, not a hype poster.`,
      `Translate that for listeners: believe the sourced part, pause on the unsourced leap, and keep the strongest counterexample in view.`,
      `End the pass with a plain verdict: supported, unsupported, or still open based on the sources we actually found.`,
    ],
    "source-debate": [
      `Frame the episode as a debate over ${topicShort}, with ${sourceName} making the first strong case: ${fact}`,
      `The opposing pressure comes from ${nextName}, which emphasizes: ${nextFact}`,
      `Do not force the sources to agree. Let the hosts argue over why the emphasis changes from one source to the next.`,
      `${contrastName} becomes the tie-breaker or complication: ${contrastFact}`,
      `One host should ask whether the disagreement is about facts, definitions, timelines, or incentives.`,
      `The other host should answer by pointing back to the exact source language rather than inventing a conclusion.`,
      visualCue || `Use ${musicMood} like a debate room tone: present, but never louder than the evidence.`,
      `The synthesis is not "both sides are equal"; it is identifying which claim has the strongest support and which claim still needs proof.`,
      `Close with the listener decision: what would you now accept, reject, or research further?`,
    ],
    timeline: [
      `Build this as a timeline. The first timestamp comes from ${sourceName}: ${fact}`,
      `${nextName} gives the next marker: ${nextFact}`,
      `The transition between those markers is the story; ask what changed in evidence, tools, culture, or incentives.`,
      `${contrastName} adds a later or alternate marker: ${contrastFact}`,
      `If the dates do not line up neatly, say that. Messy timelines are more honest than fake inevitability.`,
      `The current moment in ${topicShort} should be described as a snapshot, not the final chapter.`,
      visualCue || `Let ${musicMood} create movement between timeline beats without making it feel like a trailer.`,
      `The listener takeaway is a sequence: what came first, what changed, and what is still unresolved.`,
      `End this section by naming the next event or source that would update the timeline.`,
    ],
    "field-guide": [
      `Make this a field guide to ${topicShort}. The first thing to notice comes from ${sourceName}: ${fact}`,
      `The second thing to notice comes from ${nextName}: ${nextFact}`,
      `Give listeners a diagnostic question: when they see this topic in the wild, what detail should they check first?`,
      `${contrastName} adds a warning label: ${contrastFact}`,
      `Turn that into a red flag: if a claim ignores the source limits, it is probably overselling the conclusion.`,
      `Then give a green flag: claims that cite definitions, dates, examples, and uncertainty are easier to trust.`,
      visualCue || `The artwork should look like a practical guide, with one clear visual metaphor instead of generic tech fog.`,
      `The useful habit is to ask, "What source would prove this, and what source would disprove it?"`,
      `Close the field note with one action the listener can take before sharing the claim.`,
    ],
    "case-file": [
      `Open the case file on ${topicShort}. Exhibit ${section}A is ${sourceName}: ${fact}`,
      `Exhibit ${section}B is ${nextName}: ${nextFact}`,
      `The missing piece is the bridge between those exhibits. What do they imply, and what do they not prove?`,
      `${contrastName} adds the complication: ${contrastFact}`,
      `A good investigator does not flatten that complication. They ask whether it changes the theory of the case.`,
      `The working theory should be stated carefully, with the strongest source named and the weakest assumption exposed.`,
      visualCue || `For ${musicMood}, use a restrained investigative feel, not melodrama.`,
      `The case-file summary is: here is what the evidence supports, here is what remains circumstantial, and here is the next lead.`,
      `End by telling listeners what would close the case, or why it remains open.`,
    ],
  };

  return formatLines[episodeFormat.id][beat];
}

async function buildLocalPodcast(req: LocalPodcastRequest) {
  const topic = cleanText(req.topic, "A creator-led conversation about a new idea");
  const fallbackDuration = req.duration && req.duration in DURATION_TARGET_SECONDS ? req.duration : "hour";
  const requestedDurationSeconds = Math.round(Number(req.durationSeconds) || 0);
  const hasCustomDuration = requestedDurationSeconds >= MIN_CUSTOM_DURATION_SECONDS;
  const targetSeconds = hasCustomDuration
    ? clampNumber(requestedDurationSeconds, MIN_CUSTOM_DURATION_SECONDS, MAX_CUSTOM_DURATION_SECONDS)
    : DURATION_TARGET_SECONDS[fallbackDuration];
  const duration = getDurationMode(targetSeconds, fallbackDuration);
  const durationLabel = formatDurationLabel(targetSeconds);
  const musicMood = cleanText(req.musicMood, "Pure Speech");
  const language = cleanText(req.language, "English");
  const speakers = normalizeSpeakers(req.speakers, req.numSpeakers);
  const imageContext = getImageContext(req.promptImages);
  const voiceContext = getVoiceReferenceContext(req.voiceReferences);
  const researchSources = await fetchTopicResearch(topic);
  const episodeFormat = chooseEpisodeFormat(topic, researchSources, targetSeconds);
  const maxLines = Math.min(1400, Math.max(speakers.length * 3, Math.ceil(targetSeconds / 6) + speakers.length * 3));
  const script: Array<{
    id: string;
    speakerName: string;
    dialogue: string;
    soundEffect: string | null;
    durationSeconds: number;
    estimatedStartSeconds: number;
  }> = [];
  let cursor = 0;
  let index = 0;

  while ((cursor < targetSeconds || script.length < speakers.length * 3) && index < maxLines) {
    const speaker = speakers[index % speakers.length];
    const dialogue = getLineTemplate(index, topic, imageContext, musicMood, duration, researchSources, episodeFormat);
    const durationSeconds = estimateSeconds(dialogue);
    script.push({
      id: String(index + 1),
      speakerName: speaker.name,
      dialogue,
      soundEffect:
        index === 0
          ? "intro music fades under the host"
          : cursor + durationSeconds >= targetSeconds - 15
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
  cursor = fitScriptToTargetDuration(script, targetSeconds);

  const ratios = getChapterRatios(duration, targetSeconds);
  const titles = episodeFormat.chapterTitles;
  const sourceSummary = researchSources.length
    ? ` Research sources: ${researchSources.map((source) => source.title).join("; ")}.`
    : " Live research was unavailable, so claims are framed cautiously.";
  const structureSummary = ` Structure: ${episodeFormat.title}.`;

  return {
    title: titleFromPrompt(topic),
    tagline: `A ${durationLabel} ${episodeFormat.title.toLowerCase()} episode built from your prompt and live sources.`,
    description:
      language === "English"
        ? `A free, locally generated ECHO Studios script exploring ${shortText(topic, 150)}.${structureSummary}${sourceSummary}${voiceContext ? ` Voice reference: ${voiceContext}.` : ""}`
        : `A free, locally generated ECHO Studios script framed for ${language} production and exploring ${shortText(topic, 130)}.${structureSummary}${sourceSummary}${voiceContext ? ` Voice reference: ${voiceContext}.` : ""}`,
    episodeFormat: episodeFormat.title,
    musicMood,
    speakers,
    chapters: ratios.map((ratio, index) => ({
      title: titles[index % titles.length] || `Chapter ${index + 1}`,
      startSeconds: Math.round(targetSeconds * ratio),
    })),
    script,
    researchSources,
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
          ? "Local voice reference is ready. Choose Chatterbox HD to generate reference-guided audio."
          : "ElevenLabs cloned voice is ready for Studio Quality audio.",
      });
    } catch (e: any) {
      res.status(ELEVENLABS_API_KEY ? 502 : 501).json({
        error: e.message || "Unable to clone the voice.",
        elevenLabsAvailable: Boolean(ELEVENLABS_API_KEY),
      });
    }
  });

  app.post("/api/generate-podcast", async (req, res) => {
    try {
      res.json(await buildLocalPodcast(req.body || {}));
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

  app.get("/api/generated-audio/:id", (req, res) => {
    const entry = generatedAudioCache.get(req.params.id);
    if (!entry) return res.status(404).json({ error: "Generated audio has expired." });

    const totalBytes = entry.audio.length;
    const rangeHeader = req.headers.range;
    res.setHeader("Content-Type", entry.mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      const start = match?.[1] ? Number(match[1]) : 0;
      const requestedEnd = match?.[2] ? Number(match[2]) : totalBytes - 1;
      const end = Math.min(totalBytes - 1, requestedEnd);
      if (!Number.isFinite(start) || start < 0 || start > end || start >= totalBytes) {
        res.status(416).setHeader("Content-Range", `bytes */${totalBytes}`);
        return res.end();
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalBytes}`);
      res.setHeader("Content-Length", end - start + 1);
      return res.send(entry.audio.subarray(start, end + 1));
    }

    res.setHeader("Content-Length", totalBytes);
    return res.send(entry.audio);
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
          ? await synthesizeWithChatterbox(req.body || {})
          : await synthesizeWithPiperCast(req.body || {});
      const mimeType = provider === "elevenlabs" ? "audio/mpeg" : "audio/wav";
      const audioUrl = storeGeneratedAudio(result.audio, mimeType);
      res.json({
        mode: provider,
        mimeType,
        voice: result.voice,
        audioUrl,
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
