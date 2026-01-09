import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import SelfDevelopment from './components/SelfDevelopment';
import Knowledge from './components/Knowledge';
import Documents from './components/Documents';
import Settings from './components/Settings';
import Health from './components/Health';
import { Goal, GoalCategory } from './types';

import Login from './components/Login';
import { supabase } from './lib/supabase';
import { useAuth } from './contexts/AuthContext';

const MainApp: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial Mock Data (used for seeding)
  const INITIAL_GOALS_TEMPLATE = [
    {
      title: 'Lose 5kg by December',
      category: GoalCategory.HEALTH,
      priority: 'Medium',
      description: 'Gym and Diet plan',
      progress: 65,
      status: 'In Progress',
      activities: [
        { name: 'Morning Cardio', isCompleted: true, frequency: 'Daily' },
        { name: 'No Sugar', isCompleted: false, frequency: 'Daily' }
      ]
    },
    {
      title: 'Save CAD $15,000',
      category: GoalCategory.RELOCATION,
      priority: 'High',
      description: 'Relocation fund',
      progress: 40,
      status: 'In Progress',
      activities: [
        { name: 'Transfer to FX Account', isCompleted: true, frequency: 'Monthly' }
      ]
    }
  ];

  const seedInitialData = async () => {
    if (!user) return;
    console.log("Seeding initial data...");

    const newGoals: Goal[] = [];

    for (const tmpl of INITIAL_GOALS_TEMPLATE) {
      // Insert Goal
      const { data: goalData, error: goalError } = await supabase
        .from('goals')
        .insert([{
          user_id: user.id,
          title: tmpl.title,
          category: tmpl.category,
          priority: tmpl.priority,
          description: tmpl.description,
          progress: tmpl.progress,
          status: tmpl.status
        }])
        .select()
        .single();

      if (goalError || !goalData) {
        console.error("Error seeding goal:", goalError);
        continue;
      }

      // Insert Activities
      if (tmpl.activities.length > 0) {
        const activitiesToInsert = tmpl.activities.map(a => ({
          goal_id: goalData.id,
          name: a.name,
          is_completed: a.isCompleted,
          frequency: a.frequency
        }));

        const { data: actData, error: actError } = await supabase
          .from('activities')
          .insert(activitiesToInsert)
          .select();

        if (actError) console.error("Error seeding activities:", actError);

        // Construct local object
        newGoals.push({
          ...goalData,
          activities: actData || []
        });
      } else {
        newGoals.push({
          ...goalData,
          activities: []
        });
      }
    }
    setGoals(newGoals);
  };

  const fetchGoals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .select(`
                *,
                activities (*)
            `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Transform data to match Goal interface if needed (Supabase returns arrays)
        // Ensure activities are sorted or formatted correctly
        setGoals(data as Goal[]);
      } else {
        // Auto-seed if empty
        await seedInitialData();
      }
    } catch (err) {
      console.error("Error fetching goals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <Sidebar />

      <main className="pl-64 min-h-screen">
        <div className="max-w-7xl mx-auto p-8 pt-10">
          <Routes>
            <Route path="/" element={<Dashboard goals={goals} />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/goals" element={<Goals goals={goals} setGoals={setGoals} />} />
            <Route path="/health" element={<Health />} />
            <Route path="/selfdev" element={<SelfDevelopment />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/docs" element={<Documents />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <footer className="mt-12 border-t border-slate-900 pt-6 text-center text-slate-600 text-sm">
            <p className="mb-2">What do you want to add, review, or improve today?</p>
            <p className="text-xs opacity-50">LifeScope AI v1.0 • Built with Gemini</p>
          </footer>
        </div>
      </main>

      {/* Ambient Glow Effects */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
};

export default MainApp;