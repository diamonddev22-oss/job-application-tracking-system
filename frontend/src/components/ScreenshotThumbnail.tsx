import { useEffect, useState } from 'react';

/** Small clickable thumbnail that opens the full-size application screenshot in an in-page lightbox
 * (rather than just linking out to a new tab) so a manager reviewing many rows can actually see
 * what was submitted without losing their place in the table. Renders nothing when there's no
 * screenshot for this application (e.g. captured before this feature existed, or capture failed). */
export function ScreenshotThumbnail({ url, label }: { url: string | null; label: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!url) {
    return <span className="text-xs text-slate-400">No screenshot</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View application screenshot"
        className="block shrink-0 overflow-hidden rounded-md border border-slate-200 shadow-sm transition hover:border-brand-400 hover:shadow"
      >
        <img src={url} alt={`Screenshot of ${label}`} className="h-12 w-16 object-cover" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="max-h-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="truncate text-sm font-medium text-white">{label}</p>
              <div className="flex shrink-0 items-center gap-3">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-white underline hover:text-brand-200"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20"
                >
                  Close
                </button>
              </div>
            </div>
            <img src={url} alt={`Screenshot of ${label}`} className="max-h-[80vh] rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}
