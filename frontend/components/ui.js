"use client";

import { useEffect } from "react";
import Link from "next/link";
import { cn } from "../lib/format";

const VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  subtle: "bg-sunken text-ink hover:bg-line",
  ghost: "text-ink-subtle hover:bg-sunken hover:text-ink",
  danger: "bg-danger-bold text-white hover:bg-danger-text",
  dangerGhost: "text-danger-text hover:bg-danger-bg",
  default: "border border-line bg-white text-ink hover:bg-canvas",
};

export function buttonClass(variant = "primary", extra = "") {
  return cn(
    "inline-flex h-8 items-center justify-center gap-2 rounded px-3 text-base font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-sunken disabled:text-ink-subtlest disabled:opacity-100 disabled:hover:bg-sunken",
    VARIANTS[variant] || VARIANTS.primary,
    extra
  );
}

export function Button({ variant = "primary", className = "", type = "button", ...props }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ href, variant = "primary", className = "", children }) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

const LOZENGES = {
  ready: "bg-success-bg text-success-text",
  processing: "bg-brand-50 text-brand-700",
  failed: "bg-danger-bg text-danger-text",
  neutral: "bg-sunken text-ink-subtle",
  info: "bg-brand-50 text-brand-800",
};

export function Lozenge({ tone = "neutral", children }) {
  return (
    <span className={cn("inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide", LOZENGES[tone])}>
      {children}
    </span>
  );
}

export function Card({ className = "", children }) {
  return <section className={cn("rounded-md border border-line bg-white shadow-raised", className)}>{children}</section>;
}

export function PageHeader({ breadcrumb, title, description, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb ? <p className="mb-1 text-sm text-ink-subtlest">{breadcrumb}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-base leading-6 text-ink-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Modal({ title, children, onClose, labelledBy = "dialog-title" }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-[rgba(9,30,66,0.54)]" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative z-10 w-full max-w-md rounded-md bg-white p-6 shadow-overlay"
      >
        <h2 id={labelledBy} className="text-xl font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-base leading-6 text-ink-subtle">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M7 3.5h7l5 5V20.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
          <path d="M14 3.5v5h5" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-md text-base leading-6 text-ink-subtle">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg className={cn("animate-spin text-brand-600", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
