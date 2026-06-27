import { useState } from "react";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

export function EditProfileModal({ 
  currentProfile, 
  onClose, 
  onSave 
}: { 
  currentProfile: any; 
  onClose: () => void; 
  onSave: (p: any) => void;
}) {
  const [username, setUsername] = useState(currentProfile.username);
  const [displayName, setDisplayName] = useState(currentProfile.displayName);
  const [bio, setBio] = useState(currentProfile.bio);
  const [mascotId, setMascotId] = useState(currentProfile.mascotId);
  const [error, setError] = useState<string | null>(null);

  const containsProfanity = (text: string) => {
    // Basic regex for demonstration. Catch inappropriate words
    const regex = /(nigger|fuck|bitch|shit|cunt|dick|pussy|porn|sex)/i;
    return regex.test(text);
  };

  const handleSave = () => {
    if (username.length > 64) { setError("Username max 64 characters."); return; }
    if (displayName.length > 64) { setError("Display name max 64 characters."); return; }
    if (bio.length > 1000) { setError("Bio max 1000 characters."); return; }
    
    if (containsProfanity(username) || containsProfanity(displayName) || containsProfanity(bio)) {
      setError("Inappropriate content detected. Please remove sensitive language.");
      return;
    }

    onSave({ username, displayName, bio, mascotId });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm px-4">
       <div className="bg-[#0c0d21] border border-white/10 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#0c0d21]/90 backdrop-blur-md z-10">
            <h2 className="text-xl font-display font-medium text-white">Edit Profile</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm flex gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
               <div>
                 <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase mb-2 block">Avatar Mascot</label>
                 <div className="grid grid-cols-8 gap-2 overflow-y-auto max-h-40 custom-scrollbar p-2 bg-black/40 border border-white/10 rounded-xl">
                   {Array.from({length: 32}).map((_, i) => (
                     <button 
                       key={i}
                       onClick={() => setMascotId(String(i))}
                       className={`aspect-square rounded-lg border-2 transition-all p-1 ${mascotId === String(i) ? 'border-brand-500 bg-brand-500/20' : 'border-transparent hover:border-white/20 hover:bg-white/5'}`}
                     >
                       <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${i}&backgroundColor=111229`} alt="Mascot" className="w-full h-full object-cover rounded" />
                     </button>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase mb-2 flex justify-between">
                   Username <span className="text-gray-500">{username.length}/64</span>
                 </label>
                 <input 
                   type="text" 
                   value={username}
                   onChange={e => setUsername(e.target.value)}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 transition-colors text-sm"
                 />
               </div>

               <div>
                 <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase mb-2 flex justify-between">
                   Display Name <span className="text-gray-500">{displayName.length}/64</span>
                 </label>
                 <input 
                   type="text" 
                   value={displayName}
                   onChange={e => setDisplayName(e.target.value)}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 transition-colors text-sm"
                 />
               </div>

               <div>
                 <label className="text-xs font-semibold tracking-wide text-brand-200 uppercase mb-2 flex justify-between">
                   Bio <span className="text-gray-500">{bio.length}/1000</span>
                 </label>
                 <textarea 
                   value={bio}
                   onChange={e => setBio(e.target.value)}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 transition-colors text-sm resize-none h-24"
                 />
               </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/10 flex justify-end gap-3 sticky bottom-0 bg-[#0c0d21]">
             <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
               Cancel
             </button>
             <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-medium text-sm bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-2 transition-colors">
               <CheckCircle className="w-4 h-4"/> Save Profile
             </button>
          </div>
       </div>
    </div>
  )
}
