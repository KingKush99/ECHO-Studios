import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ExternalLink, Eye, Loader2, Play, Radio, RefreshCw, Search, Send, Volume2 } from "lucide-react";

type LivePodcast = {
  id: string;
  showTitle: string;
  episodeTitle: string;
  publisher: string;
  category: string;
  description: string;
  feedUrl: string;
  homeUrl: string;
  episodeUrl: string;
  imageUrl: string;
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

export function ListenFeedView() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [podcasts, setPodcasts] = useState<LivePodcast[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [openedPodcastId, setOpenedPodcastId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState(DEFAULT_CHAT_MESSAGES);

  const openedPodcast = openedPodcastId ? podcasts.find((podcast) => podcast.id === openedPodcastId) || null : null;
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
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/live-podcasts");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Live podcasts are unavailable.");
      const nextPodcasts = Array.isArray(result.podcasts) ? result.podcasts.filter((podcast: LivePodcast) => podcast.audioUrl) : [];
      setPodcasts(nextPodcasts);
      setSelectedId((current) => (nextPodcasts.some((podcast: LivePodcast) => podcast.id === current) ? current : nextPodcasts[0]?.id || ""));
    } catch (err: any) {
      setError(err.message || "Live podcasts are unavailable.");
      setPodcasts([]);
      setSelectedId("");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPodcasts();
  }, []);

  useEffect(() => {
    if (!audioRef.current || !openedPodcast) return;
    audioRef.current.load();
  }, [openedPodcast?.audioUrl]);

  const selectPodcast = (podcast: LivePodcast) => {
    setSelectedId(podcast.id);
    setOpenedPodcastId(podcast.id);
    setChatMessages([
      { id: `${podcast.id}-room`, author: "ECHO", text: `Opened ${podcast.showTitle}. You are now in the live chat.`, time: "Now" },
      ...DEFAULT_CHAT_MESSAGES,
    ]);
    window.setTimeout(() => {
      audioRef.current?.play().catch(() => {});
    }, 100);
  };

  const closeRoom = () => {
    audioRef.current?.pause();
    setOpenedPodcastId("");
    setChatDraft("");
  };

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!text) return;
    setChatMessages((current) => [{ id: `${Date.now()}`, author: "You", text, time: "Now" }, ...current]);
    setChatDraft("");
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-36 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-pink-100">
            <span className="h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_12px_rgba(244,114,182,0.9)]" />
            Live
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Live Podcasts</h1>
          <p className="text-sm text-gray-400">Playable rooms from live public feeds plus ECHO preset rooms when feeds are unavailable.</p>
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
        <section className="min-h-[calc(100vh-10rem)] rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button onClick={closeRoom} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Back to live
            </button>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">{formatListeners(openedPodcast.listeners)} listening</span>
          </div>

          <div className="grid min-h-[calc(100vh-16rem)] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
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

            <aside className="flex min-h-[58vh] flex-col rounded-3xl border border-white/10 bg-[#101126] p-4">
              <audio ref={audioRef} controls className="mb-3 w-full" preload="none">
                <source src={openedPodcast.audioUrl} />
              </audio>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <a href={openedPodcast.episodeUrl || openedPodcast.homeUrl || openedPodcast.audioUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/15">
                  Episode <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
                </a>
                <a href={openedPodcast.feedUrl || openedPodcast.audioUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/15">
                  {openedPodcast.feedUrl ? "RSS" : "Audio"} <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
                </a>
              </div>

              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Live chat</h3>
                  <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold text-gray-300">Room chat</span>
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
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="aspect-[4/5] animate-pulse rounded-2xl sm:rounded-[28px] bg-white/5" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-400">
              No live podcast rooms match this filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {filtered.map((podcast) => {
                const isSelected = selectedId === podcast.id;
                return (
                  <button
                    key={podcast.id}
                    onClick={() => selectPodcast(podcast)}
                    className={`group relative aspect-[4/5] overflow-hidden rounded-2xl border text-left shadow-2xl transition-all sm:rounded-[28px] ${isSelected ? "border-pink-400/80 ring-2 ring-pink-400/30" : "border-white/10 hover:border-white/30"}`}
                    aria-label={`Play ${podcast.showTitle}`}
                  >
                    {podcast.imageUrl ? (
                      <img src={podcast.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-slate-900 to-pink-700" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/78" />
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-xs font-bold text-white backdrop-blur sm:left-4 sm:top-4 sm:gap-1.5 sm:px-2.5 sm:text-sm">
                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {formatListeners(podcast.listeners)}
                    </div>
                    <div className="absolute right-3 top-3 max-w-[46%] truncate rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold text-white backdrop-blur sm:right-4 sm:top-4 sm:px-2.5 sm:text-xs">
                      {podcast.category}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-end gap-2 sm:bottom-4 sm:left-4 sm:right-4 sm:gap-3">
                      <div className="relative h-12 w-12 shrink-0 rounded-full border-2 border-pink-400 bg-black/40 p-1 shadow-[0_0_18px_rgba(236,72,153,0.75)] sm:h-16 sm:w-16">
                        {podcast.imageUrl ? <img src={podcast.imageUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <Radio className="h-full w-full p-2 text-white" />}
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-pink-500 px-1.5 py-0.5 text-[10px] font-black italic text-white shadow-lg sm:px-2 sm:text-[11px]">
                          LIVE
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <h3 className="truncate text-sm font-black text-white drop-shadow sm:text-lg">{podcast.showTitle}</h3>
                        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-white/85 sm:text-sm">{podcast.episodeTitle}</p>
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-white/80 sm:gap-2 sm:text-xs">
                          <Play className="h-3.5 w-3.5 fill-current" />
                          {normalizeDuration(podcast.duration)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
