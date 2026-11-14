/**
 * TypeScript contracts mirroring backend API schemas exactly.
 * Source: 02_ARCHITECTURE_DATA_API.md §5.
 */

export type EpistemicStatus = 'observed' | 'inferred' | 'needs_verification';

export type NodeType = 'USER' | 'DEVICE' | 'SERVICE' | 'IP' | 'EVENT' | 'EXTERNAL';

export type EdgeType = 'AUTHENTICATED_TO' | 'ACCESSED' | 'CONNECTED_TO' | 'MODIFIED' | 'ASSOCIATED_WITH';

export type InvestigationStatus = 'created' | 'ingested' | 'analyzed' | 'stale' | 'error';

export interface InvestigationCounts {
  events: number;
  entities: number;
  open_gaps: number;
}

export interface Investigation {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  status: InvestigationStatus;
  analyzed_at?: string | null;
  is_synthetic: boolean;
  counts?: InvestigationCounts;
}

export interface DashboardSummary {
  total_investigations: number;
  total_events: number;
  total_signals: number;
  total_entities: number;
  open_gaps: number;
  recent: Investigation[];
}

export interface CanonicalEvent {
  id: string;
  investigation_id: string;
  file_id?: string | null;
  row_number: number;
  event_time?: string | null;
  ingested_at: string;
  event_type: string;
  source: string;
  actor?: string | null;
  source_device?: string | null;
  target?: string | null;
  source_ip?: string | null;
  outcome: string;
  timestamp_status: string;
  arrival_flags: string[];
  delay_seconds?: number | null;
  raw_record: Record<string, any>;
  attributes: Record<string, any>;
}

export interface TimelineSignal {
  id: string;
  signal: string;
  reason: string;
  severity: string;
  kind: string;
}

export interface TimelineEvent {
  id: string;
  event_time?: string | null;
  ingested_at: string;
  delay_seconds?: number | null;
  event_type: string;
  source: string;
  actor?: string | null;
  source_device?: string | null;
  target?: string | null;
  outcome: string;
  flags: string[];
  primary_flag: string;
  ordering_ambiguous: boolean;
  signal_ids: string[];
  signals?: TimelineSignal[];
}

export interface TimelineResponse {
  events: TimelineEvent[];
  arrival_sequence: string[];
  inversions: number;
  unordered: TimelineEvent[];
}

export interface CytoscapeNodeData {
  id: string;
  label: string;
  type: NodeType;
  first_seen?: string | null;
  signal_ids: string[];
  suspicious: boolean;
}

export interface CytoscapeNode {
  data: CytoscapeNodeData;
}

export interface CytoscapeEdgeData {
  id: string;
  source: string;
  target: string;
  label: EdgeType;
  status: EpistemicStatus;
  confidence: number;
  evidence_ids: string[];
  event_time?: string | null;
}

export interface CytoscapeEdge {
  data: CytoscapeEdgeData;
}

export interface GraphResponse {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
  finding: {
    text: string;
    incomplete: boolean;
    open_gaps: number;
  };
  legend: {
    status: EpistemicStatus[];
  };
}

export interface ConfidenceDelta {
  label: string;
  delta: number;
}

export interface EvidenceItem {
  event_id: string;
  role: 'direct' | 'corroborating' | 'motivating';
  event_time?: string | null;
  source: string;
  summary: string;
  raw_record: Record<string, any>;
  file?: string | null;
  row_number?: number | null;
  status: EpistemicStatus;
}

export interface EvidenceCheck {
  label: string;
  state: 'observed' | 'inferred' | 'unverified';
}

export interface GapSummary {
  id: string;
  title: string;
}

export interface EdgeDetail {
  id: string;
  source: { id: string; label: string; type: NodeType };
  target: { id: string; label: string; type: NodeType };
  relationship_type: EdgeType;
  status: EpistemicStatus;
  confidence: number;
  confidence_breakdown: ConfidenceDelta[];
  why: string;
  epistemic_note: string;
  evidence: EvidenceItem[];
  checks: EvidenceCheck[];
  gaps: GapSummary[];
  conclusion: string;
}

export interface RuleContribution {
  rule_id: string;
  label: string;
  e: number;
  w: number;
  event_ids: string[];
}

export interface Hypothesis {
  id: string;
  key: 'H1' | 'H2' | 'H3';
  name: string;
  score: number;
  score_type: 'heuristic';
  status: 'under_investigation' | 'leading' | 'unlikely';
  label: string;
  explanation?: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  contributions: RuleContribution[];
}

export interface InvestigationGap {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  related_edge_ids: string[];
  resolves_with: string;
}

export interface InitialAccessCandidate {
  rank: number;
  event_id: string;
  entity_id: string;
  reason: string;
  evidence_ids: string[];
  caveat: string;
  technique?: {
    id: string;
    name: string;
    tactic: string;
    caveat: string;
  };
  event_time?: string | null;
  source_ip?: string | null;
  target?: string | null;
}

export interface HypothesesOverviewResponse {
  hypotheses: Hypothesis[];
  gaps: InvestigationGap[];
  initial_access: InitialAccessCandidate[];
  finding: {
    text: string;
    open_gaps: number;
    incomplete: boolean;
  };
}

export interface PathStep {
  edge_id: string;
  type: string;
  status: EpistemicStatus;
  direction: 'forward' | 'reverse';
}

export interface BlastRadiusItem {
  entity_id: string;
  entity_type: NodeType;
  classification: 'directly_associated' | 'indirectly_associated' | 'unverified';
  hops: number;
  path: PathStep[];
  weakest_status: EpistemicStatus;
  explanation: string;
}

export interface BlastRadiusResponse {
  start: string;
  max_hops: number;
  label: string;
  summary: {
    directly_associated: number;
    indirectly_associated: number;
    unverified: number;
  };
  items: BlastRadiusItem[];
}
