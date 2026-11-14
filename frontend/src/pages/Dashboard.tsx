import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import cytoscape, { Core } from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import {
  FileText,
  Users,
  AlertTriangle,
  Share2,
  Shield,
  Play,
  Clock,
  Lightbulb,
  Info,
  Maximize2,
  Plus,
  ArrowRight,
  CheckCircle2,
  Globe,
  Laptop,
  User as UserIcon,
  Server,
  ChevronRight,
  FileCode,
  Target,
} from 'lucide-react';
import { api } from '../api/client';
import {
  DashboardSummary,
  Investigation,
  GraphResponse,
  HypothesesOverviewResponse,
  TimelineResponse,
  EdgeDetail,
} from '../types';
import { EdgeEvidencePanel } from '../components/EdgeEvidencePanel';
import { formatNodeLabel, formatEdgeLabel, extractIncidentChain } from '../utils/graphVisuals';

// Register dagre layout
try {
  cytoscape.use(dagre);
} catch {
  // Already registered
}

export const Dashboard: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [activeCase, setActiveCase] = useState<Investigation | null>(null);

  // Active case telemetry & forensics data
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [hypothesesData, setHypothesesData] = useState<HypothesesOverviewResponse | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [graphViewMode, setGraphViewMode] = useState<'overview' | 'focus' | 'explore'>('overview');

  // Edge inspection panel state
  const [selectedEdgeDetail, setSelectedEdgeDetail] = useState<EdgeDetail | null>(null);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // New case modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSynthetic, setIsSynthetic] = useState(true);
  const [creating, setCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Load initial data
  useEffect(() => {
    loadGlobalData();
  }, [paramId]);

  const loadGlobalData = async () => {
    try {
      const [sum, list] = await Promise.all([
        api.getDashboard(),
        api.listInvestigations(),
      ]);
      setSummary(sum);
      setInvestigations(list);

      // Determine active case
      let target: Investigation | null = null;
      if (paramId) {
        target = list.find((i) => i.id === paramId) || null;
      }
      if (!target && list.length > 0) {
        target = list[0];
      }
      setActiveCase(target);
      if (target) {
        localStorage.setItem('activeInvestigationId', target.id);
        await loadCaseDetails(target.id, target.status);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  const loadCaseDetails = async (caseId: string, caseStatus?: Investigation['status']) => {
    // Clear stale data immediately
    setGraphData(null);
    setHypothesesData(null);
    setTimelineData(null);
    try {
      const status = caseStatus ?? (await api.getInvestigation(caseId)).status;
      if (status !== 'analyzed') {
        setTimelineData(await api.getTimeline(caseId));
        return;
      }

      const [graph, hyp, timeline] = await Promise.all([
        api.getGraph(caseId), api.getHypotheses(caseId), api.getTimeline(caseId),
      ]);
      setGraphData(graph);
      setHypothesesData(hyp);
      setTimelineData(timeline);
    } catch (err) {
      console.error('Failed to load case forensics', err);
    }
  };

  const handleRunAnalysis = async () => {
    if (!activeCase) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await api.triggerAnalysis(activeCase.id);
      const analyzedCase = { ...activeCase, status: 'analyzed' as const, analyzed_at: result.analyzed_at };
      setActiveCase(analyzedCase);
      setInvestigations((current) => current.map((item) => item.id === analyzedCase.id ? analyzedCase : item));
      await loadCaseDetails(activeCase.id, 'analyzed');
      const sum = await api.getDashboard();
      setSummary(sum);
    } catch (err: any) {
      setAnalysisError(err.response?.data?.detail || err.message || 'Analysis failed. Check the backend logs.');
      console.error('Failed to run analysis', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await api.createInvestigation({
        name: newTitle.trim(),
        description: newDesc.trim() || undefined,
        is_synthetic: isSynthetic,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      await loadGlobalData();
      setActiveCase(created);
    } catch (err) {
      console.error('Failed to create case', err);
    } finally {
      setCreating(false);
    }
  };

  // Cytoscape initialization matching the aesthetic
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Filter nodes/edges based on graphViewMode
    let targetNodes = graphData.nodes;
    let targetEdges = graphData.edges;

    if (graphViewMode === 'overview') {
      const incident = extractIncidentChain(graphData.nodes, graphData.edges);
      targetNodes = incident.nodes;
      targetEdges = incident.edges;
    } else if (graphViewMode === 'focus') {
      // Direct 1-hop around alert or pivot node
      const alertNode = graphData.nodes.find((n) => {
        const id = n.data.id.toLowerCase();
        const lbl = (n.data.label || '').toLowerCase();
        return id.includes('privilege') || lbl.includes('privilege') || id.startsWith('event:');
      }) || graphData.nodes[0];

      if (alertNode) {
        const alertId = alertNode.data.id;
        const connectedEdgeTargets = new Set<string>([alertId]);
        graphData.edges.forEach((e) => {
          if (e.data.source === alertId) connectedEdgeTargets.add(e.data.target);
          if (e.data.target === alertId) connectedEdgeTargets.add(e.data.source);
        });
        targetNodes = graphData.nodes.filter((n) => connectedEdgeTargets.has(n.data.id));
        targetEdges = graphData.edges.filter(
          (e) => connectedEdgeTargets.has(e.data.source) && connectedEdgeTargets.has(e.data.target)
        );
      }
    }

    // Build elements with icons and friendly labels
    const elements: any[] = [];

    targetNodes.forEach((node) => {
      const formatted = formatNodeLabel(node.data.id, node.data.label);
      const isPrivilegeChange = formatted.type === 'alert';

      elements.push({
        data: {
          id: node.data.id,
          displayLabel: formatted.full,
          type: formatted.type,
          isAlert: isPrivilegeChange,
          icon: formatted.icon,
        },
      });
    });

    targetEdges.forEach((edge) => {
      const status = edge.data.status || 'observed';
      const cleanLabel = formatEdgeLabel(edge.data.label || '', edge.data.target);
      elements.push({
        data: {
          id: edge.data.id,
          source: edge.data.source,
          target: edge.data.target,
          label: cleanLabel,
          status: status,
        },
      });
    });

    const NODE_SIZE = 58;
    const ALERT_NODE_SIZE = 68;

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      boxSelectionEnabled: false,
      autounselectify: true,
      minZoom: 0.2,
      maxZoom: 4,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(displayLabel)',
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'color': '#f1f5f9',
            'font-size': '9.5px',
            'font-family': '"JetBrains Mono", monospace',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 10,
            'text-background-opacity': 0.85,
            'text-background-color': '#080b11',
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'background-color': '#0e172a',
            'border-width': 2.5,
            'border-color': '#3b82f6',
            'width': NODE_SIZE,
            'height': NODE_SIZE,
            'shape': 'ellipse',
            'background-image': 'data(icon)',
            'background-fit': 'contain',
            'background-clip': 'node',
            'background-width': '52%',
            'background-height': '52%',
            'background-position-x': '50%',
            'background-position-y': '50%',
          },
        },
        {
          selector: 'node[type = "user"]',
          style: { 'background-color': '#0c1a30', 'border-color': '#3b82f6' },
        },
        {
          selector: 'node[type = "device"]',
          style: { 'background-color': '#161228', 'border-color': '#8b5cf6' },
        },
        {
          selector: 'node[type = "service"], node[type = "database"]',
          style: { 'background-color': '#0a1d18', 'border-color': '#10b981' },
        },
        {
          selector: 'node[type = "suspicious"], node[type = "alert"]',
          style: {
            'background-color': '#280d12',
            'border-color': '#ef4444',
            'border-width': 3.5,
            'width': ALERT_NODE_SIZE,
            'height': ALERT_NODE_SIZE,
          },
        },
        {
          selector: 'node[type = "external"]',
          style: { 'background-color': '#280d12', 'border-color': '#f97316' },
        },
        // Central pivot workstation highlight (WS-207)
        {
          selector: 'node[id $= "ws-207"], node[id $= "WS-207"]',
          style: {
            'border-color': '#38bdf8',
            'border-width': 3.5,
            'background-color': '#0d2238',
            'width': 66,
            'height': 66,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.95,
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'label': 'data(label)',
            'font-size': '9px',
            'font-family': '"IBM Plex Sans", sans-serif',
            'font-weight': 500,
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.95,
            'text-background-color': '#080b11',
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
            'color': '#93c5fd',
          },
        },
        {
          selector: 'edge[status = "inferred"]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [8, 5],
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'color': '#94a3b8',
          },
        },
        {
          selector: 'edge[label *= "Privilege"], edge[status = "suspicious"]',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'color': '#fca5a5',
            'width': 2.2,
          },
        },
      ],
      layout: { name: 'null' } as any,
    });

    // Run Dagre layout — Left-to-Right directed flow matching incident reference mockup
    const layoutOptions: any = graphViewMode === 'focus'
      ? {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 80,
        rankSep: 110,
        padding: 40,
        animate: true,
        animationDuration: 300,
      }
      : {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 85,
        rankSep: 130,
        padding: 45,
        animate: true,
        animationDuration: 300,
      };

    cy.layout(layoutOptions).run();

    // Resize and refit when the embedded canvas changes size, not when its parent card changes.
    const canvas = containerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      if (!cy.destroyed()) {
        cy.resize();
        cy.fit(undefined, 40);
      }
    });
    if (canvas) resizeObserver.observe(canvas);

    const fitTimeout = window.setTimeout(() => {
      if (!cy.destroyed()) {
        cy.resize();
        cy.fit(undefined, 40);
      }
    }, 120);

    cy.on('tap', 'edge', async (evt) => {
      const edge = evt.target;
      const edgeId = edge.data('id');
      setSelectedEdgeId(edgeId);
      setEdgeLoading(true);
      try {
        if (activeCase) {
          const detail = await api.getEdgeDetail(activeCase.id, edgeId);
          setSelectedEdgeDetail(detail);
        }
      } catch (err) {
        console.error('Failed to load edge detail', err);
      } finally {
        setEdgeLoading(false);
      }
    });

    cyRef.current = cy;

    return () => {
      window.clearTimeout(fitTimeout);
      resizeObserver.disconnect();
      if (cyRef.current === cy) cyRef.current = null;
      cy.destroy();
    };
  }, [graphData, activeCase, graphViewMode]);

  const fitView = () => {
    cyRef.current?.resize();
    cyRef.current?.fit(undefined, 40);
  };

  const zoomIn = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  };

  const zoomOut = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  };

  // Leading hypothesis and suspicion score calculation — from real API data
  const leadingHypothesis = hypothesesData?.hypotheses?.find((h) => h.status === 'leading') || hypothesesData?.hypotheses?.[0];
  const suspicionScore = leadingHypothesis ? Math.round(leadingHypothesis.score) : null;
  const hasEvidence = (activeCase?.counts?.events ?? 0) > 0;

  // Timeline events — from real API data, mapped to icon+color
  const TIMELINE_TYPE_META: Record<string, { label: string; icon: typeof UserIcon; alert: boolean }> = {
    login: { label: 'User Login', icon: UserIcon, alert: false },
    authentication: { label: 'Auth Event', icon: UserIcon, alert: false },
    network: { label: 'Network Event', icon: Globe, alert: false },
    process: { label: 'Process Exec', icon: FileCode, alert: false },
    file_access: { label: 'File Access', icon: FileText, alert: false },
    service_access: { label: 'Service Access', icon: Server, alert: false },
    privilege_change: { label: 'Privilege Change', icon: Shield, alert: true },
    privilege_escalation: { label: 'Priv. Escalation', icon: Shield, alert: true },
    lateral_movement: { label: 'Lateral Movement', icon: Share2, alert: true },
    external_connection: { label: 'External Connect', icon: Globe, alert: false },
    new_device: { label: 'New Device', icon: Laptop, alert: false },
  };

  const realTimelineEvents = (timelineData?.events ?? []).slice(0, 7).map((ev) => {
    const type = ev.event_type?.toLowerCase().replace(/\s+/g, '_') || '';
    const meta = TIMELINE_TYPE_META[type] || { label: ev.event_type || 'Event', icon: FileText, alert: false };
    const isAlert = meta.alert || ev.flags?.includes('suspicious') || ev.primary_flag === 'suspicious';
    const timeStr = ev.event_time
      ? new Date(ev.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';
    return { time: timeStr, label: meta.label, icon: meta.icon, alert: isAlert };
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Top Breadcrumb & Case Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
            <Link to="/" className="hover:text-slate-200 transition-colors">Investigations</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-blue-400 font-mono">#{activeCase?.id || 'INV-2026-1147'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {investigations.length > 1 ? (
              <select
                aria-label="Select Active Case"
                value={activeCase?.id || ''}
                onChange={(e) => {
                  const sel = investigations.find((i) => i.id === e.target.value);
                  if (sel) {
                    setActiveCase(sel);
                    localStorage.setItem('activeInvestigationId', sel.id);
                    loadCaseDetails(sel.id, sel.status);
                  }
                }}
                className="text-2xl font-bold text-white tracking-tight font-sans bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg cursor-pointer pr-4"
              >
                {investigations.map((inv) => (
                  <option key={inv.id} value={inv.id} className="bg-cyber-900 text-white text-base">
                    {inv.name}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="text-2xl font-bold text-white tracking-tight font-sans">
                {activeCase?.name || 'INV-2026-1147'}
              </h1>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="capitalize">{activeCase?.status ? activeCase.status.replace('_', ' ') : 'Under Investigation'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {activeCase?.description || 'Suspicious account activity across multiple enterprise systems'}
          </p>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400 font-mono pr-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Created: {activeCase?.created_at ? new Date(activeCase.created_at).toLocaleDateString() : 'Nov 14, 2026'}</span>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={analyzing || !hasEvidence}
            title={!hasEvidence ? 'Upload at least one event before running analysis.' : undefined}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/25 flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Analyzing…' : hasEvidence ? 'Run Analysis' : 'Upload Evidence First'}</span>
          </button>
          {!hasEvidence && activeCase && (
            <Link
              to={`/investigations/${activeCase.id}/upload`}
              className="px-3 py-2 rounded-xl border border-cyber-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-cyber-850"
            >
              Upload Evidence
            </Link>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white rounded-xl border border-cyber-800 transition-colors"
            title="Create New Case"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {analysisError && (
          <p role="alert" className="text-xs text-rose-400 md:text-right">{analysisError}</p>
        )}
      </div>

      {/* Row of 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Events */}
        <div className="card-glow rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Events</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {activeCase?.counts?.events ?? summary?.total_events ?? 0}
            </div>
            <div className="text-xs text-slate-400 font-medium">Log records ingested</div>
          </div>
          {/* Mini Sparkline SVG */}
          <div className="mt-2 h-6 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 25" preserveAspectRatio="none">
              <path
                d="M0,20 Q20,15 40,18 T80,8 T100,5"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Entities */}
        <div className="card-glow rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entities</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {activeCase?.counts?.entities ?? summary?.total_entities ?? 0}
            </div>
            <div className="text-xs text-slate-400 font-medium">Distinct actors & assets</div>
          </div>
          {/* Mini Sparkline SVG */}
          <div className="mt-2 h-6 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 25" preserveAspectRatio="none">
              <path
                d="M0,22 Q25,18 50,14 T80,10 T100,4"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Evidence Gaps */}
        <div className="card-glow rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gaps</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {activeCase?.counts?.open_gaps ?? summary?.open_gaps ?? 0}
            </div>
            <div className="text-xs text-slate-400 font-medium">Open evidence gaps</div>
          </div>
          {/* Mini Sparkline SVG */}
          <div className="mt-2 h-6 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 25" preserveAspectRatio="none">
              <path
                d="M0,10 Q25,8 50,16 T80,12 T100,20"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Relationships */}
        <div className="card-glow rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Graph</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {graphData?.edges?.length ?? 0}
            </div>
            <div className="text-xs text-slate-400 font-medium">Relationships mapped</div>
          </div>
          {/* Mini Sparkline SVG */}
          <div className="mt-2 h-6 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 25" preserveAspectRatio="none">
              <path
                d="M0,18 Q30,12 60,10 T100,3"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 5: Suspicion Score */}
        <div className="card-glow rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Index</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {suspicionScore !== null ? suspicionScore : '—'} <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
            <div className="text-xs text-slate-400 font-medium">Suspicion Score</div>
          </div>
          {/* Progress Bar */}
          <div className="mt-3 w-full bg-cyber-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${suspicionScore !== null ? Math.min(100, suspicionScore) : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Attack Graph + Event Timeline */}
        <div className="lg:col-span-8 space-y-6">
          {/* Attack Graph Card */}
          <div className="card-glow rounded-2xl p-5 flex flex-col">
            {/* Graph Card Header matching the reference screenshot */}
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-cyber-800/80 z-10 gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Share2 className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white tracking-tight">Attack Graph</h2>
              </div>

              {/* Tools & Legend matching reference */}
              <div className="flex items-center space-x-3 text-xs">
                {/* Mode Selector */}
                <div className="flex items-center p-0.5 bg-cyber-950 rounded-xl border border-cyber-800 text-xs">
                  <button
                    onClick={() => setGraphViewMode('overview')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${graphViewMode === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setGraphViewMode('focus')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${graphViewMode === 'focus' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    Focus
                  </button>
                  <button
                    onClick={() => setGraphViewMode('explore')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${graphViewMode === 'explore' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    Explore
                  </button>
                </div>

                {/* Fit View Button */}
                <button
                  onClick={fitView}
                  className="px-3 py-1.5 rounded-xl bg-cyber-950 border border-cyber-800 text-slate-300 hover:text-white flex items-center space-x-1.5 transition-colors font-medium shadow-sm"
                >
                  <Target className="w-3.5 h-3.5 text-blue-400" />
                  <span>Fit View</span>
                </button>

                {/* Zoom Group */}
                <div className="flex items-center bg-cyber-950 rounded-xl border border-cyber-800 p-0.5">
                  <button
                    onClick={zoomOut}
                    className="px-2 py-1 text-slate-400 hover:text-white text-xs font-mono transition-colors"
                    title="Zoom Out"
                  >
                    - Zoom
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    onClick={zoomIn}
                    className="px-2 py-1 text-slate-400 hover:text-white text-xs font-mono transition-colors"
                    title="Zoom In"
                  >
                    Zoom +
                  </button>
                </div>

                {/* Legend dots */}
                <div className="hidden sm:flex items-center space-x-3.5 px-3 py-1.5 bg-cyber-950/80 rounded-xl border border-cyber-800 text-[11px] font-medium text-slate-300">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>User</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    <span>Device</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Service</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Suspicious</span>
                  </div>
                </div>

                <Link
                  to={`/investigations/${activeCase?.id || 'inv_synth_001'}/graph`}
                  className="p-1.5 rounded-xl bg-cyber-800 text-slate-400 hover:text-white transition-colors"
                  title="Expand to Fullscreen Graph"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Cytoscape Canvas / Empty State */}
            {(!graphData || graphData.nodes.length === 0) ? (
              <div className="flex flex-col items-center justify-center text-center p-8 space-y-3 min-h-[340px]">
                <div className="w-12 h-12 rounded-2xl bg-cyber-900 border border-cyber-800 flex items-center justify-center text-blue-400">
                  <Share2 className="w-6 h-6 text-slate-500" />
                </div>
                <div className="text-sm font-semibold text-slate-200">No Attack Graph Generated</div>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  This investigation has not been analyzed yet. Upload logs and click{' '}
                  <span className="text-blue-400 font-semibold font-mono">Run Analysis</span> to reconstruct the evidence-grounded attack graph.
                </p>
                <div className="flex items-center space-x-3 pt-2">
                  <Link
                    to={`/investigations/${activeCase?.id || ''}/upload`}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
                  >
                    Upload Evidence
                  </Link>
                  <button
                    onClick={handleRunAnalysis}
                    disabled={analyzing || !hasEvidence}
                    title={!hasEvidence ? 'Upload at least one event before running analysis.' : undefined}
                    className="px-3.5 py-1.5 rounded-xl bg-cyber-850 hover:bg-cyber-800 border border-cyber-800 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hasEvidence ? 'Run Analysis' : 'Upload evidence first'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                ref={containerRef}
                style={{ width: '100%', height: '360px', display: 'block' }}
              />
            )}
          </div>

          {/* Event Timeline Stepper Card */}
          <div className="card-glow rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cyber-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Clock className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white tracking-tight">Event Timeline</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">Last 24 Hours</span>
            </div>

            {/* Horizontal Timeline Sequence */}
            <div className="relative py-4">
              {realTimelineEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-xs font-mono space-y-1">
                  <Clock className="w-6 h-6 text-slate-600 mb-1" />
                  <span>No events yet — upload log files to populate the timeline.</span>
                </div>
              ) : (
                <>
                  {/* Connecting Horizontal Line */}
                  <div className="absolute top-1/2 left-8 right-8 -translate-y-2 h-0.5 bg-cyber-700"></div>
                  <div className="relative z-10 flex items-center justify-between">
                    {realTimelineEvents.map((evt, idx) => {
                      const Icon = evt.icon;
                      return (
                        <div key={idx} className="flex flex-col items-center group cursor-pointer">
                          <div className="text-[11px] font-mono text-slate-400 mb-2">{evt.time}</div>
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${evt.alert
                              ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400 shadow-glow-red scale-110'
                              : 'bg-cyber-850 border border-blue-500/40 text-blue-400 hover:border-blue-400'
                              }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div
                            className={`text-xs font-semibold mt-2.5 text-center ${evt.alert ? 'text-rose-300' : 'text-slate-300'
                              }`}
                          >
                            {evt.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Key Insights + Hypotheses + Recent Evidence */}
        <div className="lg:col-span-4 space-y-6">
          {/* Key Insights Card */}
          <div className="card-glow rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-cyber-800/80">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">Key Insights</h2>
            </div>

            <div className="space-y-2.5">
              {hypothesesData?.gaps && hypothesesData.gaps.length > 0 ? (
                hypothesesData.gaps.slice(0, 3).map((gap, idx) => {
                  const sevColor = gap.severity === 'high' ? 'rose' : gap.severity === 'medium' ? 'amber' : 'blue';
                  const SevIcon = gap.severity === 'high' ? AlertTriangle : gap.severity === 'medium' ? Clock : Info;
                  return (
                    <div key={idx} className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-start space-x-3">
                      <SevIcon className={`w-4 h-4 text-${sevColor}-400 flex-shrink-0 mt-0.5`} />
                      <div className="text-xs">
                        <div className="font-semibold text-slate-200">{gap.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{gap.description.slice(0, 80)}{gap.description.length > 80 ? '…' : ''}</div>
                      </div>
                    </div>
                  );
                })
              ) : graphData?.nodes && graphData.nodes.length > 0 ? (
                <>
                  {graphData.nodes.some(n => n.data.suspicious) && (
                    <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-start space-x-3">
                      <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <div className="font-semibold text-slate-200">Suspicious entity detected in graph</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{graphData.nodes.find(n => n.data.suspicious)?.data.id}</div>
                      </div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-start space-x-3">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-200">{graphData.nodes.length} entities mapped</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{graphData.edges.length} relationships observed</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-4 text-slate-500 text-xs font-mono space-y-1">
                  <Lightbulb className="w-5 h-5 text-slate-600 mb-1" />
                  <span>Upload evidence to surface insights.</span>
                </div>
              )}
            </div>
          </div>

          {/* Investigation Hypotheses Card */}
          <div className="card-glow rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-cyber-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                  <Shield className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white tracking-tight">Investigation Hypotheses</h2>
              </div>
              <Link
                to={`/investigations/${activeCase?.id}/hypotheses`}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-4">
              {hypothesesData?.hypotheses && hypothesesData.hypotheses.length > 0 ? (
                hypothesesData.hypotheses.slice(0, 3).map((h, idx) => {
                  const score = Math.round(h.score);
                  const isLeading = idx === 0;
                  const barColors = ['from-rose-500 to-orange-500', 'from-blue-600 to-cyan-500', 'from-purple-600 to-indigo-500'];
                  const dotColors = ['bg-rose-500', 'bg-blue-500', 'bg-purple-500'];
                  return (
                    <div key={h.id} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${dotColors[idx] || 'bg-slate-500'}`}></span>
                          <span className="font-semibold text-slate-200 truncate max-w-[130px]">{h.label}</span>
                          {isLeading && (
                            <span className="px-1.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Primary
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-slate-200 shrink-0">{score} / 100</span>
                      </div>
                      <div className="w-full bg-cyber-950 rounded-full h-2 overflow-hidden border border-cyber-800">
                        <div
                          className={`bg-gradient-to-r ${barColors[idx] || 'from-slate-600 to-slate-500'} h-2 rounded-full transition-all duration-700`}
                          style={{ width: `${Math.min(100, score)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center py-4 text-slate-500 text-xs font-mono space-y-1">
                  <Shield className="w-5 h-5 text-slate-600 mb-1" />
                  <span>Run analysis to generate hypotheses.</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Evidence Card */}
          <div className="card-glow rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-cyber-800/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <FileCode className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white tracking-tight">Recent Evidence</h2>
              </div>
              <Link
                to={`/investigations/${activeCase?.id}/evidence`}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {graphData?.nodes && graphData.nodes.length > 0 ? (
                graphData.nodes.slice(0, 3).map((node) => {
                  const id = node.data.id;
                  const ext = id.includes('csv') ? 'CSV' : id.includes('json') ? 'JSON' : 'LOG';
                  const color = ext === 'CSV' ? 'emerald' : ext === 'JSON' ? 'purple' : 'blue';
                  return (
                    <div key={id} className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
                          {ext}
                        </span>
                        <div className="text-xs">
                          <div className="font-semibold text-slate-200 font-mono truncate max-w-[140px]">{id}</div>
                          <div className="text-[11px] text-slate-400">Entity in graph</div>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center py-4 text-slate-500 text-xs font-mono space-y-1">
                  <FileCode className="w-5 h-5 text-slate-600 mb-1" />
                  <span>Upload evidence files to begin.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edge Evidence Drawer */}
      <EdgeEvidencePanel
        edge={selectedEdgeDetail}
        loading={edgeLoading && selectedEdgeId !== null}
        onClose={() => {
          setSelectedEdgeId(null);
          setSelectedEdgeDetail(null);
        }}
      />

      {/* New Case Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-cyber-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-900 border border-cyber-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Create New Investigation</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Case Name / Identifier</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Incident-2026-Bravo"
                  className="w-full bg-cyber-950 border border-cyber-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe incident trigger or target systems..."
                  className="w-full bg-cyber-950 border border-cyber-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="synth"
                  checked={isSynthetic}
                  onChange={(e) => setIsSynthetic(e.target.checked)}
                  className="rounded bg-cyber-950 border-cyber-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="synth" className="text-slate-300">
                  Tag as synthetic benchmark case
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-md shadow-blue-500/20"
                >
                  {creating ? 'Creating…' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
