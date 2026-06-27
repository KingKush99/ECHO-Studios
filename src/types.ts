export interface Speaker {
  name: string;
  role: string;
  bio: string;
  voiceAccent: string;
  avatarSeed: string;
  gender: "male" | "female" | "neutral";
  style: string;
  voiceReferenceId?: string;
  voiceReferenceName?: string;
  voiceSourceType?: "cloned" | "downloaded" | "third-party";
}

export interface Chapter {
  title: string;
  startSeconds: number;
}

export interface ScriptLine {
  id: string;
  speakerName: string;
  dialogue: string;
  soundEffect: string | null;
  durationSeconds: number;
  estimatedStartSeconds: number;
}

export interface PromptImage {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  notes: string;
}

export interface VoiceReference {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  consentConfirmed: boolean;
  createdAt: string;
  sourceType?: "cloned" | "downloaded" | "third-party";
  clonedVoiceId?: string;
  clonedVoiceName?: string;
  cloneProvider?: "elevenlabs" | "chatterbox";
}

export interface PodcastCover {
  dataUrl: string;
  prompt: string;
  style: string;
  createdAt: string;
}

export interface PodcastMetadata {
  title: string;
  tagline: string;
  description: string;
  musicMood: string;
  speakers: Speaker[];
  chapters: Chapter[];
  script: ScriptLine[];
  sourcePrompt?: string;
  promptImages?: PromptImage[];
  voiceReferences?: VoiceReference[];
  coverArt?: PodcastCover;
}

export interface PresetTopic {
  emoji: string;
  category: string;
  topic: string;
  description: string;
}
