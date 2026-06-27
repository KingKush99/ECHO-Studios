import { type ChangeEvent, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Image as ImageIcon, Loader2, Mic2, Settings2, Sparkles, UploadCloud, Wand2, X } from "lucide-react";
import { PRESET_TOPICS, HOSTER_PROFILES, AUDIO_MOODS, LANGUAGES } from "../presets";
import { PodcastCover, PodcastMetadata, PromptImage, VoiceReference } from "../types";

type CoverStyle = "signal" | "midnight" | "solar" | "editorial";
type VoiceSourceType = "cloned" | "downloaded" | "third-party";

const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 7200;

const COVER_STYLES: Array<{ id: CoverStyle; label: string }> = [
  { id: "signal", label: "Signal" },
  { id: "midnight", label: "Midnight" },
  { id: "solar", label: "Solar" },
  { id: "editorial", label: "Editorial" },
];

const VOICE_SOURCE_OPTIONS: Array<{ id: VoiceSourceType; label: string }> = [
  { id: "cloned", label: "Cloned" },
  { id: "downloaded", label: "Downloaded" },
  { id: "third-party", label: "Third-party" },
];

function clampDurationSeconds(value: number) {
  return Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS, Math.round(value || MIN_DURATION_SECONDS)));
}

function getDurationPreset(seconds: number): "short" | "medium" | "long" | "hour" {
  if (seconds >= 1800) return "hour";
  if (seconds >= 720) return "long";
  if (seconds >= 240) return "medium";
  return "short";
}

function formatDurationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const minutePart = remainingMinutes ? ` ${remainingMinutes} min` : "";
    const secondPart = remainingSeconds ? ` ${remainingSeconds} sec` : "";
    return `${hours} hr${minutePart}${secondPart}`;
  }
  return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
}

function getCoverPalette(style: CoverStyle) {
  if (style === "solar") return ["#101820", "#f2aa4c", "#e84a5f", "#2a9d8f", "#f7ede2"];
  if (style === "editorial") return ["#111827", "#f9fafb", "#d97706", "#2563eb", "#0f172a"];
  if (style === "midnight") return ["#050816", "#2dd4bf", "#8b5cf6", "#f472b6", "#e5e7eb"];
  return ["#07111f", "#38bdf8", "#6366f1", "#22c55e", "#f8fafc"];
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = nextLine;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function getWrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = nextLine;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.stroke();
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function generatePodcastCover(data: PodcastMetadata, prompt: string, style: CoverStyle): PodcastCover {
  const canvas = document.createElement("canvas");
  const size = 3000;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  const [background, primary, secondary, accent, textColor] = getCoverPalette(style);
  const hash = Array.from(`${data.title}-${prompt}-${style}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, background);
  gradient.addColorStop(0.42, style === "editorial" ? "#f8fafc" : "#101827");
  gradient.addColorStop(1, secondary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalAlpha = style === "editorial" ? 0.18 : 0.24;
  ctx.strokeStyle = style === "editorial" ? "#0f172a" : "#ffffff";
  ctx.lineWidth = 3;
  for (let x = 180; x < size; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 420, size);
    ctx.stroke();
  }
  for (let y = 160; y < size; y += 150) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + 260);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(size * 0.65, size * 0.12);
  ctx.rotate(-0.28);
  ctx.fillStyle = `${primary}dd`;
  fillRoundRect(ctx, -160, 0, 1700, 420, 74);
  ctx.fillStyle = `${accent}c9`;
  fillRoundRect(ctx, 160, 470, 1420, 240, 52);
  ctx.restore();

  ctx.save();
  ctx.translate(size * 0.12, size * 0.72);
  ctx.rotate(-0.18);
  ctx.fillStyle = style === "editorial" ? "#111827" : "rgba(255,255,255,0.08)";
  fillRoundRect(ctx, 0, 0, 1160, 260, 54);
  ctx.restore();

  const emblemX = size - 760;
  const emblemY = 840;
  ctx.save();
  ctx.strokeStyle = `${primary}cc`;
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.arc(emblemX, emblemY, 360, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `${accent}e6`;
  ctx.lineWidth = 64;
  ctx.beginPath();
  ctx.arc(emblemX, emblemY, 238, -Math.PI * 0.08, Math.PI * 1.45);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 8;
  for (let index = 0; index < 42; index += 1) {
    const angle = (Math.PI * 2 * index) / 42;
    const inner = 282 + ((hash + index * 17) % 34);
    const outer = 340 + ((hash + index * 23) % 62);
    ctx.beginPath();
    ctx.moveTo(emblemX + Math.cos(angle) * inner, emblemY + Math.sin(angle) * inner);
    ctx.lineTo(emblemX + Math.cos(angle) * outer, emblemY + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.fillStyle = style === "editorial" ? "#111827" : "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.arc(emblemX, emblemY, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = primary;
  fillRoundRect(ctx, emblemX - 52, emblemY - 122, 104, 204, 48);
  ctx.fillRect(emblemX - 12, emblemY + 52, 24, 84);
  ctx.fillRect(emblemX - 84, emblemY + 136, 168, 22);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `${primary}d9`;
  ctx.lineWidth = 12;
  for (let row = 0; row < 9; row += 1) {
    const y = 1170 + row * 82;
    ctx.beginPath();
    for (let x = 260; x <= size - 380; x += 30) {
      const wave = Math.sin((x + hash + row * 137) / 95) * (28 + row * 7);
      if (x === 260) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = style === "editorial" ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.46)";
  fillRoundRect(ctx, 230, 300, 1550, 410, 60);
  ctx.fillStyle = primary;
  fillRoundRect(ctx, 310, 390, 76, 230, 26);
  ctx.fillStyle = style === "editorial" ? "#111827" : "#ffffff";
  ctx.font = "800 98px Inter, Arial, sans-serif";
  ctx.fillText("ECHO", 440, 460);
  ctx.font = "700 58px Inter, Arial, sans-serif";
  ctx.fillStyle = style === "editorial" ? "rgba(15,23,42,0.68)" : "rgba(255,255,255,0.68)";
  ctx.fillText("STUDIOS ORIGINAL PODCAST", 440, 552);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = style === "editorial" ? "rgba(249,250,251,0.94)" : "rgba(2,6,23,0.78)";
  fillRoundRect(ctx, 230, 1610, size - 460, 980, 82);
  ctx.strokeStyle = style === "editorial" ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.18)";
  ctx.lineWidth = 8;
  strokeRoundRect(ctx, 230, 1610, size - 460, 980, 82);

  let titleSize = 235;
  let titleLines: string[] = [];
  while (titleSize >= 142) {
    ctx.font = `900 ${titleSize}px Space Grotesk, Arial, sans-serif`;
    titleLines = getWrappedLines(ctx, data.title.toUpperCase(), size - 680, 4);
    if (titleLines.length <= 4 && titleLines.every((line) => ctx.measureText(line).width <= size - 680)) break;
    titleSize -= 12;
  }

  ctx.fillStyle = style === "editorial" ? "#0f172a" : textColor;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, 340, 1835 + index * (titleSize * 1.02));
  });

  const taglineY = Math.min(2380, 1870 + titleLines.length * titleSize * 1.02 + 52);
  ctx.fillStyle = style === "editorial" ? "rgba(15,23,42,0.68)" : "rgba(255,255,255,0.75)";
  ctx.font = "600 66px Inter, Arial, sans-serif";
  drawWrappedText(ctx, data.tagline, 340, taglineY, size - 680, 86, 2);

  ctx.fillStyle = style === "editorial" ? "#111827" : "rgba(255,255,255,0.12)";
  fillRoundRect(ctx, 340, size - 360, 1090, 116, 36);
  ctx.fillStyle = accent;
  ctx.font = "800 52px Inter, Arial, sans-serif";
  ctx.fillText("PROMPT TO PODCAST", 400, size - 288);
  ctx.fillStyle = primary;
  ctx.fillRect(size - 900, size - 320, 560, 18);
  ctx.restore();

  return {
    dataUrl: canvas.toDataURL("image/png"),
    prompt,
    style,
    createdAt: new Date().toISOString(),
  };
}

export function CreateView({
  onGenerated,
  onUpdated,
  generatedPodcast,
}: {
  onGenerated: (data: PodcastMetadata) => void;
  onUpdated: (data: PodcastMetadata) => void;
  generatedPodcast?: PodcastMetadata | null;
}) {
  const [topic, setTopic] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(3600);
  const [selectedHosts, setSelectedHosts] = useState<string[]>(["maya", "marcus"]);
  const [musicMood, setMusicMood] = useState(AUDIO_MOODS[0].id);
  const [language, setLanguage] = useState(LANGUAGES[0].code);
  const [promptImages, setPromptImages] = useState<PromptImage[]>([]);
  const [voiceReferences, setVoiceReferences] = useState<VoiceReference[]>([]);
  const [voiceSourceType, setVoiceSourceType] = useState<VoiceSourceType>("cloned");
  const [voiceAssignments, setVoiceAssignments] = useState<Record<string, string>>({});
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [voiceName, setVoiceName] = useState("My podcast voice");
  const [clonedVoice, setClonedVoice] = useState<{ id: string; name: string; provider: "elevenlabs" | "chatterbox" } | null>(null);
  const [voiceCloneMessage, setVoiceCloneMessage] = useState<string | null>(null);
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("signal");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please provide a topic.");
      return;
    }
    if (selectedHosts.length === 0) {
      setError("Select at least one host.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const episodeVoiceReferences = voiceReferences.map((reference, index) => ({
        ...reference,
        clonedVoiceId: index === 0 ? clonedVoice?.id : reference.clonedVoiceId,
        clonedVoiceName: index === 0 ? clonedVoice?.name : reference.clonedVoiceName,
        cloneProvider: index === 0 ? clonedVoice?.provider : reference.cloneProvider,
      }));
      const voiceById = new Map(episodeVoiceReferences.map((reference) => [reference.id, reference]));
      const primaryVoiceReference = episodeVoiceReferences[0];
      const selectedProfiles = HOSTER_PROFILES.filter((host) => selectedHosts.includes(host.id)).map((host, index) => {
        const assignedReference = voiceById.get(voiceAssignments[host.id]) || (index === 0 ? primaryVoiceReference : undefined);
        if (!assignedReference) return host;
        const referenceName = assignedReference.clonedVoiceName || assignedReference.name;
        const sourceLabel = assignedReference.sourceType === "third-party" ? "Third-party voice" : assignedReference.sourceType === "downloaded" ? "Downloaded voice" : assignedReference.clonedVoiceId ? "Cloned voice" : "Voice reference";
        return {
          ...host,
          voiceAccent: `${sourceLabel}: ${referenceName}`,
          voiceReferenceId: assignedReference.clonedVoiceId || assignedReference.id,
          voiceReferenceName: referenceName,
          voiceSourceType: assignedReference.sourceType,
        };
      });
      const response = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: "free-local",
          topic,
          duration: getDurationPreset(durationSeconds),
          durationSeconds,
          numSpeakers: selectedProfiles.length,
          speakers: selectedProfiles,
          promptImages: promptImages.map(({ name, mimeType, size, notes }) => ({
            name,
            mimeType,
            size,
            notes,
          })),
          voiceReferences: episodeVoiceReferences.map(({ name, mimeType, size, consentConfirmed, sourceType, clonedVoiceId, clonedVoiceName, cloneProvider }) => ({
            name,
            mimeType,
            size,
            consentConfirmed,
            sourceType,
            clonedVoiceId,
            clonedVoiceName,
            cloneProvider,
          })),
          musicMood: AUDIO_MOODS.find((mood) => mood.id === musicMood)?.name || musicMood,
          language,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate podcast");
      }

      const data = await response.json();
      const generatedData: PodcastMetadata = {
        ...data,
        sourcePrompt: topic,
        promptImages,
        voiceReferences: episodeVoiceReferences,
      };
      const cover = generatePodcastCover(generatedData, topic || generatedData.title, coverStyle);
      onGenerated({
        ...generatedData,
        coverArt: cover,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.currentTarget.files;
    if (!fileList) return;

    const files: File[] = [];
    for (let index = 0; index < fileList.length; index += 1) {
      const file = fileList.item(index);
      if (file && file.type.startsWith("image/")) files.push(file);
    }
    if (files.length === 0) return;

    files.slice(0, 6 - promptImages.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPromptImages((current) => [
          ...current,
          {
            id: `${file.name}-${file.lastModified}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
            dataUrl: reader.result as string,
            notes: "",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  };

  const updateImageNotes = (id: string, notes: string) => {
    setPromptImages((current) => current.map((image) => (image.id === id ? { ...image, notes } : image)));
  };

  const removeImage = (id: string) => {
    setPromptImages((current) => current.filter((image) => image.id !== id));
  };

  const handleVoiceUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.currentTarget.files;
    if (!fileList) return;

    if (!voiceConsent) {
      setError("Confirm you have permission to use and clone this voice before uploading samples.");
      event.target.value = "";
      return;
    }

    const availableSlots = Math.max(0, 4 - voiceReferences.length);
    const files: File[] = [];
    for (let index = 0; index < fileList.length; index += 1) {
      const file = fileList.item(index);
      if (file && file.type.startsWith("audio/") && file.size <= 16 * 1024 * 1024) files.push(file);
    }

    if (files.length === 0 || availableSlots === 0) {
      setError(availableSlots === 0 ? "Remove a voice reference before adding another." : "Upload an audio file under 16 MB.");
      event.target.value = "";
      return;
    }

    files.slice(0, availableSlots).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setVoiceReferences((current) => [
          ...current,
          {
            id: `${file.name}-${file.lastModified}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
            name: file.name,
            mimeType: file.type || "audio/wav",
            size: file.size,
            dataUrl: reader.result as string,
            consentConfirmed: true,
            createdAt: new Date().toISOString(),
            sourceType: voiceSourceType,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    setClonedVoice(null);
    setVoiceCloneMessage(null);
    setError(null);
    event.target.value = "";
  };

  const removeVoiceReference = (id: string) => {
    setVoiceReferences((current) => current.filter((reference) => reference.id !== id));
    setVoiceAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, voiceId]) => voiceId !== id)));
    setClonedVoice(null);
    setVoiceCloneMessage(null);
  };

  const cloneVoice = async () => {
    if (!voiceConsent) {
      setError("Confirm you have permission to clone this voice first.");
      return;
    }
    if (voiceReferences.length === 0) {
      setError("Upload at least one audio voice sample before cloning.");
      return;
    }

    setIsCloningVoice(true);
    setError(null);
    setVoiceCloneMessage(null);

    try {
      const response = await fetch("/api/clone-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceName,
          consentConfirmed: voiceConsent,
          references: voiceReferences.map(({ name, mimeType, size, dataUrl, consentConfirmed }) => ({
            name,
            mimeType,
            size,
            dataUrl,
            consentConfirmed,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to clone this voice.");

      const nextVoice = {
        id: String(result.voice?.id || ""),
        name: String(result.voice?.name || voiceName || "Cloned voice"),
        provider: result.voice?.provider === "elevenlabs" ? "elevenlabs" as const : "chatterbox" as const,
      };
      if (!nextVoice.id) throw new Error("The clone succeeded but no voice ID was returned.");
      setClonedVoice(nextVoice);
      setVoiceCloneMessage(result.message || (nextVoice.provider === "elevenlabs" ? `${nextVoice.name} is ready for Studio Quality audio.` : `${nextVoice.name} is ready for Local Clone audio.`));
    } catch (err: any) {
      setVoiceCloneMessage(err.message || "Voice cloning is not available.");
    } finally {
      setIsCloningVoice(false);
    }
  };

  const toggleHost = (id: string) => {
    if (selectedHosts.includes(id)) {
      setSelectedHosts((prev) => prev.filter((hostId) => hostId !== id));
    } else {
      setSelectedHosts((prev) => [...prev, id]);
    }
  };

  const getBackgroundColorForSpeaker = (name: string) => {
    const colors = [
      "bg-blue-500/10 border-blue-500/20 text-blue-200",
      "bg-purple-500/10 border-purple-500/20 text-purple-200",
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
      "bg-amber-500/10 border-amber-500/20 text-amber-200",
      "bg-rose-500/10 border-rose-500/20 text-rose-200",
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  const generatedDurationSeconds = generatedPodcast?.script.length
    ? generatedPodcast.script[generatedPodcast.script.length - 1].estimatedStartSeconds + generatedPodcast.script[generatedPodcast.script.length - 1].durationSeconds
    : 0;

  const handleGenerateCover = () => {
    if (!generatedPodcast) return;
    const cover = generatePodcastCover(generatedPodcast, generatedPodcast.sourcePrompt || topic || generatedPodcast.title, coverStyle);
    onUpdated({ ...generatedPodcast, coverArt: cover });
  };

  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationRemainderSeconds = durationSeconds % 60;
  const updateDurationMinutes = (minutes: number) => {
    setDurationSeconds(clampDurationSeconds(minutes * 60 + durationRemainderSeconds));
  };
  const updateDurationRemainderSeconds = (seconds: number) => {
    setDurationSeconds(clampDurationSeconds(durationMinutes * 60 + Math.max(0, Math.min(59, Math.round(seconds || 0)))));
  };

  return (
    <div className={`p-6 pb-40 ${generatedPodcast ? "grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl" : "max-w-2xl mx-auto space-y-8"}`}>
      <div className="space-y-8">
        <div className="text-center lg:text-left space-y-2 mb-8">
          <div className={`w-16 h-16 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4 ${!generatedPodcast ? "mx-auto" : ""}`}>
            <Mic2 className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Create an Episode</h1>
          <p className="text-gray-400 text-sm">Turn a text prompt, image references, and custom cast voices into a podcast script from 1 minute to 120 minutes.</p>
        </div>

        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
              <Wand2 className="w-3 h-3" /> Prompt
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe the episode, angle, audience, and anything the hosts should focus on."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 transition-colors resize-none h-32 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {PRESET_TOPICS.map((preset) => (
                <button
                  key={preset.category}
                  onClick={() => setTopic(`${preset.topic} - ${preset.description}`)}
                  className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-gray-300 transition-colors"
                >
                  {preset.emoji} {preset.category}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
              <ImageIcon className="w-3 h-3" /> Image Prompts
            </label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={promptImages.length >= 6}
              className="w-full min-h-24 rounded-xl border border-dashed border-white/15 bg-black/30 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex flex-col items-center justify-center gap-2 text-gray-300"
            >
              <UploadCloud className="w-6 h-6 text-brand-300" />
              <span className="text-sm font-medium">Upload image references</span>
            </button>

            {promptImages.length > 0 && (
              <div className="grid gap-3">
                {promptImages.map((image) => (
                  <div key={image.id} className="grid grid-cols-[72px_1fr_auto] gap-3 items-start rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <img src={image.dataUrl} alt={image.name} className="w-[72px] h-[72px] rounded-lg object-cover bg-black/40" />
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-gray-300 min-w-0">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-brand-300" />
                        <span className="truncate">{image.name}</span>
                      </div>
                      <textarea
                        value={image.notes}
                        onChange={(event) => updateImageNotes(image.id, event.target.value)}
                        placeholder="Describe what matters in this image for the episode."
                        className="w-full h-16 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 resize-none"
                      />
                    </div>
                    <button
                      onClick={() => removeImage(image.id)}
                      className="w-8 h-8 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
                      aria-label={`Remove ${image.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
              <Mic2 className="w-3 h-3" /> Custom Voices
            </label>
            <input ref={voiceInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleVoiceUpload} />
            <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <input type="checkbox" checked={voiceConsent} onChange={(event) => setVoiceConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
                <span className="text-xs leading-relaxed text-gray-300">
                  I own this voice or have permission to use it for voice cloning.
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-2">
                <input
                  value={voiceName}
                  onChange={(event) => setVoiceName(event.target.value)}
                  placeholder="Custom voice name"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-brand-500/50"
                />
                <select
                  value={voiceSourceType}
                  onChange={(event) => setVoiceSourceType(event.target.value as VoiceSourceType)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
                  aria-label="Custom voice source type"
                >
                  {VOICE_SOURCE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => voiceInputRef.current?.click()}
                  disabled={!voiceConsent || voiceReferences.length >= 4}
                  className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Upload Sample
                </button>
              </div>

              {voiceReferences.length > 0 && (
                <div className="grid gap-2">
                  {voiceReferences.map((reference) => (
                    <div key={reference.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-brand-300" />
                          <span className="truncate">{reference.name}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          {reference.sourceType === "third-party" ? "Third-party" : reference.sourceType === "downloaded" ? "Downloaded" : "Cloned/reference"} voice · {formatFileSize(reference.size)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeVoiceReference(reference.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                        aria-label={`Remove ${reference.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                <p className="text-xs leading-relaxed text-gray-400">
                  Upload cloned, downloaded, or third-party voice files, then assign them to cast members below. With an ElevenLabs key the first cloned sample can become a hosted voice; without one it prepares a no-key Local Clone for Chatterbox.
                </p>
                <button
                  onClick={cloneVoice}
                  disabled={!voiceConsent || voiceReferences.length === 0 || isCloningVoice}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCloningVoice ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Cloning
                    </>
                  ) : clonedVoice ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Clone Ready
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Prepare Clone
                    </>
                  )}
                </button>
              </div>

              {voiceCloneMessage && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${clonedVoice ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-amber-500/20 bg-amber-500/10 text-amber-100"}`}>
                  {voiceCloneMessage}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
              <Mic2 className="w-3 h-3" /> Select Cast
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HOSTER_PROFILES.map((host) => {
                const isSelected = selectedHosts.includes(host.id);
                const assignedVoiceId = voiceAssignments[host.id] || "";
                return (
                  <div
                    key={host.id}
                    className={`flex items-start text-left p-3 rounded-xl border transition-all ${
                      isSelected ? "bg-brand-500/20 border-brand-500/50" : "bg-white/5 border-white/5 hover:border-white/20 opacity-70"
                    }`}
                  >
                    <div className="w-full space-y-3">
                      <button onClick={() => toggleHost(host.id)} className="w-full text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">{host.name}</span>
                          <span className="text-[9px] text-brand-300 uppercase tracking-wider">{host.role}</span>
                        </div>
                      </button>
                      {isSelected && (
                        <select
                          value={assignedVoiceId}
                          onChange={(event) => setVoiceAssignments((current) => ({ ...current, [host.id]: event.target.value }))}
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-brand-500/50"
                          aria-label={`Voice for ${host.name}`}
                        >
                          <option value="">Default cast voice</option>
                          {voiceReferences.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.name} ({voice.sourceType === "third-party" ? "third-party" : voice.sourceType === "downloaded" ? "downloaded" : "clone"})
                            </option>
                          ))}
                        </select>
                      )}
                      {isSelected && assignedVoiceId && (
                        <div className="text-[11px] leading-snug text-brand-100/80">
                          Assigned: {voiceReferences.find((voice) => voice.id === assignedVoiceId)?.name || "Custom voice"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/5">
            <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> Production Settings
            </label>
            <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Podcast Length</span>
                <span className="text-sm font-bold text-white">{formatDurationLabel(durationSeconds)}</span>
              </div>
              <input
                type="range"
                min={MIN_DURATION_SECONDS}
                max={MAX_DURATION_SECONDS}
                step={1}
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(clampDurationSeconds(Number(event.target.value)))}
                className="w-full accent-brand-500"
                aria-label="Podcast length from 1 minute to 120 minutes"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-gray-500">Minutes</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={durationMinutes}
                    onChange={(event) => updateDurationMinutes(Number(event.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-gray-500">Seconds</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={durationRemainderSeconds}
                    onChange={(event) => updateDurationRemainderSeconds(Number(event.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={musicMood} onChange={(e) => setMusicMood(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none">
                {AUDIO_MOODS.map((mood) => (
                  <option key={mood.id} value={mood.id}>
                    {mood.name}
                  </option>
                ))}
              </select>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none">
                {LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs">{error}</div>}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim() || selectedHosts.length === 0}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Writing Script...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Episode
              </>
            )}
          </button>
        </div>
      </div>

      {generatedPodcast && (
        <div className="bg-[#0c0d21]/50 border border-white/5 rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-mono">SCRIPT PREVIEW</div>
            <div className="inline-flex px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-mono">
              {Math.round(generatedDurationSeconds / 60)} MIN EST.
            </div>
          </div>
          <h2 className="text-2xl font-display font-medium text-white">{generatedPodcast.title}</h2>
          <p className="text-gray-400 text-sm">{generatedPodcast.tagline}</p>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-44 aspect-square rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-brand-600 to-slate-950">
                {generatedPodcast.coverArt ? (
                  <img src={generatedPodcast.coverArt.dataUrl} alt={`${generatedPodcast.title} cover`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-9 h-9" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Podcast Cover</h3>
                  <p className="text-xs text-gray-400 mt-1">Generate a square cover from the title and prompt. Export it from Publish or download it here.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COVER_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setCoverStyle(style.id)}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${coverStyle === style.id ? "bg-brand-500/30 border-brand-500/50 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:text-white"}`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={handleGenerateCover} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" /> Generate Cover
                  </button>
                  {generatedPodcast.coverArt && (
                    <button onClick={() => downloadDataUrl(`${generatedPodcast.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "podcast"}-cover.png`, generatedPodcast.coverArt!.dataUrl)} className="bg-white/10 hover:bg-white/15 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {generatedPodcast.promptImages && generatedPodcast.promptImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {generatedPodcast.promptImages.map((image) => (
                <div key={image.id} className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
                  <img src={image.dataUrl} alt={image.name} className="w-full aspect-square object-cover" />
                </div>
              ))}
            </div>
          )}

          {generatedPodcast.voiceReferences && generatedPodcast.voiceReferences.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-100">
                <Mic2 className="h-4 w-4" /> Voice reference attached
              </div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-100/75">
                {generatedPodcast.voiceReferences[0].clonedVoiceId
                  ? `${generatedPodcast.voiceReferences[0].clonedVoiceName || "Cloned voice"} is selected for ${generatedPodcast.voiceReferences[0].cloneProvider === "elevenlabs" ? "ElevenLabs Studio Quality" : "Local Clone"} audio.`
                  : "The uploaded voice sample is saved with this draft. Prepare the clone, then generate audio with Local Clone or ElevenLabs."}
              </p>
            </div>
          )}

          <div className="space-y-4 mt-6">
            {generatedPodcast.script.map((line) => {
              const styling = getBackgroundColorForSpeaker(line.speakerName);
              return (
                <div key={line.id} className="group flex flex-col gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">{line.speakerName}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {Math.floor(line.estimatedStartSeconds / 60)}:{Math.floor(line.estimatedStartSeconds % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className={`p-4 rounded-xl border ${styling}`}>
                    <p className="text-[14px] leading-relaxed font-medium">{line.dialogue}</p>
                    {line.soundEffect && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] opacity-70">
                        <Sparkles className="w-3 h-3" />
                        <span className="italic">{line.soundEffect}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
