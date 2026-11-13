import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Target,
  Filter,
  RefreshCw,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { api } from '../api/client';
import { BlastRadiusItem, BlastRadiusResponse } from '../types';

export const BlastRadiusPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const initialStart = searchParams.get('start') || 'user:user_jdoe';

  const [startEntity, setStartEntity] = useState(initialStart);
  const [maxHops, setMaxHops] = useState(3);
  const [data, setData] = useState<BlastRadiusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState<string>('all');

  useEffect(() => {
    loadBlastRadius();
  }, [investigationId, startEntity, maxHops]);

  const loadBlastRadius = async () => {
    if (!investigationId || !startEntity) return;
    setLoading(true);
    try {
      const res = await api.getBlastRadius(investigationId, startEntity, maxHops);
      setData(res);
    } catch (err) {
      console.error('Failed to load blast radius', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = (data?.items || []).filter((item) => {
    if (filterClass === 'all') return true;
    return item.classification === filterClass;
  });

  const getClassificationBadge = (classification: BlastRadiusItem['classification']) => {
    switch (classification) {
      case 'directly_associated':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Directly Associated (1 Hop)</span>
          </span>
        );
      case 'indirectly_associated':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center space-x-1">
            <GitCommit className="w-3.5 h-3.5" />
            <span>Indirectly Associated (Multi-Hop)</span>
          </span>
        );
      case 'unverified':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Unverified Causal Hop</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Guardrail Banner */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
              <Target className="w-3.5 h-3.5" />
              <span>Stage 5: Blast Radius & Exposure Analysis</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Potential Exposure Traversal
            </h1>
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mt-1">
              Potential exposure — not confirmed compromise
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/report`}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <span>View Investigation Report</span>
              <FileText className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Entity Selector & Max Hops Controls */}
        <div className="mt-6 pt-4 border-t border-cyber-800 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Seed Entity:</span>
            <input
              type="text"
              value={startEntity}
              onChange={(e) => setStartEntity(e.target.value)}
              placeholder="e.g., user:user_jdoe"
              className="px-3 py-1.5 rounded-lg bg-cyber-950 border border-cyber-700 text-white font-mono focus:outline-none focus:border-cyan-500 w-52"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Max Traversal Hops:</span>
            <select
              aria-label="Max Traversal Hops"
              value={maxHops}
              onChange={(e) => setMaxHops(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-cyber-950 border border-cyber-700 text-white font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value={1}>1 Hop (Direct)</option>
              <option value={2}>2 Hops</option>
              <option value={3}>3 Hops (Default)</option>
              <option value={4}>4 Hops</option>
              <option value={5}>5 Hops</option>
            </select>
          </div>

          <button
            onClick={loadBlastRadius}
            className="p-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 hover:text-white border border-cyber-700"
            aria-label="Recalculate blast radius"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-mono tracking-wider">
            <span>Directly Associated</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-bold font-mono text-emerald-400">
            {loading ? '…' : data?.summary.directly_associated ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">1 hop via directly observed telemetry</div>
        </div>

        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-mono tracking-wider">
            <span>Indirectly Associated</span>
            <GitCommit className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 text-3xl font-bold font-mono text-blue-400">
            {loading ? '…' : data?.summary.indirectly_associated ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Multi-hop via all-observed paths</div>
        </div>

        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-rose-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-mono tracking-wider">
            <span>Unverified Exposure</span>
            <HelpCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 text-3xl font-bold font-mono text-rose-400">
            {loading ? '…' : data?.summary.unverified ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Path contains inferred/open gaps</div>
        </div>
      </div>

      {/* Traversal Items List */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden shadow-xl space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-cyber-800 gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Reachable Entities ({filteredItems.length})</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Filtered paths maximized for the strongest weakest-link status.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setFilterClass('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterClass === 'all'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-cyber-800 text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterClass('directly_associated')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterClass === 'directly_associated'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-cyber-800 text-slate-300'
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setFilterClass('indirectly_associated')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterClass === 'indirectly_associated'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-cyber-800 text-slate-300'
              }`}
            >
              Indirect
            </button>
            <button
              onClick={() => setFilterClass('unverified')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterClass === 'unverified'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-cyber-800 text-slate-300'
              }`}
            >
              Unverified
            </button>
          </div>
        </div>

        <div className="divide-y divide-cyber-800">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Traversing graph neighborhood…</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No reachable entities match the criteria.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.entity_id} className="py-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono text-sm font-bold text-white">{item.entity_id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyber-950 text-slate-300 border border-cyber-800">
                      {item.entity_type}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">• {item.hops} hop(s)</span>
                  </div>
                  {getClassificationBadge(item.classification)}
                </div>

                <p className="text-xs text-slate-300">{item.explanation}</p>

                {/* Step-by-Step Traversal Path */}
                {item.path && item.path.length > 0 && (
                  <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Strongest Traversal Path
                    </span>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="text-cyan-400">{startEntity}</span>
                      {item.path.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <span className="text-slate-500">→</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              step.status === 'observed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : step.status === 'inferred'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {step.type} ({step.status})
                          </span>
                        </React.Fragment>
                      ))}
                      <span className="text-slate-500">→</span>
                      <span className="text-emerald-400 font-bold">{item.entity_id}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
