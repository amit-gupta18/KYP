"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { askQuestion, deleteConversation, getConversation, listConversations, listDocuments } from "../lib/api";
import { SUGGESTED_QUESTIONS, cn, formatWhen } from "../lib/format";
import { useWorkspace } from "./AppShell";
import { AnswerBody, CopyButton, SourceList } from "./Answer";
import { IconPlus } from "./Icons";
import { Button, Spinner } from "./ui";

export default function AskWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("conversation");
  const { health } = useWorkspace();
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(requested);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [allDocs, setAllDocs] = useState(true);
  const [selected, setSelected] = useState([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");
  const skipNextLoad = useRef(false);
  const endRef = useRef(null);
  const scopeRef = useRef(null);

  const readyDocs = useMemo(() => documents.filter((doc) => doc.status === "ready"), [documents]);

  useEffect(() => {
    setActiveId(requested);
  }, [requested]);

  useEffect(() => {
    if (!health?.ready) {
      setDocuments([]);
      setConversations([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all([listDocuments(), listConversations()])
      .then(([docs, chats]) => {
        if (cancelled) return;
        setDocuments(docs.documents || []);
        setConversations(chats.conversations || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [health]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setLoadingThread(false);
      return undefined;
    }
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return undefined;
    }
    let cancelled = false;
    setLoadingThread(true);
    getConversation(activeId)
      .then((data) => {
        if (!cancelled) setMessages(data.messages || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    function onPointer(event) {
      if (!scopeRef.current?.contains(event.target)) setScopeOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const pairs = useMemo(() => {
    const grouped = [];
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (message.role === "user") {
        const next = messages[index + 1];
        grouped.push({
          id: message.id,
          question: message.content,
          answer: next?.role === "assistant" ? next : null,
        });
        if (next?.role === "assistant") index += 1;
      } else if (message.role === "assistant") {
        grouped.push({ id: message.id, question: "", answer: message });
      }
    }
    return grouped;
  }, [messages]);

  function scopeLabel() {
    if (allDocs) return readyDocs.length ? `All ${readyDocs.length} policies` : "All policies";
    if (!selected.length) return "Choose policies";
    return `${selected.length} selected`;
  }

  function toggleDoc(id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function refreshConversations() {
    const data = await listConversations();
    setConversations(data.conversations || []);
  }

  function startNew() {
    setActiveId(null);
    setMessages([]);
    setError("");
    router.replace("/ask");
  }

  async function removeConversation(id) {
    try {
      await deleteConversation(id);
      setConversations((current) => current.filter((item) => item.id !== id));
      if (activeId === id) startNew();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(text) {
    const trimmed = text.trim();
    if (trimmed.length < 2 || sending) return;
    if (!health?.ready) {
      setError("Connect OpenAI, MongoDB, and Pinecone before asking.");
      return;
    }
    if (!readyDocs.length) {
      setError("Upload a policy and wait until its status is Ready.");
      return;
    }
    if (!allDocs && selected.length === 0) {
      setError("Choose at least one policy, or search all of them.");
      return;
    }
    setError("");
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, role: "user", content: trimmed, sources: [] };
    setMessages((current) => [...current, optimistic]);
    setQuestion("");
    try {
      const response = await askQuestion({
        question: trimmed,
        conversation_id: activeId,
        document_ids: allDocs ? null : selected,
      });
      setMessages((current) => {
        const without = current.filter((item) => item.id !== optimistic.id);
        return [...without, response.user_message, response.assistant_message];
      });
      if (!activeId || activeId !== response.conversation_id) {
        skipNextLoad.current = true;
        setActiveId(response.conversation_id);
        router.replace(`/ask?conversation=${response.conversation_id}`);
      }
      await refreshConversations();
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setQuestion(trimmed);
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
          <h2 className="text-base font-semibold text-ink">Questions</h2>
          <Button variant="subtle" onClick={startNew}>
            <IconPlus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-6 text-sm leading-5 text-ink-subtlest">Questions you ask will be listed here.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((item) => {
                const when = formatWhen(item.updated_at);
                const active = item.id === activeId;
                return (
                  <li key={item.id}>
                    <div className={cn("group rounded", active ? "bg-brand-50" : "hover:bg-canvas")}>
                      <button
                        type="button"
                        onClick={() => router.replace(`/ask?conversation=${item.id}`)}
                        className="w-full px-2 py-2 text-left"
                      >
                        <p className={cn("line-clamp-2 text-base font-medium", active ? "text-brand-800" : "text-ink")}>
                          {item.title}
                        </p>
                        <p className="text-xs text-ink-subtlest" title={when.full}>
                          {when.relative}
                        </p>
                      </button>
                      <div className="px-2 pb-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-ink-subtlest hover:text-danger-text"
                          onClick={() => removeConversation(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 md:px-6">
          <div>
            <p className="text-sm text-ink-subtlest">Workspace / Ask</p>
            <h1 className="text-lg font-semibold text-ink">Ask the policies</h1>
          </div>
          <Button variant="subtle" className="md:hidden" onClick={startNew}>
            New question
          </Button>
        </header>
        <div className="border-b border-line bg-white px-4 py-2 md:hidden">
          <label className="block text-sm font-medium text-ink-subtle" htmlFor="conversation-picker">
            Conversation
            <select
              id="conversation-picker"
              value={activeId || ""}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) startNew();
                else router.replace(`/ask?conversation=${value}`);
              }}
              className="mt-1 h-8 w-full rounded border border-line bg-white px-2 text-base text-ink"
            >
              <option value="">New question</option>
              {conversations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {loadingThread ? (
              <div className="flex items-center gap-2 text-base text-ink-subtle">
                <Spinner /> Loading the conversation
              </div>
            ) : null}

            {!loadingThread && pairs.length === 0 && !sending ? (
              <div className="rounded-md border border-line bg-white px-6 py-10 text-center shadow-raised">
                <h2 className="text-xl font-semibold text-ink">What do you want to check?</h2>
                <p className="mx-auto mt-2 max-w-lg text-base leading-6 text-ink-subtle">
                  Answers are written only from uploaded policies. If the documents do not cover the question, Policy QA says so.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setQuestion(item)}
                      className="rounded-full border border-line bg-canvas px-3 py-1.5 text-left text-base text-ink hover:border-brand-200 hover:bg-brand-50"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {pairs.map((pair) => (
              <article key={pair.id}>
                {pair.question ? <h2 className="text-xl font-semibold tracking-tight text-ink">{pair.question}</h2> : null}
                {pair.answer ? (
                  <div className="mt-3 rounded-md border border-line bg-white px-4 py-4 shadow-raised md:px-5">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Answer</p>
                      <CopyButton text={pair.answer.content} />
                    </div>
                    <AnswerBody content={pair.answer.content} />
                    <SourceList sources={pair.answer.sources} />
                  </div>
                ) : null}
              </article>
            ))}

            {sending ? (
              <div className="rounded-md border border-line bg-white px-5 py-4 shadow-raised">
                <div className="flex items-center gap-2 text-base text-ink-subtle">
                  <Spinner /> Reading the relevant passages…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-line bg-white px-4 py-3 md:px-8">
          <form
            className="mx-auto max-w-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              submit(question);
            }}
          >
            {error ? <p className="mb-2 text-sm text-danger-text">{error}</p> : null}
            <div className="rounded-md border border-line bg-white shadow-raised focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600">
              <label className="sr-only" htmlFor="question">
                Question
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit(question);
                  }
                }}
                rows={3}
                placeholder={readyDocs.length ? "Ask about leave, conduct, expenses, retention…" : "Upload a policy before asking"}
                className="w-full resize-none rounded-t-md px-3 py-3 text-base text-ink placeholder:text-ink-subtlest focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 py-2">
                <div className="relative" ref={scopeRef}>
                  <button
                    type="button"
                    className="h-8 rounded px-2 text-sm font-medium text-ink-subtle hover:bg-sunken"
                    onClick={() => setScopeOpen((open) => !open)}
                    aria-expanded={scopeOpen}
                  >
                    Searching {scopeLabel()}
                  </button>
                  {scopeOpen ? (
                    <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-md border border-line bg-white p-2 shadow-overlay">
                      <label className="flex items-center gap-2 rounded px-2 py-1.5 text-base hover:bg-canvas">
                        <input
                          type="checkbox"
                          checked={allDocs}
                          onChange={(event) => setAllDocs(event.target.checked)}
                        />
                        All ready policies
                      </label>
                      {!allDocs ? (
                        <div className="mt-1 max-h-48 overflow-y-auto border-t border-line pt-1">
                          {readyDocs.length === 0 ? (
                            <p className="px-2 py-2 text-sm text-ink-subtlest">No policies are ready yet.</p>
                          ) : (
                            readyDocs.map((doc) => (
                              <label key={doc.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-base hover:bg-canvas">
                                <input
                                  type="checkbox"
                                  checked={selected.includes(doc.id)}
                                  onChange={() => toggleDoc(doc.id)}
                                />
                                <span className="truncate">{doc.filename}</span>
                              </label>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <p className="hidden text-xs text-ink-subtlest sm:block">Enter to send · Shift+Enter for a new line</p>
                  <Button type="submit" disabled={sending || question.trim().length < 2}>
                    {sending ? "Asking…" : "Ask"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
