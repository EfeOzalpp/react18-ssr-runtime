// src/ssr/projects/climate.enhancer.tsx
import { useEffect } from 'react';
import { useTooltipInit } from '../../utils/tooltip/tooltipInit';

export default function ClimateEnhancer() {
  useTooltipInit();

  useEffect(() => {
    const vid = document.getElementById('climate-media-video') as HTMLVideoElement | null;
    if (!vid) return;

    const cleanupFns: Array<() => void> = [];
    let pausedByVisibility = false;

    // 1) Upgrade poster to high-res if provided by SSR
    const fullPoster = vid.dataset?.srcFull;
    if (fullPoster && vid.poster !== fullPoster) {
      vid.poster = fullPoster;
    }

    // 2) Load eagerly if needed
    if (vid.readyState === 0) {
      vid.preload = 'auto';
      try { vid.load(); } catch {}
    }

    // 3) Hide poster after first painted frame
    const hidePoster = () => {
      vid.removeAttribute('poster');
    };

    const onPlay = () => {
      const anyV = vid as any;
      if (typeof anyV.requestVideoFrameCallback === 'function') {
        anyV.requestVideoFrameCallback(() => hidePoster());
      } else {
        const onTime = () => {
          if (vid.currentTime > 0 && vid.readyState >= 2) {
            vid.removeEventListener('timeupdate', onTime);
            hidePoster();
          }
        };
        vid.addEventListener('timeupdate', onTime, { once: true });
        cleanupFns.push(() => vid.removeEventListener('timeupdate', onTime));

        const timer = setTimeout(() => {
          vid.removeEventListener('timeupdate', onTime);
          hidePoster();
        }, 1200);
        cleanupFns.push(() => clearTimeout(timer));
      }
    };

    vid.addEventListener('play', onPlay, { once: true });
    cleanupFns.push(() => vid.removeEventListener('play', onPlay));

    // 4) Try autoplay
    vid.play().catch(() => {});

    // 5) Pause on hidden, resume only if we paused it
    const onVis = () => {
      if (document.hidden) {
        if (!vid.paused) {
          pausedByVisibility = true;
          vid.pause();
          return;
        }
        if (!vid.ended && vid.currentTime > 0) {
          pausedByVisibility = true;
        }
        return;
      }

      if (pausedByVisibility) {
        pausedByVisibility = false;
        const tryPlay = () => vid.play().catch(() => {});
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryPlay);
        else tryPlay();
      }
    };

    document.addEventListener('visibilitychange', onVis);
    cleanupFns.push(() => document.removeEventListener('visibilitychange', onVis));

    return () => cleanupFns.forEach((fn) => fn());
  }, []);

  return null;
}
