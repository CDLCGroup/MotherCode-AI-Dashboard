import Header from './Header';
import SubagentCards from './SubagentCards';
import ControlPanel from './ControlPanel';
import ActivityLog from './ActivityLog';
import EngagementChart from './EngagementChart';
import VoiceCallLog from './VoiceCallLog';

export default function Dashboard() {
  // Dashboard component using store state

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-neon-black">
      <Header />

      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Top Control Panel */}
        <ControlPanel />

        {/* Subagent Status Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SubagentCards />
        </div>

        {/* Bottom Section: Activity Log, Voice Calls, and Engagement Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ActivityLog />
          <VoiceCallLog />
          <EngagementChart />
        </div>
      </main>
    </div>
  );
}
