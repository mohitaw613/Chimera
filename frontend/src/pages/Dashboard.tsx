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
import { formatNodeLabel, formatEdgeLabel } from '../utils/graphVisuals';

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
  const [_timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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
        await loadCaseDetails(target.id);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  const loadCaseDetails = async (caseId: string) => {
    try {
      const [graph, hyp, timeline] = await Promise.all([
        api.getGraph(caseId),
        api.getHypotheses(caseId),
        api.getTimeline(caseId),
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
    try {
      await api.triggerAnalysis(activeCase.id);
      await loadCaseDetails(activeCase.id);
      const sum = await api.getDashboard();
      setSummary(sum);
    } catch (err) {
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

    if (graphViewMode === 'overview' || graphViewMode === 'focus') {
      // Find the key alert node (e.g. privilege change or first alert)
      const alertNode = graphData.nodes.find((n) => {
        const id = n.data.id.toLowerCase();
        const lbl = (n.data.label || '').toLowerCase();
        return id.includes('privilege') || lbl.includes('privilege') || id.startsWith('event:');
      }) || graphData.nodes[0];

      if (alertNode) {
        // Collect incident chain: neighbors of alert node + connected user & external IP
        const alertId = alertNode.data.id;
        const connectedEdgeTargets = new Set<string>();
        connectedEdgeTargets.add(alertId);

        graphData.edges.forEach((e) => {
          if (e.data.source === alertId) connectedEdgeTargets.add(e.data.target);
          if (e.data.target === alertId) connectedEdgeTargets.add(e.data.source);
        });

        if (graphViewMode === 'overview') {
          // In overview, include 2nd hop to reach User -> Workstation -> Service
          const secondHop = new Set<string>(connectedEdgeTargets);
          graphData.edges.forEach((e) => {
            if (connectedEdgeTargets.has(e.data.source)) secondHop.add(e.data.target);
            if (connectedEdgeTargets.has(e.data.target)) secondHop.add(e.data.source);
          });
          // Limit to max 7-8 primary nodes so it stays clear and intuitive
          const primaryIds = Array.from(secondHop).slice(0, 8);
          const primarySet = new Set(primaryIds);
          targetNodes = graphData.nodes.filter((n) => primarySet.has(n.data.id));
          targetEdges = graphData.edges.filter((e) => primarySet.has(e.data.source) && primarySet.has(e.data.target));
        } else {
          // Focus mode: just direct 1-hop
          targetNodes = graphData.nodes.filter((n) => connectedEdgeTargets.has(n.data.id));
          targetEdges = graphData.edges.filter((e) => connectedEdgeTargets.has(e.data.source) && connectedEdgeTargets.has(e.data.target));
        }
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

    const NODE_SIZE = 64;
    const ALERT_NODE_SIZE = 72;

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      boxSelectionEnabled: false,
      autounselectify: true,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(displayLabel)',
            'text-wrap': 'wrap',
            'text-max-width': '95px',
            'color': '#cbd5e1',
            'font-size': '9px',
            'font-family': '"JetBrains Mono", monospace',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 10,
            'background-color': '#0e172a',
            'border-width': 2.5,
            'border-color': '#3b82f6',
            'width': NODE_SIZE,
            'height': NODE_SIZE,
            'shape': 'ellipse',
            // Icon stays strictly inside circle at 55% of diameter
            'background-image': 'data(icon)',
            'background-fit': 'contain',
            'background-clip': 'node',
            'background-width': '55%',
            'background-height': '55%',
            'background-position-x': '50%',
            'background-position-y': '50%',
            'opacity': 0,
          },
        },
        {
          selector: 'node[type = "user"]',
          style: {
            'background-color': '#0c1a30',
            'border-color': '#3b82f6',
          },
        },
        {
          selector: 'node[type = "device"]',
          style: {
            'background-color': '#161228',
            'border-color': '#8b5cf6',
          },
        },
        {
          selector: 'node[type = "service"], node[type = "database"]',
          style: {
            'background-color': '#0a1d18',
            'border-color': '#10b981',
          },
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
          style: {
            'background-color': '#280d12',
            'border-color': '#f97316',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.8,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.9,
            'line-color': '#334155',
            'target-arrow-color': '#334155',
            'label': 'data(label)',
            'font-size': '9px',
            'font-family': '"IBM Plex Sans", sans-serif',
            'font-weight': 500,
            'text-rotation': 'autorotate',
            'text-background-opacity': 1,
            'text-background-color': '#080b11',
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
            'color': '#64748b',
            'opacity': 0,
          },
        },
        {
          selector: 'edge[status = "observed"]',
          style: {
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'color': '#7dd3fc',
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

    // Choose layout per view mode
    const layoutOptions: any = graphViewMode === 'overview'
      ? {
          name: 'concentric',
          concentric: (node: any) => {
            if (node.data('isAlert')) return 10;
            if (node.data('type') === 'user') return 7;
            if (node.data('type') === 'device') return 5;
            return 3;
          },
          levelWidth: () => 2,
          minNodeSpacing: 100,
          startAngle: Math.PI / 4,
          clockwise: true,
          equidistant: false,
          padding: 55,
          animate: false,
        }
      : {
          name: 'dagre',
          rankDir: 'LR',
          nodeSep: 100,
          rankSep: 140,
          padding: 55,
          animate: false,
        };

    const layout = cy.layout(layoutOptions);

    // Staggered fade-in after layout positions nodes
    layout.one('layoutstop', () => {
      cy.fit(undefined, 45);
      cy.nodes().forEach((node, i) => {
        setTimeout(() => {
          node.animate(
            { style: { opacity: 1 } },
            { duration: 200, easing: 'ease-in-out-cubic' as any }
          );
        }, i * 45);
      });
      setTimeout(() => {
        cy.edges().animate(
          { style: { opacity: 1 } },
          { duration: 280, easing: 'ease-in-out-cubic' as any }
        );
      }, cy.nodes().length * 45 + 50);
    });

    layout.run();

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
      cy.destroy();
    };
  }, [graphData, activeCase, graphViewMode]);

  const fitView = () => {
    cyRef.current?.fit(undefined, 35);
  };

  const zoomIn = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  };

  const zoomOut = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  };

  // Leading hypothesis and suspicion score calculation
  const leadingHypothesis = hypothesesData?.hypotheses?.find((h) => h.status === 'leading') || hypothesesData?.hypotheses?.[0];
  const suspicionScore = leadingHypothesis ? leadingHypothesis.score : 72;

  // Key events for the horizontal stepper
  const sampleTimelineEvents = [
    { time: '10:12 AM', label: 'User Login', icon: UserIcon, alert: false },
    { time: '10:18 AM', label: 'New Device', icon: Laptop, alert: false },
    { time: '10:24 AM', label: 'Service Access', icon: Server, alert: false },
    { time: '10:32 AM', label: 'Privilege Change', icon: Shield, alert: true },
    { time: '10:36 AM', label: 'External Connect', icon: Globe, alert: false },
  ];

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
                    loadCaseDetails(sel.id);
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
            disabled={analyzing}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/25 flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Analyzing…' : 'Run Analysis'}</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white rounded-xl border border-cyber-800 transition-colors"
            title="Create New Case"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row of 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Events */}
        <div className="card-glow rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              ↑ +12%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {activeCase?.counts?.events || summary?.total_events || 248}
            </div>
            <div className="text-xs text-slate-400 font-medium">Events</div>
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              ↑ +8%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {activeCase?.counts?.entities || summary?.total_entities || 34}
            </div>
            <div className="text-xs text-slate-400 font-medium">Entities</div>
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
              ↓ -1
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {activeCase?.counts?.open_gaps ?? summary?.open_gaps ?? 6}
            </div>
            <div className="text-xs text-slate-400 font-medium">Evidence Gaps</div>
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              ↑ +20%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white font-sans tracking-tight">
              {graphData?.edges?.length || 12}
            </div>
            <div className="text-xs text-slate-400 font-medium">Relationships</div>
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
              {suspicionScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
            </div>
            <div className="text-xs text-slate-400 font-medium">Suspicion Score</div>
          </div>
          {/* Progress Bar */}
          <div className="mt-3 w-full bg-cyber-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, suspicionScore)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Attack Graph + Event Timeline */}
        <div className="lg:col-span-8 space-y-6">
          {/* Attack Graph Card */}
          <div className="card-glow rounded-2xl p-5 relative overflow-hidden flex flex-col h-[460px]">
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
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      graphViewMode === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setGraphViewMode('focus')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      graphViewMode === 'focus' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Focus
                  </button>
                  <button
                    onClick={() => setGraphViewMode('explore')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      graphViewMode === 'explore' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
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

            {/* Cytoscape Radar Canvas */}
            <div className="relative flex-1 w-full h-full radar-grid overflow-hidden">
              <div ref={containerRef} className="w-full h-full absolute inset-0" />
            </div>
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
              {/* Connecting Horizontal Line */}
              <div className="absolute top-1/2 left-8 right-8 -translate-y-2 h-0.5 bg-cyber-700"></div>

              <div className="relative z-10 flex items-center justify-between">
                {sampleTimelineEvents.map((evt, idx) => {
                  const Icon = evt.icon;
                  return (
                    <div key={idx} className="flex flex-col items-center group cursor-pointer">
                      <div className="text-[11px] font-mono text-slate-400 mb-2">{evt.time}</div>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          evt.alert
                            ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400 shadow-glow-red scale-110'
                            : 'bg-cyber-850 border border-blue-500/40 text-blue-400 hover:border-blue-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div
                        className={`text-xs font-semibold mt-2.5 text-center ${
                          evt.alert ? 'text-rose-300' : 'text-slate-300'
                        }`}
                      >
                        {evt.label}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-slate-200">Unusual login pattern detected</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">2:17 AM – 4:32 AM UTC</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-start space-x-3">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-slate-200">Privilege escalation observed</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Within 12 min of interactive session</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-start space-x-3">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold text-slate-200">External connection detected</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Egress to 203.0.113.45</div>
                </div>
              </div>
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
                to={`/investigations/${activeCase?.id || 'inv_synth_001'}/hypotheses`}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-4">
              {/* Hypothesis 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="font-semibold text-slate-200">Unauthorized Activity</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Primary
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-200">72 / 100</span>
                </div>
                <div className="w-full bg-cyber-950 rounded-full h-2 overflow-hidden border border-cyber-800">
                  <div className="bg-gradient-to-r from-rose-500 to-orange-500 h-2 rounded-full w-[72%]"></div>
                </div>
              </div>

              {/* Hypothesis 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-semibold text-slate-200">Legitimate Maintenance</span>
                  </div>
                  <span className="font-mono font-bold text-slate-400">38 / 100</span>
                </div>
                <div className="w-full bg-cyber-950 rounded-full h-2 overflow-hidden border border-cyber-800">
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-500 h-2 rounded-full w-[38%]"></div>
                </div>
              </div>
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
                to={`/investigations/${activeCase?.id || 'inv_synth_001'}/evidence`}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    CSV
                  </span>
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">auth_logs.csv</div>
                    <div className="text-[11px] text-slate-400">2.4 MB • Uploaded recently</div>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl bg-cyber-950/60 border border-cyber-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    JSON
                  </span>
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200">system_events.json</div>
                    <div className="text-[11px] text-slate-400">1.1 MB • Uploaded recently</div>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
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
