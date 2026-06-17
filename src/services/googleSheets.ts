// Google Sheets MCP Integration Service
// Handles syncing content from Google Sheets

interface SheetContent {
  id: string;
  platform: string;
  content: string;
  mediaUrls?: string[];
  scheduledTime?: string;
  status: 'pending' | 'scheduled' | 'published';
}

class GoogleSheetsMCPService {
  private baseUrl = import.meta.env.VITE_SHEETS_MCP_URL || 'http://localhost:3001';
  private sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID || '19MwW0LQ-Cc4gaTpwe1ANsc50Zt77D_Wo_pHn1_1zFYA';

  async syncContent(): Promise<{ success: boolean; rowsImported?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: this.sheetId }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to sync Google Sheets:', error);
      return { success: false, error: 'Failed to sync' };
    }
  }

  async getContent(): Promise<SheetContent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/content?sheetId=${this.sheetId}`);
      const data = await response.json();
      return data.content || [];
    } catch (error) {
      console.error('Failed to fetch sheet content:', error);
      return [];
    }
  }

  async updateContentStatus(rowId: string, status: SheetContent['status']): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: this.sheetId, rowId, status }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to update content status:', error);
      return { success: false, error: 'Failed to update' };
    }
  }

  async getPendingContent(): Promise<SheetContent[]> {
    try {
      const content = await this.getContent();
      return content.filter((item) => item.status === 'pending');
    } catch (error) {
      console.error('Failed to get pending content:', error);
      return [];
    }
  }

  async getSheetMetadata(): Promise<{ rowCount?: number; columnCount?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sheets/metadata?sheetId=${this.sheetId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get sheet metadata:', error);
      return { error: 'Failed to get metadata' };
    }
  }
}

export const googleSheetsService = new GoogleSheetsMCPService();
