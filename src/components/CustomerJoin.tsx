import React, { useState, useEffect } from 'react';
import { Sparkles, Video, Users, CheckCircle2, AlertTriangle, Play, HelpCircle, HardDrive } from 'lucide-react';

interface CustomerJoinProps {
  onJoinSession: (sessionId: string, token: string, role: 'agent' | 'customer', name: string) => void;
  urlSessionId: string | null;
  urlToken: string | null;
}

export default function CustomerJoin({ onJoinSession, urlSessionId, urlToken }: CustomerJoinProps) {
  const [customerName, setCustomerName] = useState('Customer #' + Math.floor(1000 + Math.random() * 9000));
  const [sessionId, setSessionId] = useState(urlSessionId || '');
  const [token, setToken] = useState(urlToken || '');
  const [verifying, setVerifying] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [verifiedInfo, setVerifiedInfo] = useState<{ title: string; agentConnected: boolean; customerConnected: boolean } | null>(null);

  // Auto-verify if prefilled URL variables exist
  useEffect(() => {
    if (urlSessionId && urlToken) {
      verifyAndVerify(urlSessionId, urlToken);
    }
  }, [urlSessionId, urlToken]);

  const verifyAndVerify = async (targetSessionId: string, targetToken: string) => {
    if (!targetSessionId.trim() || !targetToken.trim()) return;
    setVerifying(true);
    setSessionError(null);

    try {
      const res = await fetch(`/api/sessions/verify/${targetSessionId}?token=${targetToken}&role=customer`);
      const data = await res.json();

      if (res.ok && data.valid) {
        setVerifiedInfo({
          title: data.title,
          agentConnected: data.agentConnected,
          customerConnected: data.customerConnected
        });
      } else {
        setSessionError(data.reason || "Failed to verify invitation token. The session may have expired.");
        setVerifiedInfo(null);
      }
    } catch (err) {
      setSessionError("Network error checking server gateway validity.");
      setVerifiedInfo(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyClick = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAndVerify(sessionId, token);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId.trim() || !token.trim() || !customerName.trim()) return;
    onJoinSession(sessionId, token, 'customer', customerName);
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-zinc-100">
      {/* Intro visual banner */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-200 animate-pulse" />
          <span>Customer Portal Gateway</span>
        </h2>
        <p className="text-orange-100 text-[11px] mt-1.5 leading-relaxed font-mono">
          Handshake validation is required to enter the secure room. Audio/Video diagnostic signals are relayed through localized channels.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded p-6 shadow-xl">
        {/* Verification Form first, unless already verified info is shown */}
        {!verifiedInfo ? (
          <form onSubmit={handleVerifyClick} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2 border-b border-zinc-800 pb-3 mb-2 font-mono">
              <Users className="w-4 h-4 text-orange-500" />
              Verify Invitation Token
            </h3>

            {sessionError && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded text-red-400 text-[11px] font-mono flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <p className="font-medium">{sessionError}</p>
              </div>
            )}

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 font-mono">
                SUPPORT ROOM IDENTIFIER (SESSION ID)
              </label>
              <input
                id="session-id-input"
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="e.g. session-abc123xyz"
                className="w-full text-xs font-mono border border-zinc-800 rounded px-3 py-2 text-zinc-100 bg-zinc-950 focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 font-mono">
                SECURE CUSTOMER ENTRANCE TOKEN
              </label>
              <input
                id="token-id-input"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Secure access token"
                className="w-full text-xs font-mono border border-zinc-800 rounded px-3 py-2 text-zinc-100 bg-zinc-950 focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <button
              id="verify-token-button"
              type="submit"
              disabled={verifying}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-mono font-black uppercase tracking-wider py-2.5 rounded transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {verifying ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span>Validate Invitation Token</span>
              )}
            </button>
          </form>
        ) : (
          /* Active entrance form (Token verified successfully!) */
          <form onSubmit={handleJoin} className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-emerald-950/40 border border-emerald-900/60 rounded p-3 text-emerald-400 text-[11px] font-mono flex items-start gap-2.5 leading-relaxed">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-emerald-300 uppercase tracking-wider">Invitation verified!</p>
                <p className="text-zinc-300 mt-1">
                  Ready to join support room: <br />
                  <strong className="text-orange-400">{verifiedInfo.title}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">OPERATOR PRESENCE STATUS:</span>
              <div className="p-2 border border-zinc-805 rounded bg-zinc-950 flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400">Support Agent:</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                  verifiedInfo.agentConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                }`}>
                  {verifiedInfo.agentConnected ? 'CONNECTED' : 'WAITING FOR AGENT'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 font-mono">
                ENTER YOUR DISPLAY NAME
              </label>
              <input
                id="customer-name-input"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full text-xs font-mono border border-zinc-800 rounded px-3 py-2 text-zinc-100 bg-zinc-950 focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <div className="space-y-2 pt-1">
              <button
                id="join-support-room-button"
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-mono font-black uppercase tracking-wider py-3 rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Enter Call Session</span>
              </button>

              <button
                type="button"
                onClick={() => setVerifiedInfo(null)}
                className="w-full text-zinc-500 hover:text-zinc-300 text-[10px] font-mono uppercase tracking-wider text-center cursor-pointer mt-1"
              >
                Change Room ID / Token
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-805 rounded p-4 text-[10px] text-zinc-400 space-y-2 font-mono">
        <p className="font-bold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
          Gateway Requirements Spec:
        </p>
        <ul className="list-disc pl-3.5 space-y-1 list-inside text-zinc-400 leading-normal">
          <li>Browser supports standard WebRTC media handshakes</li>
          <li>Grants camera and microphone access requests</li>
          <li>Synthesized backup relay used, if real cameras are missing</li>
        </ul>
      </div>
    </div>
  );
}
