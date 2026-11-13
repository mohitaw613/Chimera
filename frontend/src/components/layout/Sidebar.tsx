import React from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  Clock,
  GitFork,
  BrainCircuit,
  Target,
  FileText,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>();
  const location = useLocation();
  const match = location.pathname.match(/\/investigations\/([^/]+)/);
  const investigationId = paramId || (match ? match[1] : undefined);

  const baseNavItems = [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
  ];

  const investigationNavItems = investigationId
    ? [
        { label: 'Upload Evidence', to: `/investigations/${investigationId}/upload`, icon: UploadCloud },
        { label: 'Evidence Explorer', to: `/investigations/${investigationId}/evidence`, icon: FileSpreadsheet },
        { label: 'Timeline', to: `/investigations/${investigationId}/timeline`, icon: Clock },
        { label: 'Attack Graph', to: `/investigations/${investigationId}/graph`, icon: GitFork },
        { label: 'Hypotheses & Gaps', to: `/investigations/${investigationId}/hypotheses`, icon: BrainCircuit },
        { label: 'Blast Radius', to: `/investigations/${investigationId}/blast-radius`, icon: Target },
        { label: 'Report', to: `/investigations/${investigationId}/report`, icon: FileText },
      ]
    : [];

  return (
    <aside className="w-64 border-r border-cyber-800 bg-cyber-900/60 flex flex-col flex-shrink-0">
      <nav className="p-4 space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
          Platform
        </div>
        {baseNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-cyber-800'
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {investigationNavItems.length > 0 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-6 pb-2">
              Investigation Analysis
            </div>
            {investigationNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-cyber-800'
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer System Status */}
      <div className="mt-auto p-4 border-t border-cyber-800">
        <div className="bg-cyber-950/80 rounded-lg p-3 border border-cyber-800 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span>Deterministic Engine</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Rules v1.0 • SHA-256 Verified
          </div>
        </div>
      </div>
    </aside>
  );
};
