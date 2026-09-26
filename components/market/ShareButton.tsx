'use client';

import { useEffect, useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SITE_URL } from '@/lib/public/site';

/**
 * Shares the PUBLIC page for a shop, ad or weekly report (/store/{domain},
 * /ad/{id}, /weekly/{week}) — never the signed-in /shops or /ads URL, which a
 * recipient without an account cannot open.
 *
 * Every link carries `?ref=share` (copy / native sheet) or `?ref=share-<network>`
 * (X, LinkedIn, Reddit, Facebook), which middleware.ts / RefBeacon turn into the
 * first-touch `als_ref` cookie that signup records — so the funnel shows which
 * network each signup came from. The network links are the platforms' own public
 * share intents: nothing is posted for the user, no account is needed on our side.
 * Phones get the native share sheet; desktop gets the menu.
 */
const NETWORKS = [
  { id: 'x', label: 'Post on X', href: (u: string, t: string) => `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { id: 'linkedin', label: 'Share on LinkedIn', href: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { id: 'reddit', label: 'Share on Reddit', href: (u: string, t: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}` },
  { id: 'facebook', label: 'Share on Facebook', href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
] as const;

export function ShareButton({ path, title, text, label = false, className }: {
  /** Public path, e.g. `/store/fashionnova.com` or `/ad/123`. */
  path: string;
  title: string;
  /** Post text for X/Reddit — real figures only (e.g. "Gymshark: 15.8M visits/mo, 568 live Meta ads"). Defaults to title. */
  text?: string;
  label?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const linkFor = (ref: string) => {
    // Also evaluated while the page is pre-rendered (no window): fall back to the site origin.
    const url = new URL(path, typeof window === 'undefined' ? SITE_URL : window.location.origin);
    url.searchParams.set('ref', ref);
    return url.toString();
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(linkFor('share'));
      setCopied(true);
    } catch { /* clipboard blocked (insecure context); nothing else to do */ }
  }

  // Touch devices: the platform's own sheet is the normal way to share. The
  // menu opens on pointerdown, so a touch pointerdown is cancelled (Radix skips
  // default-prevented events) and the sheet opens on click, which carries the
  // user activation navigator.share needs.
  const touchShare = () => typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
  async function nativeShare() {
    if (!touchShare()) return;
    try { await navigator.share({ title, text: text ?? title, url: linkFor('share') }); }
    catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) await copy(); }
  }

  const caption = copied ? 'Link copied' : 'Share';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" onPointerDown={e => { if (e.pointerType !== 'mouse' && touchShare()) e.preventDefault(); }}
          onClick={nativeShare} aria-label={copied ? 'Link copied' : `Share ${title}`} title={caption}
          className={cn(label ? 'btn-ghost h-9 gap-1.5 px-3 text-sm' : 'btn-ghost h-9 w-9 justify-center p-0', className)}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
          {label && <span>{caption}</span>}
          <span aria-live="polite" className="sr-only">{copied ? 'Link copied to clipboard' : ''}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={copy} className="flex items-center gap-2">
          <Link2 className="h-4 w-4" aria-hidden /> Copy link
        </DropdownMenuItem>
        {NETWORKS.map(n => (
          <DropdownMenuItem key={n.id} asChild>
            <a href={n.href(linkFor(`share-${n.id}`), text ?? title)} target="_blank" rel="noopener noreferrer">
              {n.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
