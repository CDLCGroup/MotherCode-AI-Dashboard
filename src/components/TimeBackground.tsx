// src/components/TimeBackground.tsx
//
// Full-screen, time-of-day video backdrop for the dashboard.
//   Day.mp4   — 06:00 to 18:00 Central Africa Time (CAT, UTC+2)
//   Night.mp4 — 18:00 to 06:00 CAT
// The choice is computed from CAT regardless of the viewer's own timezone, and
// re-evaluated every minute so it flips at the 06:00/18:00 boundary without a
// page reload. A dark overlay sits on top so the glass panels stay readable.

import { useEffect, useState } from 'react';

const CAT_OFFSET_HOURS = 2; // Central Africa Time is UTC+2, no DST.

/** True between 06:00 (inclusive) and 18:00 (exclusive) CAT. */
function isDaytimeCAT(now: Date = new Date()): boolean {
  const catHour = (now.getUTCHours() + CAT_OFFSET_HOURS + 24) % 24;
  return catHour >= 6 && catHour < 18;
}

export default function TimeBackground() {
  const [day, setDay] = useState<boolean>(() => isDaytimeCAT());

  useEffect(() => {
    const tick = () => setDay(isDaytimeCAT());
    tick(); // sync immediately on mount
    const id = setInterval(tick, 60_000); // re-check each minute for the boundary
    return () => clearInterval(id);
  }, []);

  const src = day ? '/Day.mp4' : '/Night.mp4';

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: '#050508', // fallback while the video buffers
        pointerEvents: 'none',
      }}
    >
      <video
        key={src} // force a reload when the source flips at the boundary
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {/* Readability overlay — keeps the metric panels legible over bright frames. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(5,5,8,0.55) 0%, rgba(5,5,8,0.40) 50%, rgba(5,5,8,0.60) 100%)',
        }}
      />
    </div>
  );
}
