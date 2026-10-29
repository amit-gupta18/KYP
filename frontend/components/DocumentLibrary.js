"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteDocument, getDocument, listDocuments, uploadDocument } from "../lib/api";
import { fileKind, formatBytes, formatWhen } from "../lib/format";
import { useWorkspace } from "./AppShell";
import { IconClose, IconSearch, IconUpload } from "./Icons";
import { Button, EmptyState, Lozenge, Modal, PageHeader, Spinner } from "./ui";

const STATUS = {
  ready: { tone: "ready", label: "Ready" },
  processing: { tone: "processing", label: "Indexing" },
  failed: { tone: "failed", label: "Failed" },
};

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";

export default function DocumentLibrary() {
  const { health, refresh: refreshHealth } = useWorkspace();
  const inputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!health?.ready) {
      setDocuments([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listDocuments();
      setDocuments(data.documents || []);
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

  useEffect(() => {
    if (!documents.some((doc) => doc.status === "processing")) return undefined;
    const timer = setInterval(load, 2500);
    return () => clearInterval(timer);
  }, [documents, load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((doc) => doc.filename.toLowerCase().includes(needle));
  }, [documents, query]);

  async function sendFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (!health?.ready) {
      setNotice("Connect OpenAI, MongoDB, and Pinecone before uploading.");
      return;
    }
    for (const file of files) {
      const id = `${file.name}-${file.size}-${Date.now()}`;
      setUploads((current) => [...current, { id, name: file.name, progress: 0, status: "uploading" }]);
      try {
        await uploadDocument(file, (progress) => {
          setUploads((current) => current.map((item) => (item.id === id ? { ...item, progress } : item)));
        });
        setUploads((current) => current.map((item) => (item.id === id ? { ...item, progress: 100, status: "done" } : item)));
      } catch (err) {
        setUploads((current) =>
          current.map((item) => (item.id === id ? { ...item, status: "error", error: err.message } : item))
        );
      }
    }
    await load();
    setTimeout(() => {
      setUploads((current) => current.filter((item) => item.status === "error"));
    }, 2500);
  }

  async function openDetail(doc) {
    setDetail({ ...doc, preview: "" });
    setDetailLoading(true);
    try {
      const full = await getDocument(doc.id);
      setDetail(full);
    } catch (err) {
      setDetail((current) => (current ? { ...current, preview: "", error: err.message } : current));
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDocument(pendingDelete.id);
      if (detail?.id === pendingDelete.id) setDetail(null);
      setPendingDelete(null);
      await load();
      refreshHealth();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          breadcrumb="Workspace / Policies"
          title="Policies"
          description="Upload the documents this workspace should answer from. Indexing starts as soon as the file is received."
        />

        <section
          className={`rounded-md border bg-white px-4 py-6 shadow-raised transition-colors ${
            dragging ? "border-brand-600 bg-brand-50" : "border-dashed border-brand-200"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            sendFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700">
              <IconUpload />
            </div>
            <h2 className="text-lg font-semibold text-ink">Drop a policy here</h2>
            <p className="mt-1 max-w-lg text-base text-ink-subtle">
              PDF, Word (.docx), Markdown, or text. Up to 20 MB. A sample file is in the repository at samples/workplace-policy.md.
            </p>
            <Button
              className="mt-4"
              onClick={() => inputRef.current?.click()}
              disabled={!health?.ready}
              title={health?.ready ? "Choose policy files" : "Connect OpenAI, MongoDB, and Pinecone first"}
            >
              Choose files
            </Button>
            {!health?.ready ? (
              <p className="mt-3 text-sm text-ink-subtlest">Uploads stay off until the API is connected.</p>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              onChange={(event) => {
                sendFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          {uploads.length ? (
            <ul className="mx-auto mt-5 max-w-xl space-y-2 text-left">
              {uploads.map((item) => (
                <li key={item.id} className="rounded border border-line bg-canvas px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-base font-medium text-ink">{item.name}</p>
                    <p className="text-sm text-ink-subtlest">
                      {item.status === "error" ? "Failed" : item.status === "done" ? "Indexing" : `${item.progress}%`}
                    </p>
                  </div>
                  {item.status === "error" ? (
                    <p className="mt-1 text-sm text-danger-text">{item.error}</p>
                  ) : (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-brand-100">
                      <div
                        className={`h-full rounded-full bg-brand-600 ${item.status === "done" ? "w-1/2 animate-slide" : ""}`}
                        style={item.status === "uploading" ? { width: `${item.progress}%` } : undefined}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {notice ? (
          <p className="mt-4 rounded-md border border-warning-bg bg-warning-bg px-4 py-3 text-base text-warning-text">{notice}</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-danger-bg bg-danger-bg px-4 py-3 text-base text-danger-text">{error}</p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-md border border-line bg-white shadow-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-base font-semibold text-ink">Library</h2>
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">Search policies</span>
              <IconSearch className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-ink-subtlest" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by file name"
                className="h-8 w-full rounded border border-line bg-white pl-8 pr-3 text-base text-ink placeholder:text-ink-subtlest focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </label>
          </div>

          {loading && documents.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-10 text-base text-ink-subtle">
              <Spinner /> Loading the library
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              title={documents.length ? "No policies match that search" : "The library is empty"}
              body={
                documents.length
                  ? "Try a different file name."
                  : "Upload a policy to index it for questions. Nothing is stored until you add a file."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="bg-canvas text-xs font-bold uppercase tracking-wide text-ink-subtlest">
                  <tr>
                    <th className="px-4 py-2 font-bold">Name</th>
                    <th className="px-4 py-2 font-bold">Type</th>
                    <th className="px-4 py-2 font-bold">Size</th>
                    <th className="px-4 py-2 font-bold">Passages</th>
                    <th className="px-4 py-2 font-bold">Status</th>
                    <th className="px-4 py-2 font-bold">Added</th>
                    <th className="px-4 py-2 font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((doc) => {
                    const status = STATUS[doc.status] || STATUS.processing;
                    const when = formatWhen(doc.created_at);
                    return (
                      <tr
                        key={doc.id}
                        className="cursor-pointer border-t border-line hover:bg-canvas"
                        onClick={() => openDetail(doc)}
                      >
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate font-medium text-ink">{doc.filename}</p>
                          {doc.error ? <p className="mt-0.5 text-sm text-danger-text">{doc.error}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-ink-subtle">{fileKind(doc.filename)}</td>
                        <td className="px-4 py-3 text-ink-subtle">{formatBytes(doc.size_bytes)}</td>
                        <td className="px-4 py-3 text-ink-subtle">{doc.chunk_count || "—"}</td>
                        <td className="px-4 py-3">
                          <Lozenge tone={status.tone}>{status.label}</Lozenge>
                        </td>
                        <td className="px-4 py-3 text-ink-subtle" title={when.full}>
                          {when.relative}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="dangerGhost"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingDelete(doc);
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button type="button" className="absolute inset-0 bg-[rgba(9,30,66,0.54)]" aria-label="Close policy details" onClick={() => setDetail(null)} />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-overlay">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm text-ink-subtlest">Policy</p>
                <h2 className="truncate text-lg font-semibold text-ink">{detail.filename}</h2>
              </div>
              <button type="button" className="rounded p-1 text-ink-subtle hover:bg-sunken" onClick={() => setDetail(null)} aria-label="Close">
                <IconClose />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Lozenge tone={(STATUS[detail.status] || STATUS.processing).tone}>
                  {(STATUS[detail.status] || STATUS.processing).label}
                </Lozenge>
                <Lozenge>{fileKind(detail.filename)}</Lozenge>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-base">
                <div>
                  <dt className="text-sm text-ink-subtlest">Size</dt>
                  <dd className="font-medium">{formatBytes(detail.size_bytes)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-subtlest">Passages</dt>
                  <dd className="font-medium">{detail.chunk_count || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-subtlest">Added</dt>
                  <dd className="font-medium">{formatWhen(detail.created_at).full || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-subtlest">Pages</dt>
                  <dd className="font-medium">{detail.page_count || "—"}</dd>
                </div>
              </dl>
              {detail.error ? <p className="mt-4 rounded bg-danger-bg px-3 py-2 text-base text-danger-text">{detail.error}</p> : null}
              <h3 className="mb-2 mt-6 text-base font-semibold text-ink">Preview</h3>
              {detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-subtle">
                  <Spinner /> Loading preview
                </div>
              ) : (
                <p className="whitespace-pre-wrap rounded-md bg-canvas p-3 text-base leading-6 text-ink-subtle">
                  {detail.preview || "No preview yet. Indexing may still be running, or the file had no readable text."}
                </p>
              )}
            </div>
            <div className="border-t border-line px-5 py-4">
              <Button variant="dangerGhost" onClick={() => setPendingDelete(detail)}>
                Remove from library
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      {pendingDelete ? (
        <Modal title="Remove this policy?" onClose={() => (deleting ? null : setPendingDelete(null))}>
          <p>
            <span className="font-medium text-ink">{pendingDelete.filename}</span> will leave the library and will no longer be used for answers. Questions already asked stay in history.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
