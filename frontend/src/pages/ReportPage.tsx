import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Printer,
  ShieldCheck,
  Hash,
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
      <div className="py-20 text-center text-slate-400 max-w-4xl mx-auto">
        Generating deterministic forensic report…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-20 text-center text-slate-400 max-w-4xl mx-auto">
        Report unavailable. Ensure investigation has completed analysis.
      </div>
    );
  }

  const { investigation, overview, finding, narrative, hypotheses, initial_access_candidates, gaps, reproducibility } = report;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* Action Header (hidden in print) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Deterministic Investigation Report</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Case Findings Synthesis</h1>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-8 space-y-8 shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Document Header */}
        <div className="border-b border-cyber-800 pb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">
              CHIMERA FORENSIC INTELLIGENCE REPORT
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">{investigation.name}</h2>
            <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2 font-mono">
              <span>Case ID: {investigation.id}</span>
              <span>•</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-2">
            {investigation.is_synthetic && (
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Synthetic Evaluation Scenario
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-mono">Status: {investigation.status.toUpperCase()}</span>
          </div>
        </div>

        {/* Executive Finding Callout */}
        <div className="p-4 rounded-xl bg-cyber-950 border border-cyan-500/30 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Executive Investigation Finding</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            {finding.text}
          </p>
        </div>

        {/* Case Narrative */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Forensic Summary Narrative
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {narrative}
          </p>
        </div>

        {/* KPI Overview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Total Records</span>
            <span className="text-lg font-bold font-mono text-white">{overview.total_events}</span>
          </div>
          <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Reconstructed Edges</span>
            <span className="text-lg font-bold font-mono text-white">{overview.total_relationships}</span>
          </div>
          <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Anomaly Signals</span>
            <span className="text-lg font-bold font-mono text-amber-400">{overview.total_signals}</span>
          </div>
          <div className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 text-xs">
            <span className="text-slate-500 block">Open Gaps</span>
            <span className="text-lg font-bold font-mono text-rose-400">{overview.total_gaps}</span>
          </div>
        </div>

        {/* Competing Hypotheses Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Competing Hypotheses Evaluation
          </h3>
          <div className="overflow-x-auto rounded-lg border border-cyber-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-cyber-950 text-slate-400 uppercase font-mono tracking-wider border-b border-cyber-800">
                <tr>
                  <th className="py-2.5 px-3">Hypothesis</th>
                  <th className="py-2.5 px-3 text-center">Score</th>
                  <th className="py-2.5 px-3">Verdict Status</th>
                  <th className="py-2.5 px-3">Forensic Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-800 font-mono">
                {hypotheses.map((h: any) => (
                  <tr key={h.key} className="hover:bg-cyber-850/50">
                    <td className="py-2.5 px-3 font-bold text-cyan-400">{h.key}: {h.name}</td>
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
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Initial Access Candidate Identification
            </h3>
            <div className="space-y-2">
              {initial_access_candidates.map((cand: any) => (
                <div key={cand.rank} className="p-3 rounded-lg bg-cyber-950 border border-cyber-800 text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-cyan-400 font-mono">Rank #{cand.rank}</span>
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

        {/* Open Investigative Gaps */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Unverified Forensic Gaps ({gaps.length})
            </h3>
            <div className="divide-y divide-cyber-800 border border-cyber-800 rounded-lg p-3 bg-cyber-950">
              {gaps.map((g: any) => (
                <div key={g.id} className="py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{g.title}</span>
                    <span className="text-[10px] uppercase font-mono text-rose-400">{g.severity}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{g.description}</p>
                  <span className="text-[10px] text-cyan-400 font-mono block">Required: {g.resolves_with}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reproducibility & Integrity Footer */}
        <div className="pt-6 border-t border-cyber-800 space-y-3 text-xs text-slate-400 font-mono">
          <div className="font-bold uppercase text-slate-300">Cryptographic Integrity & Reproducibility</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div>Engine: CHIMERA v{reproducibility.engine_version}</div>
            <div>Rules: Deterministic v1.0</div>
            <div>Analysis Time: {new Date(investigation.analyzed_at).toISOString().slice(0, 19)} UTC</div>
          </div>

          <div className="space-y-1 pt-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Source Evidence Hashes</span>
            {reproducibility.file_hashes.map((fh: any) => (
              <div key={fh.filename} className="flex items-center space-x-2 text-[10px] truncate">
                <Hash className="w-3 h-3 text-slate-500" />
                <span className="text-slate-300">{fh.filename}:</span>
                <span className="text-cyan-400">{fh.sha256}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 text-center text-[10px] text-slate-400 italic">
            CHIMERA Evidence-First Cyber Investigation Engine • Produced for HACKINNOVISION 2026
          </div>
        </div>
      </div>
    </div>
  );
};
