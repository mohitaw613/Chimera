import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import cytoscape, { Core } from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Target,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import { EdgeDetail, GraphResponse, Investigation } from '../types';
import { EdgeEvidencePanel } from '../components/EdgeEvidencePanel';
import { formatNodeLabel, formatEdgeLabel, extractIncidentChain } from '../utils/graphVisuals';

// Register dagre layout
try {
  cytoscape.use(dagre);
} catch {
  // Already registered
}

export const GraphPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [analysisRequired, setAnalysisRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edgeDetail, setEdgeDetail] = useState<EdgeDetail | null>(null);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'observed' | 'inferred' | 'suspicious'>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'focus' | 'explore'>('overview');

  useEffect(() => {
    loadGraph();
  }, [investigationId]);

  const loadGraph = async () => {
    setAnalysisRequired(false);
    setLoadError(null);
    try {
      const list = await api.listInvestigations();
      setInvestigations(list);

      let targetId = investigationId;
      // If no valid ID is present or if it's the dummy placeholder, pick the active or first analyzed case
      if (!targetId || targetId === 'inv_synth_001' || !list.some((i) => i.id === targetId)) {
        const stored = localStorage.getItem('activeInvestigationId');
        if (stored && list.some((i) => i.id === stored)) {
          targetId = stored;
        } else if (list.length > 0) {
          const analyzed = list.find((i) => i.status === 'analyzed') || list[0];
          targetId = analyzed.id;
        }
      }

      if (targetId && targetId !== investigationId) {
        navigate(`/investigations/${targetId}/graph`, { replace: true });
        return;
      }

      if (targetId) {
        const selectedInvestigation = list.find((item) => item.id === targetId);
        if (selectedInvestigation?.status !== 'analyzed') {
          setGraphData(null);
          setAnalysisRequired(true);
          return;
        }
        const data = await api.getGraph(targetId);
        setGraphData(data);
      }
    } catch (err: any) {
      setLoadError(err.response?.data?.detail || err.message || 'Could not load attack graph.');
      console.error('Failed to load attack graph', err);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !graphData || graphData.nodes.length === 0) return;

    let targetNodes = graphData.nodes;
    let targetEdges = graphData.edges;

    if (viewMode === 'overview') {
      const incident = extractIncidentChain(graphData.nodes, graphData.edges);
      targetNodes = incident.nodes;
      targetEdges = incident.edges;
    } else if (viewMode === 'focus') {
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

    const elements: any[] = [];

    // Filter nodes/edges if filter is active
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
      if (activeFilter === 'observed' && status !== 'observed') return;
      if (activeFilter === 'inferred' && status !== 'inferred') return;
      if (activeFilter === 'suspicious' && status === 'observed') return;

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
    const ALERT_NODE_SIZE = 74;

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
            'color': '#cbd5e1',
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
          selector: 'node:selected',
          style: { 'border-width': 4, 'border-color': '#38bdf8', 'background-color': '#0d2040' },
        },
        {
          selector: 'node.dimmed',
          style: { 'opacity': 0.25 },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.8,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.9,
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'label': 'data(label)',
            'font-size': '9px',
            'font-family': '"IBM Plex Sans", sans-serif',
            'font-weight': 500,
            'text-rotation': 'autorotate',
            'text-background-opacity': 1,
            'text-background-color': '#080b11',
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
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
          selector: 'edge[label *= "Privilege"], edge[status = "needs_verification"], edge[status = "suspicious"]',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'color': '#fca5a5',
            'width': 2.2,
          },
        },
        {
          selector: 'edge:selected',
          style: { 'width': 3, 'line-color': '#38bdf8', 'target-arrow-color': '#38bdf8' },
        },
        {
          selector: 'edge.dimmed',
          style: { 'opacity': 0.1 },
        },
      ],
      layout: { name: 'null' } as any,
    });

    // ── Choose layout ────────────────────────────────────────────────────────
    const layoutOptions: any = viewMode === 'focus'
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

    // After layout runs, force resize + fit so the container dimensions are settled
    setTimeout(() => {
      cy.resize();
      cy.fit(undefined, 50);
    }, 150);

    cy.on('tap', 'edge', async (evt) => {
      const edge = evt.target;
      const edgeId = edge.data('id');
      setSelectedEdgeId(edgeId);
      setEdgeLoading(true);
      try {
        const detail = await api.getEdgeDetail(investigationId!, edgeId);
        setEdgeDetail(detail);
      } catch (err) {
        console.error('Failed to load edge detail', err);
      } finally {
        setEdgeLoading(false);
      }
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedNodeId(node.data('id'));
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNodeId(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData, activeFilter, viewMode]);

  const fitView = () => {
    cyRef.current?.resize();
    cyRef.current?.fit(undefined, 50);
  };

  const zoomIn = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  };

  const zoomOut = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  };

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col">
      {/* Floating Controls Header */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        {investigations.length > 1 && (
          <select
            aria-label="Select Investigation"
            value={investigationId || ''}
            onChange={(e) => navigate(`/investigations/${e.target.value}/graph`)}
            className="text-xs font-semibold text-white bg-cyber-950/90 border border-cyber-800 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer backdrop-blur shadow-lg"
          >
            {investigations.map((inv) => (
              <option key={inv.id} value={inv.id} className="bg-cyber-900 text-white">
                {inv.name} ({inv.status})
              </option>
            ))}
          </select>
        )}

        {/* View Mode Pills (Overview, Focus, Explore) */}
        <div className="flex items-center p-1 bg-cyber-950/90 backdrop-blur rounded-xl border border-cyber-800 text-xs shadow-lg">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              viewMode === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setViewMode('focus')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              viewMode === 'focus' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Focus
          </button>
          <button
            onClick={() => setViewMode('explore')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              viewMode === 'explore' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Explore
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center p-1 bg-cyber-950/90 backdrop-blur rounded-xl border border-cyber-800 text-xs shadow-lg">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Edges
          </button>
          <button
            onClick={() => setActiveFilter('observed')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeFilter === 'observed' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Observed
          </button>
          <button
            onClick={() => setActiveFilter('inferred')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeFilter === 'inferred' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Inferred
          </button>
          <button
            onClick={() => setActiveFilter('suspicious')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeFilter === 'suspicious' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Suspicious
          </button>
        </div>
      </div>

      {/* Floating Zoom & Fit Tools */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-cyber-950/90 border border-cyber-800 p-1 rounded-xl backdrop-blur shadow-lg">
        <button
          onClick={zoomIn}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cyber-850 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cyber-850 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={fitView}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cyber-850 transition-colors"
          aria-label="Fit to screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={loadGraph}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cyber-850 transition-colors"
          aria-label="Reload graph"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Node Action Card */}
      {selectedNodeId && (
        <div className="absolute bottom-6 left-6 z-20 bg-cyber-950/95 border border-blue-500/40 p-4 rounded-2xl shadow-2xl max-w-sm backdrop-blur space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Selected Entity</span>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="font-mono text-sm font-semibold text-white truncate">{selectedNodeId}</div>
          <div className="pt-2 flex justify-end">
            <Link
              to={`/investigations/${investigationId}/blast-radius?start=${selectedNodeId}`}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Blast Radius</span>
            </Link>
          </div>
        </div>
      )}

      {/* Status Legend */}
      <div className="absolute bottom-4 right-4 z-20 bg-cyber-950/90 border border-cyber-800 p-3 rounded-xl backdrop-blur text-xs space-y-2 shadow-lg pointer-events-none">
        <div className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Epistemic Status</div>
        <div className="flex items-center space-x-2">
          <span className="w-6 h-0.5 bg-blue-500 rounded-full inline-block"></span>
          <span className="text-slate-300 font-mono text-[11px]">Observed (Direct)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-6 border-b border-dashed border-sky-400 inline-block"></span>
          <span className="text-sky-400 font-mono text-[11px]">Inferred (Proximity)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-6 border-b border-dashed border-rose-500 inline-block"></span>
          <span className="text-rose-400 font-mono text-[11px]">Suspicious (Unverified)</span>
        </div>
      </div>

      {/* Cytoscape Container / Empty State */}
      <div className="relative flex-1 w-full h-full radar-grid">
        {(!graphData || graphData.nodes.length === 0) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-3 z-10">
            <div className="w-12 h-12 rounded-2xl bg-cyber-900 border border-cyber-800 flex items-center justify-center text-blue-400">
              <Target className="w-6 h-6 text-slate-500" />
            </div>
            <div className="text-sm font-semibold text-slate-200">No Attack Graph Generated</div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              {loadError || (analysisRequired
                ? 'This investigation is not analyzed yet, or new evidence has made its analysis stale. Run analysis from the investigation dashboard first.'
                : 'No graph entities were produced by the completed analysis.')}
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <Link
                to={`/investigations/${investigationId}/upload`}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
              >
                Upload Evidence
              </Link>
              <Link
                to={`/investigations/${investigationId}`}
                className="px-3.5 py-1.5 rounded-xl bg-cyber-850 hover:bg-cyber-800 border border-cyber-800 text-slate-300 text-xs font-semibold transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full absolute inset-0" />
        )}
      </div>

      {/* Edge Evidence Panel Drawer */}
      <EdgeEvidencePanel
        edge={edgeDetail}
        loading={edgeLoading && selectedEdgeId !== null}
        onClose={() => {
          setSelectedEdgeId(null);
          setEdgeDetail(null);
        }}
      />
    </div>
  );
};
