'use client';
import { useState } from 'react';

export default function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm text-foreground">{value}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard can be blocked by permissions; the text stays selectable.
            setCopied(false);
          }
        }}
        className="btn-ghost shrink-0"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
