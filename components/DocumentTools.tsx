import React, { useState, useRef, useEffect } from 'react';
import {
    FileUp, PenLine, Merge, Sparkles, FileText, Download,
    Loader2, Trash2, MessageCircle, ZoomIn, ZoomOut,
    ChevronLeft, ChevronRight, type LucideIcon, Move
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { analyzeDocument, analyzeUrl } from '../services/geminiService';
import { Document, Page, pdfjs } from 'react-pdf';
import Draggable from 'react-draggable';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface DraggableItem {
    id: string;
    type: 'text' | 'signature';
    x: number;
    y: number;
    page: number;
    text?: string;
    fontSize?: number;
    color?: string;
    signatureData?: string;
    width?: number;
    height?: number;
}

const DocumentTools: React.FC = () => {
    const { planInfo } = useAuth();
    const [activeTab, setActiveTab] = useState<'editor' | 'merge' | 'summarize' | 'chat'>('editor');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    // Visual Editor State
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [items, setItems] = useState<DraggableItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Signature State
    const signCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tempSignature, setTempSignature] = useState<string | null>(null);
    const [showSignPad, setShowSignPad] = useState(false);

    // Merge State
    const [mergeFiles, setMergeFiles] = useState<File[]>([]);

    const isAILocked = !planInfo?.trialActive && planInfo?.effectivePlan === 'free';
    const containerRef = useRef<HTMLDivElement>(null);

    // --- Helper Functions ---
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0, g: 0, b: 0 };
    };

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    const addItem = (type: 'text' | 'signature', data?: string) => {
        const newItem: DraggableItem = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            x: 50,
            y: 50,
            page: pageNumber,
            text: type === 'text' ? 'Double click to edit' : undefined,
            fontSize: 12,
            color: '#ef4444',
            signatureData: data,
            width: type === 'signature' ? 150 : undefined,
            height: type === 'signature' ? 75 : undefined // Aspect ratio will be handled
        };
        setItems([...items, newItem]);
        setSelectedItemId(newItem.id);
        if (type === 'signature') setShowSignPad(false);
    };

    const updateItem = (id: string, updates: Partial<DraggableItem>) => {
        setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const deleteItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
        if (selectedItemId === id) setSelectedItemId(null);
    };

    // --- PDF Saving Logic ---
    const handleSave = async () => {
        if (!pdfFile) return;
        setLoading(true);
        try {
            const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            const pages = pdfDoc.getPages();

            for (const item of items) {
                const pageIndex = item.page - 1;
                if (pageIndex >= pages.length) continue;
                const page = pages[pageIndex];
                const { width: pageWidth, height: pageHeight } = page.getSize();

                // Conversion Logic
                // React-PDF renders at (scale * 96/72) roughly, or just depends on CSS width
                // We need to trust the ratio of [Mouse X / DOM Width] = [PDF X / PDF Width]

                // For this implementation, we assume the user is viewing at 'scale'
                // Ideally we get the actual rendered DOM dimensions
                // Let's assume standard PDF point is replaced by pixel at scale 1 for simplicity in calculation?
                // No, react-pdf renders based on 'scale' prop where 1 scale = 1 PDF point usually (at 72dpi) or 96dpi.
                // Standard approach:
                // pdfX = item.x / scale
                // pdfY = pageHeight - (item.y / scale) - (itemHeightInPdf)

                const pdfX = item.x / scale;
                // For text, y is usually baseline. For pdf-lib drawText, y is baseline. 
                // In DOM, y is top-left.
                // pdf-lib drawText at x,y is bottom-left of start of text.

                if (item.type === 'text' && item.text) {
                    const { r, g, b } = hexToRgb(item.color || '#000000');
                    // Adjust Y: DOM Top is 0. PDF Bottom is 0.
                    // pdfY = pageHeight - (domY / scale) - (fontSize) estimate
                    const pdfY = pageHeight - (item.y / scale) - (item.fontSize || 12);

                    page.drawText(item.text, {
                        x: pdfX,
                        y: pdfY,
                        size: item.fontSize,
                        font,
                        color: rgb(r, g, b),
                    });
                } else if (item.type === 'signature' && item.signatureData) {
                    const pngImage = await pdfDoc.embedPng(item.signatureData);
                    // Aspect ratio check
                    const imgDims = pngImage.scale(1);
                    // If we stored width/height in item (scaled by user zoom), divide by scale
                    // But we set fixed width 150*scale initially? No, we store raw PDF dims usually?
                    // Let's assume item.width is in DOM pixels.

                    const pdfImgWidth = (item.width || 150) / scale;
                    const pdfImgHeight = (pngImage.height / pngImage.width) * pdfImgWidth;

                    const pdfY = pageHeight - (item.y / scale) - pdfImgHeight;

                    page.drawImage(pngImage, {
                        x: pdfX,
                        y: pdfY,
                        width: pdfImgWidth,
                        height: pdfImgHeight,
                    });
                }
            }

            const savedBytes = await pdfDoc.save();
            const blob = new Blob([savedBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `edited_${pdfFile.name}`;
            link.click();
            URL.revokeObjectURL(url);
            setResult('PDF saved successfully!');
            setItems([]); // clear after save?
        } catch (err: any) {
            console.error(err);
            setResult('Error saving PDF: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Sign Pad Logic ---
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
        ctx.strokeStyle = '#000'; // Signature usually black
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    };
    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = signCanvasRef.current;
        if (canvas) setTempSignature(canvas.toDataURL('image/png'));
    };
    const clearSignature = () => {
        const canvas = signCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            setTempSignature(null);
        }
    };

    // --- Merge Logic (Legacy) ---
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
            const blob = new Blob([mergedBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'merged_document.pdf';
            link.click();
            URL.revokeObjectURL(url);
            setResult('Files merged!');
        } catch (err: any) { setResult(err.message); }
        finally { setLoading(false); }
    };

    // --- Summarize Logic (Legacy) ---
    const handleSummarize = async () => {
        if (isAILocked) return;
        setLoading(true);
        try {
            let response: string;
            if (pdfFile) {
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(pdfFile);
                });
                response = await analyzeDocument(base64, 'application/pdf');
            } else if (pdfUrl) {
                response = await analyzeUrl(pdfUrl);
            } else {
                setResult('No file/URL provided');
                setLoading(false);
                return;
            }
            setResult(response);
        } catch (err: any) { setResult(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 animate-page-enter">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white">Document Tools</h2>
                <p className="text-sm text-slate-400 mt-1">Visual Editor, Merge, and AI Analysis</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-1">
                {[
                    { id: 'editor' as const, label: 'Visual Editor', icon: PenLine },
                    { id: 'merge' as const, label: 'Merge', icon: Merge },
                    { id: 'summarize' as const, label: 'AI Summary', icon: Sparkles },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setResult(null); }}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === activeTab
                            ? activeTab === tab.id ? 'text-white bg-slate-800/80 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
                            : ''}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Editor Tab */}
            {activeTab === 'editor' && (
                <div className="glass-panel rounded-2xl p-6 min-h-[600px] flex flex-col">
                    {!pdfFile ? (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-8 hover:border-indigo-500/50 transition-colors">
                            <FileUp className="w-12 h-12 text-slate-500 mb-4" />
                            <p className="text-slate-300 font-medium mb-2">Upload a PDF to Start Editing</p>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-2 rounded-xl border border-slate-700/50">
                                <button onClick={() => setPdfFile(null)} className="text-slate-400 hover:text-white px-2"><Trash2 className="w-4 h-4" /></button>
                                <div className="h-6 w-px bg-slate-700"></div>
                                <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300"><ZoomOut className="w-4 h-4" /></button>
                                <span className="text-xs text-slate-400 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
                                <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300"><ZoomIn className="w-4 h-4" /></button>
                                <div className="h-6 w-px bg-slate-700"></div>
                                <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                <span className="text-xs text-slate-400">Page {pageNumber} of {numPages}</span>
                                <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                                <div className="h-6 w-px bg-slate-700"></div>

                                <button onClick={() => addItem('text')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-medium border border-indigo-500/30">
                                    <FileText className="w-3 h-3" /> Add Text
                                </button>
                                <button onClick={() => setShowSignPad(true)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-medium border border-emerald-500/30">
                                    <PenLine className="w-3 h-3" /> Add Signature
                                </button>
                                <div className="flex-1"></div>
                                <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Save & Download
                                </button>
                            </div>

                            {/* Property Bar (Active Item) */}
                            {selectedItemId && (
                                <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-xl border border-slate-700/50 animate-fade-in shadow-lg">
                                    <span className="text-xs font-bold text-slate-400 px-2 uppercase tracking-wider">Properties</span>
                                    {items.find(i => i.id === selectedItemId)?.type === 'text' && (
                                        <>
                                            <input
                                                type="text"
                                                value={items.find(i => i.id === selectedItemId)?.text || ''}
                                                onChange={(e) => updateItem(selectedItemId, { text: e.target.value })}
                                                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white w-48 focus:border-indigo-500 outline-none"
                                            />
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Size:</span>
                                                <input
                                                    type="number"
                                                    value={items.find(i => i.id === selectedItemId)?.fontSize || 12}
                                                    onChange={(e) => updateItem(selectedItemId, { fontSize: parseInt(e.target.value) })}
                                                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white w-16"
                                                />
                                            </div>
                                            <input
                                                type="color"
                                                value={items.find(i => i.id === selectedItemId)?.color || '#000000'}
                                                onChange={(e) => updateItem(selectedItemId, { color: e.target.value })}
                                                className="bg-transparent w-6 h-6 rounded cursor-pointer"
                                            />
                                        </>
                                    )}
                                    <button onClick={() => deleteItem(selectedItemId)} className="ml-auto text-red-400 hover:text-red-300 px-2 flex items-center gap-1 text-xs font-medium">
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            )}

                            {/* Canvas */}
                            <div className="relative bg-slate-200/5 rounded-xl border border-slate-800 overflow-auto flex justify-center p-8 min-h-[600px]" ref={containerRef}>
                                <Document
                                    file={pdfFile}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    loading={<div className="text-slate-400 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading PDF...</div>}
                                >
                                    <div className="relative shadow-2xl">
                                        <Page
                                            pageNumber={pageNumber}
                                            scale={scale}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            className="border border-slate-300"
                                        />

                                        {/* Overlay Layer */}
                                        <div className="absolute inset-0 z-10 overflow-hidden"
                                            style={{ pointerEvents: 'none' }} // Allow clicks to pass to draggable items but contain them
                                        >
                                            {items.filter(i => i.page === pageNumber).map(item => (
                                                <Draggable
                                                    key={item.id}
                                                    defaultPosition={{ x: item.x, y: item.y }}
                                                    onStop={(e, data) => updateItem(item.id, { x: data.x, y: data.y })}
                                                    bounds="parent"
                                                >
                                                    <div
                                                        onMouseDown={() => setSelectedItemId(item.id)}
                                                        className={`absolute cursor-move group ${selectedItemId === item.id ? 'ring-1 ring-indigo-500 ring-offset-1 ring-offset-transparent' : 'hover:ring-1 hover:ring-slate-400/50'}`}
                                                        style={{
                                                            pointerEvents: 'auto',
                                                            color: item.color,
                                                            fontSize: `${(item.fontSize || 12) * scale}px`, // Scale font visually
                                                            lineHeight: 1,
                                                            // For signature, we need width
                                                        }}
                                                    >
                                                        {item.type === 'text' ? (
                                                            <span className="whitespace-nowrap px-1">{item.text}</span>
                                                        ) : (
                                                            <img
                                                                src={item.signatureData}
                                                                alt="sig"
                                                                style={{
                                                                    width: `${(item.width || 150) * scale}px`,
                                                                    height: 'auto',
                                                                    display: 'block'
                                                                }}
                                                                draggable={false} // Prevent browser image drag
                                                            />
                                                        )}
                                                        {/* Handle/Indicator */}
                                                        {selectedItemId === item.id && (
                                                            <div className="absolute -top-3 -right-3 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-sm scale-0 group-hover:scale-100 transition-transform disabled">
                                                                <Move className="w-2 h-2" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </Draggable>
                                            ))}
                                        </div>
                                    </div>
                                </Document>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Signature Modal */}
            {showSignPad && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-md p-6 rounded-2xl relative">
                        <h3 className="text-white font-bold mb-4">Draw Signature</h3>
                        <canvas
                            ref={signCanvasRef}
                            width={400}
                            height={150}
                            className="w-full bg-white rounded-xl cursor-crosshair mb-4"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={clearSignature} className="text-slate-400 hover:text-white px-3 py-2 text-sm">Clear</button>
                            <button onClick={() => setShowSignPad(false)} className="px-4 py-2 text-slate-300 hover:text-white text-sm">Cancel</button>
                            <button
                                onClick={() => {
                                    if (tempSignature) {
                                        addItem('signature', tempSignature);
                                    }
                                }}
                                disabled={!tempSignature}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                            >
                                Use Signature
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merge Tab Legacy UI... */}
            {activeTab === 'merge' && (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Upload PDFs to Merge</label>
                        <input
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

            {/* AI Summarize Tab Legacy UI... */}
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
                            {result}
                        </div>
                    )}
                </div>
            )}

            {/* General Result Display */}
            {result && activeTab !== 'summarize' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-300 fixed bottom-8 right-8 z-50 shadow-xl animate-fade-in backdrop-blur-md">
                    {result}
                </div>
            )}
        </div>
    );
};

export default DocumentTools;
