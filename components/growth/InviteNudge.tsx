'use client';
// "Working with a team? Invite them free" — shown once a solo workspace has 3+
// saved items (see afterSaveAction). Floats bottom-right so it works wherever
// the save star lives (table rows, drawers, detail pages). The form is the real
// Settings › Members invite form; closing it is remembered server-side.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { UserPlus, X } from 'lucide-react';
import { InviteForm } from '@/components/Members';
import { dismissInviteNudgeAction } from './actions';

// One prompt per page load, however many stars get clicked: ignoring it is an
// answer for now; closing it is an answer for good (dismissInviteNudgeAction).
let claimed = false;
export function claimInviteNudge(): boolean {
  if (claimed) return false;
  claimed = true;
  return true;
}

export default function InviteNudge({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const dismiss = () => { void dismissInviteNudgeAction(); onClose(); };

  return createPortal(
    <aside
      role="dialog" aria-labelledby="invite-nudge-title"
      className="fixed bottom-4 right-4 z-[30] w-[min(420px,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-left shadow-2xl"
    >
      <button type="button" onClick={dismiss} aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <UserPlus className="h-4 w-4" />
        </span>
        <div>
          <h2 id="invite-nudge-title" className="text-sm font-semibold text-foreground">Working with a team? Invite them free</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Teammates see everything anyone saves under Team, plus every tracked shop. Every seat is free.
          </p>
        </div>
      </div>
      {open ? (
        <div className="mt-3"><InviteForm /></div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(true)} className="btn-primary h-9 px-4 text-sm">Invite teammates</button>
          <button type="button" onClick={dismiss} className="btn-ghost h-9 px-4 text-sm">Not now</button>
        </div>
      )}
      {open && (
        <Link href="/settings/members" className="mt-2 inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Manage members
        </Link>
      )}
    </aside>,
    document.body,
  );
}
