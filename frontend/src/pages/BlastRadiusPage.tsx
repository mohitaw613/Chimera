import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  RefreshCw,
  GitCommit,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  Target,
  User as UserIcon,
  Laptop,
  Server,
  Database,
  Globe,
  ArrowRight,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';
import { api } from '../api/client';
import { BlastRadiusItem, BlastRadiusResponse } from '../types';

const SUGGESTED_SEEDS = [
  { id: 'user:user_jdoe', label: 'user:user_jdoe', role: 'Compromised Employee' },
  { id: 'device:ws-207', label: 'device:ws-207', role: 'Initial Workstation' },
  { id: 'device:srv-file01', label: 'device:srv-file01', role: 'File Server' },
  { id: 'user:user_svc_backup', label: 'user:user_svc_backup', role: 'Elevated Service Account' },
  { id: 'device:srv-db02', label: 'device:srv-db02', role: 'Target DB Server' },
];

export const BlastRadiusPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStart = searchParams.get('start') || 'user:user_jdoe';

  const [startEntity, setStartEntity] = useState(initialStart);
  const [maxHops, setMaxHops] = useState(3);
  const [data, setData] = useState<BlastRadiusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [analysisRequired, setAnalysisRequired] = useState(false);

  useEffect(() => {
    if (searchParams.get('start') && searchParams.get('start') !== startEntity) {
      setStartEntity(searchParams.get('start')!);
    }
  }, [searchParams]);

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

  const handleSelectSeed = (entityId: string) => {
    setStartEntity(entityId);
    setSearchParams({ start: entityId });
  };

  if (analysisRequired) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4 font-sans">
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

  const getEntityIcon = (entityId: string, entityType?: string) => {
    const id = entityId.toLowerCase();
    const type = (entityType || '').toLowerCase();
    if (id.startsWith('user:') || type === 'user') return <UserIcon className="w-4 h-4 text-blue-400" />;
    if (id.includes('db') || type === 'database') return <Database className="w-4 h-4 text-emerald-400" />;
    if (id.includes('srv') || type === 'server' || type === 'service') return <Server className="w-4 h-4 text-emerald-400" />;
    if (id.includes('ws-') || type === 'device' || type === 'workstation') return <Laptop className="w-4 h-4 text-purple-400" />;
    if (id.startsWith('external:') || id.startsWith('ip:')) return <Globe className="w-4 h-4 text-rose-400" />;
    return <Layers className="w-4 h-4 text-cyan-400" />;
  };

  const getClassificationBadge = (classification: BlastRadiusItem['classification']) => {
    switch (classification) {
      case 'directly_associated':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Direct (1-Hop Observed)</span>
          </span>
        );
      case 'indirectly_associated':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center space-x-1.5">
            <GitCommit className="w-3.5 h-3.5" />
            <span>Indirect (Multi-Hop Observed)</span>
          </span>
        );
      case 'unverified':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Unverified Exposure</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 font-sans">
      {/* Header Bar */}
      <div className="card-glow rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-200">Investigations</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-mono">#{investigationId}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <Target className="w-5 h-5 text-cyan-400" />
              <span>Blast Radius & Potential Exposure</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Bidirectional graph traversal measuring exposure propagation and asset fallout by path confidence.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/graph`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <span>View on Attack Graph</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Quick Pivot Suggestion Pills */}
        <div className="mt-5 pt-4 border-t border-cyber-800 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Suggested Investigation Pivot Entities:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {SUGGESTED_SEEDS.map((s) => {
              const isActive = startEntity === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectSeed(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center space-x-1.5 border cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20 font-bold'
                      : 'bg-cyber-950/80 text-slate-300 border-cyber-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {getEntityIcon(s.id)}
                  <span>{s.label}</span>
                  <span className={`text-[10px] ml-1 font-sans ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>
                    ({s.role})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Input & Traversal Parameters */}
        <div className="mt-4 pt-4 border-t border-cyber-800/80 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Custom Seed Entity:</span>
            <input
              type="text"
              value={startEntity}
              onChange={(e) => setStartEntity(e.target.value)}
              placeholder="e.g. user:user_jdoe"
              className="px-3 py-1.5 rounded-xl bg-cyber-950 border border-cyber-800 text-white font-mono focus:outline-none focus:border-blue-500 w-56 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Max Traversal Hops:</span>
            <select
              aria-label="Max Traversal Hops"
              value={maxHops}
              onChange={(e) => setMaxHops(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl bg-cyber-950 border border-cyber-800 text-white font-mono focus:outline-none focus:border-blue-500 text-xs"
            >
              <option value={1}>1 Hop (Direct Neighbors)</option>
              <option value={2}>2 Hops (Adjacent Perimeter)</option>
              <option value={3}>3 Hops (Deep Lateral Path)</option>
              <option value={4}>4 Hops (Full Fallout Horizon)</option>
            </select>
          </div>

          <button
            onClick={loadBlastRadius}
            className="px-3.5 py-1.5 rounded-xl bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white border border-cyber-800 flex items-center space-x-1.5 font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate Radius</span>
          </button>
        </div>
      </div>

      {/* Epistemic Guardrail Notice */}
      <div className="p-3.5 rounded-xl bg-cyber-950/80 border border-cyber-800 flex items-start space-x-3 text-xs text-slate-300">
        <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white">Heuristic Exposure Semantics: </strong>
          Blast radius assesses <em>potential downstream exposure</em> from the seed entity based on path confidence (strongest weakest-link). It distinguishes directly verified endpoints from unverified paths that cross open telemetry gaps. Does not assert compromise without affirmative audit evidence.
        </div>
      </div>

      {/* Summary Filter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterClass(filterClass === 'directly_associated' ? 'all' : 'directly_associated')}
          className={`card-glow rounded-2xl p-5 cursor-pointer transition-all ${
            filterClass === 'directly_associated' ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/15' : 'hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Directly Associated</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-emerald-400">
            {loading ? '…' : data?.summary?.directly_associated ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">1-hop verified telemetry links</p>
        </div>

        <div
          onClick={() => setFilterClass(filterClass === 'indirectly_associated' ? 'all' : 'indirectly_associated')}
          className={`card-glow rounded-2xl p-5 cursor-pointer transition-all ${
            filterClass === 'indirectly_associated' ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/15' : 'hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Indirectly Associated</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50"></span>
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-blue-400">
            {loading ? '…' : data?.summary?.indirectly_associated ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-hop all-observed paths</p>
        </div>

        <div
          onClick={() => setFilterClass(filterClass === 'unverified' ? 'all' : 'unverified')}
          className={`card-glow rounded-2xl p-5 cursor-pointer transition-all ${
            filterClass === 'unverified' ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-950/15' : 'hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Unverified Exposure</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-sm shadow-rose-400/50"></span>
          </div>
          <div className="mt-2 text-3xl font-bold font-mono text-rose-400">
            {loading ? '…' : data?.summary?.unverified ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Traverses missing telemetry gaps</p>
        </div>
      </div>

      {/* Traversal Results List with Visual Path Breadcrumbs */}
      <div className="card-glow rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cyber-800">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              Reachable Fallout Assets ({filteredItems.length})
            </h2>
            <span className="text-xs font-mono text-slate-500">
              from <span className="text-blue-400 font-semibold">{startEntity}</span>
            </span>
          </div>
          {filterClass !== 'all' && (
            <button
              onClick={() => setFilterClass('all')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              Show All Assets
            </button>
          )}
        </div>

        <div className="divide-y divide-cyber-800/80">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">Computing bidirectional path exposure…</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">No assets match the selected filter criteria.</div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.entity_id} className="py-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-cyber-950 border border-cyber-800">
                      {getEntityIcon(item.entity_id, item.entity_type)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-white">{item.entity_id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyber-950 text-slate-400 border border-cyber-800">
                          {item.entity_type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                        <span className="font-semibold text-slate-300">{item.hops} {item.hops === 1 ? 'hop' : 'hops'}</span>
                        <span>•</span>
                        <span className="text-[11px] text-slate-400">{item.explanation}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    {getClassificationBadge(item.classification)}
                    <button
                      onClick={() => handleSelectSeed(item.entity_id)}
                      title="Set as new Pivot Seed"
                      className="px-2.5 py-1 rounded-lg bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white border border-cyber-800 text-[11px] font-mono transition-colors"
                    >
                      Pivot
                    </button>
                  </div>
                </div>

                {/* Visual Traversal Path Breadcrumbs */}
                <div className="p-2.5 rounded-xl bg-cyber-950/60 border border-cyber-800/80 flex flex-wrap items-center gap-1.5 text-xs font-mono">
                  <span className="text-slate-400 font-sans font-medium text-[11px] mr-1">Traversal Path:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px] font-bold">
                    {startEntity}
                  </span>

                  {item.path.map((p, pIdx) => {
                    const isUnverified = p.status === 'needs_verification';
                    const isInferred = p.status === 'inferred';
                    return (
                      <React.Fragment key={pIdx}>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] border flex items-center space-x-1 ${
                            isUnverified
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : isInferred
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-cyber-850 text-slate-300 border-cyber-800'
                          }`}
                        >
                          <span>{p.type}</span>
                          {isUnverified && <span className="text-rose-400 font-bold ml-1">(Gap)</span>}
                        </span>
                      </React.Fragment>
                    );
                  })}

                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                  <span className="px-2 py-0.5 rounded bg-cyber-850 text-emerald-400 border border-cyber-800 text-[11px] font-bold">
                    {item.entity_id}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BlastRadiusPage;
