import { useRef } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadButtonProps {
  label: string;
  ariaLabel?: string;
  onTextLoaded: (text: string, fileName: string) => void;
}

export function FileUploadButton({
  label,
  ariaLabel,
  onTextLoaded,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onTextLoaded(text, file.name);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={handleFileChange}
      />
      <button
        type="button"
        aria-label={ariaLabel || label}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
      >
        <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        {label}
      </button>
    </>
  );
}
