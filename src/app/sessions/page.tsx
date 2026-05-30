'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSessions, useProjects } from '@/lib/hooks';
import { useCostMode } from '@/lib/cost-mode-context';
import { formatCost, formatDuration, timeAgo, formatTokens } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, GitBranch, MessageSquare, FolderKanban, Minimize2, Search, X, ArrowUpDown, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    }>
      <SessionsContent />
    </Suspense>
  );
}

function SessionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'timestamp');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') || 'all');
  const [model, setModel] = useState(searchParams.get('model') || 'all');
  const [dateRange, setDateRange] = useState(searchParams.get('dateRange') || 'all');
  
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  const { data: projects } = useProjects();
  const { data: sessions, isLoading } = useSessions(100, 0, debouncedQuery, sort, {
    projectId: projectId === 'all' ? undefined : projectId,
    model: model === 'all' ? undefined : model,
    dateRange: dateRange,
  });
  const { pickCost } = useCostMode();

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery) params.set('q', debouncedQuery); else params.delete('q');
    if (sort !== 'timestamp') params.set('sort', sort); else params.delete('sort');
    if (projectId !== 'all') params.set('projectId', projectId); else params.delete('projectId');
    if (model !== 'all') params.set('model', model); else params.delete('model');
    if (dateRange !== 'all') params.set('dateRange', dateRange); else params.delete('dateRange');
    
    const qs = params.toString();
    router.replace(qs ? `/sessions?${qs}` : '/sessions', { scroll: false });
  }, [debouncedQuery, sort, projectId, model, dateRange, router]);

  // Extract unique models from projects if available
  const allModels = useMemo(() => {
    if (!projects) return [];
    const models = new Set<string>();
    projects.forEach(p => p.models.forEach(m => models.add(m)));
    return Array.from(models).sort();
  }, [projects]);

  if (isLoading || !sessions) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            {debouncedQuery && ` matching "${debouncedQuery}"`}
          </p>
        </div>
        
        {!debouncedQuery && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Sort</span>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-8 w-[120px] text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timestamp">Newest</SelectItem>
                  <SelectItem value="cost">Highest Cost</SelectItem>
                  <SelectItem value="messages">Messages</SelectItem>
                  <SelectItem value="tokens">Tokens</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

            {/* Project Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Project</span>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-8 w-[140px] text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Model</span>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-8 w-[130px] text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {allModels.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Range</span>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-8 w-[110px] text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="w">Last Week</SelectItem>
                  <SelectItem value="m">Last Month</SelectItem>
                  <SelectItem value="q">Last Quarter</SelectItem>
                  <SelectItem value="y">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(projectId !== 'all' || model !== 'all' || dateRange !== 'all') && (
              <button
                onClick={() => {
                  setProjectId('all');
                  setModel('all');
                  setDateRange('all');
                }}
                className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors ml-1"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search across all session messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {sessions.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">No sessions found matching &quot;{debouncedQuery}&quot;</p>
              </div>
            ) : sessions.map(session => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-accent/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                      {session.projectName}
                    </span>
                    {[...new Set(session.models)].map(m => (
                      <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {m}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {session.gitBranch && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <GitBranch className="h-3 w-3 flex-shrink-0" />
                        {session.gitBranch}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(session.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {session.messageCount} msgs
                    </span>
                    <span>{session.toolCallCount} tools</span>
                    <span>{formatTokens(session.totalInputTokens + session.totalOutputTokens)} tokens</span>
                    {(session.compaction.compactions + session.compaction.microcompactions) > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Minimize2 className="h-3 w-3" />
                        {session.compaction.compactions + session.compaction.microcompactions} compactions
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-semibold">{formatCost(pickCost(session.estimatedCosts, session.estimatedCost))}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(session.timestamp)}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
