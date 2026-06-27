import { FastForward, Pause, Play, Rewind, X } from "lucide-react";
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

export function PodcastPlayer({
  data,
  playbackStatus,
  playbackError,
  speechSupported,
  onPlayToggle,
  onSeekRelative,
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
  if (!data) return null;

  const isPlaying = playbackStatus === "playing";
  const statusLabel = !speechSupported
    ? "SPEECH UNSUPPORTED"
    : playbackError
      ? "PLAYBACK ISSUE"
      : isPlaying
        ? `PLAYING LINE ${currentLineIndex + 1}`
        : playbackStatus === "paused"
          ? "PAUSED"
          : "NATURAL SPEECH READY";

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const rankedVoices = [...voices].sort((a, b) => b.score - a.score).slice(0, 12);
  const piperAvailable = !!audioEngine?.piperAvailable;
  const chatterboxAvailable = !!audioEngine?.chatterboxAvailable;
  const elevenLabsAvailable = !!audioEngine?.elevenLabsAvailable;
  const hasVoiceReference = !!data.voiceReferences?.some((reference) => reference.consentConfirmed && reference.dataUrl);
  const voiceReferenceName = data.voiceReferences?.[0]?.clonedVoiceName || data.voiceReferences?.[0]?.name || "Uploaded voice reference";
  const canGenerateStudioAudio = audioProvider === "elevenlabs" ? elevenLabsAvailable : audioProvider === "chatterbox" ? chatterboxAvailable && hasVoiceReference : piperAvailable;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 md:px-0 pointer-events-none fade-in">
      <div className="max-w-4xl mx-auto rounded-3xl bg-[#111229]/95 backdrop-blur-xl border border-brand-500/30 p-4 sm:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col gap-4 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
          <div className="h-full bg-brand-500" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_18px_rgba(220,38,38,0.55)] transition-colors hover:bg-red-500"
          aria-label="Close podcast player"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col sm:flex-row items-center gap-6 pr-8">
          <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
            <button
              onClick={onPlayToggle}
              disabled={!speechSupported}
              className="w-14 h-14 shrink-0 rounded-full bg-brand-500 hover:bg-brand-400 disabled:bg-brand-900 disabled:opacity-50 text-white flex items-center justify-center pl-1 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all"
              aria-label={isPlaying ? "Pause podcast" : "Play podcast"}
            >
              {isPlaying ? <Pause className="w-6 h-6 ml-[-4px]" /> : <Play className="w-6 h-6" />}
            </button>

            <div className="flex-1 min-w-0">
              <div className={`text-xs font-mono mb-1 truncate ${playbackError || !speechSupported ? "text-red-400" : "text-brand-300"}`}>
                {playbackError || statusLabel}
              </div>
              <h3 className="font-bold text-white text-sm sm:text-base truncate">{data.title}</h3>
              <div className="text-[10px] text-gray-500 font-mono mt-1">
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, "0")} / {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, "0")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:ml-auto">
            <button className="text-gray-400 hover:text-white transition-colors p-2" onClick={() => onSeekRelative(-15)} aria-label="Back 15 seconds">
              <Rewind className="w-5 h-5" />
            </button>
            <button className="text-gray-400 hover:text-white transition-colors p-2" onClick={() => onSeekRelative(15)} aria-label="Forward 15 seconds">
              <FastForward className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-3 w-full border-t border-white/5 pt-4">
          <div className="grid grid-cols-2 rounded-xl border border-white/10 overflow-hidden bg-black/30">
            <button
              onClick={() => onVoiceModeChange("narrator")}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${voiceMode === "narrator" ? "bg-brand-500/30 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Smooth
            </button>
            <button
              onClick={() => onVoiceModeChange("cast")}
              className={`px-3 py-2 text-xs font-semibold transition-colors border-l border-white/10 ${voiceMode === "cast" ? "bg-brand-500/30 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Cast
            </button>
          </div>

          <select
            value={preferredVoiceURI}
            onChange={(event) => onVoiceChange(event.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none"
            aria-label="Preferred voice"
          >
            <option value="">Auto best local voice</option>
            {rankedVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 w-full border-t border-white/5 pt-4">
          <div className="grid grid-cols-3 rounded-xl border border-white/10 overflow-hidden bg-black/30">
            <button
              onClick={() => onAudioProviderChange("elevenlabs")}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${audioProvider === "elevenlabs" ? "bg-emerald-500/30 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Studio Quality
            </button>
            <button
              onClick={() => onAudioProviderChange("chatterbox")}
              className={`px-3 py-2 text-xs font-semibold transition-colors border-l border-white/10 ${audioProvider === "chatterbox" ? "bg-pink-500/30 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Local Clone
            </button>
            <button
              onClick={() => onAudioProviderChange("piper")}
              className={`px-3 py-2 text-xs font-semibold transition-colors border-l border-white/10 ${audioProvider === "piper" ? "bg-brand-500/30 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Free Local
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
              <div className={`rounded-xl border px-3 py-2 text-xs ${canGenerateStudioAudio ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200" : "bg-red-500/10 border-red-500/20 text-red-200"}`}>
                {audioProvider === "elevenlabs"
                  ? elevenLabsAvailable
                    ? neuralAudioAvailable
                      ? "ElevenLabs-quality audio sample loaded. Play now uses that studio sample."
                      : "ElevenLabs is configured. Generate a studio-quality sample."
                    : "For ElevenLabs quality, add ELEVENLABS_API_KEY to .env and restart the app."
                  : audioProvider === "chatterbox"
                    ? !hasVoiceReference
                      ? "Upload a voice reference in Create before using Local Clone."
                      : chatterboxAvailable
                        ? neuralAudioAvailable
                          ? "Local cloned audio sample loaded. Play now uses that sample."
                          : `Chatterbox is installed. Generate a no-key cloned sample from ${voiceReferenceName}.`
                        : `Install local voice cloning with ${audioEngine?.chatterboxInstallCommand || ".\\install-chatterbox.ps1"}.`
                  : piperAvailable
                    ? neuralAudioAvailable
                      ? "Piper neural audio sample loaded. Play now uses that sample."
                      : "Piper neural TTS is installed. Generate a non-browser voice sample."
                    : `Browser voices are low quality here. Install Piper with ${audioEngine?.installCommand || ".\\install-piper.ps1"}.`}
                {audioProvider === "elevenlabs" && <span className="block mt-1 text-emerald-100/80">This uses paid/limited ElevenLabs API credits and is the only path here that can match ElevenLabs quality.</span>}
                {audioProvider === "chatterbox" && <span className="block mt-1 text-pink-100/80">This uses a local open-source model. No API key is required, but generation can be slow.</span>}
              {neuralAudioError && <span className="block mt-1 text-red-100">{neuralAudioError}</span>}
              </div>
              {audioProvider === "elevenlabs" ? (
                <select
                  value={selectedElevenVoice}
                  onChange={(event) => onElevenVoiceChange(event.target.value)}
                  disabled={!elevenLabsAvailable}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none disabled:opacity-50"
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
                  <span className="block truncate">{voiceReferenceName}</span>
                  <span className="mt-1 block text-[10px] text-gray-500">Reference-guided local clone</span>
                </div>
              ) : (
                <select
                  value={selectedNeuralVoice}
                  onChange={(event) => onNeuralVoiceChange(event.target.value)}
                  disabled={!piperAvailable}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none disabled:opacity-50"
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
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-4 py-2 text-sm font-bold text-white whitespace-nowrap"
            >
              {isGeneratingNeuralAudio ? "Generating..." : neuralAudioAvailable ? "Regenerate Audio Sample" : "Generate Audio Sample"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
