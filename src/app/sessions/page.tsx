'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSessions, useProjects } from '@/lib/hooks';
import { useCostMode } from '@/lib/cost-mode-context';
import { formatCost, formatDuration, timeAgo, formatTokens } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, GitBranch, MessageSquare, FolderKanban, Minimize2, Search, X, ArrowUpDown, Filter, Check, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
  const [selectedProjects, setSelectedProjects] = useState<string[]>(
    searchParams.get('projectId')?.split(',').filter(Boolean) || []
  );
  const [selectedModels, setSelectedModels] = useState<string[]>(
    searchParams.get('model')?.split(',').filter(Boolean) || []
  );
  const [dateRange, setDateRange] = useState(searchParams.get('dateRange') || 'all');
  
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  const { data: projects } = useProjects();
  const { data: sessions, isLoading, isValidating } = useSessions(100, 0, debouncedQuery, sort, {
    projectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
    models: selectedModels.length > 0 ? selectedModels : undefined,
    dateRange: dateRange as any,
  });
  const { pickCost } = useCostMode();

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery) params.set('q', debouncedQuery); else params.delete('q');
    if (sort !== 'timestamp') params.set('sort', sort); else params.delete('sort');
    if (selectedProjects.length > 0) params.set('projectId', selectedProjects.join(',')); else params.delete('projectId');
    if (selectedModels.length > 0) params.set('model', selectedModels.join(',')); else params.delete('model');
    if (dateRange !== 'all') params.set('dateRange', dateRange); else params.delete('dateRange');
    
    const qs = params.toString();
    router.replace(qs ? `/sessions?${qs}` : '/sessions', { scroll: false });
  }, [debouncedQuery, sort, selectedProjects, selectedModels, dateRange, router]);

  // Extract unique models from projects if available
  const allModels = useMemo(() => {
    if (!projects) return [];
    const models = new Set<string>();
    projects.forEach(p => p.models.forEach(m => models.add(m)));
    return Array.from(models).sort();
  }, [projects]);

  const toggleModel = (m: string) => {
    setSelectedModels(prev => 
      prev.includes(m) ? prev.filter(item => item !== m) : [...prev, m]
    );
  };

  const toggleProject = (id: string) => {
    setSelectedProjects(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Only show full-page loading on initial load when there's no data
  if (!sessions && isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  const activeSessions = sessions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <h1 className="text-xl font-bold tracking-tight">Sessions</h1>
            {isValidating && (
              <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {activeSessions.length} session{activeSessions.length !== 1 ? 's' : ''}
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

            {/* Project Filter (Multi-select) */}
            <div className="flex items-center gap-1.5 relative group">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Project</span>
              <div className="relative">
                <button 
                  onClick={(e) => {
                    const dropdown = e.currentTarget.nextElementSibling;
                    if (dropdown) dropdown.classList.toggle('hidden');
                  }}
                  className="flex h-8 w-fit min-w-[140px] items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">
                    {selectedProjects.length === 0 ? "All Projects" : 
                     selectedProjects.length === 1 ? (projects?.find(p => p.id === selectedProjects[0])?.name || selectedProjects[0]) : 
                     `${selectedProjects.length} Projects`}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-2" />
                </button>
                <div className="hidden absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
                  <div className="max-h-[300px] overflow-y-auto p-1 space-y-0.5">
                    {projects?.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleProject(p.id)}
                        className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                      >
                        <div className={cn(
                          "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary flex-shrink-0",
                          selectedProjects.includes(p.id) ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {selectedProjects.includes(p.id) && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Model Filter (Multi-select) */}
            <div className="flex items-center gap-1.5 relative group">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Models</span>
              <div className="relative">
                <button 
                  onClick={(e) => {
                    const dropdown = e.currentTarget.nextElementSibling;
                    if (dropdown) dropdown.classList.toggle('hidden');
                  }}
                  className="flex h-8 w-fit min-w-[130px] items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">
                    {selectedModels.length === 0 ? "All Models" : 
                     selectedModels.length === 1 ? selectedModels[0] : 
                     `${selectedModels.length} Models`}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-2" />
                </button>
                <div className="hidden absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
                  <div className="max-h-[300px] overflow-y-auto p-1 space-y-0.5">
                    {allModels.map((m) => (
                      <button
                        key={m}
                        onClick={() => toggleModel(m)}
                        className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <div className={cn(
                          "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-primary",
                          selectedModels.includes(m) ? "bg-primary text-primary-foreground" : "opacity-50"
                        )}>
                          {selectedModels.includes(m) && <Check className="h-3 w-3" />}
                        </div>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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
            
            {(selectedProjects.length > 0 || selectedModels.length > 0 || dateRange !== 'all') && (
              <button
                onClick={() => {
                  setSelectedProjects([]);
                  setSelectedModels([]);
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
            {activeSessions.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">No sessions found matching &quot;{debouncedQuery}&quot;</p>
              </div>
            ) : activeSessions.map(session => (
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
