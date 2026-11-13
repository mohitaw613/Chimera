import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
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

  // Drawer
  const [selectedEvent, setSelectedEvent] = useState<CanonicalEvent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [investigationId, page, selectedType, selectedFlag]);

  const loadEvents = async () => {
    if (!investigationId) return;
    setLoading(true);
    try {
      const res = await api.getEvents(investigationId, {
        page,
        page_size: pageSize,
        event_type: selectedType || undefined,
        flag: selectedFlag || undefined,
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

  const copyRawRecord = () => {
    if (!selectedEvent) return;
    navigator.clipboard.writeText(JSON.stringify(selectedEvent.raw_record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header Bar */}
      <div className="card-glow rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-200">Investigations</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-mono">#{investigationId}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Evidence Explorer</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Inspect normalized log records with complete file provenance and verbatim raw payload inspection.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/upload`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
            >
              Upload More Evidence
            </Link>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3">
          <form onSubmit={handleSearchSubmit} className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by actor, IP, host, or event ID..."
              className="w-full bg-cyber-950 border border-cyber-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </form>

          <div className="md:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-cyber-950 border border-cyber-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Event Types</option>
              <option value="authentication">Authentication</option>
              <option value="service_access">Service Access</option>
              <option value="network_flow">Network Flow</option>
              <option value="privilege_change">Privilege Change</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedFlag}
              onChange={(e) => {
                setSelectedFlag(e.target.value);
                setPage(1);
              }}
              className="w-full bg-cyber-950 border border-cyber-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Arrival Flags</option>
              <option value="delayed">Delayed Arrival</option>
              <option value="out_of_order">Out of Order</option>
              <option value="timestamp_uncertain">Timestamp Uncertain</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="card-glow rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cyber-950/80 text-slate-400 uppercase font-mono tracking-wider border-b border-cyber-800">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target / Host</th>
                <th className="py-3 px-4">Source File</th>
                <th className="py-3 px-4 text-center">Outcome</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800/80 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    Loading records…
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No matching log records found.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="hover:bg-cyber-850/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">{ev.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {ev.event_time ? new Date(ev.event_time).toLocaleTimeString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-cyber-950 border border-cyber-800 text-slate-200">
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{ev.actor || '—'}</td>
                    <td className="py-3 px-4 text-slate-300">{ev.target || ev.source_device || (ev as any).device || '—'}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px] truncate max-w-[120px]">
                      {ev.source || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ev.outcome === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {ev.outcome || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        className="text-blue-400 hover:text-blue-300 font-medium text-xs"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-cyber-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-bold text-white">{events.length}</span> of{' '}
            <span className="font-bold text-white">{total}</span> total events
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-cyber-950 border border-cyber-800 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-cyber-950 border border-cyber-800 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Raw Record Inspector Slide-over */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-cyber-950/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-xl bg-cyber-900 border-l border-cyber-800 h-full p-6 flex flex-col space-y-5 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-cyber-800">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-blue-400">{selectedEvent.id}</span>
                <span className="text-slate-400 text-xs">• Raw Record Payload</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Event Type</span>
                <span className="text-white font-mono">{selectedEvent.event_type}</span>
              </div>
              <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Actor</span>
                <span className="text-white font-mono">{selectedEvent.actor || 'System'}</span>
              </div>
              <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Source File</span>
                <span className="text-white font-mono truncate block">{selectedEvent.source}</span>
              </div>
              <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Row Number</span>
                <span className="text-white font-mono">Line #{selectedEvent.row_number || '—'}</span>
              </div>
            </div>

            {/* Verbatim JSON Payload */}
            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Verbatim JSON Record</span>
                <button
                  onClick={copyRawRecord}
                  className="px-2.5 py-1 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 hover:text-white text-xs flex items-center space-x-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="flex-1 p-4 rounded-xl bg-cyber-950 border border-cyber-800 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                {JSON.stringify(selectedEvent.raw_record, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
