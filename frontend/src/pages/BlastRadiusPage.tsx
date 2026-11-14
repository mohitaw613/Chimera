import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  RefreshCw,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  FileText,
  ChevronRight,
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
  const [analysisRequired, setAnalysisRequired] = useState(false);

  useEffect(() => {
    loadBlastRadius();
  }, [investigationId, startEntity, maxHops]);

  const loadBlastRadius = async () => {
    if (!investigationId || !startEntity) return;
    setLoading(true);
    setAnalysisRequired(false);
    try {
      const investigation = await api.getInvestigation(investigationId);
      if (investigation.status !== 'analyzed') {
        setData(null);
        setAnalysisRequired(true);
        return;
      }
      const res = await api.getBlastRadius(investigationId, startEntity, maxHops);
      setData(res);
    } catch (err) {
      console.error('Failed to load blast radius', err);
    } finally {
      setLoading(false);
    }
  };

  if (analysisRequired) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-white">Analysis required</h1>
        <p className="text-sm text-slate-400">Run or rerun analysis before calculating the potential blast radius.</p>
        <Link to={`/investigations/${investigationId}`} className="inline-flex px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">
          Go to Investigation Dashboard
        </Link>
      </div>
    );
  }

  const filteredItems = (data?.items || []).filter((item) => {
    if (filterClass === 'all') return true;
    return item.classification === filterClass;
  });

  const getClassificationBadge = (classification: BlastRadiusItem['classification']) => {
    switch (classification) {
      case 'directly_associated':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Directly Associated (1 Hop)</span>
          </span>
        );
      case 'indirectly_associated':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center space-x-1">
            <GitCommit className="w-3.5 h-3.5" />
            <span>Indirectly Associated (Multi-Hop)</span>
          </span>
        );
      case 'unverified':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Unverified Exposure</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header Bar */}
      <div className="card-glow rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-200">Investigations</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-mono">#{investigationId}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Blast Radius & Exposure
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Bidirectional traversal calculating potential fallout across connected nodes by path confidence.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/report`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <span>Investigation Report</span>
              <FileText className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Entity Selector Controls */}
        <div className="mt-5 pt-4 border-t border-cyber-800 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Seed Entity:</span>
            <input
              type="text"
              value={startEntity}
              onChange={(e) => setStartEntity(e.target.value)}
              placeholder="e.g. user:user_jdoe"
              className="px-3 py-1.5 rounded-xl bg-cyber-950 border border-cyber-800 text-white font-mono focus:outline-none focus:border-blue-500 w-52"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Max Hops:</span>
            <select
              aria-label="Max Traversal Hops"
              value={maxHops}
              onChange={(e) => setMaxHops(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl bg-cyber-950 border border-cyber-800 text-white font-mono focus:outline-none focus:border-blue-500"
            >
              <option value={1}>1 Hop</option>
              <option value={2}>2 Hops</option>
              <option value={3}>3 Hops</option>
              <option value={4}>4 Hops</option>
            </select>
          </div>

          <button
            onClick={loadBlastRadius}
            className="px-3 py-1.5 rounded-xl bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white border border-cyber-800 flex items-center space-x-1 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterClass(filterClass === 'directly_associated' ? 'all' : 'directly_associated')}
          className={`card-glow rounded-2xl p-5 cursor-pointer transition-all ${filterClass === 'directly_associated' ? 'border-emerald-500 ring-1 ring-emerald-500' : ''
            }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Directly Associated</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-emerald-400">
            {loading ? '…' : data?.summary?.directly_associated ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">1-hop verified links</p>
        </div>

        <div
          onClick={() => setFilterClass(filterClass === 'indirectly_associated' ? 'all' : 'indirectly_associated')}
          className={`card-glow rounded-2xl p-5 cursor-pointer transition-all ${filterClass === 'indirectly_associated' ? 'border-blue-500 ring-1 ring-blue-500' : ''
            }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Indirectly Associated</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-blue-400">
            {loading ? '…' : data?.summary?.indirectly_associated ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-hop connected paths</p>
        </div>

        <div
          onClick={() => setFilterClass(filterClass === 'unverified' ? 'all' : 'unverified')}
          className={`card-glow rounded-2xl p-5 cursor-pointer transition-all ${filterClass === 'unverified' ? 'border-rose-500 ring-1 ring-rose-500' : ''
            }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Unverified Exposure</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-rose-400">
            {loading ? '…' : data?.summary?.unverified ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Traverses missing telemetry</p>
        </div>
      </div>

      {/* Traversal Results List */}
      <div className="card-glow rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cyber-800">
          <h2 className="text-base font-bold text-white tracking-tight">
            Traversed Assets ({filteredItems.length})
          </h2>
          {filterClass !== 'all' && (
            <button
              onClick={() => setFilterClass('all')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="divide-y divide-cyber-800">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Computing graph traversal…</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">No assets match the criteria.</div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.entity_id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm font-semibold text-white">{item.entity_id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyber-950 text-slate-300 border border-cyber-800">
                      {item.entity_type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center space-x-2">
                    <span>{item.hops} {item.hops === 1 ? 'hop' : 'hops'} from seed</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-blue-400">
                      Path: {item.path.map((p) => p.type).join(' → ') || 'Direct'}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {getClassificationBadge(item.classification)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
