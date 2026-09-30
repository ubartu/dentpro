"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Building2, Check } from "lucide-react";
import { API, Auth, Role } from "../types";
import { Field, Form } from "../components/ui";
export default function Login() {
  const router = useRouter();
  const [portal, setPortal] = useState<Role>("clinic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="wordmark">
          <Image
            src="/dentrivo-wordmark.png"
            alt="DENTRIVO"
            width={2160}
            height={728}
          />
        </div>
        <div>
          <Image
            className="login-hero-logo"
            src="/dentrivo-icon.png"
            alt="DENTRIVO logosu"
            width={170}
            height={170}
            loading="eager"
          />
          <div className="eyebrow">DAHA İYİ BAKIM İÇİN TASARLANDI</div>
          <h1>
            Daha az idari iş.
            <br />
            Bakıma daha çok zaman.
          </h1>
          <p>
            Her tedavi planını hazırlayan uzmanlar için özel bir çalışma alanı.
          </p>
          <div className="login-points">
            <span>
              <Check size={17} />
              Tüm vakalar ve teklifler tek yerde
            </span>
            <span>
              <Check size={17} />
              Talepten randevuya açık bir süreç
            </span>
            <span>
              <Check size={17} />
              Eksiksiz denetim kaydıyla izlenebilir işlemler
            </span>
          </div>
        </div>
        <small>DENTRIVO · Klinik ve platform işlemleri</small>
      </section>
      <section className="login-form">
        <div className="portal-tabs">
          <button
            className={portal === "clinic" ? "selected" : ""}
            onClick={() => setPortal("clinic")}
          >
            <Building2 size={17} />
            Klinik portalı
          </button>
          <button
            className={portal === "admin" ? "selected" : ""}
            onClick={() => setPortal("admin")}
          >
            <ShieldCheck size={17} />
            Yönetim portalı
          </button>
        </div>
        <div className="eyebrow">
          {portal === "clinic" ? "TEKRAR HOŞ GELDİNİZ" : "PLATFORM İŞLEMLERİ"}
        </div>
        <h2>
          {portal === "clinic" ? "Kliniğinize giriş yapın" : "Yönetici girişi"}
        </h2>
        <p>
          Devam etmek için{" "}
          {portal === "clinic" ? "klinik ekibi" : "platform yöneticisi"}{" "}
          hesabınızı kullanın.
        </p>
        <Form
          label="Çalışma alanına giriş yap"
          onSave={async () => {
            const r = await fetch(API + "/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const data = await r.json();
            if (!r.ok) throw Error(data.detail || "Giriş yapılamadı");
            const auth = data as Auth;
            if (auth.user.role !== portal)
              throw Error(
                `Bu hesap ${auth.user.role === "clinic" ? "klinik" : "yönetim"} portalına ait. Yukarıdan doğru portalı seçin.`,
              );
            sessionStorage.setItem("dentpro-auth", JSON.stringify(auth));
            router.push("/" + portal);
          }}
        >
          <Field label="E-posta adresi">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Şifre">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        </Form>
        <p>
          <Link href="/forgot-password">Şifrenizi mi unuttunuz?</Link>
        </p>
        <div className="demo-login">
          <strong>Yerel demo erişimi</strong>
          <p>
            Sentetik veri ortamı. Bu portalı denemek için verilen hesabı
            kullanın.
          </p>
          <button
            onClick={() => {
              setEmail(
                portal === "clinic"
                  ? "clinic@dentpro.local"
                  : "admin@dentpro.local",
              );
              setPassword(portal === "clinic" ? "Clinic123!" : "Admin123!");
            }}
          >
            {portal === "clinic" ? "Klinik" : "Yönetim"} demo bilgilerini doldur
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}
