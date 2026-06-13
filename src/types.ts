export type UserRole = 'agent' | 'customer';

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 data-URL
}

export interface ChatMessage {
  id: string;
  sender: UserRole | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  file?: FileAttachment;
}

export interface CallRecording {
  id: string;
  status: 'in-progress' | 'processing' | 'ready';
  startedAt: string;
  endedAt?: string;
  url?: string;
}

export interface SessionInfo {
  sessionId: string;
  token: string;
  title: string;
  status: 'active' | 'ended';
  agentConnected: boolean;
  customerConnected: boolean;
  agentName?: string;
  customerName?: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  messages: ChatMessage[];
  recording?: CallRecording;
  reconGraceState?: {
    role: UserRole;
    disconnectTime: string;
  } | null;
}

export interface SessionHistoryItem {
  id: string;
  sessionId: string;
  title: string;
  agentName: string;
  customerName: string;
  joinedAt: string;
  endedAt: string;
  durationMs: number;
  messageCount: number;
  recordingUrl?: string;
}

export interface SystemMetrics {
  activeSessions: number;
  connectedParticipants: number;
  totalCallsCreated: number;
  errorRate: number; // Percentage
  avgDurationSec: number;
}
