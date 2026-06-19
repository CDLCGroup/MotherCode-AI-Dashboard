import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Subagent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'processing' | 'error';
  postsProcessed: number;
  tasksCompleted: number;
}

export interface VoiceCall {
  conversationId: string;
  duration: number;
  status: 'completed' | 'failed' | 'in_progress' | 'unknown';
  intent: string;
  summary: string;
  timestamp: string;
}

export interface VoiceMetrics {
  total: number;
  completed: number;
  avgDuration: number;
  intentCounts: Record<string, number>;
}

// Voice-loop UI states — these drive the Glass-Metric orchestration core's
// waveform/label (STANDBY / LISTENING / RESPONDING / ERROR).
export type VoiceUiState = 'IDLE' | 'USER_TALKING' | 'AI_SPEAKING' | 'AGENT_ERROR';

export interface DashboardState {
  sidebarOpen: boolean;
  subagents: Subagent[];
  postsQueued: number;
  weeklyMetrics: number;
  engagementScore: number;
  engagementTrend: number[];
  bufferQueueCount: number;
  slackConnected: boolean;
  googleSheetsSync: boolean;
  activityLog: { timestamp: string; message: string }[];
  voiceCalls: VoiceCall[];
  voiceMetrics: VoiceMetrics;
  voiceAgentConfigured: boolean;
  voiceDomains: string[];
  voiceProviders: { stt: string; tts: string };
  // Live voice-loop state
  voiceUiState: VoiceUiState;
  voiceRunning: boolean;
  liveTranscript: string;
  liveResponse: string;
  // Shared UI theme (Glass-Metric variant 1/2/3) + active dashboard view
  themeVariant: number;
  activeView: string;
  // Persisted dashboard layout prefs (collapsible rails + chips + dark mode)
  darkMode: boolean;
  leftRailOpen: boolean;
  rightRailOpen: boolean;
  bottomStripOpen: boolean;
  cortexExpanded: boolean;
  calendarExpanded: boolean;
  toggleSidebar: () => void;
  updateSubagentStatus: (id: string, status: Subagent['status']) => void;
  setPostsQueued: (count: number) => void;
  setEngagementScore: (score: number) => void;
  addActivityLog: (message: string) => void;
  setBufferQueue: (count: number) => void;
  setSlackConnected: (connected: boolean) => void;
  setGoogleSheetsSync: (synced: boolean) => void;
  addVoiceCall: (call: VoiceCall) => void;
  setVoiceCalls: (calls: VoiceCall[]) => void;
  setVoiceMetrics: (metrics: VoiceMetrics) => void;
  setVoiceAgentConfigured: (configured: boolean) => void;
  setVoiceDomains: (domains: string[]) => void;
  setVoiceProviders: (providers: { stt: string; tts: string }) => void;
  setVoiceUiState: (state: VoiceUiState) => void;
  setVoiceRunning: (running: boolean) => void;
  toggleVoiceRunning: () => void;
  setLiveTranscript: (text: string) => void;
  setLiveResponse: (text: string) => void;
  setThemeVariant: (variant: number) => void;
  setActiveView: (view: string) => void;
  toggleDarkMode: () => void;
  setDarkMode: (on: boolean) => void;
  toggleLeftRail: () => void;
  toggleRightRail: () => void;
  toggleBottomStrip: () => void;
  toggleCortex: () => void;
  toggleCalendar: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
  sidebarOpen: true,
  subagents: [
    { id: '1', name: 'TikTok Agent', status: 'active', postsProcessed: 342, tasksCompleted: 1205 },
    { id: '2', name: 'Instagram Agent', status: 'active', postsProcessed: 289, tasksCompleted: 1018 },
    { id: '3', name: 'YouTube Agent', status: 'processing', postsProcessed: 156, tasksCompleted: 542 },
    { id: '4', name: 'Twitter Agent', status: 'idle', postsProcessed: 421, tasksCompleted: 1456 },
    { id: '5', name: 'LinkedIn Agent', status: 'active', postsProcessed: 178, tasksCompleted: 634 },
    { id: '6', name: 'Buffer Scheduler', status: 'active', postsProcessed: 0, tasksCompleted: 892 },
  ],
  postsQueued: 47,
  weeklyMetrics: 2841,
  engagementScore: 8.7,
  engagementTrend: [65, 78, 82, 71, 89, 92, 87],
  bufferQueueCount: 12,
  slackConnected: true,
  googleSheetsSync: true,
  voiceCalls: [],
  voiceMetrics: { total: 0, completed: 0, avgDuration: 0, intentCounts: {} },
  voiceAgentConfigured: false,
  voiceDomains: [],
  voiceProviders: { stt: 'browser-speech', tts: 'browser-speech' },
  voiceUiState: 'IDLE',
  voiceRunning: true,
  liveTranscript: '',
  liveResponse: '',
  themeVariant: 1,
  activeView: 'voice',
  darkMode: true,
  leftRailOpen: true,
  rightRailOpen: true,
  bottomStripOpen: true,
  cortexExpanded: true,
  calendarExpanded: true,
  activityLog: [
    { timestamp: new Date().toISOString(), message: '✓ Dashboard initialized' },
    { timestamp: new Date(Date.now() - 60000).toISOString(), message: '✓ Buffer sync completed (12 posts)' },
    { timestamp: new Date(Date.now() - 120000).toISOString(), message: '✓ TikTok agent posted' },
    { timestamp: new Date(Date.now() - 180000).toISOString(), message: '✓ Google Sheets synced' },
  ],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  updateSubagentStatus: (id: string, status: Subagent['status']) =>
    set((state) => ({
      subagents: state.subagents.map((agent) =>
        agent.id === id ? { ...agent, status } : agent
      ),
    })),

  setPostsQueued: (count: number) => set({ postsQueued: count }),

  setEngagementScore: (score: number) => set({ engagementScore: score }),

  addActivityLog: (message: string) =>
    set((state) => ({
      activityLog: [
        { timestamp: new Date().toISOString(), message },
        ...state.activityLog.slice(0, 9),
      ],
    })),

  setBufferQueue: (count: number) => set({ bufferQueueCount: count }),

  setSlackConnected: (connected: boolean) => set({ slackConnected: connected }),

  setGoogleSheetsSync: (synced: boolean) => set({ googleSheetsSync: synced }),

  addVoiceCall: (call: VoiceCall) =>
    set((state) => ({
      voiceCalls: [call, ...state.voiceCalls].slice(0, 50),
    })),

  setVoiceCalls: (calls: VoiceCall[]) => set({ voiceCalls: calls }),

  setVoiceMetrics: (metrics: VoiceMetrics) => set({ voiceMetrics: metrics }),

  setVoiceAgentConfigured: (configured: boolean) => set({ voiceAgentConfigured: configured }),

  setVoiceDomains: (domains: string[]) => set({ voiceDomains: domains }),

  setVoiceProviders: (providers: { stt: string; tts: string }) => set({ voiceProviders: providers }),

  setVoiceUiState: (state: VoiceUiState) => set({ voiceUiState: state }),

  setVoiceRunning: (running: boolean) => set({ voiceRunning: running }),

  toggleVoiceRunning: () => set((state) => ({ voiceRunning: !state.voiceRunning })),

  setLiveTranscript: (text: string) => set({ liveTranscript: text }),

  setLiveResponse: (text: string) => set({ liveResponse: text }),

  setThemeVariant: (variant: number) => set({ themeVariant: variant }),

  setActiveView: (view: string) => set({ activeView: view }),

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setDarkMode: (on: boolean) => set({ darkMode: on }),
  toggleLeftRail: () => set((state) => ({ leftRailOpen: !state.leftRailOpen })),
  toggleRightRail: () => set((state) => ({ rightRailOpen: !state.rightRailOpen })),
  toggleBottomStrip: () => set((state) => ({ bottomStripOpen: !state.bottomStripOpen })),
  toggleCortex: () => set((state) => ({ cortexExpanded: !state.cortexExpanded })),
  toggleCalendar: () => set((state) => ({ calendarExpanded: !state.calendarExpanded })),
    }),
    {
      // Persist only UI-layout prefs — never the volatile voice data.
      name: 'mothercode-ui',
      version: 1,
      partialize: (s) => ({
        themeVariant: s.themeVariant,
        darkMode: s.darkMode,
        leftRailOpen: s.leftRailOpen,
        rightRailOpen: s.rightRailOpen,
        bottomStripOpen: s.bottomStripOpen,
        cortexExpanded: s.cortexExpanded,
        calendarExpanded: s.calendarExpanded,
      }),
    },
  ),
);
