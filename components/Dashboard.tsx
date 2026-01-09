import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Goal, GoalCategory } from '../types';
import { TrendingUp, CheckCircle2, AlertCircle, Sparkles, FileText, X, Download, LayoutTemplate, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateAnnualReportClaude } from '../services/claudeService';
import { checkIsCompleted } from '../utils/activityUtils';

interface DashboardProps {
  goals: Goal[];
}

const Dashboard: React.FC<DashboardProps> = ({ goals }) => {
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const { user } = useAuth(); // Get user for name

  const activeFocus = useMemo(() => {
    const highPriority = goals.filter(g => g.price === 'High'); // This logic was flawed in original too, assuming priority exists. 
    // Wait, type definition says priority is 'High' | 'Medium' | 'Low'.
    const highPriority = goals.filter(g => g.priority === 'High');
    if (highPriority.length === 0) return { title: "Define a High Priority Goal", category: "Planning" };
    // Return the one with lowest progress to focus on
    return highPriority.sort((a, b) => a.progress - b.progress)[0];
  }, [goals]);

  const completedGoals = goals.filter(g => g.progress === 100).length;

  const completedActivities = useMemo(() => {
    let count = 0;
    goals.forEach(g => {
      count += g.activities.filter(a => checkIsCompleted(a)).length;
    });
    return count;
  }, [goals]);

  const activeGoals = goals.filter(g => g.progress < 100).length;

  const overallProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    const total = goals.reduce((acc, g) => acc + g.progress, 0);
    return Math.round(total / goals.length);
  }, [goals]);

  const highPriorityGoals = goals.filter(g => g.priority === 'High');

  // Compute Category Data for the Chart
  const categoryData = useMemo(() => {
    const groups: Record<string, { total: number; count: number }> = {};

    goals.forEach(g => {
      if (!groups[g.category]) groups[g.category] = { total: 0, count: 0 };
      groups[g.category].total += g.progress;
      groups[g.category].count += 1;
    });

    const shortNames: Record<string, string> = {
      'Physical appearance': 'Looks',
      'Health, weight & diet': 'Health',
      'Self development': 'Growth',
      'Personal projects': 'Projects',
      'Work projects': 'Work',
      'Family activities': 'Family',
      'Finances': 'Money',
      'Relocation to Canada': 'Canada',
    };

    return Object.keys(groups).map(cat => ({
      name: shortNames[cat] || cat.split(' ')[0],
      fullName: cat,
      avgProgress: Math.round(groups[cat].total / groups[cat].count),
      goalsCount: groups[cat].count
    })).sort((a, b) => b.avgProgress - a.avgProgress);
  }, [goals]);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setShowReportModal(true);
    setReportContent(null);

    // Fetch Health Data from Supabase
    const { data: healthLogs } = await supabase.from('weight_logs').select('*').order('date', { ascending: true });
    const { data: measurements } = await supabase.from('measurements').select('*');
    const { count: foodLogsCount } = await supabase.from('food_logs').select('*', { count: 'exact', head: true });

    const healthData = healthLogs || [];
    const measurementData = measurements || [];

    const userData = {
      goals: goals.map(g => ({
        title: g.title,
        status: g.status,
        progress: g.progress,
        category: g.category,
        activities: g.activities.map(a => ({
          name: a.name,
          completed: a.isCompleted,
          frequency: a.frequency
        }))
      })),
      health: {
        totalWeightLogs: healthData.length,
        startingWeight: healthData.length ? healthData[0].weight : 'N/A',
        currentWeight: healthData.length ? healthData[healthData.length - 1].weight : 'N/A',
        bodyMeasurementsCount: measurementData.length,
        totalMealsLogged: foodLogsCount || 0
      },
      summary: {
        totalGoals: goals.length,
        completed: completedGoals,
        completionRate: goals.length ? (completedGoals / goals.length * 100).toFixed(1) + '%' : '0%'
      }
    };

    const report = await generateAnnualReport(userData);
    setReportContent(report);
    setGeneratingReport(false);
  };

  const downloadReport = () => {
    if (!reportContent) return;
    const element = document.createElement("a");
    const file = new Blob([reportContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `LifeScope_Annual_Report_${new Date().getFullYear()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Calculate Approaching Deadlines (Next 7 days) and Missed Goals
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  const approachingGoals = goals.filter(g => {
    if (!g.deadline || g.progress === 100) return false;
    const d = new Date(g.deadline);
    // Determine if it is in the future but approaching
    const deadlineDate = new Date(d.setHours(0, 0, 0, 0));
    const todayDate = new Date(new Date().setHours(0, 0, 0, 0));
    const nextWeekDate = new Date(nextWeek.setHours(0, 0, 0, 0));

    return deadlineDate >= todayDate && deadlineDate <= nextWeekDate;
  });

  const missedGoals = goals.filter(g => {
    if (!g.deadline || g.progress === 100) return false;
    const d = new Date(g.deadline);
    const deadlineDate = new Date(d.setHours(0, 0, 0, 0));
    const todayDate = new Date(new Date().setHours(0, 0, 0, 0));
    return deadlineDate < todayDate;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'Boss'}
          </h1>
          <p className="text-slate-400">Here's your LifeScope overview for today.</p>
        </div>
        <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/30 p-4 rounded-xl flex items-center gap-4 backdrop-blur-sm">
          <div className="p-3 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/30">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider mb-0.5">Active Focus</p>
            <p className="text-lg font-bold text-white leading-tight">{activeFocus?.title || 'No Goals Set'}</p>
            <p className="text-[10px] text-slate-400">{activeFocus?.category}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleGenerateReport}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-105"
        >
          <Sparkles className="w-4 h-4" /> Year-in-Review
        </button>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" /> Annual Strategic Report
                </h3>
                <p className="text-xs text-slate-500">AI-Generated Analysis & Recommendations</p>
              </div>
              <div className="flex gap-2">
                {reportContent && (
                  <button onClick={downloadReport} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors" title="Download Report">
                    <Download className="w-5 h-5" />
                  </button>
                )}
                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-900/50">
              {generatingReport ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6">
                  <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-white mb-2">Analyzing Your Year</h4>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                      Crunching data from your goals, daily activities, health logs, and project milestones to generate strategic insights...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-line text-slate-300 leading-relaxed text-base font-light">
                    {reportContent}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium">Overall Progress</p>
              <h3 className="text-3xl font-bold text-white mt-1">{overallProgress}%</h3>
            </div>
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <p className="text-xs text-indigo-300">Across all categories</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium">Activities Done</p>
              <h3 className="text-3xl font-bold text-white mt-1">{completedActivities}</h3>
            </div>
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-emerald-300">Across all goals</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium">Active Focus</p>
              <h3 className="text-3xl font-bold text-white mt-1">{activeGoals}</h3>
            </div>
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <p className="text-xs text-amber-300">Goals in progress</p>
        </div>
      </div>

      {/* Approaching & Missed Goals Section */}
      {(approachingGoals.length > 0 || missedGoals.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {approachingGoals.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-amber-500">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Approaching Deadlines
              </h3>
              <div className="space-y-3">
                {approachingGoals.map(g => (
                  <div key={g.id} className="bg-slate-900/60 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{g.title}</div>
                      <div className="text-xs text-slate-500">{new Date(g.deadline!).toLocaleDateString()}</div>
                    </div>
                    <div className="text-xs font-mono text-amber-400">{g.progress}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {missedGoals.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-red-500">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Missed Goals
              </h3>
              <div className="space-y-3">
                {missedGoals.map(g => (
                  <div key={g.id} className="bg-slate-900/60 p-3 rounded-lg flex justify-between items-center border border-red-500/10">
                    <div>
                      <div className="text-sm font-medium text-slate-200">{g.title}</div>
                      <div className="text-xs text-red-400">Due {new Date(g.deadline!).toLocaleDateString()}</div>
                    </div>
                    <div className="text-xs font-mono text-red-400">{g.progress}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Tracker Section */}
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" /> Activity Tracker
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Today's Focus: Daily + Once Due Today */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Due Today
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {(() => {
                const daily = goals.flatMap(g => g.activities.filter(a => a.frequency === 'Daily' && !checkIsCompleted(a)).map(a => ({ ...a, goalTitle: g.title, type: 'Daily' })));
                const onceToday = goals.flatMap(g => g.activities.filter(a => a.frequency === 'Once' && a.deadline && new Date(a.deadline).setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0) && !a.isCompleted).map(a => ({ ...a, goalTitle: g.title, type: 'Deadline' })));
                const dueToday = [...daily, ...onceToday];

                return dueToday.length > 0 ? (
                  dueToday.map((a, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-900 rounded hover:bg-slate-800 transition-colors">
                      <div>
                        <span className="text-slate-200 block">{a.name}</span>
                        <span className="text-slate-500 text-[10px]">{a.goalTitle}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${a.type === 'Daily' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400'}`}>{a.type}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">All tasks for today completed!</p>
                );
              })()}
            </div>
          </div>

          {/* Overdue Activities */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-red-400" />
              Overdue
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {goals.flatMap(g => g.activities.filter(a => a.frequency === 'Once' && a.deadline && new Date(a.deadline).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && !a.isCompleted).map(a => ({ ...a, goalTitle: g.title }))).length > 0 ? (
                goals.flatMap(g => g.activities.filter(a => a.frequency === 'Once' && a.deadline && new Date(a.deadline).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && !a.isCompleted).map(a => ({ ...a, goalTitle: g.title }))).map((a, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-900 rounded border border-red-500/10 hover:bg-slate-800 transition-colors">
                    <div>
                      <span className="text-slate-200 block">{a.name}</span>
                      <span className="text-red-400 text-[10px]">Due {new Date(a.deadline!).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No overdue activities.</p>
              )}
            </div>
          </div>

          {/* Upcoming: Weekly (Sun) + Once in 7 days */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              This Week
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {(() => {
                // Calculate this Sunday
                const today = new Date();
                const sunday = new Date(today);
                sunday.setDate(today.getDate() + (7 - today.getDay())); // Simple next Sunday logic 

                const weekly = goals.flatMap(g => g.activities.filter(a => a.frequency === 'Weekly' && !checkIsCompleted(a)).map(a => ({ ...a, goalTitle: g.title, date: sunday, type: 'Weekly' })));

                const onceUpcoming = goals.flatMap(g => g.activities.filter(a => {
                  if (a.frequency !== 'Once' || !a.deadline || a.isCompleted) return false;
                  const d = new Date(a.deadline);
                  const deadlineDate = new Date(d.setHours(0, 0, 0, 0));
                  const todayDate = new Date(new Date().setHours(0, 0, 0, 0));
                  const nextWeekDate = new Date(new Date().setDate(new Date().getDate() + 7));
                  nextWeekDate.setHours(0, 0, 0, 0);
                  return deadlineDate > todayDate && deadlineDate <= nextWeekDate;
                }).map(a => ({ ...a, goalTitle: g.title, date: new Date(a.deadline!), type: 'Deadline' })));

                const allUpcoming = [...weekly, ...onceUpcoming].sort((a, b) => a.date.getTime() - b.date.getTime());

                return allUpcoming.length > 0 ? (
                  allUpcoming.map((a, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-900 rounded border-l-2 border-l-amber-500 hover:bg-slate-800 transition-colors">
                      <div>
                        <span className="text-slate-200 block">{a.name}</span>
                        <span className="text-amber-400 text-[10px]">
                          {a.type === 'Weekly' ? 'Due Sunday' : new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span className="text-slate-500 text-[10px] truncate max-w-[80px]">{a.goalTitle}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No upcoming deadlines.</p>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-indigo-400" /> Life Balance & Focus
            </h3>
            <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">Avg. Progress per Category</span>
          </div>

          <div className="h-64 w-full">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                    itemStyle={{ color: '#818cf8' }}
                    formatter={(value: number) => [`${value}%`, 'Avg Progress']}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="avgProgress" name="Avg. Progress %" radius={[4, 4, 0, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.avgProgress === 100 ? '#10b981' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <p>No active goals found.</p>
                <p className="text-xs mt-1">Add goals to see your life balance breakdown.</p>
              </div>
            )}
          </div>
        </div>

        {/* Priority List */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">High Priority Goals</h3>
          <div className="space-y-4">
            {highPriorityGoals.length > 0 ? (
              highPriorityGoals.map((goal, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div>
                      <span className="text-sm text-slate-300 block">{goal.category}</span>
                      <span className="text-xs text-slate-500">{goal.title}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-red-400">HIGH</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 italic">No high priority goals set.</p>
            )}
          </div>
          <div className="mt-6 p-4 bg-indigo-900/20 rounded-xl border border-indigo-500/20">
            <h4 className="text-indigo-400 text-sm font-semibold mb-1">AI Insight</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Your focus on relocation is increasing. Consider prioritizing IELTs preparation in the 'Self Development' module this week.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;