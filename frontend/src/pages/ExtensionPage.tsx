const EXTENSION_ZIP_PATH = '/downloads/jats-chrome-extension.zip';

export function ExtensionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Chrome Extension</h1>
      <p className="mt-2 text-slate-600">
        Automatically detects when you submit a job application on any job site and tracks it in
        your JATS account — no manual entry required. It also captures a screenshot of the
        confirmation page as proof of the application.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <a
          href={EXTENSION_ZIP_PATH}
          download
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Download Chrome Extension (.zip)
        </a>
        <p className="mt-3 text-xs text-slate-500">
          This isn't published on the Chrome Web Store yet, so Chrome needs to load it as an
          unpacked extension — see the steps below.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Installation</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>Download the zip above and unzip it to a folder you'll keep around (don't delete it afterwards — Chrome loads the extension from this folder every time it starts).</li>
          <li>
            Open <code className="rounded bg-slate-100 px-1.5 py-0.5">chrome://extensions</code> in Chrome.
          </li>
          <li>Turn on <strong>Developer mode</strong> (top-right toggle).</li>
          <li>
            Click <strong>Load unpacked</strong> and select the unzipped folder.
          </li>
          <li>
            Click the extension's icon in Chrome's toolbar and choose <strong>Open side panel</strong> (or pin it
            first via the puzzle-piece icon), then log in with your JATS account.
          </li>
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
