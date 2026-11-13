import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Search,
  Filter,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { CanonicalEvent } from '../types';

export const EvidencePage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();

  // State
  const [events, setEvents] = useState<CanonicalEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedFlag, setSelectedFlag] = useState('');
  const [selectedActor, setSelectedActor] = useState('');

  // Drawer
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [investigationId, page, selectedType, selectedFlag, selectedActor]);

  const loadEvents = async () => {
    if (!investigationId) return;
    setLoading(true);
    try {
      const res = await api.getEvents(investigationId, {
        page,
        page_size: pageSize,
        event_type: selectedType || undefined,
        flag: selectedFlag || undefined,
        actor: selectedActor || undefined,
        q: searchQuery || undefined,
      });
      setEvents(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadEvents();
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedType('');
    setSelectedFlag('');
    setSelectedActor('');
    setPage(1);
  };

  const handleSelectEvent = async (eventId: string) => {
    setSelectedEventId(eventId);
    try {
      const detail = await api.getEvents(investigationId!, { q: eventId });
      const found = detail.items.find((e) => e.id === eventId);
      setSelectedEventDetail(found || null);
    } catch {
      setSelectedEventDetail(null);
    }
  };

  const copyRawJson = () => {
    if (!selectedEventDetail) return;
    navigator.clipboard.writeText(JSON.stringify(selectedEventDetail.raw_record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPages = Math.ceil(total / pageSize);

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Success
          </span>
        );
      case 'failure':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Failure
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <HelpCircle className="w-3 h-3 mr-1" />
            Unknown
          </span>
        );
    }
  };

  const getFlagBadges = (flags: string[], delaySeconds?: number | null) => {
    return (
      <div className="flex flex-wrap gap-1">
        {flags.map((f, i) => {
          if (f === 'delayed') {
            const mins = delaySeconds ? Math.round(delaySeconds / 60) : 0;
            return (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
              >
                +{mins}m delay
              </span>
            );
          }
          if (f === 'out_of_order') {
            return (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20"
              >
                out-of-order
              </span>
            );
          }
          if (f === 'timestamp_uncertain') {
            return (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
              >
                skew/uncertain
              </span>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Dynamic Narrative */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Forensic Evidence Explorer</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Evidence Log Records ({total.toLocaleString()} Events)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Normalized canonical events with raw records preserved verbatim. Click any event to inspect raw log contents.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/timeline`}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <span>View Reconstructed Timeline</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mt-5 pt-4 border-t border-cyber-800 flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search actor, host, IP, or source…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-cyber-950 border border-cyber-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </form>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Filter by Event Type"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-cyber-950 border border-cyber-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Event Types</option>
              <option value="authentication">Authentication</option>
              <option value="service_access">Service Access</option>
              <option value="privilege_change">Privilege Change</option>
              <option value="external_connection">External Connection</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <select
              aria-label="Filter by Arrival Flag"
              value={selectedFlag}
              onChange={(e) => {
                setSelectedFlag(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-cyber-950 border border-cyber-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Arrival Flags</option>
              <option value="delayed">Delayed (&gt; 5 min)</option>
              <option value="out_of_order">Out of Order</option>
              <option value="timestamp_uncertain">Uncertain / Skew</option>
              <option value="normal">Normal Arrival</option>
            </select>
          </div>

          {(selectedType || selectedFlag || searchQuery || selectedActor) && (
            <button
              onClick={resetFilters}
              className="px-2.5 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 hover:text-white text-xs font-medium flex items-center space-x-1 border border-cyber-700 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cyber-950/80 text-slate-400 uppercase font-mono tracking-wider border-b border-cyber-800">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Event Time (UTC)</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Source Device</th>
                <th className="py-3 px-4">Target / Destination</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Arrival Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading evidence records…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No events match the specified filters.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => handleSelectEvent(evt.id)}
                    className="hover:bg-cyber-850/70 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-cyan-400">
                      {evt.id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {evt.event_time ? new Date(evt.event_time).toISOString().replace('T', ' ').slice(0, 19) : (
                        <span className="text-rose-400 italic">missing</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyber-800 text-slate-200 border border-cyber-700">
                        {evt.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {evt.actor || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {evt.source_device || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {evt.target || evt.attributes?.dest_ip || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {getOutcomeBadge(evt.outcome)}
                    </td>
                    <td className="py-3 px-4">
                      {getFlagBadges(evt.arrival_flags, evt.delay_seconds)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-cyber-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-mono text-white">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-mono text-white">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="font-mono text-white">{total.toLocaleString()}</span> records
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded bg-cyber-800 hover:bg-cyber-700 disabled:opacity-40 text-slate-300 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1.5 rounded bg-cyber-800 hover:bg-cyber-700 disabled:opacity-40 text-slate-300 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Raw Record Detail Drawer */}
      {selectedEventId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedEventId(null)}
          />
          <div className="relative w-full max-w-xl bg-cyber-900 border-l border-cyber-700 shadow-2xl flex flex-col h-full z-10">
            {/* Drawer Header */}
            <div className="p-5 border-b border-cyber-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">
                  Raw Evidence Record: <span className="font-mono text-cyan-400">{selectedEventId}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventId(null)}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-cyber-800 transition-colors"
                aria-label="Close record drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {selectedEventDetail ? (
                <>
                  {/* Metadata Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-1">
                      <span className="text-slate-400">Event Timestamp:</span>
                      <div className="font-mono text-white text-xs">
                        {selectedEventDetail.event_time ? new Date(selectedEventDetail.event_time).toISOString() : 'None'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-1">
                      <span className="text-slate-400">Ingested At:</span>
                      <div className="font-mono text-white text-xs">
                        {new Date(selectedEventDetail.ingested_at).toISOString()}
                      </div>
                    </div>
                  </div>

                  {/* Arrival Flags & Delay */}
                  <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Arrival Characteristics:</span>
                      {selectedEventDetail.delay_seconds !== null && selectedEventDetail.delay_seconds !== undefined && (
                        <span className="font-mono text-amber-400">
                          {selectedEventDetail.delay_seconds}s delay ({Math.round(selectedEventDetail.delay_seconds / 60)} min)
                        </span>
                      )}
                    </div>
                    <div>{getFlagBadges(selectedEventDetail.arrival_flags, selectedEventDetail.delay_seconds)}</div>
                  </div>

                  {/* Verbatim Raw Record */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                        Verbatim Ingested Record (Original Payload)
                      </span>
                      <button
                        onClick={copyRawJson}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-cyber-800 hover:bg-cyber-700 text-slate-300 text-[11px] transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-cyber-950 border border-cyber-800 font-mono text-slate-200 text-xs overflow-x-auto leading-relaxed">
                      {JSON.stringify(selectedEventDetail.raw_record, null, 2)}
                    </pre>
                  </div>

                  {/* Normalized Attributes */}
                  <div className="space-y-2">
                    <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                      Canonical Attributes
                    </span>
                    <pre className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 font-mono text-slate-300 text-xs overflow-x-auto">
                      {JSON.stringify(selectedEventDetail.attributes, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-slate-400">Loading record details…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
