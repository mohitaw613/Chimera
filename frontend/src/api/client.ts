import axios from 'axios';
import {
  Investigation,
  DashboardSummary,
  TimelineResponse,
  GraphResponse,
  EdgeDetail,
  HypothesesOverviewResponse,
  BlastRadiusResponse,
  CanonicalEvent,
} from '../types';
import {
  mockInvestigation,
  mockDashboardSummary,
  mockTimeline,
  mockGraph,
  mockEdgeDetail,
  mockHypothesesOverview,
  mockBlastRadius,
} from '../mocks/fixtures';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Dashboard & Investigations
  async getDashboard(): Promise<DashboardSummary> {
    try {
      const res = await apiClient.get<DashboardSummary>('/dashboard');
      return res.data;
    } catch {
      return mockDashboardSummary;
    }
  },

  async listInvestigations(): Promise<Investigation[]> {
    try {
      const res = await apiClient.get<Investigation[]>('/investigations');
      return res.data;
    } catch {
      return [mockInvestigation];
    }
  },

  async getInvestigation(id: string): Promise<Investigation> {
    try {
      const res = await apiClient.get<Investigation>(`/investigations/${id}`);
      return res.data;
    } catch {
      return mockInvestigation;
    }
  },

  async createInvestigation(data: { name: string; description?: string; is_synthetic?: boolean }): Promise<Investigation> {
    const res = await apiClient.post<Investigation>('/investigations', data);
    return res.data;
  },

  async deleteInvestigation(id: string): Promise<void> {
    await apiClient.delete(`/investigations/${id}`);
  },

  // Evidence
  async uploadFiles(investigationId: string, formData: FormData) {
    const res = await apiClient.post(`/investigations/${investigationId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async getEvents(
    investigationId: string,
    params?: { page?: number; page_size?: number; event_type?: string; actor?: string; device?: string; flag?: string; q?: string }
  ): Promise<{ items: CanonicalEvent[]; total: number; page: number; page_size: number }> {
    const res = await apiClient.get(`/investigations/${investigationId}/events`, { params });
    return res.data;
  },

  // Analysis
  async triggerAnalysis(investigationId: string) {
    const res = await apiClient.post(`/investigations/${investigationId}/analyze`);
    return res.data;
  },

  async getTimeline(investigationId: string): Promise<TimelineResponse> {
    try {
      const res = await apiClient.get<TimelineResponse>(`/investigations/${investigationId}/timeline`);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.status === 404) {
        return {
          events: [],
          arrival_sequence: [],
          inversions: 0,
          unordered: [],
        };
      }
      if (!err.response) {
        return mockTimeline;
      }
      return {
        events: [],
        arrival_sequence: [],
        inversions: 0,
        unordered: [],
      };
    }
  },

  async getGraph(investigationId: string): Promise<GraphResponse> {
    try {
      const res = await apiClient.get<GraphResponse>(`/investigations/${investigationId}/graph`);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.status === 404) {
        return {
          nodes: [],
          edges: [],
          finding: {
            text: 'Investigation not analyzed yet. Upload evidence and run analysis.',
            open_gaps: 0,
            incomplete: true,
          },
          legend: {
            status: ['observed', 'inferred', 'needs_verification'],
          },
        };
      }
      if (!err.response) {
        return mockGraph;
      }
      return {
        nodes: [],
        edges: [],
        finding: { text: 'Error loading attack graph', open_gaps: 0, incomplete: true },
        legend: { status: ['observed', 'inferred', 'needs_verification'] },
      };
    }
  },

  async getEdgeDetail(investigationId: string, edgeId: string): Promise<EdgeDetail> {
    try {
      const res = await apiClient.get<EdgeDetail>(`/investigations/${investigationId}/edges/${edgeId}`);
      return res.data;
    } catch (err: any) {
      if (!err.response) {
        return mockEdgeDetail;
      }
      throw err;
    }
  },

  async getHypotheses(investigationId: string): Promise<HypothesesOverviewResponse> {
    try {
      const res = await apiClient.get<HypothesesOverviewResponse>(`/investigations/${investigationId}/hypotheses`);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.status === 404) {
        return {
          hypotheses: [],
          gaps: [],
          initial_access: [],
          finding: {
            text: 'No hypotheses generated. Investigation requires evidence upload and analysis.',
            open_gaps: 0,
            incomplete: true,
          },
        };
      }
      if (!err.response) {
        return mockHypothesesOverview;
      }
      return {
        hypotheses: [],
        gaps: [],
        initial_access: [],
        finding: { text: 'Error loading hypotheses', open_gaps: 0, incomplete: true },
      };
    }
  },

  async getBlastRadius(investigationId: string, entityId: string, maxHops: number = 3): Promise<BlastRadiusResponse> {
    try {
      const res = await apiClient.get<BlastRadiusResponse>(`/investigations/${investigationId}/blast-radius/${entityId}`, {
        params: { max_hops: maxHops, include_unverified: true },
      });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.status === 404) {
        return {
          start: entityId,
          max_hops: maxHops,
          label: entityId,
          summary: { directly_associated: 0, indirectly_associated: 0, unverified: 0 },
          items: [],
        };
      }
      if (!err.response) {
        return mockBlastRadius;
      }
      return {
        start: entityId,
        max_hops: maxHops,
        label: entityId,
        summary: { directly_associated: 0, indirectly_associated: 0, unverified: 0 },
        items: [],
      };
    }
  },

  async getReport(investigationId: string) {
    const res = await apiClient.get(`/investigations/${investigationId}/report`);
    return res.data;
  },
};
