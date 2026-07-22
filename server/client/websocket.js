export class WebSocketManager {
  constructor() {
    this.roomId = "default";
    this.currentUser = null;
    this.latency = 0;
    this.setConnectionStatus("Connecting...");

    if (!window.io) {
      console.error("Socket.IO client not loaded");
      this.setConnectionStatus("Socket.IO client missing");
      return;
    }

    this.socket = window.io({
      transports: ["websocket"],
      upgrade: false,
    });

    this.setupEventListeners();
    this.startLatencyCheck();
  }

  setupEventListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.setConnectionStatus("Connected");
      this.joinRoom(this.roomId);
    });

    this.socket.on("connect_error", () => {
      this.setConnectionStatus("Connection failed");
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.setConnectionStatus("Disconnected");
    });

    this.socket.on("user-joined", (users) => {
      this.currentUser = users.find((u) => u.id === this.socket.id) || null;
      this.updateUserList(users);
    });

    this.socket.on("user-left", (userId) => {
      this.removeCursor(userId);
    });

    this.socket.on("cursor-move", (data) => {
      this.updateRemoteCursor(data.userId, data.x, data.y);
    });

    this.socket.on("pong", (latency) => {
      this.latency = latency;
      this.updateLatencyDisplay();
    });
  }

  startLatencyCheck() {
    setInterval(() => {
      if (this.socket.connected) {
        const startTime = Date.now();
        this.socket.emit("ping", () => {
          this.latency = Date.now() - startTime;
          this.updateLatencyDisplay();
        });
      }
    }, 1000);
  }

  updateUserList(users) {
    const userList = document.getElementById("userList");
    if (!userList) return;

    userList.innerHTML = "";
    users.forEach((user) => {
      const userEl = document.createElement("div");
      userEl.className = "user-indicator";
      userEl.style.backgroundColor = user.color;
      userEl.textContent = user.name;
      userList.appendChild(userEl);
    });

    const userCount = document.getElementById("userCount");
    if (userCount) {
      userCount.textContent = `${users.length} users online`;
    }
  }

  updateRemoteCursor(userId, x, y) {
    let cursor = document.getElementById(`cursor-${userId}`);

    if (!cursor) {
      cursor = document.createElement("div");
      cursor.id = `cursor-${userId}`;
      cursor.className = "remote-cursor";
      document.body.appendChild(cursor);
    }

    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;

    const userColor = this.getUserColor(userId);
    if (userColor) {
      cursor.style.backgroundColor = userColor;
    }
  }

  removeCursor(userId) {
    const cursor = document.getElementById(`cursor-${userId}`);
    if (cursor) {
      cursor.remove();
    }
  }

  getUserColor(userId) {
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];
    const index = userId.split("").reduce((a, b) => a + b.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  updateLatencyDisplay() {
    const latencyDisplay = document.getElementById("latencyDisplay");
    if (latencyDisplay) {
      latencyDisplay.textContent = `Ping: ${this.latency}ms`;
    }
  }

  setConnectionStatus(status) {
    const connectionStatus = document.getElementById("connectionStatus");
    if (connectionStatus) {
      connectionStatus.textContent = status;
    }
  }

  joinRoom(roomId) {
    this.roomId = roomId;
    this.socket.emit("join-room", roomId);
  }

  sendStrokeStart(stroke) {
    this.socket.emit("stroke-start", stroke);
  }

  sendStrokePoint(strokeId, point) {
    this.socket.emit("stroke-point", { strokeId, point });
  }

  sendStrokeEnd(stroke) {
    this.socket.emit("stroke-end", stroke);
  }

  sendUndo(strokeId) {
    this.socket.emit("undo", strokeId);
  }

  sendRedo(strokeId) {
    this.socket.emit("redo", strokeId);
  }

  sendClear() {
    this.socket.emit("clear");
  }

  sendCursorMove(point) {
    this.socket.emit("cursor-move", point);
  }

  onStrokeStart(callback) {
    this.socket.on("stroke-start", callback);
  }

  onStrokePoint(callback) {
    this.socket.on("stroke-point", callback);
  }

  onStrokeEnd(callback) {
    this.socket.on("stroke-end", callback);
  }

  onUndo(callback) {
    this.socket.on("undo", callback);
  }

  onRedo(callback) {
    this.socket.on("redo", callback);
  }

  onClear(callback) {
    this.socket.on("clear", callback);
  }

  onFullState(callback) {
    this.socket.on("full-state", callback);
  }

  getLatency() {
    return this.latency;
  }

  isConnected() {
    return this.socket.connected;
  }
}
