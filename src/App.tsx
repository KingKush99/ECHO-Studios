/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, PlayCircle, PlusCircle, Search, Share, UserCircle } from "lucide-react";

import { type AudioEngineStatus, type AudioProvider, type PodcastMetadata } from "./types";
import { getKokoroVoices, getSpeechLocale } from "./voice-options";
import { CreateView } from "./components/CreateView";
import { ListenFeedView, type LivePodcast } from "./components/ListenFeedView";
import { PublishView } from "./components/PublishView";
import { ProfileView } from "./components/RealProfileView";
import { PodcastPlayer } from "./components/PodcastPlayer";
import { PlaybackBar } from "./components/PlaybackBar";
import { SearchView } from "./components/SearchView";
import { DmChat } from "./components/DmChat";
import { AiOracleChat } from "./components/AiOracleChat";
import { SettingsModal } from "./components/SettingsModal";
import { loadStudioSettings, STUDIO_SETTINGS_KEY, type StudioSettings } from "./studio-settings";
import echoLogoUrl from "./assets/images/echo_studios_favicon_1782358750086.jpg";

type ActiveTab = "create" | "listen" | "publish" | "profile" | "search";
type SpeechStatus = "idle" | "playing" | "paused";
type LocalAudioProvider = Exclude<AudioProvider, "elevenlabs" | "browser">;
type PlaybackChunk = {
  startTime: number;
  endTime: number;
  nextLineIndex: number;
  provider: LocalAudioProvider;
};
type PreparedChunk = { url: string; chunk: PlaybackChunk };
type QueuedChunk = { start: number; provider: LocalAudioProvider; controller: AbortController; result: Promise<PreparedChunk | null>; url?: string };
const PODCAST_LIBRARY_STORAGE_KEY = "echo.podcastLibrary.v1";

function preferredAudioProvider(engine: AudioEngineStatus | null, episode: PodcastMetadata | null): AudioProvider {
  if (!getKokoroVoices(episode?.language).length) return "browser";
  if (engine?.chatterboxAvailable && episode?.voiceReferences?.some((voice) => voice.consentConfirmed && voice.dataUrl)) return "chatterbox";
  if (engine?.kokoroAvailable) return "kokoro";
  if (engine?.chatterboxAvailable) return "chatterbox";
  if (engine?.piperAvailable) return "piper";
  return "browser";
}

function getPodcastDuration(data: PodcastMetadata | null) {
  if (!data || data.script.length === 0) return 0;
  return data.script.reduce((max, line) => Math.max(max, line.estimatedStartSeconds + line.durationSeconds), 0);
}

function getPodcastLibraryKey(data: PodcastMetadata) {
  return `${data.title}|${data.musicMood}|${data.script.length}|${data.sourcePrompt || ""}`;
}

function loadStoredPodcastLibrary() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PODCAST_LIBRARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as PodcastMetadata[] : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("create");
  const [podcastData, setPodcastData] = useState<PodcastMetadata | null>(null);
  const [podcastLibrary, setPodcastLibrary] = useState<PodcastMetadata[]>(loadStoredPodcastLibrary);
  const [isDmOpen, setIsDmOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(loadStudioSettings);
  const [hasOpenedLive, setHasOpenedLive] = useState(false);
  const [hasOpenedPublish, setHasOpenedPublish] = useState(false);
  const [isPodcastPlayerOpen, setIsPodcastPlayerOpen] = useState(false);
  const [isPlaybackBarOpen, setIsPlaybackBarOpen] = useState(false);
  const [liveEpisode, setLiveEpisode] = useState<LivePodcast | null>(null);
  const [liveSection, setLiveSection] = useState<"listen" | "search">("listen");
  const [liveTime, setLiveTime] = useState(0);
  const [liveDuration, setLiveDuration] = useState(0);
  const [livePlaying, setLivePlaying] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playbackRate, setPlaybackRate] = useState(settings.defaultSpeed);
  const [audioEngine, setAudioEngine] = useState<AudioEngineStatus | null>(null);
  const [audioProvider, setAudioProvider] = useState<AudioProvider>("browser");
  const [hostVoices, setHostVoices] = useState<Record<string, string>>({});
  const [selectedNeuralVoice, setSelectedNeuralVoice] = useState("");
  const [selectedElevenVoice, setSelectedElevenVoice] = useState("");
  const [neuralAudioUrl, setNeuralAudioUrl] = useState<string | null>(null);
  const [isGeneratingNeuralAudio, setIsGeneratingNeuralAudio] = useState(false);
  const [neuralAudioError, setNeuralAudioError] = useState<string | null>(null);

  const podcastDataRef = useRef<PodcastMetadata | null>(null);
  const neuralAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRequestRef = useRef<AbortController | null>(null);
  const nextChunkRef = useRef<QueuedChunk | null>(null);
  const autoPlayNeuralAudioRef = useRef(false);
  const chunkSeekTimeRef = useRef<number | null>(null);
  const isGeneratingNeuralAudioRef = useRef(false);
  const playbackChunkRef = useRef<PlaybackChunk | null>(null);
  const continueChunkPlaybackRef = useRef(false);
  const playbackRateRef = useRef(settings.defaultSpeed);
  const speechStatusRef = useRef<SpeechStatus>("idle");
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const currentLineIndexRef = useRef(0);
  const playbackSessionRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);
  const lineDelayTimerRef = useRef<number | null>(null);
  const pendingLineIndexRef = useRef<number | null>(null);

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    podcastDataRef.current = podcastData;
    const nextDuration = getPodcastDuration(podcastData);
    durationRef.current = nextDuration;
    setDuration(nextDuration);
  }, [podcastData]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PODCAST_LIBRARY_STORAGE_KEY, JSON.stringify(podcastLibrary.slice(0, 24)));
    } catch {
      // Local storage can fail in private windows or when generated cover art is too large.
    }
  }, [podcastLibrary]);

  useEffect(() => {
    if (!speechSupported) return;

    const loadVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [speechSupported]);

  useEffect(() => {
    fetch("/api/audio-engine")
      .then((response) => response.json())
      .then((data) => {
        setAudioEngine(data);
        if (data.voices?.[0]?.id) setSelectedNeuralVoice(data.voices[0].id);
        if (data.elevenLabsVoices?.[0]?.id) setSelectedElevenVoice(data.elevenLabsVoices[0].id);
        else if (data.elevenLabsDefaultVoiceId) setSelectedElevenVoice(data.elevenLabsDefaultVoiceId);
        setAudioProvider(preferredAudioProvider(data, podcastDataRef.current));
      })
      .catch(() => {
        setAudioEngine({
          kokoroAvailable: false,
          piperAvailable: false,
          chatterboxAvailable: false,
          elevenLabsAvailable: false,
          elevenLabsModelId: "eleven_multilingual_v2",
          elevenLabsDefaultVoiceId: "",
          voices: [],
          elevenLabsVoices: [],
        });
        setAudioProvider("browser");
      });
  }, []);

  useEffect(() => {
    return () => {
      cancelSpeech(false);
    };
  }, []);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    for (const audio of [neuralAudioRef.current, liveAudioRef.current]) {
      if (audio) { audio.playbackRate = playbackRate; audio.volume = settings.volume / 100; }
    }
  }, [playbackRate, settings.volume, neuralAudioUrl, liveEpisode]);

  useEffect(() => {
    if (!neuralAudioUrl || !autoPlayNeuralAudioRef.current) return;

    const audio = neuralAudioRef.current;
    if (!audio) return;

    const playAudio = () => {
      autoPlayNeuralAudioRef.current = false;
      if (!continueChunkPlaybackRef.current && playbackChunkRef.current) return;
      void audio.play().catch(() => {
        setPlaybackStatus("paused");
        setSpeechError("HD audio is ready. Press Play to start it.");
      });
    };

    if (audio.readyState >= 2) {
      playAudio();
      return;
    }

    audio.addEventListener("canplay", playAudio, { once: true });
    return () => audio.removeEventListener("canplay", playAudio);
  }, [neuralAudioUrl]);

  function getLineIndexAtTime(data: PodcastMetadata | null, seconds: number) {
    if (!data || data.script.length === 0) return 0;
    return data.script.reduce((selectedIndex, line, index) => (line.estimatedStartSeconds <= seconds ? index : selectedIndex), 0);
  }

  function setPlaybackTime(value: number) {
    const clamped = Math.max(0, Math.min(value, durationRef.current || value));
    const nextLineIndex = getLineIndexAtTime(podcastDataRef.current, clamped);
    if (nextLineIndex !== currentLineIndexRef.current) {
      setActiveLine(nextLineIndex);
    }
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
  }

  function setPlaybackStatus(value: SpeechStatus) {
    speechStatusRef.current = value;
    setSpeechStatus(value);
  }

  function setActiveLine(index: number) {
    currentLineIndexRef.current = index;
    setCurrentLineIndex(index);
  }

  function stopProgressTimer() {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function revokeNeuralAudio() {
    discardQueuedChunk();
    audioRequestRef.current?.abort();
    audioRequestRef.current = null;
    isGeneratingNeuralAudioRef.current = false;
    setIsGeneratingNeuralAudio(false);
    autoPlayNeuralAudioRef.current = false;
    chunkSeekTimeRef.current = null;
    if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
    setNeuralAudioUrl(null);
    setNeuralAudioError(null);
    playbackChunkRef.current = null;
    continueChunkPlaybackRef.current = false;
  }

  function clearLineDelay() {
    if (lineDelayTimerRef.current !== null) {
      window.clearTimeout(lineDelayTimerRef.current);
      lineDelayTimerRef.current = null;
    }
  }

  function startProgressTimer(baseSeconds: number) {
    stopProgressTimer();
    const startedAt = Date.now();
    const startTime = Math.max(0, baseSeconds);
    setPlaybackTime(startTime);

    progressTimerRef.current = window.setInterval(() => {
      const elapsed = ((Date.now() - startedAt) / 1000) * playbackRateRef.current;
      setPlaybackTime(Math.min(durationRef.current, startTime + elapsed));
    }, 250);
  }

  function getHash(value: string) {
    return Array.from(value).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  }

  function scoreVoice(voice: SpeechSynthesisVoice) {
    const name = `${voice.name} ${voice.voiceURI} ${voice.lang}`.toLowerCase();
    let score = 0;
    if (/(natural|neural|online|premium)/.test(name)) score += 70;
    if (/(microsoft|google|apple)/.test(name)) score += 30;
    if (/(jenny|aria|guy|sonia|ryan|libby|samantha|daniel|zira|david)/.test(name)) score += 20;
    if (/(desktop|compact|robot|espeak)/.test(name)) score -= 35;
    if (voice.default) score += 5;
    return score;
  }

  function chooseVoice(speakerName: string) {
    if (!speechSupported) return null;
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    const data = podcastDataRef.current;
    const speaker = data?.speakers.find((item) => item.name === speakerName);
    const speakerIndex = Math.max(0, data?.speakers.findIndex((item) => item.name === speakerName) ?? 0);
    const language = getSpeechLocale(data?.language).split("-")[0];
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
    const usableVoices = matchingVoices.length > 0 ? matchingVoices : voices;
    const speakerStyle = `${speaker?.gender || ""} ${speaker?.style || ""}`.toLowerCase();
    const rankedVoices = [...usableVoices].sort((a, b) => {
      const aName = `${a.name} ${a.voiceURI}`.toLowerCase();
      const bName = `${b.name} ${b.voiceURI}`.toLowerCase();
      const voiceFit = (name: string) => {
        let fit = 0;
        if (speakerStyle.includes("female") && /(jenny|aria|samantha|sonia|libby|zira|amy|female)/.test(name)) fit += 24;
        if (speaker?.gender === "male" && /(guy|ryan|david|daniel|mark|\bmale\b)/.test(name)) fit += 24;
        if (speakerStyle.includes("skeptical") && /(david|guy|mark|ryan)/.test(name)) fit += 12;
        if (speakerStyle.includes("enthusiastic") && /(jenny|aria|amy|samantha)/.test(name)) fit += 12;
        if (speakerStyle.includes("intellectual") && /(daniel|david|ryan|guy)/.test(name)) fit += 10;
        return fit;
      };
      return scoreVoice(b) + voiceFit(bName) - (scoreVoice(a) + voiceFit(aName));
    });

    const topVoices = rankedVoices.slice(0, Math.min(Math.max(4, data?.speakers.length || 2), rankedVoices.length));
    return topVoices[(speakerIndex + getHash(speakerName)) % topVoices.length];
  }

  function getSpeechSettings(speakerName: string, lineIndex: number) {
    const speaker = podcastDataRef.current?.speakers.find((item) => item.name === speakerName);
    const hash = getHash(`${speakerName}-${lineIndex}`);
    const rateVariation = ((hash % 9) - 4) * 0.026;
    const pitchVariation = ((hash % 11) - 5) * 0.075;
    const style = speaker?.style.toLowerCase() || "";

    const baseRate = style.includes("calm") || style.includes("philosophical") ? 0.82 : style.includes("enthusiastic") ? 1.04 : style.includes("skeptical") ? 0.88 : 0.94;
    const basePitch = speaker?.gender === "male" ? 0.74 : speaker?.gender === "female" ? 1.2 : style.includes("philosophical") ? 0.9 : 1;

    return {
      rate: Math.min(1.8, Math.max(0.5, (baseRate + rateVariation) * playbackRateRef.current)),
      pitch: Math.min(1.45, Math.max(0.55, basePitch + pitchVariation)),
    };
  }

  function prepareDialogueForSpeech(dialogue: string) {
    return dialogue
      .replace(/\bECHO\b/g, "Echo")
      .replace(/\s+-\s+/g, ", ")
      .replace(/\.\.\./g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTransitionDelay(index: number) {
    const data = podcastDataRef.current;
    const line = data?.script[index];
    const nextLine = data?.script[index + 1];
    if (!line || !nextLine) return 0;

    const speakerChange = line.speakerName !== nextLine.speakerName;
    const questionPause = line.dialogue.trim().endsWith("?") ? 260 : 0;
    const reflectivePause = line.soundEffect ? 360 : 0;
    return (speakerChange ? 380 : 180) + questionPause + reflectivePause + (getHash(line.id) % 180);
  }

  function speakLine(index: number, sessionId: number) {
    const data = podcastDataRef.current;
    if (!data || !speechSupported) return;

    if (index >= data.script.length) {
      stopProgressTimer();
      setPlaybackTime(durationRef.current);
      setPlaybackStatus("idle");
      return;
    }

    const line = data.script[index];
    const utterance = new SpeechSynthesisUtterance(prepareDialogueForSpeech(line.dialogue));
    utterance.volume = settings.volume / 100;
    utterance.lang = getSpeechLocale(data.language);
    const voice = chooseVoice(line.speakerName);
    const speechSettings = getSpeechSettings(line.speakerName, index);

    if (voice) utterance.voice = voice;
    utterance.rate = speechSettings.rate;
    utterance.pitch = speechSettings.pitch;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (sessionId !== playbackSessionRef.current) return;
      setSpeechError(null);
      setActiveLine(index);
      setPlaybackStatus("playing");
      startProgressTimer(line.estimatedStartSeconds);
    };

    utterance.onend = () => {
      if (sessionId !== playbackSessionRef.current) return;
      stopProgressTimer();
      setPlaybackTime(line.estimatedStartSeconds + line.durationSeconds);
      const nextIndex = index + 1;

      if (nextIndex >= data.script.length) {
        setPlaybackStatus("idle");
        pendingLineIndexRef.current = null;
        return;
      }

      pendingLineIndexRef.current = nextIndex;
      lineDelayTimerRef.current = window.setTimeout(() => {
        if (sessionId !== playbackSessionRef.current) return;
        lineDelayTimerRef.current = null;
        pendingLineIndexRef.current = null;
        speakLine(nextIndex, sessionId);
      }, getTransitionDelay(index));
    };

    utterance.onerror = (event) => {
      if (sessionId !== playbackSessionRef.current || event.error === "interrupted" || event.error === "canceled") return;
      stopProgressTimer();
      setPlaybackStatus("idle");
      setSpeechError(`Browser speech stopped: ${event.error}`);
    };

    window.speechSynthesis.speak(utterance);
  }

  function startSpeechAtLine(index: number) {
    const data = podcastDataRef.current;
    if (!data) return;

    if (!speechSupported) {
      setSpeechError("This browser does not support built-in speech playback.");
      return;
    }

    const boundedIndex = Math.max(0, Math.min(index, data.script.length - 1));
    playbackSessionRef.current += 1;
    const sessionId = playbackSessionRef.current;
    if (neuralAudioRef.current) {
      neuralAudioRef.current.pause();
      neuralAudioRef.current.currentTime = 0;
    }
    clearLineDelay();
    pendingLineIndexRef.current = null;
    window.speechSynthesis.cancel();
    stopProgressTimer();
    setSpeechError(null);
    setActiveLine(boundedIndex);
    speakLine(boundedIndex, sessionId);
  }

  function cancelSpeech(resetProgress = true) {
    playbackSessionRef.current += 1;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    if (neuralAudioRef.current) {
      neuralAudioRef.current.pause();
      if (resetProgress) neuralAudioRef.current.currentTime = 0;
    }
    clearLineDelay();
    pendingLineIndexRef.current = null;
    stopProgressTimer();
    setPlaybackStatus("idle");
    if (resetProgress) {
      playbackChunkRef.current = null;
      continueChunkPlaybackRef.current = false;
      setPlaybackTime(0);
      setActiveLine(0);
    }
  }

  function loadPodcast(data: PodcastMetadata) {
    liveAudioRef.current?.pause();
    setLiveEpisode(null);
    cancelSpeech(true);
    revokeNeuralAudio();
    podcastDataRef.current = data;
    setPodcastData(data);
    setPlaybackRate(settings.defaultSpeed);
    setAudioProvider(preferredAudioProvider(audioEngine, data));
    setHostVoices({});
    const clonedReference = data.voiceReferences?.find((reference) => reference.clonedVoiceId);
    if (clonedReference?.clonedVoiceId && clonedReference.cloneProvider === "elevenlabs" && audioEngine?.elevenLabsAvailable) {
      const clonedVoice = {
        id: clonedReference.clonedVoiceId,
        name: clonedReference.clonedVoiceName || "Cloned podcast voice",
        category: "cloned",
      };
      setAudioEngine((current) => current ? {
        ...current,
        elevenLabsVoices: [
          clonedVoice,
          ...current.elevenLabsVoices.filter((voice) => voice.id !== clonedVoice.id),
        ],
      } : current);
      setSelectedElevenVoice(clonedVoice.id);
    }
    const nextDuration = getPodcastDuration(data);
    durationRef.current = nextDuration;
    setDuration(nextDuration);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setCurrentLineIndex(0);
    currentLineIndexRef.current = 0;
    setIsPodcastPlayerOpen(false);
    setIsPlaybackBarOpen(true);
  }

  function handleGenerated(data: PodcastMetadata) {
    loadPodcast(data);
    setPodcastLibrary((current) => {
      const key = getPodcastLibraryKey(data);
      return [data, ...current.filter((item) => getPodcastLibraryKey(item) !== key)].slice(0, 24);
    });
  }

  function handlePodcastUpdated(data: PodcastMetadata) {
    setPodcastData(data);
    setPodcastLibrary((current) => {
      const key = getPodcastLibraryKey(data);
      return [data, ...current.filter((item) => getPodcastLibraryKey(item) !== key)].slice(0, 24);
    });
  }

  function closePlayback() {
    liveAudioRef.current?.pause();
    setLiveEpisode(null);
    cancelSpeech(true);
    revokeNeuralAudio();
    setIsPodcastPlayerOpen(false);
    setIsPlaybackBarOpen(false);
  }

  function navigate(tab: ActiveTab) {
    if (tab === "listen") setHasOpenedLive(true);
    if (tab === "publish") setHasOpenedPublish(true);
    setIsPodcastPlayerOpen(false);
    setActiveTab(tab);
    window.scrollTo(0, 0);
  }

  function openEpisode(episode: PodcastMetadata) {
    if (liveEpisode || episode !== podcastData || !isPlaybackBarOpen) loadPodcast(episode);
    setIsPodcastPlayerOpen(true);
  }

  function playLiveEpisode(episode: LivePodcast, section: "listen" | "search" = "listen") {
    setLiveSection(section);
    if (liveEpisode?.audioUrl === episode.audioUrl && liveAudioRef.current) {
      void liveAudioRef.current.play().catch(() => {});
      return;
    }
    closePlayback();
    setPlaybackRate(settings.defaultSpeed);
    setLiveTime(0);
    setLiveDuration(0);
    setLivePlaying(false);
    setLiveError(null);
    setLiveEpisode(episode);
    setIsPlaybackBarOpen(true);
  }

  function toggleLivePlayback() {
    const audio = liveAudioRef.current;
    if (!audio) return;
    if (!audio.paused) audio.pause();
    else void audio.play().catch(() => setLiveError("This episode could not be played."));
  }

  function seekLivePlayback(time: number) {
    const audio = liveAudioRef.current;
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(time, audio.duration));
  }

  function changeAudioProvider(provider: AudioProvider) {
    if (provider === audioProvider || isGeneratingNeuralAudioRef.current) return;
    cancelSpeech(false);
    revokeNeuralAudio();
    setAudioProvider(provider);
  }

  function changeVoice(voice: string) {
    cancelSpeech(false);
    revokeNeuralAudio();
    if (audioProvider === "elevenlabs") setSelectedElevenVoice(voice);
    else setSelectedNeuralVoice(voice);
  }

  function updateSettings(next: StudioSettings) {
    setSettings(next);
    try { window.localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }

  function changeHostVoice(speaker: string, voice: string) {
    cancelSpeech(false);
    revokeNeuralAudio();
    setHostVoices((current) => ({ ...current, [speaker]: voice }));
  }

  function canGenerateHighQualityAudio(data: PodcastMetadata | null) {
    if (!data || !audioEngine) return false;
    if (audioProvider === "browser") return false;
    if (audioProvider === "kokoro") return audioEngine.kokoroAvailable && getKokoroVoices(data.language).length > 0;
    if (audioProvider === "elevenlabs") return audioEngine.elevenLabsAvailable;
    if (audioProvider === "chatterbox") return audioEngine.chatterboxAvailable;
    return audioEngine.piperAvailable;
  }

  async function renderPublishingAudio(episode: PodcastMetadata, signal: AbortSignal) {
    const provider = audioProvider === "browser" || audioProvider === "elevenlabs" ? preferredAudioProvider(audioEngine, episode) : audioProvider;
    if (provider === "browser" || provider === "elevenlabs") throw new Error("Select an available local voice engine in the episode’s Audio settings to export audio.");
    const response = await fetch("/api/generate-audio", {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: episode.script, speakers: episode.speakers, language: episode.language, provider,
        maxSeconds: Math.ceil(getPodcastDuration(episode)),
        voiceId: provider === "piper" ? selectedNeuralVoice : undefined,
        voiceOverrides: provider === "kokoro" ? hostVoices : undefined,
        voiceReferences: provider === "chatterbox" ? episode.voiceReferences : undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.audioUrl) throw new Error(result.error || "The audio export failed.");
    const file = await fetch(result.audioUrl, { signal });
    if (!file.ok) throw new Error("The generated audio could not be downloaded.");
    return file.blob();
  }

  function changePlaybackRate(value: number) {
    const nextRate = Math.min(2, Math.max(0.5, value));
    playbackRateRef.current = nextRate;
    setPlaybackRate(nextRate);

    if (neuralAudioRef.current) {
      neuralAudioRef.current.playbackRate = nextRate;
      return;
    }

    if (speechSupported && speechStatusRef.current === "playing") {
      startSpeechAtLine(currentLineIndexRef.current);
    }
  }

  function togglePlay() {
    if (!podcastDataRef.current) return;
    if (isGeneratingNeuralAudioRef.current) return;

    if (neuralAudioUrl && neuralAudioRef.current) {
      if (speechStatusRef.current === "playing") {
        continueChunkPlaybackRef.current = false;
        neuralAudioRef.current.pause();
      } else {
        continueChunkPlaybackRef.current = true;
        void neuralAudioRef.current.play().catch(() => {
          setSpeechError("Audio could not start. Press Play again or regenerate the audio.");
        });
      }
      return;
    }

    if (audioProvider !== "elevenlabs" && audioProvider !== "browser" && canGenerateHighQualityAudio(podcastDataRef.current)) {
      if (currentTimeRef.current >= durationRef.current - 0.5) setPlaybackTime(0);
      continueChunkPlaybackRef.current = true;
      void generateLocalPlaybackChunk(currentLineIndexRef.current, audioProvider);
      return;
    }

    if (!speechSupported) {
      if (canGenerateHighQualityAudio(podcastDataRef.current)) {
        void generateNeuralPreview(true);
      } else {
        setSpeechError("This browser cannot play the fallback speech voice. Generate HD Audio first.");
      }
      return;
    }

    if (speechStatusRef.current === "playing") {
      if (lineDelayTimerRef.current !== null) {
        clearLineDelay();
        stopProgressTimer();
        setPlaybackStatus("paused");
        return;
      }
      window.speechSynthesis.pause();
      stopProgressTimer();
      setPlaybackStatus("paused");
      return;
    }

    if (speechStatusRef.current === "paused") {
      if (pendingLineIndexRef.current !== null) {
        const pendingLineIndex = pendingLineIndexRef.current;
        pendingLineIndexRef.current = null;
        startSpeechAtLine(pendingLineIndex);
        return;
      }
      window.speechSynthesis.resume();
      startProgressTimer(currentTimeRef.current);
      setPlaybackStatus("playing");
      return;
    }

    startSpeechAtLine(currentLineIndexRef.current);
  }

  function seekTo(seconds: number) {
    const data = podcastDataRef.current;
    if (!data || data.script.length === 0) return;

    const targetTime = Math.max(0, Math.min(durationRef.current, seconds));
    const targetIndex = getLineIndexAtTime(data, targetTime);
    const wasPlaying = speechStatusRef.current === "playing";

    if (neuralAudioUrl && neuralAudioRef.current) {
      const playbackChunk = playbackChunkRef.current;
      if (playbackChunk) {
        const withinLoadedChunk = targetTime >= playbackChunk.startTime && targetTime <= playbackChunk.endTime;
        if (withinLoadedChunk) {
          const chunkDuration = playbackChunk.endTime - playbackChunk.startTime;
          const audioDuration = neuralAudioRef.current.duration || chunkDuration;
          neuralAudioRef.current.currentTime = (targetTime - playbackChunk.startTime) / chunkDuration * audioDuration;
          setPlaybackTime(targetTime);
          setActiveLine(targetIndex);
          return;
        }

        neuralAudioRef.current.pause();
        if (neuralAudioUrl.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
        setNeuralAudioUrl(null);
        playbackChunkRef.current = null;
        discardQueuedChunk();
        setPlaybackTime(targetTime);
        setActiveLine(targetIndex);
        if (wasPlaying) {
          continueChunkPlaybackRef.current = true;
          void generateLocalPlaybackChunk(targetIndex, playbackChunk.provider);
        }
        return;
      }

      const audioDuration = neuralAudioRef.current.duration || durationRef.current;
      neuralAudioRef.current.currentTime = targetTime / durationRef.current * audioDuration;
      setPlaybackTime(targetTime);
      setActiveLine(targetIndex);
      return;
    }

    playbackSessionRef.current += 1;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    clearLineDelay();
    pendingLineIndexRef.current = null;
    stopProgressTimer();
    setActiveLine(targetIndex);
    setPlaybackTime(targetTime);
    setPlaybackStatus("idle");

    if (wasPlaying) {
      startSpeechAtLine(targetIndex);
    }
  }

  function discardQueuedChunk() {
    const queued = nextChunkRef.current;
    nextChunkRef.current = null;
    queued?.controller.abort();
    if (queued?.url) URL.revokeObjectURL(queued.url);
  }

  async function prepareLocalChunk(data: PodcastMetadata, start: number, provider: LocalAudioProvider, signal: AbortSignal): Promise<PreparedChunk> {
    let nextLineIndex = start;
    let coveredSeconds = 0;
    while (nextLineIndex < data.script.length) {
      const seconds = Math.max(1, data.script[nextLineIndex].durationSeconds);
      if (nextLineIndex > start && coveredSeconds + seconds > (start === 0 ? 18 : 34)) break;
      coveredSeconds += seconds;
      nextLineIndex += 1;
    }
    const script = data.script.slice(start, nextLineIndex);
    const first = script[0];
    const last = script.at(-1);
    if (!first || !last) throw new Error("There is no dialogue at this point in the episode.");
    const response = await fetch("/api/generate-audio", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script, speakers: data.speakers, language: data.language, provider,
        maxSeconds: Math.ceil(coveredSeconds),
        voiceId: provider === "piper" ? selectedNeuralVoice : undefined,
        voiceOverrides: provider === "kokoro" ? hostVoices : undefined,
        voiceReferences: provider === "chatterbox" ? data.voiceReferences : undefined,
      }),
    });
    const output = await response.json();
    if (!response.ok || !output.audioUrl) throw new Error(output.error || "The studio could not render the requested dialogue.");
    const file = await fetch(output.audioUrl, { signal });
    if (!file.ok) throw new Error("The rendered audio could not be loaded.");
    const bytes = await file.blob();
    signal.throwIfAborted();
    return {
      url: URL.createObjectURL(bytes),
      chunk: { provider, startTime: first.estimatedStartSeconds, endTime: last.estimatedStartSeconds + last.durationSeconds, nextLineIndex },
    };
  }

  function queueLocalChunk(data: PodcastMetadata, start: number, provider: LocalAudioProvider) {
    if (start >= data.script.length) return;
    const controller = new AbortController();
    const queue: QueuedChunk = {
      start, provider, controller,
      result: prepareLocalChunk(data, start, provider, controller.signal).then((prepared) => {
        if (controller.signal.aborted) { URL.revokeObjectURL(prepared.url); return null; }
        queue.url = prepared.url;
        return prepared;
      }).catch(() => null),
    };
    nextChunkRef.current = queue;
  }

  async function generateLocalPlaybackChunk(start: number, provider: LocalAudioProvider, sequential = false) {
    const data = podcastDataRef.current;
    if (!data || !data.script.length || isGeneratingNeuralAudioRef.current) return;
    const bounded = Math.max(0, Math.min(start, data.script.length - 1));
    let queued = nextChunkRef.current;
    if (queued && (queued.start !== bounded || queued.provider !== provider)) {
      discardQueuedChunk();
      queued = null;
    }

    isGeneratingNeuralAudioRef.current = true;
    const controller = queued?.controller || new AbortController();
    audioRequestRef.current = controller;
    const showLoading = !sequential || !queued?.url;
    if (showLoading) setIsGeneratingNeuralAudio(true);
    setNeuralAudioError(null);
    setSpeechError(null);
    if (!sequential) cancelSpeech(false);

    try {
      const prepared = (queued && await queued.result) || await prepareLocalChunk(data, bounded, provider, controller.signal);
      if (controller.signal.aborted) { URL.revokeObjectURL(prepared.url); return; }
      if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
      nextChunkRef.current = null;
      playbackChunkRef.current = prepared.chunk;
      autoPlayNeuralAudioRef.current = continueChunkPlaybackRef.current;
      const resume = sequential ? prepared.chunk.startTime : Math.max(prepared.chunk.startTime, Math.min(currentTimeRef.current, prepared.chunk.endTime));
      chunkSeekTimeRef.current = resume;
      setPlaybackTime(resume);
      setNeuralAudioUrl(prepared.url);
      queueLocalChunk(data, prepared.chunk.nextLineIndex, provider);
    } catch (error: any) {
      if (controller.signal.aborted) return;
      discardQueuedChunk();
      continueChunkPlaybackRef.current = false;
      if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
      setNeuralAudioUrl(null);
      playbackChunkRef.current = null;
      setPlaybackStatus("paused");
      setNeuralAudioError(error.message || "Audio generation failed.");
      setSpeechError("Audio could not be prepared. Open the episode to change voices or retry.");
    } finally {
      if (audioRequestRef.current === controller) {
        audioRequestRef.current = null;
        isGeneratingNeuralAudioRef.current = false;
        setIsGeneratingNeuralAudio(false);
      }
    }
  }

  function handleNeuralAudioEnded() {
    const playbackChunk = playbackChunkRef.current;
    if (!playbackChunk) {
      setPlaybackStatus("idle");
      return;
    }

    const shouldContinue = continueChunkPlaybackRef.current;
    const data = podcastDataRef.current;
    setPlaybackTime(playbackChunk.endTime);

    if (data && playbackChunk.nextLineIndex < data.script.length) {
      setActiveLine(playbackChunk.nextLineIndex);
      if (shouldContinue) {
        void generateLocalPlaybackChunk(playbackChunk.nextLineIndex, playbackChunk.provider, true);
        return;
      }
    }

    if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
    setPlaybackStatus("idle");
    setNeuralAudioUrl(null);
    playbackChunkRef.current = null;
  }

  async function generateNeuralPreview(autoPlay = false) {
    const data = podcastDataRef.current;
    if (!data || isGeneratingNeuralAudioRef.current) return;

    isGeneratingNeuralAudioRef.current = true;
    discardQueuedChunk();
    const controller = new AbortController();
    audioRequestRef.current = controller;
    playbackChunkRef.current = null;
    continueChunkPlaybackRef.current = false;
    autoPlayNeuralAudioRef.current = autoPlay;
    setIsGeneratingNeuralAudio(true);
    setNeuralAudioError(null);
    setSpeechError(null);
    cancelSpeech(false);

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: data.script,
          speakers: data.speakers,
          language: data.language,
          maxSeconds: Math.ceil(getPodcastDuration(data)),
          provider: audioProvider,
          voiceId: audioProvider === "elevenlabs" ? selectedElevenVoice : selectedNeuralVoice,
          voiceOverrides: audioProvider === "kokoro" ? hostVoices : undefined,
          modelId: audioEngine?.elevenLabsModelId,
          voiceReferences: audioProvider === "chatterbox" ? data.voiceReferences : undefined,
        }),
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || "Neural TTS failed.");

      if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
      const url = result.audioUrl || (() => {
        const buffer = Uint8Array.from(atob(result.audio), (char) => char.charCodeAt(0));
        return URL.createObjectURL(new Blob([buffer], { type: result.mimeType || "audio/wav" }));
      })();
      setNeuralAudioUrl(url);
      setPlaybackTime(0);
      setPlaybackStatus("idle");
    } catch (error: any) {
      if (controller.signal.aborted) return;
      autoPlayNeuralAudioRef.current = false;
      setNeuralAudioError(error.message || "Neural TTS is not available.");
    } finally {
      if (audioRequestRef.current === controller) {
        audioRequestRef.current = null;
        isGeneratingNeuralAudioRef.current = false;
        setIsGeneratingNeuralAudio(false);
      }
    }
  }

  return (
    <div className="app-shell min-h-screen bg-[#100e18] font-sans text-white" data-playing-bar={isPlaybackBarOpen} data-reduced-motion={settings.reducedMotion}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#100e18]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => navigate("create")} className="flex items-center gap-2 font-display text-lg font-bold tracking-tight" aria-label="Echo Studios home">
            <img src={echoLogoUrl} alt="" className="size-8 rounded-full object-cover" /> Echo Studios
          </button>
        </div>
      </header>
      <main aria-hidden={isPodcastPlayerOpen || undefined} className="mx-auto w-full max-w-6xl pb-[var(--app-dock-height)]">
        <div hidden={activeTab !== "create"}>
          <CreateView onGenerated={handleGenerated} onUpdated={handlePodcastUpdated} generatedPodcast={podcastData} onOpenEpisode={() => podcastData && openEpisode(podcastData)} />
        </div>
        {hasOpenedLive && <div hidden={activeTab !== "listen"}><ListenFeedView onPlayEpisode={playLiveEpisode} initialEpisode={liveEpisode} episodes={podcastLibrary} onOpenEpisode={openEpisode} /></div>}
        {hasOpenedPublish && <div hidden={activeTab !== "publish"}><PublishView data={podcastData} onRenderAudio={renderPublishingAudio} /></div>}
        {activeTab === "profile" && <ProfileView onHome={() => navigate("create")} generatedPodcasts={podcastLibrary} onOpenDraft={openEpisode} onOpenSettings={() => setIsSettingsOpen(true)} />}
        {activeTab === "search" && <SearchView onPlayEpisode={(episode) => playLiveEpisode(episode, "search")} playingId={liveEpisode?.id} />}
      </main>

      <DmChat isOpen={isDmOpen} onClose={() => setIsDmOpen(false)} />
      <button onClick={() => setIsDmOpen((open) => !open)} className="fixed right-4 top-1/2 z-[54] grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-[#211c31] text-brand-300 shadow-lg hover:bg-[#302744]" aria-label="Open direct messages" aria-expanded={isDmOpen}><MessageSquare aria-hidden="true" className="size-5" /></button>
      {isSettingsOpen && <SettingsModal settings={settings} onChange={updateSettings} onClose={() => setIsSettingsOpen(false)} />}
      <button onClick={() => setIsAiChatOpen((open) => !open)} className="fixed bottom-[calc(var(--app-dock-height)+0.75rem)] right-4 z-[55] grid size-11 place-items-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-500" aria-label={isAiChatOpen ? "Close AI assistant" : "Open AI assistant"} aria-expanded={isAiChatOpen}>
        <Bot aria-hidden="true" className="size-5" />
      </button>
      <AiOracleChat isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />

      {liveEpisode && (
        <audio key={liveEpisode.audioUrl} ref={liveAudioRef} src={liveEpisode.audioUrl} autoPlay preload="metadata"
          onPlay={() => { setLivePlaying(true); setLiveError(null); }}
          onPause={() => setLivePlaying(false)}
          onEnded={() => setLivePlaying(false)}
          onTimeUpdate={(event) => setLiveTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setLiveDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onError={() => { setLivePlaying(false); setLiveError("This episode could not be played."); }}
        />
      )}

      {neuralAudioUrl && (
        <audio
          ref={neuralAudioRef}
          src={neuralAudioUrl}
          preload="auto"
          playsInline
          onPlay={() => setPlaybackStatus("playing")}
          onPause={(event) => { if (!event.currentTarget.ended && !autoPlayNeuralAudioRef.current) setPlaybackStatus("paused"); }}
          onError={(event) => {
            const mediaError = event.currentTarget.error;
            setSpeechError(mediaError?.message || "The generated audio could not be loaded.");
          }}
          onEnded={handleNeuralAudioEnded}
          onTimeUpdate={(event) => {
            const playbackChunk = playbackChunkRef.current;
            const startTime = playbackChunk?.startTime || 0;
            const scriptSeconds = (playbackChunk?.endTime || durationRef.current) - startTime;
            const { currentTime, duration } = event.currentTarget;
            const elapsed = Number.isFinite(duration) && duration > 0 ? currentTime / duration * scriptSeconds : currentTime;
            setPlaybackTime(startTime + elapsed);
          }}
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = playbackRateRef.current;
            const chunk = playbackChunkRef.current;
            const seek = chunkSeekTimeRef.current;
            if (chunk && seek !== null && chunk.endTime > chunk.startTime && Number.isFinite(event.currentTarget.duration)) {
              event.currentTarget.currentTime = (seek - chunk.startTime) / (chunk.endTime - chunk.startTime) * event.currentTarget.duration;
            }
            chunkSeekTimeRef.current = null;
            const episodeDuration = getPodcastDuration(podcastDataRef.current);
            durationRef.current = episodeDuration;
            setDuration(episodeDuration);
          }}
        />
      )}

      {isPodcastPlayerOpen && podcastData && <PodcastPlayer
        data={podcastData}
        currentLineIndex={currentLineIndex}
        onSeek={seekTo}
        audioEngine={audioEngine}
        provider={audioProvider}
        voiceId={audioProvider === "elevenlabs" ? selectedElevenVoice : selectedNeuralVoice}
        voiceOverrides={hostVoices}
        volume={settings.volume}
        loading={isGeneratingNeuralAudio}
        error={neuralAudioError}
        onProviderChange={changeAudioProvider}
        onVoiceChange={changeVoice}
        onHostVoiceChange={changeHostVoice}
        onGenerateAudio={() => void generateNeuralPreview()}
        onAudition={() => {
          continueChunkPlaybackRef.current = false;
          autoPlayNeuralAudioRef.current = false;
          if (neuralAudioRef.current) neuralAudioRef.current.pause();
          else if (speechStatusRef.current === "playing") cancelSpeech(false);
        }}
        onClose={() => setIsPodcastPlayerOpen(false)}
      />}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#15121e] pb-[env(safe-area-inset-bottom)]">
        {isPlaybackBarOpen && (liveEpisode || podcastData) && <PlaybackBar
          title={liveEpisode?.episodeTitle || podcastData?.title || "Podcast"}
          cover={liveEpisode?.imageUrl || podcastData?.coverArt?.dataUrl}
          time={liveEpisode ? liveTime : currentTime}
          duration={liveEpisode ? liveDuration : duration}
          speed={playbackRate}
          playing={liveEpisode ? livePlaying : speechStatus === "playing"}
          loading={!liveEpisode && isGeneratingNeuralAudio}
          error={liveEpisode ? liveError : speechError}
          onToggle={liveEpisode ? toggleLivePlayback : togglePlay}
          onSeek={liveEpisode ? seekLivePlayback : seekTo}
          onSpeed={changePlaybackRate}
          onClose={closePlayback}
          onDetails={() => liveEpisode ? navigate(liveSection) : setIsPodcastPlayerOpen((open) => !open)}
        />}
        <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-3xl items-stretch justify-between px-1 sm:px-4">
          {([
            ["profile", "Profile", UserCircle], ["search", "Search", Search], ["create", "Create", PlusCircle],
            ["listen", "Live", PlayCircle], ["publish", "Publish", Share],
          ] as const).map(([tab, label, Icon]) => (
            <div key={tab} className="flex min-w-0 flex-1">
              <NavItem icon={<Icon className="size-5" />} label={label} isActive={activeTab === tab && !isPodcastPlayerOpen} onClick={() => navigate(tab)} />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: ReactNode; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-current={isActive ? "page" : undefined} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors ${isActive ? "text-brand-300" : "text-zinc-400 hover:text-white"}`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
