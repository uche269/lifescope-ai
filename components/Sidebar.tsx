import React from 'react';
import { 
  LayoutDashboard, 
  Target, 
  BrainCircuit, 
  Newspaper, 
  FileText, 
  Settings,
  HeartPulse
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'goals', label: 'Goals & Projects', icon: Target },
    { id: 'health', label: 'Health & Nutrition', icon: HeartPulse },
    { id: 'selfdev', label: 'Self Development', icon: BrainCircuit },
    { id: 'knowledge', label: 'Knowledge Hub', icon: Newspaper },
    { id: 'docs', label: 'Doc Intelligence', icon: FileText },
  ];

  return (
    <div className="w-64 h-screen bg-slate-950 border-r border-slate-900 flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.5)]">
          <BrainCircuit className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          LifeScope
        </span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'group-hover:text-white'}`} />
              <span className="font-medium text-sm">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-900 space-y-2">
        <button 
          onClick={() => setView('settings')}
          className={`flex items-center gap-3 px-4 py-3 transition-colors w-full rounded-xl ${
            currentView === 'settings' 
            ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;