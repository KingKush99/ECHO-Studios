import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

test("podcast generation API", async (t) => {
  process.env.VERCEL = "1";
  const { createEchoApp } = await import("./server");
  const server = (await createEchoApp({ assetsMode: "api" })).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

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
    return new Response(null, { status: 503 });
  });

  async function generateEpisode(durationSeconds = 60) {
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
});
