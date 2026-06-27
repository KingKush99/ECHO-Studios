import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, Eye, Grid3x3, Headphones, Mail, MessageSquare, Pencil, Play, Search, Settings, UserCheck, UserPlus, X } from "lucide-react";
import { EditProfileModal } from "./EditProfileModal";
import { SettingsModal } from "./SettingsModal";

type ProfilePost = {
  id: string;
  title: string;
  listens: string;
  category: string;
  coverSeed: string;
};

type ProfileRecord = {
  username: string;
  displayName: string;
  bio: string;
  mascotId: string;
  followers: string[];
  following: string[];
  posts: ProfilePost[];
};

type DropdownType = "posts" | "followers" | "following";
type MailboxPanelId = "messages" | "friends" | "visits";

const MAILBOX_SECTIONS: Array<{
  id: MailboxPanelId;
  title: string;
  count: string;
  icon: "message" | "friend" | "visit";
  tone: string;
  items: Array<{ name: string; handle: string; detail: string; time: string }>;
}> = [
  {
    id: "messages",
    title: "Message Requests",
    count: "3",
    icon: "message",
    tone: "border-blue-400/30 bg-blue-500/10 text-blue-100",
    items: [
      { name: "Ari Vale", handle: "ari_audio", detail: "Asked about collaborating on an AI voice episode.", time: "4m ago" },
      { name: "Nova Room", handle: "novaroom", detail: "Sent notes on your Publish Room preset.", time: "28m ago" },
      { name: "Kai Rivers", handle: "kairivers", detail: "Wants feedback on a cover art prompt.", time: "1h ago" },
    ],
  },
  {
    id: "friends",
    title: "Friend Requests",
    count: "12",
    icon: "friend",
    tone: "border-purple-400/30 bg-purple-500/10 text-purple-100",
    items: [
      { name: "Maya Chen", handle: "maya_waves", detail: "Producer and interview host.", time: "Today" },
      { name: "Signal Room", handle: "signalroom", detail: "Live room collective.", time: "Today" },
      { name: "Luna Vance", handle: "luna_reports", detail: "Reporter covering audio tools.", time: "Yesterday" },
    ],
  },
  {
    id: "visits",
    title: "Profile Visits",
    count: "24",
    icon: "visit",
    tone: "border-brand-400/30 bg-brand-500/10 text-brand-100",
    items: [
      { name: "Marcus Sterling", handle: "marcus_studio", detail: "Viewed your profile after listening to AI Voices.", time: "9m ago" },
      { name: "Dr. Arthur Li", handle: "arthur_audio", detail: "Opened your production posts.", time: "42m ago" },
      { name: "Zephyr", handle: "zephyrcasts", detail: "Visited from the Live page.", time: "2h ago" },
    ],
  },
];

const PEOPLE: ProfileRecord[] = [
  {
    username: "echocreator_99",
    displayName: "Next-Gen Audio Producer",
    bio: "Synthesizing the sound patterns of tomorrow.",
    mascotId: "14",
    followers: ["maya_waves", "marcus_studio", "luna_reports", "arthur_audio", "zephyrcasts"],
    following: ["maya_waves", "luna_reports", "signalroom"],
    posts: [
      { id: "post-1", title: "AI Voices Without the Robot Feel", listens: "12.8k", category: "Voice", coverSeed: "voice-quality" },
      { id: "post-2", title: "The Mars Colony Paradox", listens: "8.4k", category: "Science", coverSeed: "mars-colony" },
      { id: "post-3", title: "Indie Publishing Playbook", listens: "5.9k", category: "Publishing", coverSeed: "publishing" },
      { id: "post-4", title: "Prompt Images as Story Maps", listens: "3.2k", category: "Creative", coverSeed: "image-prompts" },
    ],
  },
  {
    username: "maya_waves",
    displayName: "Maya Chen",
    bio: "Fast edits, warm interviews, and creator economy stories.",
    mascotId: "maya",
    followers: ["echocreator_99", "luna_reports", "signalroom"],
    following: ["echocreator_99", "marcus_studio"],
    posts: [
      { id: "maya-1", title: "Creator Tools That Actually Save Time", listens: "21.4k", category: "Creator", coverSeed: "maya-tools" },
      { id: "maya-2", title: "How to Structure a Better Interview", listens: "14.2k", category: "Production", coverSeed: "maya-interview" },
    ],
  },
  {
    username: "marcus_studio",
    displayName: "Marcus Sterling",
    bio: "Comedy, culture, and calm skepticism for ambitious episodes.",
    mascotId: "marcus",
    followers: ["echocreator_99", "arthur_audio", "signalroom"],
    following: ["echocreator_99", "maya_waves", "zephyrcasts"],
    posts: [
      { id: "marcus-1", title: "Making Technical Stories Funny", listens: "18.7k", category: "Comedy", coverSeed: "marcus-comedy" },
      { id: "marcus-2", title: "The Counterpoint Segment", listens: "10.1k", category: "Writing", coverSeed: "marcus-counter" },
    ],
  },
  {
    username: "luna_reports",
    displayName: "Luna Vance",
    bio: "Skeptical reporting for internet-native audio shows.",
    mascotId: "luna",
    followers: ["echocreator_99", "maya_waves"],
    following: ["echocreator_99", "arthur_audio", "signalroom"],
    posts: [
      { id: "luna-1", title: "Verifying a Viral Claim", listens: "9.6k", category: "News", coverSeed: "luna-verify" },
    ],
  },
  {
    username: "arthur_audio",
    displayName: "Dr. Arthur Li",
    bio: "Academic calm, footnotes, and long-form explainers.",
    mascotId: "arthur",
    followers: ["echocreator_99", "marcus_studio"],
    following: ["echocreator_99", "luna_reports"],
    posts: [
      { id: "arthur-1", title: "The Ethics Chapter", listens: "6.2k", category: "Education", coverSeed: "arthur-ethics" },
    ],
  },
  {
    username: "zephyrcasts",
    displayName: "Zephyr",
    bio: "Philosophical detours and quiet endings.",
    mascotId: "zephyr",
    followers: ["echocreator_99", "marcus_studio"],
    following: ["echocreator_99", "signalroom"],
    posts: [
      { id: "zephyr-1", title: "Why Endings Matter", listens: "4.8k", category: "Essay", coverSeed: "zephyr-ending" },
    ],
  },
  {
    username: "signalroom",
    displayName: "Signal Room",
    bio: "A collaborative account for live rooms and creator showcases.",
    mascotId: "signal",
    followers: ["echocreator_99", "maya_waves", "marcus_studio"],
    following: ["echocreator_99", "luna_reports"],
    posts: [
      { id: "signal-1", title: "Friday Live Room Replay", listens: "31.9k", category: "Live", coverSeed: "signal-live" },
    ],
  },
];

function findProfile(username: string, directory: ProfileRecord[]) {
  return directory.find((profile) => profile.username === username) || directory[0];
}

function getPeople(usernames: string[], directory: ProfileRecord[]) {
  return usernames.map((username) => findProfile(username, directory)).filter(Boolean);
}

export function ProfileView({ onHome }: { onHome: () => void }) {
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [directory, setDirectory] = useState(PEOPLE);
  const [currentUsername, setCurrentUsername] = useState(PEOPLE[0].username);
  const [profileHistory, setProfileHistory] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [activeMailboxPanel, setActiveMailboxPanel] = useState<MailboxPanelId>("messages");
  const [activeDropdown, setActiveDropdown] = useState<DropdownType | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: ProfileRecord } | null>(null);
  const [notice, setNotice] = useState("");

  const profile = findProfile(currentUsername, directory);
  const isOwnProfile = profile.username === directory[0].username;

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

  const visitProfile = (username: string) => {
    if (username === currentUsername) {
      setActiveDropdown(null);
      setContextMenu(null);
      return;
    }
    setProfileHistory((current) => [...current, currentUsername]);
    setCurrentUsername(username);
    setActiveDropdown(null);
    setContextMenu(null);
    setIsInboxOpen(false);
  };

  const goBack = () => {
    setProfileHistory((current) => {
      if (current.length === 0) {
        onHome();
        return current;
      }
      const nextHistory = current.slice(0, -1);
      setCurrentUsername(current[current.length - 1]);
      setActiveDropdown(null);
      setContextMenu(null);
      return nextHistory;
    });
  };

  const openContextMenu = (event: ReactMouseEvent, user: ProfileRecord) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, profile: user });
  };

  const saveProfile = (nextProfile: { username: string; displayName: string; bio: string; mascotId: string }) => {
    setDirectory((current) => {
      const updated = current.map((item, index) => (index === 0 ? { ...item, ...nextProfile } : item));
      return updated.map((item) => ({
        ...item,
        followers: item.followers.map((username) => (username === current[0].username ? nextProfile.username : username)),
        following: item.following.map((username) => (username === current[0].username ? nextProfile.username : username)),
      }));
    });
    setCurrentUsername(nextProfile.username);
    setIsEditModalOpen(false);
  };

  if (!isSignedIn) {
    return (
      <div className="max-w-md mx-auto p-6 pb-32 mt-12 flex flex-col items-center justify-center space-y-6 text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center border-4 border-[#08091a] shadow-xl">
          <UserPlus className="w-10 h-10 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">Create your Profile</h2>
          <p className="text-gray-400 mt-2 text-sm max-w-sm mx-auto">Sign in to publish your podcasts, gain followers, and access your personalized studio dashboard.</p>
        </div>
        <button
          onClick={() => setIsSignedIn(true)}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
        >
          Sign In with Echo
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-36">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={goBack} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button onClick={onHome} className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.55)] hover:bg-red-500" aria-label="Close profile and return home">
          <X className="h-5 w-5" />
        </button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 mb-8">
        <div className="grid grid-cols-[92px_1fr] sm:grid-cols-[144px_1fr] gap-5 sm:gap-7 items-start">
          <button className="relative group text-left" onClick={() => isOwnProfile && setIsEditModalOpen(true)} aria-label="Edit profile image">
            <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-brand-500 via-pink-500 to-purple-600 p-1">
              <div className="w-full h-full rounded-full bg-[#08091a] border-4 border-[#08091a] overflow-hidden flex items-center justify-center relative">
                <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profile.mascotId}&backgroundColor=111229`} alt={`${profile.displayName} avatar`} className="w-full h-full object-cover" />
                {isOwnProfile && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="w-6 h-6 text-white drop-shadow-md" />
                  </div>
                )}
              </div>
            </div>
          </button>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl sm:text-2xl font-display font-bold text-white">@{profile.username}</h2>
                <p className="text-xs text-gray-500">ECHO profile</p>
              </div>

              <div className="flex items-center gap-2 relative">
                <button
                  onClick={() => setIsInboxOpen((current) => !current)}
                  className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white transition-colors relative"
                  aria-label="Open profile mailbox"
                >
                  <Mail className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-500 rounded-full border border-[#08091a]" />
                </button>

                {isOwnProfile && (
                  <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white transition-colors"
                    aria-label="Open profile settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                )}

                {!isOwnProfile && (
                  <button onClick={() => setNotice(`Friend request sent to ${profile.displayName}.`)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-500">
                    <UserPlus className="h-4 w-4" /> Add
                  </button>
                )}

                {isInboxOpen && (
                  <MailboxPanel activePanel={activeMailboxPanel} onPanelChange={setActiveMailboxPanel} />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-white text-base">{profile.displayName}</h3>
              <p className="text-sm text-gray-400 max-w-xl">{profile.bio}</p>
              <a href={`https://echostudios.app/${profile.username}`} className="text-sm text-brand-300 hover:text-brand-200">echostudios.app/{profile.username}</a>
            </div>

            <div className="relative">
              <div className="grid grid-cols-3 gap-2">
                <StatButton label="posts" value={profile.posts.length.toString()} active={activeDropdown === "posts"} onClick={() => setActiveDropdown(activeDropdown === "posts" ? null : "posts")} />
                <StatButton label="followers" value={profile.followers.length >= 5 && isOwnProfile ? "10.2k" : profile.followers.length.toString()} active={activeDropdown === "followers"} onClick={() => setActiveDropdown(activeDropdown === "followers" ? null : "followers")} />
                <StatButton label="following" value={profile.following.length.toString()} active={activeDropdown === "following"} onClick={() => setActiveDropdown(activeDropdown === "following" ? null : "following")} />
              </div>

              {activeDropdown && (
                <ProfileDropdown
                  type={activeDropdown}
                  profile={profile}
                  directory={directory}
                  onClose={() => setActiveDropdown(null)}
                  onVisitProfile={visitProfile}
                  onOpenContextMenu={openContextMenu}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center gap-12 font-medium text-sm border-b border-white/5 mb-6">
        <button className="flex items-center gap-2 text-white border-b-2 border-white pb-3 tracking-widest uppercase">
          <Grid3x3 className="w-4 h-4" /> Published
        </button>
        <button className="flex items-center gap-2 text-gray-500 pb-3 tracking-widest uppercase">
          <Bookmark className="w-4 h-4" /> Drafts
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {profile.posts.map((post) => (
          <div key={post.id} className="aspect-square bg-white/5 rounded-xl border border-white/5 relative group cursor-pointer overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/45 backdrop-blur-sm transition-all z-10">
              <div className="flex items-center gap-2 text-white font-bold">
                <Play className="w-6 h-6 fill-current" /> {post.listens}
              </div>
            </div>
            <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${post.coverSeed}&backgroundColor=1e1b4b,312e81,831843`} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" alt={`${post.title} cover`} />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-200">{post.category}</div>
              <div className="line-clamp-2 text-sm font-bold text-white">{post.title}</div>
            </div>
          </div>
        ))}
      </div>

      {notice && <div className="fixed left-1/2 top-24 z-[110] -translate-x-1/2 rounded-xl border border-white/10 bg-[#111229] px-4 py-3 text-sm font-bold text-white shadow-2xl">{notice}</div>}

      {contextMenu && (
        <div
          className="fixed bg-[#1a1b36] border border-white/10 rounded-lg shadow-2xl py-1 z-[100] min-w-[170px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => visitProfile(contextMenu.profile.username)} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-brand-500/20 flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Visit Profile
          </button>
          <button onClick={() => { setNotice(`Friend request sent to ${contextMenu.profile.displayName}.`); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-brand-500/20 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Friend
          </button>
          <button onClick={() => { setNotice(`Message started with ${contextMenu.profile.displayName}.`); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-brand-500/20 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Send Message
          </button>
        </div>
      )}

      {isEditModalOpen && (
        <EditProfileModal
          currentProfile={directory[0]}
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
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-black text-white">{section.count}</span>
              </div>
              <div className="mt-2 text-xs font-bold leading-tight">{section.title}</div>
            </button>
          );
        })}
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">{activeSection.title}</h4>
          <span className="text-xs text-gray-500">Open any row for full context</span>
        </div>
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
      </div>
    </div>
  );
}

function ProfileDropdown({
  type,
  profile,
  directory,
  onClose,
  onVisitProfile,
  onOpenContextMenu,
}: {
  type: DropdownType;
  profile: ProfileRecord;
  directory: ProfileRecord[];
  onClose: () => void;
  onVisitProfile: (username: string) => void;
  onOpenContextMenu: (event: ReactMouseEvent, user: ProfileRecord) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const followers = getPeople(profile.followers, directory);
  const following = getPeople(profile.following, directory);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredPosts = profile.posts.filter((post) => {
    if (!normalizedQuery) return true;
    return [post.title, post.category, post.listens, profile.username, profile.displayName].some((value) => value.toLowerCase().includes(normalizedQuery));
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
                  <button
                    onClick={() => onVisitProfile(profile.username)}
                    onContextMenu={(event) => onOpenContextMenu(event, profile)}
                    className="mt-1 text-xs text-brand-300 hover:text-brand-200"
                  >
                    @{profile.username}
                  </button>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-gray-300">
                  <Headphones className="h-3.5 w-3.5" /> {post.listens}
                </div>
              </div>
            </div>
          ))}

        {type === "followers" &&
          filteredFollowers.map((user) => (
            <div key={user.username}>
              <PersonRow user={user} onVisitProfile={onVisitProfile} onOpenContextMenu={onOpenContextMenu} />
            </div>
          ))}

        {type === "following" &&
          filteredFollowing.map((user) => (
            <div key={user.username}>
              <PersonRow user={user} onVisitProfile={onVisitProfile} onOpenContextMenu={onOpenContextMenu} />
            </div>
          ))}

        {type === "followers" && followers.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No followers yet.</div>}
        {type === "following" && following.length === 0 && <div className="p-6 text-center text-sm text-gray-500">Not following anyone yet.</div>}
        {type === "posts" && profile.posts.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No posts yet.</div>}
        {type === "followers" && followers.length > 0 && filteredFollowers.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No followers match this search.</div>}
        {type === "following" && following.length > 0 && filteredFollowing.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No following match this search.</div>}
        {type === "posts" && profile.posts.length > 0 && filteredPosts.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No posts match this search.</div>}
      </div>
    </div>
  );
}

function PersonRow({
  user,
  onVisitProfile,
  onOpenContextMenu,
}: {
  user: ProfileRecord;
  onVisitProfile: (username: string) => void;
  onOpenContextMenu: (event: ReactMouseEvent, user: ProfileRecord) => void;
}) {
  return (
    <button
      onClick={() => onVisitProfile(user.username)}
      onContextMenu={(event) => onOpenContextMenu(event, user)}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-pink-500 p-[1px] flex-shrink-0">
        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.mascotId}&backgroundColor=111229`} alt="" className="w-full h-full rounded-full bg-[#08091a]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate leading-tight">{user.displayName}</div>
        <div className="text-xs text-gray-400 truncate leading-tight">@{user.username}</div>
      </div>
    </button>
  );
}
