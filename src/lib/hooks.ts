import useSWR from 'swr';
import type { DashboardStats, ProjectInfo, SessionInfo, SessionDetail } from '@/lib/claude-data/types';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

export function useStats() {
  return useSWR<DashboardStats>('/api/stats', fetcher);
}

export function useProjects() {
  return useSWR<ProjectInfo[]>('/api/projects', fetcher);
}

export function useSessions(limit = 50, offset = 0, query = '', sort = 'timestamp', filters?: { projectId?: string, model?: string, dateRange?: string }) {
  let url = query
    ? `/api/sessions?q=${encodeURIComponent(query)}&limit=${limit}`
    : `/api/sessions?limit=${limit}&offset=${offset}&sort=${sort}`;
  
  if (!query && filters) {
    if (filters.projectId) url += `&projectId=${encodeURIComponent(filters.projectId)}`;
    if (filters.model) url += `&model=${encodeURIComponent(filters.model)}`;
    if (filters.dateRange) url += `&dateRange=${encodeURIComponent(filters.dateRange)}`;
  }
  
  return useSWR<SessionInfo[]>(url, fetcher);
}

export function useProjectSessions(projectId: string, sort = 'timestamp') {
  return useSWR<SessionInfo[]>(`/api/sessions?projectId=${projectId}&sort=${sort}`, fetcher);
}

export function useSessionDetail(sessionId: string) {
  return useSWR<SessionDetail>(`/api/sessions/${sessionId}`, fetcher);
}
