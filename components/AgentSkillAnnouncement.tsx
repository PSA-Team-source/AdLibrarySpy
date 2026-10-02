'use client';
import { useState } from 'react';
import { Bot, Check, Copy, X } from 'lucide-react';

import { AGENT_MESSAGE, SKILL_DISMISS_COOKIE } from '@/lib/public/site';
import { dismissSkillBannerAction } from '@/lib/account';

/** App announcement: the one line a user pastes into Claude, ChatGPT, Cursor or any agent (app/SKILL.md). */
export function AgentSkillAnnouncement() {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  if (hidden) return null;

  // Cookie hides it on this browser at once; the account flag on every device.
  function dismiss() {
    document.cookie = `${SKILL_DISMISS_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax`;
    setHidden(true);
    dismissSkillBannerAction().catch(() => { /* offline: the cookie still holds */ });
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(AGENT_MESSAGE);
      setCopied(true);
      // Copied = done with it: show "Copied", then hide it for good.
      setTimeout(dismiss, 1500);
    } catch {
      // Clipboard blocked by permissions: the message stays selectable.
    }
  };

  return (
    <section aria-label="Message for your agent" className="mb-6 rounded-xl border border-[rgba(88,177,39,.35)] bg-[rgba(167,244,90,.06)] p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 hidden h-5 w-5 shrink-0 text-[#58b127] sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            New: AdLibrarySpy works from your AI agent. <span className="font-normal text-muted-foreground">Send it this message:</span>
          </p>
          {/* One line on a phone (Copy takes the whole message); wraps from sm up. */}
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-[13px] text-foreground sm:whitespace-normal sm:break-words" title={AGENT_MESSAGE}>{AGENT_MESSAGE}</code>
            <button type="button" onClick={copy} className="btn-ghost shrink-0 justify-center gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="tap-target -mr-1 -mt-1 shrink-0 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
