import { Loader2, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number) {
  const total = Math.floor(Math.max(0, seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function PlaybackBar({ title, cover, time, duration, speed, playing, loading, error, onToggle, onSeek, onSpeed, onClose, onDetails }: {
  title: string;
  cover?: string;
  time: number;
  duration: number;
  speed: number;
  playing: boolean;
  loading: boolean;
  error: string | null;
  onToggle: () => void;
  onSeek: (time: number) => void;
  onSpeed: (speed: number) => void;
  onClose: () => void;
  onDetails: () => void;
}) {
  const canSeek = Number.isFinite(duration) && duration > 0 && !loading;
  const speedOptions = speeds.includes(speed) ? speeds : [...speeds, speed].sort((a, b) => a - b);
  const control = "grid size-9 shrink-0 place-items-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white disabled:opacity-40";

  return (
    <section aria-label="Podcast playback" className="border-b border-white/10 bg-[#1d1929]">
      <div className="mx-auto grid h-[76px] max-w-6xl grid-cols-[minmax(0,1fr)_auto] grid-rows-[1fr_1rem] items-center gap-x-2 px-3 py-1.5 sm:gap-x-5 sm:px-6">
        <button onClick={onDetails} className="flex min-w-0 items-center gap-2 text-left hover:text-brand-300" aria-label={`Open episode details for ${title}`}>
          {cover && <img src={cover} alt="" className="hidden size-9 shrink-0 rounded-md object-cover sm:block" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{title}</span>
            {(error || loading) && <span role="status" title={error || undefined} className={`block truncate text-xs ${error ? "text-red-300" : "text-zinc-400"}`}>{error || "Preparing audio…"}</span>}
          </span>
        </button>
        <div className="flex items-center gap-0.5 sm:gap-2">
          <button className={control} disabled={!canSeek} onClick={() => onSeek(time - 15)} aria-label="Back 15 seconds" title="Back 15 seconds">
            <RotateCcw aria-hidden="true" className="size-4" />
          </button>
          <button className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-60" onClick={onToggle} aria-label={playing ? "Pause podcast" : "Play podcast"} disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : playing ? <Pause aria-hidden="true" className="size-4" fill="currentColor" /> : <Play aria-hidden="true" className="size-4 translate-x-px" fill="currentColor" />}
          </button>
          <button className={control} disabled={!canSeek} onClick={() => onSeek(time + 15)} aria-label="Forward 15 seconds" title="Forward 15 seconds">
            <RotateCw aria-hidden="true" className="size-4" />
          </button>
          <select aria-label="Playback speed" value={speed} onChange={(event) => onSpeed(Number(event.target.value))} className="h-9 w-[3.5rem] shrink-0 rounded-lg bg-[#1d1929] text-center text-xs font-semibold text-zinc-200 hover:bg-white/10 sm:w-16">
            {speedOptions.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
          </select>
          <button className={`${control} hover:text-red-300`} onClick={onClose} aria-label="Stop and close playback" title="Stop and close playback"><X aria-hidden="true" className="size-4" /></button>
        </div>
        <div className="col-span-2 flex items-center gap-2 text-[10px] tabular-nums text-zinc-400">
          <span>{formatTime(time)}</span>
          <input type="range" min={0} max={Math.max(duration || 0, 1)} step={0.1} value={Math.min(time, duration || 0)} onChange={(event) => onSeek(Number(event.target.value))} disabled={!canSeek} aria-label="Podcast timeline" className="h-2 min-w-0 flex-1 accent-brand-400 disabled:opacity-40" />
          <span>{duration ? formatTime(duration) : "–:––"}</span>
        </div>
      </div>
    </section>
  );
}
