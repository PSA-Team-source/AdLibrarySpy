'use client';
import { useState } from 'react';
import { catchEarlyImgError } from '@/lib/utils';

/** Product photo; if it fails to load it disappears — never an empty frame. */
export function WinnerImage({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <img src={src} alt="" loading="lazy" width={48} height={48}
      onError={() => setBroken(true)} ref={catchEarlyImgError(() => setBroken(true))}
      className="size-12 shrink-0 rounded-md border border-border bg-white object-cover" />
  );
}
