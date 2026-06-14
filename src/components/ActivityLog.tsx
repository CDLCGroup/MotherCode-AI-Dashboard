import { useDashboardStore } from '../store';

export default function ActivityLog() {
  const activityLog = useDashboardStore((state) => state.activityLog);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="neon-box bg-gradient-to-b from-neon-black to-neon-gray p-6 rounded-lg border border-neon-yellow border-opacity-30">
      <h2 className="text-xl font-bold neon-text mb-4">📝 ACTIVITY LOG</h2>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activityLog.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 text-sm border-l-2 border-neon-yellow border-opacity-30 pl-3 pb-3 animate-slideUp"
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <span className="text-neon-yellow text-opacity-70 flex-shrink-0 font-mono">
              {formatTime(entry.timestamp)}
            </span>
            <span className="text-neon-yellow flex-1">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
