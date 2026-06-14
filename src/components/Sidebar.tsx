import { useDashboardStore } from '../store';

const navItems = [
  { label: 'Dashboard', icon: '📊' },
  { label: 'Subagents', icon: '🤖' },
  { label: 'Schedule', icon: '📅' },
  { label: 'Analytics', icon: '📈' },
  { label: 'Slack', icon: '💬' },
  { label: 'Buffer', icon: '📱' },
  { label: 'Google Sheets', icon: '📋' },
];

const systemItems = [
  { label: 'Settings', icon: '⚙️' },
  { label: 'Logs', icon: '📝' },
];

export default function Sidebar() {
  const sidebarOpen = useDashboardStore((state) => state.sidebarOpen);

  return (
    <aside
      className={`bg-neon-gray border-r border-neon-yellow border-opacity-30 transition-all duration-300 overflow-hidden flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-0'
      }`}
    >
      <nav className="flex-1 px-4 py-6 space-y-2">
        <div className="mb-6">
          <h2 className="text-xs font-bold text-neon-yellow text-opacity-70 uppercase tracking-wider px-4 mb-4">
            Main
          </h2>
          {navItems.map((item) => (
            <button
              key={item.label}
              className="w-full text-left px-4 py-3 rounded text-neon-yellow hover:bg-neon-yellow hover:bg-opacity-10 transition-all neon-button"
            >
              <span className="text-lg mr-3">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div>
          <h2 className="text-xs font-bold text-neon-yellow text-opacity-70 uppercase tracking-wider px-4 mb-4 mt-6">
            System
          </h2>
          {systemItems.map((item) => (
            <button
              key={item.label}
              className="w-full text-left px-4 py-3 rounded text-neon-yellow text-opacity-70 hover:text-opacity-100 hover:bg-neon-yellow hover:bg-opacity-10 transition-all"
            >
              <span className="text-lg mr-3">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="border-t border-neon-yellow border-opacity-20 px-4 py-4 text-xs text-neon-yellow text-opacity-50">
        <p>v1.0.0</p>
        <p className="mt-2">Status: ONLINE</p>
      </div>
    </aside>
  );
}
