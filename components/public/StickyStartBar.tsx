'use client';
// Phone-only bottom bar that brings the hero's email signup (#<target>) back once
// it has scrolled out of view: one tap scrolls to it and opens the keyboard on the
// email field. Hidden while the form is on screen, and from `sm` up (the desktop
// header keeps its "Start free"). Renders nothing on the server, so the edge-cached
// homepage stays the same for every visitor.
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

export function StickyStartBar({ target }: { target: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(target);
    // Signed-in visitors have no signup form to return to (app/layout.tsx sets the flag).
    if (!el || !('IntersectionObserver' in window) || 'signedIn' in document.documentElement.dataset) return;
    // Shown only once the form has scrolled ABOVE the viewport, never before the visitor reached it.
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  if (!show) return null;
  const go = () => {
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focus inside the tap so iOS opens the keyboard; the code step has no email field.
    el.querySelector<HTMLInputElement>('input[name="email"]:not([type="hidden"]), input[name="code"]')?.focus({ preventScroll: true });
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#050807]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
      <button type="button" onClick={go}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#a7f45a] text-[15px] font-semibold text-[#071004]">
        Start free <span className="font-normal text-[#071004]/70">· no card</span> <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
