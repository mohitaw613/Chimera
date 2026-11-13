import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import cytoscape, { Core } from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import {
  GitFork,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldAlert,
  Target,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import { EdgeDetail, GraphResponse } from '../types';
import { EdgeEvidencePanel } from '../components/EdgeEvidencePanel';

// Register dagre layout extension
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

  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [edgeDetail, setEdgeDetail] = useState<EdgeDetail | null>(null);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    loadGraph();
  }, [investigationId]);

  const loadGraph = async () => {
    if (!investigationId) return;
    try {
      const data = await api.getGraph(investigationId);
      setGraphData(data);
    } catch (err) {
      console.error('Failed to load attack graph', err);
    }
  };

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements: any[] = [
      ...graphData.nodes.map((n) => ({
        group: 'nodes',
        data: n.data,
      })),
      ...graphData.edges.map((e) => ({
        group: 'edges',
        data: e.data,
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#f8fafc',
            'font-size': '11px',
            'font-family': 'monospace',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'background-color': '#1e293b',
            'border-width': 2,
            'border-color': '#475569',
            width: 38,
            height: 38,
          },
        },
        // Node Type Styles
        {
          selector: 'node[type = "USER"]',
          style: {
            'background-color': '#0891b2',
            'border-color': '#06b6d4',
            shape: 'round-rectangle',
          },
        },
        {
          selector: 'node[type = "DEVICE"]',
          style: {
            'background-color': '#2563eb',
            'border-color': '#3b82f6',
            shape: 'round-rectangle',
          },
        },
        {
          selector: 'node[type = "SERVICE"]',
          style: {
            'background-color': '#059669',
            'border-color': '#10b981',
            shape: 'round-rectangle',
          },
        },
        {
          selector: 'node[type = "EXTERNAL"]',
          style: {
            'background-color': '#7c3aed',
            'border-color': '#a855f7',
            shape: 'hexagon',
            width: 44,
            height: 44,
          },
        },
        {
          selector: 'node[type = "EVENT"]',
          style: {
            'background-color': '#d97706',
            'border-color': '#f59e0b',
            shape: 'ellipse',
            width: 32,
            height: 32,
          },
        },
        // Suspicious node outer ring
        {
          selector: 'node[?suspicious]',
          style: {
            'border-color': '#f43f5e',
            'border-width': 4,
          },
        },
        // Edge Base Style
        {
          selector: 'edge',
          style: {
            width: 2.5,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
            label: 'data(label)',
            'font-size': '9px',
            'font-family': 'monospace',
            color: '#94a3b8',
            'text-background-color': '#0f172a',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px',
            'text-rotation': 'autorotate',
          },
        },
        // Epistemic Edge Styles
        {
          selector: 'edge[status = "observed"]',
          style: {
            'line-color': '#10b981',
            'target-arrow-color': '#10b981',
            'line-style': 'solid',
          },
        },
        {
          selector: 'edge[status = "inferred"]',
          style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'line-style': 'dashed',
            'line-dash-pattern': [6, 4],
          },
        },
        {
          selector: 'edge[status = "needs_verification"]',
          style: {
            'line-color': '#f43f5e',
            'target-arrow-color': '#f43f5e',
            'line-style': 'dotted',
            'line-dash-pattern': [3, 4],
            width: 3,
          },
        },
        // Selection state
        {
          selector: ':selected',
          style: {
            'border-color': '#38bdf8',
            'border-width': 4,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
          },
        },
      ],
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 60,
        rankSep: 90,
        animate: true,
        animationDuration: 500,
      } as any,
    });

    // Centerpiece interaction: Click edge -> open EdgeEvidencePanel
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
  }, [graphData]);

  const fitView = () => {
    cyRef.current?.fit(undefined, 40);
  };

  const zoomIn = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  };

  const zoomOut = () => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Dynamic Header & Findings Banner */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono uppercase tracking-wider mb-1">
              <GitFork className="w-3.5 h-3.5" />
              <span>Stage 3: Evidence-Backed Attack Graph Reconstruction</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Attack Graph & Provenance</h1>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/hypotheses`}
              className="px-3.5 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 text-xs font-medium border border-cyber-700 transition-colors"
            >
              Hypotheses & Gaps
            </Link>
            <Link
              to={`/investigations/${investigationId}/blast-radius`}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all flex items-center space-x-1.5"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Blast Radius</span>
            </Link>
          </div>
        </div>

        {/* Epistemic Finding Callout */}
        {graphData?.finding && (
          <div className="mt-4 p-3 rounded-lg bg-cyber-950 border border-cyber-800 flex items-start space-x-3 text-xs text-slate-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-white">Investigation Finding: </span>
              {graphData.finding.text}
            </div>
          </div>
        )}
      </div>

      {/* Main Graph Canvas Area */}
      <div className="flex-1 bg-cyber-900 border border-cyber-800 rounded-xl relative overflow-hidden flex flex-col shadow-2xl">
        {/* Floating Canvas Controls */}
        <div className="absolute top-4 right-4 z-20 flex items-center space-x-2 bg-cyber-950/90 border border-cyber-700 p-1 rounded-lg backdrop-blur shadow-lg">
          <button
            onClick={zoomIn}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-cyber-800 transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-cyber-800 transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitView}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-cyber-800 transition-colors"
            aria-label="Fit to screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={loadGraph}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-cyber-800 transition-colors"
            aria-label="Reload graph"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Node Action Card */}
        {selectedNodeId && (
          <div className="absolute bottom-6 left-6 z-20 bg-cyber-950/95 border border-cyan-500/40 p-4 rounded-xl shadow-2xl max-w-sm backdrop-blur space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Selected Entity</span>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="font-mono text-sm font-semibold text-white truncate">{selectedNodeId}</div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => navigate(`/investigations/${investigationId}/blast-radius?start=${selectedNodeId}`)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium flex items-center space-x-1"
              >
                <Target className="w-3.5 h-3.5" />
                <span>Calculate Blast Radius</span>
              </button>
            </div>
          </div>
        )}

        {/* Epistemic Legend */}
        <div className="absolute bottom-4 right-4 z-20 bg-cyber-950/90 border border-cyber-700 p-3 rounded-xl backdrop-blur text-xs space-y-2 shadow-lg">
          <div className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Epistemic Status</div>
          <div className="flex items-center space-x-2">
            <span className="w-6 h-0.5 bg-emerald-500 inline-block"></span>
            <span className="text-emerald-400 font-mono text-[11px]">Observed (Direct)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-6 border-b border-dashed border-amber-500 inline-block"></span>
            <span className="text-amber-400 font-mono text-[11px]">Inferred (Proximity)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-6 border-b border-dotted border-rose-500 border-2 inline-block"></span>
            <span className="text-rose-400 font-mono text-[11px]">Needs Verification</span>
          </div>
        </div>

        {/* Centerpiece Instructions Tip */}
        <div className="absolute top-4 left-4 z-20 bg-cyber-950/80 border border-cyber-700 px-3 py-1.5 rounded-lg text-xs text-slate-300 flex items-center space-x-2 backdrop-blur">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Click any edge to inspect grounding evidence records</span>
        </div>

        {/* Cytoscape Container */}
        <div ref={containerRef} className="w-full h-full flex-1" />
      </div>

      {/* Centerpiece Edge Evidence Panel Drawer */}
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
