import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import SelfDevelopment from './components/SelfDevelopment';
import Knowledge from './components/Knowledge';
import Documents from './components/Documents';
import Settings from './components/Settings';
import Health from './components/Health';
import { Goal, GoalCategory } from './types';

// Initial Mock Data
const INITIAL_GOALS: Goal[] = [
  {
    id: '1',
    title: 'Lose 5kg by December',
    category: GoalCategory.HEALTH,
    priority: 'Medium',
    description: 'Gym and Diet plan',
    progress: 65,
    status: 'In Progress',
    activities: [
        { id: 'a1', name: 'Morning Cardio', isCompleted: true, frequency: 'Daily' },
        { id: 'a2', name: 'No Sugar', isCompleted: false, frequency: 'Daily' }
    ]
  },
  {
    id: '2',
    title: 'Save CAD $15,000',
    category: GoalCategory.RELOCATION,
    priority: 'High',
    description: 'Relocation fund',
    progress: 40,
    status: 'In Progress',
    activities: [
        { id: 'b1', name: 'Transfer to FX Account', isCompleted: true, frequency: 'Monthly' }
    ]
  }
];

const MainApp: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [goals, setGoals] = useState<Goal[]>(() => {
      const saved = localStorage.getItem('ls_goals');
      return saved ? JSON.parse(saved) : INITIAL_GOALS;
  });

  useEffect(() => {
      localStorage.setItem('ls_goals', JSON.stringify(goals));
  }, [goals]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard goals={goals} />;
      case 'goals':
        return <Goals goals={goals} setGoals={setGoals} />;
      case 'health':
        return <Health />;
      case 'selfdev':
        return <SelfDevelopment />;
      case 'knowledge':
        return <Knowledge />;
      case 'docs':
        return <Documents />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard goals={goals} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <Sidebar currentView={currentView} setView={setCurrentView} />
      
      <main className="pl-64 min-h-screen">
        <div className="max-w-7xl mx-auto p-8 pt-10">
          {renderView()}

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