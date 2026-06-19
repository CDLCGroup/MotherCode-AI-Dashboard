// src/components/CalendarWidget.tsx
//
// A self-contained mini month calendar for the dashboard right rail. Renders the
// current month with today highlighted in the active accent. Surface-aware (dark
// / light) and collapsible. It does not invent events — when the calendar agent
// isn't connected it says so; today's marker is always real (local clock).

import type { Surface } from '../theme';
import { MONO } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

interface Props {
  surf: Surface;
  accent: string;
  accentRGB: string;
  expanded: boolean;
  onToggle: () => void;
  configured: boolean;
}

export default function CalendarWidget({ surf, accent, accentRGB, expanded, onToggle, configured }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a 6-row grid of day numbers (null for leading/trailing blanks).
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${surf.border}` }}>
      <button
        onClick={onToggle}
        title={expanded ? 'collapse' : 'expand'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          marginBottom: expanded ? 10 : 0,
          cursor: 'pointer',
          color: accent,
        }}
      >
        <span style={{ fontSize: 9, letterSpacing: 2, opacity: 0.85 }}>
          CALENDAR · {MONTHS[month]} {year}
        </span>
        <span style={{ fontSize: 9, transition: 'transform 240ms ease', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
      </button>

      <div
        style={{
          maxHeight: expanded ? 220 : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 280ms cubic-bezier(.4,0,.2,1), opacity 200ms ease',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontFamily: MONO }}>
          {WEEKDAYS.map((w, i) => (
            <div key={`h${i}`} style={{ textAlign: 'center', fontSize: 8, color: surf.muted, padding: '2px 0', letterSpacing: 0.5 }}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            const isToday = d === today;
            return (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  fontSize: 9.5,
                  padding: '4px 0',
                  borderRadius: 3,
                  color: d == null ? 'transparent' : isToday ? (surf.fg === '#0b1c22' ? '#fff' : '#04070f') : surf.fg,
                  background: isToday ? accent : 'transparent',
                  boxShadow: isToday ? `0 0 8px rgba(${accentRGB},0.6)` : 'none',
                  fontWeight: isToday ? 700 : 400,
                }}
              >
                {d ?? '·'}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 8, lineHeight: 1.5, color: surf.muted }}>
          {configured ? 'Calendar agent online — say "what\'s on my calendar".' : 'Connect Google to surface events here.'}
        </div>
      </div>
    </div>
  );
}
