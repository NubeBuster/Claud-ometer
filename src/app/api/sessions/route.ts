import { NextResponse } from 'next/server';
import { getSessions, getProjectSessions, searchSessions, type SessionSortMode } from '@/lib/claude-data/reader';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = (searchParams.get('sort') || 'timestamp') as SessionSortMode;

    const filters: SessionFilters = {
      projectIds: searchParams.get('projectId')?.split(',').filter(Boolean) || undefined,
      models: searchParams.get('model')?.split(',').filter(Boolean) || undefined,
      dateRange: (searchParams.get('dateRange') || 'all') as SessionFilters['dateRange'],
    };

    if (query) {
      const sessions = await searchSessions(query, limit);
      return NextResponse.json(sessions);
    }

    const sessions = await getSessions(limit, offset, sort, filters);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
