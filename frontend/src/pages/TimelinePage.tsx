import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  Shuffle,
  GitFork,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Calendar,
  Layers,
} from 'lucide-react';
import { api } from '../api/client';
import { TimelineResponse, TimelineSignal } from '../types';

const SIGNAL_DEFINITIONS: Record<string, { label: string; severity: 'high' | 'medium' | 'low'; description: string }> = {
  unusual_login_hour: {
    label: 'Off-Hours Authentication',
    severity: 'medium',
    description: 'Login activity detected outside standard operational business hours (07:00–19:00 UTC).',
  },
  new_device_association: {
    label: 'New Device Association',
    severity: 'medium',
    description: 'First observed binding between this user account and endpoint device in telemetry baseline.',
  },
  service_account_interactive_login: {
    label: 'Interactive Service Account Login',
    severity: 'high',
    description: 'Non-human service identity initiated an interactive workstation session instead of an automated daemon process.',
  },
  failed_then_success: {
    label: 'Brute Force / Credential Guessing',
    severity: 'high',
    description: 'Multiple consecutive failed authentications immediately followed by a successful login.',
  },
  privilege_change_event: {
    label: 'Unverified Privilege Escalation',
    severity: 'high',
    description: 'Administrative role or token elevation without an approved change authorization ticket.',
  },
  new_external_endpoint: {
    label: 'Anomalous External Network Egress',
    severity: 'medium',
    description: 'First observed outbound network socket connection to an untrusted external IP address.',
  },
  dense_sequence: {
    label: 'High-Density Suspicious Event Burst',
    severity: 'high',
    description: 'Concentrated cluster of multiple suspicious events within a narrow 15-minute correlation window.',
  },
};

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
    const hasAnySignal = (ev.signals && ev.signals.length > 0) || (ev.signal_ids && ev.signal_ids.length > 0);
    if (onlySignals && !hasAnySignal) return false;
    if (filterType === 'delayed') return ev.flags.includes('delayed');
    if (filterType === 'out_of_order') return ev.flags.includes('out_of_order');
    if (filterType === 'ambiguous') return ev.ordering_ambiguous;
    return true;
  });

  const delayedCount = (data?.events || []).filter((e) => e.flags.includes('delayed')).length;
  const outOfOrderCount = (data?.events || []).filter((e) => e.flags.includes('out_of_order')).length;
  const ambiguousCount = (data?.events || []).filter((e) => e.ordering_ambiguous).length;
  const signalEventsCount = (data?.events || []).filter((e) => (e.signals && e.signals.length > 0) || (e.signal_ids && e.signal_ids.length > 0)).length;

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toISOString().replace('T', ' ').slice(11, 19) + ' UTC';
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10 font-sans">
      {/* Header & Metrics */}
      <div className="card-glow rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-200">Investigations</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-mono">#{investigationId}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Event Timeline & Anomaly Analysis</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Chronologically reconstructed sequence resolving arrival delays, cross-log inversions, and behavioral security anomalies.
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
              <span>Security Anomalies</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400">
              {loading ? '…' : signalEventsCount}
            </div>
            <div className="text-[11px] text-slate-500">Flagged by anomaly rules</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-cyber-900 rounded-2xl border border-cyber-800">
        <div className="flex items-center space-x-1 text-xs overflow-x-auto py-0.5">
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
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlySignals}
              onChange={(e) => setOnlySignals(e.target.checked)}
              className="rounded bg-cyber-950 border-cyber-700 text-rose-500 focus:ring-0 focus:ring-offset-0"
            />
            <span className={onlySignals ? 'font-semibold text-rose-400' : 'text-slate-400'}>
              Anomalous Events Only ({signalEventsCount})
            </span>
          </label>
        </div>
      </div>

      {/* Chronological Event Stream */}
      <div className="space-y-3.5">
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs">Reconstructing chronological sequence & evaluating anomaly rules…</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">No events match the selected filters.</div>
        ) : (
          filteredEvents.map((ev, index) => {
            const hasSignals = (ev.signals && ev.signals.length > 0) || (ev.signal_ids && ev.signal_ids.length > 0);
            const isDelayed = ev.flags.includes('delayed');
            const isOutOfOrder = ev.flags.includes('out_of_order');
            const isAmbiguous = ev.ordering_ambiguous;

            // Collect signal objects, or reconstruct from signal_ids if objects are missing
            const activeSignals: TimelineSignal[] = (ev.signals && ev.signals.length > 0)
              ? ev.signals
              : (ev.signal_ids || []).map((sigId) => {
                  const matchedKey = Object.keys(SIGNAL_DEFINITIONS).find((k) => sigId.toLowerCase().includes(k)) || 'anomaly';
                  const def = SIGNAL_DEFINITIONS[matchedKey] || {
                    label: 'Suspicious Behavioral Anomaly',
                    severity: 'high' as const,
                    description: `Security rule violation flagged on this event [${sigId}].`,
                  };
                  return {
                    id: sigId,
                    signal: matchedKey,
                    reason: def.description,
                    severity: def.severity,
                    kind: 'anomaly',
                  };
                });

            return (
              <div
                key={ev.id}
                className={`card-glow rounded-2xl p-4.5 transition-all hover:border-slate-700 ${
                  hasSignals
                    ? 'border-l-4 border-l-rose-500 bg-cyber-900/90'
                    : isDelayed || isOutOfOrder
                    ? 'border-l-4 border-l-amber-500/70 bg-cyber-900/60'
                    : 'bg-cyber-900/40'
                }`}
              >
                {/* Event Row Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      #{index + 1}
                    </span>
                    <span className="font-mono text-xs font-semibold text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                      {ev.id}
                    </span>
                    <span className="text-slate-600 font-bold">•</span>
                    <span className="text-xs font-bold text-white tracking-wide">
                      {ev.actor || 'System'}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {ev.event_type} on <span className="text-slate-200 font-mono">{ev.target || (ev as any).device || 'Host'}</span>
                    </span>
                  </div>

                  {/* Timing Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-cyber-950 border border-cyber-800 text-slate-300 flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>{formatDateTime(ev.event_time)}</span>
                    </span>
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
                    {isAmbiguous && (
                      <span className="px-2 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Ambiguous
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Metadata Subline */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    <span>Source: <strong className="text-slate-300 font-mono">{ev.source}</strong></span>
                  </span>
                  {ev.source_device && (
                    <span>Endpoint: <strong className="text-slate-300 font-mono">{ev.source_device}</strong></span>
                  )}
                  {ev.outcome && (
                    <span>Status: <strong className={ev.outcome === 'success' ? 'text-emerald-400' : 'text-rose-400'}>{ev.outcome}</strong></span>
                  )}
                </div>

                {/* One Compact Single Row for Anomalies & Reasons */}
                {(hasSignals || isDelayed || isOutOfOrder || isAmbiguous) && (
                  <div className="mt-2.5 pt-2 border-t border-cyber-800/80 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center space-x-1 mr-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Anomalies:</span>
                    </span>

                    {/* Security Signal Short Badges */}
                    {activeSignals.map((sig, sIdx) => {
                      const def = SIGNAL_DEFINITIONS[sig.signal] || {
                        label: sig.signal.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                        severity: (sig.severity as any) || 'high',
                        description: sig.reason,
                      };
                      const isHigh = (sig.severity || def.severity) === 'high';
                      return (
                        <span
                          key={sIdx}
                          title={`${sig.id} • Reason: ${sig.reason || def.description}`}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-help transition-all ${
                            isHigh
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
                          <span>{def.label}</span>
                        </span>
                      );
                    })}

                    {/* Temporal Delay Badge */}
                    {isDelayed && (
                      <span
                        title={`Pipeline transit lag: occurred ${formatDateTime(ev.event_time)}, ingested ${formatDateTime(ev.ingested_at)} (+${ev.delay_seconds}s)`}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-help hover:bg-amber-500/20"
                      >
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Pipeline Lag (+{ev.delay_seconds}s)</span>
                      </span>
                    )}

                    {/* Out of Order Inversion Badge */}
                    {isOutOfOrder && (
                      <span
                        title="Arrival sequence was out-of-order; chronologically restored via event-time"
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 cursor-help hover:bg-purple-500/20"
                      >
                        <Shuffle className="w-3 h-3 text-purple-400" />
                        <span>Out-of-Order Inversion</span>
                      </span>
                    )}

                    {/* Clock Skew Ambiguous Badge */}
                    {isAmbiguous && (
                      <span
                        title="Timestamp within ±3s of cross-source event (clock-skew tolerance)"
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 cursor-help hover:bg-rose-500/20"
                      >
                        <span>Clock Skew (±3s)</span>
                      </span>
                    )}
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

export default TimelinePage;
