import React, { useState, useRef, useCallback } from 'react';
import {
    FileUp, PenLine, Merge, Sparkles, FileText, Download,
    Loader2, Plus, Trash2, Eye, MessageCircle, Send, Upload
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { analyzeDocument, analyzeUrl, chatWithDocument } from '../services/geminiService';

const DocumentTools: React.FC = () => {
    const { planInfo } = useAuth();
    const [activeTab, setActiveTab] = useState<'sign' | 'annotate' | 'merge' | 'summarize' | 'chat'>('sign');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    // Signing state
    const signCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);

    // Merge state
    const [mergeFiles, setMergeFiles] = useState<File[]>([]);

    // Annotate state
    const [annotationText, setAnnotationText] = useState('');
    const [annotationPage, setAnnotationPage] = useState(1);

    const isAILocked = !planInfo?.trialActive && planInfo?.effectivePlan === 'free';
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mergeInputRef = useRef<HTMLInputElement>(null);

    // Doc Chat state
    const [docChatFile, setDocChatFile] = useState<File | null>(null);
    const [docText, setDocText] = useState<string>('');
    const [docChatMessages, setDocChatMessages] = useState<{ role: string; text: string }[]>([]);
    const [docChatInput, setDocChatInput] = useState('');
    const [docChatLoading, setDocChatLoading] = useState(false);
    const [docTextLoading, setDocTextLoading] = useState(false);
    const docChatEndRef = useRef<HTMLDivElement>(null);
    const docChatFileRef = useRef<HTMLInputElement>(null);

    // --- Signature Canvas ---
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = signCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = signCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#fff';
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = signCanvasRef.current;
        if (canvas) {
            setSignatureData(canvas.toDataURL('image/png'));
        }
    };

    const clearSignature = () => {
        const canvas = signCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            setSignatureData(null);
        }
    };

    // --- PDF Sign (client-side using pdf-lib) ---
    const handleSign = async () => {
        if (!pdfFile || !signatureData) return;
        setLoading(true);
        try {
            const { PDFDocument } = await import('pdf-lib');
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pngImage = await pdfDoc.embedPng(signatureData);
            const pages = pdfDoc.getPages();
            const lastPage = pages[pages.length - 1];
            const { width } = lastPage.getSize();
            const signWidth = 150;
            const signHeight = (pngImage.height / pngImage.width) * signWidth;

            lastPage.drawImage(pngImage, {
                x: width - signWidth - 50,
                y: 50,
                width: signWidth,
                height: signHeight,
            });

            const signedBytes = await pdfDoc.save();
            const blob = new Blob([signedBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `signed_${pdfFile.name}`;
            link.click();
            URL.revokeObjectURL(url);
            setResult('PDF signed and downloaded successfully!');
        } catch (err: any) {
            setResult(`Error signing PDF: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- PDF Annotate ---
    const handleAnnotate = async () => {
        if (!pdfFile || !annotationText) return;
        setLoading(true);
        try {
            const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const pages = pdfDoc.getPages();
            const pageIndex = Math.min(annotationPage - 1, pages.length - 1);
            const page = pages[pageIndex];
            const { height } = page.getSize();

            page.drawText(annotationText, {
                x: 50,
                y: height - 50,
                size: 12,
                font,
                color: rgb(0.95, 0.26, 0.21),
            });

            const annotatedBytes = await pdfDoc.save();
            const blob = new Blob([annotatedBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `annotated_${pdfFile.name}`;
            link.click();
            URL.revokeObjectURL(url);
            setResult('PDF annotated and downloaded successfully!');
        } catch (err: any) {
            setResult(`Error annotating PDF: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- PDF Merge ---
    const handleMerge = async () => {
        if (mergeFiles.length < 2) return;
        setLoading(true);
        try {
            const { PDFDocument } = await import('pdf-lib');
            const mergedDoc = await PDFDocument.create();

            for (const file of mergeFiles) {
                const arrayBuffer = await file.arrayBuffer();
                const srcDoc = await PDFDocument.load(arrayBuffer);
                const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
                pages.forEach((page) => mergedDoc.addPage(page));
            }

            const mergedBytes = await mergedDoc.save();
            const blob = new Blob([mergedBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'merged_document.pdf';
            link.click();
            URL.revokeObjectURL(url);
            setResult('PDFs merged and downloaded successfully!');
        } catch (err: any) {
            setResult(`Error merging PDFs: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- AI Summarize ---
    const handleSummarize = async () => {
        if (isAILocked) return;
        setLoading(true);
        setResult(null);
        try {
            let response: string;
            if (pdfFile) {
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                    reader.onload = () => {
                        const result = reader.result as string;
                        resolve(result.split(',')[1]);
                    };
                    reader.readAsDataURL(pdfFile);
                });
                response = await analyzeDocument(base64, 'application/pdf');
            } else if (pdfUrl) {
                response = await analyzeUrl(pdfUrl);
            } else {
                setResult('Please upload a PDF or enter a URL first.');
                setLoading(false);
                return;
            }
            setResult(response);
        } catch (err: any) {
            setResult(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const cleanText = (text: string) => text.replace(/[*#_`]/g, '').replace(/(\r\n|\n|\r)/gm, "\n");

    const tabs = [
        { id: 'sign' as const, label: 'Sign', icon: FileUp },
        { id: 'annotate' as const, label: 'Annotate', icon: PenLine },
        { id: 'merge' as const, label: 'Merge', icon: Merge },
        { id: 'summarize' as const, label: 'AI Summary', icon: Sparkles },
        { id: 'chat' as const, label: 'Doc Chat', icon: MessageCircle },
    ];

    return (
        <div className="space-y-6 animate-page-enter">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white">Document Tools</h2>
                <p className="text-sm text-slate-400 mt-1">Sign, annotate, merge, and analyze PDFs</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setResult(null); }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab.id
                            ? 'text-white bg-slate-800/80 border-b-2 border-indigo-500'
                            : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sign Tab */}
            {activeTab === 'sign' && (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Upload PDF to Sign</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                        />
                        {pdfFile && <p className="text-sm text-emerald-400 mt-2">✓ {pdfFile.name} loaded</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Draw Your Signature</label>
                        <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
                            <canvas
                                ref={signCanvasRef}
                                width={400}
                                height={150}
                                className="w-full cursor-crosshair"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                        </div>
                        <div className="flex gap-3 mt-3">
                            <button onClick={clearSignature} className="text-sm text-slate-400 hover:text-white transition-colors">
                                Clear Signature
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSign}
                        disabled={loading || !pdfFile || !signatureData}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Sign & Download
                    </button>
                </div>
            )}

            {/* Annotate Tab */}
            {activeTab === 'annotate' && (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Upload PDF</label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Annotation Text</label>
                            <textarea
                                value={annotationText}
                                onChange={(e) => setAnnotationText(e.target.value)}
                                placeholder="Type your annotation..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-24"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Page Number</label>
                            <input
                                type="number"
                                min={1}
                                value={annotationPage}
                                onChange={(e) => setAnnotationPage(parseInt(e.target.value) || 1)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleAnnotate}
                        disabled={loading || !pdfFile || !annotationText}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                        Annotate & Download
                    </button>
                </div>
            )}

            {/* Merge Tab */}
            {activeTab === 'merge' && (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Upload PDFs to Merge</label>
                        <input
                            ref={mergeInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setMergeFiles(prev => [...prev, ...files]);
                            }}
                            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                        />
                    </div>

                    {mergeFiles.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm text-slate-300 font-medium">{mergeFiles.length} files selected:</p>
                            {mergeFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between bg-slate-900 px-4 py-2 rounded-lg">
                                    <span className="text-sm text-slate-300 flex items-center gap-2">
                                        <FileText className="w-3 h-3" /> {f.name}
                                    </span>
                                    <button
                                        onClick={() => setMergeFiles(prev => prev.filter((_, idx) => idx !== i))}
                                        className="text-slate-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleMerge}
                        disabled={loading || mergeFiles.length < 2}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
                        Merge & Download
                    </button>
                </div>
            )}

            {/* AI Summarize Tab */}
            {activeTab === 'summarize' && (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Upload PDF</label>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => { setPdfFile(e.target.files?.[0] || null); setPdfUrl(''); }}
                                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Or paste URL</label>
                            <input
                                type="url"
                                placeholder="https://..."
                                value={pdfUrl}
                                onChange={(e) => { setPdfUrl(e.target.value); setPdfFile(null); }}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSummarize}
                        disabled={loading || isAILocked || (!pdfFile && !pdfUrl)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-colors ${isAILocked
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isAILocked ? 'Upgrade to Unlock AI' : 'Analyze & Summarize'}
                    </button>

                    {result && (
                        <div className="bg-slate-900/80 rounded-xl p-5 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                            {cleanText(result)}
                        </div>
                    )}
                </div>
            )}

            {/* Result display for non-summarize tabs */}
            {result && activeTab !== 'summarize' && activeTab !== 'chat' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-300">
                    {result}
                </div>
            )}

            {activeTab === 'chat' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Document Upload Panel */}
                    <div className="glass-panel p-6 rounded-2xl space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-400" /> Upload Document
                        </h3>
                        <p className="text-xs text-slate-400">Upload a document to chat about its contents with AI</p>

                        <input
                            ref={docChatFileRef}
                            type="file"
                            accept=".txt,.md,.csv,.json,.html,.xml,.log,.pdf"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setDocChatFile(file);
                                setDocChatMessages([]);
                                setDocTextLoading(true);

                                try {
                                    if (file.name.endsWith('.pdf')) {
                                        // For PDFs, read as base64 and let AI extract text
                                        const reader = new FileReader();
                                        reader.onload = async () => {
                                            const base64 = (reader.result as string).split(',')[1];
                                            // Use analyzeDocument to extract text from PDF
                                            const extracted = await analyzeDocument(base64, 'Extract ALL the text content from this document verbatim. Do not summarize. Return the full text.');
                                            setDocText(extracted || 'Could not extract text from PDF.');
                                            setDocTextLoading(false);
                                        };
                                        reader.readAsDataURL(file);
                                    } else {
                                        // Text-based files
                                        const text = await file.text();
                                        setDocText(text);
                                        setDocTextLoading(false);
                                    }
                                } catch (err) {
                                    setDocText('Error reading file.');
                                    setDocTextLoading(false);
                                }
                            }}
                            className="hidden"
                        />

                        <button
                            onClick={() => docChatFileRef.current?.click()}
                            className="w-full py-4 rounded-xl border-2 border-dashed border-indigo-500/50 hover:border-indigo-400 hover:bg-indigo-500/10 flex flex-col items-center gap-2 transition-all"
                        >
                            <Upload className="w-6 h-6 text-indigo-400" />
                            <span className="text-sm text-indigo-300">{docChatFile ? docChatFile.name : 'Choose File'}</span>
                        </button>

                        {docTextLoading && (
                            <div className="flex items-center gap-2 text-indigo-400 text-sm animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" /> Extracting text...
                            </div>
                        )}

                        {docText && !docTextLoading && (
                            <div className="text-xs text-slate-500">
                                ✓ {docText.length.toLocaleString()} characters extracted
                            </div>
                        )}

                        <div className="text-xs text-slate-600 space-y-1">
                            <p>Supported: PDF, TXT, MD, CSV, JSON, HTML, XML</p>
                            <p>Ask questions, extract data, or request analysis of your document.</p>
                        </div>
                    </div>

                    {/* Chat Panel */}
                    <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                            <MessageCircle className="w-5 h-5 text-indigo-400" /> Chat with Document
                        </h3>

                        <div className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto space-y-3 mb-4 custom-scrollbar">
                            {docChatMessages.length === 0 && (
                                <div className="text-center py-12 text-slate-600">
                                    <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">{docText ? 'Document loaded! Ask me anything about it.' : 'Upload a document to start chatting.'}</p>
                                </div>
                            )}
                            {docChatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-md'
                                            : 'bg-slate-800 text-slate-300 rounded-bl-md'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {docChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 rounded-2xl px-4 py-3 rounded-bl-md">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    </div>
                                </div>
                            )}
                            <div ref={docChatEndRef} />
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={docChatInput}
                                onChange={e => setDocChatInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && docChatInput.trim() && docText && !isAILocked) {
                                        const msg = { role: 'user', text: docChatInput.trim() };
                                        setDocChatMessages(prev => [...prev, msg]);
                                        setDocChatInput('');
                                        setDocChatLoading(true);
                                        chatWithDocument(msg.text, docText, docChatMessages)
                                            .then(res => setDocChatMessages(prev => [...prev, { role: 'assistant', text: res }]))
                                            .catch(() => setDocChatMessages(prev => [...prev, { role: 'assistant', text: 'Error processing your question.' }]))
                                            .finally(() => {
                                                setDocChatLoading(false);
                                                setTimeout(() => docChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                                            });
                                    }
                                }}
                                placeholder={isAILocked ? 'Upgrade to use Doc Chat' : !docText ? 'Upload a document first...' : 'Ask about this document...'}
                                disabled={isAILocked || !docText}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                            <button
                                onClick={() => {
                                    if (!docChatInput.trim() || !docText || isAILocked) return;
                                    const msg = { role: 'user', text: docChatInput.trim() };
                                    setDocChatMessages(prev => [...prev, msg]);
                                    setDocChatInput('');
                                    setDocChatLoading(true);
                                    chatWithDocument(msg.text, docText, docChatMessages)
                                        .then(res => setDocChatMessages(prev => [...prev, { role: 'assistant', text: res }]))
                                        .catch(() => setDocChatMessages(prev => [...prev, { role: 'assistant', text: 'Error processing your question.' }]))
                                        .finally(() => {
                                            setDocChatLoading(false);
                                            setTimeout(() => docChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                                        });
                                }}
                                disabled={isAILocked || docChatLoading || !docChatInput.trim() || !docText}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentTools;
