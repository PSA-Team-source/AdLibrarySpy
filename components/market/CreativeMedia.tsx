'use client';
import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { catchEarlyImgError, cn } from '@/lib/utils';

/**
 * Creative media. Video creatives play inline — the index stores real MP4s for
 * about half the library, and a still frame of a video ad tells you nothing
 * about the hook, which is the thing a media buyer is actually studying.
 * Muted autoplay on hover, click to play with sound. Video ads we do not host
 * (only winners keep an MP4) show their still with a play button that opens the
 * ad's permanent Meta Ad Library page (watchUrl) in a new tab.
 */
export function CreativeMedia({ image, videoUrl, watchUrl = '', alt, className, autoPlayOnHover = true }: {
  image: string; videoUrl: string; watchUrl?: string; alt: string; className?: string; autoPlayOnHover?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const hasVideo = !!videoUrl && !failed;

  // Neither a playable video nor a paintable still: render nothing at all.
  if ((!image || imgFailed) && !hasVideo) return null;

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.muted = false; setMuted(false); v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onMouseEnter={() => {
        if (!autoPlayOnHover || !hasVideo) return;
        const v = videoRef.current;
        if (v && v.paused) { v.muted = true; v.play().catch(() => {}); }
      }}
      onMouseLeave={() => {
        const v = videoRef.current;
        if (v && !playing) { v.pause(); v.currentTime = 0; }
      }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={(!imgFailed && image) || undefined}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
          onError={() => setFailed(true)}
          className="block h-auto max-h-[80vh] w-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt} loading="lazy" onError={() => setImgFailed(true)} ref={catchEarlyImgError(() => setImgFailed(true))}
          className="block h-auto max-h-[80vh] w-full object-contain" />
      )}

      {!hasVideo && watchUrl && image && !imgFailed && (
        // A button, not <a>: cards wrap this in their own link.
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(watchUrl, '_blank', 'noopener,noreferrer'); }}
          aria-label="Play video on Meta Ad Library (opens in a new tab)"
          title="Play on Meta Ad Library"
          className="absolute inset-0 grid place-items-center transition-opacity hover:bg-black/10"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 shadow-lg">
            <Play className="ml-0.5 h-6 w-6 text-black" fill="black" />
          </span>
        </button>
      )}

      {hasVideo && (
        <>
          <button
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play with sound'}
            className="absolute inset-0 grid place-items-center transition-opacity hover:bg-black/10"
          >
            <span className={cn(
              'grid h-14 w-14 place-items-center rounded-full bg-white/90 shadow-lg transition-opacity',
              playing && 'opacity-0 hover:opacity-100',
            )}>
              {playing ? <Pause className="h-6 w-6 text-black" fill="black" />
                       : <Play className="ml-0.5 h-6 w-6 text-black" fill="black" />}
            </span>
          </button>
          <button
            onClick={e => {
              e.preventDefault(); e.stopPropagation();
              const v = videoRef.current; if (!v) return;
              v.muted = !v.muted; setMuted(v.muted);
            }}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
    </div>
  );
}
