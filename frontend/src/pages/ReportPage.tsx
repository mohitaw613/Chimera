import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Printer,
  ShieldCheck,
  Hash,
  ChevronRight,
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
      <div className="py-20 text-center text-slate-400 max-w-4xl mx-auto text-xs">
        Compiling investigation report…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-20 text-center text-slate-400 max-w-4xl mx-auto text-xs">
        Report unavailable. Ensure the investigation has completed analysis.
      </div>
    );
  }

  const { investigation, overview, finding, narrative, hypotheses, initial_access_candidates, gaps, reproducibility } = report;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* Action Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/" className="hover:text-slate-200">Investigations</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-blue-400 font-mono">#{investigationId}</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Investigation Report</h1>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Printable Report Document Card */}
      <div className="card-glow rounded-2xl p-8 space-y-8 shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Document Header */}
        <div className="border-b border-cyber-800 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-blue-400 uppercase tracking-widest font-bold">
              CHIMERA CYBER INVESTIGATION PLATFORM
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">{investigation.name}</h2>
            <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2 font-mono">
              <span>Case #{investigation.id}</span>
              <span>•</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {investigation.is_synthetic && (
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Synthetic Benchmark Scenario
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-mono">Status: {investigation.status.toUpperCase()}</span>
          </div>
        </div>

        {/* Executive Finding */}
        <div className="p-4 rounded-xl bg-cyber-950 border border-blue-500/30 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Executive Case Finding</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            {finding.text}
          </p>
        </div>

        {/* Case Narrative */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Forensic Narrative
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {narrative}
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Total Records</span>
            <span className="text-lg font-bold font-mono text-white">{overview.total_events}</span>
          </div>
          <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Reconstructed Edges</span>
            <span className="text-lg font-bold font-mono text-white">{overview.total_relationships}</span>
          </div>
          <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Anomaly Signals</span>
            <span className="text-lg font-bold font-mono text-amber-400">{overview.total_signals}</span>
          </div>
          <div className="p-3 rounded-xl bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Open Gaps</span>
            <span className="text-lg font-bold font-mono text-rose-400">{overview.total_gaps}</span>
          </div>
        </div>

        {/* Hypotheses Assessment */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Hypotheses Evaluation
          </h3>
          <div className="overflow-x-auto rounded-xl border border-cyber-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-cyber-950 text-slate-400 uppercase font-mono tracking-wider border-b border-cyber-800">
                <tr>
                  <th className="py-2.5 px-3">Scenario</th>
                  <th className="py-2.5 px-3 text-center">Score</th>
                  <th className="py-2.5 px-3">Verdict</th>
                  <th className="py-2.5 px-3">Summary Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-800 font-mono">
                {hypotheses.map((h: any) => (
                  <tr key={h.key} className="hover:bg-cyber-850/50">
                    <td className="py-2.5 px-3 font-bold text-blue-400">{h.key}: {h.name}</td>
                    <td className="py-2.5 px-3 text-center text-white font-bold">{h.score}%</td>
                    <td className="py-2.5 px-3 uppercase text-[11px] text-slate-300">{h.status}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-300 text-xs">{h.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Initial Access Candidates */}
        {initial_access_candidates && initial_access_candidates.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Initial Access Candidate Identification
            </h3>
            <div className="space-y-2">
              {initial_access_candidates.map((cand: any) => (
                <div key={cand.rank} className="p-3 rounded-xl bg-cyber-950 border border-cyber-800 text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-blue-400 font-mono">Rank #{cand.rank}</span>
                    <span className="font-mono text-white font-semibold">{cand.event_id}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-cyan-300 font-mono">{cand.entity_id}</span>
                  </div>
                  <p className="text-slate-300">{cand.reason}</p>
                  <p className="text-[11px] text-amber-400/90 italic">{cand.caveat}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open Gaps */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Unverified Telemetry Gaps ({gaps.length})
            </h3>
            <div className="divide-y divide-cyber-800 border border-cyber-800 rounded-xl p-3 bg-cyber-950">
              {gaps.map((g: any) => (
                <div key={g.id} className="py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{g.title}</span>
                    <span className="text-[10px] uppercase font-mono text-rose-400">{g.severity}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{g.description}</p>
                  <span className="text-[10px] text-blue-400 font-mono block">Resolves with: {g.resolves_with}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reproducibility Hashes */}
        <div className="pt-6 border-t border-cyber-800 space-y-3 text-xs text-slate-400 font-mono">
          <div className="font-bold uppercase text-slate-300">Cryptographic Integrity Hashes</div>
          <div className="space-y-1 pt-1">
            {reproducibility.file_hashes.map((fh: any) => (
              <div key={fh.filename} className="flex items-center space-x-2 text-[10px] truncate">
                <Hash className="w-3 h-3 text-slate-500" />
                <span className="text-slate-300">{fh.filename}:</span>
                <span className="text-blue-400">{fh.sha256}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 text-center text-[10px] text-slate-500">
            CHIMERA Cyber Reasoning Platform • Verified Deterministic Analysis
          </div>
        </div>
      </div>
    </div>
  );
};
