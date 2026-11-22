import { useEffect, useState } from "react";
import { Clock, Flame, Headphones, Mic2, Play, Search, SlidersHorizontal, UserCircle } from "lucide-react";

type TopPodcast = {
  id: string;
  showTitle: string;
  episodeTitle: string;
  publisher: string;
  category: string;
  description: string;
  audioUrl: string;
  duration: string;
  listeners: number;
};

const FALLBACK_TOP_PODCASTS: TopPodcast[] = [
  {
    id: "echo-ai-voices",
    showTitle: "The Voice Lab",
    episodeTitle: "Why AI Voices Still Sound Robotic",
    publisher: "ECHO Studios",
    category: "Voice",
    description: "A playable ECHO preset about natural AI voice quality.",
    audioUrl: "/api/preset-audio/echo-ai-voices",
    duration: "14:20",
    listeners: 186,
  },
  {
    id: "echo-hour-builder",
    showTitle: "Hour Builder Live",
    episodeTitle: "Designing a Podcast That Can Hold Sixty Minutes",
    publisher: "ECHO Studios",
    category: "Production",
    description: "A playable ECHO preset about long-form podcast structure.",
    audioUrl: "/api/preset-audio/echo-hour-builder",
    duration: "22:45",
    listeners: 94,
  },
  {
    id: "echo-publish-room",
    showTitle: "Publish Room",
    episodeTitle: "RSS, Artwork, Audio Hosting, and Going Public",
    publisher: "ECHO Studios",
    category: "Publishing",
    description: "A playable ECHO preset about getting podcasts online.",
    audioUrl: "/api/preset-audio/echo-publish-room",
    duration: "18:08",
    listeners: 142,
  },
  {
    id: "echo-cover-clinic",
    showTitle: "Cover Clinic",
    episodeTitle: "Making Podcast Artwork That Reads at Thumbnail Size",
    publisher: "ECHO Studios",
    category: "Design",
    description: "A playable ECHO preset about podcast cover design.",
    audioUrl: "/api/preset-audio/echo-cover-clinic",
    duration: "11:36",
    listeners: 67,
  },
];

function formatListeners(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

export function SearchView({ onPlayEpisode, playingId }: { onPlayEpisode: (podcast: TopPodcast) => void; playingId?: string }) {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<"a-z" | "old-new" | "topic" | "popularity" | "duration">("popularity");
  const [searchCategory, setSearchCategory] = useState<"all" | "podcasts" | "users">("all");
  const [topPodcasts, setTopPodcasts] = useState<TopPodcast[]>(FALLBACK_TOP_PODCASTS);
  const filteredPodcasts = topPodcasts.filter((podcast) => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) return true;
    return (
      podcast.showTitle.toLowerCase().includes(lowered) ||
      podcast.episodeTitle.toLowerCase().includes(lowered) ||
      podcast.publisher.toLowerCase().includes(lowered) ||
      podcast.category.toLowerCase().includes(lowered)
    );
  });

  const filterOptions = [
    { id: "a-z", label: "A-Z" },
    { id: "old-new", label: "Old-New" },
    { id: "topic", label: "Topic" },
    { id: "popularity", label: "Popularity" },
    { id: "duration", label: "Duration" },
  ];

  useEffect(() => {
    fetch("/api/preset-podcasts")
      .then((response) => response.json())
      .then((result) => {
        const podcasts = Array.isArray(result.podcasts) ? result.podcasts.filter((podcast: TopPodcast) => podcast.audioUrl) : [];
        if (podcasts.length > 0) {
          setTopPodcasts(podcasts);

        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="border-b border-white/10 pb-5">
        <div className="relative">
          <input
            type="text"
            placeholder="Search users, podcasts, topics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-zinc-500 outline-none focus:border-brand-400"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-400" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-4 justify-between items-start sm:items-center">
          <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
            {(["all", "podcasts", "users"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSearchCategory(cat)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${searchCategory === cat ? "bg-brand-500 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 custom-scrollbar">
            <SlidersHorizontal className="w-4 h-4 text-brand-400 shrink-0 mr-1" />
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFilterType(opt.id as typeof filterType)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${filterType === opt.id ? "bg-brand-500/20 border-brand-500 text-brand-400" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {searchCategory !== "users" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-brand-400" /> Top Podcasts
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPodcasts.map((podcast, index) => {
                const isSelected = playingId === podcast.id;
                return (
                  <button
                    key={podcast.id}
                    onClick={() => onPlayEpisode(podcast)}
                    className={`bg-white/5 border rounded-2xl p-4 flex gap-4 hover:bg-white/10 transition-colors cursor-pointer group text-left ${isSelected ? "border-brand-400/70" : "border-white/5"}`}
                    aria-label={`Play ${podcast.showTitle}`}
                  >
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                        <Play className="w-8 h-8 text-white fill-current" />
                      </div>
                      <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${podcast.id}-${index}&backgroundColor=1e1b4b,312e81,831843`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-brand-300">{podcast.category}</div>
                      <h4 className="font-bold text-white truncate group-hover:text-brand-300 transition-colors">{podcast.showTitle}</h4>
                      <p className="text-sm text-gray-400 truncate">{podcast.episodeTitle}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-400" /> {formatListeners(podcast.listeners)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {podcast.duration}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {searchCategory !== "podcasts" && (
          <div>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-purple-400" /> People
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-pointer group">
                  <div className="w-14 h-14 rounded-full bg-[#08091a] border border-white/10 overflow-hidden flex-shrink-0">
                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=user${i}&backgroundColor=111229`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate group-hover:text-purple-300 transition-colors">Creator User_{i}</h4>
                    <p className="text-sm text-gray-400 truncate">@creator_{i}</p>
                  </div>
                  <button className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors">Follow</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
