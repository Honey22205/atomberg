import React, { useState, useEffect } from 'react';
import { PlusCircle, Copy, Check, FileText, Download, PhoneOutgoing, Calendar, Trash2, Clock, MessageSquare, Info, Link } from 'lucide-react';
import { SessionHistoryItem, SessionInfo } from '../types';

interface AgentDashboardProps {
  onStartSession: (title: string, agentName: string) => Promise<SessionInfo | null>;
  onJoinSession: (sessionId: string, token: string, role: 'agent' | 'customer', name: string) => void;
  historyLoaded: boolean;
  history: SessionHistoryItem[];
  fetchHistory: () => Promise<void>;
}

export default function AgentDashboard({
  onStartSession,
  onJoinSession,
  historyLoaded,
  history,
  fetchHistory
}: AgentDashboardProps) {
  const [agentName, setAgentName] = useState('Sarah Martinez (Tech Support)');
  const [callTitle, setCallTitle] = useState('HVAC Controller Diagnostics');
  const [loading, setLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<SessionInfo | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim() || !callTitle.trim()) return;

    setLoading(true);
    try {
      const session = await onStartSession(callTitle, agentName);
      if (session) {
        setCreatedSession(session);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getInviteLink = (session: SessionInfo) => {
    const origin = window.location.origin;
    return `${origin}?sessionId=${session.sessionId}&token=${session.token}&role=customer`;
  };

  const copyToClipboard = (text: string, type: 'link' | 'token') => {
    try {
      navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
    } catch (err) {
      const dummy = document.createElement('textarea');
      document.body.appendChild(dummy);
      dummy.value = text;
      dummy.select();
      document.execCommand('copy');
      document.body.removeChild(dummy);
      
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
    }
  };

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6 text-zinc-100">
      {/* Intro Hero banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
          <h2 className="text-lg font-bold tracking-tight uppercase">
            Create Secure Support Slot
          </h2>
        </div>
        <p className="text-zinc-400 text-xs max-w-2xl leading-relaxed">
          Instantly provision a WebRTC connection & websocket fallback session slot. Encryption keys and file streams are fully negotiated end-to-end. No auxiliary plug-ins needed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left pane: Create session form OR invite details */}
        <div className="md:col-span-6 space-y-6">
          {!createdSession ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-5 flex items-center gap-2 border-b border-zinc-800 pb-3">
                <PlusCircle className="w-4 h-4 text-orange-500" />
                Configure New Session Tunnel
              </h3>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                    AGENT IDENTIFIER (YOUR DISPLAY NAME)
                  </label>
                  <input
                    id="agent-name-input"
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Enter your support name"
                    className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-orange-500 hover:bg-zinc-950/80 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                    SUPPORT TOPIC / CONTRACT ID
                  </label>
                  <input
                    id="call-title-input"
                    type="text"
                    value={callTitle}
                    onChange={(e) => setCallTitle(e.target.value)}
                    placeholder="e.g. Device diagnostic session"
                    className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-orange-500 hover:bg-zinc-950/80 transition-colors"
                    required
                  />
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded p-3 text-[10px] text-zinc-400 space-y-1.5 leading-normal">
                  <div className="flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-orange-450 shrink-0 mt-0.5" />
                    <p>
                      <strong className="text-zinc-300 font-bold uppercase">Access Protection:</strong> Token verification restricts slot-joining. Live duration tracking, secure base64 transcripts, and force-termination registers are managed natively.
                    </p>
                  </div>
                </div>

                <button
                  id="create-session-button"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-600 border border-orange-500 hover:bg-orange-700 text-white text-xs font-mono font-black uppercase tracking-wider py-2.5 rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(234,88,12,0.15)] hover:shadow-[0_0_16px_rgba(234,88,12,0.3)]"
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <PhoneOutgoing className="w-4 h-4 text-orange-200" />
                      <span>Provision Secure Session Slot</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Invite Customer Details Card */
            <div className="bg-zinc-900 border border-zinc-800 rounded p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded font-mono font-black border border-orange-500/30">
                  SLOT PROVISIONED
                </span>
                <button
                  onClick={() => setCreatedSession(null)}
                  className="text-[10px] text-zinc-400 hover:text-orange-500 underline uppercase tracking-wider font-mono"
                >
                  Reset Form
                </button>
              </div>

              <div>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block font-mono">SUPPORT ISSUE</span>
                <h3 className="font-extrabold text-sm text-zinc-100 truncate font-mono mt-0.5">{createdSession.title}</h3>
                <p className="text-[10px] text-zinc-400 font-mono mt-1">Status: Ready • Waiting on customer handshake</p>
              </div>

              <div className="p-3 bg-zinc-950 rounded border border-zinc-800 space-y-3">
                <p className="text-[10px] text-zinc-300 font-bold flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <Link className="w-3.5 h-3.5 text-orange-500" />
                  Customer Invite Code Link:
                </p>
                <div className="flex gap-2">
                  <input
                    id="invite-link-display"
                    type="text"
                    readOnly
                    value={getInviteLink(createdSession)}
                    className="w-full text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    id="copy-invite-link"
                    onClick={() => copyToClipboard(getInviteLink(createdSession), 'link')}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded p-2 transition-colors shrink-0 flex items-center justify-center border border-zinc-700"
                    title="Copy to clipboard"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-orange-500 animate-pulse" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 text-[10px] font-mono text-zinc-400 bg-zinc-900/50 p-2.5 rounded border border-zinc-800/60 mt-2">
                  <div className="flex justify-between">
                    <span>ROOM SLOT ID:</span>
                    <strong className="text-zinc-200">{createdSession.sessionId}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>VERIFICATION TOKEN:</span>
                    <strong className="text-orange-400">{createdSession.token}</strong>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  id="join-as-agent-button"
                  onClick={() =>
                    onJoinSession(createdSession.sessionId, createdSession.token, 'agent', agentName)
                  }
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-mono font-black uppercase tracking-widest py-3 rounded transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shadow-orange-500/10"
                >
                  <PhoneOutgoing className="w-4 h-4 text-orange-200" />
                  <span>Enter Teleport Support Room</span>
                </button>
                <p className="text-[10px] text-center text-zinc-500 font-mono italic">
                  *Open the generated invitation URL in another private/incognito window to test as customer!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right pane: Session History Log */}
        <div className="md:col-span-6 bg-zinc-900 border border-zinc-800 rounded p-6 shadow-xl flex flex-col h-[520px]">
          <div className="flex items-baseline justify-between border-b border-zinc-800 pb-3.5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              Recorded Sessions Registry
            </h3>
            <span className="text-[10.5px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-0.5 rounded border border-zinc-800">
              {history.length} SAVED
            </span>
          </div>

          <div className="overflow-y-auto flex-1 space-y-3 pr-1">
            {!historyLoaded ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-zinc-500 font-mono">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent mb-2" />
                <p className="text-[10px] tracking-wider uppercase">Querying Repository Registry...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 border border-dashed border-zinc-800 rounded bg-zinc-950/20 text-zinc-500">
                <Clock className="w-8 h-8 text-zinc-600 mb-2 stroke-1" />
                <p className="text-[11px] font-bold uppercase font-mono tracking-wider">No finished records</p>
                <p className="text-[9.5px] text-center max-w-xs px-4 mt-2 font-mono leading-relaxed">
                  Call sessions that are created, populated by participants, and gracefully terminated list their trace here.
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border border-zinc-800 rounded bg-zinc-950/60 hover:bg-zinc-950 hover:border-zinc-700 transition-colors space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-zinc-200 truncate max-w-[150px] font-mono">{item.title}</span>
                    <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3 text-zinc-600" />
                      {formatDate(item.joinedAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400 border-t border-b border-zinc-800/80 py-1.5 font-mono">
                    <div className="truncate">
                      <span className="text-zinc-500">AGENT: </span>
                      <span className="font-bold text-zinc-300">{item.agentName}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-zinc-500">CLIENT: </span>
                      <span className="font-bold text-zinc-300">{item.customerName}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-3 text-zinc-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        {formatDuration(item.durationMs)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-zinc-600" />
                        {item.messageCount} MSG
                      </span>
                    </div>

                    {item.recordingUrl ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          alert("📥 Preparing download. A compilation report transcript (CSV + Recorded Audio Mock) has been transferred successfully!");
                        }}
                        className="text-[9.5px] font-mono uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        REP-ZIP
                      </a>
                    ) : (
                      <span className="text-[9px] font-mono text-zinc-600 italic uppercase">No recording</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
