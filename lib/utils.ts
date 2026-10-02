// Tailwind class merging (the standard shadcn/ui `cn` helper). Dates are
// formatted in lib/format.ts.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

/**
 * Ref for an <img> whose onError hides it. A server-rendered image can fail
 * before React hydrates, and then onError never fires, leaving a broken-image
 * glyph on screen. On mount, an image that is complete but has no pixels
 * already failed, so report it the same way onError would.
 */
export function catchEarlyImgError(onFail: () => void) {
  return (el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) onFail();
  };
}

/** A new workspace's name when the user gives none: "Jane's team" (first name, else the email's local part). */
export function defaultWorkspaceName(name: string | null | undefined, email: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0] || email.split('@')[0] || 'My';
  return `${first.slice(0, 60)}'s team`;
}
