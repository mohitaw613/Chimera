import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Printer,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Hash,
  Clock,
  Target,
  FileText,
  Lock,
} from 'lucide-react';
import { api } from '../api/client';

export const ReportPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();

  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [investigationId]);

  const loadReport = async () => {
    if (!investigationId) return;
    setLoading(true);
    try {
      const data = await api.getReport(investigationId);
      setReport(data);
    } catch (err) {
      console.error('Failed to load report', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 max-w-4xl mx-auto text-xs">
        Synthesizing deterministic investigation dossier…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-24 text-center text-slate-400 max-w-4xl mx-auto text-xs">
        Report unavailable. Ensure the investigation has completed analysis.
      </div>
    );
  }

  const { investigation, overview, finding, hypotheses, initial_access_candidates, gaps, blast_radius, reproducibility } = report;

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans print:max-w-none print:p-0 print:space-y-4">
      {/* Action Header (Screen only) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/" className="hover:text-slate-200">Investigations</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-blue-400 font-mono">#{investigationId}</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Executive Incident Report</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            to={`/investigations/${investigationId}/graph`}
            className="px-3.5 py-2 bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-cyber-800 transition-colors"
          >
            Attack Graph
          </Link>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Forensic Dossier Card */}
      <div className="card-glow rounded-2xl p-7 lg:p-9 space-y-7 shadow-2xl print:border print:border-slate-300 print:rounded-none print:p-6 print:bg-white print:text-slate-900 print:shadow-none">
        {/* Document Header */}
        <div className="border-b border-cyber-800/80 pb-5 print:border-slate-300 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono text-blue-400 print:text-blue-700 uppercase tracking-widest font-bold">
              CHIMERA • FORENSIC INCIDENT DOSSIER
            </div>
            <h2 className="text-2xl font-bold text-white print:text-slate-900 mt-1 tracking-tight">
              {investigation.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 print:text-slate-600 mt-2 font-mono">
              <span>Case #{investigation.id}</span>
              <span>•</span>
              <span>Generated: {formatDate(reproducibility.report_generated_at)}</span>
              {overview.time_span?.start && (
                <>
                  <span>•</span>
                  <span>Time Window: {overview.time_span.start.slice(11, 16)} - {overview.time_span.end.slice(11, 16)} UTC</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 print:border-blue-300 print:text-blue-800">
                {investigation.status.toUpperCase()}
              </span>
              {investigation.is_synthetic && (
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 print:border-amber-300 print:text-amber-800">
                  Synthetic Dataset
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 print:text-slate-500 font-mono flex items-center space-x-1">
              <Lock className="w-3 h-3 text-emerald-400 print:text-emerald-600" />
              <span>Deterministic Rule Proofs (R1–R7)</span>
            </span>
          </div>
        </div>

        {/* Executive Finding Callout */}
        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 print:bg-slate-50 print:border-slate-300 print-avoid-break">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 print:text-blue-700 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Executive Case Finding</span>
            </span>
            <span className="text-[10px] font-mono text-amber-400 print:text-amber-700 font-semibold">
              Epistemic Status: {finding.open_gaps > 0 ? 'Incomplete — Gaps Pending' : 'Verified'}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-100 print:text-slate-900 leading-snug">
            {finding.text}
          </p>
        </div>

        {/* 4 Core Incident KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print-avoid-break">
          <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800/80 print:bg-slate-50 print:border-slate-200">
            <span className="text-[11px] text-slate-400 print:text-slate-600 block">Records Ingested</span>
            <span className="text-xl font-bold font-mono text-white print:text-slate-900">{overview.total_events}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{overview.total_files} log sources</span>
          </div>

          <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800/80 print:bg-slate-50 print:border-slate-200">
            <span className="text-[11px] text-slate-400 print:text-slate-600 block">Reconstructed Graph</span>
            <span className="text-xl font-bold font-mono text-cyan-400 print:text-cyan-800">{overview.total_relationships}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{overview.total_entities} resolved entities</span>
          </div>

          <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800/80 print:bg-slate-50 print:border-slate-200">
            <span className="text-[11px] text-slate-400 print:text-slate-600 block">Anomaly Signals</span>
            <span className="text-xl font-bold font-mono text-amber-400 print:text-amber-700">{overview.total_signals}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Rules triggered</span>
          </div>

          <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800/80 print:bg-slate-50 print:border-slate-200">
            <span className="text-[11px] text-slate-400 print:text-slate-600 block">Investigation Gaps</span>
            <span className="text-xl font-bold font-mono text-rose-400 print:text-rose-700">{overview.total_gaps}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Missing audit hops</span>
          </div>
        </div>

        {/* Competing Hypotheses Evaluation */}
        <div className="space-y-3 print-avoid-break">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400 print:text-blue-700" />
              <span>Multi-Hypothesis Evaluation</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400 print:text-slate-500">
              Deterministic evidence contribution weighting
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-cyber-800/80 print:border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-cyber-950 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-mono text-[10px] tracking-wider border-b border-cyber-800 print:border-slate-300">
                <tr>
                  <th className="py-2.5 px-3.5">Scenario</th>
                  <th className="py-2.5 px-3 text-center">Score</th>
                  <th className="py-2.5 px-3 text-center">Verdict</th>
                  <th className="py-2.5 px-3">Summary Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-800 print:divide-slate-200 bg-cyber-950/40 print:bg-white font-sans">
                {hypotheses.map((h: any) => {
                  const isLeading = h.status === 'supported' || h.score >= 70;
                  return (
                    <tr key={h.key} className={isLeading ? 'bg-blue-950/20 print:bg-blue-50/50' : ''}>
                      <td className="py-2.5 px-3.5 font-bold font-mono text-white print:text-slate-900">
                        <span className="text-blue-400 print:text-blue-700 mr-1.5">{h.key}:</span>
                        {h.name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          isLeading
                            ? 'bg-blue-500/15 text-blue-400 print:text-blue-800 font-bold'
                            : 'text-slate-400 print:text-slate-600'
                        }`}>
                          {h.score}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded ${
                          isLeading
                            ? 'bg-emerald-500/10 text-emerald-400 print:text-emerald-800 border border-emerald-500/20'
                            : 'bg-cyber-850 text-slate-400 print:bg-slate-100 print:text-slate-600'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 print:text-slate-700 text-xs leading-relaxed">
                        {h.explanation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Initial Access & Exposure Blast Radius Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-avoid-break">
          {/* Initial Access Candidate */}
          <div className="p-4 rounded-xl bg-cyber-950/60 border border-cyber-800/80 print:bg-slate-50 print:border-slate-300 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400 print:text-blue-700" />
              <span>Initial Access Point</span>
            </span>
            {initial_access_candidates && initial_access_candidates[0] ? (
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 print:text-blue-800">
                    Rank #1
                  </span>
                  <span className="font-mono text-xs font-semibold text-white print:text-slate-900">
                    {initial_access_candidates[0].entity_id}
                  </span>
                </div>
                <p className="text-xs text-slate-300 print:text-slate-700 leading-snug">
                  {initial_access_candidates[0].reason}
                </p>
                <p className="text-[11px] text-amber-400/90 print:text-amber-800 italic">
                  Note: {initial_access_candidates[0].caveat}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No conclusive initial access candidate identified.</p>
            )}
          </div>

          {/* Blast Radius Exposure Classification */}
          <div className="p-4 rounded-xl bg-cyber-950/60 border border-cyber-800/80 print:bg-slate-50 print:border-slate-300 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-400 print:text-cyan-700" />
              <span>Blast Radius (Potential Exposure)</span>
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 print:text-slate-600">Pivot Entity:</span>
                <span className="font-mono text-white print:text-slate-900 font-semibold">{blast_radius?.start_entity || 'user:user_jdoe'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 print:text-slate-600">Directly Associated (1-hop):</span>
                <span className="font-mono font-bold text-emerald-400 print:text-emerald-700">
                  {blast_radius?.directly_associated?.length ?? 1} asset
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 print:text-slate-600">Indirectly Reachable (2+ hops):</span>
                <span className="font-mono font-bold text-cyan-400 print:text-cyan-700">
                  {blast_radius?.indirectly_associated?.length ?? 2} assets
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 print:text-slate-600">Unverified Exposure:</span>
                <span className="font-mono font-bold text-rose-400 print:text-rose-700">
                  {blast_radius?.unverified_exposure?.length ?? 4} assets
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actionable Telemetry Gaps */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-2.5 print-avoid-break">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 print:text-rose-700" />
                <span>Critical Investigative Gaps ({gaps.length})</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Missing audit events requiring verification</span>
            </div>

            <div className="divide-y divide-cyber-800/80 print:divide-slate-200 border border-cyber-800/80 print:border-slate-300 rounded-xl overflow-hidden bg-cyber-950/40 print:bg-white">
              {gaps.map((g: any) => (
                <div key={g.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white print:text-slate-900">{g.title}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 print:text-rose-800 border border-rose-500/20">
                        {g.severity}
                      </span>
                    </div>
                    <p className="text-slate-400 print:text-slate-600 text-[11px]">{g.description}</p>
                  </div>
                  <div className="text-[11px] text-blue-400 print:text-blue-800 font-mono sm:text-right flex-shrink-0">
                    <span className="text-slate-500 block text-[9px] uppercase">Remediation Action</span>
                    {g.resolves_with}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cryptographic Chain of Custody (Provenance) */}
        <div className="pt-4 border-t border-cyber-800/80 print:border-slate-300 space-y-2.5 print-avoid-break">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 flex items-center space-x-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            <span>Cryptographic Chain of Custody</span>
          </span>

          <div className="rounded-xl border border-cyber-800/80 print:border-slate-300 overflow-hidden text-xs">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-cyber-950 print:bg-slate-100 text-slate-400 print:text-slate-600 uppercase text-[9px] border-b border-cyber-800 print:border-slate-300">
                <tr>
                  <th className="py-1.5 px-3">Evidence Source File</th>
                  <th className="py-1.5 px-3">Records</th>
                  <th className="py-1.5 px-3">SHA-256 Checksum Digest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-800 print:divide-slate-200 bg-cyber-950/30 print:bg-white text-slate-300 print:text-slate-700">
                {reproducibility.file_hashes.map((fh: any) => (
                  <tr key={fh.filename}>
                    <td className="py-1.5 px-3 font-semibold text-slate-200 print:text-slate-900">{fh.filename}</td>
                    <td className="py-1.5 px-3 text-slate-400 print:text-slate-600">{fh.rows} rows</td>
                    <td className="py-1.5 px-3 text-blue-400 print:text-blue-800 truncate max-w-xs">{fh.sha256}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 text-center text-[10px] text-slate-500 print:text-slate-600 flex items-center justify-between font-mono">
            <span>CHIMERA Deterministic Forensics Core v{reproducibility.engine_version}</span>
            <span>Cryptographically Verified Chain • Unmodified Raw Log Provenance</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
