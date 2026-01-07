import React, { useState, useRef } from 'react';
import { Mic, MessageSquare, Play, Sparkles, Send, Square, Volume2 } from 'lucide-react';
import { generateScenarioScript, chatWithAI, analyzeVoice } from '../services/geminiService';

const cleanText = (text: string) => {
    // Remove Markdown headers, bold, etc.
    return text.replace(/[*#_`]/g, '').replace(/^[-]\s/gm, '• ');
};

const SelfDevelopment: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'communication' | 'scenario'>('scenario');
  
  // Scenario State
  const [scenarioInput, setScenarioInput] = useState('');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<'Beginner' | 'Advanced'>('Beginner');
  
  // Role Play State
  const [isChatting, setIsChatting] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [userChatInput, setUserChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [analyzingVoice, setAnalyzingVoice] = useState(false);

  // --- Scenario Handlers ---

  const handleGenerateScript = async () => {
    if (!scenarioInput) return;
    setLoading(true);
    const result = await generateScenarioScript(scenarioInput, level);
    setGeneratedScript(cleanText(result));
    setLoading(false);
    // Reset Chat
    setChatMessages([]);
    setIsChatting(false);
  };

  const startRolePlay = () => {
      setIsChatting(true);
      setChatMessages([{ role: 'model', text: "I'm ready. You start first based on the script, or just say 'Hello'." }]);
  };

  const sendChatMessage = async () => {
      if(!userChatInput.trim()) return;
      
      const newHistory = [...chatMessages, { role: 'user' as const, text: userChatInput }];
      setChatMessages(newHistory);
      setUserChatInput('');
      setChatLoading(true);

      // Convert format for Gemini API history
      const apiHistory = chatMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      const response = await chatWithAI(apiHistory, userChatInput);
      setChatMessages([...newHistory, { role: 'model', text: cleanText(response) }]);
      setChatLoading(false);
  };

  // --- Voice Handlers ---

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/wav' });
            
            // Convert to Base64 for Gemini
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64String = (reader.result as string).split(',')[1];
                setAnalyzingVoice(true);
                const feedback = await analyzeVoice(base64String);
                setVoiceFeedback(cleanText(feedback));
                setAnalyzingVoice(false);
            };
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        setVoiceFeedback(null);
    } catch (err) {
        alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
      if (mediaRecorder) {
          mediaRecorder.stop();
          setIsRecording(false);
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Self Development</h2>
          <p className="text-slate-400 text-sm">Practice communication and confidence.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-1">
        <button 
          onClick={() => setActiveTab('scenario')}
          className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'scenario' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Scenario Practice
          {activeTab === 'scenario' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
        </button>
        <button 
          onClick={() => setActiveTab('communication')}
          className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'communication' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Confidence & Voice
          {activeTab === 'communication' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
        </button>
      </div>

      {activeTab === 'scenario' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl h-fit">
            <h3 className="text-lg font-semibold text-white mb-4">Input Scenario</h3>
            <textarea
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 focus:border-indigo-500 focus:outline-none min-h-[150px] mb-4"
              placeholder="e.g., Negotiating a salary increase with my boss, or Asking a landlord about lease terms in Canada..."
              value={scenarioInput}
              onChange={(e) => setScenarioInput(e.target.value)}
            />
            
            <div className="flex items-center gap-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="level" 
                  checked={level === 'Beginner'} 
                  onChange={() => setLevel('Beginner')}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-slate-300">Beginner</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="level" 
                  checked={level === 'Advanced'} 
                  onChange={() => setLevel('Advanced')}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-slate-300">Advanced</span>
              </label>
            </div>

            <button 
              onClick={handleGenerateScript}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
            >
              {loading ? (
                <>Generating...</>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" /> Generate Script
                </>
              )}
            </button>
          </div>

          <div className="glass-panel p-6 rounded-2xl min-h-[400px] border border-slate-700/50 relative overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                    {isChatting ? 'Role Play Chat' : 'AI Script'}
                </h3>
                {generatedScript && !isChatting && (
                    <button onClick={startRolePlay} className="text-xs bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded-full hover:bg-emerald-600/30">
                        Start Role Play
                    </button>
                )}
            </div>
            
            {/* Display Area */}
            <div className="flex-1 overflow-y-auto mb-4 pr-2">
                {!isChatting && generatedScript && (
                    <div className="whitespace-pre-line text-slate-300 leading-relaxed">
                        {generatedScript}
                    </div>
                )}

                {!isChatting && !generatedScript && (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-600">
                        <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                        <p>Enter a scenario to generate a script.</p>
                    </div>
                )}

                {isChatting && (
                    <div className="space-y-4">
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {chatLoading && <div className="text-slate-500 text-xs animate-pulse">AI is typing...</div>}
                    </div>
                )}
            </div>

            {/* Chat Input */}
            {isChatting && (
                <div className="mt-auto relative">
                    <input 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pr-10 text-white focus:outline-none focus:border-indigo-500"
                        placeholder="Type your response..."
                        value={userChatInput}
                        onChange={(e) => setUserChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    />
                    <button onClick={sendChatMessage} className="absolute right-2 top-2 p-1 text-slate-400 hover:text-white">
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-2xl text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative transition-all duration-300 ${isRecording ? 'bg-red-500/20' : 'bg-slate-800'}`}>
                {isRecording ? (
                     <div className="absolute inset-0 border-2 border-red-500 rounded-full animate-ping"></div>
                ) : null}
                <Mic className={`w-10 h-10 ${isRecording ? 'text-red-500' : 'text-indigo-400'}`} />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">
                {isRecording ? 'Recording in progress...' : 'Voice Practice Mode'}
            </h3>
            
            <p className="text-slate-400 max-w-md mx-auto mb-8">
                {isRecording 
                    ? "Speak clearly. Click stop when you are done to get AI feedback." 
                    : "Practice your tone, clarity, and confidence. Read the script aloud to get instant feedback on your delivery."
                }
            </p>

            <div className="flex justify-center gap-4">
                {!isRecording ? (
                    <button onClick={startRecording} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:scale-105">
                        <Play className="w-5 h-5 fill-current" /> Start Recording
                    </button>
                ) : (
                    <button onClick={stopRecording} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:scale-105">
                        <Square className="w-5 h-5 fill-current" /> Stop & Analyze
                    </button>
                )}
            </div>

            {analyzingVoice && (
                <div className="mt-8 flex items-center justify-center gap-3 text-indigo-400 animate-pulse">
                    <Sparkles className="w-5 h-5" />
                    <span>Analyzing your confidence levels...</span>
                </div>
            )}

            {voiceFeedback && (
                <div className="mt-8 text-left bg-slate-900/50 border border-slate-800 p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 mb-4 text-emerald-400">
                        <Volume2 className="w-5 h-5" />
                        <h4 className="font-bold">Voice Analysis Feedback</h4>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-line leading-relaxed">
                        {voiceFeedback}
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default SelfDevelopment;