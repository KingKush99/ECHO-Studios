import { useEffect, useRef, useState } from "react";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { DEFAULT_STUDIO_SETTINGS, loadStudioSettings, STUDIO_SETTINGS_KEY, type StudioSettings } from "../studio-settings";

const groups = [
  { name: "Playback", rows: [
    { key: "volume", label: "Volume", help: "Set the volume for generated episodes, live rooms, and voice samples." },
    { key: "defaultSpeed", label: "Default speed", help: "Choose the playback speed for new episodes. The bottom player can change it for the current episode." },
  ] },
  { name: "Display", rows: [
    { key: "reducedMotion", label: "Reduce motion", help: "Reduce animated transitions and effects across Echo Studios." },
  ] },
] as const;

export function SettingsModal({ onClose, settings, onChange }: {
  onClose: () => void;
  settings?: StudioSettings;
  onChange?: (settings: StudioSettings) => void;
}) {
  const [localSettings, setLocalSettings] = useState(loadStudioSettings);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState<keyof StudioSettings>("volume");
  const closeRef = useRef<HTMLButtonElement>(null);
  const value = settings || localSettings;
  const group = groups[active];
  const current = group.rows.find(({ key }) => key === focused) || group.rows[0];

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  function save(next: StudioSettings) {
    if (onChange) onChange(next);
    else {
      setLocalSettings(next);
      try { window.localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(next)); } catch { /* Storage is optional. */ }
    }
  }

  return (
    <section role="dialog" aria-modal="true" aria-label="Settings" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} className="fixed inset-0 z-[80] overflow-y-auto bg-[#100e18] text-zinc-100">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-10">
        <h2 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight"><SlidersHorizontal className="size-5 text-brand-300" /> Settings</h2>
        <button ref={closeRef} onClick={onClose} aria-label="Close settings" className="rounded-lg p-2 hover:bg-white/10"><X className="size-5" /></button>
      </header>
      <nav aria-label="Settings categories" className="flex overflow-x-auto border-b border-white/10 px-3 sm:px-8">
        {groups.map(({ name, rows }, index) => (
          <button key={name} onClick={() => { setActive(index); setFocused(rows[0].key); }} aria-pressed={active === index} className={`border-b-2 px-4 py-4 text-sm font-semibold ${active === index ? "border-brand-300 text-brand-300" : "border-transparent text-zinc-400 hover:text-white"}`}>{name}</button>
        ))}
      </nav>
      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_250px]">
        <div>
          {group.rows.map(({ key, label }) => (
            <label key={key} onFocus={() => setFocused(key)} onPointerEnter={() => setFocused(key)} className={`flex min-h-14 items-center justify-between gap-4 border-b border-white/10 px-3 text-sm focus-within:bg-white/5 ${current.key === key ? "bg-white/5 text-brand-300" : ""}`}>
              <span>{label}</span>
              {key === "volume" ? (
                <span className="flex items-center gap-2"><input aria-label="Volume" type="range" min={0} max={100} value={value.volume} onChange={(event) => save({ ...value, volume: Number(event.target.value) })} className="w-24 accent-brand-300 sm:w-36" /><span className="w-10 text-right tabular-nums">{value.volume}%</span></span>
              ) : key === "defaultSpeed" ? (
                <select value={value.defaultSpeed} onChange={(event) => save({ ...value, defaultSpeed: Number(event.target.value) })} className="rounded-lg border border-white/15 bg-[#1d1929] px-3 py-2 text-sm">{[0.75, 1, 1.25, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select>
              ) : (
                <input type="checkbox" checked={value.reducedMotion} onChange={(event) => save({ ...value, reducedMotion: event.target.checked })} className="size-5 accent-brand-300" />
              )}
            </label>
          ))}
          <button onClick={() => save({ ...DEFAULT_STUDIO_SETTINGS })} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10"><RotateCcw className="size-4" /> Restore defaults</button>
        </div>
        <aside aria-live="polite" className="self-start border-l border-white/10 px-4 py-2">
          <h3 className="text-sm font-semibold">{current.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{current.help}</p>
        </aside>
      </div>
    </section>
  );
}
