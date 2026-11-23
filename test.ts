import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { encodeWavToMp3 } from "./src/mp3-export";
import { exportPodcastFeed } from "./src/publish-feed";
import { HOSTER_PROFILES } from "./src/presets";

test("podcast and local voice generation API", async (t) => {
  const initialDirectory = process.cwd();
  const testDirectory = await mkdtemp(path.join(tmpdir(), "echo-studios-test-"));
  let closeServer: (() => Promise<void>) | undefined;
  t.after(async () => {
    await closeServer?.();
    process.chdir(initialDirectory);
    await rm(testDirectory, { recursive: true, force: true, maxRetries: 3 });
  });
  process.chdir(testDirectory);
  const worker = path.join(testDirectory, "chatterbox-stub.cjs");
  const manifestCopy = path.join(testDirectory, "rendered-manifest.json");
  const chatterboxDir = path.join(testDirectory, "chatterbox");
  await mkdir(path.join(chatterboxDir, "Lib", "site-packages", "chatterbox"), { recursive: true });
  await writeFile(worker, `
    const fs = require("node:fs");
    const path = require("node:path");
    const args = process.argv;
    fs.copyFileSync(args[args.indexOf("--segments-file") + 1], path.join(__dirname, "rendered-manifest.json"));
    const wav = Buffer.alloc(46);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(38, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(24000, 24);
    wav.writeUInt32LE(48000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(2, 40);
    fs.writeFileSync(args[args.indexOf("--out") + 1], wav);
  `);
  process.env.VERCEL = "1";
  process.env.KOKORO_ENABLED = "1";
  process.env.CHATTERBOX_DIR = chatterboxDir;
  process.env.CHATTERBOX_SCRIPT = worker;
  process.env.CHATTERBOX_PYTHON = process.execPath;
  process.env.ELEVENLABS_API_KEY = "test-key";
  const { createEchoApp } = await import("./server");
  const server = (await createEchoApp({ assetsMode: "api" })).listen(0, "127.0.0.1");
  closeServer = () => new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { port } = address;
  const request = globalThis.fetch;
  const research = {
    title: "Tides",
    extract: "Tides are the rise and fall of sea levels caused by gravitational forces exerted by the Moon and Sun.",
  };
  type OllamaRequest = { model: string; messages: Array<{ content: string }> };
  const calls: OllamaRequest[] = [];
  let hostedVoiceCalls = 0;
  let mockOllama = (_request: OllamaRequest) => new Response(null, { status: 404 });
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.origin === "http://127.0.0.1:11434") {
      assert.equal(url.pathname, "/api/chat");
      assert.equal(init?.method, "POST");
      const payload = JSON.parse(String(init?.body));
      calls.push(payload);
      return mockOllama(payload);
    }
    if (url.hostname === "en.wikipedia.org") {
      return Response.json(url.pathname === "/w/api.php" ? ["Tides", ["Tides"]] : research);
    }
    if (url.hostname === "api.elevenlabs.io") hostedVoiceCalls += 1;
    return new Response(null, { status: 503 });
  });

  async function generateEpisode(durationSeconds = 60, extra = {}) {
    calls.length = 0;
    const response = await request(`http://127.0.0.1:${port}/api/generate-podcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "Ocean tides",
        durationSeconds,
        language: "French",
        speakers: [{ name: "Camille" }, { name: "Samir" }],
        promptImages: [{ name: "harbour.jpg", notes: "A pier at low tide" }],
        ...extra,
      }),
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  await t.test("keeps free template generation when no model is configured", async () => {
    delete process.env.OLLAMA_MODEL;
    const episode = await generateEpisode();
    assert.equal(calls.length, 0);
    assert.match(episode.tagline, /Written with the built-in templates/);
    const last = episode.script.at(-1);
    assert.equal(last.estimatedStartSeconds + last.durationSeconds, 60);
  });

  await t.test("retains six hosts and creates a usable RSS enclosure", async () => {
    delete process.env.OLLAMA_MODEL;
    const speakers = HOSTER_PROFILES.slice(6);
    const episode = await generateEpisode(120, { speakers });
    assert.equal(episode.speakers.length, 6);
    assert.deepEqual(episode.speakers.map(({ kokoroVoice }) => kokoroVoice), speakers.map(({ kokoroVoice }) => kokoroVoice));
    const metadata = { author: "Echo & Friends", email: "test@example.com", website: "https://example.com", audio: "https://example.com/episode.mp3?v=1&x=2", artwork: "https://example.com/art.png", bytes: 48128, category: "Technology", explicit: false };
    const rss = exportPodcastFeed(episode, metadata);
    assert.match(rss, /length="48128" type="audio\/mpeg"/);
    assert.match(rss, /Echo &amp; Friends/);
    assert.match(rss, /episode\.mp3\?v=1&amp;x=2/);
    assert.equal(exportPodcastFeed(episode, { ...metadata, bytes: 0 }), "");
    assert.equal(exportPodcastFeed(episode, { ...metadata, audio: "https://127.0.0.1/audio.mp3" }), "");
  });

  await t.test("writes model sections with cast, research, and continuous chapter timing", async () => {
    process.env.OLLAMA_MODEL = "test-model";
    mockOllama = ({ messages }) => {
      const { section } = JSON.parse(messages[1].content);
      const content = JSON.stringify({
        title: "Les marées",
        lines: [
          { speaker: 2, dialogue: `Pourquoi la mer monte-t-elle dans ce port au chapitre ${section} ?` },
          { speaker: 1, dialogue: `La Lune attire l’eau, et la Terre tourne au chapitre ${section}.` },
        ],
      });
      return Response.json({ message: { content } });
    };

    const episode = await generateEpisode(300);
    assert.match(episode.tagline, /Written with local AI/);
    assert.equal(episode.language, "French");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].model, "test-model");
    const first = JSON.parse(calls[0].messages[1].content);
    const second = JSON.parse(calls[1].messages[1].content);
    assert.equal(first.language, "French");
    assert.deepEqual(first.research, [{ title: research.title, source: "Wikipedia", summary: research.extract }]);
    assert.match(first.imageNotes, /A pier at low tide/);
    assert.equal(first.opening, true);
    assert.equal(first.closing, false);
    assert.equal(second.opening, false);
    assert.equal(second.closing, true);
    assert.deepEqual(second.coveredChapters, ["Les marées"]);
    assert.notDeepEqual(first.chapterBeats, second.chapterBeats);
    assert.match(second.previousTurns[0].dialogue, /Pourquoi la mer/);
    assert.deepEqual(episode.script.map(({ speakerName }) => speakerName), ["Samir", "Camille", "Samir", "Camille"]);
    assert.deepEqual(episode.chapters.map(({ title }) => title), ["Les marées", "Les marées (2)"]);
    assert.equal(episode.chapters[1].startSeconds, episode.script[2].estimatedStartSeconds);
    assert.equal(episode.script[2].estimatedStartSeconds, episode.script[0].durationSeconds + episode.script[1].durationSeconds);
    const last = episode.script.at(-1);
    assert.ok(last.estimatedStartSeconds + last.durationSeconds < 300);
  });

  await t.test("falls back for missing models and invalid speaker IDs", async () => {
    const invalidSection = { title: "Invalid", lines: [{ speaker: 1, dialogue: "Example one" }, { speaker: 99, dialogue: "Invalid speaker" }] };
    const failures = [
      () => new Response(null, { status: 404 }),
      () => Response.json({ message: { content: JSON.stringify(invalidSection) } }),
    ];
    for (const fail of failures) {
      mockOllama = fail;
      const episode = await generateEpisode();
      assert.equal(calls.length, 1);
      assert.match(episode.tagline, /Local AI was unavailable/);
      assert.ok(episode.script.every(({ speakerName }) => ["Camille", "Samir"].includes(speakerName)));
    }
  });

  await t.test("sends every requested turn to Chatterbox and serves the resulting audio", async () => {
    const script = Array.from({ length: 24 }, (_, index) => ({
      speakerName: index % 2 ? "Camille" : "Samir",
      dialogue: `Turn ${index + 1}. ${"This ordinary sentence makes the text exceed the old preview limit. ".repeat(index === 0 ? 7 : 2).trim()}`,
      durationSeconds: 15,
    }));
    const response = await request(`http://127.0.0.1:${port}/api/generate-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "chatterbox", script, maxSeconds: 360 }),
    });
    assert.equal(response.status, 200);
    const audio = await response.json();
    assert.equal(audio.mode, "chatterbox");

    const manifest = JSON.parse(await readFile(manifestCopy, "utf8"));
    assert.ok(manifest.segments.every(({ text }) => text.length <= 360));
    assert.equal(manifest.segments.map(({ text }) => text).join(" "), script.map(({ dialogue }) => dialogue).join(" "));
    const file = await request(`http://127.0.0.1:${port}${audio.audioUrl}`);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "audio/wav");
    const wav = await file.arrayBuffer();
    assert.equal(Buffer.from(wav).toString("ascii", 0, 4), "RIFF");
    const mp3 = encodeWavToMp3(wav);
    assert.ok(mp3.blocks.length > 0);
    assert.equal(new Uint8Array(mp3.blocks[0])[0], 255);
    assert.equal(hostedVoiceCalls, 0);
  });

  await t.test("keeps a local voice reference local when a hosted key is configured", async () => {
    const result = await request(`http://127.0.0.1:${port}/api/clone-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "chatterbox",
        consentConfirmed: true,
        voiceName: "Local host",
        references: [{ name: "reference.wav", dataUrl: `data:audio/wav;base64,${Buffer.alloc(2048).toString("base64")}` }],
      }),
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).voice.provider, "chatterbox");
    assert.equal(hostedVoiceCalls, 0);
  });

  await t.test("reports that this Kokoro runtime supports English voices", async () => {
    const response = await request(`http://127.0.0.1:${port}/api/generate-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "kokoro", language: "French", script: [{ dialogue: "Bonjour." }] }),
    });
    assert.equal(response.status, 501);
    assert.match((await response.json()).error, /English episodes/);
  });
});
