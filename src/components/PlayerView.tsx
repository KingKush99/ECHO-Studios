import { Mic2, Sparkles } from "lucide-react";
import { PodcastMetadata } from "../types";

export function PlayerView({ data }: { data: PodcastMetadata | null }) {
  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-40">
        <Mic2 className="w-12 h-12 text-brand-500 mb-4" />
        <h3 className="text-xl font-display font-medium text-white mb-2">Nothing Playing</h3>
        <p className="text-gray-400 text-sm text-center">Create a new podcast to start listening.</p>
      </div>
    );
  }

  const getBackgroundColorForSpeaker = (name: string) => {
    const colors = [
      "bg-blue-500/10 border-blue-500/20 text-blue-200",
      "bg-purple-500/10 border-purple-500/20 text-purple-200",
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
      "bg-amber-500/10 border-amber-500/20 text-amber-200",
      "bg-rose-500/10 border-rose-500/20 text-rose-200",
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 pb-32">
      <div className="bg-gradient-to-br from-brand-950 to-black border border-brand-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          <div className="inline-flex px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-mono">SCRIPT READY</div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-white">{data.title}</h1>
          <p className="text-brand-300 font-medium">{data.tagline}</p>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {data.script.map((line) => {
          const styling = getBackgroundColorForSpeaker(line.speakerName);
          return (
            <div key={line.id} className="group flex flex-col gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-white">{line.speakerName}</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {Math.floor(line.estimatedStartSeconds / 60)}:{Math.floor(line.estimatedStartSeconds % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <div className={`p-4 rounded-2xl border ${styling}`}>
                <p className="text-[15px] leading-relaxed font-medium">{line.dialogue}</p>
                {line.soundEffect && (
                  <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
                    <Sparkles className="w-3 h-3" />
                    <span className="italic">{line.soundEffect}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
