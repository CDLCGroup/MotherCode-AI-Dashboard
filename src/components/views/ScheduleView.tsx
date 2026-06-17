// src/components/views/ScheduleView.tsx
// Task / agenda view backed by /api/tasks (in-memory fallback on the backend, so
// it works keyless). Lists tasks and creates new ones.

import { useEffect, useState } from 'react';
import { useDashboardStore } from '../../store';
import { getTheme, MONO } from '../../theme';
import ViewChrome from './ViewChrome';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const USER_ID = import.meta.env.VITE_USER_ID || '1';

interface Task {
  id: number | string;
  title: string;
  description: string | null;
  status: string;
  agent_responsible: string | null;
  due_date: string | null;
  created_by_voice: boolean;
  created_at: string;
}

export default function ScheduleView() {
  const variant = useDashboardStore((s) => s.themeVariant);
  const theme = getTheme(variant);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks?userId=${USER_ID}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, title: title.trim(), dueDate: due || null }),
      });
      setTitle('');
      setDue('');
      await load();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '9px 11px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #222',
    borderRadius: 4,
    color: '#ccc',
    fontFamily: MONO,
    fontSize: 11,
    outline: 'none',
  };

  return (
    <ViewChrome title="SCHEDULE" subtitle={`${tasks.length} tasks`}>
      {/* Create */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', maxWidth: 760 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="new task title…"
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} style={inputStyle} />
        <button
          onClick={create}
          disabled={saving || !title.trim()}
          style={{ ...inputStyle, cursor: 'pointer', color: theme.accent, borderColor: theme.accent, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? '…' : '+ ADD'}
        </button>
      </div>

      {loading && tasks.length === 0 && <Empty text="loading…" />}
      {!loading && tasks.length === 0 && <Empty text="no tasks yet — add one above, or say “schedule a post for Thursday” on the VOICE tab" />}

      <div style={{ display: 'grid', gap: 10, maxWidth: 760 }}>
        {tasks.map((t) => (
          <div
            key={t.id}
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6,
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.015)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.accent, marginTop: 5, boxShadow: `0 0 6px ${theme.accent}` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#ddd' }}>{t.title}</span>
                {t.created_by_voice && (
                  <span style={{ fontFamily: MONO, fontSize: 8, color: theme.accent, border: `1px solid ${theme.accent}`, borderRadius: 3, padding: '1px 5px' }}>
                    🎙 VOICE
                  </span>
                )}
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#666', marginLeft: 'auto' }}>{t.status}</span>
              </div>
              {t.description && <p style={{ margin: '5px 0 0', fontSize: 11, color: '#888' }}>{t.description}</p>}
              <p style={{ margin: '5px 0 0', fontFamily: MONO, fontSize: 9, color: '#3a3a50' }}>
                {t.due_date ? `due ${new Date(t.due_date).toLocaleString()} · ` : ''}
                created {new Date(t.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ViewChrome>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#555', fontFamily: MONO, fontSize: 12, maxWidth: 760 }}>{text}</div>;
}
