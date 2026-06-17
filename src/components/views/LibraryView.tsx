// src/components/views/LibraryView.tsx
// Content Library — placeholder. No content source exists yet (lands in Phase 4
// with the Social/Buffer agents). Honest empty state rather than mock tiles.

import { useDashboardStore } from '../../store';
import { getTheme, MONO } from '../../theme';
import ViewChrome from './ViewChrome';

export default function LibraryView() {
  const variant = useDashboardStore((s) => s.themeVariant);
  const theme = getTheme(variant);

  return (
    <ViewChrome title="CONTENT LIBRARY" subtitle="media & posts">
      <div
        style={{
          border: `1px dashed rgba(${theme.accentRGB},0.3)`,
          borderRadius: 8,
          padding: '60px 24px',
          textAlign: 'center',
          maxWidth: 760,
          background: 'rgba(255,255,255,0.015)',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.6 }}>▦</div>
        <h2 style={{ margin: 0, fontFamily: MONO, fontSize: 14, color: theme.accent, letterSpacing: 1 }}>No content source connected</h2>
        <p style={{ margin: '12px auto 0', maxWidth: 460, fontSize: 12, color: '#777', lineHeight: 1.6 }}>
          The content library populates in <b>Phase 4</b>, when the Social / Buffer agents bring in
          scheduled posts and media. Until then there's nothing real to show — and we don't fake it.
        </p>
      </div>
    </ViewChrome>
  );
}
