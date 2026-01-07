import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle, Download, Link, Globe, ArrowRight } from 'lucide-react';
import { analyzeDocument, analyzeUrl } from '../services/geminiService';

const Documents: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Helper to remove markdown
  const cleanText = (text: string) => {
      return text.replace(/[*#_`]/g, '');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file.');
        return;
    }

    setFileName(file.name);
    setAnalyzing(true);
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result as string;
        // Strip data url prefix for Gemini API
        const base64Content = base64String.split(',')[1];
        
        const summary = await analyzeDocument(base64Content, file.type);
        setResult(cleanText(summary));
        setAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlAnalyze = async () => {
    if (!urlInput.trim()) return;
    
    try {
        const url = new URL(urlInput);
        setFileName(url.hostname);
    } catch (e) {
        alert("Please enter a valid URL (e.g., https://example.com)");
        return;
    }

    setAnalyzing(true);
    setResult(null);

    const summary = await analyzeUrl(urlInput);
    setResult(cleanText(summary));
    setAnalyzing(false);
  };

  const handleDownload = () => {
      if (!result) return;
      const element = document.createElement("a");
      const file = new Blob([result], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `Analysis_${fileName || 'Report'}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Document & Web Intelligence</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            {/* PDF Upload Card */}
            <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> PDF Analysis
                </h3>
                <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group h-40 bg-slate-900/50">
                    <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-6 h-6 text-indigo-400" />
                    </div>
                    <span className="text-slate-300 text-sm font-medium">Upload PDF Book/Report</span>
                </label>
            </div>

            {/* URL Input Card */}
            <div className="glass-panel p-6 rounded-2xl">
                 <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Website Summary
                </h3>
                <div className="space-y-3">
                    <div className="relative">
                        <Link className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input 
                            type="url" 
                            placeholder="https://..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUrlAnalyze()}
                        />
                    </div>
                    <button 
                        onClick={handleUrlAnalyze}
                        disabled={analyzing || !urlInput}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm transition-all"
                    >
                        Analyze URL <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Active File Indicator */}
            {fileName && (
                <div className="p-4 glass-panel rounded-xl flex items-center gap-3 border border-indigo-500/30 bg-indigo-900/10">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <div>
                        <p className="text-xs text-indigo-300 uppercase font-bold tracking-wider">Active Source</p>
                        <p className="text-sm text-white truncate max-w-[200px]">{fileName}</p>
                    </div>
                </div>
            )}
        </div>

        {/* Results Area */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
                <h3 className="text-lg font-semibold text-white">Insights & Summary</h3>
                {result && (
                    <button onClick={handleDownload} className="text-xs flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors border border-slate-700">
                        <Download className="w-3 h-3" /> Download Text
                    </button>
                )}
            </div>
            
            {analyzing ? (
                <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-indigo-300 animate-pulse font-medium">
                        Reading and extracting intelligence...
                    </p>
                    <p className="text-xs text-slate-500">This may take a moment depending on content size.</p>
                </div>
            ) : result ? (
                 <div className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto pr-2">
                    <div className="whitespace-pre-line text-slate-300 leading-relaxed font-light text-base">
                        {result}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-600 space-y-4">
                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 opacity-20" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-medium text-slate-500">Ready to Analyze</p>
                        <p className="text-sm">Upload a PDF or paste a URL to generate a summary.</p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Documents;