import React, { useState } from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';

interface NavbarProps {
  onSearch?: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-16 border-b border-cyber-800 bg-cyber-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Center/Left: Global Search Capsule */}
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities, events, or relationships..."
            className="w-full bg-cyber-950/70 border border-cyber-800 rounded-xl pl-10 pr-12 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans"
          />
          <div className="absolute right-3 flex items-center space-x-0.5 text-[10px] font-mono text-slate-500 bg-cyber-850 px-1.5 py-0.5 rounded border border-cyber-800 pointer-events-none">
            <span>⌘</span>
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right: Notifications, Help, User Avatar */}
      <div className="flex items-center space-x-4 pl-4">
        {/* System Data Quality Tag */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyber-850 border border-cyber-800 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-400">Data Quality:</span>
          <span className="font-mono font-bold text-emerald-400">98.2%</span>
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-cyber-850 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-cyber-900"></span>
        </button>

        {/* Help button */}
        <button
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-cyber-850 transition-colors"
          aria-label="Help & Documentation"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center space-x-3 pl-2 border-l border-cyber-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold tracking-tight shadow-md shadow-blue-500/20 ring-1 ring-white/10">
            JD
          </div>
        </div>
      </div>
    </header>
  );
};
