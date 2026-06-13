import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, 
  Send, Paperclip, Download, Circle, Radio, Monitor,
  Sparkles, ShieldCheck, User, Users, Clock, AlertCircle, Play, Laptop
} from 'lucide-react';
import { SessionInfo, ChatMessage, FileAttachment, UserRole } from '../types';

interface CallRoomProps {
  socket: any;
  sessionState: SessionInfo;
  userRole: UserRole;
  userName: string;
  socketId: string;
  onLeaveCall: () => void;
  onEndCall: () => void;
}

export default function CallRoom({
  socket,
  sessionState,
  userRole,
  userName,
  socketId,
  onLeaveCall,
  onEndCall
}: CallRoomProps) {
  // UI Panels
  const [showChat, setShowChat] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(sessionState.messages || []);
  const [inputText, setInputText] = useState('');
  const [fileToShare, setFileToShare] = useState<FileAttachment | null>(null);

  // Connection Stream Mode: Relay vs Direct WebRTC
  const [streamMode, setStreamMode] = useState<'relay' | 'mesh'>('relay');

  // Device Mutes
  const [audioActive, setAudioActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [peerAudioActive, setPeerAudioActive] = useState(true);
  const [peerVideoActive, setPeerVideoActive] = useState(true);

  // Screen Sharing
  const [screenShareActive, setScreenShareActive] = useState(false);

  // Recording (Agent only)
  const [recording, setRecording] = useState(sessionState.recording);

  // Reconnection overlay
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null);
  const [peerDisconnected, setPeerDisconnected] = useState(false);
  const [connectedPeerName, setConnectedPeerName] = useState<string>('');

  // DOM elements
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Media streams refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Relay Mode Stream States
  const [localRelayFrame, setLocalRelayFrame] = useState<string | null>(null);
  const [remoteRelayFrame, setRemoteRelayFrame] = useState<string | null>(null);

  // Timing logs
  const [sessionDurationStr, setSessionDurationStr] = useState('00:00');

  // Trigger test-pattern simulation if hardware lacks permissions
  const [isSimulatedVideo, setIsSimulatedVideo] = useState(false);

  // 1. Core Session Durations update
  useEffect(() => {
    const started = new Date(sessionState.startedAt || sessionState.createdAt).getTime();
    const updateTime = () => {
      const now = Date.now();
      const diffSecs = Math.floor((now - started) / 1000);
      const mins = Math.floor(diffSecs / 60).toString().padStart(2, '0');
      const secs = (diffSecs % 60).toString().padStart(2, '0');
      setSessionDurationStr(`${mins}:${secs}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [sessionState]);

  // 2. Capture Local Camera & Set WebRTC / Relay Loop
  useEffect(() => {
    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, frameRate: 15 },
          audio: true
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsSimulatedVideo(false);
        logMsg("Audio & video hardware activated successfully.");
      } catch (err) {
        console.warn("webcam/mic hardware access declined or missing, fall back to simulated test pattern:", err);
        setIsSimulatedVideo(true);
        // Start simulated canvas drawer loop for evaluation
        startVideoSimulation();
      }
    }

    startMedia();

    return () => {
      stopLocalStreams();
    };
  }, []);

  // Simulating video when webcam is missing or declined in sandboxed iframes
  const startVideoSimulation = () => {
    let offset = 0;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const simInterval = setInterval(() => {
      if (!ctx || !videoActive) {
        if (canvasRef.current) {
          const cCtx = canvasRef.current.getContext('2d');
          if (cCtx) {
            cCtx.fillStyle = '#0f172a';
            cCtx.fillRect(0, 0, 320, 240);
            cCtx.fillStyle = '#ffffff';
            cCtx.font = '10px monospace';
            cCtx.fillText("CAMERA CLOSED", 115, 120);
          }
        }
        return;
      }

      // Draw custom beautiful animated support pattern screen
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 320, 240);

      // grid line
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let x = 0; x < 320; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 240);
        ctx.stroke();
      }
      for (let y = 0; y < 240; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(320, y);
        ctx.stroke();
      }

      // Moving graphic circle
      ctx.fillStyle = userRole === 'agent' ? '#3b82f6' : '#d97706';
      ctx.beginPath();
      const circleX = 160 + Math.sin(offset) * 85;
      const circleY = 120 + Math.cos(offset * 1.5) * 55;
      ctx.arc(circleX, circleY, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`SIMULATED FEED (${userRole.toUpperCase()})`, 50, 45);
      ctx.fillText(`SYSTEM OK (UTC ${new Date().toISOString().slice(11,19)})`, 50, 205);
      offset += 0.08;

      const frameData = canvas.toDataURL('image/jpeg', 0.4);
      setLocalRelayFrame(frameData);

      // Render to hidden canvas
      if (canvasRef.current) {
        const cCtx = canvasRef.current.getContext('2d');
        if (cCtx) {
          cCtx.drawImage(canvas, 0, 0);
        }
      }

      // If streamMode is relay, transmit frame to other peer
      if (streamMode === 'relay') {
        socket.emit('media-relay', { frame: frameData });
      }
    }, 200);

    return () => clearInterval(simInterval);
  };

  const stopLocalStreams = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const logMsg = (text: string) => {
    const sysMsg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random()}`,
      sender: 'system',
      senderName: 'System',
      text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, sysMsg]);
  };

  // 3. WebRTC Setup for Mesh Mode
  const initWebRTCPeerConnection = () => {
    try {
      logMsg("Initializing Direct Mesh WebRTC Handshake...");
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote tracks back
      pc.ontrack = (event) => {
        logMsg("Remote WebRTC media track received successfully!");
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Exchanging ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            candidate: event.candidate,
            sessionId: sessionState.sessionId
          });
        }
      };

      peerConnectionRef.current = pc;
    } catch (e: any) {
      console.error("WebRTC initialize faulty:", e);
      logMsg("WebRTC initialization failed. Falling back to WebSocket Relay mode.");
      setStreamMode('relay');
    }
  };

  // 4. WebSocket Signalling Core Loops
  useEffect(() => {
    if (!socket) return;

    // Sockets listeners
    socket.on('new-message', (msg: ChatMessage) => {
      setMessages(prev => {
        // Prevent duplicate append
        if (prev.some(p => p.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('peer-joined', (data: { role: string; name: string; systemMessage: ChatMessage }) => {
      setConnectedPeerName(data.name);
      setPeerDisconnected(false);
      setGraceCountdown(null);
      setMessages(prev => [...prev, data.systemMessage]);

      // If we are currently "agent" and in "mesh" mode, let's create the offer to trigger WebRTC setup!
      if (userRole === 'agent' && streamMode === 'mesh') {
        startWebRTCCall();
      }
    });

    socket.on('peer-reconnected', (data: { role: string; name: string; systemMessage: ChatMessage }) => {
      setPeerDisconnected(false);
      setGraceCountdown(null);
      setMessages(prev => [...prev, data.systemMessage]);
      logMsg(`Seamless restoration complete for ${data.name}.`);
    });

    socket.on('peer-disconnected-grace', (data: { role: string; name: string; systemMessage: ChatMessage; graceSecRemaining: number }) => {
      setPeerDisconnected(true);
      setGraceCountdown(15);
      setMessages(prev => [...prev, data.systemMessage]);
    });

    socket.on('peer-disconnected-permanent', (data: { role: string; name: string; systemMessage: ChatMessage }) => {
      setPeerDisconnected(true);
      setGraceCountdown(null);
      setMessages(prev => [...prev, data.systemMessage]);
    });

    // WebRTC signaling listeners
    socket.on('webrtc-offer', async (data: { sdp: any; senderId: string }) => {
      if (streamMode !== 'mesh') return;
      
      if (!peerConnectionRef.current) {
        initWebRTCPeerConnection();
      }

      try {
        await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await peerConnectionRef.current!.createAnswer();
        await peerConnectionRef.current!.setLocalDescription(answer);

        socket.emit('webrtc-answer', {
          sdp: answer,
          sessionId: sessionState.sessionId
        });
      } catch (err) {
        console.error("Set WebRTC offer error:", err);
      }
    });

    socket.on('webrtc-answer', async (data: { sdp: any; senderId: string }) => {
      if (streamMode !== 'mesh') return;
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
      } catch (err) {
        console.error("Set WebRTC answer error:", err);
      }
    });

    socket.on('webrtc-ice-candidate', async (data: { candidate: any; senderId: string }) => {
      if (streamMode !== 'mesh') return;
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error("Add ICE candidate error:", err);
      }
    });

    // Mutes listener
    socket.on('peer-stream-control', (data: { role: string; audioActive: boolean; videoActive: boolean }) => {
      if (data.role !== userRole) {
        setPeerAudioActive(data.audioActive);
        setPeerVideoActive(data.videoActive);
      }
    });

    // WebSocket-based Frame Relay listener (for the bulletproof backup)
    socket.on('peer-media-relay', (data: { frame?: string }) => {
      if (streamMode === 'relay' && data.frame) {
        setRemoteRelayFrame(data.frame);
      }
    });

    // Recording updates listeners (agent/sys broadcast)
    socket.on('recording-status-changed', (data: { recording: any; systemMessage: ChatMessage }) => {
      setRecording(data.recording);
      setMessages(prev => [...prev, data.systemMessage]);
    });

    // Session ending notifications
    socket.on('session-ended', (data: { historyItem: any }) => {
      alert("🏁 Support Session Cleared: This real-time session has been closed cleanly by a participant. Transitioning to history logs.");
      onLeaveCall();
    });

    socket.on('session-force-ended', (data: { sessionId: string; reason: string }) => {
      alert(`⚠️ Admin Action Override: This session was forcibly terminated from the Control Dashboard.`);
      onLeaveCall();
    });

    return () => {
      socket.off('new-message');
      socket.off('peer-joined');
      socket.off('peer-reconnected');
      socket.off('peer-disconnected-grace');
      socket.off('peer-disconnected-permanent');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('peer-stream-control');
      socket.off('peer-media-relay');
      socket.off('recording-status-changed');
      socket.off('session-ended');
      socket.off('session-force-ended');
    };
  }, [socket, streamMode, userRole, sessionState]);

  // 5. Handles local frame snapshot loop for Relay mode (if hardware camera is actually working)
  useEffect(() => {
    if (streamMode !== 'relay' || isSimulatedVideo) return;

    const interval = setInterval(() => {
      if (localVideoRef.current && videoActive) {
        const video = localVideoRef.current;
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, 320, 240);
            const frameStr = canvas.toDataURL('image/jpeg', 0.45);
            setLocalRelayFrame(frameStr);
            socket.emit('media-relay', { frame: frameStr });
          } catch (e) {
            // silent catch cross-origin canvas errors if any
          }
        }
      }
    }, 250); // Send ~4 frames per second

    return () => clearInterval(interval);
  }, [streamMode, videoActive, isSimulatedVideo]);

  // 6. Grace Period Disconnect decrementor
  useEffect(() => {
    if (!peerDisconnected || graceCountdown === null) return;
    if (graceCountdown <= 0) {
      setGraceCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setGraceCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [peerDisconnected, graceCountdown]);

  // Starts the WebRTC call
  const startWebRTCCall = async () => {
    initWebRTCPeerConnection();
    try {
      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current!.setLocalDescription(offer);

      socket.emit('webrtc-offer', {
        sdp: offer,
        sessionId: sessionState.sessionId
      });
    } catch (e) {
      console.error("WebRTC offer compilation failed:", e);
    }
  };

  // 7. Handles Switching Modes (Direct Mesh WebRTC vs Server Relay WebSocket)
  const handleToggleStreamMode = (newMode: 'relay' | 'mesh') => {
    setStreamMode(newMode);
    if (newMode === 'mesh') {
      initWebRTCPeerConnection();
      if (userRole === 'agent' && (sessionState.customerConnected || connectedPeerName)) {
        startWebRTCCall();
      }
    } else {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      setRemoteRelayFrame(null);
    }
  };

  // Audio/Video hardware toggles
  const handleToggleAudio = () => {
    const nextValue = !audioActive;
    setAudioActive(nextValue);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = nextValue);
    }
    socket.emit('stream-control', { audioActive: nextValue, videoActive });
  };

  const handleToggleVideo = () => {
    const nextValue = !videoActive;
    setVideoActive(nextValue);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = nextValue);
    }
    socket.emit('stream-control', { audioActive, videoActive: nextValue });
  };

  // Screen Sharing Bonus
  const handleToggleScreenShare = async () => {
    if (screenShareActive) {
      // Stop screen share
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setScreenShareActive(false);
      logMsg("Screen sharing stopped. Reverted to camera track.");
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // If in WebRTC mode, swap tracks
        if (peerConnectionRef.current) {
          const videoSender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(stream.getVideoTracks()[0]);
          }
        }

        // Auto revert on track ended
        stream.getVideoTracks()[0].onended = () => {
          handleToggleScreenShare();
        };

        setScreenShareActive(true);
        logMsg("Screen sharing activated. Sharing desktop overlay...");
      } catch (err) {
        console.warn("Screen share declined:", err);
      }
    }
  };

  // Message scroll alignment
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showChat]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !fileToShare) return;

    socket.emit('send-message', {
      text: inputText,
      file: fileToShare || undefined
    });

    setInputText('');
    setFileToShare(null);
  };

  // Drag-and-drop & Manual base64 file attachment parsing (Bonus Feature 3.2!)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert("⚠️ Large file detected. Maximum attachment size is 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileToShare({
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleToggleRecording = () => {
    if (userRole !== 'agent') return;
    const action = (recording?.status === 'in-progress') ? 'stop' : 'start';
    socket.emit('toggle-recording', { action });
  };

  const handleEndCall = () => {
    if (userRole === 'agent') {
      if (window.confirm("🏁 Complete Call Session? This permanently closes connections, archives message transcripts, and compiles recordings.")) {
        socket.emit('end-session');
        onEndCall();
      }
    } else {
      if (window.confirm("Leave support session? The specialist remains online and your slot stays open for reconnection.")) {
        socket.emit('disconnect'); // trigger standard disconnect with grace window
        onLeaveCall();
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 p-6 h-[calc(100vh-100px)] text-zinc-100 font-mono">
      
      {/* Hidden processing canvas for stream serialization */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Stream Area - spans 8 columns */}
      <div className="md:col-span-8 flex flex-col h-full space-y-4">
        {/* Call Info Header bar */}
        <div className="bg-zinc-900 border border-zinc-805 px-4 py-3 rounded flex items-center justify-between shadow-xl">
          <div className="min-w-0 pr-3">
            <h2 className="font-extrabold text-[13px] text-zinc-200 uppercase tracking-wider truncate">{sessionState.title}</h2>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                {sessionDurationStr}
              </span>
              <span className="text-zinc-700">•</span>
              <span className="font-bold bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-[9px] uppercase">
                {userRole === 'agent' ? 'AGENT TERMINAL' : 'CUSTOMER CONSOLE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mode selection badges */}
            <div className="bg-zinc-950 p-1 rounded border border-zinc-805 flex items-center shrink-0 font-mono">
              <button
                onClick={() => handleToggleStreamMode('relay')}
                className={`text-[9px] uppercase font-black px-2.5 py-1 rounded transition-all cursor-pointer ${
                  streamMode === 'relay' 
                    ? 'bg-orange-600 text-white shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Bypasses strict NATs by routing pixels via node server WebSockets"
              >
                Relay Mode
              </button>
              <button
                onClick={() => handleToggleStreamMode('mesh')}
                className={`text-[9px] uppercase font-black px-2.5 py-1 rounded transition-all cursor-pointer ${
                  streamMode === 'mesh' 
                    ? 'bg-orange-600 text-white shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Local true WebRTC direct audio & video stream"
              >
                Mesh (rtc)
              </button>
            </div>
            
            {/* blinks if recording in-progress */}
            {recording?.status === 'in-progress' && (
              <span className="flex items-center gap-1.5 text-[9px] bg-red-950/40 text-red-400 px-2.5 py-1 rounded border border-red-900/60 font-black animate-pulse font-mono uppercase tracking-wider">
                <Circle className="w-2 h-2 fill-red-500 text-red-500 shrink-0" />
                REC_STREAM: ACTIVE
              </span>
            )}
            {recording?.status === 'processing' && (
              <span className="flex items-center gap-1.5 text-[9px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded border border-amber-500/20 font-black font-mono uppercase tracking-wider">
                Processing Rec...
              </span>
            )}
          </div>
        </div>

        {/* Reconnect overlay alerts */}
        {peerDisconnected && (
          <div className="bg-red-950/40 border border-red-900/60 text-red-200 p-4 rounded flex items-start gap-3 shadow-xl animate-in fade-in duration-200 font-mono">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 text-[11px]">
              <p className="font-extrabold text-red-400 uppercase tracking-wider">⚠️ SIGNAL DISRUPTION DETECTED</p>
              <p className="text-zinc-300 mt-1 leading-relaxed">
                The connection dropped unexpectedly. System holding active handshake slot...
              </p>
              {graceCountdown !== null && (
                <div className="mt-2.5 text-[10px] font-bold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <span>Connection holding state grace:</span>
                  <span className="bg-red-900/50 text-red-200 border border-red-750 font-mono px-2 py-0.5 rounded text-xs font-black">
                    {graceCountdown}s LIMIT
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Video Canvas Panels - Side by side layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-[250px]">
          
          {/* Local Participant Frame */}
          <div className="bg-zinc-950 border border-zinc-850 rounded relative overflow-hidden group shadow flex flex-col items-center justify-center">
            
            {/* Real Hardware camera display */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover rounded ${
                (streamMode === 'mesh' || !isSimulatedVideo) && videoActive ? 'block' : 'hidden'
              }`}
            />

            {/* Socket Relay loop frame display (Backup) */}
            {streamMode === 'relay' && isSimulatedVideo && videoActive && localRelayFrame && (
              <img
                src={localRelayFrame}
                alt="Local Stream Relayed Frame"
                className="w-full h-full object-contain rounded"
                referrerPolicy="no-referrer"
              />
            )}

            {/* Offline or blank screen block if video is closed */}
            {(!videoActive) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-650 select-none">
                <VideoOff className="w-10 h-10 text-zinc-700 mb-2" />
                <p className="text-xs font-bold tracking-wider uppercase text-zinc-400">CAMERA OFFLINE</p>
                <p className="text-[10px] text-zinc-550 mt-0.5 uppercase">Audio transmitting normally</p>
              </div>
            )}

            {/* Micro Indicator Label */}
            <div className="absolute bottom-3 left-3 bg-zinc-900/90 text-zinc-200 px-3 py-1.5 rounded border border-zinc-800 text-[10px] font-bold flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
              </span>
              <span>{userName} (SELF)</span>
              {!audioActive && <MicOff className="w-3.5 h-3.5 text-red-500 shrink-0 ml-1.5" />}
            </div>
          </div>

          {/* Remote Participant Frame */}
          <div className="bg-zinc-950 border border-zinc-850 rounded relative overflow-hidden shadow flex flex-col items-center justify-center">
            
            {/* Local mesh WebRTC real video track */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover rounded ${
                streamMode === 'mesh' && peerVideoActive ? 'block' : 'hidden'
              }`}
            />

            {/* Loop server relayed images backup display */}
            {streamMode === 'relay' && peerVideoActive && remoteRelayFrame ? (
              <img
                src={remoteRelayFrame}
                alt="Remote Stream Relayed Frame"
                className="w-full h-full object-contain rounded"
                referrerPolicy="no-referrer"
              />
            ) : null}

            {/* Remote offline or waiting placeholder */}
            {(!peerVideoActive || (streamMode === 'relay' && !remoteRelayFrame && !peerDisconnected)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-650 select-none">
                <VideoOff className="w-10 h-10 text-zinc-700 mb-2" />
                <p className="text-xs font-bold tracking-wider uppercase text-zinc-400">REMOTE_TRANS OPEN</p>
                <p className="text-[10px] text-zinc-550 mt-0.5 uppercase text-center max-w-xs px-4">Waiting for remote stream packet trace...</p>
              </div>
            )}

            {/* If no peer is active in the session slot */}
            {!sessionState.customerConnected && !sessionState.agentConnected && !connectedPeerName && (
              <div className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center text-center px-4 select-none font-mono">
                <Radio className="w-8 h-8 text-orange-500 animate-pulse mb-3" />
                <p className="text-[11px] font-black tracking-widest text-zinc-300 uppercase">WAITING FOR HANDSHAKE TRANS_REQ</p>
                <p className="text-[9.5px] text-zinc-550 max-w-xs mt-2 leading-relaxed">
                  Provide secure credentials or links to client. System gateway listening on port 3000...
                </p>
              </div>
            )}

            {/* Micro Indicator Peer Label */}
            {(sessionState.customerConnected || sessionState.agentConnected || connectedPeerName) && (
              <div className="absolute bottom-3 left-3 bg-zinc-900/90 text-zinc-200 px-3 py-1.5 rounded border border-zinc-800 text-[10px] font-bold flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="truncate">{userRole === 'agent' ? (sessionState.customerName || 'Customer') : (sessionState.agentName || 'Specialist')}</span>
                {!peerAudioActive && <MicOff className="w-3.5 h-3.5 text-red-500 shrink-0 ml-1.5" />}
              </div>
            )}
          </div>
        </div>

        {/* Call Panel Control Buttons Bar */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded flex flex-wrap items-center justify-between gap-3 shadow-xl">
          {/* Mute commands */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAudio}
              className={`p-3 rounded transition-all cursor-pointer border ${
                audioActive 
                  ? 'bg-zinc-850 hover:bg-zinc-800 border-zinc-700 text-zinc-150' 
                  : 'bg-red-950 hover:bg-red-900 border-red-900/60 text-red-400 animate-pulse animate-duration-1000'
              }`}
              title={audioActive ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {audioActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button
              onClick={handleToggleVideo}
              className={`p-3 rounded transition-all cursor-pointer border ${
                videoActive 
                  ? 'bg-zinc-850 hover:bg-zinc-800 border-zinc-700 text-zinc-150' 
                  : 'bg-red-950 hover:bg-red-900 border-red-900/60 text-red-400 animate-pulse animate-duration-1000'
              }`}
              title={videoActive ? 'Turn Video Off' : 'Turn Video On'}
            >
              {videoActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            <button
              onClick={handleToggleScreenShare}
              className={`p-3 rounded transition-all cursor-pointer border ${
                screenShareActive 
                  ? 'bg-orange-950/60 border-orange-600/80 text-orange-400 animate-pulse' 
                  : 'bg-zinc-850 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
              }`}
              title={screenShareActive ? 'Stop Desk Share' : 'Share Screen'}
            >
              <Laptop className="w-4 h-4" />
            </button>
          </div>

          {/* Recording & Admin-Only Trigger Actions */}
          <div className="flex items-center gap-2">
            {userRole === 'agent' && (
              <button
                id="toggle-recording-button"
                onClick={handleToggleRecording}
                disabled={recording?.status === 'processing'}
                className={`text-[10px] font-mono tracking-wider font-extrabold uppercase px-3.5 py-2.5 rounded flex items-center gap-1.5 transition-all cursor-pointer border ${
                  recording?.status === 'in-progress'
                    ? 'bg-red-950 text-red-400 border-red-800 animate-pulse animate-duration-1000'
                    : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-650'
                }`}
                title="Only Support Agents have access rights to trigger/process recordings"
              >
                <Circle className={`w-2.5 h-2.5 ${recording?.status === 'in-progress' ? 'fill-red-500 text-red-500' : 'fill-zinc-500 text-zinc-500'}`} />
                <span>
                  {recording?.status === 'in-progress' ? 'STOP_REC' : 'RECORD_CALL'}
                </span>
              </button>
            )}

            <button
              id="end-call-button"
              onClick={handleEndCall}
              className="bg-red-950/40 text-red-400 hover:bg-red-600 hover:text-white border border-red-900/60 hover:border-transparent px-4 py-2.5 rounded text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>{userRole === 'agent' ? 'TERM_CONN' : 'LEAVE_ROOM'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Chat & Shared Assets Sidebar — spans 4 columns */}
      <div className="md:col-span-4 flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded overflow-hidden shadow-xl">
        <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-850 flex items-center justify-between text-zinc-200 font-bold text-xs font-mono uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-orange-500" />
            SECURE DATALINK TRANSCRIPT
          </span>
          <span className="bg-orange-500/10 text-orange-400 px-2.5 py-0.5 rounded border border-orange-500/20 font-black text-[9px]">
            {messages.filter(m => m.sender !== 'system').length} LOGS
          </span>
        </div>

        {/* Message scrolling panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all font-mono">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-center px-4 font-mono">
              <MessageSquare className="w-8 h-8 text-zinc-800 mb-2" />
              <p className="text-[11px] font-bold uppercase text-zinc-400">NO ENCRYPTED PACKETS</p>
              <p className="text-[9.5px] mt-1 text-zinc-550 leading-relaxed">Exchange diagnostic notes or drag files into the transmission field.</p>
            </div>
          ) : (
            messages.map((msg) => {
              // System notifications styling
              if (msg.sender === 'system') {
                return (
                  <div key={msg.id} className="text-[9px] text-zinc-400 bg-zinc-950 border border-zinc-850 p-2.5 rounded font-mono leading-relaxed text-center">
                    {msg.text}
                  </div>
                );
              }

              const isSelf = msg.sender === userRole;
              return (
                <div key={msg.id} className={`flex flex-col space-y-1 ${isSelf ? 'items-end' : 'items-start'}`}>
                  {/* Sender title label */}
                  <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase tracking-wider flex items-center gap-1">
                    {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>

                  {/* Message body chat bubble */}
                  <div className={`p-2.5 rounded-lg text-xs max-w-[85%] leading-relaxed ${
                    isSelf 
                      ? 'bg-orange-600 text-white rounded-tr-none' 
                      : 'bg-zinc-950 border border-zinc-850 text-zinc-200 rounded-tl-none font-medium'
                  }`}>
                    {/* Render Text */}
                    {msg.text && <p className="break-words whitespace-pre-wrap">{msg.text}</p>}

                    {/* Shared File attachments integration */}
                    {msg.file && (
                      <div className={`mt-2 p-2 rounded text-[10px] flex items-center gap-2 border ${
                        isSelf ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900 border-zinc-805'
                      }`}>
                        <div className="bg-orange-500/10 p-2 rounded shrink-0">
                          <Paperclip className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0 font-sans">
                          <p className="font-bold truncate text-[10px] text-orange-400">{msg.file.name}</p>
                          <p className="text-[9px] text-zinc-500">{(msg.file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <a
                           href={msg.file.data}
                           download={msg.file.name}
                           className="p-1 text-zinc-400 hover:text-orange-500 shrink-0 transition-colors"
                           title="Download shared attachment"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input attachment preview block if file is currently staged */}
        {fileToShare && (
          <div className="p-2 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-[10px] font-mono">
            <span className="text-orange-400 truncate flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <Paperclip className="w-3.5 h-3.5" />
              STAGED: {fileToShare.name}
            </span>
            <button
              onClick={() => setFileToShare(null)}
              className="text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Message Input form */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-850 bg-zinc-950 flex gap-1.5 items-center">
          {/* File select hooks */}
          <div className="relative">
            <input
              id="file-upload-input"
              type="file"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 w-8 h-8 cursor-pointer"
              title="Upload file / document"
            />
            <button
              type="button"
              className="p-2.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-sm"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>

          <input
            id="chat-message-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type transmission packet..."
            className="w-full text-xs font-mono border border-zinc-800 rounded px-3 py-2.5 text-zinc-100 bg-zinc-900 focus:outline-none focus:border-orange-500 hover:bg-zinc-900"
          />

          <button
            id="chat-send-button"
            type="submit"
            className="p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors cursor-pointer shrink-0 flex items-center justify-center shadow-md shadow-orange-600/10"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
