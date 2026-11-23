import { PresetTopic } from "./types";

export const PRESET_TOPICS: PresetTopic[] = [
  {
    emoji: "Rocket",
    category: "Deep Tech",
    topic: "The Mars Colony Paradox",
    description: "What happens when our first colony on Mars declares independence? Exploring space treaties, transport physics, and resource independence.",
  },
  {
    emoji: "Tea",
    category: "Philosophy",
    topic: "Can Machines Love?",
    description: "If an AI is programmatically indistinguishable from a human lover, does it matter if there is neural feeling underneath? A tea-side discussion on consciousness.",
  },
  {
    emoji: "Satire",
    category: "Comedy Science",
    topic: "Urban Bird Surveillance Theory",
    description: "A satirical breakdown of urban flock patterns, sensor myths, and the logistics of charging on powerlines.",
  },
  {
    emoji: "Charts",
    category: "Future History",
    topic: "Vintage Predictions of 2026",
    description: "Reading computer magazines from 1985 showing what experts predicted for today: flying floppy disks, database refrigerators, and modular robot helpers.",
  },
  {
    emoji: "Mind",
    category: "AI Revolution",
    topic: "The Creative Co-pilot",
    description: "Will the future of cinema, painting, and novels belong to prompt designers or acoustic curators? A sharp debate on the nature of human imagination.",
  },
  {
    emoji: "Mystery",
    category: "Unexplained Mysteries",
    topic: "The Woolpit Enigma",
    description: "Reviewing the bizarre 12th-century historical report of green-skinned children who spoke an unknown tongue and wore strange clothes in Suffolk.",
  },
];

export const HOSTER_PROFILES = [
  {
    id: "maya",
    name: "Maya Chen",
    role: "Energetic Host",
    bio: "Tech podcaster, developer, and caffeinated optimist who loves rapid transitions.",
    gender: "female" as const,
    style: "enthusiastic",
    avatarSeed: "avatar_1",
    kokoroVoice: "af_bella", voicePace: 1,
  },
  {
    id: "marcus",
    name: "Marcus Sterling",
    role: "Humorous Comedian",
    bio: "Stand-up comic and history enthusiast who brings sarcastic analogies to complex topics.",
    gender: "male" as const,
    style: "humorous",
    avatarSeed: "avatar_2",
    kokoroVoice: "am_michael", voicePace: 0.98,
  },
  {
    id: "dr_li",
    name: "Dr. Arthur Li",
    role: "Calm Academic",
    bio: "Professor emeritus in systems thinking. Keeps arguments grounded in empirical evidence.",
    gender: "male" as const,
    style: "intellectual",
    avatarSeed: "avatar_3",
    kokoroVoice: "bm_george", voicePace: 0.95,
  },
  {
    id: "zephyr",
    name: "Zephyr",
    role: "Philosophical Co-host",
    bio: "A non-binary futurist researching eco-tech, with a gentle, slow delivery.",
    gender: "neutral" as const,
    style: "philosophical",
    avatarSeed: "avatar_4",
    kokoroVoice: "bm_fable", voicePace: 0.94,
  },
  {
    id: "luna",
    name: "Luna Vance",
    role: "Skeptical Journalist",
    bio: "Investigative writer looking for hidden strings, conspiracy details, and fun paradoxes.",
    gender: "female" as const,
    style: "skeptical",
    avatarSeed: "avatar_5",
    kokoroVoice: "bf_emma", voicePace: 0.97,
  },
  { id: "ana", name: "Ana Rivera", role: "Storyteller", bio: "Turns interviews and research into grounded, human stories.", gender: "female" as const, style: "warm", avatarSeed: "avatar_6", kokoroVoice: "af_sarah", voicePace: 0.96 },
  { id: "felix", name: "Felix Brooks", role: "Curious Explainer", bio: "Uses plain-language examples to unpack complex ideas.", gender: "male" as const, style: "curious", avatarSeed: "avatar_7", kokoroVoice: "am_puck", voicePace: 1 },
  { id: "nia", name: "Nia Okafor", role: "Interview Host", bio: "Brings out specific answers with thoughtful follow-up questions.", gender: "female" as const, style: "conversational", avatarSeed: "avatar_8", kokoroVoice: "af_heart", voicePace: 0.98 },
  { id: "clara", name: "Clara Bennett", role: "Cultural Critic", bio: "Connects art and pop culture to everyday experiences.", gender: "female" as const, style: "reflective", avatarSeed: "avatar_9", kokoroVoice: "bf_isabella", voicePace: 0.96 },
  { id: "miles", name: "Miles Carter", role: "Field Reporter", bio: "Describes what happened, what witnesses saw, and what remains unclear.", gender: "male" as const, style: "measured", avatarSeed: "avatar_10", kokoroVoice: "bm_daniel", voicePace: 0.97 },
  { id: "priya", name: "Priya Shah", role: "Practical Guide", bio: "Turns broad ideas into concrete steps listeners can try.", gender: "female" as const, style: "clear", avatarSeed: "avatar_11", kokoroVoice: "af_nicole", voicePace: 0.97 },
  { id: "theo", name: "Theo Park", role: "Debate Partner", bio: "Challenges assumptions with specific, fair counterarguments.", gender: "male" as const, style: "direct", avatarSeed: "avatar_12", kokoroVoice: "am_fenrir", voicePace: 1 },
];

export const AUDIO_MOODS = [
  { id: "ambient", name: "Ambient Lofi Cafe", icon: "Cafe" },
  { id: "synth", name: "Interstellar Synthwave", icon: "Synth" },
  { id: "jazz", name: "Late Night Corporate Jazz", icon: "Jazz" },
  { id: "cinematic", name: "Cinematic Orchestral", icon: "Film" },
  { id: "none", name: "Pure Speech", icon: "Voice" },
];

export const LANGUAGES = [
  { code: "English", label: "English" },
  { code: "Spanish", label: "Spanish" },
  { code: "French", label: "French" },
  { code: "German", label: "German" },
  { code: "Japanese", label: "Japanese" },
];
