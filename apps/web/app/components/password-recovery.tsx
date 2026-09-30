"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { API } from "../types";
import { Field, Form } from "./ui";

export default function PasswordRecovery({
  reset = false,
}: {
  reset?: boolean;
}) {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!reset) return;
    const linkToken = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    // React Strict Mode can rerun this effect after the fragment was cleared.
    if (linkToken) setToken(linkToken);
    // Fragments never reach the web server. Remove the link credential from history.
    window.history.replaceState(null, "", window.location.pathname);
  }, [reset]);
  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <div className="wordmark">
          <Image
            src="/dentrivo-wordmark.png"
            alt="DENTRIVO"
            width={2160}
            height={728}
          />
        </div>
        <h1>{reset ? "Şifrenizi yenileyin" : "Şifrenizi mi unuttunuz?"}</h1>
        <p>
          {reset
            ? "Yeni bir şifre belirleyin. Tüm cihazlarda yeniden giriş yapmanız gerekecek."
            : "Hesap e-postanızı girin. Hesabınız uygunsa yenileme bağlantısı göndereceğiz."}
        </p>
        {message ? (
          <div role="status" className="notice">
            {message}
          </div>
        ) : (
          <Form
            label={reset ? "Şifreyi güncelle" : "Yenileme e-postası gönder"}
            onSave={async (f) => {
              if (reset && f.get("password") !== f.get("confirm"))
                throw Error("Şifreler eşleşmiyor.");
              const result = await fetch(
                API +
                  (reset ? "/auth/password/reset" : "/auth/password/forgot"),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(
                    reset
                      ? { token, new_password: f.get("password") }
                      : { email: String(f.get("email")).trim() },
                  ),
                },
              );
              const data = await result.json();
              if (!result.ok)
                throw Error(
                  typeof data.detail === "string"
                    ? data.detail
                    : "Girdiğiniz bilgileri kontrol edip yeniden deneyin.",
                );
              setToken("");
              setMessage(data.message);
            }}
          >
            {reset ? (
              <>
                {!/^[A-Za-z0-9_-]{43}$/.test(token) && (
                  <p role="alert">
                    E-postanızdaki bağlantıyı açın veya yenileme kodunu aşağıya
                    girin.
                  </p>
                )}
                <Field label="Yenileme kodu">
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value.trim())}
                    required
                    pattern="[A-Za-z0-9_-]{43}"
                    maxLength={43}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Yeni şifre (en az 10 karakter)">
                  <input
                    type="password"
                    name="password"
                    minLength={10}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Yeni şifreyi doğrulayın">
                  <input
                    type="password"
                    name="confirm"
                    minLength={10}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </Field>
              </>
            ) : (
              <Field label="Hesap e-postası">
                <input
                  name="email"
                  type="email"
                  maxLength={150}
                  required
                  autoComplete="email"
                />
              </Field>
            )}
          </Form>
        )}
        <p>
          <Link href="/forgot-password">Yeni yenileme bağlantısı iste</Link>
        </p>
        <Link href="/login">Personel girişine dön</Link>
        <p className="muted">
          Hasta hesabınız mı var? Giriş yapmak için DENTRIVO uygulamasına dönün.
        </p>
      </section>
    </main>
  );
}
