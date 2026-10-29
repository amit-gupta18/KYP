import { Suspense } from "react";
import AskWorkspace from "../../components/AskWorkspace";

export default function AskPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center gap-2 px-8 py-8 text-base text-ink-subtle">Loading questions…</div>
      }
    >
      <AskWorkspace />
    </Suspense>
  );
}
