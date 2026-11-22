type ScriptSpeaker = { name: string; role: string; bio: string; style: string };
type ScriptSource = { title: string; source: string; summary: string };

type ScriptLine = { speaker: number; dialogue: string };
type ScriptSection = { title: string; lines: ScriptLine[] };

const MAX_SECTION_SECONDS = 240;
const SECTION_TIMEOUT_MS = 180_000;
const MAX_DIALOGUE_CHARS = 800;

function parseSection(content: string, speakerCount: number, maxLines: number): ScriptSection {
  const section = JSON.parse(content) as Partial<ScriptSection> | null;
  if (
    typeof section?.title !== "string" || !section.title.trim() || section.title.length > 160 ||
    !Array.isArray(section.lines) || section.lines.length < 2 || section.lines.length > maxLines
  ) {
    throw new Error("Ollama returned an incomplete script section.");
  }

  const lines = section.lines.map((line) => {
    if (
      !Number.isInteger(line?.speaker) || line.speaker < 1 || line.speaker > speakerCount ||
      typeof line.dialogue !== "string" || !line.dialogue.trim() || line.dialogue.length > MAX_DIALOGUE_CHARS
    ) {
      throw new Error("Ollama returned an invalid speaking turn.");
    }
    return { speaker: line.speaker, dialogue: line.dialogue.replace(/\s+/g, " ").trim() };
  });

  return { title: section.title.trim(), lines };
}

export async function writePodcastWithOllama(options: {
  model: string;
  topic: string;
  language: string;
  episodeFormat: { title: string; chapterTitles: string[] };
  imageContext: string;
  speakers: ScriptSpeaker[];
  sources: ScriptSource[];
  targetSeconds: number;
  signal: AbortSignal;
}) {
  const { model, topic, language, episodeFormat, imageContext, speakers, sources, targetSeconds, signal } = options;
  const sectionCount = Math.ceil(targetSeconds / MAX_SECTION_SECONDS);
  const secondsPerSection = targetSeconds / sectionCount;
  const wordsPerSection = Math.round(secondsPerSection * 2.1);
  const turnsPerSection = Math.max(speakers.length, Math.round(wordsPerSection / 30));
  const maxLines = turnsPerSection + 1;
  const format = {
    type: "object",
    required: ["title", "lines"],
    properties: {
      title: { type: "string", maxLength: 160 },
      lines: {
        type: "array",
        minItems: 2,
        maxItems: maxLines,
        items: {
          type: "object",
          required: ["speaker", "dialogue"],
          properties: {
            speaker: { type: "integer", enum: speakers.map((_, index) => index + 1) },
            dialogue: { type: "string", minLength: 1, maxLength: MAX_DIALOGUE_CHARS },
          },
        },
      },
    },
  };
  const episode = {
    topic: topic.slice(0, 4000),
    language: language.slice(0, 100),
    episodeFormat: episodeFormat.title,
    cast: speakers.map(({ name, role, bio, style }, index) => ({
      speaker: index + 1,
      name: name.slice(0, 100),
      role: role.slice(0, 100),
      bio: bio.slice(0, 300),
      style: style.slice(0, 100),
    })),
    imageNotes: imageContext.slice(0, 1200),
    research: sources.map(({ title, source, summary }) => ({
      title: title.slice(0, 180),
      source,
      summary: summary.slice(0, 500),
    })),
  };
  const sections: ScriptSection[] = [];

  for (let index = 0; index < sectionCount; index += 1) {
    const beatStart = Math.floor(index * episodeFormat.chapterTitles.length / sectionCount);
    const beatEnd = Math.floor((index + 1) * episodeFormat.chapterTitles.length / sectionCount);
    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(SECTION_TIMEOUT_MS)]),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        format,
        options: { num_ctx: 8192, num_predict: 3000, temperature: 0.6 },
        messages: [
          {
            role: "system",
            content: [
              "Write natural, ready-to-read podcast dialogue in the requested language. Give each section a short title specific to its content and distinct from earlier chapters.",
              "Return JSON with a title and lines. Each line must contain a numeric speaker from the cast and their spoken dialogue.",
              "Give every cast member a meaningful speaking turn. Use distinct voices and have speakers respond to each other when there is more than one.",
              "Use only spoken words in dialogue. Omit stage directions, names as prefixes, and sound cues.",
              "Use relevant research excerpts as evidence. Attribute them accurately and never invent citations, quotes, quantities, or scientific details.",
              "Use the requested language throughout, including technical terms that have established translations. For nonfiction, omit unsupported details, explain mechanisms plainly, and avoid extended metaphors.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              ...episode,
              section: index + 1,
              sectionCount,
              chapterBeats: episodeFormat.chapterTitles.slice(beatStart, Math.max(beatStart + 1, beatEnd)),
              opening: index === 0,
              closing: index === sectionCount - 1,
              coveredChapters: sections.map(({ title }) => title),
              previousTurns: sections[index - 1]?.lines.slice(-2).map(({ speaker, dialogue }) => ({
                speaker,
                dialogue: dialogue.slice(-450),
              })),
              direction: `Write about ${wordsPerSection} spoken words total across about ${turnsPerSection} speaking turns. Aim for about 30 words and one or two complete sentences per turn. Continue from previous turns when present. Cover a fresh angle. Introduce the episode only in the opening section and wrap up only in the closing section.`,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Ollama returned HTTP ${response.status}.`);
    }
    const payload = await response.json();
    if (typeof payload.message?.content !== "string") {
      throw new Error("Ollama returned no script content.");
    }
    sections.push(parseSection(payload.message.content, speakers.length, maxLines));
  }

  const usedSpeakers = new Set(sections.flatMap(({ lines }) => lines.map(({ speaker }) => speaker)));
  if (usedSpeakers.size !== speakers.length) {
    throw new Error("Ollama omitted one or more selected speakers.");
  }
  return sections;
}
