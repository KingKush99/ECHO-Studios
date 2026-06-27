import React, { useState, useRef, useEffect } from "react";
import { X, Bot, Image as ImageIcon, Video, Send, Globe, ChevronDown, Loader2 } from "lucide-react";

const languages = [
  { code: "EN", name: "English" },
  { code: "ES", name: "Spanish" },
  { code: "ZH", name: "Mandarin" },
  { code: "HI", name: "Hindi" },
  { code: "FR", name: "French" },
  { code: "AR", name: "Arabic" },
  { code: "BN", name: "Bengali" },
  { code: "RU", name: "Russian" },
  { code: "PT", name: "Portuguese" },
  { code: "UR", name: "Urdu" },
];

export function AiOracleChat({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("EN");
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  if (!isOpen) return null;

  const sendMessage = async (text: string, fileBase64?: string, fileMimeType?: string) => {
    if (!text && !fileBase64) return;
    
    const newMessage = { 
      role: 'user', 
      text, 
      fileUrl: fileBase64 ? `data:${fileMimeType};base64,${fileBase64}` : undefined 
    };
    
    setChatHistory(prev => [...prev, newMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      // Map frontend chat history to the server conversation format.
      const historyToApi = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          fileBase64,
          fileMimeType,
          history: historyToApi,
          language: languages.find(l => l.code === selectedLang)?.name || "English"
        })
      });

      const data = await res.json();
      if (data.text) {
        setChatHistory(prev => [...prev, { role: 'model', text: data.text }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'model', text: "Error: Could not get response." }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error: Request failed." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      sendMessage(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      sendMessage(message || "Analyze this file.", base64, file.type);
      e.target.value = ''; // reset
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed top-0 bottom-0 left-4 my-auto w-[500px] h-[500px] rounded-2xl bg-[#090b16] z-50 shadow-[0_10px_50px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col overflow-hidden transform transition-all">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#101223]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#252a50] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#8b5cf6]" />
          </div>
          <h2 className="text-sm font-bold font-mono tracking-widest text-white">
            AI ORACLE
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {selectedLang}
              <ChevronDown className="w-3 h-3" />
            </button>
            {langDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-[#1a1b36] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setSelectedLang(l.code);
                      setLangDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {l.code} - {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(220,38,38,0.5)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
        <div className="bg-[#151933] text-white p-4 rounded-2xl rounded-tl-sm shadow-md max-w-[90%] border border-white/5 self-start">
          <p className="text-sm leading-relaxed font-medium">
            I can help sharpen your podcast prompt, episode angle, host dynamic, or show notes. Add an image reference when it should influence the episode.
          </p>
        </div>

        {chatHistory.map((msg, i) => (
          <div key={i} className={`p-4 rounded-2xl shadow-md max-w-[90%] ${msg.role === 'user' ? 'bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 self-end rounded-tr-sm text-white' : 'bg-[#151933] border border-white/5 self-start rounded-tl-sm text-gray-200'}`}>
            {msg.fileUrl && (
              <div className="mb-2">
                {msg.fileUrl.startsWith('data:image') ? (
                  <img src={msg.fileUrl} alt="Upload" className="max-w-full rounded-lg max-h-40 object-cover" />
                ) : msg.fileUrl.startsWith('data:audio') || msg.fileUrl.startsWith('data:video') ? (
                  <audio controls className="w-full h-8" src={msg.fileUrl}></audio>
                ) : (
                  <div className="text-xs opacity-70">Uploaded file</div>
                )}
              </div>
            )}
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
          </div>
        ))}
        {isLoading && (
          <div className="bg-[#151933] text-white p-4 rounded-2xl rounded-tl-sm shadow-md max-w-[90%] border border-white/5 self-start">
            <Loader2 className="w-5 h-5 animate-spin text-[#8b5cf6]" />
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-[#090b16] flex items-center gap-2">
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
        <input type="file" accept="audio/*,video/*" className="hidden" ref={audioInputRef} onChange={handleFileUpload} />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center text-[#8b5cf6] hover:bg-[#8b5cf6]/10 transition-colors shrink-0"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <button 
          onClick={() => audioInputRef.current?.click()}
          className="w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center text-[#10b981] hover:bg-[#10b981]/10 transition-colors shrink-0"
        >
          <Video className="w-5 h-5" />
        </button>
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder={`Message in ${languages.find(l => l.code === selectedLang)?.name}...`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border border-white/20 rounded-full py-2.5 pl-4 pr-10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/40 transition-colors"
          />
          <button 
            onClick={handleSend}
            disabled={!message.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
