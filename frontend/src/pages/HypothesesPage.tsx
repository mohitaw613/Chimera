import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BrainCircuit,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Tag,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { HypothesesOverviewResponse, Hypothesis } from '../types';

export const HypothesesPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();

  const [data, setData] = useState<HypothesesOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHypKey, setSelectedHypKey] = useState<string>('H1');

  useEffect(() => {
    loadHypotheses();
  }, [investigationId]);

  const loadHypotheses = async () => {
    if (!investigationId) return;
    setLoading(true);
    try {
      const res = await api.getHypotheses(investigationId);
      setData(res);
    } catch (err) {
      console.error('Failed to load hypotheses', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedHypothesis = data?.hypotheses.find((h) => h.key === selectedHypKey) || data?.hypotheses[0];

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-400 max-w-4xl mx-auto">
        Loading hypotheses analysis…
      </div>
    );
  }

  const getStatusBadge = (status: Hypothesis['status']) => {
    switch (status) {
      case 'leading':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Leading Hypothesis</span>
          </span>
        );
      case 'unlikely':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Unlikely
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Under Investigation
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Dynamic Header */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Stage 4: Competing Hypotheses & Forensic Reasoning</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Competing Hypotheses Evaluation
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Transparent multi-hypothesis scoring contrasting unauthorized intrusion against legitimate administrative operations.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/blast-radius`}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <span>Explore Blast Radius</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Finding Callout */}
        {data?.finding && (
          <div className="mt-4 p-3.5 rounded-lg bg-cyber-950/80 border border-cyber-800 flex items-start space-x-3 text-xs text-slate-300">
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Investigation Status: </span>
              {data.finding.text}
            </div>
          </div>
        )}
      </div>

      {/* Hypotheses Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data?.hypotheses.map((hyp) => {
          const isSelected = hyp.key === selectedHypKey;
          return (
            <div
              key={hyp.key}
              onClick={() => setSelectedHypKey(hyp.key)}
              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-cyber-850 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500'
                  : 'bg-cyber-900 border-cyber-800 hover:border-cyber-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyber-950 border border-cyber-700">
                  {hyp.key}
                </span>
                {getStatusBadge(hyp.status)}
              </div>

              <h3 className="font-bold text-white text-base mt-3 leading-snug">{hyp.name}</h3>

              <div className="mt-4 flex items-baseline justify-between pt-3 border-t border-cyber-800/80">
                <span className="text-3xl font-bold font-mono text-white">{hyp.score}%</span>
                <span className="text-[10px] text-slate-400 text-right max-w-[140px] leading-tight">
                  Heuristic score — not probability
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Hypothesis Deep Dive */}
      {selectedHypothesis && (
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-cyber-800 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-cyan-400 font-bold">{selectedHypothesis.key}:</span>
                <h2 className="text-lg font-bold text-white">{selectedHypothesis.name}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">{selectedHypothesis.explanation}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-cyan-400 bg-cyber-950 px-3 py-1.5 rounded-lg border border-cyber-800 inline-block">
                Score: {selectedHypothesis.score} / 100
              </span>
            </div>
          </div>

          {/* Mathematical Rule Contribution Table */}
          {selectedHypothesis.contributions && selectedHypothesis.contributions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  Deterministic Rule Contribution Breakdown
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Formula: S = Σ (wᵢ · eᵢ)</span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-cyber-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cyber-950 text-slate-400 uppercase font-mono tracking-wider border-b border-cyber-800">
                    <tr>
                      <th className="py-2.5 px-3">Rule</th>
                      <th className="py-2.5 px-3">Indicator Description</th>
                      <th className="py-2.5 px-3 text-center">Contribution (e)</th>
                      <th className="py-2.5 px-3 text-center">Weight (w)</th>
                      <th className="py-2.5 px-3 text-center">Product (w·e)</th>
                      <th className="py-2.5 px-3">Triggering Event IDs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-800">
                    {selectedHypothesis.contributions.map((c) => {
                      const prod = c.w * c.e;
                      return (
                        <tr key={c.rule_id} className="hover:bg-cyber-850/50 font-mono">
                          <td className="py-2.5 px-3 text-cyan-400 font-semibold">{c.rule_id}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-300">{c.label}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.e > 0
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : c.e < 0
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {c.e > 0 ? `+${c.e}` : c.e}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-300">{c.w}</td>
                          <td
                            className={`py-2.5 px-3 text-center font-bold ${
                              prod > 0 ? 'text-emerald-400' : prod < 0 ? 'text-rose-400' : 'text-slate-500'
                            }`}
                          >
                            {prod > 0 ? `+${prod}` : prod}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">
                            {c.event_ids && c.event_ids.length > 0 ? c.event_ids.join(', ') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Missing Evidence & Open Gaps */}
          {selectedHypothesis.missing_evidence && selectedHypothesis.missing_evidence.length > 0 && (
            <div className="bg-cyber-950 rounded-xl p-4 border border-rose-500/20 space-y-2">
              <div className="flex items-center space-x-1.5 text-rose-400 font-bold uppercase tracking-wider text-xs">
                <HelpCircle className="w-4 h-4" />
                <span>Missing Evidence Precluding Final Certainty</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-rose-200">
                {selectedHypothesis.missing_evidence.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Initial Access Candidates Section */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 space-y-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Root-Cause Identification</span>
          </div>
          <h2 className="text-lg font-bold text-white">Initial Access Candidates</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked earliest entries into the suspicious subgraph carrying anomaly signals.
          </p>
        </div>

        <div className="space-y-3">
          {data?.initial_access && data.initial_access.length > 0 ? (
            data.initial_access.map((cand) => (
              <div
                key={cand.rank}
                className="bg-cyber-950 rounded-xl p-4 border border-cyber-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Rank #{cand.rank}
                    </span>
                    <span className="font-mono text-sm font-semibold text-white">{cand.event_id}</span>
                    <span className="text-slate-500">•</span>
                    <span className="font-mono text-xs text-cyan-300">{cand.entity_id}</span>
                    {cand.technique && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center space-x-1">
                        <Tag className="w-3 h-3" />
                        <span>MITRE {cand.technique.id}: {cand.technique.name}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">{cand.reason}</p>
                  <p className="text-[11px] text-amber-400/90 italic">{cand.caveat}</p>
                </div>

                <div className="flex-shrink-0">
                  <Link
                    to={`/investigations/${investigationId}/evidence?q=${cand.event_id}`}
                    className="px-3 py-1.5 bg-cyber-800 hover:bg-cyber-700 text-slate-300 hover:text-white rounded text-xs font-medium border border-cyber-700 transition-colors"
                  >
                    Inspect Record
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs">
              No anomalous initial access candidates identified.
            </div>
          )}
        </div>
      </div>

      {/* Investigation Gaps Section */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 space-y-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-mono uppercase tracking-wider mb-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Forensic Transparency</span>
          </div>
          <h2 className="text-lg font-bold text-white">
            Open Investigation Gaps ({data?.gaps.length ?? 0})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Explicit unverified causal hops and missing telemetry required to establish definitive attribution.
          </p>
        </div>

        <div className="divide-y divide-cyber-800">
          {data?.gaps.map((gap) => (
            <div key={gap.id} className="py-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-xs">{gap.title}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    gap.severity === 'high'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {gap.severity} severity
                </span>
              </div>
              <p className="text-xs text-slate-300">{gap.description}</p>
              <div className="text-[11px] text-cyan-400 flex items-center space-x-1 pt-0.5">
                <span className="text-slate-500 font-mono">Resolves with:</span>
                <span>{gap.resolves_with}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
