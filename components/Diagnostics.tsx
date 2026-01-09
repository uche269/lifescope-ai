
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { debugLogs } from '../utils/debugLogger';
import { Goal } from '../types';

interface DiagnosticsProps {
    goals: Goal[];
}

const Diagnostics: React.FC<DiagnosticsProps> = ({ goals }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dbTest, setDbTest] = useState<string>('Untested');
    const [logs, setLogs] = useState<string[]>([]);

    // Refresh logs every second if open
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setLogs([...debugLogs]);
        }, 1000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const runDbTest = async () => {
        setDbTest("Running...");
        const { data, error } = await supabase.from('activities').select('id, name, is_completed').limit(1);
        if (error) setDbTest(`FAIL: ${error.message}`);
        else setDbTest(`OK: Read ${data.length} rows.`);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-red-900/50 text-red-200 px-3 py-1 text-xs rounded border border-red-700 hover:bg-red-900 z-50 pointer-events-auto"
            >
                Debug
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <h3 className="font-bold text-red-400">System Diagnostics</h3>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">Close</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">

                    {/* Database Check */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-1">Database Connection</h4>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-mono bg-slate-950 p-2 rounded border border-slate-800 flex-1">{dbTest}</span>
                            <button onClick={runDbTest} className="text-xs bg-indigo-600 px-3 py-2 rounded text-white">Test Connection</button>
                        </div>
                    </div>

                    {/* Local State Dump */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-1">Local State Sample (First Goal)</h4>
                        {goals.length > 0 ? (
                            <pre className="text-[10px] font-mono bg-slate-950 p-2 rounded overflow-auto max-h-40 border border-slate-800 text-green-400">
                                {JSON.stringify(goals[0], null, 2)}
                            </pre>
                        ) : (
                            <p className="text-xs text-slate-500">No goals found in local state.</p>
                        )}
                    </div>

                    {/* Error Logs */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-1">Error Logs</h4>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800 h-60 overflow-y-auto">
                            {logs.length === 0 ? (
                                <p className="text-xs text-slate-500 italic">No errors logged yet.</p>
                            ) : (
                                logs.map((l, i) => (
                                    <div key={i} className="text-[10px] font-mono text-amber-500 mb-1 border-b border-slate-800/50 pb-1">{l}</div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Diagnostics;
