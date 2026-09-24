"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  ArrowRight,
  ShieldCheck,
  Building2,
  Check,
} from "lucide-react";
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
          <Stethoscope size={30} />
          DENT<span>pro</span>
        </div>
        <div>
          <div className="eyebrow">BUILT AROUND BETTER CARE</div>
          <h1>
            Less administration.
            <br />
            More room for care.
          </h1>
          <p>
            A dedicated workspace for the professionals behind every treatment
            plan.
          </p>
          <div className="login-points">
            <span>
              <Check size={17} />
              One place for every case and proposal
            </span>
            <span>
              <Check size={17} />
              Clear handoffs from request to appointment
            </span>
            <span>
              <Check size={17} />
              Accountable operations, with a complete audit trail
            </span>
          </div>
        </div>
        <small>DENTpro · Clinic & platform operations</small>
      </section>
      <section className="login-form">
        <div className="portal-tabs">
          <button
            className={portal === "clinic" ? "selected" : ""}
            onClick={() => setPortal("clinic")}
          >
            <Building2 size={17} />
            Clinic portal
          </button>
          <button
            className={portal === "admin" ? "selected" : ""}
            onClick={() => setPortal("admin")}
          >
            <ShieldCheck size={17} />
            Admin portal
          </button>
        </div>
        <div className="eyebrow">
          {portal === "clinic" ? "WELCOME BACK" : "PLATFORM OPERATIONS"}
        </div>
        <h2>
          {portal === "clinic"
            ? "Sign in to your clinic"
            : "Administrator sign-in"}
        </h2>
        <p>
          Use your{" "}
          {portal === "clinic" ? "clinic team" : "platform administrator"}{" "}
          account to continue.
        </p>
        <Form
          label="Sign in to workspace"
          onSave={async () => {
            const r = await fetch(API + "/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const data = await r.json();
            if (!r.ok) throw Error(data.detail || "Unable to sign in");
            const auth = data as Auth;
            if (auth.user.role !== portal)
              throw Error(
                `This account belongs to the ${auth.user.role} portal. Select the correct portal above.`,
              );
            sessionStorage.setItem("dentpro-auth", JSON.stringify(auth));
            router.push("/" + portal);
          }}
        >
          <Field label="Email address">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        </Form>
        <div className="demo-login">
          <strong>Local evaluation access</strong>
          <p>
            Synthetic data environment. Use the supplied account to evaluate
            this portal.
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
            Fill {portal} evaluation credentials
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}
