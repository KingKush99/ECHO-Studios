/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, PlayCircle, PlusCircle, Search, Share, Sparkles, UserCircle } from "lucide-react";

import { PodcastMetadata } from "./types";
import { CreateView } from "./components/CreateView";
import { ListenFeedView } from "./components/ListenFeedView";
import { PublishView } from "./components/PublishView";
import { ProfileView } from "./components/RealProfileView";
import { PodcastPlayer } from "./components/PodcastPlayer";
import { SearchView } from "./components/SearchView";
import { DmChat } from "./components/DmChat";
import { AiOracleChat } from "./components/AiOracleChat";
import echoLogoUrl from "./assets/images/echo_studios_favicon_1782358750086.jpg";

type ActiveTab = "create" | "listen" | "publish" | "profile" | "search";
type SpeechStatus = "idle" | "playing" | "paused";
type VoiceMode = "narrator" | "cast";
type AudioEngineStatus = {
  piperAvailable: boolean;
  chatterboxAvailable: boolean;
  elevenLabsAvailable: boolean;
  elevenLabsModelId: string;
  elevenLabsDefaultVoiceId: string;
  voices: Array<{ id: string; name: string }>;
  elevenLabsVoices: Array<{ id: string; name: string; category: string }>;
  installCommand: string;
  chatterboxInstallCommand: string;
};
type AudioProvider = "elevenlabs" | "chatterbox" | "piper";
type PlaybackChunk = {
  startTime: number;
  endTime: number;
  nextLineIndex: number;
};
const PODCAST_LIBRARY_STORAGE_KEY = "echo.podcastLibrary.v1";

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
  const [isPodcastPlayerOpen, setIsPodcastPlayerOpen] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>("idle");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoiceURI, setPreferredVoiceURI] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("narrator");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioEngine, setAudioEngine] = useState<AudioEngineStatus | null>(null);
  const [audioProvider, setAudioProvider] = useState<AudioProvider>("elevenlabs");
  const [selectedNeuralVoice, setSelectedNeuralVoice] = useState("");
  const [selectedElevenVoice, setSelectedElevenVoice] = useState("");
  const [neuralAudioUrl, setNeuralAudioUrl] = useState<string | null>(null);
  const [isGeneratingNeuralAudio, setIsGeneratingNeuralAudio] = useState(false);
  const [neuralAudioError, setNeuralAudioError] = useState<string | null>(null);

  const podcastDataRef = useRef<PodcastMetadata | null>(null);
  const neuralAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayNeuralAudioRef = useRef(false);
  const isGeneratingNeuralAudioRef = useRef(false);
  const playbackChunkRef = useRef<PlaybackChunk | null>(null);
  const continueChunkPlaybackRef = useRef(false);
  const playbackRateRef = useRef(1);
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
        setAudioProvider(data.elevenLabsAvailable ? "elevenlabs" : data.chatterboxAvailable ? "chatterbox" : "piper");
      })
      .catch(() => {
        setAudioEngine({
          piperAvailable: false,
          chatterboxAvailable: false,
          elevenLabsAvailable: false,
          elevenLabsModelId: "eleven_multilingual_v2",
          elevenLabsDefaultVoiceId: "",
          voices: [],
          elevenLabsVoices: [],
          installCommand: ".\\install-piper.ps1",
          chatterboxInstallCommand: ".\\install-chatterbox.ps1",
        });
        setAudioProvider("piper");
      });
  }, []);

  useEffect(() => {
    return () => {
      cancelSpeech(false);
    };
  }, []);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (neuralAudioRef.current) {
      neuralAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, neuralAudioUrl]);

  useEffect(() => {
    if (!neuralAudioUrl) return;
    neuralAudioRef.current?.load();
  }, [neuralAudioUrl]);

  useEffect(() => {
    if (!neuralAudioUrl || !autoPlayNeuralAudioRef.current) return;

    const audio = neuralAudioRef.current;
    if (!audio) return;

    autoPlayNeuralAudioRef.current = false;
    const playAudio = () => {
      void audio.play().catch(() => {
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
    if (voice.lang.toLowerCase().startsWith("en")) score += 40;
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

    const preferredVoice = preferredVoiceURI ? voices.find((voice) => voice.voiceURI === preferredVoiceURI) : null;
    const data = podcastDataRef.current;
    const speaker = data?.speakers.find((item) => item.name === speakerName);
    const speakerIndex = Math.max(0, data?.speakers.findIndex((item) => item.name === speakerName) ?? 0);
    if (preferredVoice && voiceMode === "narrator" && speakerIndex === 0) return preferredVoice;

    const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const usableVoices = englishVoices.length > 0 ? englishVoices : voices;
    const speakerStyle = `${speaker?.gender || ""} ${speaker?.style || ""}`.toLowerCase();
    const rankedVoices = [...usableVoices].sort((a, b) => {
      const aName = `${a.name} ${a.voiceURI}`.toLowerCase();
      const bName = `${b.name} ${b.voiceURI}`.toLowerCase();
      const voiceFit = (name: string) => {
        let fit = 0;
        if (speakerStyle.includes("female") && /(jenny|aria|samantha|sonia|libby|zira|amy|female)/.test(name)) fit += 24;
        if (speakerStyle.includes("male") && /(guy|ryan|david|daniel|mark|male)/.test(name)) fit += 24;
        if (speakerStyle.includes("skeptical") && /(david|guy|mark|ryan)/.test(name)) fit += 12;
        if (speakerStyle.includes("enthusiastic") && /(jenny|aria|amy|samantha)/.test(name)) fit += 12;
        if (speakerStyle.includes("intellectual") && /(daniel|david|ryan|guy)/.test(name)) fit += 10;
        return fit;
      };
      return scoreVoice(b) + voiceFit(bName) - (scoreVoice(a) + voiceFit(aName));
    });

    if (preferredVoice && voiceMode === "cast") {
      const otherVoices = rankedVoices.filter((voice) => voice.voiceURI !== preferredVoice.voiceURI);
      rankedVoices.splice(0, rankedVoices.length, preferredVoice, ...otherVoices);
    }

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

  function handleGenerated(data: PodcastMetadata) {
    cancelSpeech(true);
    revokeNeuralAudio();
    podcastDataRef.current = data;
    setPodcastData(data);
    const clonedReference = data.voiceReferences?.find((reference) => reference.clonedVoiceId);
    if (clonedReference?.clonedVoiceId) {
      if (clonedReference.cloneProvider === "elevenlabs") {
        const clonedVoice = {
          id: clonedReference.clonedVoiceId,
          name: clonedReference.clonedVoiceName || "Cloned podcast voice",
          category: "cloned",
        };
        setAudioEngine((current) => current ? {
          ...current,
          elevenLabsAvailable: true,
          elevenLabsVoices: [
            clonedVoice,
            ...current.elevenLabsVoices.filter((voice) => voice.id !== clonedVoice.id),
          ],
        } : current);
        setSelectedElevenVoice(clonedVoice.id);
        setAudioProvider("elevenlabs");
      } else {
        setAudioProvider("chatterbox");
      }
    }
    setPodcastLibrary((current) => {
      const key = getPodcastLibraryKey(data);
      return [data, ...current.filter((item) => getPodcastLibraryKey(item) !== key)].slice(0, 24);
    });
    const nextDuration = getPodcastDuration(data);
    durationRef.current = nextDuration;
    setDuration(nextDuration);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setCurrentLineIndex(0);
    currentLineIndexRef.current = 0;
    setIsPodcastPlayerOpen(true);
    setActiveTab("create");

    if (audioEngine?.piperAvailable) {
      continueChunkPlaybackRef.current = false;
      setAudioProvider("piper");
      window.setTimeout(() => {
        void generatePiperPlaybackChunk(0);
      }, 0);
    }
  }

  function handlePodcastUpdated(data: PodcastMetadata) {
    setPodcastData(data);
    setPodcastLibrary((current) => {
      const key = getPodcastLibraryKey(data);
      return [data, ...current.filter((item) => getPodcastLibraryKey(item) !== key)].slice(0, 24);
    });
  }

  function closePodcastPlayer() {
    autoPlayNeuralAudioRef.current = false;
    cancelSpeech(true);
    setIsPodcastPlayerOpen(false);
  }

  function canGenerateHighQualityAudio(data: PodcastMetadata | null) {
    if (!data || !audioEngine) return false;
    if (audioProvider === "elevenlabs") return audioEngine.elevenLabsAvailable;
    if (audioProvider === "chatterbox") return audioEngine.chatterboxAvailable;
    return audioEngine.piperAvailable;
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

    if (audioEngine?.piperAvailable) {
      continueChunkPlaybackRef.current = true;
      setAudioProvider("piper");
      void generatePiperPlaybackChunk(currentLineIndexRef.current);
      return;
    }

    if (!speechSupported) {
      if (canGenerateHighQualityAudio(podcastDataRef.current)) {
        autoPlayNeuralAudioRef.current = true;
        void generateNeuralPreview();
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
          neuralAudioRef.current.currentTime = Math.max(0, targetTime - playbackChunk.startTime);
          setPlaybackTime(targetTime);
          setActiveLine(targetIndex);
          return;
        }

        neuralAudioRef.current.pause();
        if (neuralAudioUrl.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
        setNeuralAudioUrl(null);
        playbackChunkRef.current = null;
        setPlaybackTime(targetTime);
        setActiveLine(targetIndex);
        if (wasPlaying) {
          continueChunkPlaybackRef.current = true;
          void generatePiperPlaybackChunk(targetIndex);
        }
        return;
      }

      const audioDuration = Number.isFinite(neuralAudioRef.current.duration) ? neuralAudioRef.current.duration : durationRef.current;
      neuralAudioRef.current.currentTime = Math.max(0, Math.min(audioDuration || durationRef.current, targetTime));
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

  function seekRelative(seconds: number) {
    seekTo(currentTimeRef.current + seconds);
  }

  async function generatePiperPlaybackChunk(startLineIndex: number) {
    const data = podcastDataRef.current;
    if (!data || !audioEngine?.piperAvailable || isGeneratingNeuralAudioRef.current) return;

    const boundedStartIndex = Math.max(0, Math.min(startLineIndex, data.script.length - 1));
    let nextLineIndex = boundedStartIndex;
    let coveredSeconds = 0;
    const targetChunkSeconds = 35;

    while (nextLineIndex < data.script.length) {
      const lineSeconds = Math.max(1, data.script[nextLineIndex].durationSeconds);
      if (nextLineIndex > boundedStartIndex && coveredSeconds + lineSeconds > targetChunkSeconds) break;
      coveredSeconds += lineSeconds;
      nextLineIndex += 1;
    }

    const chunkScript = data.script.slice(boundedStartIndex, nextLineIndex);
    if (chunkScript.length === 0) return;
    const startTime = chunkScript[0].estimatedStartSeconds;
    const lastLine = chunkScript[chunkScript.length - 1];
    const endTime = lastLine.estimatedStartSeconds + lastLine.durationSeconds;

    isGeneratingNeuralAudioRef.current = true;
    setIsGeneratingNeuralAudio(true);
    setNeuralAudioError(null);
    setSpeechError(null);
    cancelSpeech(false);

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: chunkScript,
          speakers: data.speakers,
          maxSeconds: Math.ceil(coveredSeconds),
          provider: "piper",
          voiceId: selectedNeuralVoice,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Fast playback audio failed.");

      if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
      const nextAudioUrl = result.audioUrl || (() => {
        const buffer = Uint8Array.from(atob(result.audio), (char) => char.charCodeAt(0));
        return URL.createObjectURL(new Blob([buffer], { type: result.mimeType || "audio/wav" }));
      })();
      playbackChunkRef.current = { startTime, endTime, nextLineIndex };
      autoPlayNeuralAudioRef.current = continueChunkPlaybackRef.current;
      setNeuralAudioUrl(nextAudioUrl);
      setPlaybackTime(startTime);
      setActiveLine(boundedStartIndex);
      setPlaybackStatus("idle");
      setIsPodcastPlayerOpen(true);
    } catch (error: any) {
      continueChunkPlaybackRef.current = false;
      setNeuralAudioError(error.message || "Fast playback audio is not available.");
      setSpeechError("Playback audio could not be prepared. Open Audio Settings and try again.");
    } finally {
      isGeneratingNeuralAudioRef.current = false;
      setIsGeneratingNeuralAudio(false);
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
    setPlaybackStatus("idle");

    if (data && playbackChunk.nextLineIndex < data.script.length) {
      setActiveLine(playbackChunk.nextLineIndex);
      if (shouldContinue) {
        void generatePiperPlaybackChunk(playbackChunk.nextLineIndex);
        return;
      }
    }

    if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
    setNeuralAudioUrl(null);
    playbackChunkRef.current = null;
  }

  async function generateNeuralPreview() {
    const data = podcastDataRef.current;
    if (!data || isGeneratingNeuralAudioRef.current) return;

    isGeneratingNeuralAudioRef.current = true;
    playbackChunkRef.current = null;
    continueChunkPlaybackRef.current = false;
    autoPlayNeuralAudioRef.current = false;
    setIsGeneratingNeuralAudio(true);
    setNeuralAudioError(null);
    setSpeechError(null);
    cancelSpeech(false);

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: data.script,
          speakers: data.speakers,
          maxSeconds: Math.ceil(getPodcastDuration(data)),
          provider: audioProvider,
          voiceId: audioProvider === "elevenlabs" ? selectedElevenVoice : selectedNeuralVoice,
          modelId: audioEngine?.elevenLabsModelId,
          voiceReferences: audioProvider === "chatterbox" ? data.voiceReferences : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Neural TTS failed.");

      if (neuralAudioUrl?.startsWith("blob:")) URL.revokeObjectURL(neuralAudioUrl);
      const url = result.audioUrl || (() => {
        const buffer = Uint8Array.from(atob(result.audio), (char) => char.charCodeAt(0));
        return URL.createObjectURL(new Blob([buffer], { type: result.mimeType || "audio/wav" }));
      })();
      setNeuralAudioUrl(url);
      setPlaybackTime(0);
      setPlaybackStatus("idle");
      setIsPodcastPlayerOpen(true);
    } catch (error: any) {
      autoPlayNeuralAudioRef.current = false;
      setNeuralAudioError(error.message || "Neural TTS is not available.");
      const availabilityKey = audioProvider === "elevenlabs" ? "elevenLabsAvailable" : audioProvider === "chatterbox" ? "chatterboxAvailable" : "piperAvailable";
      setAudioEngine((current) => current ? { ...current, [availabilityKey]: false } : current);
    } finally {
      isGeneratingNeuralAudioRef.current = false;
      setIsGeneratingNeuralAudio(false);
    }
  }

  return (
    <div className="min-h-screen font-sans bg-[#08091a] text-white flex flex-col relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <button
        onClick={() => setIsDmOpen(!isDmOpen)}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-50 p-4 bg-[#1a1b36] border border-white/10 rounded-full text-brand-400 hover:text-brand-300 hover:bg-[#25274d] transition-all shadow-[0_0_15px_rgba(139,92,246,0.6)]"
        aria-label="Open direct messages"
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="w-6 h-6 scale-x-[-1]" />
        </div>
      </button>

      <button
        onClick={() => setIsAiChatOpen(!isAiChatOpen)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 p-4 bg-[#1a1b36] border border-white/10 rounded-full text-[#8b5cf6] hover:text-[#a78bfa] hover:bg-[#25274d] transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)]"
        aria-label="Open AI assistant"
      >
        <div className="relative flex items-center justify-center">
          <Bot className="w-6 h-6" />
        </div>
      </button>

      <header className="sticky top-0 z-40 bg-[#08091a]/80 backdrop-blur-md border-b border-brand-500/20 px-6 py-4 flex items-center justify-between relative">
        <div className="flex items-center gap-3 w-1/3">
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight text-white flex gap-1">
              <span className="text-brand-500">E</span>
              <span className="text-brand-400">C</span>
              <span className="text-brand-300">H</span>
              <span className="text-brand-200">O</span>
              <span className="ml-1 opacity-80 hidden sm:inline">Studios</span>
            </h1>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full overflow-hidden shadow-[0_0_15px_rgba(139,92,246,0.3)] bg-transparent">
          <img src={echoLogoUrl} alt="ECHO Studios Logo" className="w-[115%] h-[115%] max-w-none -ml-[7.5%] -mt-[7.5%] rounded-full object-cover mix-blend-lighten" />
        </div>

        <div className="flex items-center justify-end gap-3 text-xs font-mono text-brand-200/50 w-1/3">
          <span className="hidden md:flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> NATURAL.SPEECH
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto relative z-10 custom-scrollbar">
        {activeTab === "create" && <CreateView onGenerated={handleGenerated} onUpdated={handlePodcastUpdated} generatedPodcast={podcastData} />}
        {activeTab === "listen" && <ListenFeedView />}
        {activeTab === "publish" && <PublishView data={podcastData} />}
        {activeTab === "profile" && <ProfileView onHome={() => setActiveTab("create")} generatedPodcasts={podcastLibrary} />}
        {activeTab === "search" && <SearchView />}
      </main>

      <DmChat isOpen={isDmOpen} onClose={() => setIsDmOpen(false)} />
      <AiOracleChat isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />

      {neuralAudioUrl && (
        <audio
          ref={neuralAudioRef}
          src={neuralAudioUrl}
          preload="auto"
          playsInline
          onPlay={() => setPlaybackStatus("playing")}
          onPause={() => setPlaybackStatus("paused")}
          onError={(event) => {
            const mediaError = event.currentTarget.error;
            setSpeechError(mediaError?.message || "The generated audio could not be loaded.");
          }}
          onEnded={handleNeuralAudioEnded}
          onTimeUpdate={(event) => {
            const playbackChunk = playbackChunkRef.current;
            setPlaybackTime((playbackChunk?.startTime || 0) + event.currentTarget.currentTime);
          }}
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = playbackRateRef.current;
            const episodeDuration = getPodcastDuration(podcastDataRef.current);
            durationRef.current = episodeDuration;
            setDuration(episodeDuration);
          }}
        />
      )}

      <PodcastPlayer
        data={isPodcastPlayerOpen ? podcastData : null}
        playbackStatus={speechStatus}
        playbackError={speechError}
        speechSupported={speechSupported}
        onPlayToggle={togglePlay}
        onSeekRelative={seekRelative}
        onSeekTo={seekTo}
        playbackRate={playbackRate}
        onPlaybackRateChange={changePlaybackRate}
        currentTime={currentTime}
        duration={duration}
        currentLineIndex={currentLineIndex}
        voices={availableVoices.map((voice) => ({
          name: voice.name,
          lang: voice.lang,
          voiceURI: voice.voiceURI,
          score: scoreVoice(voice),
        }))}
        preferredVoiceURI={preferredVoiceURI}
        voiceMode={voiceMode}
        onVoiceChange={setPreferredVoiceURI}
        onVoiceModeChange={setVoiceMode}
        audioEngine={audioEngine}
        audioProvider={audioProvider}
        selectedNeuralVoice={selectedNeuralVoice}
        selectedElevenVoice={selectedElevenVoice}
        neuralAudioAvailable={!!neuralAudioUrl}
        isGeneratingNeuralAudio={isGeneratingNeuralAudio}
        neuralAudioError={neuralAudioError}
        onAudioProviderChange={setAudioProvider}
        onNeuralVoiceChange={setSelectedNeuralVoice}
        onElevenVoiceChange={setSelectedElevenVoice}
        onGenerateNeuralPreview={generateNeuralPreview}
        onClose={closePodcastPlayer}
      />

      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#0c0d21]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-2">
        <div className="w-full mx-auto flex items-stretch justify-between px-0 pb-4">
          <NavItem icon={<UserCircle className="w-6 h-6" />} label="Profile" isActive={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
          <NavItem icon={<Search className="w-6 h-6" />} label="Search" isActive={activeTab === "search"} onClick={() => setActiveTab("search")} />
          <NavItem icon={<PlusCircle className="w-6 h-6" />} label="Create" isActive={activeTab === "create"} onClick={() => setActiveTab("create")} />
          <NavItem icon={<PlayCircle className="w-6 h-6" />} label="Live" isActive={activeTab === "listen"} onClick={() => setActiveTab("listen")} />
          <NavItem icon={<Share className="w-6 h-6" />} label="Publish" isActive={activeTab === "publish"} onClick={() => setActiveTab("publish")} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: ReactNode; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-1.5 p-2 transition-colors w-full ${isActive ? "text-brand-400" : "text-gray-500 hover:text-gray-300"}`}>
      <div className={`${isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : ""} transition-all`}>{icon}</div>
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </button>
  );
}
