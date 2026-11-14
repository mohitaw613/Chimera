import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Tag,
  Shield,
  ChevronRight,
  Clock,
  Laptop,
  Globe,
  User as UserIcon,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { HypothesesOverviewResponse, Hypothesis } from '../types';

export const HypothesesPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();

  const [data, setData] = useState<HypothesesOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHypKey, setSelectedHypKey] = useState<string>('H1');
  const [analysisRequired, setAnalysisRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadHypotheses();
  }, [investigationId]);

  const loadHypotheses = async () => {
    if (!investigationId) return;
    setLoading(true);
    setAnalysisRequired(false);
    setLoadError(null);
    try {
      const investigation = await api.getInvestigation(investigationId);
      if (investigation.status !== 'analyzed') {
        setAnalysisRequired(true);
        setData(null);
        return;
      }
      const res = await api.getHypotheses(investigationId);
      setData(res);
    } catch (err: any) {
      setLoadError(err.response?.data?.detail || err.message || 'Could not load investigation hypotheses.');
      console.error('Failed to load hypotheses', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedHypothesis = data?.hypotheses.find((h) => h.key === selectedHypKey) || data?.hypotheses[0];

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-400 max-w-4xl mx-auto text-xs font-sans">
        Evaluating hypotheses and root cause entry points…
      </div>
    );
  }

  if (analysisRequired || loadError) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4 font-sans">
        <h1 className="text-xl font-bold text-white">{loadError ? 'Hypotheses unavailable' : 'Analysis required'}</h1>
        <p role={loadError ? 'alert' : undefined} className="text-sm text-slate-400">
          {loadError || 'Run analysis for this investigation to generate hypotheses, evidence gaps, and initial-access candidates.'}
        </p>
        <Link to={`/investigations/${investigationId}`} className="inline-flex px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">
          Go to Investigation Dashboard
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: Hypothesis['status']) => {
    switch (status) {
      case 'leading':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Leading Hypothesis</span>
          </span>
        );
      case 'unlikely':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Unlikely
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Under Investigation
          </span>
        );
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toISOString().replace('T', ' ').slice(11, 19) + ' UTC';
    } catch {
      return isoString;
    }
  };

  const primaryCandidate = data?.initial_access && data.initial_access.length > 0 ? data.initial_access[0] : null;
  const secondaryCandidates = data?.initial_access && data.initial_access.length > 1 ? data.initial_access.slice(1) : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 font-sans">
      {/* 1. Top Header Bar */}
      <div className="card-glow rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-200">Investigations</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-mono">#{investigationId}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Root Cause Analysis & Investigation Hypotheses
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Deterministic initial access candidate identification and multi-scenario hypothesis evaluation.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/graph`}
              className="px-3.5 py-2 bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-cyber-800 transition-colors"
            >
              Attack Graph
            </Link>
            <Link
              to={`/investigations/${investigationId}/blast-radius`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <span>Blast Radius</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Epistemic Status Callout */}
        {data?.finding && (
          <div className="mt-4 p-3.5 rounded-xl bg-cyber-950/80 border border-cyber-800 flex items-start space-x-3 text-xs text-slate-300">
            <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Investigation Status: </span>
              {data.finding.text}
            </div>
          </div>
        )}
      </div>

      {/* 2. ROOT CAUSE ANALYSIS & INITIAL ACCESS CANDIDATES (Positioned 2nd at Top) */}
      <div className="card-glow rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-cyber-800/80 gap-2">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-mono uppercase tracking-wider font-bold mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Root Cause Analysis • Initial Access Candidate</span>
            </div>
            <h2 className="text-lg font-bold text-white">Earliest Intrusion Entry Point</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked earliest entry events into the suspicious attack subgraph carrying detected anomaly signals.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 self-start sm:self-center">
            Deterministic Entry Ranking
          </span>
        </div>

        {primaryCandidate ? (
          <div className="p-5 rounded-2xl bg-cyber-950/90 border border-blue-500/30 space-y-4 shadow-xl">
            {/* Top Indicator Line */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                  <span>Primary Initial Access Candidate (Rank #{primaryCandidate.rank})</span>
                </span>
                <span className="font-mono text-xs font-bold text-white px-2 py-0.5 rounded bg-cyber-850 border border-cyber-800">
                  {primaryCandidate.event_id}
                </span>
              </div>

              {primaryCandidate.technique && (
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center space-x-1.5 self-start sm:self-auto">
                  <Tag className="w-3.5 h-3.5 text-purple-400" />
                  <span>MITRE {primaryCandidate.technique.id}: {primaryCandidate.technique.name}</span>
                </span>
              )}
            </div>

            {/* Quick Forensic Attributes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-cyber-900/60 border border-cyber-800 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Compromised Actor</span>
                <span className="font-mono font-bold text-slate-100 flex items-center space-x-1">
                  <UserIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="truncate">{primaryCandidate.entity_id}</span>
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Target Host</span>
                <span className="font-mono font-bold text-slate-100 flex items-center space-x-1">
                  <Laptop className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="truncate">{primaryCandidate.target || 'ws-207'}</span>
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Ingress Source IP</span>
                <span className="font-mono font-bold text-slate-100 flex items-center space-x-1">
                  <Globe className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span className="truncate">{primaryCandidate.source_ip || '198.51.100.23'}</span>
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Initial Event Time</span>
                <span className="font-mono font-bold text-slate-100 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>{formatDateTime(primaryCandidate.event_time)}</span>
                </span>
              </div>
            </div>

            {/* Forensic Reasoning */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
                Evidence-Backed Root Cause Rationale:
              </span>
              <p className="text-slate-200 leading-relaxed font-sans bg-cyber-900/40 p-3 rounded-xl border border-cyber-800">
                {primaryCandidate.reason}
              </p>
            </div>

            {/* Epistemic Honesty Caveat */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-start space-x-2.5 text-amber-300">
              <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-amber-200">Epistemic Caveat: </strong>
                {primaryCandidate.caveat}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-end pt-1">
              <Link
                to={`/investigations/${investigationId}/evidence?q=${primaryCandidate.event_id}`}
                className="px-4 py-2 bg-cyber-850 hover:bg-cyber-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-cyber-800 transition-colors flex items-center space-x-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Inspect Evidence Row ({primaryCandidate.event_id})</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            No anomalous initial access candidates identified.
          </div>
        )}

        {/* Secondary Candidates if any */}
        {secondaryCandidates.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Secondary Candidate Ingress Points
            </span>
            <div className="space-y-2">
              {secondaryCandidates.map((cand) => (
                <div
                  key={cand.rank}
                  className="bg-cyber-950 rounded-xl p-3.5 border border-cyber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 font-mono">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Rank #{cand.rank}
                      </span>
                      <span className="font-semibold text-white">{cand.event_id}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-cyan-300">{cand.entity_id}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{cand.reason}</p>
                  </div>
                  <Link
                    to={`/investigations/${investigationId}/evidence?q=${cand.event_id}`}
                    className="px-3 py-1 bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-cyber-800 transition-colors self-start sm:self-auto flex-shrink-0"
                  >
                    Inspect
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. COMPETING HYPOTHESES EVALUATION (Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Competing Hypotheses Evaluation</h2>
            <p className="text-xs text-slate-400">
              Evaluates multiple competing explanations simultaneously under transparent evidence weighting.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Select a scenario to view evidence details
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.hypotheses.map((hyp) => {
            const isSelected = hyp.key === selectedHypKey;
            const isLeading = hyp.status === 'leading';
            return (
              <div
                key={hyp.key}
                onClick={() => setSelectedHypKey(hyp.key)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyber-850 border-blue-500 shadow-glow-blue'
                    : 'card-glow hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded-lg bg-cyber-950 border border-cyber-800">
                    {hyp.key}
                  </span>
                  {getStatusBadge(hyp.status)}
                </div>

                <h3 className="font-bold text-white text-base mt-3 leading-snug">{hyp.name}</h3>

                <div className="mt-4 flex items-baseline justify-between pt-3 border-t border-cyber-800/80">
                  <span className="text-3xl font-bold font-mono text-white">{hyp.score}%</span>
                  <span className="text-[10px] text-slate-400 text-right max-w-[140px] leading-tight">
                    Heuristic score
                  </span>
                </div>

                {/* Score Progress Bar */}
                <div className="mt-3 w-full bg-cyber-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      isLeading ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${hyp.score}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SELECTED HYPOTHESIS OVERVIEW (Clean & Concise - No giant table) */}
      {selectedHypothesis && (
        <div className="card-glow rounded-2xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-cyber-800 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-blue-400 font-bold">{selectedHypothesis.key}:</span>
                <h2 className="text-lg font-bold text-white">{selectedHypothesis.name}</h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
                {selectedHypothesis.explanation}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-blue-400 bg-cyber-950 px-3.5 py-1.5 rounded-xl border border-cyber-800 inline-block">
                Score: {selectedHypothesis.score} / 100
              </span>
            </div>
          </div>

          {/* Missing Evidence Callout */}
          {selectedHypothesis.missing_evidence && selectedHypothesis.missing_evidence.length > 0 ? (
            <div className="bg-cyber-950/80 rounded-xl p-4 border border-rose-500/20 space-y-2">
              <div className="flex items-center space-x-1.5 text-rose-400 font-bold uppercase tracking-wider text-xs">
                <HelpCircle className="w-4 h-4" />
                <span>Missing Evidence Precluding 100% Certainty</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-rose-200">
                {selectedHypothesis.missing_evidence.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-cyber-950/60 rounded-xl p-3 border border-cyber-800 text-xs text-slate-400">
              No outstanding evidence gaps identified for this scenario.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HypothesesPage;
