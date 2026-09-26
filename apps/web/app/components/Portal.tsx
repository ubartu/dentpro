"use client";
import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  CalendarDays,
  Users,
  Building2,
  CreditCard,
  Activity,
  ShieldCheck,
  BookOpen,
  Settings2,
  ScrollText,
  LogOut,
  ChevronRight,
  RefreshCw,
  Menu,
  X,
  LoaderCircle,
} from "lucide-react";
import { API, Action, Auth, Role, Workspace } from "../types";
import ClinicScreen from "./clinic";
import AdminScreen from "./admin";
const clinicNav = [
  ["overview", "Overview", LayoutDashboard],
  ["cases", "Case inbox", Inbox],
  ["proposals", "Proposals & drafts", FileText],
  ["appointments", "Appointments", CalendarDays],
  ["analytics", "Activity & response", Activity],
  ["team", "Team members", Users],
  ["profile", "Clinic profile", Building2],
  ["subscription", "Subscription", CreditCard],
] as const;
const adminNav = [
  ["overview", "Overview", LayoutDashboard],
  ["clinics", "Clinics", Building2],
  ["cases", "Platform cases", Inbox],
  ["proposals", "Proposal oversight", FileText],
  ["appointments", "Appointments", CalendarDays],
  ["accounts", "Accounts & access", Users],
  ["subscriptions", "Subscriptions", CreditCard],
  ["interpreter", "Explanation jobs", Activity],
  ["glossary", "Procedure glossary", BookOpen],
  ["audit", "Audit trail", ScrollText],
  ["settings", "Settings", Settings2],
] as const;
export default function Portal({
  role,
  section,
  entityId,
}: {
  role: Role;
  section: string;
  entityId?: string;
}) {
  const router = useRouter();
  const [auth, setAuth] = useState<Auth | null>(null),
    [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  useEffect(() => {
    const raw = sessionStorage.getItem("dentpro-auth");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const a = JSON.parse(raw) as Auth;
      if (a.user.role !== role) {
        router.replace("/" + a.user.role);
        return;
      }
      fetch(API + "/auth/me", {
        headers: { Authorization: `Bearer ${a.token}` },
      })
        .then(async (r) => {
          if (!r.ok) throw Error("Please sign in again");
          const user = await r.json();
          if (user.role !== role) throw Error("Wrong portal");
          setAuth({ ...a, user });
        })
        .catch(() => {
          sessionStorage.removeItem("dentpro-auth");
          router.replace("/login");
        });
    } catch {
      router.replace("/login");
    }
  }, [role, router]);
  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!auth) throw Error("Sign in required");
      const r = await fetch(API + path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
          ...options.headers,
        },
      });
      const d = await r
        .json()
        .catch(() => ({ detail: "Server returned an invalid response" }));
      if (!r.ok) {
        if (r.status === 401) {
          sessionStorage.removeItem("dentpro-auth");
          router.replace("/login");
        }
        throw Error(
          typeof d.detail === "string"
            ? d.detail
            : Array.isArray(d.detail)
              ? d.detail.map((x: { msg: string }) => x.msg).join("; ")
              : "Request failed",
        );
      }
      return d;
    },
    [auth, router],
  );
  const refresh = useCallback(async () => {
    if (!auth) return;
    setBusy(true);
    try {
      setData(await request(`/${role}/workspace`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [auth, request, role]);
  useEffect(() => {
    refresh();
  }, [refresh, section, entityId]);
  useEffect(() => {
    setMobile(false);
    setNotice("");
    setError("");
  }, [section, entityId]);
  useEffect(() => {
    if (!auth) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 15000);
    return () => clearInterval(id);
  }, [auth, refresh]);
  const act: Action = async (path, body, method = "POST") => {
    setError("");
    let headers: Record<string, string> = {};
    let payload = body;
    if (body && typeof body === "object" && "_idempotency" in body) {
      const { _idempotency, ...rest } = body as Record<string, unknown>;
      headers["Idempotency-Key"] = String(_idempotency);
      payload = rest;
    }
    try {
      const d = await request(path, {
        method,
        body: payload === undefined ? undefined : JSON.stringify(payload),
        headers,
      });
      await refresh();
      setNotice("Changes saved successfully.");
      return d;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };
  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {}
    sessionStorage.removeItem("dentpro-auth");
    router.replace("/login");
  }
  const nav = role === "clinic" ? clinicNav : adminNav;
  const title = nav.find((n) => n[0] === section)?.[1] || "Workspace";
  return (
    <div className={"portal " + role}>
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Link href={"/" + role} className="wordmark">
          <Image src="/dentpro-brand-square.png" alt="" width={38} height={38} />
          DENT<span>pro</span>
        </Link>
        <div className="workspace-chip">
          {role === "clinic" ? (
            <Building2 size={17} />
          ) : (
            <ShieldCheck size={17} />
          )}
          <div>
            <strong>
              {role === "clinic"
                ? data?.clinic?.name || "Clinic workspace"
                : "Platform administration"}
            </strong>
            <small>
              {role === "clinic" ? "CLINIC PORTAL" : "ADMIN PORTAL"}
            </small>
          </div>
        </div>
        <div className="nav-label">
          {role === "clinic" ? "WORKSPACE" : "PLATFORM"}
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <Link
              key={id}
              href={`/${role}/${id === "overview" ? "" : id}`}
              aria-label={label}
              aria-current={section === id ? "page" : undefined}
              className={section === id ? "active" : ""}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "cases" && <small>{data?.cases.length || 0}</small>}
              {role === "admin" &&
                id === "clinics" &&
                !!data?.clinics?.filter((c) => c.status === "pending")
                  .length && (
                  <small>
                    {data.clinics.filter((c) => c.status === "pending").length}
                  </small>
                )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="environment">
            <span />
            LOCAL EVALUATION
          </div>
          <div className="user-card">
            <span className="avatar">
              {auth?.user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("") || "…"}
            </span>
            <div>
              <strong>{auth?.user.name || "Signing in"}</strong>
              <small>{auth?.user.email}</small>
            </div>
          </div>
          <button onClick={logout} className="signout">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="nav-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            {role === "clinic" ? "Clinic workspace" : "Administration"}
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="top-status">
              <span />
              {role === "clinic" ? "Clinic operations" : "Platform control"}
            </span>
            <button
              className="icon-btn"
              onClick={() => refresh()}
              aria-label="Refresh workspace"
              disabled={busy}
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
            </button>
            <span className="top-avatar">
              {auth?.user.name.charAt(0) || "D"}
            </span>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss notice">
                <X size={16} />
              </button>
            </div>
          )}
          {!data || !auth ? (
            <div className="loading">
              <LoaderCircle size={27} className="spin" />
              <p>
                {error
                  ? "Unable to load workspace. Use refresh to retry."
                  : "Opening your workspace…"}
              </p>
            </div>
          ) : role === "clinic" ? (
            <Suspense fallback={<p role="status">Loading clinic view…</p>}>
              <ClinicScreen
                key={section + entityId}
                section={section}
                entityId={entityId}
                data={data}
                auth={auth}
                act={act}
              />
            </Suspense>
          ) : (
            <AdminScreen
              key={section + entityId}
              section={section}
              entityId={entityId}
              data={data}
              auth={auth}
              act={act}
            />
          )}
          <footer>
            <span>
              DENTpro ·{" "}
              {role === "clinic" ? "Clinic workspace" : "Platform operations"}
            </span>
            <span>Synthetic evaluation data · Private local environment</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
