// Buffer MCP Integration Service
// Handles communication with Buffer API via MCP server

interface BufferPost {
  id: string;
  text: string;
  scheduledAt: string;
  status: 'scheduled' | 'sent' | 'failed';
  platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok';
}

interface BufferProfile {
  id: string;
  name: string;
  platform: string;
}

class BufferMCPService {
  private baseUrl = import.meta.env.VITE_BUFFER_MCP_URL || 'http://localhost:3001';

  async getQueueCount(): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buffer/queue`);
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error('Failed to fetch Buffer queue count:', error);
      return 0;
    }
  }

  async getScheduledPosts(): Promise<BufferPost[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buffer/posts/scheduled`);
      const data = await response.json();
      return data.posts || [];
    } catch (error) {
      console.error('Failed to fetch scheduled posts:', error);
      return [];
    }
  }

  async schedulePost(content: {
    text: string;
    media?: string[];
    scheduledAt: string;
    platforms: string[];
  }): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buffer/posts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to schedule post:', error);
      return { success: false, error: 'Failed to schedule post' };
    }
  }

  async publishPost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buffer/posts/${postId}/publish`, {
        method: 'POST',
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to publish post:', error);
      return { success: false, error: 'Failed to publish post' };
    }
  }

  async deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buffer/posts/${postId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to delete post:', error);
      return { success: false, error: 'Failed to delete post' };
    }
  }

  async getProfiles(): Promise<BufferProfile[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/buffer/profiles`);
      const data = await response.json();
      return data.profiles || [];
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
      return [];
    }
  }

  async syncFromGoogleSheets(sheetId: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sync/google-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to sync from Google Sheets:', error);
      return { success: false, error: 'Failed to sync' };
    }
  }
}

export const bufferService = new BufferMCPService();
