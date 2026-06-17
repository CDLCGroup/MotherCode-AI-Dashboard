// Slack MCP Integration Service
// Handles notifications and status updates via Slack

interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: any[];
}

class SlackMCPService {
  private baseUrl = import.meta.env.VITE_SLACK_MCP_URL || 'http://localhost:3001';

  async sendMessage(message: SlackMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/slack/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to send Slack message:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  async sendNotification(title: string, message: string): Promise<void> {
    await this.sendMessage({
      channel: '#mothercode-notifications',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${title}*\n${message}`,
          },
        },
      ],
    });
  }

  async sendStatusUpdate(status: {
    agentName: string;
    newStatus: string;
    postsProcessed?: number;
  }): Promise<void> {
    const emoji = status.newStatus === 'active' ? '✅' : '⏸';
    await this.sendNotification(
      `${emoji} ${status.agentName} Status Update`,
      `Status: ${status.newStatus}${status.postsProcessed ? `\nPosts: ${status.postsProcessed}` : ''}`
    );
  }

  async sendPostAlert(post: {
    platform: string;
    status: string;
    scheduledTime?: string;
  }): Promise<void> {
    const emoji = post.status === 'published' ? '📤' : '📅';
    await this.sendNotification(
      `${emoji} ${post.platform} Post ${post.status}`,
      `Scheduled for: ${post.scheduledTime || 'Now'}`
    );
  }

  async getWorkspaceStatus(): Promise<{ connected: boolean; channelCount?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/slack/status`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get Slack status:', error);
      return { connected: false, error: 'Failed to get status' };
    }
  }
}

export const slackService = new SlackMCPService();
