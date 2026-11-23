import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ExternalLink, Loader2, Play, Radio, RefreshCw, Search, Send, Volume2 } from "lucide-react";
import type { PodcastMetadata } from "../types";

export type LivePodcast = {
  id: string;
  showTitle: string;
  episodeTitle: string;
  publisher: string;
  category: string;
  description: string;
  feedUrl?: string;
  homeUrl?: string;
  episodeUrl?: string;
  imageUrl?: string;
  audioUrl: string;
  duration: string;
  listeners: number;
  preset?: boolean;
};

type LiveChatMessage = {
  id: string;
  author: string;
  text: string;
  time: string;
};

const DEFAULT_CHAT_MESSAGES: LiveChatMessage[] = [
  { id: "1", author: "Maya", text: "This room is live. Drop questions for the host segment.", time: "Now" },
  { id: "2", author: "Marcus", text: "The voice quality point is huge for longer episodes.", time: "1m" },
  { id: "3", author: "Luna", text: "Can we pin the publishing checklist after this?", time: "2m" },
];

function formatListeners(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function normalizeDuration(value: string) {
  if (!value) return "Live";
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  }
  return value;
}

export function ListenFeedView({ onPlayEpisode, initialEpisode, episodes, onOpenEpisode }: {
  onPlayEpisode: (episode: LivePodcast) => void;
  initialEpisode: LivePodcast | null;
  episodes: PodcastMetadata[];
  onOpenEpisode: (episode: PodcastMetadata) => void;
}) {
  const [podcasts, setPodcasts] = useState<LivePodcast[]>([]);
  const [openedPodcast, setOpenedPodcast] = useState<LivePodcast | null>(initialEpisode);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState(DEFAULT_CHAT_MESSAGES);
  const fetchingFeed = useRef(false);

  const categories = useMemo(() => ["All", ...Array.from(new Set(podcasts.map((podcast) => podcast.category))).filter(Boolean)], [podcasts]);
  const filtered = podcasts.filter((podcast) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      podcast.showTitle.toLowerCase().includes(query) ||
      podcast.episodeTitle.toLowerCase().includes(query) ||
      podcast.publisher.toLowerCase().includes(query);
    const matchesCategory = selectedCategory === "All" || podcast.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const loadPodcasts = async (refresh = false) => {
    if (fetchingFeed.current) return;
    fetchingFeed.current = true;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/live-podcasts");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Live podcasts are unavailable.");
      const nextPodcasts = Array.isArray(result.podcasts) ? result.podcasts.filter((podcast: LivePodcast) => podcast.audioUrl) : [];
      setPodcasts(nextPodcasts);
    } catch (err: any) {
      setError(err.message || "Live podcasts are unavailable.");
    } finally {
      fetchingFeed.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPodcasts();
  }, []);

  const selectPodcast = (podcast: LivePodcast) => {
    setOpenedPodcast(podcast);
    setChatMessages([
      { id: `${podcast.id}-room`, author: "ECHO", text: `Opened ${podcast.showTitle}. You are now in the live chat.`, time: "Now" },
      ...DEFAULT_CHAT_MESSAGES,
    ]);
    onPlayEpisode(podcast);
  };

  const closeRoom = () => {
    setOpenedPodcast(null);
    setChatDraft("");
  };

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!text) return;
    setChatMessages((current) => [{ id: `${Date.now()}`, author: "You", text, time: "Now" }, ...current]);
    setChatDraft("");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Live Podcasts</h1>
        </div>

        <button
          onClick={() => loadPodcasts(true)}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {openedPodcast ? (
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <button onClick={closeRoom} className="inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500">
              <ArrowLeft className="h-4 w-4" /> Back to live
            </button>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">{formatListeners(openedPodcast.listeners)} listening</span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
              {openedPodcast.imageUrl ? (
                <img src={openedPodcast.imageUrl} alt={openedPodcast.showTitle} className="absolute inset-0 h-full w-full object-cover opacity-80" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-slate-900 to-pink-700" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/20 to-black/85" />
              <div className="relative flex min-h-[58vh] flex-col justify-end p-5 sm:p-8">
                <div className="mb-5 inline-flex w-max items-center gap-2 rounded-full border border-pink-400/40 bg-pink-500/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-pink-100">
                  <Volume2 className="h-4 w-4" /> Live Room
                </div>
                <h2 className="max-w-3xl text-3xl font-black leading-tight text-white drop-shadow sm:text-5xl">{openedPodcast.showTitle}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/85 sm:text-base">{openedPodcast.episodeTitle}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/80">
                  <span className="rounded-full bg-white/15 px-2.5 py-1">{openedPodcast.publisher}</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1">{openedPodcast.category}</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1">{normalizeDuration(openedPodcast.duration)}</span>
                  {openedPodcast.preset && <span className="rounded-full bg-pink-500/25 px-2.5 py-1 text-pink-100">Preset</span>}
                </div>
              </div>
            </div>

            <aside className="flex flex-col lg:border-l lg:border-white/10 lg:pl-5">
              {initialEpisode?.audioUrl !== openedPodcast.audioUrl && <button onClick={() => onPlayEpisode(openedPodcast)} className="mb-3 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold hover:bg-brand-500"><Play className="size-4" /> Play episode</button>}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <a href={openedPodcast.episodeUrl || openedPodcast.homeUrl || openedPodcast.audioUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/15">
                  Episode <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
                </a>
                <a href={openedPodcast.feedUrl || openedPodcast.audioUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/15">
                  {openedPodcast.feedUrl ? "RSS" : "Audio"} <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
                </a>
              </div>

              <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Live chat</h3>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {chatMessages.map((message) => (
                    <div key={message.id} className="rounded-xl bg-black/25 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-brand-200">{message.author}</span>
                        <span className="text-[10px] text-gray-500">{message.time}</span>
                      </div>
                      <p className="mt-1 text-xs leading-snug text-gray-300">{message.text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") sendChatMessage();
                    }}
                    placeholder="Chat in this room..."
                    className="min-w-0 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none placeholder:text-gray-500"
                  />
                  <button onClick={sendChatMessage} className="rounded-xl bg-brand-600 px-3 py-2 text-white hover:bg-brand-500" aria-label="Send chat message">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {episodes.length > 0 && <section aria-label="Your episodes" className="border-b border-white/10 pb-4">
            <h2 className="mb-2 font-display text-lg font-semibold">Your episodes</h2>
            <ul className="divide-y divide-white/10">
              {episodes.map((episode, index) => <li key={index}>
                <button onClick={() => onOpenEpisode(episode)} className="flex w-full items-center gap-3 py-2.5 pr-10 text-left text-sm hover:text-brand-300">
                  <Play className="size-4 shrink-0 text-brand-300" /><span className="truncate">{episode.title}</span>
                </button>
              </li>)}
            </ul>
          </section>}
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search live podcasts..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder-gray-500 focus:border-pink-400/50"
              />
            </div>
            <div className="flex overflow-x-auto rounded-xl border border-white/10 bg-black/40 custom-scrollbar">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${selectedCategory === category ? "bg-white/10 text-white font-bold" : "text-gray-400 hover:text-white"}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              {error}
            </div>
          )}

          {isLoading ? (
            <p role="status" className="py-4 text-sm text-zinc-400">Loading live podcasts…</p>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-sm text-zinc-400">No live podcasts match this filter.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {filtered.map((podcast) => (
                <li key={podcast.id}>
                  <button onClick={() => selectPodcast(podcast)} aria-label={`Play ${podcast.showTitle}`} aria-current={initialEpisode?.audioUrl === podcast.audioUrl ? "true" : undefined}
                    className="flex w-full items-center gap-3 rounded-lg py-3 pr-12 text-left hover:text-brand-300 sm:pr-5">
                    {podcast.imageUrl
                      ? <img src={podcast.imageUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                      : <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300"><Radio className="size-5" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{podcast.showTitle}</span>
                      <span className="block truncate text-xs text-zinc-400">{podcast.episodeTitle}</span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-zinc-400 sm:inline">{normalizeDuration(podcast.duration)}</span>
                    <Play aria-hidden="true" className="size-4 shrink-0 text-brand-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
