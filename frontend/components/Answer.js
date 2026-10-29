"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "./ui";

export function AnswerBody({ content }) {
  return (
    <div className="answer text-answer text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}

export function SourceList({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-subtlest">Sources</p>
      <ul className="mt-2 space-y-2">
        {sources.map((source) => (
          <SourceCard key={`${source.index}-${source.document_id}`} source={source} />
        ))}
      </ul>
    </div>
  );
}

function SourceCard({ source }) {
  const [open, setOpen] = useState(false);
  const match = Math.round((source.score || 0) * 100);
  return (
    <li className="rounded border border-line bg-canvas px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-medium text-ink">
          <span className="mr-2 text-brand-700">[{source.index}]</span>
          {source.filename}
        </p>
        <p className="text-xs font-semibold text-ink-subtlest">Match {match}%</p>
      </div>
      <p className={`mt-1 whitespace-pre-wrap text-sm leading-5 text-ink-subtle ${open ? "" : "line-clamp-3"}`}>
        {source.excerpt}
      </p>
      <button type="button" className="mt-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => setOpen((value) => !value)}>
        {open ? "Show less" : "Show passage"}
      </button>
    </li>
  );
}

export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
