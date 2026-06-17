// src/components/views/ViewChrome.tsx
// Shared page chrome for non-voice dashboard views: titled, scrollable, themed.

import type { ReactNode } from 'react';
import { useDashboardStore } from '../../store';
import { getTheme, MONO } from '../../theme';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function ViewChrome({ title, subtitle, actions, children }: Props) {
  const variant = useDashboardStore((s) => s.themeVariant);
  const theme = getTheme(variant);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#050508' }}>
      <header
        style={{
          padding: '52px 28px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          position: 'sticky',
          top: 0,
          background: 'rgba(5,5,12,0.97)',
          backdropFilter: 'blur(6px)',
          zIndex: 10,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontFamily: MONO, fontSize: 18, color: theme.accent, letterSpacing: 1 }}>{title}</h1>
          {subtitle && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#666', fontFamily: MONO }}>{subtitle}</p>
          )}
        </div>
        {actions}
      </header>
      <div style={{ padding: '20px 28px 40px' }}>{children}</div>
    </div>
  );
}
