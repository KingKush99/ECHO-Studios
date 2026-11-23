import type { PodcastMetadata } from "./types";
import { getSpeechLocale } from "./voice-options";

export function publicHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || !host.includes(".") ||
      /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/.test(host) || /\.(?:localhost|local|internal)$/.test(host)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function xml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function exportPodcastFeed(episode: PodcastMetadata, input: {
  author: string; email: string; website: string; audio: string; artwork: string;
  bytes: number; feed?: string; category: string; explicit: boolean; duration?: number;
}) {
  const website = publicHttpsUrl(input.website);
  const audio = publicHttpsUrl(input.audio);
  const artwork = publicHttpsUrl(input.artwork);
  const feed = publicHttpsUrl(input.feed || "");
  const author = input.author.trim();
  const email = input.email.trim();
  const audioTypes: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", aac: "audio/aac" };
  const type = audio && audioTypes[new URL(audio).pathname.split(".").at(-1)?.toLowerCase() || ""];
  if (!author || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !website || !type || !artwork || !Number.isSafeInteger(input.bytes) || input.bytes <= 0) return "";
  const last = episode.script.at(-1);
  const duration = input.duration || (last ? last.estimatedStartSeconds + last.durationSeconds : 0);
  const date = new Date(episode.coverArt?.createdAt || Date.now());
  const pubDate = Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(episode.title)}</title>
    <description>${xml(episode.description)}</description>
    <link>${xml(website)}</link>
    ${feed ? `<atom:link href="${xml(feed)}" rel="self" type="application/rss+xml" />` : ""}
    <language>${xml(getSpeechLocale(episode.language))}</language>
    <itunes:author>${xml(author)}</itunes:author>
    <itunes:owner><itunes:name>${xml(author)}</itunes:name><itunes:email>${xml(email)}</itunes:email></itunes:owner>
    <itunes:image href="${xml(artwork)}" />
    <itunes:category text="${xml(input.category)}" />
    <itunes:explicit>${input.explicit}</itunes:explicit>
    <item>
      <title>${xml(episode.title)}</title>
      <description>${xml(episode.description)}</description>
      <guid isPermaLink="false">${xml(`${episode.title}-${episode.script.length}-${episode.coverArt?.createdAt || "episode"}`)}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:duration>${Math.round(duration)}</itunes:duration>
      <itunes:explicit>${input.explicit}</itunes:explicit>
      <enclosure url="${xml(audio)}" length="${input.bytes}" type="${type}" />
    </item>
  </channel>
</rss>
`;
}
