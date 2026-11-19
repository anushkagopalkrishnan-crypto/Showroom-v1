import { useState } from 'react';
import { ArrowRight, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import type { ProspectBrief, SetupInput, TargetLength } from '../types/showroom';
import { SYNTHETIC_SETUP_DATA } from '../data/syntheticSeed';
import { validateSetupInput } from '../utils/showroomLogic';
import { FileUploadButton } from './FileUploadButton';

interface SetupTabProps {
  input: SetupInput;
  onChange: (next: SetupInput) => void;
  brief: ProspectBrief | null;
  isBuilding: boolean;
  buildError: string | null;
  onBuildStoryboard: () => void;
  onGoToStoryboard: () => void;
}

const TARGET_LENGTHS: TargetLength[] = [60, 90, 120];

export function SetupTab({
  input,
  onChange,
  brief,
  isBuilding,
  buildError,
  onBuildStoryboard,
  onGoToStoryboard,
}: SetupTabProps) {
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof SetupInput, string>>
  >({});
  const [uploadedFileNote, setUploadedFileNote] = useState<{
    help?: string;
    discovery?: string;
  }>({});

  const updateField = <K extends keyof SetupInput>(
    key: K,
    value: SetupInput[K]
  ) => {
    onChange({ ...input, [key]: value });
    if (validationErrors[key]) {
      setValidationErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateSetupInput(input);
    if (!result.valid) {
      setValidationErrors(result.errors);
      return;
    }
    setValidationErrors({});
    onBuildStoryboard();
  };

  const handleLoadSample = () => {
    onChange({ ...SYNTHETIC_SETUP_DATA });
    setValidationErrors({});
    setUploadedFileNote({});
  };

  const handleReset = () => {
    onChange({
      prospectName: '',
      industry: '',
      helpContent: '',
      discoveryNotes: '',
      capabilities: '',
      brandColor: '#1B4965',
      targetLength: 90,
    });
    setValidationErrors({});
    setUploadedFileNote({});
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Prospect setup
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Provide synthetic prospect context, help articles, discovery notes,
            and approved capabilities. Everything in the video comes strictly
            from these inputs.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
          >
            Load synthetic example
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="prospect-name"
              className="block text-sm font-medium text-slate-900"
            >
              Prospect name
            </label>
            <input
              id="prospect-name"
              type="text"
              value={input.prospectName}
              onChange={(e) => updateField('prospectName', e.target.value)}
              placeholder="e.g., Northwind Credit Union"
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {validationErrors.prospectName && (
              <p className="mt-1.5 text-xs text-red-700" role="alert">
                {validationErrors.prospectName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="prospect-industry"
              className="block text-sm font-medium text-slate-900"
            >
              Industry
            </label>
            <input
              id="prospect-industry"
              type="text"
              value={input.industry}
              onChange={(e) => updateField('industry', e.target.value)}
              placeholder="e.g., Retail Banking & Member Services"
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {validationErrors.industry && (
              <p className="mt-1.5 text-xs text-red-700" role="alert">
                {validationErrors.industry}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <span className="block text-sm font-medium text-slate-900">
              Brand colour
            </span>
            <div className="mt-1.5 flex items-center gap-3">
              <label htmlFor="brand-color-picker" className="sr-only">
                Brand colour picker
              </label>
              <input
                id="brand-color-picker"
                type="color"
                value={input.brandColor}
                onChange={(e) => updateField('brandColor', e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
              <label htmlFor="brand-color-hex" className="sr-only">
                Brand colour hex code
              </label>
              <input
                id="brand-color-hex"
                type="text"
                value={input.brandColor}
                onChange={(e) => updateField('brandColor', e.target.value)}
                className="w-28 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 uppercase focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <span className="text-xs text-slate-500">
                Used across the 16:9 video scenes
              </span>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-900">
              Target length
            </span>
            <div
              className="mt-1.5 inline-flex rounded-md border border-slate-200 bg-slate-100 p-1"
              role="group"
              aria-label="Target video length"
            >
              {TARGET_LENGTHS.map((len) => {
                const active = input.targetLength === len;
                return (
                  <button
                    key={len}
                    type="button"
                    onClick={() => updateField('targetLength', len)}
                    aria-pressed={active}
                    className={`rounded px-4 py-1.5 font-mono text-xs font-medium tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {len} seconds
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="help-content"
                className="block text-sm font-medium text-slate-900"
              >
                Help content
              </label>
              <div className="flex items-center gap-2">
                {uploadedFileNote.help && (
                  <span className="text-xs text-slate-500">
                    Loaded {uploadedFileNote.help}
                  </span>
                )}
                <FileUploadButton
                  label="Upload .md / .txt"
                  ariaLabel="Upload Help content .md or .txt file"
                  onTextLoaded={(text, fileName) => {
                    updateField('helpContent', text);
                    setUploadedFileNote((prev) => ({
                      ...prev,
                      help: fileName,
                    }));
                  }}
                />
              </div>
            </div>
            <textarea
              id="help-content"
              rows={7}
              value={input.helpContent}
              onChange={(e) => updateField('helpContent', e.target.value)}
              placeholder="Paste synthetic help articles or knowledge base Markdown..."
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {validationErrors.helpContent && (
              <p className="mt-1.5 text-xs text-red-700" role="alert">
                {validationErrors.helpContent}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="discovery-notes"
                className="block text-sm font-medium text-slate-900"
              >
                Discovery notes
              </label>
              <div className="flex items-center gap-2">
                {uploadedFileNote.discovery && (
                  <span className="text-xs text-slate-500">
                    Loaded {uploadedFileNote.discovery}
                  </span>
                )}
                <FileUploadButton
                  label="Upload .md / .txt"
                  ariaLabel="Upload Discovery notes .md or .txt file"
                  onTextLoaded={(text, fileName) => {
                    updateField('discoveryNotes', text);
                    setUploadedFileNote((prev) => ({
                      ...prev,
                      discovery: fileName,
                    }));
                  }}
                />
              </div>
            </div>
            <textarea
              id="discovery-notes"
              rows={7}
              value={input.discoveryNotes}
              onChange={(e) => updateField('discoveryNotes', e.target.value)}
              placeholder="Paste synthetic discovery call notes, pain points, and topics the buyer asked to skip..."
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            {validationErrors.discoveryNotes && (
              <p className="mt-1.5 text-xs text-red-700" role="alert">
                {validationErrors.discoveryNotes}
              </p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="our-capabilities"
            className="block text-sm font-medium text-slate-900"
          >
            Our capabilities
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            The list of things our product can do. The video may only mention
            capabilities that appear in this list.
          </p>
          <textarea
            id="our-capabilities"
            rows={4}
            value={input.capabilities}
            onChange={(e) => updateField('capabilities', e.target.value)}
            placeholder="List approved product capabilities, one per line..."
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          {validationErrors.capabilities && (
            <p className="mt-1.5 text-xs text-red-700" role="alert">
              {validationErrors.capabilities}
            </p>
          )}
        </div>

        {buildError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {buildError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
          <p className="text-xs text-slate-500">
            Session-only memory. Refreshing clears all inputs and generated
            scenes.
          </p>
          <button
            type="submit"
            disabled={isBuilding}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
          >
            {isBuilding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Building storyboard...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Build storyboard
              </>
            )}
          </button>
        </div>
      </form>

      {isBuilding && !brief && (
        <section
          aria-label="Generating prospect brief"
          className="rounded-lg border border-slate-200 bg-white p-6"
        >
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-44 rounded bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-100" />
            <div className="h-4 w-5/6 rounded bg-slate-100" />
            <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
              <div className="h-32 rounded bg-slate-100" />
              <div className="h-32 rounded bg-slate-100" />
            </div>
          </div>
        </section>
      )}

      {brief && (
        <section
          aria-label="Prospect brief"
          data-testid="prospect-brief"
          className="rounded-lg border border-slate-200 bg-white p-6 space-y-6"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Prospect brief
              </h2>
              <p className="text-xs text-slate-500">
                Grounded summary extracted from help content and discovery notes
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToStoryboard}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
            >
              Open Storyboard
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide text-slate-500">
              Who they are
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-800 max-w-3xl">
              {brief.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 border-t border-slate-100 pt-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500">
                Top 5 customer contact reasons
              </h3>
              <ol className="mt-3 divide-y divide-slate-100">
                {brief.topContactReasons.map((item, idx) => (
                  <li
                    key={`${item.articleTitle}-${idx}`}
                    className="flex items-baseline justify-between gap-6 py-2.5 text-sm"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-slate-900">{item.reason}</span>
                    </div>
                    <span className="max-w-[46%] text-right text-xs text-slate-500 shrink-0">
                      {item.articleTitle}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500">
                What the buyer asked us to skip
              </h3>
              {brief.skippedItems.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No skip requests found in the discovery notes.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {brief.skippedItems.map((skip, idx) => (
                    <li
                      key={`${skip.topic}-${idx}`}
                      className="rounded-md border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {skip.topic}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        “{skip.quote}”
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
