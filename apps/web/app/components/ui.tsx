"use client";
import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  FormEvent,
} from "react";
import {
  X,
  LoaderCircle,
  Search,
  ChevronRight,
  Inbox,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { label } from "../types";
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={"badge " + String(children).toLowerCase().replaceAll(" ", "-")}
    >
      {label(String(children))}
    </span>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow || "ÇALIŞMA ALANINIZ"}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  href,
  attention = false,
}: {
  label: string;
  value: string | number;
  note: string;
  href?: string;
  attention?: boolean;
}) {
  const inner = (
    <>
      <div className="stat-label">
        {label}
        {href && <ArrowUpRight size={15} />}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </>
  );
  return href ? (
    <Link href={href} className={"stat" + (attention ? " stat-attention" : "")}>
      {inner}
    </Link>
  ) : (
    <div className="stat">{inner}</div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={29} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function SearchBox({
  value,
  set,
  placeholder = "Ara…",
}: {
  value: string;
  set: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
  closeDisabled = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = () => {
    if (!closeDisabled) close();
  };
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const all = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = all[0],
          last = all[all.length - 1];
        if (!all.length) {
          e.preventDefault();
          ref.current?.focus();
        } else if (!all.includes(document.activeElement as HTMLElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
    >
      <div
        className={"modal " + (wide ? "wide-modal" : "")}
        ref={ref}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            onClick={() => closeRef.current()}
            disabled={closeDisabled}
            aria-label="Pencereyi kapat"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Form({
  children,
  onSave,
  label = "Değişiklikleri kaydet",
  secondary,
}: {
  children?: ReactNode;
  onSave: (f: FormData) => Promise<unknown>;
  label?: string;
  secondary?: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          await onSave(new FormData(e.currentTarget));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        {secondary}
        <button className="primary" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : null}
          {label}
        </button>
      </div>
    </form>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            id,
            ...(hint ? { "aria-describedby": id + "-hint" } : {}),
          })
        : children}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  close,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<unknown>;
  close: () => void;
}) {
  return (
    <Modal title={title} close={close}>
      <p className="muted">{description}</p>
      <Form
        label="Onayla"
        onSave={async () => {
          await onConfirm();
          close();
        }}
      />
    </Modal>
  );
}
export function RowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ChevronRight size={14} />
    </Link>
  );
}
