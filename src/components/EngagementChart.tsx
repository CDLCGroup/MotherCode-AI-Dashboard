import { useDashboardStore } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function EngagementChart() {
  const { engagementScore, engagementTrend } = useDashboardStore();

  const data = engagementTrend.map((value, idx) => ({
    name: `Day ${idx + 1}`,
    engagement: value,
  }));

  return (
    <div className="neon-box bg-gradient-to-b from-neon-black to-neon-gray p-6 rounded-lg border border-neon-yellow border-opacity-30">
      <div className="mb-6">
        <h2 className="text-xl font-bold neon-text mb-2">📊 ENGAGEMENT METRICS</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold neon-text">{engagementScore.toFixed(1)}</span>
          <span className="text-neon-yellow text-opacity-70">/10.0</span>
          <span className="text-green-400 text-sm ml-4">↑ +0.3 this week</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 223, 0, 0.1)" />
          <XAxis dataKey="name" stroke="rgba(255, 223, 0, 0.5)" style={{ fontSize: '12px' }} />
          <YAxis stroke="rgba(255, 223, 0, 0.5)" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid rgba(255, 223, 0, 0.5)',
              borderRadius: '4px',
              color: '#ffdf00',
            }}
          />
          <Bar dataKey="engagement" fill="rgba(255, 223, 0, 0.8)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
