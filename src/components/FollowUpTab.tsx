import { useState } from 'react';
import { Check, Copy, Loader2, Search } from 'lucide-react';
import type {
  FollowUpResult,
  FollowUpStatus,
} from '../types/showroom';
import { SYNTHETIC_FOLLOWUP_TRANSCRIPT } from '../data/syntheticSeed';
import { FileUploadButton } from './FileUploadButton';

interface FollowUpTabProps {
  transcript: string;
  onTranscriptChange: (next: string) => void;
  result: FollowUpResult | null;
  isAnalyzing: boolean;
  analyzeError: string | null;
  onFindRequests: () => void;
  onStatusChange: (requestId: string, status: FollowUpStatus) => void;
  onEmailChange: (patch: {
    draftEmailSubject?: string;
    draftEmailBody?: string;
  }) => void;
}

const STATUS_OPTIONS: FollowUpStatus[] = [
  'Open',
  'In progress',
  'Waiting on buyer',
  'Done',
];

export function FollowUpTab({
  transcript,
  onTranscriptChange,
  result,
  isAnalyzing,
  analyzeError,
  onFindRequests,
  onStatusChange,
  onEmailChange,
}: FollowUpTabProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim().length < 20) {
      setValidationError(
        'Paste or upload a buyer reply or call transcript (at least 20 characters).'
      );
      return;
    }
    setValidationError(null);
    onFindRequests();
  };

  const handleCopyEmail = async () => {
    if (!result) return;
    const text = `Subject: ${result.draftEmailSubject}\n\n${result.draftEmailBody}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors in restricted frames
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-cb-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-cb-text">
            Post-demo follow-up
          </h1>
          <p className="mt-1 text-sm text-cb-desc">
            Extract buyer requests and team commitments from a reply or call
            transcript, assign owners, and prepare a grounded follow-up email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onTranscriptChange(SYNTHETIC_FOLLOWUP_TRANSCRIPT);
            setValidationError(null);
            setUploadedFileName(null);
          }}
          className="inline-flex items-center rounded-cb-sm border border-cb-border-strong bg-white px-3.5 py-2 text-xs font-medium text-cb-text transition-colors hover:bg-cb-bg hover:text-cb-text whitespace-nowrap shrink-0"
        >
          Load synthetic transcript
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="followup-transcript"
              className="block text-sm font-medium text-cb-text"
            >
              Buyer reply or call transcript
            </label>
            <div className="flex items-center gap-2">
              {uploadedFileName && (
                <span className="text-xs text-cb-desc">
                  Loaded {uploadedFileName}
                </span>
              )}
              <FileUploadButton
                label="Upload .md / .txt"
                ariaLabel="Upload buyer reply or transcript .md or .txt file"
                onTextLoaded={(text, fileName) => {
                  onTranscriptChange(text);
                  setUploadedFileName(fileName);
                  setValidationError(null);
                }}
              />
            </div>
          </div>
          <textarea
            id="followup-transcript"
            rows={8}
            value={transcript}
            onChange={(e) => {
              onTranscriptChange(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Paste the buyer's email reply or synthetic post-demo call transcript..."
            className="mt-2 block w-full rounded-cb-sm border border-cb-border-strong bg-white px-3.5 py-2.5 text-sm leading-relaxed text-cb-text placeholder:text-cb-placeholder focus:border-cb-focus focus:outline-none focus:ring-1 focus:ring-cb-focus"
          />
          {validationError && (
            <p className="mt-1.5 text-xs text-cb-error-text" role="alert">
              {validationError}
            </p>
          )}
        </div>

        {analyzeError && (
          <div
            role="alert"
            className="rounded-cb-sm border border-cb-error-border bg-cb-error-bg px-4 py-3 text-sm text-cb-error-text"
          >
            {analyzeError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 rounded-cb-sm bg-cb-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cb-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cb-focus whitespace-nowrap shrink-0"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Finding requests...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" aria-hidden="true" />
                Find requests
              </>
            )}
          </button>
        </div>
      </form>

      {isAnalyzing && !result && (
        <div className="rounded-cb-md border border-cb-border bg-white p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-48 rounded bg-cb-hover" />
            <div className="h-10 w-full rounded bg-cb-hover" />
            <div className="h-10 w-full rounded bg-cb-hover" />
            <div className="h-10 w-full rounded bg-cb-hover" />
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-8" data-testid="followup-results">
          <section aria-label="Requests table" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-cb-text">
                Requests and commitments
              </h2>
              <span className="font-mono text-xs text-cb-desc tabular-nums">
                {result.requests.length} items
              </span>
            </div>

            {result.requests.length === 0 ? (
              <div className="rounded-cb-md border border-cb-border bg-white p-6 text-sm text-cb-desc">
                No explicit buyer requests or team commitments were found in
                this transcript.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-cb-md border border-cb-border bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-cb-border bg-cb-bg text-xs font-semibold text-cb-desc">
                      <th className="px-4 py-3">Request</th>
                      <th className="px-4 py-3">Who asked (role)</th>
                      <th className="px-4 py-3">Exact quote</th>
                      <th className="px-4 py-3">Suggested owner</th>
                      <th className="px-4 py-3">Due date</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cb-border">
                    {result.requests.map((req) => (
                      <tr key={req.id} className="align-top hover:bg-cb-bg/60">
                        <td className="px-4 py-3 font-medium text-cb-text min-w-[200px]">
                          {req.request}
                        </td>
                        <td className="px-4 py-3 text-cb-text whitespace-nowrap">
                          {req.askedByRole}
                        </td>
                        <td className="px-4 py-3 text-xs leading-relaxed text-cb-desc min-w-[240px]">
                          “{req.exactQuote}”
                        </td>
                        <td className="px-4 py-3 text-cb-text whitespace-nowrap">
                          {req.suggestedOwner}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-cb-text tabular-nums whitespace-nowrap">
                          {req.dueDate}
                        </td>
                        <td className="px-4 py-3">
                          <label
                            htmlFor={`status-${req.id}`}
                            className="sr-only"
                          >
                            Status for {req.request}
                          </label>
                          <select
                            id={`status-${req.id}`}
                            value={req.status}
                            onChange={(e) =>
                              onStatusChange(
                                req.id,
                                e.target.value as FollowUpStatus
                              )
                            }
                            className="rounded border border-cb-border-strong bg-white px-2.5 py-1.5 text-xs font-medium text-cb-text focus:border-cb-focus focus:outline-none focus:ring-1 focus:ring-cb-focus"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Draft follow-up email" className="space-y-3">
            <div className="rounded-cb-sm border border-cb-warning-border bg-cb-warning-bg px-4 py-2.5 text-xs font-semibold text-cb-warning-text">
              Draft. The account owner must review this before sending.
            </div>

            <div className="rounded-cb-md border border-cb-border bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cb-border pb-3">
                <h2 className="text-lg font-semibold text-cb-text">
                  Draft follow-up email
                </h2>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-1.5 rounded-cb-sm border border-cb-border-strong bg-white px-3 py-1.5 text-xs font-medium text-cb-text transition-colors hover:bg-cb-bg hover:text-cb-text whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-cb-success-text" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy email
                    </>
                  )}
                </button>
              </div>

              <div>
                <label
                  htmlFor="draft-email-subject"
                  className="block text-xs font-medium text-cb-desc"
                >
                  Subject
                </label>
                <input
                  id="draft-email-subject"
                  type="text"
                  value={result.draftEmailSubject}
                  onChange={(e) =>
                    onEmailChange({ draftEmailSubject: e.target.value })
                  }
                  className="mt-1 block w-full rounded-cb-sm border border-cb-border-strong bg-white px-3 py-2 text-sm font-medium text-cb-text focus:border-cb-focus focus:outline-none focus:ring-1 focus:ring-cb-focus"
                />
              </div>

              <div>
                <label
                  htmlFor="draft-email-body"
                  className="block text-xs font-medium text-cb-desc"
                >
                  Body
                </label>
                <textarea
                  id="draft-email-body"
                  rows={12}
                  value={result.draftEmailBody}
                  onChange={(e) =>
                    onEmailChange({ draftEmailBody: e.target.value })
                  }
                  className="mt-1 block w-full rounded-cb-sm border border-cb-border-strong bg-white px-3.5 py-2.5 text-sm leading-relaxed text-cb-text focus:border-cb-focus focus:outline-none focus:ring-1 focus:ring-cb-focus"
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
