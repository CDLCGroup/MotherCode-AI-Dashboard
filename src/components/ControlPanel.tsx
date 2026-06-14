import { useDashboardStore } from '../store';

export default function ControlPanel() {
  const { postsQueued, bufferQueueCount } = useDashboardStore();
  const addActivityLog = useDashboardStore((state) => state.addActivityLog);

  const handlePostNow = () => {
    addActivityLog('✓ POST NOW initiated - sending to all platforms');
  };

  const handlePauseAll = () => {
    addActivityLog('⏸ All agents paused');
  };

  const handleResume = () => {
    addActivityLog('▶ All agents resumed');
  };

  const handleEStop = () => {
    addActivityLog('🛑 EMERGENCY STOP activated');
  };

  return (
    <div className="neon-box bg-gradient-to-r from-neon-black to-neon-gray p-6 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-neon-black bg-opacity-50 p-4 rounded border border-neon-yellow border-opacity-20">
          <p className="text-neon-yellow text-opacity-70 text-sm">POSTS QUEUED</p>
          <p className="text-3xl font-bold neon-text">{postsQueued}</p>
        </div>
        <div className="bg-neon-black bg-opacity-50 p-4 rounded border border-neon-yellow border-opacity-20">
          <p className="text-neon-yellow text-opacity-70 text-sm">BUFFER QUEUE</p>
          <p className="text-3xl font-bold neon-text">{bufferQueueCount}</p>
        </div>
        <div className="bg-neon-black bg-opacity-50 p-4 rounded border border-neon-yellow border-opacity-20">
          <p className="text-neon-yellow text-opacity-70 text-sm">SYSTEM STATUS</p>
          <p className="text-3xl font-bold text-green-400">OPERATIONAL</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={handlePostNow}
          className="neon-button px-4 py-3 rounded font-bold hover:neon-glow transition-all bg-green-500 bg-opacity-20 border-green-500 border-opacity-50 text-green-400"
        >
          ▶ POST NOW
        </button>
        <button
          onClick={handlePauseAll}
          className="neon-button px-4 py-3 rounded font-bold hover:neon-glow transition-all bg-yellow-500 bg-opacity-20 border-yellow-500 border-opacity-50 text-yellow-400"
        >
          ⏸ PAUSE ALL
        </button>
        <button
          onClick={handleResume}
          className="neon-button px-4 py-3 rounded font-bold hover:neon-glow transition-all bg-blue-500 bg-opacity-20 border-blue-500 border-opacity-50 text-blue-400"
        >
          ▶ RESUME
        </button>
        <button
          onClick={handleEStop}
          className="neon-button px-4 py-3 rounded font-bold hover:neon-glow transition-all bg-red-500 bg-opacity-20 border-red-500 border-opacity-50 text-red-400"
        >
          🛑 E-STOP
        </button>
      </div>
    </div>
  );
}
