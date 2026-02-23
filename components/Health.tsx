import React, { useState, useEffect, useRef } from 'react';
import {
    Scale,
    Utensils,
    ChefHat,
    Camera,
    Plus,
    TrendingUp,
    Activity,
    CalendarCheck,
    CalendarDays,
    Sparkles,
    Save,
    X,
    Check,
    RefreshCw,
    Stethoscope,
    Send,
    Loader2,
    Trash2,
    HeartPulse,
    FileUp
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WeightLog, BodyMeasurement, FoodLog, MealPlanPreferences } from '../types';
import { analyzeFoodImage, generateMealPlan, improveDietPlan, interpretTestResults, healthChat, parseHealthReport } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

const Health: React.FC = () => {
    const { user, planInfo } = useAuth();
    const [activeTab, setActiveTab] = useState<'metrics' | 'food' | 'plan' | 'consultant'>('metrics');
    const [loading, setLoading] = useState(false);
    // Admins and premium users have full AI access
    const isAILocked = !planInfo?.trialActive && planInfo?.effectivePlan === 'free' && !user?.is_admin;

    // Health Disclaimer
    const [showDisclaimer, setShowDisclaimer] = useState(() => {
        return !localStorage.getItem('ls_health_disclaimer_accepted');
    });

    const acceptDisclaimer = () => {
        localStorage.setItem('ls_health_disclaimer_accepted', 'true');
        setShowDisclaimer(false);
    };

    // --- Metrics State ---
    const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
    const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);

    // Date and Inputs for Metrics
    const [weightDate, setWeightDate] = useState(new Date().toISOString().split('T')[0]);
    const [newWeight, setNewWeight] = useState('');

    const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);
    const [newMeasurement, setNewMeasurement] = useState({ arm: '', stomach: '', waist: '' });

    // --- Food Log State ---
    const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
    const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- Meal Plan State ---
    const [mealPlan, setMealPlan] = useState<string>(() => {
        return localStorage.getItem('ls_meal_plan') || '';
    });
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [isImprovingPlan, setIsImprovingPlan] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<{ critique: string, revisedPlan: string } | null>(null);
    const [planComments, setPlanComments] = useState('');

    const [planPrefs, setPlanPrefs] = useState<MealPlanPreferences>({
        goal: 'Lose Weight',
        dietType: 'Balanced',
        caloriesPerDay: '2000',
        allergies: '',
        country: '',
        ethnicGroup: '',
        duration: '7'
    });

    // --- Health Consultant State ---
    const [testType, setTestType] = useState('Blood Test');
    const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
    const [testFields, setTestFields] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
    const [testInterpretation, setTestInterpretation] = useState<string | null>(null);
    const [savedTests, setSavedTests] = useState<any[]>([]);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [consultMessages, setConsultMessages] = useState<{ role: string; text: string }[]>([]);
    const [consultInput, setConsultInput] = useState('');
    const [isConsultLoading, setIsConsultLoading] = useState(false);
    const consultEndRef = useRef<HTMLDivElement>(null);

    // --- Fetch Data from Backend API ---
    const fetchHealthData = async () => {
        setLoading(true);
        try {
            const [wData, mData, fData] = await Promise.all([
                api.get('weight_logs', { orderBy: 'date', ascending: 'true' }),
                api.get('measurements', { orderBy: 'date', ascending: 'true' }),
                api.get('food_logs', { orderBy: 'date', limit: '50' })
            ]);
            if (Array.isArray(wData)) setWeightLogs(wData);
            if (Array.isArray(mData)) setMeasurements(mData);
            if (Array.isArray(fData)) setFoodLogs(fData);
        } catch (error) {
            console.error('Health data fetch error:', error);
            setLoading(false);
        }
    };

    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [isParsingReport, setIsParsingReport] = useState(false);

    useEffect(() => {
        fetchHealthData();
        fetchTestResults();
    }, []);

    // Save meal plan locally still as it's a draft usually
    useEffect(() => localStorage.setItem('ls_meal_plan', mealPlan), [mealPlan]);

    // --- Handlers: Metrics ---
    const addWeightLog = async () => {
        if (!newWeight) return;

        const newLog = {
            date: weightDate,
            weight: parseFloat(newWeight),
        };
        const tempId = Date.now().toString();
        const optimisiticLog = { ...newLog, id: tempId };
        setWeightLogs([...weightLogs, optimisiticLog].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setNewWeight('');
        try {
            const saved = await api.post('weight_logs', newLog);
            setWeightLogs(prev => prev.map(l => l.id === tempId ? saved : l));
        } catch (e) {
            alert('Failed to save weight.');
            setWeightLogs(prev => prev.filter(l => l.id !== tempId));
        }
    };

    // History State
    const [showHistory, setShowHistory] = useState(false);

    const addMeasurement = async () => {
        if (!newMeasurement.arm || !newMeasurement.waist) return;

        const newLog = {
            date: measurementDate,
            arm: parseFloat(newMeasurement.arm),
            stomach: parseFloat(newMeasurement.stomach),
            waist: parseFloat(newMeasurement.waist),
        };
        const tempId = Date.now().toString();
        const optimisticLog = { ...newLog, id: tempId };
        setMeasurements([...measurements, optimisticLog].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setNewMeasurement({ arm: '', stomach: '', waist: '' });
        try {
            const saved = await api.post('measurements', newLog);
            setMeasurements(prev => prev.map(l => l.id === tempId ? saved : l));
        } catch (e) {
            alert('Failed to save measurements.');
            setMeasurements(prev => prev.filter(l => l.id !== tempId));
        }
    };

    const deleteWeightLog = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this weight entry?')) return;
        setWeightLogs(prev => prev.filter(l => l.id !== id));
        try { await api.delete('weight_logs', id); } catch { fetchHealthData(); }
    };

    const deleteMeasurement = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this measurement entry?')) return;
        setMeasurements(prev => prev.filter(m => m.id !== id));
        try { await api.delete('measurements', id); } catch { fetchHealthData(); }
    };

    // --- Handlers: Camera & Food ---
    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera Error", err);
            alert("Unable to access camera.");
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setShowCamera(false);
    };

    const saveFoodLog = async (logData: any) => {
        try {
            const saved = await api.post('food_logs', logData);
            setFoodLogs(prev => [saved, ...prev]);
        } catch (e) {
            console.error('Food log save error', e);
            alert('Failed to save food log.');
        }
    };

    const deleteFoodLog = async (id: string) => {
        try {
            await api.delete(`food_logs/${id}`);
            setFoodLogs(prev => prev.filter(log => log.id !== id));
        } catch (e) {
            console.error('Food log delete error', e);
            alert('Failed to delete food log.');
        }
    };

    const capturePhoto = async () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);

                const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7); // Compress slightly
                const base64 = dataUrl.split(',')[1];

                stopCamera();

                setIsAnalyzingFood(true);
                const result = await analyzeFoodImage(base64);
                if (result) {
                    const logData = {
                        date: new Date().toISOString().split('T')[0],
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        name: result.name,
                        calories: result.calories,
                        protein: result.protein,
                        carbs: result.carbs,
                        fat: result.fat,
                        image: dataUrl, // Saving base64 string
                        confidence: result.confidence,
                        items_json: JSON.stringify(result.items || []),
                        notes: result.notes || result.suggestions?.join(', ')
                    };
                    await saveFoodLog(logData);
                } else {
                    alert("Could not analyze food.");
                }
                setIsAnalyzingFood(false);
            }
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzingFood(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const result = await analyzeFoodImage(base64);

            if (result) {
                const logData = {
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    name: result.name,
                    calories: result.calories,
                    protein: result.protein,
                    carbs: result.carbs,
                    fat: result.fat,
                    image: reader.result as string
                };
                await saveFoodLog(logData);
            } else {
                alert("Could not analyze food. Please check your API key.");
            }
            setIsAnalyzingFood(false);
        };
        reader.readAsDataURL(file);
    };

    // --- Handlers: Plan ---
    const handleGeneratePlan = async () => {
        setIsGeneratingPlan(true);
        const plan = await generateMealPlan(planPrefs);
        setMealPlan(plan);
        setIsGeneratingPlan(false);
    };

    const handleImprovePlan = async () => {
        if (!mealPlan.trim()) return;
        setIsImprovingPlan(true);
        const result = await improveDietPlan(mealPlan, planPrefs.goal, planComments);
        if (result) {
            setAiSuggestion(result);
            setPlanComments('');
        }
        setIsImprovingPlan(false);
    };

    const applySuggestion = () => {
        if (aiSuggestion) {
            setMealPlan(aiSuggestion.revisedPlan);
            setAiSuggestion(null);
        }
    };

    // --- Health Consultant Handlers ---
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const fetchTestResults = async () => {
        try {
            const res = await fetch(`${API_URL}/api/health/test-results`, { credentials: 'include' });
            const data = await res.json();
            if (data.data) setSavedTests(data.data);
        } catch (err) {
            console.error('Error fetching test results:', err);
        }
    };

    const addTestField = () => setTestFields([...testFields, { key: '', value: '' }]);
    const removeTestField = (i: number) => setTestFields(testFields.filter((_, idx) => idx !== i));
    const updateTestField = (i: number, field: 'key' | 'value', val: string) => {
        const updated = [...testFields];
        updated[i][field] = val;
        setTestFields(updated);
    };

    const handleInterpretTest = async () => {
        if (isAILocked) return;
        const results: Record<string, any> = {};
        testFields.forEach(f => { if (f.key && f.value) results[f.key] = f.value; });
        if (Object.keys(results).length === 0) return;

        setIsInterpreting(true);
        try {
            const interpretation = await interpretTestResults({ testType, results });
            setTestInterpretation(interpretation);

            // Save to backend
            await fetch(`${API_URL}/api/health/test-results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ test_date: testDate, test_type: testType, results, ai_interpretation: interpretation })
            });
            fetchTestResults();
        } catch (err) {
            setTestInterpretation('Error interpreting results. Please try again.');
        } finally {
            setIsInterpreting(false);
        }
    };

    const handleReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileType = file.type || 'image/jpeg';

        // Convert to Base64
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64String = event.target?.result?.toString().split(',')[1];
            if (!base64String) {
                alert("Failed to read file.");
                return;
            }

            setIsParsingReport(true);
            try {
                const parsedFields = await parseHealthReport(base64String, fileType);
                if (parsedFields && parsedFields.length > 0) {
                    setTestFields(parsedFields);
                } else {
                    alert("Could not extract test results from this image. Please enter manually.");
                }
            } catch (err) {
                console.error("Report parsing error:", err);
                alert("Failed to parse report.");
            } finally {
                setIsParsingReport(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleConsultSend = async () => {
        if (!consultInput.trim() || isAILocked) return;
        const userMsg = { role: 'user', text: consultInput.trim() };
        setConsultMessages(prev => [...prev, userMsg]);
        setConsultInput('');
        setIsConsultLoading(true);

        try {
            const response = await healthChat(
                userMsg.text,
                { weightLogs, foodLogs, measurements, testResults: savedTests },
                consultMessages
            );
            setConsultMessages(prev => [...prev, { role: 'assistant', text: response || 'I could not process that. Please try again.' }]);
        } catch (err) {
            setConsultMessages(prev => [...prev, { role: 'assistant', text: 'Error connecting to AI. Please try again.' }]);
        } finally {
            setIsConsultLoading(false);
            setTimeout(() => consultEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    // Chart Data Preparation
    const chartData = weightLogs.map(log => ({
        name: new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: log.weight
    }));

    const todaysCalories = foodLogs
        .filter(f => f.date === new Date().toISOString().split('T')[0])
        .reduce((acc, curr) => acc + curr.calories, 0);

    return (
        <div className="space-y-6">

            {/* ====== MEDICAL DISCLAIMER MODAL ====== */}
            {showDisclaimer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-5 animate-page-enter">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                                <HeartPulse className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-center" style={{ color: '#1e293b' }}>Hi, and welcome!</h3>
                        <div className="text-sm space-y-3" style={{ color: '#475569' }}>
                            <p>
                                Just a quick reminder: the content available on LifeScope AI, whether in the form of health insights,
                                meal plans, or other written content, is for <strong>general informational purposes only</strong>.
                                It is not medical advice, diagnosis, or treatment, or a substitute for them from a qualified
                                health care provider familiar with your unique story.
                            </p>
                            <p>
                                You should not use the information, resources, or tools on our app to self-diagnose or
                                self-treat any health-related conditions.
                            </p>
                            <p>
                                <strong>Always seek the advice of a physician or qualified health provider</strong> with any questions
                                you may have regarding a medical condition or treatment.
                            </p>
                            <p>
                                Never disregard professional medical advice or delay seeking it because of something you have
                                read on LifeScope AI!
                            </p>
                        </div>
                        <button
                            onClick={acceptDisclaimer}
                            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl transition-all shadow-lg"
                        >
                            I understand, let's get started!
                        </button>
                    </div>
                </div>
            )}

            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Health & Nutrition</h2>
                    <p className="text-slate-400 text-sm">Track metrics, log meals, and plan your diet.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* AI Credits Indicator */}
                    {planInfo && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full" title="AI Credits Remaining">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs font-medium text-indigo-300">
                                {planInfo.aiCallsRemaining}/{planInfo.aiCallsLimit} credits
                            </span>
                        </div>
                    )}
                    <button
                        onClick={fetchHealthData}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-800 pb-1">
                <button
                    onClick={() => setActiveTab('metrics')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'metrics' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Activity className="w-4 h-4" /> Metrics & Tracker
                    {activeTab === 'metrics' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                </button>
                <button
                    onClick={() => setActiveTab('food')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'food' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Utensils className="w-4 h-4" /> Food Log (AI)
                    {activeTab === 'food' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                </button>
                <button
                    onClick={() => setActiveTab('plan')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'plan' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <ChefHat className="w-4 h-4" /> Meal Planner
                    {activeTab === 'plan' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                </button>
                <button
                    onClick={() => setActiveTab('consultant')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative flex items-center gap-2 ${activeTab === 'consultant' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Stethoscope className="w-4 h-4" /> Health Consultant
                    {activeTab === 'consultant' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                </button>
            </div>

            {activeTab === 'metrics' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3 flex justify-end">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${showHistory
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {showHistory ? <TrendingUp className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                            {showHistory ? "View Charts" : "View History Tables"}
                        </button>
                    </div>

                    {showHistory ? (
                        <>
                            <div className="glass-panel p-6 rounded-2xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Scale className="w-5 h-5 text-indigo-400" /> Weight History
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-slate-400">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                                            <tr>
                                                <th className="px-4 py-3 rounded-l-lg">Date</th>
                                                <th className="px-4 py-3">Weight (kg)</th>
                                                <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {weightLogs.slice().reverse().map(log => (
                                                <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                                                    <td className="px-4 py-3 font-medium text-white">{new Date(log.date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 text-indigo-300 font-bold">{log.weight}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={(e) => deleteWeightLog(log.id, e)}
                                                            className="text-slate-600 hover:text-red-500 transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {weightLogs.length === 0 && (
                                                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-600">No weight logs found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-emerald-400" /> Measurement History
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-slate-400">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                                            <tr>
                                                <th className="px-4 py-3 rounded-l-lg">Date</th>
                                                <th className="px-4 py-3">Arm</th>
                                                <th className="px-4 py-3">Stomach</th>
                                                <th className="px-4 py-3">Waist</th>
                                                <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {measurements.slice().reverse().map(m => (
                                                <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                                                    <td className="px-4 py-3 font-medium text-white">{new Date(m.date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3">{m.arm} cm</td>
                                                    <td className="px-4 py-3">{m.stomach} cm</td>
                                                    <td className="px-4 py-3">{m.waist} cm</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={(e) => deleteMeasurement(m.id, e)}
                                                            className="text-slate-600 hover:text-red-500 transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {measurements.length === 0 && (
                                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">No measurements found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Weight Section */}
                            <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <Scale className="w-5 h-5 text-indigo-400" /> Weight Tracker
                                    </h3>
                                    <div className="flex gap-2 items-center bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
                                        {/* Date Picker */}
                                        <div className="relative">
                                            <input
                                                type="date"
                                                className="bg-slate-800 border-none rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                value={weightDate}
                                                onChange={(e) => setWeightDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="h-4 w-[1px] bg-slate-700 mx-1"></div>
                                        <input
                                            type="number"
                                            placeholder="kg"
                                            className="bg-transparent border-none w-16 text-sm text-white focus:outline-none text-right"
                                            value={newWeight}
                                            onChange={(e) => setNewWeight(e.target.value)}
                                        />
                                        <button onClick={addWeightLog} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-sm transition-colors">
                                            Log
                                        </button>
                                    </div>
                                </div>

                                <div className="h-64 w-full mb-4 overflow-x-auto custom-scrollbar">
                                    <div style={{ minWidth: '600px', height: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                                                <Area type="monotone" dataKey="weight" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#weightGradient)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Weekly Measurements */}
                            <div className="glass-panel p-6 rounded-2xl">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-emerald-400" /> Metrics
                                    </h3>
                                    <input
                                        type="date"
                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 focus:outline-none"
                                        value={measurementDate}
                                        onChange={(e) => setMeasurementDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="grid grid-cols-3 gap-2">
                                        <label className="text-xs text-slate-400">Arm/Hand</label>
                                        <label className="text-xs text-slate-400">Stomach</label>
                                        <label className="text-xs text-slate-400">Waist</label>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" placeholder="cm" value={newMeasurement.arm} onChange={e => setNewMeasurement({ ...newMeasurement, arm: e.target.value })} />
                                        <input className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" placeholder="cm" value={newMeasurement.stomach} onChange={e => setNewMeasurement({ ...newMeasurement, stomach: e.target.value })} />
                                        <input className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" placeholder="cm" value={newMeasurement.waist} onChange={e => setNewMeasurement({ ...newMeasurement, waist: e.target.value })} />
                                    </div>
                                    <button onClick={addMeasurement} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm transition-colors">
                                        Save Measurements
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {loading ? (
                                        <p className="text-xs text-slate-500 text-center animate-pulse">Loading data...</p>
                                    ) : (
                                        measurements.slice().reverse().map(m => (
                                            <div key={m.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex justify-between items-center text-sm">
                                                <span className="text-slate-400 text-xs">{new Date(m.date).toLocaleDateString()}</span>
                                                <div className="flex gap-3 text-slate-200">
                                                    <span title="Arm">💪 {m.arm}</span>
                                                    <span title="Stomach">🤰 {m.stomach}</span>
                                                    <span title="Waist">📏 {m.waist}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {!loading && measurements.length === 0 && <p className="text-xs text-slate-500 text-center">No measurements found in DB.</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'food' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="glass-panel p-6 rounded-2xl h-fit">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-white mb-1">Calories Today</h3>
                            <div className="text-4xl font-bold text-indigo-400">{todaysCalories} <span className="text-sm text-slate-500 font-normal">kcal</span></div>
                        </div>

                        {/* Camera / Upload Area */}
                        <div className="space-y-4">
                            {showCamera ? (
                                <div className="relative rounded-xl overflow-hidden bg-black border border-indigo-500">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover" />
                                    <canvas ref={canvasRef} className="hidden" />
                                    <div className="absolute bottom-4 left-0 w-full flex justify-center gap-4">
                                        <button onClick={capturePhoto} className="w-12 h-12 bg-white rounded-full border-4 border-indigo-500 shadow-lg flex items-center justify-center">
                                            <div className="w-10 h-10 bg-white rounded-full border border-slate-200"></div>
                                        </button>
                                        <button onClick={stopCamera} className="absolute right-4 top-[-220px] bg-black/50 p-2 rounded-full text-white">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={startCamera}
                                        className="w-full py-4 rounded-xl border-2 border-dashed border-indigo-500/50 hover:border-indigo-400 hover:bg-indigo-500/10 flex flex-col items-center justify-center gap-2 transition-all group"
                                    >
                                        <Camera className="w-8 h-8 text-indigo-400 group-hover:scale-110 transition-transform" />
                                        <span className="text-indigo-300 font-medium">Take Photo</span>
                                    </button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0f172a] px-2 text-slate-500">Or upload</span></div>
                                    </div>

                                    <label className="block w-full border border-slate-700 hover:bg-slate-900 rounded-xl p-3 cursor-pointer text-center">
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                        <span className="text-slate-400 text-sm">Choose from Gallery</span>
                                    </label>
                                </>
                            )}
                        </div>

                        {isAnalyzingFood && (
                            <div className="mt-4 flex items-center justify-center gap-2 text-indigo-400 text-sm animate-pulse">
                                <Activity className="w-4 h-4" /> Analyzing food content...
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-lg font-semibold text-white">Recent Logs (Last 20)</h3>
                        {loading ? (
                            <p className="text-slate-500 text-center py-4">Loading food history...</p>
                        ) : foodLogs.length === 0 ? (
                            <div className="text-center py-12 text-slate-600">
                                <Utensils className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No meals logged yet. Snap a picture!</p>
                            </div>
                        ) : (
                            foodLogs.map(log => {
                                const items = log.items_json ? JSON.parse(log.items_json) : [];
                                return (
                                    <div key={log.id} className="glass-panel p-4 rounded-xl flex flex-col gap-3 transition-all hover:bg-slate-800/10">
                                        <div className="flex gap-4 items-start">
                                            {log.image ? (
                                                <img src={log.image} alt={log.name} className="w-16 h-16 rounded-lg object-cover bg-slate-800 flex-shrink-0" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                    <Utensils className="w-6 h-6 text-slate-600" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-white capitalize flex items-center gap-2">
                                                            {log.name}
                                                            {log.confidence && log.confidence !== 'high' && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold uppercase">
                                                                    {log.confidence} confidence
                                                                </span>
                                                            )}
                                                        </h4>
                                                        <span className="text-xs text-slate-500">{log.date} • {log.time}</span>
                                                    </div>
                                                    <button onClick={() => deleteFoodLog(log.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Sub-items list if available */}
                                                {items.length > 0 && (
                                                    <div className="mt-3 mb-2 space-y-1.5 border-l-2 border-indigo-500/30 pl-3">
                                                        {items.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between text-xs">
                                                                <span className="text-slate-300">{item.name} <span className="text-slate-500">({item.portion})</span></span>
                                                                <span className="text-slate-400 font-medium">{item.calories} kcal</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700/30 text-sm">
                                                    <span className="text-indigo-300 font-bold">{log.calories} kcal total</span>
                                                    <span className="text-slate-400">P: {log.protein}g</span>
                                                    <span className="text-slate-400">C: {log.carbs}g</span>
                                                    <span className="text-slate-400">F: {log.fat}g</span>
                                                </div>

                                                {/* Notes / Disclaimers */}
                                                {log.notes && (
                                                    <div className="mt-3 text-[11px] text-amber-200/70 bg-amber-500/5 p-2 rounded border border-amber-500/10 leading-relaxed">
                                                        {log.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        {/* Persistent AI Accuracy Disclaimer */}
                        {foodLogs.length > 0 && (
                            <div className="text-[10px] text-center text-slate-500 pt-4 border-t border-slate-800">
                                * AI evaluations of food photos are estimates and may contain inaccuracies.
                                Always consult nutritional labels for precise macronutrient data.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'plan' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="glass-panel p-6 rounded-2xl h-fit">
                        <h3 className="text-lg font-semibold text-white mb-4">Plan Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Goal</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm" value={planPrefs.goal} onChange={e => setPlanPrefs({ ...planPrefs, goal: e.target.value })}>
                                    <option>Lose Weight</option>
                                    <option>Gain Muscle</option>
                                    <option>Maintain</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Diet Type</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm" value={planPrefs.dietType} onChange={e => setPlanPrefs({ ...planPrefs, dietType: e.target.value })}>
                                    <option>Balanced</option>
                                    <option>Mediterranean</option>
                                    <option>Keto</option>
                                    <option>Vegetarian</option>
                                    <option>Vegan</option>
                                    <option>Paleo</option>
                                    <option>Low-Carb</option>
                                    <option>High-Protein</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Duration (Days)</label>
                                    <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm" value={planPrefs.duration} onChange={e => setPlanPrefs({ ...planPrefs, duration: e.target.value })}>
                                        <option value="1">1 Day</option>
                                        <option value="3">3 Days</option>
                                        <option value="7">7 Days</option>
                                        <option value="14">14 Days</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Calories / Day</label>
                                    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm" value={planPrefs.caloriesPerDay} onChange={e => setPlanPrefs({ ...planPrefs, caloriesPerDay: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Country / Cuisine Preference (Optional)</label>
                                <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm" placeholder="e.g. Italy, Japan, Mexico" value={planPrefs.country} onChange={e => setPlanPrefs({ ...planPrefs, country: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Ethnic Group / Specifics (Optional)</label>
                                <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm" placeholder="e.g. Yoruba, Punjabi, Creole" value={planPrefs.ethnicGroup} onChange={e => setPlanPrefs({ ...planPrefs, ethnicGroup: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Allergies / Dislikes</label>
                                <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm" placeholder="e.g. peanuts, fish, cilantro" value={planPrefs.allergies} onChange={e => setPlanPrefs({ ...planPrefs, allergies: e.target.value })} />
                            </div>

                            <button
                                onClick={handleGeneratePlan}
                                disabled={isGeneratingPlan}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                                {isGeneratingPlan ? 'Generating...' : 'Create with AI'}
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {/* Main Editor */}
                        <div className="glass-panel p-6 rounded-2xl flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <CalendarCheck className="w-5 h-5 text-emerald-400" /> Your Plan
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add instructions (e.g. 'less carbs')"
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-[200px]"
                                        value={planComments}
                                        onChange={(e) => setPlanComments(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleImprovePlan(); }}
                                    />
                                    <button
                                        onClick={handleImprovePlan}
                                        disabled={isImprovingPlan || !mealPlan}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        {isImprovingPlan ? 'Analyzing...' : 'AI Coach'}
                                    </button>
                                </div>
                            </div>

                            <textarea
                                className="w-full flex-1 bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-slate-300 text-sm leading-loose focus:outline-none focus:border-indigo-500 font-mono resize-none min-h-[300px]"
                                placeholder="Write your meal plan here or generate one..."
                                value={mealPlan}
                                onChange={(e) => setMealPlan(e.target.value)}
                            />

                            <div className="mt-2 text-right">
                                <span className="text-xs text-slate-500">Auto-saves to local storage</span>
                            </div>
                        </div>

                        {/* AI Suggestions Overlay/Panel */}
                        {aiSuggestion && (
                            <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 bg-indigo-900/10 animate-in slide-in-from-bottom-4">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <Sparkles className="w-5 h-5" />
                                        <h4 className="font-bold">AI Coach Suggestions</h4>
                                    </div>
                                    <button onClick={() => setAiSuggestion(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                                </div>

                                <div className="mb-6">
                                    <h5 className="text-xs uppercase text-slate-500 font-bold mb-2">Critique</h5>
                                    <p className="text-slate-300 text-sm leading-relaxed">{aiSuggestion.critique}</p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={applySuggestion}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" /> Apply Changes
                                    </button>
                                    <button
                                        onClick={() => setAiSuggestion(null)}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Save for Later (Dismiss)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'consultant' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Test Results Input */}
                    <div className="glass-panel p-6 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Stethoscope className="w-5 h-5 text-emerald-400" /> Log Test Results
                            </h3>
                            <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isParsingReport ? 'bg-indigo-600/50 text-indigo-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
                                {isParsingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                                {isParsingReport ? 'Scanning...' : 'Upload Report'}
                                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReportUpload} disabled={isParsingReport} />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Test Type</label>
                                <select value={testType} onChange={e => setTestType(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white">
                                    <option>Blood Test</option>
                                    <option>Lipid Panel</option>
                                    <option>Thyroid Panel</option>
                                    <option>Liver Function</option>
                                    <option>Kidney Function</option>
                                    <option>Blood Sugar (Glucose)</option>
                                    <option>Urinalysis</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Test Date</label>
                                <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs text-slate-400">Test Values</label>
                            {testFields.map((f, i) => (
                                <div key={i} className="flex gap-2">
                                    <input placeholder="Parameter (e.g. WBC)" value={f.key}
                                        onChange={e => updateTestField(i, 'key', e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                                    <input placeholder="Value (e.g. 5.2)" value={f.value}
                                        onChange={e => updateTestField(i, 'value', e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" />
                                    {testFields.length > 1 && (
                                        <button onClick={() => removeTestField(i)} className="text-slate-500 hover:text-red-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={addTestField} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add field
                            </button>
                        </div>

                        <button onClick={handleInterpretTest}
                            disabled={isInterpreting || isAILocked}
                            className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${isAILocked ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}>
                            {isInterpreting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {isAILocked ? 'Upgrade to Unlock AI' : 'Interpret Results'}
                        </button>

                        {testInterpretation && (
                            <div className="bg-slate-900/80 rounded-xl p-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line max-h-[300px] overflow-y-auto custom-scrollbar">
                                {testInterpretation}
                            </div>
                        )}

                        {savedTests.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-800">
                                <h4 className="text-xs uppercase text-slate-500 font-bold mb-3">Previous Tests</h4>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                    {savedTests.map(t => (
                                        <div key={t.id} className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden transition-all">
                                            <button
                                                onClick={() => setSelectedTestId(selectedTestId === t.id ? null : t.id)}
                                                className="w-full p-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                                        <FileUp className="w-4 h-4 text-indigo-400" />
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="block text-white font-medium">{t.test_type}</span>
                                                        <span className="block text-xs text-slate-500">{new Date(t.test_date).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className={`transform transition-transform text-slate-500 ${selectedTestId === t.id ? 'rotate-180' : ''}`}>
                                                    ▼
                                                </div>
                                            </button>

                                            {selectedTestId === t.id && (
                                                <div className="p-4 border-t border-slate-700/50 bg-slate-900/80">
                                                    <div className="mb-4">
                                                        <h5 className="text-xs font-semibold text-slate-400 mb-2 uppercase">Raw Values</h5>
                                                        <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                                                            {Object.entries(t.results || {}).map(([key, value]) => (
                                                                <div key={key} className="flex justify-between bg-slate-800/50 px-3 py-1.5 rounded">
                                                                    <span className="text-slate-400">{key}</span>
                                                                    <span className="font-medium text-white">{String(value)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-semibold text-slate-400 mb-2 uppercase">AI Interpretation</h5>
                                                        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line text-xs font-medium bg-indigo-500/5 p-3 border border-indigo-500/10 rounded-lg">
                                                            {t.ai_interpretation}
                                                        </div>
                                                    </div>
                                                    <button onClick={async () => {
                                                        await api.delete(`health/test-results/${t.id}`);
                                                        setSavedTests(savedTests.filter(test => test.id !== t.id));
                                                    }} className="mt-4 flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete Report
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Health Chat */}
                    <div className="glass-panel p-6 rounded-2xl flex flex-col">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-indigo-400" /> Health Chat
                        </h3>

                        <div className="flex-1 min-h-[400px] max-h-[500px] overflow-y-auto space-y-3 mb-4 custom-scrollbar">
                            {consultMessages.length === 0 && (
                                <div className="text-center py-12 text-slate-600">
                                    <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">Ask questions about your health data, test results, or general wellness.</p>
                                    <p className="text-xs mt-2 text-amber-500/60">Not a substitute for professional medical advice.</p>
                                </div>
                            )}
                            {consultMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-md'
                                        : 'bg-slate-800 text-slate-300 rounded-bl-md'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isConsultLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 rounded-2xl px-4 py-3 text-sm rounded-bl-md">
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    </div>
                                </div>
                            )}
                            <div ref={consultEndRef} />
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={consultInput}
                                onChange={e => setConsultInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleConsultSend()}
                                placeholder={isAILocked ? 'Upgrade to use Health Chat' : 'Ask about your health...'}
                                disabled={isAILocked}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                            <button onClick={handleConsultSend} disabled={isAILocked || isConsultLoading || !consultInput.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-colors">
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Health;