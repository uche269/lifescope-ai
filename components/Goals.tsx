import React, { useState, useEffect } from 'react';
import { Goal, GoalCategory, Activity, DefaultGoalCategories } from '../types';
import { Trash2, Edit2, Plus, Check, X, Calendar, ChevronRight, TrendingUp, AlertCircle, Eye, EyeOff, Sparkles, Maximize2, Minimize2, LayoutTemplate } from 'lucide-react';
import { getAIRecommendation } from '../services/geminiService';
// import { supabase } from '../lib/supabase'; // Removed
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { checkIsCompleted } from '../utils/activityUtils';
import { logError } from '../utils/debugLogger';

interface GoalsProps {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
}

const Goals: React.FC<GoalsProps> = ({ goals, setGoals }) => {
  const { user } = useAuth();

  // Categories State
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      if (!user) return;
      try {
        const data = await api.get('goal_categories');
        if (Array.isArray(data)) {
          setCustomCategories(data.map((c: any) => c.name));
        }
      } catch (e) { console.error(e); }
    };
    fetchCategories();
  }, [user]);

  const allCategories = [...new Set([...Object.values(DefaultGoalCategories), ...customCategories])];

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !user) return;
    try {
      await api.post('goal_categories', {
        user_id: user.id,
        name: newCategoryName,
        color: '#3b82f6',
        is_default: false
      });
      setCustomCategories([...customCategories, newCategoryName]);
      setGoalForm({ ...goalForm, category: newCategoryName });
      setIsAddingCategory(false);
      setNewCategoryName('');
    } catch (e) { console.error(e); }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);

  // New/Edit Goal State
  const [goalForm, setGoalForm] = useState<{
    id?: string,
    title: string,
    category: string,
    priority: 'High' | 'Medium' | 'Low',
    deadline?: string
  }>({ title: '', category: DefaultGoalCategories.PERSONAL, priority: 'Medium', deadline: '' });

  // Activity Editing State
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [showCompletedMap, setShowCompletedMap] = useState<Record<string, boolean>>({});

  // Expanded Goals State
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});

  const toggleExpand = (goalId: string) => {
    setExpandedGoals(prev => ({ ...prev, [goalId]: !prev[goalId] }));
  };

  // Temporary state for editing activity
  const [tempActivityName, setTempActivityName] = useState('');
  const [tempActivityFreq, setTempActivityFreq] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Once'>('Weekly');
  const [tempActivityDeadline, setTempActivityDeadline] = useState<string>('');

  // New Activity State (Inline Form)
  const [addingActivityTo, setAddingActivityTo] = useState<string | null>(null);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityFreq, setNewActivityFreq] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Once'>('Weekly');
  const [newActivityDeadline, setNewActivityDeadline] = useState<string>('');

  const startEditActivity = (activity: Activity) => {
    setEditingActivityId(activity.id);
    setTempActivityName(activity.name);
    setTempActivityFreq(activity.frequency);
    setTempActivityDeadline(activity.deadline || '');
  }

  const saveActivityChanges = async (goalId: string, activityId: string) => {
    try {
      const data = await api.put('activities', activityId, {
        name: tempActivityName,
        frequency: tempActivityFreq,
        deadline: tempActivityDeadline || null
      });
    } catch (error: any) {
      console.error('Error updating activity:', error);
      alert('Failed to update activity: ' + error.message);
      return;
    }

    setGoals(goals.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        activities: g.activities.map(a => a.id === activityId ? {
          ...a,
          name: tempActivityName,
          frequency: tempActivityFreq,
          deadline: tempActivityDeadline || undefined
        } : a)
      }
    }));
    setEditingActivityId(null);
  }

  const openAddModal = () => {
    setGoalForm({ title: '', category: DefaultGoalCategories.PERSONAL, priority: 'Medium', deadline: '' });
    setShowAddModal(true);
  };

  const openEditModal = (goal: Goal) => {
    setGoalForm({
      id: goal.id,
      title: goal.title,
      category: goal.category,
      priority: goal.priority,
      deadline: goal.deadline || ''
    });
    setShowEditModal(goal.id);
  };

  const handleSaveGoal = async () => {
    if (!goalForm.title || !user) return;

    if (showEditModal && goalForm.id) {
      // Edit existing
      try {
        const data = await api.put('goals', goalForm.id, {
          title: goalForm.title,
          category: goalForm.category,
          priority: goalForm.priority,
          deadline: goalForm.deadline || null
        });

        setGoals(goals.map(g => g.id === goalForm.id ? {
          ...g,
          title: goalForm.title,
          category: goalForm.category,
          priority: goalForm.priority,
          deadline: goalForm.deadline
        } : g));
        setShowEditModal(null);
      } catch (e) { console.error(e); }
    } else {
      // Add new
      try {
        const data = await api.post('goals', {
          user_id: user.id,
          title: goalForm.title,
          category: goalForm.category,
          priority: goalForm.priority,
          description: '',
          progress: 0,
          status: 'Not Started',
          deadline: goalForm.deadline || null
        });

        if (data) {
          const newGoal: Goal = {
            ...data,
            activities: [] // Init with empty activities
          };
          setGoals([...goals, newGoal]);
          setShowAddModal(false);
        }
      } catch (e) { console.error(e); }
    }
  };

  const deleteGoal = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this goal?")) {
      try {
        await api.delete('goals', id);
        setGoals(goals.filter(g => g.id !== id));
      } catch (e) { console.error(e); }
    }
  };

  const generateAdvice = async (goal: Goal) => {
    setLoadingAI(goal.id);
    const advice = await getAIRecommendation(goal.title, goal.status);
    setGoals(goals.map(g => g.id === goal.id ? { ...g, aiRecommendations: advice } : g));
    setLoadingAI(null);
  };


  const toggleActivity = async (goalId: string, activityId: string) => {
    if (editingActivityId === activityId) return;

    const goal = goals.find(g => g.id === goalId);
    const activity = goal?.activities.find(a => a.id === activityId);
    if (!goal || !activity) return;

    // Toggle logic
    const isCurrentlyDone = checkIsCompleted(activity);
    const newStatus = !isCurrentlyDone;
    const newTimestamp = newStatus ? new Date().toISOString() : null;

    // Update Activity in DB
    try {
      await api.put('activities', activityId, {
        is_completed: newStatus,
        last_completed_at: newTimestamp
      });
    } catch (error: any) {
      logError("Toggle Activity Failed", { error, activityId });
      alert("Failed to save activity status: " + error.message);
      return;
    }

    // Update Local State with FUNCTIONAL UPDATE to prevent race conditions
    setGoals(prevGoals => {
      return prevGoals.map(g => {
        if (g.id !== goalId) return g;

        const newActivities = g.activities.map(a =>
          a.id === activityId ? { ...a, isCompleted: newStatus, last_completed_at: newTimestamp || undefined } : a
        );

        // Recalc progress in this closure
        const completedCount = newActivities.filter(a => checkIsCompleted(a)).length;
        const progress = newActivities.length ? Math.round((completedCount / newActivities.length) * 100) : 0;

        let newGoalStatus: 'Not Started' | 'In Progress' | 'Completed' = 'In Progress';
        if (progress === 100) newGoalStatus = 'Completed';
        else if (progress === 0) newGoalStatus = 'Not Started';

        return { ...g, activities: newActivities, progress, status: newGoalStatus };
      });
    });
  };

  const saveNewActivity = async (goalId: string) => {
    if (!newActivityName.trim()) return;

    // Insert into DB
    let data;
    try {
      data = await api.post('activities', {
        goal_id: goalId,
        name: newActivityName,
        frequency: newActivityFreq,
        is_completed: false,
        deadline: newActivityDeadline || null
      });
    } catch (e) { return; }

    if (!data) return;

    // Update Local
    setGoals(prevGoals => prevGoals.map(g => {
      if (g.id !== goalId) return g;
      // Recalculate progress with new activity (adds 1 uncompleted)
      const newActivities = [...g.activities, {
        id: data.id,
        name: data.name,
        isCompleted: data.is_completed,
        frequency: data.frequency,
        deadline: data.deadline
      }];
      const completed = newActivities.filter(a => checkIsCompleted(a)).length; // Use util
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
      const newProgress = Math.round((completedCount / newTotal) * 100);

      let newStatus: 'Not Started' | 'In Progress' | 'Completed' = 'In Progress';
      if (newProgress === 100) newStatus = 'Completed';
      else if (newProgress === 0) newStatus = 'Not Started';

      try {
        await api.put('goals', goalId, {
          progress: newProgress,
          status: newStatus
        });
      } catch (e) { console.error(e); }
    }

    setAddingActivityTo(null);
    setNewActivityName('');
    setNewActivityFreq('Weekly');
    setNewActivityDeadline('');
  }

  const deleteActivity = async (goalId: string, activityId: string) => {
    try {
      await api.delete('activities', activityId);
    } catch (e) { return; }

    setGoals(prevGoals => prevGoals.map(g => {
      if (g.id !== goalId) return g;
      const newActivities = g.activities.filter(a => a.id !== activityId);
      // Recalc progress
      const completed = newActivities.filter(a => checkIsCompleted(a)).length; // Use util
      const progress = newActivities.length ? Math.round((completed / newActivities.length) * 100) : 0;

      return {
        ...g,
        progress,
        activities: newActivities
      }
    }));
  }

  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string, name: string } | null>(null);

  const handleDeleteCategory = async (catName: string) => {
    // Logic to delete category from DB (if not default)
    if (Object.values(DefaultGoalCategories).includes(catName)) {
      alert("Cannot delete default categories.");
      return;
    }
    if (window.confirm(`Delete category "${catName}"? Goals in this category will need a new category.`)) {
      // In a real app we'd need the ID, but here we might need to look it up or change how we store customCategories
      // For now, let's just filter it out of state to confirm UI
      setCustomCategories(customCategories.filter(c => c !== catName));
      // TODO: Add API call to delete by name or ID
    }
  };

  const handleAddActivity = (goalId: string) => {
    saveNewActivity(goalId);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects & Goals</h2>
          <p className="text-slate-400 text-sm">Manage your ambitions and track progress.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
          >
            <LayoutTemplate className="w-4 h-4" /> Categories
          </button>
          <button
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Manage Categories</h3>
              <button onClick={() => setShowCategoryManager(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Default</h4>
                {Object.values(DefaultGoalCategories).map(cat => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                    <span className="text-slate-300">{cat}</span>
                    <span className="text-[10px] bg-slate-900 text-slate-500 px-2 py-1 rounded">System</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  Custom <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full text-[10px]">{customCategories.length}</span>
                </h4>
                {customCategories.length > 0 ? customCategories.map(cat => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-indigo-500/30 transition-colors group">
                    <span className="text-white">{cat}</span>
                    <button onClick={() => handleDeleteCategory(cat)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )) : (
                  <div className="text-center p-4 border border-dashed border-slate-800 rounded-lg text-slate-500 text-sm">
                    No custom categories yet.
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Create new category..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                className="bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Add/Edit Goal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                {showEditModal ? 'Edit Project / Goal' : 'New Project / Goal'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(null); }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g., Launch MVP, Lose 5kg..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                  {!isAddingCategory ? (
                    <div className="flex gap-2">
                      <select
                        value={goalForm.category}
                        onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        {allCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setIsAddingCategory(true)}
                        className="bg-slate-800 px-3 rounded-xl border border-slate-700 hover:bg-slate-700 text-slate-300"
                        title="Add new category"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New category name..."
                        className="flex-1 bg-slate-950 border border-indigo-500 rounded-xl px-4 py-3 text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleCreateCategory}
                        className="bg-indigo-600 px-3 rounded-xl hover:bg-indigo-500 text-white"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}
                        className="bg-slate-800 px-3 rounded-xl hover:bg-slate-700 text-slate-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Deadline (Optional)</label>
                  <input
                    type="date"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:outline-none custom-date-icon transition-colors"
                    value={goalForm.deadline || ''}
                    onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Priority Level</label>
                <div className="flex gap-4">
                  {['High', 'Medium', 'Low'].map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="priority"
                        checked={goalForm.priority === p}
                        onChange={() => setGoalForm({ ...goalForm, priority: p as any })}
                        className="accent-indigo-500 w-4 h-4"
                      />
                      <span className={`text-sm font-medium transition-colors ${goalForm.priority === p
                          ? p === 'High' ? 'text-red-400' : p === 'Medium' ? 'text-amber-400' : 'text-slate-200'
                          : 'text-slate-400 group-hover:text-slate-300'
                        }`}>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(null); }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
              >
                {showEditModal ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const isExpanded = expandedGoals[goal.id];
          return (
            <div key={goal.id} className={`glass-panel p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all duration-300 relative group ${isExpanded ? 'row-span-2' : ''}`}>

              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div onClick={() => toggleExpand(goal.id)} className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
                      ${goal.priority === 'High' ? 'bg-red-500/20 text-red-400 border border-red-500/20' :
                        goal.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                          'bg-slate-700 text-slate-400 border border-slate-600'}`}>
                      {goal.priority}
                    </span>
                    <span className="text-xs text-slate-500">{goal.category}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{goal.title}</h3>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(goal)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs mb-2">
                  <span className={goal.progress === 100 ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                    {goal.progress === 100 ? 'Completed' : `${goal.progress}% Complete`}
                  </span>
                  {goal.deadline && (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(goal.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${goal.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Collapsed View Preview */}
              {!isExpanded && (
                <div
                  onClick={() => toggleExpand(goal.id)}
                  className="cursor-pointer p-3 bg-slate-900/50 rounded-xl hover:bg-slate-800/50 transition-colors border border-dashed border-slate-800 hover:border-indigo-500/30 flex items-center justify-between group/preview"
                >
                  <span className="text-xs text-slate-400 group-hover/preview:text-slate-200">
                    {goal.activities.length} Activities & AI Insights
                  </span>
                  <Maximize2 className="w-3 h-3 text-slate-600 group-hover/preview:text-indigo-400" />
                </div>
              )}

              {/* Expanded Content */}
              {isExpanded && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">

                  {/* Activities List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Key Activities</h4>
                      <button
                        onClick={() => setAddingActivityTo(goal.id)}
                        className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                      >
                        <Plus className="w-3 h-3" /> Add Activity
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {/* New Activity Input */}
                      {addingActivityTo === goal.id && (
                        <div className="p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg animate-in fade-in">
                          <input
                            autoFocus
                            placeholder="Activity name..."
                            className="w-full bg-transparent border-b border-indigo-500/30 text-sm text-white focus:outline-none mb-2 pb-1"
                            value={newActivityName}
                            onChange={e => setNewActivityName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddActivity(goal.id); }}
                          />
                          <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                              <select
                                value={newActivityFreq}
                                onChange={(e) => setNewActivityFreq(e.target.value as any)}
                                className="bg-slate-900 text-xs text-slate-300 rounded border border-slate-700 px-1 focus:outline-none"
                              >
                                <option value="Daily">Daily</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Once">Once</option>
                              </select>
                              {newActivityFreq === 'Once' && (
                                <input
                                  type="date"
                                  value={newActivityDeadline}
                                  onChange={(e) => setNewActivityDeadline(e.target.value)}
                                  className="bg-slate-900 text-xs text-slate-300 rounded border border-slate-700 px-1 w-24 focus:outline-none"
                                />
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setAddingActivityTo(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                              <button onClick={() => handleAddActivity(goal.id)} className="p-1 text-indigo-400 hover:text-indigo-300"><Check className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      )}

                      {goal.activities.map(activity => (
                        <div key={activity.id} className="group flex items-center justify-between p-2 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700">
                          <div className="flex items-center gap-3 flex-1 overflow-hidden">
                            <button
                              onClick={() => toggleActivity(activity)}
                              className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all duration-300
                                  ${checkIsCompleted(activity) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 hover:border-indigo-500'}`}
                            >
                              {checkIsCompleted(activity) && <Check className="w-3 h-3" />}
                            </button>
                            <div className="min-w-0">
                              <p className={`text-sm truncate transition-all ${checkIsCompleted(activity) ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                                {activity.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> {activity.frequency}</span>
                                {activity.deadline && (
                                  <span className={`flex items-center gap-0.5 ${new Date(activity.deadline) < new Date() && !checkIsCompleted(activity) ? 'text-red-400' : ''}`}>
                                    <AlertCircle className="w-3 h-3" /> {new Date(activity.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity px-2">
                            <button onClick={() => deleteActivity(goal.id, activity.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Gemini Insights
                      </h4>
                      <button
                        onClick={() => generateAdvice(goal)}
                        disabled={loadingAI === goal.id}
                        className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded transition-colors"
                      >
                        {loadingAI === goal.id ? 'Generating...' : 'Refresh'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {goal.aiRecommendations ? goal.aiRecommendations.replace(/[*#]/g, '') : "Click refresh to generate actionable insights and identify pitfalls for this goal."}
                    </p>
                  </div>

                  <div className="flex justify-center pt-2 border-t border-slate-800/50">
                    <button onClick={() => toggleExpand(goal.id)} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                      <Minimize2 className="w-3 h-3" /> Collapse
                    </button>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Goals;