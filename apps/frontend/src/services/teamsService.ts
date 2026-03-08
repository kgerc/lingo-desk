import api from '../lib/api';

export interface MicrosoftTeamsSyncStatus {
  connected: boolean;
  isActive?: boolean;
  email?: string;
  lastSyncAt?: string | null;
  connectedAt?: string;
}

export interface MicrosoftTeamsAuthResponse {
  authUrl: string;
}

class TeamsService {
  async getSyncStatus(): Promise<MicrosoftTeamsSyncStatus> {
    const response = await api.get('/microsoft-teams/status') as any;
    return response.data;
  }

  async connect(): Promise<MicrosoftTeamsAuthResponse> {
    const response = await api.get('/microsoft-teams/auth') as any;
    return response.data;
  }

  async disconnect(): Promise<void> {
    await api.post('/microsoft-teams/disconnect');
  }
}

export const teamsService = new TeamsService();
