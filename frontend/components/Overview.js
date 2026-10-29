"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getStats, listConversations, listDocuments } from "../lib/api";
import { fileKind, formatWhen } from "../lib/format";
import { useWorkspace } from "./AppShell";
import { Card, EmptyState, LinkButton, Lozenge, PageHeader, Spinner } from "./ui";

const STATUS = {
  ready: { tone: "ready", label: "Ready" },
  processing: { tone: "processing", label: "Indexing" },
  failed: { tone: "failed", label: "Failed" },
};

export default function Overview() {
  const { health } = useWorkspace();
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!health?.ready) {
      setStats(null);
      setDocuments([]);
      setConversations([]);
      setError("");
      return;
    }
    setLoading(true);
    try {
      const [nextStats, nextDocs, nextChats] = await Promise.all([
        getStats(),
        listDocuments(),
        listConversations(),
      ]);
      setStats(nextStats);
      setDocuments(nextDocs.documents || []);
      setConversations(nextChats.conversations || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [health]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [
    { label: "Policies", value: stats ? stats.documents : "—", hint: stats ? `${stats.ready_documents} ready to search` : "Waiting for a connection" },
    { label: "Passages indexed", value: stats ? stats.chunks : "—", hint: "Used when a question is asked" },
    { label: "Questions asked", value: stats ? stats.questions : "—", hint: stats ? `${stats.conversations} conversations` : "History is stored in MongoDB" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          breadcrumb="Workspace"
          title="Overview"
          description="Upload company policies, then ask questions. Every answer is written from those documents and cites the passage it used."
          actions={
            <>
              <LinkButton href="/documents" variant="primary">
                Upload a policy
              </LinkButton>
              <LinkButton href="/ask" variant="default">
                Ask a question
              </LinkButton>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.label} className="px-4 py-4">
              <p className="text-sm font-semibold text-ink-subtlest">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{card.value}</p>
              <p className="mt-1 text-sm text-ink-subtle">{card.hint}</p>
            </Card>
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-danger-bg bg-danger-bg px-4 py-3 text-base text-danger-text">{error}</p>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-ink">Recent policies</h2>
              <Link href="/documents" className="text-sm font-medium text-brand-700 hover:underline">
                View library
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-ink-subtle">
                <Spinner /> Loading policies
              </div>
            ) : documents.length === 0 ? (
              <EmptyState
                title="No policies yet"
                body="Add a handbook, leave policy, or conduct guide. PDF, Word, Markdown, and text files are supported."
                action={<LinkButton href="/documents">Go to policies</LinkButton>}
              />
            ) : (
              <ul>
                {documents.slice(0, 5).map((doc) => {
                  const status = STATUS[doc.status] || STATUS.processing;
                  const when = formatWhen(doc.created_at);
                  return (
                    <li key={doc.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                      <span className="w-12 shrink-0 text-xs font-bold text-ink-subtlest">{fileKind(doc.filename)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{doc.filename}</p>
                        <p className="text-sm text-ink-subtlest" title={when.full}>
                          {when.relative}
                          {doc.chunk_count ? ` · ${doc.chunk_count} passages` : ""}
                        </p>
                      </div>
                      <Lozenge tone={status.tone}>{status.label}</Lozenge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-ink">Recent questions</h2>
              <Link href="/ask" className="text-sm font-medium text-brand-700 hover:underline">
                Ask
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-ink-subtle">
                <Spinner /> Loading questions
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                title="No questions yet"
                body="Once a policy is indexed, ask about leave, expenses, conduct, or retention. The answer stays in this list."
                action={<LinkButton href="/ask" variant="default">Start a question</LinkButton>}
              />
            ) : (
              <ul>
                {conversations.slice(0, 5).map((item) => {
                  const when = formatWhen(item.updated_at);
                  return (
                    <li key={item.id} className="border-b border-line last:border-b-0">
                      <Link href={`/ask?conversation=${item.id}`} className="block px-4 py-3 hover:bg-canvas">
                        <p className="truncate font-medium text-ink">{item.title}</p>
                        <p className="text-sm text-ink-subtlest" title={when.full}>
                          {when.relative}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
