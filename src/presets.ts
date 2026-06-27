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
  },
  {
    id: "marcus",
    name: "Marcus Sterling",
    role: "Humorous Comedian",
    bio: "Stand-up comic and history enthusiast who brings sarcastic analogies to complex topics.",
    gender: "male" as const,
    style: "humorous",
    avatarSeed: "avatar_2",
  },
  {
    id: "dr_li",
    name: "Dr. Arthur Li",
    role: "Calm Academic",
    bio: "Professor emeritus in systems thinking. Keeps arguments grounded in empirical evidence.",
    gender: "male" as const,
    style: "intellectual",
    avatarSeed: "avatar_3",
  },
  {
    id: "zephyr",
    name: "Zephyr",
    role: "Philosophical Co-host",
    bio: "A non-binary futurist researching eco-tech, with a gentle, slow delivery.",
    gender: "neutral" as const,
    style: "philosophical",
    avatarSeed: "avatar_4",
  },
  {
    id: "luna",
    name: "Luna Vance",
    role: "Skeptical Journalist",
    bio: "Investigative writer looking for hidden strings, conspiracy details, and fun paradoxes.",
    gender: "female" as const,
    style: "skeptical",
    avatarSeed: "avatar_5",
  },
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
