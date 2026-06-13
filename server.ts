import express from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createServer as createViteServer } from "vite";
import { SessionInfo, ChatMessage, SessionHistoryItem, SystemMetrics, UserRole, FileAttachment } from "./src/types";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // Increase buffer size to 10MB to support file attachments in chat
});

const PORT = 3000;

// In-Memory Database / Repositories
const sessions = new Map<string, SessionInfo>();
const sessionHistory: SessionHistoryItem[] = [];
let totalCallsCreated = 0;
let totalActions = 0;
let errorCount = 0;

// Track active timers for reconnection grace periods
// Key: "sessionId:role" -> Timeout object
const gracePeriodTimers = new Map<string, NodeJS.Timeout>();

// Logger helper
function logStatus(source: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${source}] ${msg}`);
}

app.use(express.json());

// Helper to track operations for monitoring error rates
function registerAction(success: boolean = true) {
  totalActions++;
  if (!success) {
    errorCount++;
  }
}

// REST API Endpoints
// Get active session metrics & history
app.get("/api/metrics", (req, res) => {
  registerAction(true);
  const activeParticipants = Array.from(sessions.values()).reduce((acc, s) => {
    return acc + (s.agentConnected ? 1 : 0) + (s.customerConnected ? 1 : 0);
  }, 0);

  const closedCalls = sessionHistory.length;
  const avgDurationSec = closedCalls > 0
    ? Math.round(sessionHistory.reduce((acc, current) => acc + current.durationMs, 0) / (closedCalls * 1000))
    : 0;

  const currentErrorRate = totalActions > 0 ? Math.round((errorCount / totalActions) * 100) : 0;

  const metrics: SystemMetrics = {
    activeSessions: sessions.size,
    connectedParticipants: activeParticipants,
    totalCallsCreated,
    errorRate: Math.max(0, Math.min(100, currentErrorRate)),
    avgDurationSec
  };

  res.json(metrics);
});

// Create a new support session (Agent only)
app.post("/api/sessions/create", (req, res) => {
  try {
    const { title = "Support Call", agentName = "Agent Support" } = req.body;
    const sessionId = `session-${Math.random().toString(36).substring(2, 11)}`;
    const token = Math.random().toString(36).substring(2, 15);

    const newSession: SessionInfo = {
      sessionId,
      token,
      title,
      status: 'active',
      agentConnected: false,
      customerConnected: false,
      agentName,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `sys-${Date.now()}`,
          sender: 'system',
          senderName: 'System',
          text: `Support session created. Invite the customer using Token: ${token}`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    sessions.set(sessionId, newSession);
    totalCallsCreated++;
    registerAction(true);

    logStatus("Server", `Session ${sessionId} created with title "${title}"`);
    res.status(201).json(newSession);
  } catch (err: any) {
    registerAction(false);
    res.status(500).json({ error: "Failed to create active session: " + err.message });
  }
});

// Retrieve session history
app.get("/api/sessions/history", (req, res) => {
  registerAction(true);
  res.json(sessionHistory.slice().reverse()); // Newest first
});

// Retrieve active sessions list (for Admin Dashboard)
app.get("/api/sessions/active", (req, res) => {
  registerAction(true);
  res.json(Array.from(sessions.values()));
});

// Force terminate a session from the Admin Dashboard
app.post("/api/sessions/force-end/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    registerAction(false);
    return res.status(404).json({ error: "Session not found or already ended." });
  }

  // Finalize history logging
  const endedAtStr = new Date().toISOString();
  const startMs = new Date(session.startedAt || session.createdAt).getTime();
  const endMs = new Date(endedAtStr).getTime();
  const durationMs = endMs - startMs;

  const historyItem: SessionHistoryItem = {
    id: `hist-${Math.random().toString(36).substring(2, 9)}`,
    sessionId,
    title: session.title,
    agentName: session.agentName || "Agent Support",
    customerName: session.customerName || "Customer",
    joinedAt: session.startedAt || session.createdAt,
    endedAt: endedAtStr,
    durationMs,
    messageCount: session.messages.length,
    recordingUrl: session.recording?.status === 'ready' ? session.recording.url : undefined
  };

  sessionHistory.push(historyItem);
  sessions.delete(sessionId);
  registerAction(true);

  // Notify socket room that the session has been terminated by admin
  io.to(sessionId).emit("session-force-ended", { sessionId, reason: "Terminated via Admin Dashboard" });

  logStatus("Server", `Session ${sessionId} force terminated by administrator`);
  res.json({ success: true, historyItem });
});

// Verify validity of a session ID and token
app.get("/api/sessions/verify/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { token, role } = req.query;
  const session = sessions.get(sessionId);

  if (!session) {
    registerAction(false);
    return res.status(404).json({ valid: false, reason: "Invalid or expired session ID" });
  }

  if (role === 'customer' && session.token !== token) {
    registerAction(false);
    return res.status(403).json({ valid: false, reason: "Invalid session token for customer join" });
  }

  registerAction(true);
  res.json({
    valid: true,
    title: session.title,
    agentConnected: session.agentConnected,
    customerConnected: session.customerConnected,
    recordingActive: session.recording?.status === 'in-progress'
  });
});

// Socket.io Signaling & Real-Time Coordination
io.on("connection", (socket: Socket) => {
  let userSessionId: string | null = null;
  let userRole: UserRole | null = null;
  let userNameStr = "";

  logStatus("Socket", `New connection establish: ${socket.id}`);

  // 1. Participant Joins active session
  socket.on("join-session", (data: { sessionId: string; token?: string; role: UserRole; name: string }) => {
    const { sessionId, token, role, name } = data;
    const session = sessions.get(sessionId);

    if (!session) {
      socket.emit("join-error", { message: "Support session not found or already ended." });
      logStatus("Socket", `Join error: session ${sessionId} not found`);
      return;
    }

    // Role-based validations
    if (role === 'customer' && session.token !== token) {
      socket.emit("join-error", { message: "Invalid support session token." });
      logStatus("Socket", `Join error: invalid token for Customer`);
      return;
    }

    // Prevent duplicate agent or duplicate customer (if already online and active, not in reconnect)
    if (role === 'agent' && session.agentConnected && !gracePeriodTimers.has(`${sessionId}:agent`)) {
      socket.emit("join-error", { message: "The support agent is already connected. Duplicate connections not allowed." });
      logStatus("Socket", `Join rejected: Agent already active in session ${sessionId}`);
      return;
    }

    if (role === 'customer' && session.customerConnected && !gracePeriodTimers.has(`${sessionId}:customer`)) {
      socket.emit("join-error", { message: "The customer is already connected to this support room." });
      logStatus("Socket", `Join rejected: Customer already active in session ${sessionId}`);
      return;
    }

    userSessionId = sessionId;
    userRole = role;
    userNameStr = name;

    // Join room
    socket.join(sessionId);

    // Cancel dynamic reconnection timer if they are coming back within grace window
    const timerKey = `${sessionId}:${role}`;
    if (gracePeriodTimers.has(timerKey)) {
      logStatus("Socket", `Reconnected within grace period: ${userNameStr} as ${role}`);
      clearTimeout(gracePeriodTimers.get(timerKey)!);
      gracePeriodTimers.delete(timerKey);

      // Restore session state
      if (role === 'agent') {
        session.agentConnected = true;
        session.agentName = name;
      } else {
        session.customerConnected = true;
        session.customerName = name;
      }

      // System message
      const reconMessage: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: 'system',
        senderName: 'System',
        text: `♻️ ${userNameStr} reconnected seamlessly. Support session restored.`,
        timestamp: new Date().toISOString()
      };
      session.messages.push(reconMessage);

      io.to(sessionId).emit("peer-reconnected", {
        role,
        name,
        systemMessage: reconMessage,
        reconnectorSocketId: socket.id
      });
    } else {
      // Direct Fresh Join
      logStatus("Socket", `User ${name} joined session ${sessionId} as ${role}`);
      
      if (role === 'agent') {
        session.agentConnected = true;
        session.agentName = name;
      } else {
        session.customerConnected = true;
        session.customerName = name;
        if (!session.startedAt) {
          session.startedAt = new Date().toISOString();
        }
      }

      // Add a system announcement to logs
      const joinMessage: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: 'system',
        senderName: 'System',
        text: `🔔 ${name} joined the support room as ${role === 'agent' ? 'Support Specialist' : 'Customer'}.`,
        timestamp: new Date().toISOString()
      };
      session.messages.push(joinMessage);

      // Tell other people in room that a peer has joined
      socket.to(sessionId).emit("peer-joined", {
        role,
        name,
        socketId: socket.id,
        systemMessage: joinMessage
      });
    }

    // Always send the full updated session state back to the joiner
    socket.emit("session-joined", {
      sessionState: session,
      socketId: socket.id
    });
  });

  // 2. WebRTC Peer-to-Peer Signaling Relay (Offer, Answer, ICE Candidates)
  socket.on("webrtc-offer", (data: { sdp: any; sessionId: string }) => {
    if (userSessionId) {
      socket.to(userSessionId).emit("webrtc-offer", { sdp: data.sdp, senderId: socket.id });
    }
  });

  socket.on("webrtc-answer", (data: { sdp: any; sessionId: string }) => {
    if (userSessionId) {
      socket.to(userSessionId).emit("webrtc-answer", { sdp: data.sdp, senderId: socket.id });
    }
  });

  socket.on("webrtc-ice-candidate", (data: { candidate: any; sessionId: string }) => {
    if (userSessionId) {
      socket.to(userSessionId).emit("webrtc-ice-candidate", { candidate: data.candidate, senderId: socket.id });
    }
  });

  // 3. Optional WebSocket-Based Server-Routed Media Relay (Backup Stream)
  socket.on("media-relay", (data: { frame?: string; audio?: boolean }) => {
    if (userSessionId) {
      // Broadcast video frames / audio payload directly to others in the room
      socket.to(userSessionId).emit("peer-media-relay", data);
    }
  });

  // 4. Mute status changes (audio/video toggling)
  socket.on("stream-control", (data: { audioActive: boolean; videoActive: boolean }) => {
    if (userSessionId && userRole) {
      io.to(userSessionId).emit("peer-stream-control", {
        role: userRole,
        audioActive: data.audioActive,
        videoActive: data.videoActive
      });
    }
  });

  // 5. In-Call Chat (Real-time and Persisted)
  socket.on("send-message", (data: { text: string; file?: FileAttachment }) => {
    if (!userSessionId || !userRole) return;
    const session = sessions.get(userSessionId);
    if (!session) return;

    const newMessage: ChatMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: userRole,
      senderName: userNameStr,
      text: data.text,
      timestamp: new Date().toISOString(),
      file: data.file
    };

    session.messages.push(newMessage);
    io.to(userSessionId).emit("new-message", newMessage);
    logStatus("Socket", `Message sent in room ${userSessionId} by ${userNameStr}`);
  });

  // 6. Record Stream Controls (Agent only)
  socket.on("toggle-recording", (data: { action: 'start' | 'stop' }) => {
    if (!userSessionId || userRole !== 'agent') return;
    const session = sessions.get(userSessionId);
    if (!session) return;

    if (data.action === 'start') {
      session.recording = {
        id: `rec-${Math.random().toString(36).substring(2, 9)}`,
        status: 'in-progress',
        startedAt: new Date().toISOString()
      };

      const recordMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: 'system',
        senderName: 'System',
        text: `🔴 Recording started by support specialist. This session is currently being recorded for quality monitoring.`,
        timestamp: new Date().toISOString()
      };
      session.messages.push(recordMsg);

      io.to(userSessionId).emit("recording-status-changed", {
        recording: session.recording,
        systemMessage: recordMsg
      });
    } else if (data.action === 'stop' && session.recording) {
      session.recording.status = 'processing';
      session.recording.endedAt = new Date().toISOString();

      const recordMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        sender: 'system',
        senderName: 'System',
        text: `⏳ Recording stopped. Video session recording is being processed...`,
        timestamp: new Date().toISOString()
      };
      session.messages.push(recordMsg);

      io.to(userSessionId).emit("recording-status-changed", {
        recording: session.recording,
        systemMessage: recordMsg
      });

      // Simulate asynchronous Cloud recording compilation/processing
      const currentSessionId = userSessionId;
      setTimeout(() => {
        const activeSession = sessions.get(currentSessionId);
        if (activeSession?.recording) {
          activeSession.recording.status = 'ready';
          // Delivering a mock processed stream file
          activeSession.recording.url = `/recordings/support-call-${activeSession.recording.id}.mp4`;

          const readyMsg: ChatMessage = {
            id: `sys-${Date.now()}`,
            sender: 'system',
            senderName: 'System',
            text: `💾 Video recording is compiled and secure. Support session summary recording ready for instant download!`,
            timestamp: new Date().toISOString()
          };
          activeSession.messages.push(readyMsg);

          io.to(currentSessionId).emit("recording-status-changed", {
            recording: activeSession.recording,
            systemMessage: readyMsg
          });
        }
      }, 4000);
    }
  });

  // 7. Session Termination (Clean Exits)
  socket.on("end-session", () => {
    if (!userSessionId) return;
    const session = sessions.get(userSessionId);
    if (!session) return;

    const endedAtStr = new Date().toISOString();
    const startMs = new Date(session.startedAt || session.createdAt).getTime();
    const endMs = new Date(endedAtStr).getTime();
    const durationMs = endMs - startMs;

    const historyItem: SessionHistoryItem = {
      id: `hist-${Math.random().toString(36).substring(2, 9)}`,
      sessionId: userSessionId,
      title: session.title,
      agentName: session.agentName || "Agent Support",
      customerName: session.customerName || "Customer",
      joinedAt: session.startedAt || session.createdAt,
      endedAt: endedAtStr,
      durationMs,
      messageCount: session.messages.length,
      recordingUrl: session.recording?.status === 'ready' ? session.recording.url : undefined
    };

    sessionHistory.push(historyItem);
    sessions.delete(userSessionId);

    logStatus("Socket", `Session ${userSessionId} ended cleanly by ${userNameStr}`);
    io.to(userSessionId).emit("session-ended", { historyItem });
  });

  // 8. Unexpected Disconnects with a 15-second Grace Window
  socket.on("disconnect", () => {
    logStatus("Socket", `Connection dropped: ${socket.id}`);
    if (!userSessionId || !userRole) return;

    const session = sessions.get(userSessionId);
    if (!session) return;

    // Set connection status to offline
    if (userRole === 'agent') {
      session.agentConnected = false;
    } else {
      session.customerConnected = false;
    }

    const timerKey = `${userSessionId}:${userRole}`;
    
    // Broadcast warning about unexpected disconnect and start of 15 seconds grace window
    const sysDisconnectMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      sender: 'system',
      senderName: 'System',
      text: `⚠️ Unexpectedly disconnect: ${userNameStr} left the call. Attempting reconnection for 15 seconds grace window...`,
      timestamp: new Date().toISOString()
    };
    session.messages.push(sysDisconnectMsg);

    io.to(userSessionId).emit("peer-disconnected-grace", {
      role: userRole,
      name: userNameStr,
      systemMessage: sysDisconnectMsg,
      graceSecRemaining: 15
    });

    logStatus("Socket", `Started 15-second grace window timer for ${userNameStr} (${userRole})`);

    // Setup the grace period timer
    const timer = setTimeout(() => {
      gracePeriodTimers.delete(timerKey);
      const updatedSession = sessions.get(userSessionId!);
      
      if (updatedSession) {
        logStatus("Socket", `Grace period EXPIRED for ${userNameStr} (${userRole}) in room ${userSessionId}`);
        
        const expiredMessage: ChatMessage = {
          id: `sys-${Date.now()}`,
          sender: 'system',
          senderName: 'System',
          text: `❌ Reconnect grace expired. ${userNameStr} was officially disconnected.`,
          timestamp: new Date().toISOString()
        };
        updatedSession.messages.push(expiredMessage);

        io.to(userSessionId!).emit("peer-disconnected-permanent", {
          role: userRole,
          name: userNameStr,
          systemMessage: expiredMessage
        });

        // If BOTH have left or if agent has officially abandoned, clean up the session!
        if (!updatedSession.agentConnected && !updatedSession.customerConnected) {
          logStatus("Socket", `All users left session ${userSessionId}. Completing session log.`);
          
          const endedAtStr = new Date().toISOString();
          const startMs = new Date(updatedSession.startedAt || updatedSession.createdAt).getTime();
          const durationMs = new Date(endedAtStr).getTime() - startMs;

          const historyItem: SessionHistoryItem = {
            id: `hist-${Math.random().toString(36).substring(2, 9)}`,
            sessionId: userSessionId!,
            title: updatedSession.title,
            agentName: updatedSession.agentName || "Agent Support",
            customerName: updatedSession.customerName || "Customer",
            joinedAt: updatedSession.startedAt || updatedSession.createdAt,
            endedAt: endedAtStr,
            durationMs: Math.max(1, durationMs),
            messageCount: updatedSession.messages.length,
            recordingUrl: updatedSession.recording?.status === 'ready' ? updatedSession.recording.url : undefined
          };

          sessionHistory.push(historyItem);
          sessions.delete(userSessionId!);
        }
      }
    }, 15000);

    gracePeriodTimers.set(timerKey, timer);
  });
});

// Configure Vite / Static assets hosting
async function startAppServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    logStatus("Init", "Vite Development server middleware attached.");
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    logStatus("Init", "Serving static production assets from /dist.");
  }

  server.listen(PORT, "0.0.0.0", () => {
    logStatus("Init", `Server running at http://0.0.0.0:${PORT}`);
  });
}

startAppServer().catch((err) => {
  console.error("Critical server startup crash:", err);
});
