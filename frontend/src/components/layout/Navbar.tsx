import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, RefreshCw, HelpCircle, Activity, Info } from 'lucide-react';

interface NavbarProps {
  investigationName?: string;
  onResetFilters?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ investigationName, onResetFilters }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);

  const isHome = location.pathname === '/';

  return (
    <>
      <header className="h-16 border-b border-cyber-800 bg-cyber-900/90 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Left: Branding & Hierarchy */}
        <div className="flex items-center space-x-4">
          {!isHome && (
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-cyber-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Navigate back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-wider text-base text-white">CHIMERA</span>
              <span className="text-xs block text-cyan-400 font-mono tracking-tight">EVIDENCE-FIRST REASONING</span>
            </div>
          </Link>

          {investigationName && (
            <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-cyber-700">
              <span className="text-xs uppercase tracking-wider text-slate-400">Active Investigation:</span>
              <span className="text-sm font-semibold text-slate-200 truncate max-w-xs">{investigationName}</span>
            </div>
          )}
        </div>

        {/* Right: Synthetic Badge, Data Quality Score, Reset Filters & Help */}
        <div className="flex items-center space-x-3">
          {/* Synthetic data badge - mandatory */}
          <div className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Activity className="w-3.5 h-3.5 mr-1 text-amber-400 animate-pulse" />
            Synthetic Data
          </div>

          {/* Data Quality Indicator */}
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded bg-cyber-850 border border-cyber-700 text-xs">
            <span className="text-slate-400">Data Quality:</span>
            <span className="font-mono font-bold text-emerald-400">98.2%</span>
          </div>

          {/* Reset Filters affordance */}
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="px-3 py-1.5 rounded text-xs font-medium bg-cyber-800 hover:bg-cyber-700 text-slate-300 hover:text-white flex items-center space-x-1.5 border border-cyber-700 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Reset all filters"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}

          {/* Help Modal trigger */}
          <button
            onClick={() => setShowHelp(true)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-cyber-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
            aria-label="System guidance and epistemic levels help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-900 border border-cyber-700 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center space-x-2 text-cyan-400 mb-4">
              <Info className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">How CHIMERA Works</h3>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              <p>
                CHIMERA reconstructs attack graphs from fragmented, delayed, and shuffled logs while rigorously maintaining epistemic honesty.
              </p>
              <div className="space-y-2 border-t border-cyber-800 pt-3">
                <h4 className="font-semibold text-white text-xs uppercase tracking-wider">Epistemic Status Levels</h4>
                <div className="flex items-start space-x-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                  <div>
                    <strong className="text-emerald-400">Observed:</strong> Direct raw record explicitly asserts the relationship.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                  <div>
                    <strong className="text-amber-400">Inferred:</strong> Rule-derived association based on temporal and topological proximity.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
                  <div>
                    <strong className="text-rose-400">Needs Verification:</strong> Inferred association carrying explicit investigative gaps (e.g. unverified causal attribution).
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-400 italic bg-cyber-850 p-2.5 rounded border border-cyber-800">
                &ldquo;A connected sequence of events is observed; causation is not established.&rdquo;
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
