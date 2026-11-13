import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import cytoscape, { Core } from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Shield,
  Target,
  RefreshCw,
  Info,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import { EdgeDetail, GraphResponse } from '../types';
import { EdgeEvidencePanel } from '../components/EdgeEvidencePanel';

// Register dagre layout
try {
  cytoscape.use(dagre);
} catch {
  // Already registered
}

export const GraphPage: React.FC = () => {
  const { id: investigationId } = useParams<{ id: string }>();

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [edgeDetail, setEdgeDetail] = useState<EdgeDetail | null>(null);
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'observed' | 'inferred' | 'suspicious'>('all');

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

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const elements: any[] = [];

    // Filter nodes/edges if filter is active
    graphData.nodes.forEach((node) => {
      const type = (node.data as any).entity_type || (node.data as any).type || 'device';
      const label = node.data.label || node.data.id;
      const isPrivilegeChange = label.toLowerCase().includes('privilege') || label.toLowerCase().includes('admin');

      elements.push({
        data: {
          id: node.data.id,
          label: label,
          type: type,
          isAlert: isPrivilegeChange,
        },
      });
    });

    graphData.edges.forEach((edge) => {
      const status = edge.data.status || 'observed';
      if (activeFilter === 'observed' && status !== 'observed') return;
      if (activeFilter === 'inferred' && status !== 'inferred') return;
      if (activeFilter === 'suspicious' && status === 'observed') return;

      elements.push({
        data: {
          id: edge.data.id,
          source: edge.data.source,
          target: edge.data.target,
          label: edge.data.label || '',
          status: status,
        },
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      boxSelectionEnabled: false,
      autounselectify: true,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#cbd5e1',
            'font-size': '11px',
            'font-family': 'Inter, sans-serif',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'background-color': '#11192c',
            'border-width': 2,
            'border-color': '#3b82f6',
            'width': 44,
            'height': 44,
          },
        },
        {
          selector: 'node[type = "user"]',
          style: {
            'background-color': '#172554',
            'border-color': '#3b82f6',
            'shape': 'ellipse',
          },
        },
        {
          selector: 'node[type = "device"]',
          style: {
            'background-color': '#0f172a',
            'border-color': '#0284c7',
            'shape': 'round-rectangle',
          },
        },
        {
          selector: 'node[type = "service"]',
          style: {
            'background-color': '#082f49',
            'border-color': '#06b6d4',
            'shape': 'round-rectangle',
          },
        },
        {
          selector: 'node[type = "ip"], node[type = "external"]',
          style: {
            'background-color': '#2a1215',
            'border-color': '#f43f5e',
            'shape': 'hexagon',
          },
        },
        {
          selector: 'node[?isAlert]',
          style: {
            'background-color': '#450a0a',
            'border-color': '#ef4444',
            'border-width': 3,
            'color': '#fca5a5',
            'width': 54,
            'height': 54,
            'shape': 'ellipse',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8,
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            'label': 'data(label)',
            'font-size': '9px',
            'font-family': 'JetBrains Mono, monospace',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.85,
            'text-background-color': '#080c15',
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'color': '#94a3b8',
          },
        },
        {
          selector: 'edge[status = "observed"]',
          style: {
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
          },
        },
        {
          selector: 'edge[status = "inferred"]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [6, 4],
            'line-color': '#0284c7',
            'target-arrow-color': '#0284c7',
          },
        },
        {
          selector: 'edge[status = "needs_verification"], edge[status = "suspicious"]',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [4, 4],
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'color': '#fca5a5',
          },
        },
      ],
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 60,
        rankSep: 90,
        animate: true,
        animationDuration: 400,
      } as any,
    });

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
  }, [graphData, activeFilter]);

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
    <div className="space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-7.5rem)] flex flex-col">
      {/* Clean Header Bar */}
      <div className="card-glow rounded-2xl p-5 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-200">Investigations</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-mono">#{investigationId}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Attack Graph & Provenance</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive topology of reconstructed entities, relationships, and grounding evidence.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to={`/investigations/${investigationId}/hypotheses`}
              className="px-3.5 py-2 rounded-xl bg-cyber-850 hover:bg-cyber-800 text-slate-300 hover:text-white text-xs font-semibold border border-cyber-800 transition-colors"
            >
              Hypotheses & Gaps
            </Link>
            <Link
              to={`/investigations/${investigationId}/blast-radius`}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Blast Radius</span>
            </Link>
          </div>
        </div>

        {/* Epistemic Finding Callout */}
        {graphData?.finding && (
          <div className="mt-4 p-3 rounded-xl bg-cyber-950 border border-cyber-800 flex items-start space-x-3 text-xs text-slate-300">
            <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-white">Investigation Finding: </span>
              {graphData.finding.text}
            </div>
          </div>
        )}
      </div>

      {/* Main Graph Canvas Card */}
      <div className="flex-1 card-glow rounded-2xl relative overflow-hidden flex flex-col shadow-2xl">
        {/* Floating Controls Header */}
        <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
          {/* Filter Pills */}
          <div className="flex items-center p-1 bg-cyber-950/90 backdrop-blur rounded-xl border border-cyber-800 text-xs">
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

          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyber-950/90 border border-cyber-800 text-xs text-slate-400 backdrop-blur">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Click any edge to view evidence rows</span>
          </div>
        </div>

        {/* Floating Zoom & Fit Tools */}
        <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-cyber-950/90 border border-cyber-800 p-1 rounded-xl backdrop-blur">
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

        {/* Cytoscape Container */}
        <div className="relative flex-1 w-full h-full radar-grid">
          <div ref={containerRef} className="w-full h-full absolute inset-0" />
        </div>
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
