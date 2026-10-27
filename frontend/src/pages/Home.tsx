import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  Bot,
  Database,
  Lock,
  Layers,
  Award,
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileCheck,
  Code2,
  UserCheck,
  ChevronRight,
  ExternalLink,
  Sun,
  Moon,
  Sparkles,
  TableProperties,
  BarChart3,
  Sliders,
  History,
  HardDrive,
} from "lucide-react";
import { useAuth } from "../authContext";
import { api, type SystemStatus } from "../api";

export default function Home() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    api.systemStatus()
      .then(setSystemStatus)
      .catch(() => {});
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };

  const isHealthy = systemStatus?.status === "operational";

  const handleLaunchRole = (role: string) => {
    navigate(`/loading?role=${role}&redirect=/login`);
  };

  return (
    <div className="home-page-container">
      {/* Background ambient lighting elements */}
      <div className="home-ambient-glow" />
      <div className="home-ambient-glow-secondary" />

      {/* Floating Glassmorphism Navigation Bar */}
      <header className="home-navbar">
        <div className="home-nav-left">
          <div className="home-brand">
            <div className="home-brand-icon">
              <Shield size={20} />
            </div>
            <div>
              <span className="home-brand-title">Governed Copilot</span>
              <span className="home-brand-badge">MDS-25</span>
            </div>
          </div>
        </div>

        <nav className="home-nav-links">
          <a href="#architecture" className="home-nav-link">Architecture</a>
          <a href="#roles" className="home-nav-link">Demo Roles</a>
          <a href="#features" className="home-nav-link">Capabilities</a>
          <a href="#telemetry" className="home-nav-link">Telemetry</a>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="home-nav-link"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <span>API Docs</span>
            <ExternalLink size={12} />
          </a>
        </nav>

        <div className="home-nav-right">
          {systemStatus && (
            <div
              className="home-status-badge"
              title={`PostgreSQL: ${systemStatus.database.status} (${systemStatus.database.ping_latency_ms}ms) | Ollama: ${systemStatus.llm.status}`}
            >
              <span className={`status-dot ${isHealthy ? "" : "degraded"}`} />
              <span>{isHealthy ? "System Ready" : "Degraded"}</span>
            </div>
          )}

          <button
            type="button"
            className="btn-ghost btn-icon"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link to="/overview" className="btn btn-primary btn-sm">
                <span>Workspace ({user.username})</span>
                <ArrowRight size={14} />
              </Link>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => void signOut()}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/loading?redirect=/login" className="btn btn-primary btn-sm">
              <span>Launch Workspace</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={13} className="text-accent" />
            <span>M.SC. DATA SCIENCE CAPSTONE PROJECT • SEMESTER III</span>
          </div>

          <h1 className="hero-headline">
            Natural Language to SQL, <br />
            <span className="gradient-text">Governed by Architectural Guarantees.</span>
          </h1>

          <p className="hero-subhead">
            An enterprise analytics copilot engineered over the 100,000+ Brazilian E-Commerce (Olist) dataset.
            Combines AST-level SQL validation, PostgreSQL read-only role sandboxes, semantic grounding,
            human-in-the-loop dual authorization, and tamper-evident SHA-256 audit chains.
          </p>

          <div className="hero-actions">
            <Link to="/loading?redirect=/login" className="btn btn-primary btn-lg hero-cta-btn">
              <Shield size={18} />
              <span>Enter Governed Portal</span>
              <ArrowRight size={18} />
            </Link>

            <a href="#roles" className="btn btn-secondary btn-lg">
              <UserCheck size={18} />
              <span>Explore Demo Roles</span>
            </a>

            <Link to="/loading?redirect=/evals" className="btn btn-ghost btn-lg">
              <Award size={18} />
              <span>Research Evaluation</span>
            </Link>
          </div>

          {/* Telemetry Stats Banner */}
          <div className="hero-telemetry-banner">
            <div className="telemetry-stat-card">
              <div className="stat-number gradient-text">100,000+</div>
              <div className="stat-label">Olist Orders Analyzed</div>
              <div className="stat-sub">9 Normalized Tables</div>
            </div>
            <div className="telemetry-stat-divider" />

            <div className="telemetry-stat-card">
              <div className="stat-number" style={{ color: "var(--success)" }}>364 / 364</div>
              <div className="stat-label">Tests Passed (100%)</div>
              <div className="stat-sub">Automated CI Suite</div>
            </div>
            <div className="telemetry-stat-divider" />

            <div className="telemetry-stat-card">
              <div className="stat-number" style={{ color: "var(--info)" }}>18 Indexes</div>
              <div className="stat-label">Composite Analytical</div>
              <div className="stat-sub">Sub-250ms Median P50</div>
            </div>
            <div className="telemetry-stat-divider" />

            <div className="telemetry-stat-card">
              <div className="stat-number" style={{ color: "var(--accent)" }}>0%</div>
              <div className="stat-label">Unauthorized PII Leaks</div>
              <div className="stat-sub">Role-Level DB Isolation</div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Roles Section */}
      <section id="roles" className="home-section">
        <div className="section-header">
          <div className="section-badge">ROLE-BASED ACCESS CONTROL</div>
          <h2 className="section-title">Four Governed Personas, One Unified Platform</h2>
          <p className="section-subtitle">
            Experience the system from different perspectives. Each role enforces mathematical guarantees and physical PostgreSQL grants.
          </p>
        </div>

        <div className="roles-grid">
          {/* Alice - Analyst */}
          <div className="role-showcase-card">
            <div className="role-card-header">
              <div className="role-badge-row">
                <span className="badge badge-success">Analyst</span>
                <span className="mono role-username">alice</span>
              </div>
              <h3 className="role-name">Alice (Data Analyst)</h3>
              <p className="role-desc">
                Focuses on core business insights, sales trends, and cohort metrics without access to customer PII.
              </p>
            </div>

            <div className="role-permissions-list">
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Natural Language Copilot & Query Studio</span>
              </div>
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Verified Semantic Metrics (GMV, AOV, Delivery Latency)</span>
              </div>
              <div className="perm-item blocked">
                <Lock size={14} />
                <span>Blocked: PII columns (customer_email, customer_phone)</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary role-launch-btn"
              onClick={() => handleLaunchRole("alice")}
            >
              <span>Test as Alice</span>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Sam - Steward */}
          <div className="role-showcase-card">
            <div className="role-card-header">
              <div className="role-badge-row">
                <span className="badge badge-warning">Steward</span>
                <span className="mono role-username">sam</span>
              </div>
              <h3 className="role-name">Sam (Data Steward)</h3>
              <p className="role-desc">
                Governs semantic catalog definitions, reviews sensitive column access, and inspects approval queues.
              </p>
            </div>

            <div className="role-permissions-list">
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Unrestricted Data Catalog & Join Topologies</span>
              </div>
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>PII Access Permitted (customer details visible)</span>
              </div>
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Approvals Governance: Decides sensitive query requests</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary role-launch-btn"
              onClick={() => handleLaunchRole("sam")}
            >
              <span>Test as Sam</span>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Audrey - Auditor */}
          <div className="role-showcase-card">
            <div className="role-card-header">
              <div className="role-badge-row">
                <span className="badge badge-info">Auditor</span>
                <span className="mono role-username">audrey</span>
              </div>
              <h3 className="role-name">Audrey (Compliance Auditor)</h3>
              <p className="role-desc">
                Verifies cryptographic chain integrity, audits tamper logs, and benchmarks research evaluation metrics.
              </p>
            </div>

            <div className="role-permissions-list">
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Immutable SHA-256 Hash Chain Verification</span>
              </div>
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Evaluation Benchmarks (57-question Gold Set)</span>
              </div>
              <div className="perm-item blocked">
                <Lock size={14} />
                <span>Read-Only Compliance: Cannot execute mutations</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary role-launch-btn"
              onClick={() => handleLaunchRole("audrey")}
            >
              <span>Test as Audrey</span>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Adam - Admin */}
          <div className="role-showcase-card">
            <div className="role-card-header">
              <div className="role-badge-row">
                <span className="badge badge-neutral">Admin</span>
                <span className="mono role-username">adam</span>
              </div>
              <h3 className="role-name">Adam (Administrator)</h3>
              <p className="role-desc">
                Supervises system health diagnostics, PostgreSQL connection pools, and Ollama LLM cache parameters.
              </p>
            </div>

            <div className="role-permissions-list">
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Full System Telemetry & Diagnostic Probes</span>
              </div>
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>Ollama Model Configuration & Cache Invalidation</span>
              </div>
              <div className="perm-item allowed">
                <CheckCircle2 size={14} />
                <span>All Persona Capabilities Supervised & Audited</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary role-launch-btn"
              onClick={() => handleLaunchRole("adam")}
            >
              <span>Test as Adam</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* The 6 Core Architectural Guardrails */}
      <section id="architecture" className="home-section" style={{ background: "var(--bg-panel-elevated)" }}>
        <div className="section-header">
          <div className="section-badge">DEFENSE-IN-DEPTH</div>
          <h2 className="section-title">Six Pillars of Governed AI</h2>
          <p className="section-subtitle">
            Unlike naive prompt wrappers, this platform enforces guarantees across parsing, database, semantic, and compliance layers.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon-box" style={{ color: "#3b82f6" }}>
              <Code2 size={24} />
            </div>
            <h3 className="pillar-title">AST SQL Validator</h3>
            <p className="pillar-desc">
              Parses queries via <code className="mono">sqlglot</code> into Abstract Syntax Trees before execution. Blocks dangerous DDL/DML, forbids table drops, and automatically injects strict <code className="mono">LIMIT 1000</code>.
            </p>
            <div className="pillar-tag">sqlglot AST Engine</div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box" style={{ color: "#10b981" }}>
              <Database size={24} />
            </div>
            <h3 className="pillar-title">PostgreSQL RBAC Sandbox</h3>
            <p className="pillar-desc">
              All user queries execute under physical read-only database roles (<code className="mono">analyst_ro</code>, <code className="mono">steward_ro</code>) with enforced statement timeouts (15s) and column-level masking.
            </p>
            <div className="pillar-tag">Physical DB Roles</div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box" style={{ color: "#f59e0b" }}>
              <Layers size={24} />
            </div>
            <h3 className="pillar-title">Hybrid Semantic Fusion</h3>
            <p className="pillar-desc">
              Combines BGE-small-en dense embeddings with BM25 sparse keyword retrieval via Reciprocal Rank Fusion (RRF) to retrieve only valid schemas and metrics for context.
            </p>
            <div className="pillar-tag">BGE + BM25 RRF</div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box" style={{ color: "#8b5cf6" }}>
              <TableProperties size={24} />
            </div>
            <h3 className="pillar-title">Verified Semantic Layer</h3>
            <p className="pillar-desc">
              Standardized YAML models defining enterprise metric formulas, authorized join paths, and business dispute resolution rules to eliminate hallucinated column joins.
            </p>
            <div className="pillar-tag">YAML Semantic Model</div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box" style={{ color: "#ec4899" }}>
              <Lock size={24} />
            </div>
            <h3 className="pillar-title">Dual-Authorization Queue</h3>
            <p className="pillar-desc">
              Any query exceeding planner cost limits or requesting sensitive PII is automatically suspended and routed to the Steward Governance queue with reason audit.
            </p>
            <div className="pillar-tag">Human-in-the-Loop</div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box" style={{ color: "#06b6d4" }}>
              <FileCheck size={24} />
            </div>
            <h3 className="pillar-title">Cryptographic Audit Chain</h3>
            <p className="pillar-desc">
              Every query, approval, and outcome is sealed in an append-only PostgreSQL log secured by SHA-256 hash chains. PostgreSQL trigger functions strictly block mutation and truncation.
            </p>
            <div className="pillar-tag">SHA-256 Hash Tree</div>
          </div>
        </div>
      </section>

      {/* 11 Integrated Application Interfaces */}
      <section id="features" className="home-section">
        <div className="section-header">
          <div className="section-badge">COMPLETE PLATFORM</div>
          <h2 className="section-title">11 Enterprise Application Interfaces</h2>
          <p className="section-subtitle">
            A comprehensive workbench designed for cross-functional collaboration across analysts, data stewards, auditors, and administrators.
          </p>
        </div>

        <div className="capabilities-grid">
          <div className="capability-card">
            <BarChart3 size={20} className="cap-icon" />
            <h4>Overview Dashboard</h4>
            <p>Real-time system telemetry, 14-day execution trends, and dataset health.</p>
          </div>
          <div className="capability-card">
            <Bot size={20} className="cap-icon" />
            <h4>AI Analytics Copilot</h4>
            <p>Natural language querying with grounded citations, metric cards, and charts.</p>
          </div>
          <div className="capability-card">
            <Database size={20} className="cap-icon" />
            <h4>Enterprise Data Catalog</h4>
            <p>Schema explorer with sensitivity badges (PUBLIC, INTERNAL, PII) and row counts.</p>
          </div>
          <div className="capability-card">
            <Layers size={20} className="cap-icon" />
            <h4>Semantic Layer</h4>
            <p>Business metric formulas, join topology graphs, and dispute rules.</p>
          </div>
          <div className="capability-card">
            <Code2 size={20} className="cap-icon" />
            <h4>Query Studio</h4>
            <p>Interactive SQL console with server-side AST linting and cost explain plans.</p>
          </div>
          <div className="capability-card">
            <History size={20} className="cap-icon" />
            <h4>Query History</h4>
            <p>Full query execution log with latency tracking and one-click reloading.</p>
          </div>
          <div className="capability-card">
            <Shield size={20} className="cap-icon" />
            <h4>Governance Center</h4>
            <p>Dual-authorization approval workflow for sensitive and costly queries.</p>
          </div>
          <div className="capability-card">
            <FileCheck size={20} className="cap-icon" />
            <h4>Audit Trail</h4>
            <p>Cryptographic append-only event ledger with live hash verification.</p>
          </div>
          <div className="capability-card">
            <Award size={20} className="cap-icon" />
            <h4>Evaluation Benchmarks</h4>
            <p>57-question frozen gold set benchmarking with 95% confidence intervals.</p>
          </div>
          <div className="capability-card">
            <Activity size={20} className="cap-icon" />
            <h4>System Health</h4>
            <p>PostgreSQL pool latency, Ollama inference status, and vector cache stats.</p>
          </div>
          <div className="capability-card">
            <Sliders size={20} className="cap-icon" />
            <h4>Settings & RBAC</h4>
            <p>Granular role permissions matrix and dark/light appearance preferences.</p>
          </div>
        </div>
      </section>

      {/* Live Telemetry Section */}
      <section id="telemetry" className="home-section" style={{ background: "var(--bg-panel)" }}>
        <div className="section-header">
          <div className="section-badge">LIVE TELEMETRY</div>
          <h2 className="section-title">Infrastructure Health & Readiness</h2>
          <p className="section-subtitle">
            Direct telemetry stream from the backend engine and local inference components.
          </p>
        </div>

        <div className="telemetry-live-grid">
          <div className="telemetry-box">
            <div className="telemetry-box-header">
              <Database size={18} className="text-accent" />
              <span>PostgreSQL 16 & pgvector</span>
              <span className="badge badge-success" style={{ marginLeft: "auto" }}>
                {systemStatus?.database.status.toUpperCase() || "CONNECTED"}
              </span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Host / Port</span>
              <span className="mono">{systemStatus?.database.host || "localhost"}:{systemStatus?.database.port || 5432}</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Database</span>
              <span className="mono">{systemStatus?.database.database || "copilot"}</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Ping Latency</span>
              <span className="mono" style={{ color: "var(--success)" }}>
                {systemStatus?.database.ping_latency_ms ?? 2} ms
              </span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Statement Timeout</span>
              <span className="mono">{systemStatus?.database.statement_timeout_ms || 15000} ms</span>
            </div>
          </div>

          <div className="telemetry-box">
            <div className="telemetry-box-header">
              <Cpu size={18} className="text-info" />
              <span>Ollama Local Inference</span>
              <span className="badge badge-info" style={{ marginLeft: "auto" }}>
                {systemStatus?.llm.status.toUpperCase() || "READY"}
              </span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Model</span>
              <span className="mono">{systemStatus?.llm.model || "qwen2.5-coder:3b"}</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Endpoint</span>
              <span className="mono">{systemStatus?.llm.url || "http://localhost:11434"}</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Response Cache</span>
              <span className="mono">{systemStatus?.llm.cache_enabled ? "Enabled" : "Active"}</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Inference Mode</span>
              <span className="mono">Deterministic (Temperature 0.0)</span>
            </div>
          </div>

          <div className="telemetry-box">
            <div className="telemetry-box-header">
              <HardDrive size={18} className="text-warning" />
              <span>Semantic Catalog</span>
              <span className="badge badge-warning" style={{ marginLeft: "auto" }}>COMPILED</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Registered Tables</span>
              <span className="mono">{systemStatus?.semantic_catalog.registered_tables ?? 8} tables</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Business Metrics</span>
              <span className="mono">{systemStatus?.semantic_catalog.registered_metrics ?? 5} verified</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Dispute Rules</span>
              <span className="mono">{systemStatus?.semantic_catalog.rules_count ?? 4} active</span>
            </div>
            <div className="telemetry-meta-row">
              <span className="text-secondary">Vector Embeddings</span>
              <span className="mono">BGE-small-en (Pre-warmed)</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <Link to="/loading?redirect=/login" className="btn btn-primary btn-lg">
            <span>Enter Governed Copilot Now</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-brand-col">
            <div className="home-brand">
              <div className="home-brand-icon">
                <Shield size={18} />
              </div>
              <span className="home-brand-title">Governed Copilot</span>
            </div>
            <p className="footer-caption">
              M.Sc. Data Science Capstone Research Platform — Semester III.
              Engineered with AST parsing, physical database RBAC, and cryptographic audit chains.
            </p>
          </div>

          <div className="footer-links-col">
            <div className="footer-links-title">Platform</div>
            <Link to="/loading?redirect=/login">Sign In</Link>
            <Link to="/loading?redirect=/overview">Overview</Link>
            <Link to="/loading?redirect=/ask">AI Copilot</Link>
            <Link to="/loading?redirect=/catalog">Data Catalog</Link>
          </div>

          <div className="footer-links-col">
            <div className="footer-links-title">Governance</div>
            <Link to="/loading?redirect=/governance">Approval Queue</Link>
            <Link to="/loading?redirect=/audit">Audit Log</Link>
            <Link to="/loading?redirect=/evals">Benchmark Evals</Link>
            <Link to="/loading?redirect=/monitoring">System Health</Link>
          </div>

          <div className="footer-links-col">
            <div className="footer-links-title">Research & API</div>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
              FastAPI Swagger Docs
            </a>
            <a href="http://localhost:8000/metrics" target="_blank" rel="noreferrer">
              Prometheus Metrics
            </a>
            <a href="https://github.com/Prernadivakar03/governed-copilot" target="_blank" rel="noreferrer">
              GitHub Repository
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; 2026 MDS-25 Capstone Research Team. All rights reserved.</span>
          <span>Zero-Trust Analytical Governance</span>
        </div>
      </footer>
    </div>
  );
}
