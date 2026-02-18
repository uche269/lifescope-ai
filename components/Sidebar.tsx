import React from 'react';
import {
  LayoutDashboard,
  Target,
  BrainCircuit,
  Newspaper,
  FileText,
  Settings,
  HeartPulse,
  X // Import X for close button
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'goals', label: 'Goals & Projects', icon: Target },
    { id: 'health', label: 'Health & Nutrition', icon: HeartPulse },
    { id: 'selfdev', label: 'Self Development', icon: BrainCircuit },
    { id: 'knowledge', label: 'Knowledge Hub', icon: Newspaper },
    { id: 'docs', label: 'Doc Intelligence', icon: FileText },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        w-64 h-screen bg-slate-950/90 backdrop-blur-xl border-r border-indigo-500/10 flex flex-col fixed left-0 top-0 z-50
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
              <BrainCircuit className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold glow-text">
              LifeScope
            </span>
          </div>
          {/* Mobile Close Button */}
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.id === 'dashboard' ? '/' : `/${item.id}`}
                onClick={() => onClose()} // Close sidebar on nav click (mobile)
                className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                  ? 'bg-gradient-to-r from-indigo-600/80 to-indigo-700/60 text-white shadow-lg shadow-indigo-500/25 nav-active'
                  : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-200'
                  }`}
              >
                <Icon className="w-5 h-5 group-hover:text-white" />
                <span className="font-medium text-sm">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-900 space-y-2">
          <NavLink
            to="/settings"
            onClick={() => onClose()}
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 transition-colors w-full rounded-lg ${isActive
              ? 'bg-gradient-to-r from-indigo-600/80 to-indigo-700/60 text-white shadow-lg shadow-indigo-500/25 nav-active'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/80'
              }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium">Settings</span>
          </NavLink>
        </div>
      </div>
    </>
  );
};

export default Sidebar;