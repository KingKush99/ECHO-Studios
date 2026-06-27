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
  const [audioEngine, setAudioEngine] = useState<AudioEngineStatus | null>(null);
  const [audioProvider, setAudioProvider] = useState<AudioProvider>("elevenlabs");
  const [selectedNeuralVoice, setSelectedNeuralVoice] = useState("");
  const [selectedElevenVoice, setSelectedElevenVoice] = useState("");
  const [neuralAudioUrl, setNeuralAudioUrl] = useState<string | null>(null);
  const [isGeneratingNeuralAudio, setIsGeneratingNeuralAudio] = useState(false);
  const [neuralAudioError, setNeuralAudioError] = useState<string | null>(null);

  const podcastDataRef = useRef<PodcastMetadata | null>(null);
  const neuralAudioRef = useRef<HTMLAudioElement | null>(null);
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
        if (!data.elevenLabsAvailable) setAudioProvider("piper");
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

  function setPlaybackTime(value: number) {
    const clamped = Math.max(0, Math.min(value, durationRef.current || value));
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
    if (neuralAudioUrl) URL.revokeObjectURL(neuralAudioUrl);
    setNeuralAudioUrl(null);
    setNeuralAudioError(null);
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
      const elapsed = (Date.now() - startedAt) / 1000;
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
    if (preferredVoice && voiceMode === "narrator") return preferredVoice;

    const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const usableVoices = englishVoices.length > 0 ? englishVoices : voices;
    const rankedVoices = [...usableVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));

    if (preferredVoice && voiceMode === "cast") {
      const otherVoices = rankedVoices.filter((voice) => voice.voiceURI !== preferredVoice.voiceURI);
      rankedVoices.splice(0, rankedVoices.length, preferredVoice, ...otherVoices);
    }

    const topVoices = rankedVoices.slice(0, Math.min(4, rankedVoices.length));
    return topVoices[getHash(speakerName) % topVoices.length];
  }

  function getSpeechSettings(speakerName: string, lineIndex: number) {
    const speaker = podcastDataRef.current?.speakers.find((item) => item.name === speakerName);
    const hash = getHash(`${speakerName}-${lineIndex}`);
    const rateVariation = (hash % 7) * 0.01;
    const pitchVariation = ((hash % 5) - 2) * 0.025;
    const style = speaker?.style.toLowerCase() || "";

    const baseRate = voiceMode === "narrator" ? 0.88 : style.includes("calm") || style.includes("philosophical") ? 0.88 : style.includes("enthusiastic") ? 0.94 : 0.91;
    const basePitch = voiceMode === "narrator" ? 0.98 : speaker?.gender === "male" ? 0.9 : speaker?.gender === "female" ? 1.04 : 0.98;

    return {
      rate: Math.min(0.98, baseRate + rateVariation),
      pitch: Math.min(1.08, Math.max(0.88, basePitch + pitchVariation)),
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
      setPlaybackTime(0);
      setActiveLine(0);
    }
  }

  function handleGenerated(data: PodcastMetadata) {
    cancelSpeech(true);
    revokeNeuralAudio();
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
  }

  function handlePodcastUpdated(data: PodcastMetadata) {
    setPodcastData(data);
    setPodcastLibrary((current) => {
      const key = getPodcastLibraryKey(data);
      return [data, ...current.filter((item) => getPodcastLibraryKey(item) !== key)].slice(0, 24);
    });
  }

  function closePodcastPlayer() {
    cancelSpeech(true);
    setIsPodcastPlayerOpen(false);
  }

  function togglePlay() {
    if (!podcastDataRef.current) return;

    if (neuralAudioUrl && neuralAudioRef.current) {
      if (speechStatusRef.current === "playing") {
        neuralAudioRef.current.pause();
      } else {
        neuralAudioRef.current.play();
      }
      return;
    }

    if (!speechSupported) {
      setSpeechError("This browser does not support built-in speech playback.");
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

  function seekRelative(seconds: number) {
    if (neuralAudioUrl && neuralAudioRef.current) {
      const nextTime = Math.max(0, Math.min(neuralAudioRef.current.duration || 0, neuralAudioRef.current.currentTime + seconds));
      neuralAudioRef.current.currentTime = nextTime;
      setPlaybackTime(nextTime);
      return;
    }

    const data = podcastDataRef.current;
    if (!data || data.script.length === 0) return;

    const targetTime = Math.max(0, Math.min(durationRef.current, currentTimeRef.current + seconds));
    const targetIndex = data.script.reduce((selectedIndex, line, index) => (line.estimatedStartSeconds <= targetTime ? index : selectedIndex), 0);
    const wasPlaying = speechStatusRef.current === "playing";

    playbackSessionRef.current += 1;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    clearLineDelay();
    pendingLineIndexRef.current = null;
    stopProgressTimer();
    setActiveLine(targetIndex);
    setPlaybackTime(data.script[targetIndex]?.estimatedStartSeconds || 0);
    setPlaybackStatus("idle");

    if (wasPlaying) {
      startSpeechAtLine(targetIndex);
    }
  }

  async function generateNeuralPreview() {
    const data = podcastDataRef.current;
    if (!data) return;

    setIsGeneratingNeuralAudio(true);
    setNeuralAudioError(null);
    cancelSpeech(false);

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: data.script,
          speakers: data.speakers,
          maxSeconds: 300,
          provider: audioProvider,
          voiceId: audioProvider === "elevenlabs" ? selectedElevenVoice : selectedNeuralVoice,
          modelId: audioEngine?.elevenLabsModelId,
          voiceReferences: audioProvider === "chatterbox" ? data.voiceReferences : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Neural TTS failed.");

      if (neuralAudioUrl) URL.revokeObjectURL(neuralAudioUrl);
      const buffer = Uint8Array.from(atob(result.audio), (char) => char.charCodeAt(0));
      const blob = new Blob([buffer], { type: result.mimeType || "audio/wav" });
      const url = URL.createObjectURL(blob);
      setNeuralAudioUrl(url);
      setPlaybackTime(0);
      setPlaybackStatus("idle");
      setIsPodcastPlayerOpen(true);
    } catch (error: any) {
      setNeuralAudioError(error.message || "Neural TTS is not available.");
      const availabilityKey = audioProvider === "elevenlabs" ? "elevenLabsAvailable" : audioProvider === "chatterbox" ? "chatterboxAvailable" : "piperAvailable";
      setAudioEngine((current) => current ? { ...current, [availabilityKey]: false } : current);
    } finally {
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
          onPlay={() => setPlaybackStatus("playing")}
          onPause={() => setPlaybackStatus("paused")}
          onEnded={() => setPlaybackStatus("idle")}
          onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            durationRef.current = event.currentTarget.duration;
            setDuration(event.currentTarget.duration);
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
