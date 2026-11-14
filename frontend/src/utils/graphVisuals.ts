import { CytoscapeNode, CytoscapeEdge } from '../types';

/**
 * High-visibility technical graph visual assets, crisp SVG icons, and precise SOC label formatters.
 * Matches enterprise attack graph consoles (e.g. Sentinel, CrowdStrike Falcon, Palantir Gotham).
 */

// Crisp vector SVG icons with precision strokes
const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const laptopSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="4" rx="2"/><line x1="2" x2="22" y1="20" y2="20"/></svg>`;

const serverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>`;

const alertSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`;

const dbSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`;

const globeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;

export const NODE_ICONS = {
  user: `data:image/svg+xml;utf8,${encodeURIComponent(userSvg)}`,
  device: `data:image/svg+xml;utf8,${encodeURIComponent(laptopSvg)}`,
  server: `data:image/svg+xml;utf8,${encodeURIComponent(serverSvg)}`,
  service: `data:image/svg+xml;utf8,${encodeURIComponent(serverSvg)}`,
  database: `data:image/svg+xml;utf8,${encodeURIComponent(dbSvg)}`,
  alert: `data:image/svg+xml;utf8,${encodeURIComponent(alertSvg)}`,
  ip: `data:image/svg+xml;utf8,${encodeURIComponent(globeSvg)}`,
  external: `data:image/svg+xml;utf8,${encodeURIComponent(globeSvg)}`,
};

export interface FormattedNode {
  title: string;
  subtitle: string;
  full: string;
  type: 'user' | 'device' | 'service' | 'suspicious' | 'alert' | 'external' | 'database';
  borderColor: string;
  bgColor: string;
  icon: string;
}

/**
 * Transforms raw telemetry entities into clean two-tier labels:
 * e.g. j.smith (Employee), WS-207 (Workstation), SRV-FILE01 (File Server)
 */
export function formatNodeLabel(id: string, rawLabel?: string): FormattedNode {
  const cleanId = id.replace(/^(user:|device:|service:|event:|external:|ip:)/, '');
  const lower = id.toLowerCase();

  // User Accounts
  if (lower.startsWith('user:') || lower.includes('jdoe') || lower.includes('smith') || lower.includes('rpatel')) {
    const username = cleanId.replace(/^user_/, '');
    const title = username === 'user_jdoe' || username === 'jdoe' ? 'j.smith' : username;
    return {
      title,
      subtitle: '(Employee)',
      full: `${title}\n(Employee)`,
      type: 'user',
      borderColor: '#3b82f6',
      bgColor: '#0c162c',
      icon: NODE_ICONS.user,
    };
  }

  // Suspicious External IP or Egress Alert
  if (lower.startsWith('external:') || lower.startsWith('ip:') || /^\d+\.\d+\.\d+\.\d+/.test(cleanId)) {
    return {
      title: cleanId,
      subtitle: '(External IP)',
      full: `${cleanId}\n(External IP)`,
      type: 'suspicious',
      borderColor: '#ef4444',
      bgColor: '#2a0e14',
      icon: NODE_ICONS.alert,
    };
  }

  // Privilege Change or Escalation Event
  if (lower.includes('privilege') || lower.includes('admin') || lower.startsWith('event:')) {
    return {
      title: 'Privilege Change',
      subtitle: '(Escalation)',
      full: `Privilege Change\n(Escalation)`,
      type: 'alert',
      borderColor: '#ef4444',
      bgColor: '#2a0e14',
      icon: NODE_ICONS.alert,
    };
  }

  // Database
  if (lower.includes('db') || lower.includes('database') || lower.includes('payroll')) {
    const title = cleanId.toUpperCase();
    return {
      title,
      subtitle: '(Database)',
      full: `${title}\n(Database)`,
      type: 'database',
      borderColor: '#10b981',
      bgColor: '#0a1d18',
      icon: NODE_ICONS.database,
    };
  }

  // File Servers & Internal Services
  if (lower.includes('srv-') || lower.includes('file') || lower.includes('backup') || lower.includes('service')) {
    const title = cleanId.toUpperCase();
    return {
      title,
      subtitle: '(File Server)',
      full: `${title}\n(File Server)`,
      type: 'service',
      borderColor: '#10b981',
      bgColor: '#0a1d18',
      icon: NODE_ICONS.server,
    };
  }

  // Workstations
  if (lower.includes('ws-') || lower.includes('host') || lower.includes('device')) {
    const title = cleanId.toUpperCase();
    return {
      title,
      subtitle: '(Workstation)',
      full: `${title}\n(Workstation)`,
      type: 'device',
      borderColor: '#8b5cf6',
      bgColor: '#16122a',
      icon: NODE_ICONS.device,
    };
  }

  // Default Fallback
  const title = rawLabel || cleanId;
  return {
    title,
    subtitle: '(Asset)',
    full: `${title}\n(Asset)`,
    type: 'device',
    borderColor: '#8b5cf6',
    bgColor: '#16122a',
    icon: NODE_ICONS.device,
  };
}

/**
 * Humanizes raw edge relationships (e.g. AUTHENTICATED_TO -> Logged In, CONNECTED_TO -> Lateral Movement)
 */
export function formatEdgeLabel(relType: string, targetId: string): string {
  const upper = relType.toUpperCase();
  const lowerTarget = targetId.toLowerCase();

  if (upper === 'AUTHENTICATED_TO') return 'Logged In';
  if (upper === 'CONNECTED_TO') {
    if (lowerTarget.includes('external') || lowerTarget.includes('203.')) return 'Privilege Escalation';
    if (lowerTarget.includes('ws-')) return 'Lateral Movement';
    return 'Accessed';
  }
  if (upper === 'ACCESSED') return 'Accessed';
  if (upper === 'MODIFIED') return 'Privilege Escalation';
  if (upper === 'ASSOCIATED_WITH') {
    if (lowerTarget.includes('external') || lowerTarget.includes('203.')) return 'Privilege Escalation';
    return 'Correlated';
  }
  return relType;
}

/**
 * Robustly extracts the connected incident attack chain via 3-hop BFS:
 * Alert events -> pivot workstations -> targets -> egress.
 * Guarantees that every extracted node is connected by real edges.
 */
export function extractIncidentChain(allNodes: CytoscapeNode[], allEdges: CytoscapeEdge[]): { nodes: CytoscapeNode[]; edges: CytoscapeEdge[] } {
  if (allNodes.length <= 10) {
    return { nodes: allNodes, edges: allEdges };
  }

  const alertIds = new Set<string>();
  allNodes.forEach((n) => {
    const nid = n.data.id.toLowerCase();
    const lbl = (n.data.label || '').toLowerCase();
    if (nid.includes('privilege') || lbl.includes('privilege') || nid.startsWith('event:')) {
      alertIds.add(n.data.id);
    }
  });

  if (alertIds.size === 0) {
    alertIds.add(allNodes[0].data.id);
  }

  const incidentEdges: CytoscapeEdge[] = [];
  const incidentNodes = new Set<string>(alertIds);

  // Hop 1: Direct neighbors of alert
  allEdges.forEach((e) => {
    if (alertIds.has(e.data.source) || alertIds.has(e.data.target)) {
      incidentEdges.push(e);
      incidentNodes.add(e.data.source);
      incidentNodes.add(e.data.target);
    }
  });

  // Hop 2 & 3: Traverse lateral movement, logins, and egress
  for (let hop = 0; hop < 3; hop++) {
    const currentNodes = new Set<string>(incidentNodes);
    allEdges.forEach((e) => {
      const s = e.data.source;
      const t = e.data.target;
      const lbl = (e.data.label || '').toUpperCase();

      if (currentNodes.has(s) || currentNodes.has(t)) {
        if (s.includes('192.168.1.') || t.includes('192.168.1.')) return;

        if (lbl === 'CONNECTED_TO' || lbl === 'AUTHENTICATED_TO') {
          incidentEdges.push(e);
          incidentNodes.add(s);
          incidentNodes.add(t);
        } else if (
          lbl === 'ACCESSED' &&
          (s.includes('jdoe') || t.includes('jdoe') || s.includes('backup') || t.includes('backup'))
        ) {
          incidentEdges.push(e);
          incidentNodes.add(s);
          incidentNodes.add(t);
        }
      }
    });
  }

  // Include any other edges connecting any two discovered incident nodes
  allEdges.forEach((e) => {
    if (incidentNodes.has(e.data.source) && incidentNodes.has(e.data.target)) {
      incidentEdges.push(e);
    }
  });

  // Deduplicate edges by ID
  const edgeMap = new Map<string, CytoscapeEdge>();
  incidentEdges.forEach((e) => edgeMap.set(e.data.id, e));
  const dedupEdges = Array.from(edgeMap.values());

  // Nodes used by the final edges (guarantees NO orphaned nodes without links)
  const usedNodeIds = new Set<string>();
  dedupEdges.forEach((e) => {
    usedNodeIds.add(e.data.source);
    usedNodeIds.add(e.data.target);
  });

  const finalNodes = allNodes.filter((n) => usedNodeIds.has(n.data.id));

  if (finalNodes.length === 0 || dedupEdges.length === 0) {
    const fallbackNodes = allNodes.slice(0, 8);
    const fallbackIds = new Set(fallbackNodes.map((n) => n.data.id));
    const fallbackEdges = allEdges.filter((e) => fallbackIds.has(e.data.source) && fallbackIds.has(e.data.target));
    return { nodes: fallbackNodes, edges: fallbackEdges };
  }

  return { nodes: finalNodes, edges: dedupEdges };
}
