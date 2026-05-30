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

export function useSessions(limit = 50, offset = 0, query = '', sort = 'timestamp') {
  const url = query
    ? `/api/sessions?q=${encodeURIComponent(query)}&limit=${limit}`
    : `/api/sessions?limit=${limit}&offset=${offset}&sort=${sort}`;
  return useSWR<SessionInfo[]>(url, fetcher);
}

export function useProjectSessions(projectId: string, sort = 'timestamp') {
  return useSWR<SessionInfo[]>(`/api/sessions?projectId=${projectId}&sort=${sort}`, fetcher);
}

export function useSessionDetail(sessionId: string) {
  return useSWR<SessionDetail>(`/api/sessions/${sessionId}`, fetcher);
}
