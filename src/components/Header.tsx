import { useDashboardStore } from '../store';

export default function Header() {
  const toggleSidebar = useDashboardStore((state) => state.toggleSidebar);
  const slackConnected = useDashboardStore((state) => state.slackConnected);

  return (
    <header className="bg-neon-black border-b border-neon-yellow border-opacity-30 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="neon-button px-4 py-2 rounded hover:neon-glow transition-all"
        >
          ☰ MENU
        </button>
        <h1 className="text-2xl font-bold neon-text">⚡ MOTHERCODE AI DASHBOARD</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${slackConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm text-neon-yellow">
            {slackConnected ? 'SLACK CONNECTED' : 'SLACK OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}
