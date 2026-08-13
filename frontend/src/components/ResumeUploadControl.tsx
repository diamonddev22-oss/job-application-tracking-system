import { useRef } from 'react';
import { getErrorMessage } from '../api/errors';
import { useUploadManagerResumeMutation } from '../hooks/useManager';
import type { ManagedResume } from '../types';
import { formatDate } from '../utils/format';

/** Manager-only control for the resume an applicant must have on file before their account can be
 * approved (see ManagerUserRow / backend/app/dashboard/service.py's `approve`). Shows a compact
 * "Upload resume" button when none exists yet, or a download link + "Replace" button once one
 * does — re-uploading just registers a new version (resumes are append-only), it doesn't remove
 * the previous one. */
export function ResumeUploadControl({ userId, resume }: { userId: string; resume: ManagedResume | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadManagerResumeMutation();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file to trigger onChange again
    if (file) {
      uploadMutation.mutate({ userId, file });
    }
  };

  return (
    <div className="min-w-[9rem]">
      {resume ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={resume.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="badge bg-green-100 text-green-700 hover:bg-green-200"
            title={`Uploaded ${formatDate(resume.createdAt)}`}
          >
            Resume v{resume.version} ↓
          </a>
          <button
            type="button"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline disabled:cursor-wait disabled:opacity-60"
          >
            {uploadMutation.isPending ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
          className="btn-outline-success btn-sm"
        >
          {uploadMutation.isPending ? 'Uploading…' : 'Upload resume'}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
      />
      {!resume && <p className="mt-1 text-[11px] text-slate-400">Required before approval</p>}
      {uploadMutation.isError && (
        <p className="mt-1 text-xs text-red-600">{getErrorMessage(uploadMutation.error)}</p>
      )}
    </div>
  );
}
