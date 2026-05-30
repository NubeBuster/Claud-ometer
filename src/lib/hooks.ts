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

export function useSessions(limit = 50, offset = 0, query = '', sort = 'timestamp', filters?: { projectIds?: string[], models?: string[], dateRange?: string }) {
  let url = query
    ? `/api/sessions?q=${encodeURIComponent(query)}&limit=${limit}`
    : `/api/sessions?limit=${limit}&offset=${offset}&sort=${sort}`;
  
  if (!query && filters) {
    if (filters.projectIds && filters.projectIds.length > 0) {
      url += `&projectId=${encodeURIComponent(filters.projectIds.join(','))}`;
    }
    if (filters.models && filters.models.length > 0) {
      url += `&model=${encodeURIComponent(filters.models.join(','))}`;
    }
    if (filters.dateRange) url += `&dateRange=${encodeURIComponent(filters.dateRange)}`;
  }
  
  return useSWR<SessionInfo[]>(url, fetcher, {
    keepPreviousData: true, // Don't show full-page loading when data is being revalidated
  });
}

export function useProjectSessions(projectId: string, sort = 'timestamp') {
  return useSWR<SessionInfo[]>(`/api/sessions?projectId=${projectId}&sort=${sort}`, fetcher);
}

export function useSessionDetail(sessionId: string) {
  return useSWR<SessionDetail>(`/api/sessions/${sessionId}`, fetcher);
}
