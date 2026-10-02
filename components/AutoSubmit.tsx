'use client';
import { useEffect, useRef } from 'react';

// Submits the enclosing form once on load, so an emailed sign-in link opens the
// app in one click. Mail scanners fetch the URL but do not run scripts, so the
// one-time link is still not consumed by a preview.
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { ref.current?.closest('form')?.requestSubmit(); }, []);
  return <span ref={ref} hidden />;
}
