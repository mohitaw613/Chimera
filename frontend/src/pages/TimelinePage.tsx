import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  Shuffle,
  GitFork,
  AlertTriangle,
  ChevronRight,
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
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header & Metrics */}
      <div className="card-glow rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-200">Investigations</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-mono">#{investigationId}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Event Timeline</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Chronologically reconstructed event sequence resolving arrival delays and out-of-order log streams.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/graph`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <span>View Attack Graph</span>
              <GitFork className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-cyber-950/70 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Arrival Inversions</span>
              <Shuffle className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {loading ? '…' : data?.inversions ?? 0}
            </div>
            <div className="text-[11px] text-slate-500">Pairs chronologized</div>
          </div>

          <div className="p-3.5 rounded-xl bg-cyber-950/70 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Delayed Records</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {loading ? '…' : delayedCount}
            </div>
            <div className="text-[11px] text-slate-500">Arrived &gt;60s after occurrence</div>
          </div>

          <div className="p-3.5 rounded-xl bg-cyber-950/70 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Out-of-Order</span>
              <Shuffle className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-400">
              {loading ? '…' : outOfOrderCount}
            </div>
            <div className="text-[11px] text-slate-500">Received out of sequence</div>
          </div>

          <div className="p-3.5 rounded-xl bg-cyber-950/70 border border-cyber-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Skew Ambiguous</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400">
              {loading ? '…' : ambiguousCount}
            </div>
            <div className="text-[11px] text-slate-500">Within ±3s tolerance</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-cyber-900 rounded-2xl border border-cyber-800">
        <div className="flex items-center space-x-1 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterType === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Events ({data?.events.length ?? 0})
          </button>
          <button
            onClick={() => setFilterType('delayed')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterType === 'delayed'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            Delayed ({delayedCount})
          </button>
          <button
            onClick={() => setFilterType('out_of_order')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterType === 'out_of_order'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-purple-400'
            }`}
          >
            Out of Order ({outOfOrderCount})
          </button>
          <button
            onClick={() => setFilterType('ambiguous')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterType === 'ambiguous'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            Ambiguous ({ambiguousCount})
          </button>
        </div>

        <div className="flex items-center space-x-3 px-3">
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlySignals}
              onChange={(e) => setOnlySignals(e.target.checked)}
              className="rounded bg-cyber-950 border-cyber-700 text-blue-600 focus:ring-0"
            />
            <span>Show Anomalies Only</span>
          </label>
        </div>
      </div>

      {/* Chronological Event Stream */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Reconstructing timeline…</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">No events match the selected filters.</div>
        ) : (
          filteredEvents.map((ev, index) => {
            const hasSignals = ev.signal_ids && ev.signal_ids.length > 0;
            const isDelayed = ev.flags.includes('delayed');
            const isOutOfOrder = ev.flags.includes('out_of_order');

            return (
              <div
                key={ev.id}
                className={`card-glow rounded-2xl p-4 transition-all hover:border-slate-700 ${
                  hasSignals ? 'border-l-4 border-l-rose-500' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      #{index + 1}
                    </span>
                    <span className="font-mono text-xs font-semibold text-blue-400">
                      {ev.id}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs font-semibold text-white">
                      {ev.actor || 'System'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {ev.event_type} on <span className="text-slate-200">{ev.target || (ev as any).device || 'Host'}</span>
                    </span>
                  </div>

                  {/* Timing Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-slate-400">{ev.event_time ? new Date(ev.event_time).toLocaleTimeString() : '—'} UTC</span>
                    {isDelayed && (
                      <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Delayed +{ev.delay_seconds}s
                      </span>
                    )}
                    {isOutOfOrder && (
                      <span className="px-2 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Out-of-Order
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Signals or Notes */}
                {hasSignals && (
                  <div className="mt-2.5 pt-2.5 border-t border-cyber-800/80 flex items-center space-x-2 text-xs text-rose-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Flagged by anomaly detector: {ev.signal_ids.join(', ')}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
