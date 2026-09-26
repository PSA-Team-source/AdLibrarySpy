'use client';
import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { catchEarlyImgError, cn } from '@/lib/utils';

/**
 * Creative media. Video creatives play inline — the index stores real MP4s for
 * about half the library, and a still frame of a video ad tells you nothing
 * about the hook, which is the thing a media buyer is actually studying.
 * Muted autoplay on hover, click to play with sound.
 */
export function CreativeMedia({ image, videoUrl, alt, className, autoPlayOnHover = true }: {
  image: string; videoUrl: string; alt: string; className?: string; autoPlayOnHover?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  const hasVideo = !!videoUrl && !failed;

  if (!image && !hasVideo) return null;

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
      className={cn('relative overflow-hidden bg-muted', className)}
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
          poster={image || undefined}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          aria-label={alt}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt} loading="lazy" onError={() => setFailed(true)} ref={catchEarlyImgError(() => setFailed(true))}
          className="h-full w-full object-contain" />
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
