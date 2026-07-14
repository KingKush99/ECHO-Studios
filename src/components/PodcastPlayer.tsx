import { ChevronLeft, Gauge, Pause, Play, Radio, RotateCcw, RotateCw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { PodcastMetadata } from "../types";

type SpeechStatus = "idle" | "playing" | "paused";
type VoiceMode = "narrator" | "cast";
type VoiceOption = {
  name: string;
  lang: string;
  voiceURI: string;
  score: number;
};
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

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safeSeconds / 60)}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
}

function formatSpeed(speed: number) {
  return `${Number.isInteger(speed) ? speed.toFixed(0) : speed.toFixed(2).replace(/0$/, "")}x`;
}

export function PodcastPlayer({
  data,
  playbackStatus,
  playbackError,
  speechSupported,
  onPlayToggle,
  onSeekRelative,
  onSeekTo,
  playbackRate,
  onPlaybackRateChange,
  currentTime,
  duration,
  currentLineIndex,
  voices,
  preferredVoiceURI,
  voiceMode,
  onVoiceChange,
  onVoiceModeChange,
  audioEngine,
  audioProvider,
  selectedNeuralVoice,
  selectedElevenVoice,
  neuralAudioAvailable,
  isGeneratingNeuralAudio,
  neuralAudioError,
  onAudioProviderChange,
  onNeuralVoiceChange,
  onElevenVoiceChange,
  onGenerateNeuralPreview,
  onClose,
}: {
  data: PodcastMetadata | null;
  playbackStatus: SpeechStatus;
  playbackError: string | null;
  speechSupported: boolean;
  onPlayToggle: () => void;
  onSeekRelative: (seconds: number) => void;
  onSeekTo: (seconds: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (speed: number) => void;
  currentTime: number;
  duration: number;
  currentLineIndex: number;
  voices: VoiceOption[];
  preferredVoiceURI: string;
  voiceMode: VoiceMode;
  onVoiceChange: (voiceURI: string) => void;
  onVoiceModeChange: (mode: VoiceMode) => void;
  audioEngine: AudioEngineStatus | null;
  audioProvider: AudioProvider;
  selectedNeuralVoice: string;
  selectedElevenVoice: string;
  neuralAudioAvailable: boolean;
  isGeneratingNeuralAudio: boolean;
  neuralAudioError: string | null;
  onAudioProviderChange: (provider: AudioProvider) => void;
  onNeuralVoiceChange: (voiceId: string) => void;
  onElevenVoiceChange: (voiceId: string) => void;
  onGenerateNeuralPreview: () => void;
  onClose: () => void;
}) {
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!data) return;
    const activeLineElement = lineRefs.current[currentLineIndex];
    if (!activeLineElement) return;

    const scrollTimer = window.setTimeout(() => {
      activeLineElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 40);

    return () => window.clearTimeout(scrollTimer);
  }, [data, currentLineIndex]);

  if (!data) return null;

  const isPlaying = playbackStatus === "playing";
  const piperAvailable = !!audioEngine?.piperAvailable;
  const chatterboxAvailable = !!audioEngine?.chatterboxAvailable;
  const elevenLabsAvailable = !!audioEngine?.elevenLabsAvailable;
  const voiceReference = data.voiceReferences?.find((reference) => reference.consentConfirmed && reference.dataUrl) || data.voiceReferences?.[0];
  const hasVoiceReference = !!voiceReference?.consentConfirmed && !!voiceReference.dataUrl;
  const voiceReferenceName = voiceReference?.clonedVoiceName || voiceReference?.name || "Uploaded voice reference";
  const canGenerateStudioAudio = audioProvider === "elevenlabs" ? elevenLabsAvailable : audioProvider === "chatterbox" ? chatterboxAvailable : piperAvailable;
  const playDisabled = isGeneratingNeuralAudio || (!speechSupported && !neuralAudioAvailable && !canGenerateStudioAudio);
  const rankedVoices = [...voices].sort((a, b) => b.score - a.score).slice(0, 12);
  const activeLine = data.script[currentLineIndex] || data.script[0];
  const currentSpeaker = activeLine?.speakerName || data.speakers[0]?.name || "Host";
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const speedSliderValue = playbackRate <= 1 ? (playbackRate - 0.5) * 2 : playbackRate;
  const speedPercent = Math.min(100, Math.max(0, (speedSliderValue / 2) * 100));
  const normalSpeedPercent = 50;
  const statusLabel = isGeneratingNeuralAudio
    ? "PREPARING AUDIO..."
    : playbackError
    ? "PLAYBACK ISSUE"
    : isPlaying
      ? "PLAYING"
      : playbackStatus === "paused"
        ? "PAUSED"
        : neuralAudioAvailable
          ? "AUDIO READY"
          : canGenerateStudioAudio
            ? "PLAYBACK READY"
          : speechSupported
            ? "BROWSER SPEECH READY"
            : "SPEECH UNSUPPORTED";

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#050108] text-white fade-in">
      <div className="sticky top-0 z-[75] border-b border-white/10 bg-[#210014]/95 px-4 py-5 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-[140px_1fr_44px] md:items-center">
          <button
            onClick={onClose}
            className="inline-flex h-12 w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 text-sm font-bold text-white transition-colors hover:bg-white/15"
            aria-label="Back to create page"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>

          <div className="flex min-w-0 items-center gap-4 rounded-3xl border border-white/10 bg-black/20 p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#14142b]">
              {data.coverArt ? (
                <img src={data.coverArt.dataUrl} alt={`${data.title} cover`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#111229] text-lg font-black text-brand-200">
                  {data.title.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black uppercase text-white sm:text-2xl">{data.title}</h2>
              <div className="mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                <Radio className="h-4 w-4 text-blue-400" />
                {currentSpeaker}
                {data.researchSources && data.researchSources.length > 0 && (
                  <span className="ml-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] tracking-[0.16em] text-emerald-200">
                    {data.researchSources.length} sources
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute right-4 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_18px_rgba(220,38,38,0.55)] transition-colors hover:bg-red-500 md:static"
            aria-label="Close podcast player"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-10 pb-80 md:grid-cols-[220px_1fr] md:px-8 md:py-16">
        <aside className="hidden md:block">
          <div className="sticky top-36 flex h-[360px] items-start gap-10">
            <div className="relative h-72 w-2 overflow-hidden rounded-full bg-white/10">
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-400 via-blue-500 to-indigo-400" style={{ height: `${Math.max(8, progress)}%` }} />
            </div>
            <div className="pt-1 font-mono text-xl font-black tracking-[0.15em] text-blue-400">
              {formatTime(currentTime)}
            </div>
          </div>
        </aside>

        <section className="space-y-12">
          {data.script.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isPast = line.estimatedStartSeconds < currentTime && !isActive;
            return (
              <button
                key={line.id}
                ref={(element) => {
                  lineRefs.current[index] = element;
                }}
                onClick={() => onSeekRelative(line.estimatedStartSeconds - currentTime)}
                className="grid w-full grid-cols-[70px_1fr] gap-5 text-left md:grid-cols-[120px_1fr]"
                aria-label={`Jump to ${line.speakerName} at ${formatTime(line.estimatedStartSeconds)}`}
              >
                <div className={`pt-1 font-mono text-sm font-black tracking-[0.16em] md:text-xl ${isActive ? "text-blue-400" : isPast ? "text-blue-300/35" : "text-white/25"}`}>
                  {formatTime(line.estimatedStartSeconds)}
                </div>
                <div className="min-w-0">
                  <div className={`mb-4 text-xs font-black uppercase tracking-[0.35em] ${isActive ? "text-emerald-400" : "text-white/35"}`}>
                    {line.speakerName}
                  </div>
                  <p className={`${isActive ? "text-2xl font-black leading-tight text-white md:text-4xl" : "text-xl font-bold leading-relaxed text-white/35 md:text-3xl"} transition-colors`}>
                    {line.dialogue}
                  </p>
                  {line.soundEffect && (
                    <div className={`mt-4 text-xs font-semibold italic ${isActive ? "text-amber-200" : "text-white/25"}`}>
                      {line.soundEffect}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </section>

        {data.researchSources && data.researchSources.length > 0 && (
          <section className="md:col-start-2 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-5">
            <div className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-emerald-200">Research Used</div>
            <div className="grid gap-3">
              {data.researchSources.map((source) => (
                <a
                  key={`${source.title}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-black/20 p-3 transition-colors hover:bg-white/5"
                >
                  <div className="text-sm font-bold text-white">{source.title}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/70">{source.source}</div>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">{source.summary}</p>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-[80] border-t border-white/10 bg-[#080812]/95 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/30 p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-sm font-black uppercase tracking-[0.35em] text-white">Radio Podcast</span>
              </div>
              <div className={`text-xs font-mono font-bold ${playbackError || (!speechSupported && !canGenerateStudioAudio && !neuralAudioAvailable) ? "text-red-300" : "text-brand-200"}`}>
                {playbackError || statusLabel}
              </div>
            </div>

            <div className="grid gap-2">
              <input
                type="range"
                min="0"
                max={Math.max(1, Math.round(duration))}
                step="1"
                value={Math.min(Math.max(0, Math.round(currentTime)), Math.max(1, Math.round(duration)))}
                onChange={(event) => onSeekTo(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-blue-400"
                aria-label="Podcast timeline"
              />
              <div className="flex justify-between font-mono text-[10px] font-bold text-white/35">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center justify-center gap-3 sm:justify-start">
                <button
                  className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs font-black text-white transition-colors hover:bg-white/10"
                  onClick={() => onSeekRelative(-30)}
                  aria-label="Back 30 seconds"
                >
                  <RotateCcw className="h-9 w-9" />
                  <span className="absolute text-[11px] font-black">30</span>
                </button>
                <button
                  onClick={onPlayToggle}
                  disabled={playDisabled}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_0_22px_rgba(99,102,241,0.45)] transition-all hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-brand-900 disabled:opacity-50"
                  aria-label={isPlaying ? "Pause podcast" : "Play podcast"}
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-0.5" />}
                </button>
                <button
                  className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs font-black text-white transition-colors hover:bg-white/10"
                  onClick={() => onSeekRelative(30)}
                  aria-label="Forward 30 seconds"
                >
                  <RotateCw className="h-9 w-9" />
                  <span className="absolute text-[11px] font-black">30</span>
                </button>
                <div className="ml-1 font-mono text-xs font-bold text-white/50">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="grid min-w-0 flex-1 gap-2 lg:max-w-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                  <Gauge className="h-4 w-4" />
                  Speed
                  </div>
                </div>
                <div className="relative pb-6 pt-5">
                  <div
                    className="pointer-events-none absolute top-0 -translate-x-1/2 font-mono text-sm font-black text-white"
                    style={{ left: `${speedPercent}%` }}
                  >
                    {formatSpeed(playbackRate)}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={speedSliderValue}
                    onChange={(event) => {
                      const sliderValue = Number(event.target.value);
                      onPlaybackRateChange(sliderValue <= 1 ? 0.5 + sliderValue / 2 : sliderValue);
                    }}
                    className="h-2 w-full cursor-pointer accent-brand-400"
                    aria-label="Playback speed"
                    aria-valuetext={formatSpeed(playbackRate)}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 font-mono text-[10px] font-bold text-white/35">
                    <span className="absolute left-0">0.5x</span>
                    <span className="absolute -translate-x-1/2" style={{ left: `${normalSpeedPercent}%` }}>1x</span>
                    <span className="absolute right-0">2x</span>
                  </div>
                </div>
              </div>
            </div>

            <details className="border-t border-white/10 pt-4">
              <summary className="cursor-pointer select-none text-xs font-black uppercase tracking-[0.25em] text-white/55">
                Audio Settings
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  <button
                    onClick={() => onAudioProviderChange("elevenlabs")}
                    className={`px-3 py-2 text-xs font-semibold transition-colors ${audioProvider === "elevenlabs" ? "bg-emerald-500/30 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Studio Quality
                  </button>
                  <button
                    onClick={() => onAudioProviderChange("chatterbox")}
                    className={`border-l border-white/10 px-3 py-2 text-xs font-semibold transition-colors ${audioProvider === "chatterbox" ? "bg-pink-500/30 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Chatterbox HD
                  </button>
                  <button
                    onClick={() => onAudioProviderChange("piper")}
                    className={`border-l border-white/10 px-3 py-2 text-xs font-semibold transition-colors ${audioProvider === "piper" ? "bg-brand-500/30 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    Piper Cast
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                    <div className={`rounded-xl border px-3 py-2 text-xs ${canGenerateStudioAudio ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}>
                      {audioProvider === "elevenlabs"
                        ? elevenLabsAvailable
                          ? neuralAudioAvailable
                            ? "ElevenLabs-quality audio loaded. Play now uses that studio sample."
                            : "ElevenLabs is configured. Press Play or Generate HD Audio for the highest-quality preview."
                          : "For ElevenLabs quality, add ELEVENLABS_API_KEY to .env and restart the app."
                        : audioProvider === "chatterbox"
                          ? chatterboxAvailable
                            ? neuralAudioAvailable
                              ? "Chatterbox HD audio loaded. Play now uses the natural local model."
                              : hasVoiceReference
                                ? `Chatterbox is ready to generate a no-key cast sample using ${voiceReferenceName}.`
                                : "Chatterbox is ready with its built-in natural voice. Add voice references in Create for custom cast voices."
                            : `Install Chatterbox HD with ${audioEngine?.chatterboxInstallCommand || ".\\install-chatterbox.ps1"}.`
                          : piperAvailable
                            ? neuralAudioAvailable
                              ? "Piper Cast audio loaded. Play now uses stitched local voices instead of browser speech."
                              : "Piper Cast is installed. Press Play or Generate HD Audio to synthesize separate local voices for the hosts."
                            : `Browser voices are robotic here. Install Piper with ${audioEngine?.installCommand || ".\\install-piper.ps1"} or add ELEVENLABS_API_KEY.`}
                      {audioProvider === "elevenlabs" && <span className="mt-1 block text-emerald-100/80">This is the path that can match ElevenLabs quality.</span>}
                      {audioProvider === "chatterbox" && <span className="mt-1 block text-pink-100/80">This uses a local open-source model. No API key is required, but generation can be slow.</span>}
                      {neuralAudioError && <span className="mt-1 block text-red-100">{neuralAudioError}</span>}
                    </div>

                    {audioProvider === "elevenlabs" ? (
                      <select
                        value={selectedElevenVoice}
                        onChange={(event) => onElevenVoiceChange(event.target.value)}
                        disabled={!elevenLabsAvailable}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none disabled:opacity-50"
                        aria-label="ElevenLabs voice"
                      >
                        {(audioEngine?.elevenLabsVoices || []).length === 0 && (
                          <option value={audioEngine?.elevenLabsDefaultVoiceId || ""}>Default ElevenLabs voice</option>
                        )}
                        {(audioEngine?.elevenLabsVoices || []).map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}
                          </option>
                        ))}
                      </select>
                    ) : audioProvider === "chatterbox" ? (
                      <div className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white">
                        <span className="block truncate">{hasVoiceReference ? voiceReferenceName : "Built-in natural voice"}</span>
                        <span className="mt-1 block text-[10px] text-gray-500">{hasVoiceReference ? "Reference-guided local cast" : "No voice upload required"}</span>
                      </div>
                    ) : (
                      <select
                        value={selectedNeuralVoice}
                        onChange={(event) => onNeuralVoiceChange(event.target.value)}
                        disabled={!piperAvailable}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none disabled:opacity-50"
                        aria-label="Piper TTS voice"
                      >
                        {(audioEngine?.voices || []).map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    onClick={onGenerateNeuralPreview}
                    disabled={!canGenerateStudioAudio || isGeneratingNeuralAudio}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGeneratingNeuralAudio ? "Generating HD..." : neuralAudioAvailable ? "Regenerate HD Audio" : "Generate HD Audio"}
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
