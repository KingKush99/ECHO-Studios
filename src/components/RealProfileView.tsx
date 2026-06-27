import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, Clock, Eye, Grid3x3, Mail, MessageSquare, Pencil, Play, Search, Settings, UserCheck, UserPlus, X } from "lucide-react";
import { PodcastMetadata } from "../types";
import { EditProfileModal } from "./EditProfileModal";
import { SettingsModal } from "./SettingsModal";

type DropdownType = "posts" | "followers" | "following";
type MailboxPanelId = "messages" | "friends" | "visits";
type ProfileContentTab = "published" | "drafts";

type LocalProfile = {
  username: string;
  displayName: string;
  bio: string;
  mascotId: string;
};

type ProfilePost = {
  id: string;
  title: string;
  description: string;
  category: string;
  durationLabel: string;
  createdAtLabel: string;
  coverUrl?: string;
  coverSeed: string;
};

type ConnectionRecord = {
  username: string;
  displayName: string;
  bio: string;
  avatarSeed: string;
};

type MailboxItem = {
  name: string;
  handle: string;
  detail: string;
  time: string;
};

const PROFILE_STORAGE_KEY = "echo.localProfile.v1";

const DEFAULT_PROFILE: LocalProfile = {
  username: "local_creator",
  displayName: "Local Creator",
  bio: "Podcasts generated and edited in this browser.",
  mascotId: "14",
};

const EMPTY_FOLLOWERS: ConnectionRecord[] = [];
const EMPTY_FOLLOWING: ConnectionRecord[] = [];

const MAILBOX_SECTIONS: Array<{
  id: MailboxPanelId;
  title: string;
  icon: "message" | "friend" | "visit";
  tone: string;
  items: MailboxItem[];
}> = [
  { id: "messages", title: "Message Requests", icon: "message", tone: "border-blue-400/30 bg-blue-500/10 text-blue-100", items: [] },
  { id: "friends", title: "Friend Requests", icon: "friend", tone: "border-purple-400/30 bg-purple-500/10 text-purple-100", items: [] },
  { id: "visits", title: "Profile Visits", icon: "visit", tone: "border-brand-400/30 bg-brand-500/10 text-brand-100", items: [] },
];

function loadLocalProfile(): LocalProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function getPodcastDuration(data: PodcastMetadata) {
  if (data.script.length === 0) return 0;
  return data.script.reduce((max, line) => Math.max(max, line.estimatedStartSeconds + line.durationSeconds), 0);
}

function getPodcastKey(data: PodcastMetadata, index: number) {
  return `${data.title}-${data.musicMood}-${data.script.length}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getCategory(data: PodcastMetadata) {
  if (data.promptImages?.length) return "Image prompt";
  if (data.script.length > 80) return "Long form";
  if (data.speakers.length > 2) return "Roundtable";
  return "Generated";
}

function getCreatedAtLabel(data: PodcastMetadata) {
  if (!data.coverArt?.createdAt) return "Saved locally";
  const createdAt = new Date(data.coverArt.createdAt);
  if (Number.isNaN(createdAt.getTime())) return "Saved locally";
  return createdAt.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function buildPosts(generatedPodcasts: PodcastMetadata[]): ProfilePost[] {
  return generatedPodcasts.map((podcast, index) => ({
    id: getPodcastKey(podcast, index),
    title: podcast.title,
    description: podcast.description,
    category: getCategory(podcast),
    durationLabel: formatDuration(getPodcastDuration(podcast)),
    createdAtLabel: getCreatedAtLabel(podcast),
    coverUrl: podcast.coverArt?.dataUrl || podcast.promptImages?.[0]?.dataUrl,
    coverSeed: podcast.title || `podcast-${index}`,
  }));
}

export function ProfileView({ onHome, generatedPodcasts }: { onHome: () => void; generatedPodcasts: PodcastMetadata[] }) {
  const [profile, setProfile] = useState<LocalProfile>(loadLocalProfile);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [activeMailboxPanel, setActiveMailboxPanel] = useState<MailboxPanelId>("messages");
  const [activeDropdown, setActiveDropdown] = useState<DropdownType | null>(null);
  const [activeContentTab, setActiveContentTab] = useState<ProfileContentTab>("drafts");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: ConnectionRecord } | null>(null);
  const [notice, setNotice] = useState("");
  const posts = useMemo(() => buildPosts(generatedPodcasts), [generatedPodcasts]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Local profile edits are best-effort when browser storage is unavailable.
    }
  }, [profile]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
    }
    document.addEventListener("click", closeContextMenu);
    return () => document.removeEventListener("click", closeContextMenu);
  }, []);

  const saveProfile = (nextProfile: LocalProfile) => {
    setProfile(nextProfile);
    setIsEditModalOpen(false);
  };

  const openContextMenu = (event: ReactMouseEvent, user: ConnectionRecord) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, profile: user });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-36">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onHome} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button onClick={onHome} className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.55)] hover:bg-red-500" aria-label="Close profile and return home">
          <X className="h-5 w-5" />
        </button>
      </div>

      <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 mb-5">
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          <button
            onClick={() => setIsInboxOpen((current) => !current)}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white transition-colors relative"
            aria-label="Open profile mailbox"
          >
            <Mail className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white transition-colors"
            aria-label="Open profile settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {isInboxOpen && (
            <MailboxPanel activePanel={activeMailboxPanel} onPanelChange={setActiveMailboxPanel} />
          )}
        </div>
        <div className="grid grid-cols-[92px_1fr] sm:grid-cols-[144px_1fr] gap-5 sm:gap-7 items-start">
          <button className="relative group text-left" onClick={() => setIsEditModalOpen(true)} aria-label="Edit profile image">
            <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-brand-500 via-pink-500 to-purple-600 p-1">
              <div className="w-full h-full rounded-full bg-[#08091a] border-4 border-[#08091a] overflow-hidden flex items-center justify-center relative">
                <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profile.mascotId}&backgroundColor=111229`} alt={`${profile.displayName} avatar`} className="w-full h-full object-cover" />
                <Pencil className="absolute bottom-4 right-0 h-6 w-6 translate-x-1/2 scale-x-[-1] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]" />
              </div>
            </div>
          </button>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 pr-24">
              <div className="min-w-0">
                <h2 className="truncate text-xl sm:text-2xl font-display font-bold text-white">@{profile.username}</h2>
                <p className="text-xs text-gray-500">Local browser profile</p>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-white text-base">{profile.displayName}</h3>
              <p className="text-sm text-gray-400 max-w-xl">{profile.bio}</p>
            </div>

            <div className="relative">
              <div className="grid grid-cols-3 gap-2">
                <StatButton label="posts" value={posts.length.toString()} active={activeDropdown === "posts"} onClick={() => setActiveDropdown(activeDropdown === "posts" ? null : "posts")} />
                <StatButton label="followers" value={EMPTY_FOLLOWERS.length.toString()} active={activeDropdown === "followers"} onClick={() => setActiveDropdown(activeDropdown === "followers" ? null : "followers")} />
                <StatButton label="following" value={EMPTY_FOLLOWING.length.toString()} active={activeDropdown === "following"} onClick={() => setActiveDropdown(activeDropdown === "following" ? null : "following")} />
              </div>

              {activeDropdown && (
                <ProfileDropdown
                  type={activeDropdown}
                  profile={profile}
                  posts={posts}
                  followers={EMPTY_FOLLOWERS}
                  following={EMPTY_FOLLOWING}
                  onClose={() => setActiveDropdown(null)}
                  onOpenContextMenu={openContextMenu}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center gap-12 font-medium text-sm border-b border-white/5 mb-6">
        <button
          onClick={() => setActiveContentTab("published")}
          className={`flex items-center gap-2 pb-3 tracking-widest uppercase ${activeContentTab === "published" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          <Grid3x3 className="w-4 h-4" /> Published
        </button>
        <button
          onClick={() => setActiveContentTab("drafts")}
          className={`flex items-center gap-2 pb-3 tracking-widest uppercase ${activeContentTab === "drafts" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
        >
          <Bookmark className="w-4 h-4" /> Drafts
          {posts.length > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white">{posts.length}</span>}
        </button>
      </div>

      {activeContentTab === "published" ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <Grid3x3 className="mx-auto mb-3 h-9 w-9 text-gray-400" />
          <h3 className="text-lg font-bold text-white">No public posts yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">Publishing is not public until the episode is submitted to YouTube or a podcast platform from a public feed.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <Play className="mx-auto mb-3 h-9 w-9 text-brand-300" />
          <h3 className="text-lg font-bold text-white">No local drafts yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">Create a podcast and it will appear here as a saved local draft.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {posts.map((post) => (
            <div key={post.id} className="aspect-square bg-white/5 rounded-xl border border-white/5 relative group cursor-pointer overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/45 backdrop-blur-sm transition-all z-10">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Clock className="w-5 h-5" /> {post.durationLabel}
                </div>
              </div>
              {post.coverUrl ? (
                <img src={post.coverUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt={`${post.title} cover`} />
              ) : (
                <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${post.coverSeed}&backgroundColor=1e1b4b,312e81,831843`} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" alt={`${post.title} cover`} />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-3">
                <div className="text-xs font-bold uppercase tracking-widest text-brand-200">{post.category}</div>
                <div className="line-clamp-2 text-sm font-bold text-white">{post.title}</div>
                <div className="mt-1 text-[11px] text-gray-300">{post.createdAtLabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {notice && <div className="fixed left-1/2 top-24 z-[110] -translate-x-1/2 rounded-xl border border-white/10 bg-[#111229] px-4 py-3 text-sm font-bold text-white shadow-2xl">{notice}</div>}

      {contextMenu && (
        <div
          className="fixed bg-[#1a1b36] border border-white/10 rounded-lg shadow-2xl py-1 z-[100] min-w-[170px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => setContextMenu(null)} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-brand-500/20 flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Visit Profile
          </button>
          <button onClick={() => { setNotice(`Friend request queued for ${contextMenu.profile.displayName}.`); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-brand-500/20 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Friend
          </button>
          <button onClick={() => { setNotice(`Message draft opened for ${contextMenu.profile.displayName}.`); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-brand-500/20 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Send Message
          </button>
        </div>
      )}

      {isEditModalOpen && (
        <EditProfileModal
          currentProfile={profile}
          onClose={() => setIsEditModalOpen(false)}
          onSave={saveProfile}
        />
      )}
      {isSettingsModalOpen && <SettingsModal onClose={() => setIsSettingsModalOpen(false)} />}
    </div>
  );
}

function StatButton({ label, value, active, onClick }: { label: string; value: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-brand-400/50 bg-brand-500/15" : "border-white/10 bg-black/25 hover:bg-white/10"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold text-white">{value}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${active ? "rotate-180" : ""}`} />
      </div>
      <div className="text-xs capitalize text-gray-400">{label}</div>
    </button>
  );
}

function MailboxPanel({ activePanel, onPanelChange }: { activePanel: MailboxPanelId; onPanelChange: (panel: MailboxPanelId) => void }) {
  const activeSection = MAILBOX_SECTIONS.find((section) => section.id === activePanel) || MAILBOX_SECTIONS[0];

  return (
    <div className="absolute right-0 top-12 z-50 w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#111229] text-left shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
      <div className="grid grid-cols-3 gap-2 border-b border-white/10 bg-black/20 p-3">
        {MAILBOX_SECTIONS.map((section) => {
          const Icon = section.icon === "message" ? MessageSquare : section.icon === "friend" ? UserPlus : Eye;
          const isActive = activePanel === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onPanelChange(section.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${isActive ? section.tone : "border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/10"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4" />
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-black text-white">{section.items.length}</span>
              </div>
              <div className="mt-2 text-xs font-bold leading-tight">{section.title}</div>
            </button>
          );
        })}
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">{activeSection.title}</h4>
          <span className="text-xs text-gray-500">Real account data</span>
        </div>
        {activeSection.items.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6 text-center text-sm text-gray-400">
            No real {activeSection.title.toLowerCase()} yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {activeSection.items.map((item) => (
              <button key={`${activeSection.id}-${item.handle}`} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-left hover:bg-white/10">
                <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${item.handle}&backgroundColor=111229`} alt="" className="h-10 w-10 rounded-full border border-white/10 bg-[#08091a]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">{item.name}</span>
                  <span className="block truncate text-xs text-brand-200">@{item.handle}</span>
                  <span className="mt-1 block text-xs leading-snug text-gray-400">{item.detail}</span>
                </span>
                <span className="text-xs text-gray-500">{item.time}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileDropdown({
  type,
  profile,
  posts,
  followers,
  following,
  onClose,
  onOpenContextMenu,
}: {
  type: DropdownType;
  profile: LocalProfile;
  posts: ProfilePost[];
  followers: ConnectionRecord[];
  following: ConnectionRecord[];
  onClose: () => void;
  onOpenContextMenu: (event: ReactMouseEvent, user: ConnectionRecord) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredPosts = posts.filter((post) => {
    if (!normalizedQuery) return true;
    return [post.title, post.description, post.category, post.durationLabel, profile.username, profile.displayName].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const filteredFollowers = followers.filter((user) => {
    if (!normalizedQuery) return true;
    return [user.displayName, user.username, user.bio].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const filteredFollowing = following.filter((user) => {
    if (!normalizedQuery) return true;
    return [user.displayName, user.username, user.bio].some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const title = type === "posts" ? "Posts" : type === "followers" ? "Followers" : "Following";

  return (
    <div ref={dropdownRef} className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-2xl border border-white/10 bg-[#111229] shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] p-3">
        <h4 className="font-bold text-white">{title}</h4>
        <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white" aria-label={`Close ${title}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="border-b border-white/10 bg-black/20 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-brand-400/60"
          />
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {type === "posts" &&
          filteredPosts.map((post) => (
            <div key={post.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{post.title}</div>
                  <div className="mt-1 truncate text-xs text-gray-400">{post.category} · {post.createdAtLabel}</div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-gray-300">
                  <Clock className="h-3.5 w-3.5" /> {post.durationLabel}
                </div>
              </div>
            </div>
          ))}

        {type === "followers" && filteredFollowers.map((user) => (
          <div key={user.username}>
            <PersonRow user={user} onOpenContextMenu={onOpenContextMenu} />
          </div>
        ))}
        {type === "following" && filteredFollowing.map((user) => (
          <div key={user.username}>
            <PersonRow user={user} onOpenContextMenu={onOpenContextMenu} />
          </div>
        ))}

        {type === "followers" && followers.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No real followers yet.</div>}
        {type === "following" && following.length === 0 && <div className="p-6 text-center text-sm text-gray-500">Not following any real accounts yet.</div>}
        {type === "posts" && posts.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No generated podcast posts yet.</div>}
        {type === "followers" && followers.length > 0 && filteredFollowers.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No followers match this search.</div>}
        {type === "following" && following.length > 0 && filteredFollowing.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No following match this search.</div>}
        {type === "posts" && posts.length > 0 && filteredPosts.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No posts match this search.</div>}
      </div>
    </div>
  );
}

function PersonRow({
  user,
  onOpenContextMenu,
}: {
  user: ConnectionRecord;
  onOpenContextMenu: (event: ReactMouseEvent, user: ConnectionRecord) => void;
}) {
  return (
    <button
      onContextMenu={(event) => onOpenContextMenu(event, user)}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-pink-500 p-[1px] flex-shrink-0">
        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.avatarSeed}&backgroundColor=111229`} alt="" className="w-full h-full rounded-full bg-[#08091a]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate leading-tight">{user.displayName}</div>
        <div className="text-xs text-gray-400 truncate leading-tight">@{user.username}</div>
      </div>
    </button>
  );
}
