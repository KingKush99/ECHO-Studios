const englishVoices = [
  { id: "af_heart", label: "Heart · US", gender: "female" },
  { id: "am_michael", label: "Michael · US", gender: "male" },
  { id: "af_bella", label: "Bella · US", gender: "female" },
  { id: "bm_george", label: "George · UK", gender: "male" },
  { id: "bf_emma", label: "Emma · UK", gender: "female" },
  { id: "am_fenrir", label: "Fenrir · US", gender: "male" },
  { id: "af_nicole", label: "Nicole · US", gender: "female" },
  { id: "am_puck", label: "Puck · US", gender: "male" },
  { id: "af_sarah", label: "Sarah · US", gender: "female" },
  { id: "bm_fable", label: "Fable · UK", gender: "male" },
  { id: "bf_isabella", label: "Isabella · UK", gender: "female" },
  { id: "bm_daniel", label: "Daniel · UK", gender: "male" },
] as const;

export function getKokoroVoices(language = "English") {
  return /^en(?:glish|-|$)/i.test(language.trim()) ? englishVoices : [];
}

const languageLocales: Record<string, string> = { English: "en-US", Spanish: "es-ES", French: "fr-FR", German: "de-DE", Japanese: "ja-JP" };

export function getSpeechLocale(language = "English") {
  return languageLocales[language] || "en-US";
}
