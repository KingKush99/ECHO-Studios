import React, { useState } from "react";
import { X, MessageSquare, Users, UserPlus, Search, MoreVertical, Send } from "lucide-react";

export function DmChat({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed top-0 bottom-0 right-4 my-auto w-[500px] h-[500px] rounded-2xl bg-[#0c0d21]/95 backdrop-blur-3xl z-50 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#101223]">
        <h2 className="text-sm font-bold font-display flex items-center gap-2 text-white tracking-widest">
          <MessageSquare className="w-5 h-5 text-brand-400" /> 
          DIRECT MESSAGES
        </h2>
        <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Section 1: Direct Messages */}
        <div className="flex flex-col w-1/3 border-r border-white/5">
          <div className="p-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h3 className="font-medium text-gray-300 text-xs uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-brand-400" /> Messages
            </h3>
            <button className="p-1 text-gray-400 hover:text-white"><Search className="w-3.5 h-3.5"/></button>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className={`p-3 rounded-xl cursor-pointer transition-colors ${i === 1 ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#08091a] border border-white/10 overflow-hidden flex-shrink-0 relative">
                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=dm${i}&backgroundColor=111229`} alt="User" />
                    {i === 1 && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#0c0d21]"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white truncate">Creator_{i}</h4>
                      <span className="text-[10px] text-gray-500">2h</span>
                    </div>
                    <p className={`text-xs truncate ${i === 1 ? 'text-brand-300 font-medium' : 'text-gray-400'}`}>
                      {i === 1 ? 'Loved the new podcast!' : 'Check this out'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Message Requests */}
        <div className="flex flex-col w-1/3 border-r border-white/5 bg-white/[0.01]">
          <div className="p-3 border-b border-white/5 bg-white/[0.02]">
            <h3 className="font-medium text-gray-300 text-xs uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5 text-purple-400" /> Requests <span className="ml-auto bg-brand-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">2</span>
            </h3>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {[1, 2].map(i => (
              <div key={i} className="p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#08091a] border border-white/10 overflow-hidden flex-shrink-0">
                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=req${i}&backgroundColor=111229`} alt="User" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">Unknown_{i}</h4>
                    <p className="text-xs text-gray-400 truncate">Sent a clip...</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Group Chats */}
        <div className="flex flex-col w-1/3 bg-white/[0.01]">
          <div className="p-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h3 className="font-medium text-gray-300 text-xs uppercase tracking-wider flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-400" /> Group Chats
            </h3>
            <button className="p-1 text-gray-400 hover:text-white"><Search className="w-3.5 h-3.5"/></button>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {[1, 2].map(i => (
              <div key={i} className="p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex-shrink-0 flex items-center justify-center border border-white/10">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white truncate">Collab Team {i}</h4>
                      <span className="text-[10px] text-gray-500">1d</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      <span className="text-gray-300">Alex:</span> Let's record tomorrow.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
