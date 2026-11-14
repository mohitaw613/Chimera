import React from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  GitFork,
  Clock,
  FileSpreadsheet,
  BrainCircuit,
  FileText,
  Shield,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>();
  const location = useLocation();
  const match = location.pathname.match(/\/investigations\/([^/]+)/);
  const currentInvId = paramId || (match ? match[1] : undefined);

  const [activeCaseId, setActiveCaseId] = React.useState<string>(() => {
    return currentInvId || localStorage.getItem('activeInvestigationId') || '';
  });

  React.useEffect(() => {
    if (currentInvId) {
      setActiveCaseId(currentInvId);
      localStorage.setItem('activeInvestigationId', currentInvId);
    } else {
      const stored = localStorage.getItem('activeInvestigationId');
      if (stored) {
        setActiveCaseId(stored);
      }
    }
  }, [currentInvId, location.pathname]);

  // Use the active case ID or fallback to the latest active case
  const targetId = currentInvId || activeCaseId || 'inv_f02a4208e20d';

  const navItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard, exact: true },
    { label: 'Investigations', to: `/investigations/${targetId}/upload`, icon: FolderGit2 },
    { label: 'Attack Graph', to: `/investigations/${targetId}/graph`, icon: GitFork },
    { label: 'Timeline', to: `/investigations/${targetId}/timeline`, icon: Clock },
    { label: 'Evidence Explorer', to: `/investigations/${targetId}/evidence`, icon: FileSpreadsheet },
    { label: 'Hypotheses', to: `/investigations/${targetId}/hypotheses`, icon: BrainCircuit },
    { label: 'Reports', to: `/investigations/${targetId}/report`, icon: FileText },
  ];

  return (
    <aside className="w-64 border-r border-cyber-800 bg-cyber-900/90 flex flex-col flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center space-x-3.5 border-b border-cyber-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20 flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="overflow-hidden">
          <h1 className="font-bold tracking-tight text-base text-white leading-tight">CHIMERA</h1>
          <p className="text-[11px] text-slate-400 font-medium truncate">Cyber Investigation</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="p-3.5 space-y-1.5 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-cyber-850'
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer System Status Banner */}
      <div className="p-4 mt-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-cyber-850 to-cyber-950 p-3.5 border border-cyber-800/80">
          {/* Subtle background glow wave */}
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-600/15 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="flex items-center space-x-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse"></span>
            <span className="font-semibold text-slate-200">System Online</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">All services operational</p>
        </div>
      </div>
    </aside>
  );
};
