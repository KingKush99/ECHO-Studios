import { type ReactNode, useState } from "react";
import { X, Volume2, Moon, Bell, Lock, User, Accessibility, Globe, HardDrive, Cpu, Info } from "lucide-react";

const SETTINGS_CATEGORIES = [
  { id: "visual", icon: <Moon className="w-4 h-4" />, name: "Visual" },
  { id: "audio", icon: <Volume2 className="w-4 h-4" />, name: "Audio" },
  { id: "notifications", icon: <Bell className="w-4 h-4" />, name: "Notifications" },
  { id: "privacy", icon: <Lock className="w-4 h-4" />, name: "Privacy" },
  { id: "account", icon: <User className="w-4 h-4" />, name: "Account" },
  { id: "accessibility", icon: <Accessibility className="w-4 h-4" />, name: "Accessibility" },
  { id: "language", icon: <Globe className="w-4 h-4" />, name: "Language" },
  { id: "storage", icon: <HardDrive className="w-4 h-4" />, name: "Storage" },
  { id: "advanced", icon: <Cpu className="w-4 h-4" />, name: "Advanced" },
  { id: "about", icon: <Info className="w-4 h-4" />, name: "About" },
];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState("visual");
  const [visualData, setVisualData] = useState({ brightness: 80, contrast: 100, animations: true });
  const [audioData, setAudioData] = useState({ masterVolume: 100, normalize: true, hdAudio: false });
  const [notificationData, setNotificationData] = useState({ messages: true, friends: true, visits: false });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 px-3 backdrop-blur-sm sm:p-4 sm:px-4">
       <div className="grid max-h-[90vh] w-[min(96vw,56rem)] grid-cols-[132px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d21] shadow-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] sm:grid-cols-[180px_minmax(0,1fr)] sm:rounded-3xl md:grid-cols-[16rem_minmax(0,1fr)]">
          {/* Sidebar */}
          <div className="flex max-h-[90vh] min-h-0 flex-col border-r border-white/10 bg-black/20">
            <div className="shrink-0 border-b border-white/10 p-4 sm:p-6">
               <h2 className="font-display text-lg font-medium text-white sm:text-xl">Settings</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
              {SETTINGS_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-xs font-medium transition-colors sm:gap-3 sm:px-4 sm:text-sm ${activeCategory === cat.id ? 'bg-brand-500/20 text-brand-300' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <span className="shrink-0">{cat.icon}</span>
                  <span className="min-w-0 truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex max-h-[90vh] min-h-0 flex-col bg-[#0c0d21]">
             <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4 sm:p-6">
                <h3 className="min-w-0 truncate text-base font-medium capitalize text-white sm:text-lg">{activeCategory} Settings</h3>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-8">
                {activeCategory === "visual" && (
                  <div className="space-y-3 max-w-2xl">
                    <SettingRow title="Brightness" detail="Adjust the interface light level">
                      <div className="flex w-36 items-center gap-2 sm:w-56 sm:gap-3">
                        <input type="range" min="0" max="100" value={visualData.brightness} onChange={e => setVisualData({...visualData, brightness: parseInt(e.target.value)})} className="w-full accent-brand-500" />
                        <span className="w-10 text-right text-xs text-gray-400">{visualData.brightness}%</span>
                      </div>
                    </SettingRow>
                    <SettingRow title="Contrast" detail="Tune separation between panels and text">
                      <div className="flex w-36 items-center gap-2 sm:w-56 sm:gap-3">
                        <input type="range" min="50" max="150" value={visualData.contrast} onChange={e => setVisualData({...visualData, contrast: parseInt(e.target.value)})} className="w-full accent-brand-500" />
                        <span className="w-10 text-right text-xs text-gray-400">{visualData.contrast}%</span>
                      </div>
                    </SettingRow>
                    <SettingRow title="Animations" detail="Enable UI transitions and motion">
                      <ToggleSwitch checked={visualData.animations} onClick={() => setVisualData({...visualData, animations: !visualData.animations})} />
                    </SettingRow>
                  </div>
                )}

                {activeCategory === "audio" && (
                  <div className="space-y-3 max-w-2xl">
                    <SettingRow title="Master Volume" detail="Set playback volume for previews and live rooms">
                      <div className="flex w-36 items-center gap-2 sm:w-56 sm:gap-3">
                        <input type="range" min="0" max="100" value={audioData.masterVolume} onChange={e => setAudioData({...audioData, masterVolume: parseInt(e.target.value)})} className="w-full accent-brand-500" />
                        <span className="w-10 text-right text-xs text-gray-400">{audioData.masterVolume}%</span>
                      </div>
                    </SettingRow>
                    <SettingRow title="Audio Normalization" detail="Auto-adjust volume levels between episodes">
                      <ToggleSwitch checked={audioData.normalize} onClick={() => setAudioData({...audioData, normalize: !audioData.normalize})} />
                    </SettingRow>
                    <SettingRow title="HD Audio Streaming" detail="Use more data for high-fidelity playback">
                      <ToggleSwitch checked={audioData.hdAudio} onClick={() => setAudioData({...audioData, hdAudio: !audioData.hdAudio})} />
                    </SettingRow>
                  </div>
                )}

                {activeCategory === "notifications" && (
                  <div className="space-y-3 max-w-2xl">
                    <SettingRow title="Message Requests" detail="Notify when creators send a first message">
                      <ToggleSwitch checked={notificationData.messages} onClick={() => setNotificationData({...notificationData, messages: !notificationData.messages})} />
                    </SettingRow>
                    <SettingRow title="Friend Requests" detail="Notify when someone asks to connect">
                      <ToggleSwitch checked={notificationData.friends} onClick={() => setNotificationData({...notificationData, friends: !notificationData.friends})} />
                    </SettingRow>
                    <SettingRow title="Profile Visits" detail="Show visit summaries in your mailbox">
                      <ToggleSwitch checked={notificationData.visits} onClick={() => setNotificationData({...notificationData, visits: !notificationData.visits})} />
                    </SettingRow>
                  </div>
                )}

                {/* Default placeholder for other categories */}
                {activeCategory !== "visual" && activeCategory !== "audio" && activeCategory !== "notifications" && (
                   <div className="space-y-3 max-w-2xl">
                      <SettingRow title={`${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Controls`} detail="This category is ready for more controls.">
                        <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300">Default</span>
                      </SettingRow>
                      <SettingRow title="Sync Preference" detail="Keep this setting available across devices">
                        <ToggleSwitch checked={false} onClick={() => undefined} />
                      </SettingRow>
                   </div>
                )}
             </div>
          </div>
       </div>
    </div>
  )
}

function SettingRow({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 sm:gap-4 sm:p-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="line-clamp-2 text-xs text-gray-500">{detail}</div>
      </div>
      <div className="flex justify-end">{children}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-12 h-6 rounded-full relative transition-colors ${checked ? "bg-brand-500" : "bg-gray-700"}`}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${checked ? "left-7" : "left-1"}`} />
    </button>
  );
}
