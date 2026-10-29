import { LinkButton } from "../components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">That page is not in this workspace</h1>
        <p className="mt-2 text-base leading-6 text-ink-subtle">The link may be out of date. Overview, Policies, and Ask are the pages in Policy QA.</p>
        <div className="mt-5">
          <LinkButton href="/">Back to overview</LinkButton>
        </div>
      </div>
    </div>
  );
}
