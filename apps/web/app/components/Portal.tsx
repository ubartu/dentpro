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
          if (!r.ok) throw Error("Lütfen yeniden giriş yapın");
          const user = await r.json();
          if (user.role !== role) throw Error("Yanlış portal");
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
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Link href={"/" + role} className="wordmark">
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
      {mobile && (
        <button
          aria-label="Gezinmeyi kapat"
          className="nav-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Gezinmeyi aç"
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
            <div className="loading">
              <LoaderCircle size={27} className="spin" />
              <p>
                {error
                  ? "Çalışma alanı yüklenemedi. Yenileyip tekrar deneyin."
                  : "Çalışma alanınız açılıyor…"}
              </p>
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
