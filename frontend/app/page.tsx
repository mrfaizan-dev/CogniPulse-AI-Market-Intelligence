'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileJson,
  FileText,
  Globe2,
  Layers3,
  LoaderCircle,
  Network,
  Play,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wifi,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

type HealthState = 'checking' | 'online' | 'offline';
type EventTone = 'info' | 'success' | 'warning' | 'error';

type ActivityEvent = {
  id: number;
  time: string;
  title: string;
  detail: string;
  tone: EventTone;
};

type AgentResult = {
  status?: string;
  task_id?: string;
  execution_time_seconds?: number;
  error_message?: string | null;
  final_report?: string;
  items_extracted?: number;
  [key: string]: unknown;
};

type TaskStatusResponse = {
  task_id?: string;
  state?: string;
  ready?: boolean;
  successful?: boolean | null;
  result?: AgentResult | string | null;
};

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/';
const EXAMPLE_QUERIES = [
  'AI automation trends 2026',
  'Top project management software competitors',
  'Electric vehicle market pricing',
  'UAE Top Luxury Villa Communities & Prices (2026)'
];

const markdownComponents = {
  a: ({ node, ...props }: any) => <a {...props} target="_blank" rel="noreferrer" />,
};

const TECH_GROUPS = [
  { title: 'Backend', blurb: 'API, queue and orchestration', icon: Server, items: ['FastAPI', 'Celery', 'Redis', 'LangGraph', 'Pydantic v2', 'Python asyncio'] },
  { title: 'Extraction', blurb: 'Search, browse and clean', icon: Globe2, items: ['Tavily', 'Playwright', 'SeleniumBase', 'Nodriver', 'BeautifulSoup', 'html2text'] },
  { title: 'AI', blurb: 'Structured model output', icon: BrainCircuit, items: ['OpenRouter LLM', 'OpenAI Python SDK'] },
  { title: 'Frontend', blurb: 'Interface and motion', icon: Layers3, items: ['Next.js', 'TypeScript', 'React Markdown + GFM', 'Framer Motion', 'GSAP', 'Lucide React'] },
];

function formatClock(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function getFriendlyError(payload: any, fallback: string) {
  if (typeof payload?.detail === 'string') return payload.detail;
  if (typeof payload?.message === 'string') return payload.message;
  return fallback;
}

export default function Page() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [health, setHealth] = useState<HealthState>('checking');
  const [serviceName, setServiceName] = useState('CogniPulse Autonomous Enterprise AI Agent Suite');
  const [query, setQuery] = useState('');
  const [taskId, setTaskId] = useState('');
  const [celeryState, setCeleryState] = useState('IDLE');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<AgentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [copied, setCopied] = useState<'task' | 'report' | ''>('');
  const [lastChecked, setLastChecked] = useState('—');
  const reportRef = useRef<HTMLDivElement>(null);
  const requestCounter = useRef(0);

  const addEvent = useCallback((title: string, detail: string, tone: EventTone = 'info') => {
    setEvents((current) => [
      { id: Date.now() + Math.random(), time: formatClock(), title, detail, tone },
      ...current,
    ].slice(0, 9));
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.fromTo(
          element,
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.65,
            ease: 'power2.out',
            scrollTrigger: { trigger: element, start: 'top 90%', once: true },
          },
        );
      });
      gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((group) => {
        gsap.from(Array.from(group.children), {
          y: 24, opacity: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out',
          scrollTrigger: { trigger: group, start: 'top 88%', once: true },
        });
      });
    });
    return () => context.revert();
  }, []);

  // The root endpoint is the health check implemented by the supplied FastAPI app.
  useEffect(() => {
    if (!apiBaseUrl.trim()) {
      setHealth('offline');
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/`, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(6500),
        });
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setHealth('online');
        if (typeof data?.service === 'string') setServiceName(data.service);
        setLastChecked(formatClock());
      } catch {
        if (cancelled) return;
        setHealth('offline');
        setLastChecked(formatClock());
      }
    };

    setHealth('checking');
    void checkHealth();
    interval = setInterval(checkHealth, 25000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [apiBaseUrl]);

  const pollTask = useCallback(async (id: string) => {
    const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/v1/task-status/${encodeURIComponent(id)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });

    const payload = (await response.json().catch(() => ({}))) as TaskStatusResponse & { detail?: string };
    if (!response.ok) throw new Error(getFriendlyError(payload, `Status request failed (${response.status})`));

    const nextState = String(payload.state || 'UNKNOWN').toUpperCase();
    setCeleryState(nextState);

    if (payload.ready || ['SUCCESS', 'FAILURE', 'REVOKED'].includes(nextState)) {
      setIsRunning(false);
      if (payload.result && typeof payload.result === 'object') {
        const result = payload.result as AgentResult;
        setRunResult(result);
        if (result.status === 'Failed' || result.error_message) {
          const message = String(result.error_message || 'The agent workflow could not complete the request.');
          setErrorMessage(message);
          addEvent('Workflow completed with an error', message, 'error');
        } else {
          setErrorMessage('');
          addEvent('Report received', `${Number(result.items_extracted || 0)} structured items returned by the agent.`, 'success');
        }
      } else if (nextState === 'FAILURE') {
        const message = typeof payload.result === 'string' ? payload.result : 'Celery reported a task failure.';
        setErrorMessage(message);
        addEvent('Celery task failed', message, 'error');
      } else if (nextState === 'REVOKED') {
        setErrorMessage('The background task was revoked.');
        addEvent('Task revoked', 'The worker marked this task as revoked.', 'warning');
      } else {
        setErrorMessage('The task finished, but the API did not return a report payload.');
        addEvent('No report payload', 'The status endpoint returned an empty result.', 'warning');
      }
    }

    return nextState;
  }, [apiBaseUrl, addEvent]);

  // Poll only the task-status endpoint exposed by the existing backend.
  useEffect(() => {
    if (!taskId || !isRunning) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        await pollTask(taskId);
      } catch (error) {
        if (!cancelled) {
          addEvent('Status check delayed', error instanceof Error ? error.message : 'Unable to reach the status endpoint.', 'warning');
        }
      }
      if (!cancelled && isRunning) timeout = setTimeout(poll, 2200);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [taskId, isRunning, pollTask, addEvent]);

  useEffect(() => {
    if (!isRunning || !startedAt) return;
    const interval = setInterval(() => setElapsedSeconds((Date.now() - startedAt) / 1000), 500);
    return () => clearInterval(interval);
  }, [isRunning, startedAt]);

  const hasReport = Boolean(runResult?.final_report);
  const isTaskFailed = Boolean(errorMessage) || celeryState === 'FAILURE';
  const duration = typeof runResult?.execution_time_seconds === 'number'
    ? formatDuration(runResult.execution_time_seconds)
    : isRunning ? formatDuration(elapsedSeconds) : '—';

  const runStatus = useMemo(() => {
    if (isRunning) {
      if (celeryState === 'PENDING') return { label: 'Queued', detail: 'Waiting for a Celery worker', tone: 'amber' };
      if (celeryState === 'RETRY') return { label: 'Retrying', detail: 'The worker is retrying this task', tone: 'amber' };
      return { label: 'Processing', detail: 'The agent graph is running in the background', tone: 'blue' };
    }
    if (hasReport && !isTaskFailed) return { label: 'Completed', detail: 'Report is ready to review', tone: 'green' };
    if (isTaskFailed) return { label: 'Needs attention', detail: 'Review the error details below', tone: 'red' };
    if (taskId) return { label: celeryState, detail: 'Latest Celery task state', tone: 'slate' };
    return { label: 'Ready', detail: 'Waiting for a market research query', tone: 'slate' };
  }, [isRunning, celeryState, hasReport, isTaskFailed, taskId]);

  const handleRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setErrorMessage('Enter a market or competitor research query to start.');
      return;
    }
    if (!apiBaseUrl.trim()) {
      setErrorMessage('Add your FastAPI base URL before running the workflow.');
      return;
    }

    requestCounter.current += 1;
    setErrorMessage('');
    setRunResult(null);
    setTaskId('');
    setCeleryState('SUBMITTING');
    setIsRunning(true);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    setEvents([]);
    addEvent('Request prepared', 'Sending the research query to FastAPI.', 'info');

    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/v1/run-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: cleanQuery }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getFriendlyError(payload, `FastAPI rejected the request (${response.status}).`));
      if (!payload?.task_id) throw new Error('FastAPI accepted the request but did not return a task_id.');

      setTaskId(String(payload.task_id));
      setCeleryState('PENDING');
      addEvent('Task accepted by FastAPI', `Celery task ${payload.task_id} was queued successfully.`, 'success');
      addEvent('Background polling started', 'Checking the task-status endpoint every 2.2 seconds.', 'info');
    } catch (error) {
      setIsRunning(false);
      setCeleryState('ERROR');
      const message = error instanceof Error ? error.message : 'Could not submit the request.';
      setErrorMessage(message);
      addEvent('Request could not be submitted', message, 'error');
    }
  };

  const resetWorkspace = () => {
    setQuery('');
    setTaskId('');
    setCeleryState('IDLE');
    setIsRunning(false);
    setRunResult(null);
    setErrorMessage('');
    setEvents([]);
    setStartedAt(null);
    setElapsedSeconds(0);
  };

  const copyText = async (value: string, kind: 'task' | 'report') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      addEvent('Clipboard unavailable', 'Your browser did not allow clipboard access.', 'warning');
    }
  };

  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    if (!runResult) return;
    downloadFile('cognipulse-run-result.json', JSON.stringify({ query, task_id: taskId, celery_state: celeryState, result: runResult }, null, 2), 'application/json');
  };

  const exportMarkdown = () => {
    if (!runResult?.final_report) return;
    downloadFile('cognipulse-market-intelligence-report.md', runResult.final_report, 'text/markdown');
  };

  const healthLabel = health === 'online' ? 'API online' : health === 'checking' ? 'Checking API' : 'API offline';
  const statusDot = health === 'online' ? 'dot-green' : health === 'checking' ? 'dot-amber' : 'dot-red';

  return (
    <main className="cp-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="grid-overlay" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="CogniPulse home">
          <span className="brand-mark"><BrainCircuit size={21} strokeWidth={1.8} /></span>
          <span className="brand-copy">
            <strong>CogniPulse</strong>
            <small>Market intelligence</small>
          </span>
        </a>

        <nav className="top-nav" aria-label="Main navigation">
          <a href="#workspace">Workspace</a>
          <a href="#workflow">Workflow</a>
          <a href="#technology">Stack</a>
        </nav>

        <div className="top-actions">
          <button className="api-indicator" type="button" onClick={() => setShowApiSettings((value) => !value)} aria-expanded={showApiSettings}>
            <span className={`status-dot ${statusDot}`} />
            <span>{healthLabel}</span>
            <ChevronDown size={13} className={showApiSettings ? 'rotate-chevron' : ''} />
          </button>
          <a className="docs-link" href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer" title="Open FastAPI documentation">
            API docs <ExternalLink size={13} />
          </a>
        </div>
      </header>

      <AnimatePresence>
        {showApiSettings && (
          <motion.section
            className="api-settings glass-panel"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
          >
            <div>
              <span className="micro-label">Backend connection</span>
              <p>FastAPI base URL</p>
            </div>
            <input
              aria-label="FastAPI base URL"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value.trim())}
              placeholder="http://localhost:8000"
              spellCheck={false}
            />
            <span className="settings-note">Last check: {lastChecked}</span>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="hero section-wrap" id="top">
        <div className="hero-copy" data-reveal>
          <div className="eyebrow"><span className="eyebrow-line" /> Research workspace <span className="eyebrow-version">v2.0</span></div>
          <h1>Market research, ready to read.</h1>
          <p className="hero-description">
            Describe a market. The agent finds sources, extracts competitor data and writes the report.
          </p>
          <div className="hero-meta">
            <span><ShieldCheck size={15} /> Structured data</span>
            <span><Activity size={15} /> Runs in background</span>
            <span><Database size={15} /> Exportable report</span>
          </div>
        </div>

        <motion.div className="hero-console glass-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }}>
          <div className="console-topline">
            <div className="console-lights"><i /><i /><i /></div>
            <span>System monitor</span>
            <span className="console-live"><span className="pulse-dot" /> LIVE</span>
          </div>
          <div className="monitor-body">
            <div className="monitor-orbit">
              <div className="orbit-ring ring-a" />
              <div className="orbit-ring ring-b" />
              <div className="orbit-ring ring-c" />
              <div className="orbit-core"><BrainCircuit size={31} /></div>
              <span className="orbit-node node-a" />
              <span className="orbit-node node-b" />
              <span className="orbit-node node-c" />
            </div>
            <div className="monitor-info">
              <span className="micro-label">Status</span>
              <strong>{health === 'online' ? 'Operational' : health === 'checking' ? 'Connecting' : 'Disconnected'}</strong>
              <span className="monitor-sub">{serviceName}</span>
              <div className="monitor-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            </div>
          </div>
          <div className="console-footer">
            <span><span className={`status-dot ${statusDot}`} /> {health === 'online' ? 'Backend reachable' : health === 'checking' ? 'Checking connection' : 'Backend not reachable'}</span>
            <span>FastAPI · Celery · Redis</span>
          </div>
        </motion.div>
      </section>

      <section className="metrics section-wrap" data-stagger aria-label="Platform capabilities">
        <div className="metric-cell">
          <span className="metric-icon"><Network size={17} /></span>
          <div><strong>Multi-stage</strong><small>LangGraph</small></div>
        </div>
        <div className="metric-cell">
          <span className="metric-icon"><Zap size={17} /></span>
          <div><strong>Background</strong><small>Celery queue</small></div>
        </div>
        <div className="metric-cell">
          <span className="metric-icon"><Globe2 size={17} /></span>
          <div><strong>Web discovery</strong><small>Tavily search</small></div>
        </div>
        <div className="metric-cell">
          <span className="metric-icon"><FileText size={17} /></span>
          <div><strong>Structured output</strong><small>Validated data</small></div>
        </div>
      </section>

      <section className="workspace section-wrap" id="workspace">
        <div className="section-heading" data-reveal>
          <div>
            <h2>Workspace</h2>
            <p>Run a query and follow it to the final report.</p>
          </div>
          <div className={`run-state run-state-${runStatus.tone}`}>
            <span className="status-dot" />
            <div><strong>{runStatus.label}</strong><small>{runStatus.detail}</small></div>
          </div>
        </div>

        <div className="workspace-grid">
          <div className="query-card glass-panel" data-reveal>
            <div className="card-heading">
              <div className="heading-icon"><Search size={18} /></div>
              <div><h3>Research query</h3><p>What should the agent look into?</p></div>
              
            </div>

            <form onSubmit={handleRun}>
              <label className="field-label" htmlFor="research-query">Query</label>
              <textarea
                id="research-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Compare AI customer support platforms: pricing, features, availability"
                rows={5}
                maxLength={600}
                disabled={isRunning}
              />
              <div className="input-foot"><span>Specific queries give better results.</span><span>{query.length}/600</span></div>

              <div className="examples-block">
                <span className="field-label">Try an example</span>
                <div className="example-chips">
                  {EXAMPLE_QUERIES.map((example) => (
                    <button key={example} type="button" onClick={() => setQuery(example)} disabled={isRunning}>{example}<ArrowUpRight size={12} /></button>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={isRunning || !query.trim()}>
                  {isRunning ? <><LoaderCircle size={17} className="spin" /> Running</> : <><Play size={16} fill="currentColor" /> Run research <ArrowRight size={16} /></>}
                </button>
                <button className="quiet-button" type="button" onClick={resetWorkspace} disabled={isRunning}><RefreshCw size={14} /> Reset</button>
              </div>
              {errorMessage && (
                <motion.div className="error-banner" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                  <XCircle size={16} /><span>{errorMessage}</span>
                </motion.div>
              )}
            </form>
            <div className="query-card-foot"><ShieldCheck size={14} /> Processed by your FastAPI and Celery services.</div>
          </div>

          <div className="execution-card glass-panel" data-reveal>
            <div className="card-heading">
              <div className="heading-icon heading-icon-teal"><Activity size={18} /></div>
              <div><h3>Execution monitor</h3><p>Live task status.</p></div>
              
            </div>

            <div className="execution-status">
              <div className="execution-status-top"><span className="field-label">Celery state</span><span className={`state-badge state-${runStatus.tone}`}>{celeryState}</span></div>
              <div className="execution-main"><strong>{runStatus.label}</strong><span>{runStatus.detail}</span></div>
              <div className="execution-progress"><motion.div animate={{ width: isRunning ? (celeryState === 'PENDING' ? '22%' : '68%') : hasReport && !isTaskFailed ? '100%' : isTaskFailed ? '100%' : '0%' }} transition={{ duration: 0.65 }} /></div>
              <div className="progress-caption"><span>{isRunning ? 'Background task active' : hasReport ? 'Execution finished' : isTaskFailed ? 'Execution stopped' : 'No active execution'}</span><span>{duration}</span></div>
            </div>

            <div className="task-details">
              <div className="detail-row"><span>Task ID</span><div className="task-id-value">{taskId ? <><code>{taskId}</code><button type="button" aria-label="Copy task ID" onClick={() => copyText(taskId, 'task')}>{copied === 'task' ? <Check size={13} /> : <Copy size={13} />}</button></> : <span className="muted-value">Not assigned</span>}</div></div>
              <div className="detail-row"><span>Elapsed time</span><strong>{duration}</strong></div>
              <div className="detail-row"><span>Mode</span><strong>Async</strong></div>
              <div className="detail-row"><span>Endpoint</span><strong className="endpoint-value">/api/v1/task-status/{'{task_id}'}</strong></div>
            </div>

            <div className="monitor-note"><Radio size={14} /><span>Polls the status endpoint while a job runs. Per-step progress is not exposed by the API.</span></div>
          </div>
        </div>
      </section>

      <section className="workflow-section section-wrap" id="workflow" data-reveal>
        <div className="section-heading compact-heading">
          <div>
            <h2>How it works</h2>
            <p>Three stages in your LangGraph pipeline.</p>
          </div>
          <span className="workflow-tag"><Layers3 size={14} /> LangGraph</span>
        </div>

        <div className="pipeline-grid" data-stagger>
          <div className={`pipeline-step ${taskId ? 'pipeline-active' : ''}`}>
            <div className="pipeline-number">01</div><div className="pipeline-icon"><Search size={19} /></div>
            <h3>Discover</h3><p>Tavily finds the most relevant pages for your query.</p>
            <span className="pipeline-tech">Search node</span>
          </div>
          <div className="pipeline-connector"><span /></div>
          <div className={`pipeline-step ${isRunning && celeryState !== 'PENDING' ? 'pipeline-active' : ''}`}>
            <div className="pipeline-number">02</div><div className="pipeline-icon"><Globe2 size={19} /></div>
            <h3>Extract & structure</h3><p>Pages are loaded, cleaned and parsed into typed data.</p>
            <span className="pipeline-tech">Scraper node</span>
          </div>
          <div className="pipeline-connector"><span /></div>
          <div className={`pipeline-step ${hasReport ? 'pipeline-complete' : ''}`}>
            <div className="pipeline-number">03</div><div className="pipeline-icon"><FileText size={19} /></div>
            <h3>Synthesize</h3><p>Findings are combined into a Markdown report.</p>
            <span className="pipeline-tech">Finalizer node</span>
          </div>
        </div>
      </section>

      <section className="results-section section-wrap" data-reveal>
        <div className="section-heading compact-heading">
          <div>
            <h2>Report</h2>
            <p>The finished report appears here.</p>
          </div>
          {hasReport && (
            <div className="report-actions">
              <button type="button" className="outline-button" onClick={() => copyText(runResult?.final_report || '', 'report')}>{copied === 'report' ? <Check size={14} /> : <Copy size={14} />} {copied === 'report' ? 'Copied' : 'Copy report'}</button>
              <button type="button" className="outline-button" onClick={exportMarkdown}><ArrowDownToLine size={14} /> Export .md</button>
              <button type="button" className="outline-button" onClick={exportJson}><FileJson size={14} /> Export JSON</button>
            </div>
          )}
        </div>

        <div className={`report-card glass-panel ${hasReport ? 'report-ready' : ''}`} ref={reportRef}>
          {!hasReport ? (
            <div className="empty-report">
              <div className="empty-report-art"><div className="empty-ring ring-one" /><div className="empty-ring ring-two" /><FileText size={28} /></div>
              <span className="micro-label">No report yet</span>
              <h3>Nothing to show yet</h3>
              <p>Run a query and the report will render here.</p>
              <div className="empty-report-foot"><span><span className="status-dot dot-slate" /> No report loaded</span><span>Markdown ready</span></div>
            </div>
          ) : (
            <motion.div className="report-content-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="report-toolbar">
                <div className="report-file"><span className="file-icon"><FileText size={16} /></span><div><strong>Market intelligence report</strong><small>Markdown</small></div></div>
                <div className="report-summary-pills"><span><BadgeCheck size={13} /> {Number(runResult?.items_extracted || 0)} items</span><span><Clock3 size={13} /> {duration}</span></div>
              </div>
              <article className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as any}>
                  {runResult?.final_report || ''}
                </ReactMarkdown>
              </article>
              <div className="report-bottom-line"><span><ShieldCheck size={13} /> Generated by your agent workflow</span><span>CogniPulse</span></div>
            </motion.div>
          )}
        </div>
      </section>

      <section className="activity-section section-wrap" data-reveal>
        <div className="section-heading compact-heading">
          <div>
            <h2>Activity</h2>
            <p>API events for this run.</p>
          </div>
          <div className="activity-indicator"><span className={`status-dot ${isRunning ? 'dot-green pulse' : 'dot-slate'}`} /> {isRunning ? 'Monitoring' : 'Idle'}</div>
        </div>
        <div className="activity-card glass-panel">
          {events.length === 0 ? (
            <div className="activity-empty"><Terminal size={17} /><span>Events appear here once you run a query.</span></div>
          ) : (
            <div className="event-list">
              {events.map((item) => (
                <div className="event-row" key={item.id}>
                  <span className={`event-icon event-${item.tone}`}>{item.tone === 'success' ? <CheckCircle2 size={14} /> : item.tone === 'error' ? <XCircle size={14} /> : item.tone === 'warning' ? <CircleHelp size={14} /> : <Activity size={14} />}</span>
                  <span className="event-time">{item.time}</span>
                  <div className="event-copy"><strong>{item.title}</strong><span>{item.detail}</span></div>
                </div>
              ))}
            </div>
          )}
          <div className="activity-disclaimer"><Terminal size={13} /> Frontend and API events only, not worker logs.</div>
        </div>
      </section>

      <section className="technology-section section-wrap" id="technology" data-reveal>
        <div className="section-heading compact-heading">
          <div><h2>Stack</h2><p>What powers the pipeline.</p></div>
        </div>
        <div className="stack-grid" data-stagger>
          {TECH_GROUPS.map(({ title, blurb, icon: Icon, items }) => (
            <div className="stack-card glass-panel" key={title}>
              <div className="stack-head">
                <span className="heading-icon"><Icon size={18} /></span>
                <div><h3>{title}</h3><p>{blurb}</p></div>
              </div>
              <div className="stack-chips">{items.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer section-wrap">
        <div className="footer-brand"><span className="brand-mark"><BrainCircuit size={18} /></span><div><strong>CogniPulse</strong><small>Market intelligence</small></div></div>
        <p>Research · Extraction · Reporting</p>
        <div className="footer-credit"><span>Designed & developed by</span><strong>Mr Faizan</strong></div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        :root { color-scheme: dark; --bg: #05080f; --ink: #f3f7fc; --mut: #b4c1d1; --dim: #8e9db0; --line: rgba(255,255,255,.11); --acc: #5cc8ff; --acc-soft: rgba(92,200,255,.14); --amber: #f0bf6a; --red: #ff8f9c; --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace; }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; background: var(--bg); }
        body { margin: 0; background: var(--bg); color: var(--ink); font-family: Manrope, Inter, ui-sans-serif, system-ui, sans-serif; font-size: 15px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
        button, input, textarea { font: inherit; }
        button { cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .5; }
        a { color: inherit; text-decoration: none; }
        ::selection { background: rgba(92,200,255,.35); color: #fff; }
        a:focus-visible, button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid var(--acc); outline-offset: 3px; }

        .cp-shell { position: relative; min-height: 100vh; overflow: hidden; isolation: isolate; background: radial-gradient(ellipse 70% 40% at 50% -10%, rgba(34,110,180,.28), transparent), var(--bg); }
        .grid-overlay { position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .5; background-image: linear-gradient(rgba(140,190,235,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(140,190,235,.06) 1px, transparent 1px); background-size: 72px 72px; mask-image: linear-gradient(to bottom, #000, transparent 70%); animation: grid-drift 40s linear infinite; }
        @keyframes grid-drift { to { background-position: 72px 72px; } }
        .ambient { position: absolute; z-index: -1; pointer-events: none; border-radius: 50%; filter: blur(110px); animation: drift 22s ease-in-out infinite alternate; }
        .ambient-one { width: 420px; height: 420px; background: #0f6aa8; opacity: .38; top: 180px; left: -160px; }
        .ambient-two { width: 480px; height: 480px; background: #2a3f9c; opacity: .34; top: 760px; right: -220px; animation-delay: -6s; }
        .ambient-three { width: 380px; height: 380px; background: #0b7c8f; opacity: .22; top: 1900px; left: 28%; animation-delay: -11s; }
        @keyframes drift { to { transform: translate3d(50px, -34px, 0) scale(1.12); } }

        .section-wrap, .topbar { width: min(1160px, calc(100% - 64px)); margin-inline: auto; position: relative; }
        .glass-panel { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.025) 60%); backdrop-filter: blur(24px) saturate(1.5); -webkit-backdrop-filter: blur(24px) saturate(1.5); box-shadow: 0 30px 60px -28px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.16); transition: border-color .3s, transform .3s, box-shadow .3s; }
        .glass-panel:hover { border-color: rgba(120,205,255,.34); }

        .topbar { height: 78px; display: flex; align-items: center; gap: 48px; z-index: 5; }
        .brand, .footer-brand { display: flex; align-items: center; gap: 12px; }
        .brand-mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px; color: #bfeaff; border: 1px solid rgba(140,215,255,.35); background: linear-gradient(145deg, rgba(92,200,255,.28), rgba(20,50,90,.4)); box-shadow: inset 0 1px rgba(255,255,255,.2), 0 0 24px rgba(92,200,255,.18); }
        .brand-copy, .footer-brand > div { display: flex; flex-direction: column; line-height: 1.25; }
        .brand-copy strong, .footer-brand strong { font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
        .brand-copy small, .footer-brand small { color: var(--dim); font-size: 12px; }
        .top-nav { display: flex; gap: 30px; }
        .top-nav a { color: var(--mut); font-size: 14px; font-weight: 500; transition: color .2s; }
        .top-nav a:hover { color: #fff; }
        .top-actions { margin-left: auto; display: flex; align-items: center; gap: 20px; }
        .api-indicator { display: flex; align-items: center; gap: 9px; padding: 9px 14px; color: var(--ink); font-size: 13px; font-weight: 600; border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.05); backdrop-filter: blur(14px); transition: border-color .2s, background .2s; }
        .api-indicator:hover { border-color: rgba(120,205,255,.5); background: rgba(255,255,255,.08); }
        .api-indicator svg { color: var(--dim); transition: transform .25s; }
        .rotate-chevron { transform: rotate(180deg); }
        .docs-link { display: flex; align-items: center; gap: 6px; color: var(--mut); font-size: 13px; font-weight: 500; transition: color .2s; }
        .docs-link:hover { color: #fff; }
        .status-dot, .pulse-dot { width: 8px; height: 8px; display: inline-block; flex: 0 0 auto; border-radius: 50%; background: var(--dim); }
        .dot-green { background: var(--acc); box-shadow: 0 0 12px rgba(92,200,255,.6); animation: beacon 2.2s ease-out infinite; }
        .dot-amber { background: var(--amber); box-shadow: 0 0 10px rgba(240,191,106,.4); }
        .dot-red { background: var(--red); box-shadow: 0 0 10px rgba(255,143,156,.4); }
        .dot-slate { background: var(--dim); }
        .pulse { animation: beacon 1.6s ease-out infinite; }
        @keyframes beacon { 0% { box-shadow: 0 0 0 0 rgba(92,200,255,.5); } 80%, 100% { box-shadow: 0 0 0 9px rgba(92,200,255,0); } }
        .api-settings { position: absolute; top: 72px; right: max(32px, calc((100vw - 1160px) / 2)); z-index: 10; width: min(540px, calc(100% - 40px)); padding: 18px 20px; display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px 16px; align-items: center; }
        .api-settings p { margin: 2px 0 0; font-size: 14px; font-weight: 600; }
        .api-settings input { width: 100%; min-width: 0; padding: 11px 13px; color: var(--ink); font: 500 13px var(--mono); border: 1px solid rgba(255,255,255,.18); border-radius: 10px; background: rgba(2,6,12,.6); outline: none; }
        .api-settings input:focus { border-color: var(--acc); }
        .settings-note { grid-column: 2; color: var(--dim); font-size: 12px; text-align: right; }
        .eyebrow, .micro-label, .field-label { color: var(--acc); font-size: 13px; font-weight: 600; }
        .field-label { display: block; margin-bottom: 9px; color: var(--mut); }

        .hero { padding: 84px 0 64px; display: grid; grid-template-columns: 1.05fr .95fr; align-items: center; gap: 60px; }
        .eyebrow { display: inline-flex; align-items: center; gap: 10px; padding: 6px 12px 6px 10px; border: 1px solid rgba(92,200,255,.28); border-radius: 999px; background: var(--acc-soft); }
        .eyebrow-line { width: 7px; height: 7px; border-radius: 50%; background: var(--acc); box-shadow: 0 0 10px var(--acc); }
        .eyebrow-version { color: var(--mut); font: 500 12px var(--mono); }
        .hero h1 { max-width: 560px; margin: 24px 0 18px; font-size: clamp(42px, 5vw, 66px); line-height: 1.04; letter-spacing: -.045em; font-weight: 800; color: #fff; }
        .hero-description { max-width: 470px; margin: 0; color: var(--mut); font-size: 18px; line-height: 1.7; }
        .hero-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
        .hero-meta span { display: flex; align-items: center; gap: 8px; padding: 8px 13px; color: var(--ink); font-size: 13px; font-weight: 500; border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.04); }
        .hero-meta svg { color: var(--acc); }
        .hero-console { animation: float 7s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .hero-console::after { content: ""; position: absolute; left: 0; right: 0; top: -30%; height: 26%; pointer-events: none; background: linear-gradient(180deg, transparent, rgba(110,210,255,.14), transparent); animation: scan 6.5s ease-in-out infinite; }
        @keyframes scan { 0%, 15% { top: -30%; opacity: 0; } 30% { opacity: 1; } 100% { top: 110%; opacity: 0; } }
        .console-topline { display: flex; align-items: center; gap: 12px; height: 46px; padding: 0 18px; color: var(--mut); font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--line); }
        .console-lights { display: flex; gap: 6px; }
        .console-lights i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.2); }
        .console-live { display: flex; align-items: center; gap: 7px; margin-left: auto; color: var(--acc); font-weight: 700; }
        .pulse-dot { background: var(--acc); animation: blink 1.4s ease infinite; }
        @keyframes blink { 50% { opacity: .3; } }
        .monitor-body { display: flex; align-items: center; justify-content: space-evenly; gap: 24px; min-height: 230px; padding: 24px; }
        .monitor-orbit { position: relative; flex: 0 0 auto; width: 176px; height: 176px; display: grid; place-items: center; }
        .orbit-ring { position: absolute; border: 1px solid rgba(120,205,255,.3); border-radius: 50%; }
        .ring-a { inset: 4px; border-style: dashed; animation: rotate 26s linear infinite; }
        .ring-b { inset: 24px; border-color: rgba(150,170,255,.34); animation: rotate 18s linear infinite reverse; }
        .ring-c { inset: 42px; }
        @keyframes rotate { to { transform: rotate(360deg); } }
        .orbit-core { width: 68px; height: 68px; display: grid; place-items: center; border-radius: 22px; color: #d5f2ff; border: 1px solid rgba(140,215,255,.45); background: radial-gradient(circle at 30% 20%, rgba(92,200,255,.5), rgba(14,40,74,.85)); animation: core 3s ease-in-out infinite; }
        @keyframes core { 0%, 100% { box-shadow: 0 0 22px rgba(92,200,255,.25); transform: scale(1); } 50% { box-shadow: 0 0 46px rgba(92,200,255,.5); transform: scale(1.06); } }
        .orbit-node { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: #aee6ff; box-shadow: 0 0 14px #5cc8ff; }
        .node-a { top: 20px; left: 52px; animation: nodefloat 5s ease-in-out infinite; }
        .node-b { right: 16px; top: 84px; background: #a9a6ff; box-shadow: 0 0 14px #7f7bff; animation: nodefloat 6s ease-in-out infinite reverse; }
        .node-c { bottom: 24px; left: 38px; animation: nodefloat 7s ease-in-out infinite; }
        @keyframes nodefloat { 50% { transform: translate(6px, -8px); } }
        .monitor-info { flex: 1; min-width: 0; }
        .monitor-info > strong { display: block; margin-top: 6px; font-size: 30px; font-weight: 800; letter-spacing: -.03em; }
        .monitor-sub { display: block; margin-top: 6px; color: var(--mut); font-size: 13px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .monitor-bars { height: 30px; display: flex; align-items: flex-end; gap: 4px; margin-top: 18px; }
        .monitor-bars i { width: 5px; height: 60%; border-radius: 3px; background: linear-gradient(to top, #1b7fb5, #9ee3ff); animation: eq 1.2s ease-in-out infinite alternate; }
        .monitor-bars i:nth-child(3n) { animation-delay: -.7s; height: 90%; }
        .monitor-bars i:nth-child(2n) { animation-delay: -.3s; height: 40%; }
        .monitor-bars i:nth-child(5n) { height: 100%; }
        @keyframes eq { to { transform: scaleY(.4); opacity: .5; } }
        .console-footer { display: flex; justify-content: space-between; align-items: center; height: 44px; padding: 0 18px; color: var(--dim); font-size: 12px; border-top: 1px solid var(--line); }
        .console-footer > span:first-child { display: flex; align-items: center; gap: 8px; color: var(--mut); }

        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 0; }
        .metric-cell { display: flex; align-items: center; gap: 13px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 16px; background: rgba(255,255,255,.04); backdrop-filter: blur(16px); transition: transform .3s, border-color .3s, background .3s; }
        .metric-cell:hover { transform: translateY(-4px); border-color: rgba(120,205,255,.4); background: rgba(255,255,255,.07); }
        .metric-icon { width: 38px; height: 38px; display: grid; place-items: center; flex: 0 0 auto; color: var(--acc); border: 1px solid rgba(92,200,255,.3); border-radius: 11px; background: var(--acc-soft); transition: transform .35s; }
        .metric-cell:hover .metric-icon { transform: rotate(-8deg) scale(1.08); }
        .metric-cell div { display: flex; flex-direction: column; }
        .metric-cell strong { font-size: 14px; font-weight: 700; }
        .metric-cell small { color: var(--mut); font-size: 13px; }

        .workspace { padding-top: 96px; }
        .workflow-section, .results-section, .activity-section, .technology-section { padding-top: 96px; }
        .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 26px; }
        .section-heading h2 { margin: 0 0 6px; font-size: clamp(30px, 3.2vw, 40px); line-height: 1.12; letter-spacing: -.035em; font-weight: 800; }
        .section-heading p { margin: 0; color: var(--mut); font-size: 16px; }
        .run-state { display: flex; align-items: center; gap: 12px; min-width: 230px; padding: 12px 16px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,.05); backdrop-filter: blur(16px); }
        .run-state div { display: flex; flex-direction: column; line-height: 1.35; }
        .run-state strong { font-size: 14px; }
        .run-state small { color: var(--mut); font-size: 12px; }
        .run-state > .status-dot { width: 10px; height: 10px; }
        .run-state-green > .status-dot { background: var(--acc); box-shadow: 0 0 12px rgba(92,200,255,.6); animation: beacon 2.2s ease-out infinite; }
        .run-state-blue > .status-dot { background: #7fb2ff; box-shadow: 0 0 12px rgba(127,178,255,.6); }
        .run-state-amber > .status-dot { background: var(--amber); }
        .run-state-red > .status-dot { background: var(--red); }

        .workspace-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 18px; }
        .query-card, .execution-card { padding: 28px; min-width: 0; }
        .query-card:focus-within { border-color: rgba(120,205,255,.5); box-shadow: 0 30px 70px -26px rgba(0,0,0,.7), 0 0 40px rgba(60,160,230,.14), inset 0 1px 0 rgba(255,255,255,.16); }
        .card-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
        .heading-icon { width: 40px; height: 40px; display: grid; place-items: center; flex: 0 0 auto; color: var(--acc); border: 1px solid rgba(92,200,255,.3); border-radius: 12px; background: var(--acc-soft); }
        .heading-icon-teal { color: #b9b6ff; border-color: rgba(160,155,255,.35); background: rgba(120,110,230,.16); }
        .card-heading h3 { margin: 0; font-size: 17px; font-weight: 700; }
        .card-heading p { margin: 2px 0 0; color: var(--mut); font-size: 13px; }
        .query-card textarea { display: block; width: 100%; min-height: 150px; padding: 16px 18px; resize: vertical; color: #fff; font-size: 15px; line-height: 1.7; border: 1px solid rgba(255,255,255,.16); border-radius: 14px; background: rgba(2,6,12,.55); outline: none; transition: border-color .2s, box-shadow .2s; }
        .query-card textarea::placeholder { color: var(--dim); }
        .query-card textarea:focus { border-color: var(--acc); box-shadow: 0 0 0 4px rgba(92,200,255,.12); }
        .input-foot { display: flex; justify-content: space-between; margin-top: 8px; color: var(--dim); font-size: 12px; }
        .examples-block { margin-top: 22px; }
        .example-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .example-chips button { display: flex; align-items: center; gap: 7px; padding: 9px 13px; color: var(--ink); font-size: 13px; font-weight: 500; border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.05); transition: border-color .2s, background .2s, transform .2s; }
        .example-chips button:hover:not(:disabled) { border-color: rgba(120,205,255,.55); background: var(--acc-soft); transform: translateY(-2px); }
        .example-chips svg { color: var(--acc); }
        .form-actions { display: flex; align-items: center; gap: 16px; margin-top: 26px; }
        .primary-button { position: relative; overflow: hidden; min-height: 52px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 0 22px; color: #04121e; font-size: 14px; font-weight: 800; border: 0; border-radius: 13px; background: linear-gradient(180deg, #b8e9ff, #5cc8ff); box-shadow: 0 12px 30px -8px rgba(60,170,240,.55), inset 0 1px rgba(255,255,255,.7); transition: transform .25s, box-shadow .25s, filter .25s; }
        .primary-button::after { content: ""; position: absolute; top: -80%; left: -45%; width: 26%; height: 260%; transform: rotate(25deg); background: rgba(255,255,255,.55); filter: blur(6px); transition: left .7s; }
        .primary-button:hover:not(:disabled)::after { left: 130%; }
        .primary-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 38px -8px rgba(60,170,240,.7), inset 0 1px rgba(255,255,255,.7); }
        .primary-button:active:not(:disabled) { transform: scale(.985); }
        .quiet-button, .outline-button { display: inline-flex; align-items: center; gap: 8px; color: var(--mut); font-size: 13px; font-weight: 600; background: transparent; border: 0; padding: 9px 4px; transition: color .2s, transform .2s, border-color .2s, background .2s; }
        .quiet-button:hover:not(:disabled) { color: #fff; }
        .outline-button { padding: 9px 13px; color: var(--ink); border: 1px solid var(--line); border-radius: 10px; background: rgba(255,255,255,.05); }
        .outline-button:hover { border-color: rgba(120,205,255,.55); background: var(--acc-soft); transform: translateY(-2px); }
        .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
        .error-banner { display: flex; gap: 10px; margin-top: 16px; padding: 12px 14px; color: #ffc2ca; font-size: 13px; line-height: 1.55; border: 1px solid rgba(255,143,156,.35); border-radius: 12px; background: rgba(255,90,110,.1); }
        .error-banner svg { flex: 0 0 auto; margin-top: 2px; color: var(--red); }
        .query-card-foot { display: flex; align-items: center; gap: 8px; margin: 24px -28px -28px; padding: 14px 28px; color: var(--mut); font-size: 12px; border-top: 1px solid var(--line); background: rgba(0,0,0,.18); }
        .query-card-foot svg { color: var(--acc); }

        .execution-status { padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: rgba(2,6,12,.4); }
        .execution-status-top { display: flex; justify-content: space-between; align-items: center; }
        .execution-status-top .field-label { margin: 0; }
        .state-badge { padding: 4px 9px; color: var(--mut); font: 500 12px var(--mono); border: 1px solid var(--line); border-radius: 7px; background: rgba(255,255,255,.05); }
        .state-green { color: #bfeaff; border-color: rgba(92,200,255,.4); background: var(--acc-soft); }
        .state-blue { color: #b6d3ff; border-color: rgba(127,178,255,.4); background: rgba(127,178,255,.12); }
        .state-amber { color: var(--amber); border-color: rgba(240,191,106,.4); background: rgba(240,191,106,.1); }
        .state-red { color: var(--red); border-color: rgba(255,143,156,.4); background: rgba(255,90,110,.1); }
        .execution-main { display: flex; flex-direction: column; margin-top: 14px; }
        .execution-main strong { font-size: 26px; font-weight: 800; letter-spacing: -.03em; }
        .execution-main span { color: var(--mut); font-size: 13px; }
        .execution-progress { height: 5px; overflow: hidden; margin-top: 20px; border-radius: 9px; background: rgba(255,255,255,.1); }
        .execution-progress > div { position: relative; overflow: hidden; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #3aa6e0, #8fdcff); box-shadow: 0 0 16px rgba(92,200,255,.5); }
        .execution-progress > div::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); animation: shimmer 1.8s linear infinite; }
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        .progress-caption { display: flex; justify-content: space-between; margin-top: 8px; color: var(--dim); font-size: 12px; }
        .task-details { margin-top: 18px; }
        .detail-row { min-height: 40px; display: flex; justify-content: space-between; align-items: center; gap: 14px; color: var(--mut); font-size: 13px; border-bottom: 1px solid var(--line); }
        .detail-row:last-child { border-bottom: 0; }
        .detail-row strong { color: var(--ink); font-size: 13px; font-weight: 600; text-align: right; }
        .task-id-value { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .task-id-value code { overflow: hidden; max-width: 170px; color: #d3efff; font: 500 12px var(--mono); text-overflow: ellipsis; white-space: nowrap; }
        .task-id-value button { display: grid; place-items: center; padding: 4px; color: var(--acc); border: 0; background: transparent; }
        .muted-value { color: var(--dim); }
        .endpoint-value { font: 500 11px var(--mono) !important; color: var(--mut) !important; }
        .monitor-note { display: flex; gap: 8px; margin-top: 14px; color: var(--dim); font-size: 12px; line-height: 1.55; }
        .monitor-note svg { flex: 0 0 auto; margin-top: 2px; color: var(--acc); }

        .workflow-tag, .activity-indicator { display: flex; align-items: center; gap: 8px; color: var(--mut); font-size: 13px; font-weight: 600; }
        .workflow-tag { padding: 8px 13px; border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.04); }
        .pipeline-grid { display: grid; grid-template-columns: 1fr 44px 1fr 44px 1fr; align-items: center; }
        .pipeline-step { position: relative; overflow: hidden; min-height: 210px; padding: 24px; border: 1px solid var(--line); border-radius: 18px; background: linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); backdrop-filter: blur(20px); transition: transform .3s, border-color .3s, box-shadow .3s; }
        .pipeline-step:hover { transform: translateY(-6px); border-color: rgba(120,205,255,.5); box-shadow: 0 22px 44px -18px rgba(0,0,0,.6), 0 0 30px rgba(60,160,230,.14); }
        .pipeline-active, .pipeline-complete { border-color: rgba(92,200,255,.55); background: linear-gradient(160deg, rgba(92,200,255,.16), rgba(255,255,255,.03)); }
        .pipeline-step::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 2px; background: linear-gradient(180deg, transparent, var(--acc), transparent); opacity: .7; animation: signal 4s ease-in-out infinite; }
        .pipeline-step:nth-of-type(2)::before { animation-delay: -1.3s; } .pipeline-step:nth-of-type(3)::before { animation-delay: -2.6s; }
        @keyframes signal { 0%, 100% { transform: translateY(-100%); } 50% { transform: translateY(100%); } }
        .pipeline-number { position: absolute; top: 18px; right: 20px; color: var(--dim); font: 500 12px var(--mono); }
        .pipeline-icon { width: 42px; height: 42px; display: grid; place-items: center; color: var(--acc); border: 1px solid rgba(92,200,255,.3); border-radius: 12px; background: var(--acc-soft); }
        .pipeline-step h3 { margin: 20px 0 8px; font-size: 18px; font-weight: 700; }
        .pipeline-step p { min-height: 46px; margin: 0; color: var(--mut); font-size: 14px; line-height: 1.65; }
        .pipeline-tech { display: inline-block; margin-top: 16px; color: var(--acc); font: 500 12px var(--mono); }
        .pipeline-connector { position: relative; height: 1px; background: linear-gradient(90deg, rgba(92,200,255,.1), rgba(92,200,255,.55), rgba(92,200,255,.1)); }
        .pipeline-connector span { position: absolute; top: -2px; left: 0; width: 5px; height: 5px; border-radius: 50%; background: #bfeaff; box-shadow: 0 0 10px var(--acc); animation: travel 2.4s ease-in-out infinite; }
        .pipeline-connector:nth-child(4) span { animation-delay: 1.2s; }
        @keyframes travel { to { left: calc(100% - 5px); } }
        @keyframes travel-down { to { top: calc(100% - 5px); } }

        .report-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .report-card { min-height: 320px; }
        .empty-report { min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
        .empty-report-art { position: relative; width: 74px; height: 74px; display: grid; place-items: center; margin-bottom: 20px; color: var(--acc); border: 1px solid rgba(92,200,255,.3); border-radius: 20px; background: var(--acc-soft); }
        .empty-ring { position: absolute; border: 1px solid rgba(92,200,255,.2); border-radius: 50%; }
        .ring-one { inset: -12px; border-style: dashed; animation: rotate 20s linear infinite; } .ring-two { inset: -24px; border-color: rgba(92,200,255,.1); }
        .empty-report h3 { margin: 10px 0 6px; font-size: 20px; font-weight: 700; }
        .empty-report p { max-width: 400px; margin: 0; color: var(--mut); font-size: 14px; }
        .empty-report-foot { width: 100%; max-width: 560px; display: flex; justify-content: space-between; margin-top: 32px; padding-top: 14px; color: var(--dim); font-size: 12px; border-top: 1px solid var(--line); }
        .empty-report-foot span:first-child { display: flex; align-items: center; gap: 8px; }
        .report-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--line); background: rgba(0,0,0,.16); }
        .report-file { display: flex; align-items: center; gap: 12px; }
        .report-file div { display: flex; flex-direction: column; line-height: 1.3; }
        .file-icon { width: 36px; height: 36px; display: grid; place-items: center; color: var(--acc); border: 1px solid rgba(92,200,255,.3); border-radius: 10px; background: var(--acc-soft); }
        .report-file strong { font-size: 15px; } .report-file small { color: var(--dim); font-size: 12px; }
        .report-summary-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .report-summary-pills span { display: flex; align-items: center; gap: 6px; padding: 6px 11px; color: var(--ink); font-size: 12px; font-weight: 600; border: 1px solid var(--line); border-radius: 999px; }
        .report-summary-pills svg { color: var(--acc); }
        .markdown-body { max-width: 860px; margin: 0 auto; padding: 36px 40px 40px; color: #dfe9f4; font-size: 16px; line-height: 1.85; overflow-wrap: anywhere; }
        .markdown-body h1 { margin: 0 0 22px; padding-bottom: 14px; color: #fff; font-size: 30px; line-height: 1.25; letter-spacing: -.03em; border-bottom: 1px solid var(--line); }
        .markdown-body h2 { margin: 32px 0 12px; color: #aee6ff; font-size: 22px; letter-spacing: -.02em; }
        .markdown-body h3 { margin: 24px 0 10px; color: #fff; font-size: 18px; }
        .markdown-body p { margin: 12px 0 16px; } .markdown-body strong { color: #fff; }
        .markdown-body ul, .markdown-body ol { margin: 12px 0 18px; padding-left: 26px; } .markdown-body li { margin: 6px 0; } .markdown-body li::marker { color: var(--acc); }
        .markdown-body blockquote { margin: 16px 0; padding: 6px 16px; color: var(--mut); border-left: 3px solid var(--acc); background: var(--acc-soft); border-radius: 0 10px 10px 0; }
        .markdown-body code { padding: 2px 6px; color: #bfeaff; font: 500 13px var(--mono); border: 1px solid var(--line); border-radius: 6px; background: rgba(2,6,12,.6); }
        .markdown-body pre { overflow-x: auto; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: rgba(2,6,12,.7); } .markdown-body pre code { padding: 0; border: 0; background: none; }
        .markdown-body a { color: var(--acc); text-decoration: underline; text-underline-offset: 3px; }
        .markdown-body hr { margin: 24px 0; border: 0; border-top: 1px solid var(--line); }
        .markdown-body table { width: 100%; margin: 16px 0 20px; border-collapse: collapse; font-size: 14px; }
        .markdown-body th, .markdown-body td { padding: 11px 14px; text-align: left; border: 1px solid var(--line); }
        .markdown-body th { color: #fff; background: rgba(92,200,255,.14); } .markdown-body td { color: #dfe9f4; }
        .report-bottom-line { display: flex; justify-content: space-between; gap: 12px; padding: 13px 24px; color: var(--dim); font-size: 12px; border-top: 1px solid var(--line); }
        .report-bottom-line span:first-child { display: flex; align-items: center; gap: 7px; } .report-bottom-line svg { color: var(--acc); }

        .activity-card { border-radius: 18px; }
        .activity-empty { min-height: 96px; display: flex; justify-content: center; align-items: center; gap: 10px; color: var(--mut); font-size: 14px; }
        .activity-empty svg { color: var(--acc); }
        .event-list { padding: 8px 22px; }
        .event-row { display: grid; grid-template-columns: 30px 84px 1fr; gap: 14px; align-items: center; min-height: 66px; border-bottom: 1px solid var(--line); animation: event-in .45s cubic-bezier(.2,.8,.2,1) both; transition: background .2s; }
        .event-row:last-child { border-bottom: 0; } .event-row:hover { background: rgba(255,255,255,.03); }
        @keyframes event-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .event-icon { width: 28px; height: 28px; display: grid; place-items: center; color: var(--mut); border-radius: 8px; background: rgba(255,255,255,.07); }
        .event-success { color: var(--acc); background: var(--acc-soft); } .event-warning { color: var(--amber); background: rgba(240,191,106,.12); } .event-error { color: var(--red); background: rgba(255,90,110,.12); }
        .event-time { color: var(--dim); font: 500 12px var(--mono); }
        .event-copy { display: flex; flex-direction: column; min-width: 0; } .event-copy strong { font-size: 14px; } .event-copy span { color: var(--mut); font-size: 13px; overflow-wrap: anywhere; }
        .activity-disclaimer { display: flex; align-items: center; gap: 8px; padding: 12px 22px; color: var(--dim); font-size: 12px; border-top: 1px solid var(--line); background: rgba(0,0,0,.16); }

        .stack-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .stack-card { padding: 26px; }
        .stack-card:hover { transform: translateY(-5px); box-shadow: 0 30px 60px -22px rgba(0,0,0,.7), 0 0 36px rgba(60,160,230,.12), inset 0 1px 0 rgba(255,255,255,.16); }
        .stack-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
        .stack-head h3 { margin: 0; font-size: 18px; font-weight: 700; } .stack-head p { margin: 2px 0 0; color: var(--mut); font-size: 13px; }
        .stack-chips { display: flex; flex-wrap: wrap; gap: 9px; }
        .stack-chips span { padding: 8px 14px; color: var(--ink); font-size: 14px; font-weight: 600; border: 1px solid var(--line); border-radius: 10px; background: rgba(255,255,255,.05); transition: border-color .2s, background .2s, transform .2s; }
        .stack-chips span:hover { border-color: rgba(120,205,255,.55); background: var(--acc-soft); transform: translateY(-2px); }

        .footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 96px; padding: 26px 0 34px; border-top: 1px solid var(--line); }
        .footer > p { margin: 0; color: var(--dim); font-size: 13px; }
        .footer-brand .brand-mark { width: 34px; height: 34px; }
        .footer-credit { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.35; }
        .footer-credit span { color: var(--dim); font-size: 12px; } .footer-credit strong { color: #bfeaff; font-size: 15px; font-weight: 700; }

        @media (max-width: 900px) {
          .section-wrap, .topbar { width: min(100% - 42px, 720px); }
          .top-nav { display: none; }
          .hero { grid-template-columns: 1fr; gap: 36px; padding-top: 56px; }
          .hero-console { max-width: 620px; width: 100%; }
          .workspace-grid, .stack-grid { grid-template-columns: 1fr; }
          .metrics { grid-template-columns: repeat(2, 1fr); }
          .pipeline-grid { grid-template-columns: 1fr; gap: 10px; }
          .pipeline-step { min-height: auto; } .pipeline-step p { min-height: 0; }
          .pipeline-connector { width: 1px; height: 22px; margin: 0 auto; background: linear-gradient(to bottom, rgba(92,200,255,.1), rgba(92,200,255,.55), rgba(92,200,255,.1)); }
          .pipeline-connector span { top: 0; left: -2px; animation-name: travel-down; }
        }
        @media (max-width: 620px) {
          .section-wrap, .topbar { width: calc(100% - 32px); }
          .topbar { height: 68px; } .docs-link { display: none; }
          .hero { padding: 40px 0 44px; } .hero-description { font-size: 16px; } .hero-console { animation: none; }
          .monitor-body { padding: 18px 14px; gap: 12px; min-height: 180px; } .monitor-orbit { width: 124px; height: 124px; } .orbit-core { width: 54px; height: 54px; border-radius: 17px; } .monitor-info > strong { font-size: 22px; }
          .metrics { gap: 10px; } .metric-cell { padding: 12px; gap: 10px; } .metric-icon { width: 32px; height: 32px; } .metric-cell strong { font-size: 13px; } .metric-cell small { font-size: 12px; }
          .workspace, .workflow-section, .results-section, .activity-section, .technology-section { padding-top: 68px; }
          .section-heading { flex-direction: column; align-items: flex-start; gap: 14px; } .run-state { width: 100%; min-width: 0; }
          .query-card, .execution-card, .stack-card { padding: 20px; } .query-card-foot { margin: 20px -20px -20px; padding: 13px 20px; }
          .form-actions { flex-wrap: wrap; } .primary-button { flex: 1; }
          .report-actions { width: 100%; } .report-actions button { flex: 1; justify-content: center; }
          .report-toolbar { flex-direction: column; align-items: flex-start; } .report-bottom-line { flex-direction: column; }
          .markdown-body { padding: 24px 18px; font-size: 15px; } .markdown-body h1 { font-size: 24px; } .markdown-body h2 { font-size: 20px; } .markdown-body table { font-size: 12px; }
          .event-row { grid-template-columns: 28px 1fr; } .event-time { grid-column: 2; }
          .footer { flex-wrap: wrap; align-items: flex-start; margin-top: 64px; } .footer > p { order: 3; width: 100%; } .footer-credit { margin-left: auto; }
          .api-settings { top: 64px; right: 16px; grid-template-columns: 1fr; } .settings-note { grid-column: 1; text-align: left; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
        }

      `}</style>
    </main>
  );
}
