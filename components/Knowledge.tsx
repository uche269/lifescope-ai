import React, { useState, useEffect } from 'react';
import { getWeeklyBriefing } from '../services/geminiService';
import { Globe, TrendingUp, Trophy, RefreshCw } from 'lucide-react';

const Knowledge: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'Sports' | 'History' | 'Finance'>('Sports');
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Helper to remove markdown
  const cleanText = (text: string) => {
      return text.replace(/[*#_`]/g, '').replace(/(\r\n|\n|\r)/gm, "\n");
  };

  const fetchContent = async (type: 'Sports' | 'History' | 'Finance') => {
    setLoading(true);
    const text = await getWeeklyBriefing(type);
    setContent(prev => ({ ...prev, [type]: cleanText(text) }));
    setLoading(false);
  };

  useEffect(() => {
    if (!content[activeSection]) {
      fetchContent(activeSection);
    }
  }, [activeSection]);

  const sections = [
    { id: 'Sports', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'History', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'Finance', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Knowledge Hub</h2>
        <span className="text-xs text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            Automated Weekly Briefs
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
                <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as any)}
                    className={`p-4 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                        isActive 
                        ? 'bg-slate-900 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                        : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                    }`}
                >
                    <div className={`p-2 rounded-lg ${section.bg}`}>
                        <Icon className={`w-6 h-6 ${section.color}`} />
                    </div>
                    <span className={`font-medium ${isActive ? 'text-white' : 'text-slate-400'}`}>
                        {section.id}
                    </span>
                </button>
            )
        })}
      </div>

      <div className="glass-panel p-8 rounded-2xl min-h-[400px] relative">
        <div className="absolute top-6 right-6">
            <button 
                onClick={() => fetchContent(activeSection)} 
                disabled={loading}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>

        <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-800 pb-4">
            {activeSection === 'History' ? 'Nigerian & Global History' : 
             activeSection === 'Finance' ? 'Nigerian Market Analysis' : 
             'Global Sports Roundup'}
        </h3>

        {loading ? (
            <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                <div className="h-4 bg-slate-800 rounded w-full"></div>
                <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                <div className="h-20 bg-slate-800 rounded w-full mt-6"></div>
            </div>
        ) : (
            <div className="prose prose-invert max-w-none text-slate-300 font-light leading-relaxed">
                 {content[activeSection] ? (
                     <div className="whitespace-pre-line text-lg">
                         {content[activeSection]}
                     </div>
                 ) : (
                     <p className="text-slate-500 italic">Click refresh to load the latest intelligence report.</p>
                 )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Knowledge;