import React, { useState } from 'react';
import {
  X,
  Shield,
  HelpCircle,
  FileCode,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { EdgeDetail, EpistemicStatus } from '../types';

interface EdgeEvidencePanelProps {
  edge: EdgeDetail | null;
  loading: boolean;
  onClose: () => void;
}

export const EdgeEvidencePanel: React.FC<EdgeEvidencePanelProps> = ({ edge, loading, onClose }) => {
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  if (!edge && !loading) return null;

  const copyRecordJson = (eventId: string, record: any) => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopiedEventId(eventId);
    setTimeout(() => setCopiedEventId(null), 2000);
  };

  const getStatusBadge = (status: EpistemicStatus) => {
    switch (status) {
      case 'observed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Observed (Direct Record)
          </span>
        );
      case 'inferred':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Inferred (Correlated)
          </span>
        );
      case 'needs_verification':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HelpCircle className="w-3.5 h-3.5 mr-1" />
            Needs Verification (Open Gap)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-cyber-900 border-l border-cyber-700 shadow-2xl flex flex-col h-full z-10">
        {/* Header */}
        <div className="p-5 border-b border-cyber-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-bold text-white text-base">Edge Evidence & Provenance</h3>
              <span className="text-[11px] font-mono text-cyan-400 block">{edge?.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-cyber-800 transition-colors"
            aria-label="Close edge evidence panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {loading ? (
            <div className="py-20 text-center text-slate-400">Loading relationship provenance…</div>
          ) : edge ? (
            <>
              {/* Relationship Anatomy */}
              <div className="bg-cyber-950 rounded-xl p-4 border border-cyber-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 uppercase font-mono tracking-wider text-[11px]">Relationship</span>
                  {getStatusBadge(edge.status)}
                </div>

                <div className="flex items-center space-x-3 text-sm font-mono pt-1">
                  <div className="px-3 py-1.5 rounded bg-cyber-900 border border-cyber-700 text-cyan-300 font-semibold truncate max-w-[180px]">
                    {edge.source.label}
                  </div>
                  <div className="flex-1 text-center border-b border-dashed border-slate-600 relative">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-cyber-950 text-[10px] text-slate-400 uppercase tracking-wider font-sans">
                      {edge.relationship_type}
                    </span>
                  </div>
                  <div className="px-3 py-1.5 rounded bg-cyber-900 border border-cyber-700 text-emerald-300 font-semibold truncate max-w-[180px]">
                    {edge.target.label}
                  </div>
                </div>
              </div>

              {/* Confidence Calculation Breakdown */}
              <div className="bg-cyber-950 rounded-xl p-4 border border-cyber-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-xs uppercase tracking-wider">Evidence Strength Score</span>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      Heuristic evidence score — not attack probability
                    </span>
                  </div>
                  <span className="text-lg font-bold font-mono text-cyan-400">
                    {(edge.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-cyber-900 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      edge.status === 'observed'
                        ? 'bg-emerald-500'
                        : edge.status === 'inferred'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.round(edge.confidence * 100)}%` }}
                  />
                </div>

                {/* Breakdown list */}
                <div className="pt-2 border-t border-cyber-900 space-y-1.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Score Calculation Breakdown
                  </div>
                  <div className="space-y-1">
                    {edge.confidence_breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-300">{item.label}</span>
                        <span className={item.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {item.delta >= 0 ? `+${item.delta.toFixed(2)}` : item.delta.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Explanation & Epistemic Guardrail Note */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg bg-cyber-950 border border-cyber-800 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">What Happened</span>
                  <p className="text-slate-200 text-xs leading-relaxed">{edge.why}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-cyber-950 border border-amber-500/20 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Epistemic Note</span>
                  <p className="text-slate-300 text-xs leading-relaxed italic">{edge.epistemic_note}</p>
                </div>

                {/* USP Conclusion Callout */}
                <div className="p-3 rounded-lg bg-cyber-850 border border-cyan-500/30 text-cyan-300 text-xs font-semibold text-center italic">
                  &ldquo;{edge.conclusion}&rdquo;
                </div>
              </div>

              {/* Verification Checklist */}
              {edge.checks && edge.checks.length > 0 && (
                <div className="bg-cyber-950 rounded-xl p-4 border border-cyber-800 space-y-3">
                  <span className="font-bold text-white text-xs uppercase tracking-wider block">
                    Forensic Verification Checklist
                  </span>
                  <div className="space-y-2">
                    {edge.checks.map((chk, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{chk.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            chk.state === 'observed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : chk.state === 'inferred'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {chk.state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open Gaps */}
              {edge.gaps && edge.gaps.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-1.5 text-rose-400 font-bold uppercase tracking-wider text-xs">
                    <HelpCircle className="w-4 h-4" />
                    <span>Associated Open Gaps ({edge.gaps.length})</span>
                  </div>
                  <div className="divide-y divide-rose-500/10">
                    {edge.gaps.map((g) => (
                      <div key={g.id} className="py-2 text-rose-200 text-xs">
                        {g.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence Records (Original Logs) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs uppercase tracking-wider">
                    Grounding Evidence Records ({edge.evidence.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Verbatim log provenance</span>
                </div>

                <div className="space-y-3">
                  {edge.evidence.map((evItem) => (
                    <div
                      key={evItem.event_id}
                      className="bg-cyber-950 rounded-xl p-4 border border-cyber-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-cyan-400 font-bold">{evItem.event_id}</span>
                          <span className="text-slate-500">•</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-cyber-900 text-slate-300">
                            {evItem.role} evidence
                          </span>
                        </div>
                        <button
                          onClick={() => copyRecordJson(evItem.event_id, evItem.raw_record)}
                          className="flex items-center space-x-1 px-2 py-1 rounded bg-cyber-800 hover:bg-cyber-700 text-slate-300 text-[11px] transition-colors"
                        >
                          {copiedEventId === evItem.event_id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedEventId === evItem.event_id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="text-slate-300 text-xs">{evItem.summary}</div>

                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono pt-1 border-t border-cyber-900">
                        {evItem.file && (
                          <div className="flex items-center space-x-1">
                            <FileCode className="w-3 h-3 text-slate-500" />
                            <span>{evItem.file}</span>
                            {evItem.row_number && <span>:L{evItem.row_number}</span>}
                          </div>
                        )}
                        {evItem.event_time && (
                          <span>{new Date(evItem.event_time).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                        )}
                      </div>

                      {/* Verbatim Record Box */}
                      <pre className="p-3 rounded-lg bg-cyber-900/80 border border-cyber-800 font-mono text-[11px] text-slate-200 overflow-x-auto">
                        {JSON.stringify(evItem.raw_record, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
