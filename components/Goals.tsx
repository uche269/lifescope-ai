import React, { useState } from 'react';
import { Goal, GoalCategory, Activity } from '../types';
import { Plus, Trash2, Sparkles, Edit2, Check, X, Calendar } from 'lucide-react';
import { getAIRecommendation } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface GoalsProps {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
}

const Goals: React.FC<GoalsProps> = ({ goals, setGoals }) => {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);

  // New/Edit Goal State
  const [goalForm, setGoalForm] = useState<{
    id?: string,
    title: string,
    category: GoalCategory,
    priority: 'High' | 'Medium' | 'Low'
  }>({ title: '', category: GoalCategory.PERSONAL, priority: 'Medium' });

  // Activity Editing State
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [tempActivityName, setTempActivityName] = useState('');

  // New Activity State (Inline Form)
  const [addingActivityTo, setAddingActivityTo] = useState<string | null>(null);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityFreq, setNewActivityFreq] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');

  const openAddModal = () => {
    setGoalForm({ title: '', category: GoalCategory.PERSONAL, priority: 'Medium' });
    setShowAddModal(true);
  };

  const openEditModal = (goal: Goal) => {
    setGoalForm({ id: goal.id, title: goal.title, category: goal.category, priority: goal.priority });
    setShowEditModal(goal.id);
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title || !user) return;

    if (showEditModal && goalForm.id) {
      // Edit existing
      const { error } = await supabase
        .from('goals')
        .update({
          title: goalForm.title,
          category: goalForm.category,
          priority: goalForm.priority
        })
        .eq('id', goalForm.id);

      if (!error) {
        setGoals(goals.map(g => g.id === goalForm.id ? {
          ...g,
          title: goalForm.title,
          category: goalForm.category,
          priority: goalForm.priority
        } : g));
        setShowEditModal(null);
      }
    } else {
      // Add new
      const { data, error } = await supabase
        .from('goals')
        .insert([{
          user_id: user.id,
          title: goalForm.title,
          category: goalForm.category,
          priority: goalForm.priority,
          description: '',
          progress: 0,
          status: 'Not Started'
        }])
        .select()
        .single();

      if (!error && data) {
        const newGoal: Goal = {
          ...data,
          activities: [] // Init with empty activities
        };
        setGoals([...goals, newGoal]);
        setShowAddModal(false);
      }
    }
  };

  const deleteGoal = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this goal?")) {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (!error) {
        setGoals(goals.filter(g => g.id !== id));
      }
    }
  };

  const generateAdvice = async (goal: Goal) => {
    setLoadingAI(goal.id);
    const advice = await getAIRecommendation(goal.title, goal.status);
    setGoals(goals.map(g => g.id === goal.id ? { ...g, aiRecommendations: advice } : g));
    setLoadingAI(null);
  };


  const checkIsCompleted = (activity: Activity): boolean => {
    // If we have no timestamp, rely on isCompleted (legacy) or false
    if (!activity.last_completed_at) return activity.isCompleted;

    const last = new Date(activity.last_completed_at);
    const now = new Date();

    // Normalize to local date strings to compare
    const isSameDay = (d1: Date, d2: Date) =>
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();

    if (activity.frequency === 'Daily') {
      return isSameDay(last, now);
    }

    if (activity.frequency === 'Weekly') {
      // Check if within same ISO week
      const getWeek = (d: Date) => {
        const d2 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d2.setUTCDate(d2.getUTCDate() + 4 - (d2.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d2.getUTCFullYear(), 0, 1));
        return Math.ceil((((d2.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      }
      return getWeek(last) === getWeek(now) && last.getFullYear() === now.getFullYear();
    }

    if (activity.frequency === 'Monthly') {
      return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
    }

    // Default 'Once' or others
    return activity.isCompleted;
  };

  const toggleActivity = async (goalId: string, activityId: string) => {
    if (editingActivityId === activityId) return;

    const goal = goals.find(g => g.id === goalId);
    const activity = goal?.activities.find(a => a.id === activityId);
    if (!goal || !activity) return;

    // Toggle: if currently completed (calculated), we effectively "uncomplete" it (clear timestamp?)
    // But better behavior: if done today, toggle off. If done yesterday (expired), toggle on for today.
    // Simplifying: if visually checkmarked, clicking unchecks. If unchecked, clicking checks (updates timestamp).
    const isCurrentlyDone = checkIsCompleted(activity);
    const newStatus = !isCurrentlyDone;

    // If checking ON, update timestamp to NOW.
    // If checking OFF, set timestamp to null (or maybe keep history? For now let's just clear for simple state).
    const newTimestamp = newStatus ? new Date().toISOString() : null;

    // Update Activity in DB
    const { error } = await supabase
      .from('activities')
      .update({
        is_completed: newStatus,
        last_completed_at: newTimestamp
      })
      .eq('id', activityId);

    if (error) return;

    // Update Local State
    const updatedActivities = goal.activities.map(a =>
      a.id === activityId ? { ...a, isCompleted: newStatus, last_completed_at: newTimestamp || undefined } : a
    );

    // Recalc Goal Progress
    // We must count how many 'active' activities are done based on the SAME logic
    const completedCount = updatedActivities.filter(a => {
      // We can reuse the logic, but we need to pass the updated 'a'
      // But 'a' here is the raw object.
      // Let's rely on the explicit 'newStatus' for the current one, and re-eval others??
      // Actually, for simplicity, let's just use the boolean we just set for the current one, 
      // AND re-evaluate others just in case they expired while we sat here? 
      // No, keep it simple. Trust the loaded state for others unless we want real-time expiration?
      // Let's just trust isCompleted for others for now, but really we should use the check function.
      if (a.id === activityId) return newStatus;
      return checkIsCompleted(a);
    }).length;

    const progress = updatedActivities.length ? Math.round((completedCount / updatedActivities.length) * 100) : 0;

    // Recalculate Status based on Progress
    let newGoalStatus: 'Not Started' | 'In Progress' | 'Completed' = 'In Progress';
    if (progress === 100) newGoalStatus = 'Completed';
    else if (progress === 0) newGoalStatus = 'Not Started';

    // Update Goal Progress & Status in DB
    await supabase.from('goals').update({
      progress,
      status: newGoalStatus
    }).eq('id', goalId);

    // Update Local State
    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      return { ...g, activities: updatedActivities, progress, status: newGoalStatus };
    }));
  };

  const saveNewActivity = async (goalId: string) => {
    if (!newActivityName.trim()) return;

    // Insert into DB
    const { data, error } = await supabase
      .from('activities')
      .insert([{
        goal_id: goalId,
        name: newActivityName,
        frequency: newActivityFreq,
        is_completed: false
      }])
      .select()
      .single();

    if (error || !data) return;

    // Update Local
    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      // Recalculate progress with new activity (adds 1 uncompleted)
      const newActivities = [...g.activities, {
        id: data.id,
        name: data.name,
        isCompleted: data.is_completed,
        frequency: data.frequency
      }];
      const completed = newActivities.filter(a => a.isCompleted).length;
      const progress = Math.round((completed / newActivities.length) * 100);

      return {
        ...g,
        progress,
        activities: newActivities
      }
    }));

    // Recalculate based on new total
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
      const newTotal = goal.activities.length + 1;
      const completedCount = goal.activities.filter(a => a.isCompleted).length;
      // inherited completion status is false for new activity
      const newProgress = Math.round((completedCount / newTotal) * 100);

      let newStatus: 'Not Started' | 'In Progress' | 'Completed' = 'In Progress';
      if (newProgress === 100) newStatus = 'Completed';
      else if (newProgress === 0) newStatus = 'Not Started';

      await supabase.from('goals').update({
        progress: newProgress,
        status: newStatus
      }).eq('id', goalId);
    }

    setAddingActivityTo(null);
    setNewActivityName('');
    setNewActivityFreq('Weekly');
  }

  const deleteActivity = async (goalId: string, activityId: string) => {
    const { error } = await supabase.from('activities').delete().eq('id', activityId);
    if (error) return;

    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      const newActivities = g.activities.filter(a => a.id !== activityId);
      // Recalc progress
      const completed = newActivities.filter(a => a.isCompleted).length;
      const progress = newActivities.length ? Math.round((completed / newActivities.length) * 100) : 0;

      return {
        ...g,
        progress,
        activities: newActivities
      }
    }));
  }

  const startEditActivity = (activity: Activity) => {
    setEditingActivityId(activity.id);
    setTempActivityName(activity.name);
  }

  const saveActivityName = async (goalId: string, activityId: string) => {
    const { error } = await supabase
      .from('activities')
      .update({ name: tempActivityName })
      .eq('id', activityId);

    if (error) return;

    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        activities: g.activities.map(a => a.id === activityId ? { ...a, name: tempActivityName } : a)
      }
    }));
    setEditingActivityId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Goals & Projects</h2>
        <button
          onClick={openAddModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Goal
        </button>
      </div>

      {/* Modal for Add/Edit Goal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-4">{showEditModal ? 'Edit Goal' : 'Add New Goal'}</h3>

            <label className="block text-xs text-slate-400 mb-1">Goal Title</label>
            <input
              type="text"
              placeholder="e.g., Save CAD $15,000"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white mb-4 focus:border-indigo-500 focus:outline-none"
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
            />

            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white mb-4 focus:border-indigo-500 focus:outline-none"
              value={goalForm.category}
              onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value as GoalCategory })}
            >
              {Object.values(GoalCategory).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <label className="block text-xs text-slate-400 mb-1">Priority Level</label>
            <div className="flex gap-4 mb-6">
              {['High', 'Medium', 'Low'].map(p => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    checked={goalForm.priority === p}
                    onChange={() => setGoalForm({ ...goalForm, priority: p as any })}
                    className="accent-indigo-500"
                  />
                  <span className={`text-sm ${p === 'High' ? 'text-red-400' : 'text-slate-300'}`}>{p}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(null); }}
                className="text-slate-400 hover:text-white px-4 py-2"
              >
                Cancel
              </button>
              <button onClick={handleSaveGoal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
                {showEditModal ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {goals.map(goal => (
          <div key={goal.id} className="glass-panel rounded-2xl p-6 border-l-4 border-l-indigo-500 relative group/card">

            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider">{goal.category}</span>
                  {goal.priority === 'High' && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded border border-red-500/30">HIGH</span>}
                </div>
                <h3 className="text-xl font-bold text-white mt-1 pr-8">{goal.title}</h3>
              </div>

              <div className="flex gap-2">
                <button onClick={() => openEditModal(goal)} className="text-slate-600 hover:text-indigo-400 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => deleteGoal(goal.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>Progress</span>
                <span>{goal.progress}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${goal.progress}%` }} />
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-300">Activities</h4>
                  <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded-full">
                    {goal.activities.filter(a => checkIsCompleted(a)).length}/{goal.activities.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingActivityTo(goal.id)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add New
                </button>
              </div>

              {/* Inline Add Activity Form */}
              {addingActivityTo === goal.id && (
                <div className="bg-slate-900/80 p-3 rounded-lg border border-indigo-500/50 flex flex-col gap-2 animate-in slide-in-from-top-2">
                  <input
                    autoFocus
                    placeholder="Activity name..."
                    value={newActivityName}
                    onChange={(e) => setNewActivityName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex justify-between items-center">
                    <select
                      value={newActivityFreq}
                      onChange={(e) => setNewActivityFreq(e.target.value as any)}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                    >
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setAddingActivityTo(null)} className="text-slate-500 hover:text-white text-xs px-2">Cancel</button>
                      <button onClick={() => saveNewActivity(goal.id)} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded hover:bg-indigo-500">Save</button>
                    </div>
                  </div>
                </div>
              )}

              {goal.activities.length === 0 && !addingActivityTo && (
                <p className="text-xs text-slate-500 italic">No activities added yet.</p>
              )}

              <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {goal.activities.map(activity => {
                  const isDone = checkIsCompleted(activity);
                  return (
                    <div key={activity.id} className="flex items-center gap-3 group bg-slate-900/30 p-2 rounded-lg hover:bg-slate-900/60 transition-colors">
                      <div
                        onClick={() => toggleActivity(goal.id, activity.id)}
                        className={`cursor-pointer w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${isDone ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 hover:border-indigo-500'
                          }`}
                      >
                        {isDone && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {editingActivityId === activity.id ? (
                        <div className="flex items-center flex-1 gap-2">
                          <input
                            autoFocus
                            value={tempActivityName}
                            onChange={(e) => setTempActivityName(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                          <button onClick={() => saveActivityName(goal.id, activity.id)}><Check className="w-3 h-3 text-emerald-400" /></button>
                          <button onClick={() => setEditingActivityId(null)}><X className="w-3 h-3 text-red-400" /></button>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm truncate ${isDone ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{activity.name}</span>
                            <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{activity.frequency}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditActivity(activity)} className="p-1 text-slate-500 hover:text-indigo-400"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={() => deleteActivity(goal.id, activity.id)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Section */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">AI Recommendations</span>
                </div>
                <button
                  onClick={() => generateAdvice(goal)}
                  disabled={loadingAI === goal.id}
                  className="text-xs bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 px-2 py-1 rounded transition-colors"
                >
                  {loadingAI === goal.id ? 'Generating...' : 'Refresh'}
                </button>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-line clean-text">
                {goal.aiRecommendations ? goal.aiRecommendations.replace(/[*#_]/g, '') : "Click refresh to generate actionable insights and identify pitfalls for this goal."}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Goals;