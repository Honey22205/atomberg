import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, Activity, Users, AlertTriangle, RefreshCw, BarChart2, CheckCircle2, Clock, Terminal } from 'lucide-react';
import { SystemMetrics, SessionInfo } from '../types';

interface AdminDashboardProps {
  metrics: SystemMetrics | null;
  activeSessions: SessionInfo[];
  fetchMetricsAndSessions: () => Promise<void>;
  onForceEndSession: (sessionId: string) => Promise<boolean>;
}

export default function AdminDashboard({
  metrics,
  activeSessions,
  fetchMetricsAndSessions,
  onForceEndSession
}: AdminDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [actioningSessionId, setActioningSessionId] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    await fetchMetricsAndSessions();
    setLoading(false);
    
    // simulation lines to the logger console
    const statuses = [
      "RTC signalling gateway: healthy - 0 active faults",
      "WebSocket routing frame buffers initialized",
      "Active worker nodes: 2 | Latency: 12ms | Port: 3000",
      "STUN peer discovery: online (any-candidate permitted)",
      `Database connection: in-memory repository synchronized -- ${activeSessions.length} active nodes`
    ];
    setLogMessages(prev => {
      const copy = [...prev];
      if (copy.length === 0) return statuses;
      return [...copy, `Poll cycles synchronized: ${new Date().toLocaleTimeString()} -- system nominal`].slice(-6);
    });
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleForceEnd = async (sessionId: string) => {
    if (!window.confirm(`⚠️ CRITICAL COMMAND: Are you sure you want to forcibly terminate active call ${sessionId}? This immediately disconnects both parties.`)) {
      return;
    }

    setActioningSessionId(sessionId);
    try {
      const ok = await onForceEndSession(sessionId);
      if (ok) {
        setLogMessages(prev => [...prev, `[CMD] Forcibly terminated support room ${sessionId} client pipes successfully.`].slice(-6));
        await fetchMetricsAndSessions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActioningSessionId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 text-zinc-100">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 text-zinc-100 p-5 rounded shadow-xl">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            <span>Admin Operations & Telecom Dashboard</span>
          </h2>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase tracking-wider">
            Gateway Cluster: cloud-run-vrtc-edge-01 • Region: asia-east1
          </p>
        </div>

        <button
          onClick={fetchAll}
          disabled={loading}
          className="bg-zinc-850 hover:bg-zinc-800 text-[10px] font-mono font-bold uppercase tracking-wider px-3.5 py-1.5 rounded border border-zinc-700 flex items-center gap-2 cursor-pointer text-zinc-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-500' : ''}`} />
          <span>Synchronize Node Metrics</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Metric Card 1 */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded shadow-sm space-y-1.5 min-h-[100px] flex flex-col justify-between">
          <div>
            <p className="text-[9px] text-zinc-500 font-black font-mono tracking-widest uppercase">ACTIVE CORNER CALLS</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-zinc-100">{metrics?.activeSessions ?? 0}</span>
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse shrink-0 shadow-[0_0_8px_#f97316]" />
            </div>
          </div>
          <div className="h-1 w-full bg-zinc-950 rounded overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (metrics?.activeSessions ?? 0) * 10)}%` }} />
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded shadow-sm space-y-1.5 min-h-[100px] flex flex-col justify-between">
          <div>
            <p className="text-[9px] text-zinc-500 font-black font-mono tracking-widest uppercase">SERVER SOCKETS</p>
            <span className="text-2xl font-bold font-mono text-zinc-100 mt-1 block">{metrics?.connectedParticipants ?? 0}</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Active connections</span>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded shadow-sm space-y-1.5 min-h-[100px] flex flex-col justify-between">
          <div>
            <p className="text-[9px] text-zinc-500 font-black font-mono tracking-widest uppercase">TOTAL SESSIONS</p>
            <span className="text-2xl font-bold font-mono text-zinc-100 mt-1 block">{metrics?.totalCallsCreated ?? 0}</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Historical slots</span>
        </div>

        {/* Metric Card 4 */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded shadow-sm space-y-1.5 min-h-[100px] flex flex-col justify-between">
          <div>
            <p className="text-[9px] text-zinc-500 font-black font-mono tracking-widest uppercase">AVG CALL DURATION</p>
            <span className="text-2xl font-bold font-mono text-zinc-100 mt-1 block">
              {metrics ? `${Math.floor(metrics.avgDurationSec / 60)}m ${metrics.avgDurationSec % 60}s` : '0s'}
            </span>
          </div>
          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Session durations</span>
        </div>

        {/* Metric Card 5 */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded shadow-sm space-y-1.5 col-span-2 md:col-span-1 min-h-[100px] flex flex-col justify-between">
          <div>
            <p className="text-[9px] text-zinc-500 font-black font-mono tracking-widest uppercase">PACKET FAULT RATE</p>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-2xl font-bold font-mono ${metrics && metrics.errorRate > 15 ? 'text-red-500' : 'text-zinc-100'}`}>
                {metrics?.errorRate ?? 0}%
              </span>
              <AlertTriangle className={`w-4 h-4 ${metrics && metrics.errorRate > 15 ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`} />
            </div>
          </div>
          <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Nominal limits</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Active Session Management list */}
        <div className="md:col-span-7 bg-zinc-900 border border-zinc-800 p-6 rounded shadow-xl flex flex-col h-[400px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3 flex items-center justify-between border-b border-zinc-800 pb-2.5 font-mono">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-orange-500" />
              Active Telecommunications Channels
            </span>
            <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 font-mono font-black">
              {activeSessions.length} TRACKED
            </span>
          </h3>

          <div className="overflow-y-auto flex-1 pr-1 space-y-2">
            {activeSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-10 font-mono">
                <CheckCircle2 className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-[11px] font-bold uppercase text-zinc-400">No active support channels found</p>
                <p className="text-[9.5px] text-center max-w-xs px-2 mt-1.5 leading-relaxed">
                  Channels populate dynamically when clients perform handshakes with support links.
                </p>
              </div>
            ) : (
              activeSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="p-3 bg-zinc-950/60 border border-zinc-800 rounded flex justify-between items-center hover:bg-zinc-950 transition-all font-mono text-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200 truncate block text-xs">{session.title}</span>
                      <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded shrink-0">{session.sessionId}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${session.agentConnected ? 'bg-orange-500 shadow-[0_0_4px_#f97316]' : 'bg-red-500'}`} />
                        <span className="truncate">AGNT: <strong className="text-zinc-200">{session.agentName || 'Offline'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${session.customerConnected ? 'bg-orange-500 shadow-[0_0_4px_#f97316]' : 'bg-red-500'}`} />
                        <span className="truncate">CLNT: <strong className="text-zinc-200">{session.customerName || 'Offline'}</strong></span>
                      </div>
                    </div>

                    <div className="text-[9px] text-zinc-500">
                      MESSAGES: {session.messages.length} | METADATA LOGS: {session.recording ? 'RECORDING' : 'IDLE'}
                    </div>
                  </div>

                  <button
                    id={`force-terminate-${session.sessionId}`}
                    onClick={() => handleForceEnd(session.sessionId)}
                    disabled={actioningSessionId === session.sessionId}
                    className="bg-red-950/40 text-red-400 hover:bg-red-600 hover:text-white border border-red-900/60 hover:border-transparent px-2.5 py-1.5 rounded transition-all shrink-0 cursor-pointer font-bold text-[10px] uppercase tracking-wider"
                    title="Force Terminate"
                  >
                    {actioningSessionId === session.sessionId ? (
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 border-t-transparent" />
                    ) : (
                      "TERM"
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Realtime Terminal Stream */}
        <div className="md:col-span-5 bg-zinc-950 text-zinc-300 p-5 rounded shadow-xl flex flex-col h-[400px] border border-zinc-800 font-mono text-[11px]">
          <h3 className="font-bold text-zinc-200 mb-2 pb-1.5 border-b border-zinc-805 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <Terminal className="w-4 h-4 text-orange-500" />
            VRT-Signaling Packet Trace
          </h3>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-text scrollbar-thin text-zinc-400">
            {logMessages.map((log, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-zinc-600 select-none">[{index + 1}]</span>
                <span className="text-orange-500/90 font-bold">&gt;</span>
                <span className="break-all whitespace-pre-wrap">{log}</span>
              </div>
            ))}
            <div className="text-zinc-600 animate-pulse select-none">&gt; Trace listening socket streams...</div>
          </div>

          <div className="border-t border-zinc-850 pt-2 text-[10px] text-zinc-500 flex items-center justify-between mt-3 select-none">
            <span>ICE TRANS: nominal</span>
            <span>PORT RELAY INPUT: node-3000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
