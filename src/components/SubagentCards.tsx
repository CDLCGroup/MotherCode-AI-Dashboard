import { useDashboardStore } from '../store';

type StatusType = 'active' | 'idle' | 'processing' | 'error';

const statusColors: Record<StatusType, string> = {
  active: 'text-green-400',
  idle: 'text-yellow-400',
  processing: 'text-cyan-400',
  error: 'text-red-400',
};

const statusIndicators: Record<StatusType, string> = {
  active: '🟢',
  idle: '🟡',
  processing: '🔵',
  error: '🔴',
};

interface Agent {
  id: string;
  name: string;
  status: StatusType;
  postsProcessed: number;
  tasksCompleted: number;
  lastActive: string;
}

export default function SubagentCards() {
  const subagents = useDashboardStore((state) => state.subagents) as Agent[];

  return (
    <>
      {subagents.map((agent) => (
        <div
          key={agent.id}
          className="neon-box bg-gradient-to-br from-neon-black to-neon-gray p-5 rounded-lg border border-neon-yellow border-opacity-30 hover:border-opacity-60 transition-all hover:shadow-lg hover:shadow-neon-yellow hover:shadow-opacity-20 animate-slideUp"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold neon-text">{agent.name}</h3>
              <div className={`flex items-center gap-2 mt-1 ${statusColors[agent.status]}`}>
                <span className="text-lg">{statusIndicators[agent.status]}</span>
                <span className="text-sm uppercase font-semibold">{agent.status}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-neon-yellow text-opacity-70">Posts Processed</span>
              <span className="font-bold text-neon-yellow">{agent.postsProcessed}</span>
            </div>
            <div className="w-full bg-neon-black bg-opacity-50 rounded h-2 border border-neon-yellow border-opacity-20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-yellow to-green-400"
                style={{ width: `${Math.min((agent.postsProcessed / 500) * 100, 100)}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-neon-yellow text-opacity-70">Tasks Completed</span>
              <span className="font-bold text-neon-yellow">{agent.tasksCompleted}</span>
            </div>
            <div className="w-full bg-neon-black bg-opacity-50 rounded h-2 border border-neon-yellow border-opacity-20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-neon-yellow"
                style={{ width: `${Math.min((agent.tasksCompleted / 2000) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <button className="w-full mt-4 neon-button px-3 py-2 rounded text-xs font-semibold hover:neon-glow transition-all">
            VIEW DETAILS →
          </button>
        </div>
      ))}
    </>
  );
}
