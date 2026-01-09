import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Save, CheckCircle2, ShieldCheck } from 'lucide-react';

const Settings: React.FC = () => {
    const [keys, setKeys] = useState({
        gemini: '',
        openai: '',
        claude: ''
    });
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        localStorage.setItem('ls_gemini_key', keys.gemini);
        localStorage.setItem('ls_openai_key', keys.openai);
        localStorage.setItem('ls_anthropic_key', keys.claude);

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    useEffect(() => {
        // Load existing keys
        setKeys({
            gemini: localStorage.getItem('ls_gemini_key') || '',
            openai: localStorage.getItem('ls_openai_key') || '',
            claude: localStorage.getItem('ls_anthropic_key') || ''
        });
    }, []);

    const toggleVisibility = (provider: string) => {
        setShowKey(prev => ({ ...prev, [provider]: !prev[provider] }));
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-white mb-2">Settings & Configuration</h2>
                <p className="text-slate-400 text-sm">Manage your AI providers and security preferences.</p>
            </header>

            <div className="glass-panel p-8 rounded-2xl max-w-2xl">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-800">
                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">API Configuration</h3>
                        <p className="text-xs text-slate-500">Keys are stored locally in your browser for security.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Gemini */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 flex justify-between">
                            <span>Google Gemini API Key (Primary)</span>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300">Get Key &rarr;</a>
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-3.5 text-slate-500">
                                <Key className="w-4 h-4" />
                            </div>
                            <input
                                type={showKey['gemini'] ? "text" : "password"}
                                value={keys.gemini}
                                onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
                                placeholder="AIza..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-10 text-white focus:border-indigo-500 focus:outline-none font-mono text-sm"
                            />
                            <button
                                onClick={() => toggleVisibility('gemini')}
                                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300"
                            >
                                {showKey['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* OpenAI */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 flex justify-between">
                            <span>OpenAI API Key (Optional)</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-3.5 text-slate-500">
                                <Key className="w-4 h-4" />
                            </div>
                            <input
                                type={showKey['openai'] ? "text" : "password"}
                                value={keys.openai}
                                onChange={(e) => setKeys({ ...keys, openai: e.target.value })}
                                placeholder="sk-..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-10 text-white focus:border-indigo-500 focus:outline-none font-mono text-sm"
                            />
                            <button
                                onClick={() => toggleVisibility('openai')}
                                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300"
                            >
                                {showKey['openai'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Claude */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 flex justify-between">
                            <span>Anthropic Claude API Key (Optional)</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-3.5 text-slate-500">
                                <Key className="w-4 h-4" />
                            </div>
                            <input
                                type={showKey['claude'] ? "text" : "password"}
                                value={keys.claude}
                                onChange={(e) => setKeys({ ...keys, claude: e.target.value })}
                                placeholder="sk-ant-..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-10 text-white focus:border-indigo-500 focus:outline-none font-mono text-sm"
                            />
                            <button
                                onClick={() => toggleVisibility('claude')}
                                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300"
                            >
                                {showKey['claude'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSave}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                        >
                            {saved ? (
                                <>
                                    <CheckCircle2 className="w-5 h-5" /> Saved Successfully
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" /> Save Configuration
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;