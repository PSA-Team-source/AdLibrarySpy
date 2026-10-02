'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** One copyable line on the homepage's dark "Ask your AI" card. */
export function AgentCopyLine({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked by permissions: the text stays selectable.
    }
  };
  return (
    <div>
      <p className={`text-xs uppercase tracking-wider ${big ? 'text-left text-white/60' : 'text-white/50'}`}>{label}</p>
      <div className="mt-2 flex items-start gap-2">
        <code className={`min-w-0 flex-1 break-words rounded-lg border border-white/10 bg-white/[0.04] ${big ? 'px-4 py-3.5 text-left text-[15px] sm:text-base' : 'px-3 py-2.5 text-[13px]'} font-mono leading-relaxed text-white/90`}>{value}</code>
        <button type="button" onClick={copy} aria-label={`Copy: ${label}`}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 font-medium text-white hover:bg-white/5 ${big ? 'px-4 py-3.5 text-base' : 'px-3 py-2.5 text-sm'}`}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
