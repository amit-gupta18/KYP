"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getHealth } from "../lib/api";
import { cn } from "../lib/format";
import { IconAsk, IconDocuments, IconOverview, LogoMark } from "./Icons";
import { Button } from "./ui";

const WorkspaceContext = createContext({
  health: null,
  loading: true,
  error: "",
  refresh: async () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

const NAV = [
  { href: "/", label: "Overview", icon: IconOverview },
  { href: "/documents", label: "Policies", icon: IconDocuments },
  { href: "/ask", label: "Ask", icon: IconAsk },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Workspace">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2 rounded px-2 text-base font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-ink-subtle hover:bg-sunken hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SetupBanner({ health, error, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="border-b border-line bg-white px-4 py-2 text-sm text-ink-subtlest md:px-8">
        Checking the workspace connection…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-danger-bg bg-danger-bg px-4 py-3 text-base text-danger-text md:px-8">
        <p>{error}</p>
        <Button variant="default" onClick={onRefresh}>
          Retry
        </Button>
      </div>
    );
  }
  if (!health || health.ready) return null;
  return (
    <div className="border-b border-brand-100 bg-brand-50 px-4 py-3 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-brand-800">Connect this workspace before uploading policies</p>
          <ul className="mt-1 list-disc pl-5 text-base text-ink-subtle">
            {(health.problems || []).map((problem) => (
              <li key={problem}>{problem}.</li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-ink-subtle">
            Copy <span className="font-medium text-ink">.env.example</span> to{" "}
            <span className="font-medium text-ink">backend/.env</span>, add the OpenAI key, MongoDB URI, and Pinecone key, then restart the API.
          </p>
        </div>
        <Button variant="default" onClick={onRefresh}>
          Check again
        </Button>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getHealth();
      setHealth(next);
      setError("");
    } catch (err) {
      setHealth(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const company = health?.company || "Policy workspace";

  return (
    <WorkspaceContext.Provider value={{ health, loading, error, refresh }}>
      <div className="flex h-screen min-h-0 flex-col bg-canvas text-ink">
        <div className="h-1 shrink-0 bg-brand-600" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow-overlay"
        >
          Skip to content
        </a>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
            <div className="flex items-center gap-3 border-b border-line px-4 py-4">
              <LogoMark />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink">Policy QA</p>
                <p className="truncate text-sm text-ink-subtlest">{company}</p>
              </div>
            </div>
            <div className="flex-1 px-3 py-3">
              <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-ink-subtlest">Workspace</p>
              <NavLinks pathname={pathname} />
            </div>
            <div className="border-t border-line px-4 py-3 text-sm leading-5 text-ink-subtlest">
              <p>Answers use only the policies uploaded here.</p>
              {health?.ready ? (
                <p className="mt-2 text-xs leading-4">
                  {health.services.openai.model}
                  <br />
                  {health.services.embeddings.model}
                </p>
              ) : null}
            </div>
          </aside>

          <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <LogoMark className="h-7 w-7" />
              <div>
                <p className="text-base font-semibold leading-4">Policy QA</p>
                <p className="text-xs text-ink-subtlest">{company}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded px-2 py-1 text-sm font-semibold",
                      active ? "bg-brand-50 text-brand-700" : "text-ink-subtle"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SetupBanner health={health} error={error} loading={loading} onRefresh={refresh} />
            <div id="main" className="flex min-h-0 flex-1 flex-col">
              {children}
            </div>
          </div>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
