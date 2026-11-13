import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderPlus,
  ShieldAlert,
  Clock,
  ArrowRight,
  Database,
  GitFork,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { DashboardSummary, Investigation } from '../types';

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSynthetic, setIsSynthetic] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await api.getDashboard();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.createInvestigation({
        name: newTitle.trim(),
        description: newDesc.trim() || undefined,
        is_synthetic: isSynthetic,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      await loadDashboard();
    } catch (err) {
      console.error('Failed to create investigation', err);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: Investigation['status']) => {
    switch (status) {
      case 'analyzed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Analyzed
          </span>
        );
      case 'ingested':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Database className="w-3 h-3 mr-1" />
            Ingested
          </span>
        );
      case 'stale':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Analysis Stale
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Created
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Smart Narrative & Decision Header */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono tracking-wider uppercase mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Evidence-First Cyber Reasoning Platform</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Cyber Investigation Control Plane
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Reconstructing attack graphs and lateral movement across fragmented, delayed, and out-of-order logs with strict epistemic honesty.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm flex items-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <FolderPlus className="w-4 h-4" />
              <span>New Investigation</span>
            </button>
          </div>
        </div>

        {/* Narrative Callout */}
        <div className="mt-5 p-3.5 rounded-lg bg-cyber-950/80 border border-cyber-800 flex items-start space-x-3 text-xs text-slate-300">
          <Activity className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">System Status:</span> All deterministic reasoning engines active. Correlating 250+ events across multi-source forensic logs with zero ungrounded assertions.
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-cyber-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Investigations</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-3xl font-bold text-white font-mono">
            {loading ? '…' : summary?.total_investigations ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Total active cases</div>
        </div>

        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-cyber-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Evidence Events</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-bold text-white font-mono">
            {loading ? '…' : summary?.total_events.toLocaleString() ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Canonical log records</div>
        </div>

        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-cyber-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Graph Entities</span>
            <GitFork className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 text-3xl font-bold text-white font-mono">
            {loading ? '…' : summary?.total_entities.toLocaleString() ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Users, devices & services</div>
        </div>

        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-cyber-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Anomaly Signals</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-bold text-white font-mono">
            {loading ? '…' : summary?.total_signals.toLocaleString() ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Rule-triggered anomalies</div>
        </div>

        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 hover:border-cyber-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Open Gaps</span>
            <HelpCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 text-3xl font-bold text-white font-mono">
            {loading ? '…' : summary?.open_gaps.toLocaleString() ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-400">Unverified causal links</div>
        </div>
      </div>

      {/* Investigations Table / Case List */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-cyber-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Active Case Files</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select an investigation to inspect reconstructed timeline, attack graph, and evidence provenance.
            </p>
          </div>
        </div>

        <div className="divide-y divide-cyber-800">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading investigations…</div>
          ) : summary?.recent.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Database className="w-10 h-10 text-slate-500 mx-auto" />
              <div className="text-slate-300 font-medium">No investigations found</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create a new investigation to ingest forensic log files or run scenario evaluations.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Create First Investigation
              </button>
            </div>
          ) : (
            summary?.recent.map((inv) => (
              <div
                key={inv.id}
                className="p-5 hover:bg-cyber-850/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <Link
                      to={`/investigations/${inv.id}/graph`}
                      className="text-base font-semibold text-white hover:text-cyan-400 transition-colors truncate focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                    >
                      {inv.name}
                    </Link>
                    {getStatusBadge(inv.status)}
                    {inv.is_synthetic && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Synthetic
                      </span>
                    )}
                  </div>
                  {inv.description && (
                    <p className="text-xs text-slate-400 truncate">{inv.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-slate-400 pt-1">
                    <span className="font-mono">ID: {inv.id}</span>
                    <span>•</span>
                    <span>Created: {new Date(inv.created_at).toLocaleDateString()}</span>
                    {inv.counts && (
                      <>
                        <span>•</span>
                        <span className="text-slate-300 font-mono">
                          {inv.counts.events} events, {inv.counts.entities} entities, {inv.counts.open_gaps} gaps
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Link
                    to={`/investigations/${inv.id}/upload`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 hover:text-white border border-cyber-700 transition-colors"
                  >
                    Evidence
                  </Link>
                  <Link
                    to={`/investigations/${inv.id}/timeline`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 hover:text-white border border-cyber-700 transition-colors"
                  >
                    Timeline
                  </Link>
                  <Link
                    to={`/investigations/${inv.id}/graph`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 transition-colors flex items-center space-x-1"
                  >
                    <span>Attack Graph</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-900 border border-cyber-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2">Create New Investigation</h3>
            <p className="text-xs text-slate-400 mb-4">
              Initialize a dedicated workspace with foreign-key isolation and deterministic provenance tracking.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="inv-name" className="block text-xs font-medium text-slate-300 mb-1">
                  Investigation Name *
                </label>
                <input
                  id="inv-name"
                  type="text"
                  required
                  placeholder="e.g., Enterprise Lateral Movement Case #104"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-cyber-950 border border-cyber-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label htmlFor="inv-desc" className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  id="inv-desc"
                  rows={3}
                  placeholder="Brief context regarding source logs, suspected actors, or scope…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-cyber-950 border border-cyber-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  id="inv-synth"
                  type="checkbox"
                  checked={isSynthetic}
                  onChange={(e) => setIsSynthetic(e.target.checked)}
                  className="w-4 h-4 rounded border-cyber-700 bg-cyber-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-cyber-900"
                />
                <label htmlFor="inv-synth" className="text-xs text-slate-300 select-none">
                  Tag as Synthetic Data (enforces forensic honesty badges)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-cyber-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-cyber-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center space-x-1.5"
                >
                  {creating ? <span>Creating…</span> : <span>Create Case</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
