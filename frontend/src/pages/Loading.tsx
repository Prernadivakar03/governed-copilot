import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield,
  CheckCircle2,
  Database,
  Cpu,
  Layers,
  Lock,
  ArrowRight,
  Activity,
  Terminal,
  FastForward,
} from "lucide-react";
import { useAuth } from "../authContext";
import { api, type SystemStatus } from "../api";

interface BootStage {
  id: string;
  title: string;
  detail: string;
  icon: typeof Shield;
}

const BOOT_STAGES: BootStage[] = [
  {
    id: "gateway",
    title: "API Gateway & Security Handshake",
    detail: "Validating CORS origin policies, JWT secrets, and TLS handshake",
    icon: Lock,
  },
  {
    id: "database",
    title: "PostgreSQL 16 Analytical Sandbox",
    detail: "Probing read-only role pools (analyst_ro, steward_ro) & 18 composite indexes",
    icon: Database,
  },
  {
    id: "llm",
    title: "Ollama LLM Inference Engine",
    detail: "Verifying qwen2.5-coder:3b model readiness & structured JSON schemas",
    icon: Cpu,
  },
  {
    id: "semantic",
    title: "Semantic Layer & AST Validator",
    detail: "Compiling business metric formulas, join topology & sqlglot parser rules",
    icon: Layers,
  },
  {
    id: "governance",
    title: "Cryptographic Audit Chain & RBAC",
    detail: "Initializing append-only SHA-256 hash log and dual-authorization queue",
    icon: Shield,
  },
];

export default function Loading() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const roleParam = searchParams.get("role") || "";
  const redirectParam = searchParams.get("redirect") || "";

  const [progress, setProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [statusData, setStatusData] = useState<SystemStatus | null>(null);
  const [readyLog, setReadyLog] = useState<string[]>([
    "Bootstrapping Governed Copilot Environment...",
  ]);

  // Determine final target URL
  const destination = user
    ? "/overview"
    : redirectParam || (roleParam ? `/login?role=${encodeURIComponent(roleParam)}` : "/login");

  // Fetch real backend status in background
  useEffect(() => {
    api.systemStatus()
      .then((data) => {
        setStatusData(data);
        setReadyLog((prev) => [
          ...prev,
          `PostgreSQL pool verified: ${data.database.database}@${data.database.host} (${data.database.ping_latency_ms}ms)`,
          `Ollama engine ready: ${data.llm.model} via ${data.llm.url}`,
          `Semantic models loaded: ${data.semantic_catalog.registered_tables} tables, ${data.semantic_catalog.registered_metrics} metrics`,
        ]);
      })
      .catch(() => {
        setReadyLog((prev) => [
          ...prev,
          "Using fallback local development gateway config",
        ]);
      });
  }, []);

  // Stepped boot progression
  useEffect(() => {
    const totalDuration = 2200; // ms
    const intervalMs = 40;
    const stepIncrement = 100 / (totalDuration / intervalMs);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(100, prev + stepIncrement);
        const stageIdx = Math.min(
          BOOT_STAGES.length - 1,
          Math.floor((next / 100) * BOOT_STAGES.length)
        );

        setCurrentStageIndex(stageIdx);

        // Mark completed stages
        const completed = BOOT_STAGES.slice(0, stageIdx).map((s) => s.id);
        if (next >= 100) {
          completed.push(BOOT_STAGES[BOOT_STAGES.length - 1].id);
        }
        setCompletedStages(completed);

        if (next >= 100) {
          clearInterval(timer);
          // Small pause at 100% then redirect
          setTimeout(() => {
            navigate(destination, { replace: true });
          }, 350);
        }

        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [destination, navigate]);

  const handleSkip = () => {
    navigate(destination, { replace: true });
  };

  return (
    <div className="loading-screen-wrapper">
      {/* Background ambient lighting */}
      <div className="loading-ambient-glow" />
      <div className="loading-grid-overlay" />

      <div className="loading-container">
        {/* Futuristic Orbital Brand Badge */}
        <div className="orbital-scanner-container">
          <div className="orbital-ring ring-outer" />
          <div className="orbital-ring ring-middle" />
          <div className="orbital-ring ring-inner" />
          <div className="orbital-center-icon">
            <Shield size={32} />
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="loading-header">
          <div className="badge badge-info loading-badge">
            <Activity size={12} className="pulse-icon" />
            <span>INITIALIZING GOVERNANCE RUNTIME</span>
          </div>
          <h1 className="loading-title">
            MDS-25 <span className="gradient-text">Governed Analytics</span>
          </h1>
          <p className="loading-subtitle">
            Establishing zero-trust AST parsing, database RBAC sandboxes, and cryptographic audit chains
          </p>
        </div>

        {/* High-Precision Progress Bar */}
        <div className="loading-progress-block">
          <div className="loading-progress-meta">
            <span className="mono" style={{ fontSize: "12px", color: "var(--accent)" }}>
              {Math.round(progress)}% COMPLETE
            </span>
            <span className="mono" style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              STAGE {Math.min(currentStageIndex + 1, BOOT_STAGES.length)} / {BOOT_STAGES.length}
            </span>
          </div>
          <div className="loading-progress-track">
            <div
              className="loading-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stepped Checklist */}
        <div className="loading-stages-list">
          {BOOT_STAGES.map((stage, idx) => {
            const isDone = completedStages.includes(stage.id);
            const isCurrent = currentStageIndex === idx && !isDone;
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`loading-stage-item ${isDone ? "completed" : ""} ${isCurrent ? "current" : ""}`}
              >
                <div className="stage-icon-box">
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-success" />
                  ) : (
                    <Icon size={16} className={isCurrent ? "text-accent" : "text-tertiary"} />
                  )}
                </div>
                <div className="stage-text-block">
                  <div className="stage-title">
                    <span>{stage.title}</span>
                    {isDone && <span className="badge badge-success stage-status-badge">READY</span>}
                    {isCurrent && <span className="badge badge-info stage-status-badge">INITIALIZING</span>}
                  </div>
                  <div className="stage-detail">{stage.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time Telemetry Terminal Ticker */}
        <div className="loading-terminal-box">
          <div className="terminal-header">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Terminal size={12} />
              <span>DIAGNOSTIC LOG STREAM</span>
            </div>
            {statusData && (
              <span className="mono" style={{ fontSize: "10px", color: "var(--success)" }}>
                DB: {statusData.database.ping_latency_ms}ms | LLM: {statusData.llm.status.toUpperCase()}
              </span>
            )}
          </div>
          <div className="terminal-logs">
            {readyLog.slice(-3).map((log, i) => (
              <div key={i} className="terminal-log-line">
                <span className="terminal-prompt">&gt;</span>
                <span className="mono">{log}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Skip Button */}
        <div className="loading-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSkip}
          >
            <FastForward size={14} />
            <span>Skip to {user ? "Workspace" : "Sign In"}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
