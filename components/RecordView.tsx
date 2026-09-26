'use client';
import { useEffect } from 'react';

/**
 * Logs one "recently viewed" entry when a dossier is actually on screen.
 * Renders nothing. Fire-and-forget: a failed write must never affect the page.
 */
export default function RecordView({ type, id, label, image = '' }: {
  type: 'shop' | 'ad' | 'advertiser';
  id: string;
  label: string;
  image?: string;
}) {
  useEffect(() => {
    if (!id) return;
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, label, image }),
      keepalive: true,
    }).catch(() => {});
  }, [type, id, label, image]);
  return null;
}
