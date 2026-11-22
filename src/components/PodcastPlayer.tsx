import { ChevronLeft, ChevronDown, X } from "lucide-react";
import { type PodcastMetadata, type AudioProvider, type AudioEngineStatus } from "../types";
import { getKokoroVoices } from "../voice-options";

function formatTime(seconds: number) {
  const total = Math.floor(Math.max(0, seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function PodcastPlayer({ data, currentLineIndex, onSeek, audioEngine, provider, voiceId, voiceOverrides, loading, error, onProviderChange, onVoiceChange, onHostVoiceChange, onGenerateAudio, onClose }: {
  data: PodcastMetadata;
  currentLineIndex: number;
  onSeek: (seconds: number) => void;
  audioEngine: AudioEngineStatus | null;
  provider: AudioProvider;
  voiceId: string;
  voiceOverrides: Record<string, string>;
  loading: boolean;
  error: string | null;
  onProviderChange: (provider: AudioProvider) => void;
  onVoiceChange: (voice: string) => void;
  onHostVoiceChange: (host: string, voice: string) => void;
  onGenerateAudio: () => void;
  onClose: () => void;
}) {
  const voices = getKokoroVoices(data.language);
  const choices = [
    { id: "kokoro", label: "Kokoro · Natural cast", available: !!audioEngine?.kokoroAvailable && !!voices.length },
    { id: "chatterbox", label: "Chatterbox HD", available: !!audioEngine?.chatterboxAvailable },
    { id: "piper", label: "Piper Cast", available: !!audioEngine?.piperAvailable },
    { id: "browser", label: "Browser voices", available: true },
  ] as const;
  const available = provider === "elevenlabs" ? audioEngine?.elevenLabsAvailable : choices.find(({ id }) => id === provider)?.available;
  const singleVoiceOptions = provider === "piper" ? audioEngine?.voices : provider === "elevenlabs" ? audioEngine?.elevenLabsVoices : undefined;
  const selectClass = "min-h-10 w-full rounded-lg border border-white/15 bg-[#201a2b] px-3 text-sm text-white";
  const backClass = "inline-flex h-10 items-center gap-1 rounded-full bg-red-600 px-3 text-sm font-semibold hover:bg-red-500";

  return (
    <div role="region" aria-label="Episode details" className="fixed inset-x-0 top-0 bottom-[var(--app-dock-height)] z-40 overflow-y-auto bg-[#100e18] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#100e18]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button onClick={onClose} className={backClass}><ChevronLeft className="size-4" /> Back</button>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-red-600 hover:bg-red-500" aria-label="Close episode details"><X className="size-5" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-4 pb-10 pt-6 sm:px-6">
        <div className="flex items-center gap-4">
          {data.coverArt && <img src={data.coverArt.dataUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover sm:size-20" />}
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">{data.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{data.tagline}</p>
          </div>
        </div>
        <details className="group border-y border-white/10 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-200">
            Audio settings <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid max-w-2xl gap-3">
            <label className="grid gap-1.5 text-sm text-zinc-300">
              Voice engine
              <select className={selectClass} value={provider} onChange={(event) => onProviderChange(event.target.value as AudioProvider)} disabled={loading}>
                {choices.map(({ id, label, available }) => (
                  <option key={id} value={id} disabled={!available}>{label}{available ? "" : " · unavailable"}</option>
                ))}
                {audioEngine?.elevenLabsAvailable && <option value="elevenlabs">ElevenLabs · hosted</option>}
              </select>
            </label>
            {provider === "kokoro" && <div className="grid gap-2 sm:grid-cols-2">
              {data.speakers.map((speaker) => <label key={speaker.name} className="grid gap-1.5 text-sm text-zinc-300">
                {speaker.name}
                <select className={selectClass} value={voiceOverrides[speaker.name] || ""} disabled={loading} onChange={(event) => onHostVoiceChange(speaker.name, event.target.value)} aria-label={`Voice for ${speaker.name}`}>
                  <option value="">Automatic cast voice</option>
                  {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
                </select>
              </label>)}
            </div>}
            {singleVoiceOptions && singleVoiceOptions.length > 0 && <label className="grid gap-1.5 text-sm text-zinc-300">
              {provider === "piper" ? "Lead host voice" : "Voice"}
              <select className={selectClass} value={voiceId} disabled={loading} onChange={(event) => onVoiceChange(event.target.value)}>
                <option value="">Default voice</option>
                {singleVoiceOptions.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
              </select>
            </label>}
            {provider === "kokoro" && <p className="text-xs text-zinc-400">Runs locally. First use downloads the voice model.</p>}
            {error && <p role="status" className="text-sm text-red-300">{error}</p>}
            {provider !== "browser" && <button onClick={onGenerateAudio} disabled={!available || loading} className="w-fit rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold hover:bg-brand-500 disabled:opacity-40">{loading ? "Preparing audio…" : "Generate full audio"}</button>}
          </div>
        </details>
        {data.chapters.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Chapters">
          {data.chapters.map((chapter, index) => <button key={index} onClick={() => onSeek(chapter.startSeconds)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10">{chapter.title}</button>)}
        </div>}
        <section aria-label="Transcript">
          <h3 className="mb-2 font-display text-lg font-semibold">Transcript</h3>
          <ol className="divide-y divide-white/10">
            {data.script.map((line, index) => (
              <li key={line.id}>
                <button onClick={() => onSeek(line.estimatedStartSeconds)} aria-current={index === currentLineIndex ? "true" : undefined} className={`grid w-full grid-cols-[2.75rem_1fr] gap-2 rounded-lg px-2 py-3 text-left hover:bg-white/5 sm:gap-4 ${index === currentLineIndex ? "bg-brand-500/10" : ""}`}>
                  <span className="pt-0.5 text-xs tabular-nums text-zinc-400">{formatTime(line.estimatedStartSeconds)}</span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{line.speakerName}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-zinc-300">{line.dialogue}</span>
                    {line.soundEffect && <span className="mt-1 block text-xs text-zinc-500">{line.soundEffect}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
