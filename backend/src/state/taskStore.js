// backend/src/state/taskStore.js
//
// In-memory task store mirroring voiceStore: lets the Schedule view work without
// Postgres. Postgres persistence is best-effort (see taskRoutes) — when a DB is
// present it's authoritative for reads; this buffer keeps the app functional
// (and voice "schedule…" commands useful) when it isn't.

const tasks = [];
let seq = 0;

export function addTask({ userId, title, description, agentResponsible, dueDate, createdByVoice, status }) {
  seq += 1;
  const task = {
    id: `mem_${seq}`,
    user_id: userId ?? null,
    title,
    description: description || null,
    status: status || 'draft',
    agent_responsible: agentResponsible || null,
    due_date: dueDate || null,
    created_by_voice: !!createdByVoice,
    created_at: new Date().toISOString(),
    source: 'memory',
  };
  tasks.unshift(task);
  if (tasks.length > 200) tasks.length = 200;
  return task;
}

export function getTasks(userId) {
  if (userId === undefined || userId === null) return tasks.slice();
  return tasks.filter((t) => String(t.user_id) === String(userId));
}

export default { addTask, getTasks };
