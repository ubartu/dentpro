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
        <h1>{reset ? "Reset your password" : "Forgot your password?"}</h1>
        <p>
          {reset
            ? "Choose a new password. You will need to sign in again on all devices."
            : "Enter your account email. We will send a reset link if your account is eligible."}
        </p>
        {message ? (
          <div role="status" className="notice">
            {message}
          </div>
        ) : (
          <Form
            label={reset ? "Update password" : "Send reset email"}
            onSave={async (f) => {
              if (reset && f.get("password") !== f.get("confirm"))
                throw Error("Passwords do not match.");
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
                    : "Check the entered details and try again.",
                );
              setToken("");
              setMessage(data.message);
            }}
          >
            {reset ? (
              <>
                {!/^[A-Za-z0-9_-]{43}$/.test(token) && (
                  <p role="alert">
                    Open the link from your email, or enter its reset token
                    below.
                  </p>
                )}
                <Field label="Reset token">
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
                <Field label="New password (at least 10 characters)">
                  <input
                    type="password"
                    name="password"
                    minLength={10}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm new password">
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
              <Field label="Account email">
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
          <Link href="/forgot-password">Request a new reset link</Link>
        </p>
        <Link href="/login">Back to staff sign-in</Link>
        <p className="muted">
          Patient account? Return to the DENTRIVO app to sign in.
        </p>
      </section>
    </main>
  );
}
