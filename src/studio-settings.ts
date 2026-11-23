export const DEFAULT_STUDIO_SETTINGS = { volume: 100, defaultSpeed: 1, reducedMotion: false };
export type StudioSettings = typeof DEFAULT_STUDIO_SETTINGS;
export const STUDIO_SETTINGS_KEY = "echo.studioSettings.v1";

export function loadStudioSettings(): StudioSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STUDIO_SETTINGS_KEY) || "{}");
    return {
      volume: Number.isFinite(saved.volume) ? Math.min(100, Math.max(0, saved.volume)) : 100,
      defaultSpeed: [0.75, 1, 1.25, 1.5, 2].includes(saved.defaultSpeed) ? saved.defaultSpeed : 1,
      reducedMotion: saved.reducedMotion === true,
    };
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS };
  }
}
