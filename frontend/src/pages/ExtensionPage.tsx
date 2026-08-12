const EXTENSION_ZIP_PATH = '/downloads/jats-chrome-extension.zip';

const STEPS = [
  "Download the zip above and unzip it to a folder you'll keep around (don't delete it afterwards — Chrome loads the extension from this folder every time it starts).",
  <>
    Open <code className="rounded bg-slate-100 px-1.5 py-0.5">chrome://extensions</code> in Chrome.
  </>,
  <>
    Turn on <strong>Developer mode</strong> (top-right toggle).
  </>,
  <>
    Click <strong>Load unpacked</strong> and select the unzipped folder.
  </>,
  <>
    Click the extension's icon in Chrome's toolbar and choose <strong>Open side panel</strong> (or pin it first
    via the puzzle-piece icon), then log in with your JATS account.
  </>,
];

export function ExtensionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Chrome extension</h1>
      <p className="mt-2 text-slate-600">
        Automatically detects when you submit a job application on any job site and tracks it in
        your JATS account — no manual entry required. It also captures a screenshot of the
        confirmation page as proof of the application.
      </p>

      <div className="mt-6 card p-6 text-center">
        <a href={EXTENSION_ZIP_PATH} download className="btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          </svg>
          Download Chrome extension (.zip)
        </a>
        <p className="mt-3 text-xs text-slate-500">
          This isn't published on the Chrome Web Store yet, so Chrome needs to load it as an
          unpacked extension — see the steps below.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Installation</h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Once installed and logged in, just apply to jobs as usual — successful submissions are
        detected and tracked automatically. Use the extension's own form only if a submission
        wasn't picked up.
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <strong className="text-slate-600">Seeing "Could not reach the server" when logging in?</strong> This
        download is pre-configured to talk to whichever address was running the server when it was last built —
        if that address has changed since, ask whoever hosts this to regenerate it (
        <code className="rounded bg-slate-200 px-1 py-0.5">scripts/package-extension.ps1 -ApiBaseUrl ...</code>).
      </div>
    </div>
  );
}
