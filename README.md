# Video Calling Platform - Secure Telecom Gateway (vRTC Support)

A fully-featured, secure, real-time video calling and digital white-glove support application designed entirely with self-hosted Node.js + Express and Socket.io. **No third-party calling APIs (such as Twilio, Agora, or Daily) are utilized.** 

All WebRTC connection handshakes, live chats, image frame buffers, and metrics are securely routed and orchestrated on your own localized server.

---

## 🚀 Key Features Built Completely
The platform contains several fully functional components to address Session Management, Calling, Chat, and Administration:

### 1. Robust Session Management & Access Control
*   **Dual Roles**: Explicit support for **Call Agent** (session creators with recording rights) and **Customer** (reconnect capabilities).
*   **Secure Invitations**: Agents generate unique support slot sessions which secure a 1-click shareable Link and Token.
*   **Slot Locking**: Restricts slot-joins to prevent duplicate entries or illegitimate intruders.
*   **Audit Archiving**: Clean endings immediately store complete session logs (chat counts, call durations, start/end dates) into the server memory.

### 2. Dual Calling System (WebRTC + WebSocket Server Relay Backup)
*   **Direct Mesh Mode**: Local WebRTC peer connection that exchanges SDP Offers, Answers, and ICE Candidates cleanly through Socket.io signaling.
*   **Server Relay Mode (Bulletproof Backup)**: Captures frames from cameras or a responsive moving test-pattern, translates them to lightweight image streams, and relays them server-side via Socket.io. This **guarantees** 100% video-calling stability even in deeply sandboxed, cross-origin browser iframe pre-view environments!
*   **Real Sync Controls**: Real-time microphone and camera on/off indicators, syncing statuses dynamically.
*   **Display Screen Share**: Full browser desktop screen-capture stream integration for technical walk-through diagnostics.

### 3. Integrated File & Chat Sharing
*   **En-Route Conversions**: Stage any document, image, or PDF up to 8MB.
*   **Persistent Transcripts**: Converts files to secure Base64 segments and pushes them in real-time. Message logs persist securely in server memory and are reloadable.

### 4. Reconnect Grace Period Window
*   **15s Grace Threshold**: If either participant's socket network link breaks down, a live countdown overlay alerts the remaining party.
*   **Seamless Restoration**: If they rejoin the slot within 15 seconds, the countdown halts, the stream is reattached, and session states are safely returned.

### 5. Admin Dashboard (Ops & Observability)
*   **Live Metrics**: Graphing active call count, server sockets, accumulated sessions, and calculated latencies.
*   **Forced Terminations**: Red visual hooks to override and cleanly disconnect any active session room from the gateway.
*   **Live Stream Terminal Logs**: Displays real-time raw signaling packet logs directly.

---

## 🛠️ Architecture and Stack Diagram

```
                 +-----------------------------------------+
                 |          Vite + React Frontend          |
                 |  (Agent dashboard / Customer portal)    |
                 +----+-------------------------------+---+
                      |                               |
        Signaling / Chat Messages           Relayed Video Frames
        & Presence (WebSockets)             & Canvas fallbacks (WS)
                      |                               |
                      v                               v
                 +----+-------------------------------+---+
                 |           Socket.io Gateway             |
                 |      (Express Server on Port 3000)      |
                 +----+-----------------------------------+
                      |
                      |  Exposes Admin API / Serving Static Build
                      v
                 +----+-----------------------------------+
                 |   In-Memory History Repository Logger   |
                 +----------------------------------------+
```

---

## 📦 File Layout
*   `/server.ts`: Node.js cluster entry. Contains Express API, Socket.io signaling coordination, reconnection timeouts, and production Vite bundle proxies.
*   `/src/main.tsx` & `/src/App.tsx`: Applet router coordinates view states and holds client-side sockets.
*   `/src/types.ts`: Describes compiler type-safety interfaces.
*   `/src/components/Header.tsx`: Context navigation bar letting you toggle views inside the preview.
*   `/src/components/AgentDashboard.tsx`: Session builder with historic table registers.
*   `/src/components/CustomerJoin.tsx`: Pre-fills and checks connection tokens.
*   `/src/components/CallRoom.tsx`: Controls RTC, relays canvas coordinates, houses chat drawers, and controls screen shares.
*   `/src/components/AdminDashboard.tsx`: Feeds observability indicators and holds forcing commands.

---

## 🚀 Installation & Command Directory

Follow these simple steps from the workspace root to boot development:

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Local Environment (Development)
The developer container automatically provisions of the server at Port 3000.
```bash
npm run dev
```

### 3. Build & Boot Production (Standalone)
Compiles React chunks into `/dist` and compiles `/server.ts` into a self-contained CommonJS node server bundle `/dist/server.cjs` via `esbuild`.
```bash
npm run build
npm start
```

---

## 🧪 Quick Walkthrough Evaluation Guide

To experience the full WebRTC or WebSocket Relay capability:
1.  Open the development preview. Enter your agent name and click **Provision Secure Call Session**.
2.  Your room token and Link are presented. Click the link or use the copy button.
3.  **To test as customer**: Open a separate incognito browser tab and navigate to that link! Or click **Customer Join** on the top header, input the auto-validated parameters, and join!
4.  Interact with WebRTC direct calls or switch to **Server Relay** mode.
5.  Click the paperclip button in the chat sidebar to share a file attachment.
6.  Close the Customer tab. You will see a blinking red **15 seconds countdown grace period warning** appear instantly on the Agent console!
7.  Verify metrics and forcing buttons by accessing the **Admin Ops** tab in the navbar.
