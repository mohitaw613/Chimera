import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  Shuffle,
  GitFork,
  AlertTriangle,
  Filter,
  RefreshCw,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { TimelineResponse } from '../types';

export const TimelinePage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();

  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [onlySignals, setOnlySignals] = useState(false);

  useEffect(() => {
    loadTimeline();
  }, [investigationId]);

  const loadTimeline = async () => {
    if (!investigationId) return;
    setLoading(true);
    try {
      const res = await api.getTimeline(investigationId);
      setData(res);
    } catch (err) {
      console.error('Failed to load timeline', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = (data?.events || []).filter((ev) => {
    if (onlySignals && ev.signal_ids.length === 0) return false;
    if (filterType === 'delayed') return ev.flags.includes('delayed');
    if (filterType === 'out_of_order') return ev.flags.includes('out_of_order');
    if (filterType === 'ambiguous') return ev.ordering_ambiguous;
    return true;
  });

  const delayedCount = (data?.events || []).filter((e) => e.flags.includes('delayed')).length;
  const outOfOrderCount = (data?.events || []).filter((e) => e.flags.includes('out_of_order')).length;
  const ambiguousCount = (data?.events || []).filter((e) => e.ordering_ambiguous).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header & Reconstruction Narrative */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Stage 2: Deterministic Temporal Reconstruction</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Chronological Timeline</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Chronologically sorted event stream resolving ingestion latency, out-of-order network arrival, and multi-source clock skew.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/graph`}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <span>View Attack Graph</span>
              <GitFork className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Narrative Banner & Inversion Metric */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg bg-cyber-950/80 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Arrival Inversions</span>
              <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {loading ? '…' : data?.inversions ?? 0}
            </div>
            <div className="text-[11px] text-slate-500">Pairs reordered into true time</div>
          </div>

          <div className="p-3.5 rounded-lg bg-cyber-950/80 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Delayed Events</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {loading ? '…' : delayedCount}
            </div>
            <div className="text-[11px] text-slate-500">Arrival latency &gt; 5 minutes</div>
          </div>

          <div className="p-3.5 rounded-lg bg-cyber-950/80 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Out-of-Order</span>
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-orange-400">
              {loading ? '…' : outOfOrderCount}
            </div>
            <div className="text-[11px] text-slate-500">Arrival order inverted vs event time</div>
          </div>

          <div className="p-3.5 rounded-lg bg-cyber-950/80 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Ambiguous Pairs</span>
              <span className="font-mono text-sm text-cyan-400">≈</span>
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-400">
              {loading ? '…' : ambiguousCount}
            </div>
            <div className="text-[11px] text-slate-500">Multi-source skew ≤ 2s</div>
          </div>
        </div>

        {/* Filters bar */}
        <div className="mt-5 pt-4 border-t border-cyber-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Filter timeline:</span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'all'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-cyber-800 text-slate-300 hover:text-white'
              }`}
            >
              All Events ({data?.events.length ?? 0})
            </button>
            <button
              onClick={() => setFilterType('delayed')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'delayed'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-cyber-800 text-slate-300 hover:text-white'
              }`}
            >
              Delayed ({delayedCount})
            </button>
            <button
              onClick={() => setFilterType('out_of_order')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'out_of_order'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-cyber-800 text-slate-300 hover:text-white'
              }`}
            >
              Out-of-Order ({outOfOrderCount})
            </button>
            <button
              onClick={() => setFilterType('ambiguous')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'ambiguous'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-cyber-800 text-slate-300 hover:text-white'
              }`}
            >
              Skew Ambiguous ({ambiguousCount})
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={onlySignals}
                onChange={(e) => setOnlySignals(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-cyber-950 border-cyber-700 text-cyan-500"
              />
              <span>Only Suspicious Signals</span>
            </label>
            <button
              onClick={loadTimeline}
              className="p-1 rounded bg-cyber-800 hover:bg-cyber-700 text-slate-400 hover:text-white"
              aria-label="Reload timeline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chronological Vertical Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Reconstructing chronological order…</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm bg-cyber-900 border border-cyber-800 rounded-xl">
            No events match the selected timeline filters.
          </div>
        ) : (
          <div className="relative border-l-2 border-cyber-800 ml-4 pl-6 space-y-6">
            {filteredEvents.map((ev) => {
              const hasSignal = ev.signal_ids.length > 0;
              const isDelayed = ev.flags.includes('delayed');
              const isOutOfOrder = ev.flags.includes('out_of_order');

              return (
                <div key={ev.id} className="relative group">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 transition-all ${
                      hasSignal
                        ? 'bg-rose-500 border-rose-300 ring-4 ring-rose-500/20'
                        : isOutOfOrder
                        ? 'bg-orange-500 border-orange-300'
                        : isDelayed
                        ? 'bg-amber-500 border-amber-300'
                        : 'bg-cyber-700 border-cyan-400'
                    }`}
                  />

                  {/* Card */}
                  <div
                    className={`bg-cyber-900 border rounded-xl p-4 transition-all hover:border-cyan-500/50 shadow-md ${
                      hasSignal ? 'border-rose-500/40 bg-rose-500/5' : 'border-cyber-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-cyber-800/60">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-semibold text-cyan-400">{ev.id}</span>
                        <span className="text-slate-500">•</span>
                        <span className="font-mono text-xs text-white">
                          {ev.event_time ? new Date(ev.event_time).toISOString().replace('T', ' ').slice(0, 19) : 'Uncertain Time'}
                        </span>
                        {ev.ordering_ambiguous && (
                          <span
                            title="Multi-source clock skew ≤ 2s (ordering ambiguous)"
                            className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 cursor-help"
                          >
                            ≈ skew ≤ 2s
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {isDelayed && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            +{Math.round((ev.delay_seconds || 0) / 60)}m delay
                          </span>
                        )}
                        {isOutOfOrder && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            out-of-order
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyber-800 text-slate-300">
                          {ev.source}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white capitalize">{ev.event_type.replace('_', ' ')}</span>
                          <span className="text-slate-400">by</span>
                          <span className="font-mono font-medium text-cyan-300">{ev.actor || 'system'}</span>
                          {ev.source_device && (
                            <>
                              <span className="text-slate-400">from</span>
                              <span className="font-mono text-slate-200">{ev.source_device}</span>
                            </>
                          )}
                          {ev.target && (
                            <>
                              <span className="text-slate-400">to</span>
                              <span className="font-mono text-emerald-400">{ev.target}</span>
                            </>
                          )}
                        </div>

                        {hasSignal && (
                          <div className="flex items-center space-x-1.5 text-rose-400 pt-1 font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Matched Suspicious Anomaly Signal</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 self-start md:self-auto">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            ev.outcome === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {ev.outcome}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unordered Events Section (Missing/Malformed Timestamps) */}
      {data?.unordered && data.unordered.length > 0 && (
        <div className="bg-cyber-900 border border-rose-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Unordered Events ({data.unordered.length}) — Missing or Malformed Timestamps</span>
          </div>
          <p className="text-xs text-slate-400">
            These records could not be reliably placed on the timeline. Per forensic integrity principles, they are preserved and available for analyst review.
          </p>
          <div className="divide-y divide-cyber-800">
            {data.unordered.map((u) => (
              <div key={u.id} className="py-2 flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400">{u.id}</span>
                <span className="text-slate-400">{u.event_type}</span>
                <span className="text-slate-300">{u.actor || 'unknown'}</span>
                <span className="text-rose-400">timestamp_uncertain</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
