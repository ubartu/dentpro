"use client";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
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
  ["overview", "Genel bakış", LayoutDashboard],
  ["cases", "Vaka gelen kutusu", Inbox],
  ["proposals", "Teklifler ve taslaklar", FileText],
  ["appointments", "Randevular", CalendarDays],
  ["analytics", "Etkinlik ve yanıtlar", Activity],
  ["team", "Ekip üyeleri", Users],
  ["profile", "Klinik profili", Building2],
  ["subscription", "Abonelik", CreditCard],
] as const;
const adminNav = [
  ["overview", "Genel bakış", LayoutDashboard],
  ["clinics", "Klinikler", Building2],
  ["cases", "Platform vakaları", Inbox],
  ["proposals", "Teklif denetimi", FileText],
  ["appointments", "Randevular", CalendarDays],
  ["accounts", "Hesaplar ve erişim", Users],
  ["subscriptions", "Abonelikler", CreditCard],
  ["interpreter", "Açıklama işleri", Activity],
  ["glossary", "İşlem sözlüğü", BookOpen],
  ["audit", "Denetim kaydı", ScrollText],
  ["settings", "Ayarlar", Settings2],
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
    [mobile, setMobile] = useState(false),
    [narrow, setNarrow] = useState(false),
    [authError, setAuthError] = useState(""),
    [authAttempt, setAuthAttempt] = useState(0);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("dentpro-auth");
    if (!raw) {
      router.replace("/login");
      return;
    }
    let stored: Auth;
    try {
      stored = JSON.parse(raw) as Auth;
      if (!stored.token || !["clinic", "admin"].includes(stored.user?.role)) {
        throw Error("Geçersiz oturum");
      }
    } catch {
      sessionStorage.removeItem("dentpro-auth");
      router.replace("/login");
      return;
    }
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setAuthError("");
    fetch(API + "/auth/me", {
      headers: { Authorization: `Bearer ${stored.token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (disposed) return;
        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem("dentpro-auth");
          router.replace("/login");
          return;
        }
        if (!response.ok) throw Error("Oturum doğrulanamadı");
        const user = await response.json();
        if (disposed) return;
        if (!["clinic", "admin"].includes(user.role)) {
          throw Error("Geçersiz çalışma alanı");
        }
        if (user.role !== role) {
          router.replace("/" + user.role);
          return;
        }
        setAuth({ ...stored, user });
      })
      .catch(() => {
        if (!disposed) {
          setAuthError(
            "Sunucuya bağlanılamadı. Oturumunuz korunuyor; bağlantınızı kontrol edip tekrar deneyin.",
          );
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [role, router, authAttempt]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => {
      setNarrow(query.matches);
      if (!query.matches) setMobile(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile || !narrow) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"),
      ).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      if (window.matchMedia("(max-width: 720px)").matches) {
        (previous?.isConnected ? previous : menuRef.current)?.focus();
      }
    };
  }, [mobile, narrow]);
  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!auth) throw Error("Giriş yapmanız gerekiyor");
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
        .catch(() => ({ detail: "Sunucudan geçersiz yanıt alındı" }));
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
              : "İstek başarısız oldu",
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
      setNotice("Değişiklikler kaydedildi.");
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
  const title = nav.find((n) => n[0] === section)?.[1] || "Çalışma alanı";
  return (
    <div className={"portal " + role}>
      <aside
        id="workspace-navigation"
        ref={sidebarRef}
        className={"sidebar " + (mobile ? "open" : "")}
        inert={narrow && !mobile}
        role={narrow && mobile ? "dialog" : undefined}
        aria-modal={narrow && mobile ? true : undefined}
        aria-label="Çalışma alanı gezinmesi"
      >
        <button
          type="button"
          className="icon-btn mobile-nav-close"
          aria-label="Gezinmeyi kapat"
          onClick={() => setMobile(false)}
        >
          <X size={21} />
        </button>
        <Link
          href={"/" + role}
          className="wordmark"
          onClick={() => setMobile(false)}
        >
          <Image
            src="/dentrivo-wordmark.png"
            alt="DENTRIVO ana sayfa"
            width={2160}
            height={728}
          />
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
                ? data?.clinic?.name || "Klinik çalışma alanı"
                : "Platform yönetimi"}
            </strong>
            <small>
              {role === "clinic" ? "KLİNİK PORTALI" : "YÖNETİM PORTALI"}
            </small>
          </div>
        </div>
        <div className="nav-label">
          {role === "clinic" ? "ÇALIŞMA ALANI" : "PLATFORM"}
        </div>
        <nav aria-label="Ana gezinme">
          {nav.map(([id, label, Icon]) => (
            <Link
              key={id}
              href={`/${role}/${id === "overview" ? "" : id}`}
              onClick={() => setMobile(false)}
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
            YEREL DEMO
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
              <strong>{auth?.user.name || "Giriş yapılıyor"}</strong>
              <small>{auth?.user.email}</small>
            </div>
          </div>
          <button onClick={logout} className="signout">
            <LogOut size={16} />
            Çıkış yap
          </button>
        </div>
      </aside>
      {mobile && narrow && (
        <button
          aria-hidden="true"
          tabIndex={-1}
          className="nav-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <main inert={mobile && narrow}>
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            ref={menuRef}
            aria-label="Gezinmeyi aç"
            aria-controls="workspace-navigation"
            aria-expanded={mobile && narrow}
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            {role === "clinic" ? "Klinik çalışma alanı" : "Yönetim"}
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="top-status">
              <span />
              {role === "clinic" ? "Klinik işlemleri" : "Platform kontrolü"}
            </span>
            <button
              className="icon-btn"
              onClick={() => refresh()}
              aria-label="Çalışma alanını yenile"
              disabled={busy || !auth}
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
              <button onClick={() => setError("")} aria-label="Hatayı kapat">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Bildirimi kapat"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!data || !auth ? (
            <div className="loading" role="status">
              {authError || error ? (
                <>
                  <p>
                    {authError ||
                      "Çalışma alanı yüklenemedi. Lütfen tekrar deneyin."}
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      auth
                        ? refresh()
                        : setAuthAttempt((attempt) => attempt + 1)
                    }
                  >
                    <RefreshCw size={16} />
                    Tekrar dene
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle size={27} className="spin" />
                  <p>Çalışma alanınız açılıyor…</p>
                </>
              )}
            </div>
          ) : role === "clinic" ? (
            <Suspense fallback={<p role="status">Klinik ekranı yükleniyor…</p>}>
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
              DENTRIVO ·{" "}
              {role === "clinic"
                ? "Klinik çalışma alanı"
                : "Platform işlemleri"}
            </span>
            <span>Sentetik demo verileri · Özel yerel ortam</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
