import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Database,
  Layers,
  Code2,
  History,
  ShieldCheck,
  FileCheck,
  Award,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import logoUrl from "../assets/logo.png";
import type { Role } from "../api";

interface SidebarProps {
  role: Role;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItemConfig {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  badge?: string;
  section?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  // Analytics Suite
  { path: "/overview", label: "Overview", icon: LayoutDashboard, roles: ["analyst", "steward", "auditor", "admin"], section: "Analytics" },
  { path: "/ask", label: "AI Copilot", icon: Bot, roles: ["analyst", "steward", "admin"], badge: "AI", section: "Analytics" },
  { path: "/catalog", label: "Data Catalog", icon: Database, roles: ["analyst", "steward", "auditor", "admin"], section: "Analytics" },
  { path: "/semantic", label: "Semantic Layer", icon: Layers, roles: ["analyst", "steward", "auditor", "admin"], section: "Analytics" },
  { path: "/studio", label: "Query Studio", icon: Code2, roles: ["analyst", "steward", "admin"], section: "Analytics" },
  { path: "/history", label: "Query History", icon: History, roles: ["analyst", "steward", "admin"], section: "Analytics" },

  // Governance & Quality
  { path: "/governance", label: "Governance Center", icon: ShieldCheck, roles: ["steward", "auditor", "admin"], section: "Governance" },
  { path: "/audit", label: "Audit Logs", icon: FileCheck, roles: ["auditor", "admin"], section: "Governance" },
  { path: "/evals", label: "Evaluation & Audits", icon: Award, roles: ["auditor", "admin"], badge: "Research", section: "Governance" },

  // Operations
  { path: "/monitoring", label: "System Health", icon: Activity, roles: ["analyst", "steward", "auditor", "admin"], section: "Operations" },
  { path: "/settings", label: "Settings", icon: Settings, roles: ["analyst", "steward", "auditor", "admin"], section: "Operations" },
];

export function Sidebar({ role, collapsed, onToggleCollapse }: SidebarProps) {
  const allowedItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const sections = Array.from(new Set(allowedItems.map((item) => item.section)));

  return (
    <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <NavLink to="/overview" className="brand-link">
          <div className="brand-mark" style={{ background: "transparent", boxShadow: "none" }}>
            <img src={logoUrl} alt="Governed Copilot" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
          </div>
          {!collapsed && <span className="brand-text">Governed Copilot</span>}
        </NavLink>
        <button
          className="btn-ghost btn-icon"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section} className="nav-section">
            {!collapsed && <div className="nav-section-title">{section}</div>}
            {allowedItems
              .filter((item) => item.section === section)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="nav-icon" />
                    {!collapsed && <span className="nav-text">{item.label}</span>}
                    {!collapsed && item.badge && <span className="nav-badge">{item.badge}</span>}
                  </NavLink>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="badge badge-info" style={{ fontSize: "11px" }}>
            Role: {role.toUpperCase()}
          </div>
        )}
      </div>
    </aside>
  );
}
