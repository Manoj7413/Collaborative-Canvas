import { Stroke, Point } from "./canvas";
import { io, Socket } from "socket.io-client";

interface User {
  id: string;
  color: string;
  name: string;
}

interface ServerToClientEvents {
  "user-joined": (users: User[]) => void;
  "user-left": (userId: string) => void;
  "stroke-start": (stroke: Stroke) => void;
  "stroke-point": (data: {
    strokeId: string;
    point: Point;
    userId: string;
  }) => void;
  "stroke-end": (stroke: Stroke) => void;
  undo: (strokeId: string) => void;
  redo: (strokeId: string) => void;
  clear: () => void;
  "cursor-move": (data: { userId: string; x: number; y: number }) => void;
  "full-state": (state: any) => void;
  pong: (latency: number) => void;
}

interface ClientToServerEvents {
  "join-room": (roomId: string) => void;
  "stroke-start": (stroke: Stroke) => void;
  "stroke-point": (data: { strokeId: string; point: Point }) => void;
  "stroke-end": (stroke: Stroke) => void;
  undo: (strokeId: string) => void;
  redo: (strokeId: string) => void;
  clear: () => void;
  "cursor-move": (point: Point) => void;
  ping: (callback: (startTime: number) => void) => void;
}

export class WebSocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private roomId: string = "default";
  private currentUser: User | null = null;
  private latency: number = 0;

  constructor() {
    this.socket = io({
      transports: ["websocket"],
      upgrade: false,
    });

    this.setupEventListeners();
    this.startLatencyCheck();
  }

  private setupEventListeners(): void {
    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.joinRoom(this.roomId);
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    this.socket.on("user-joined", (users: User[]) => {
      this.currentUser = users.find((u) => u.id === this.socket.id) || null;
      this.updateUserList(users);
    });

    this.socket.on("user-left", (userId: string) => {
      this.removeCursor(userId);
    });

    this.socket.on("cursor-move", (data) => {
      this.updateRemoteCursor(data.userId, data.x, data.y);
    });

    this.socket.on("pong", (latency: number) => {
      this.latency = latency;
      this.updateLatencyDisplay();
    });
  }

  private startLatencyCheck(): void {
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

  private updateUserList(users: User[]): void {
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

  private updateRemoteCursor(userId: string, x: number, y: number): void {
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

  private removeCursor(userId: string): void {
    const cursor = document.getElementById(`cursor-${userId}`);
    if (cursor) {
      cursor.remove();
    }
  }

  private getUserColor(userId: string): string {
    // This would be populated from server user data
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];
    const index =
      userId.split("").reduce((a, b) => a + b.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  private updateLatencyDisplay(): void {
    const latencyDisplay = document.getElementById("latencyDisplay");
    if (latencyDisplay) {
      latencyDisplay.textContent = `Ping: ${this.latency}ms`;
    }
  }

  // Public methods
  public joinRoom(roomId: string): void {
    this.roomId = roomId;
    this.socket.emit("join-room", roomId);
  }

  public sendStrokeStart(stroke: Stroke): void {
    this.socket.emit("stroke-start", stroke);
  }

  public sendStrokePoint(strokeId: string, point: Point): void {
    this.socket.emit("stroke-point", { strokeId, point });
  }

  public sendStrokeEnd(stroke: Stroke): void {
    this.socket.emit("stroke-end", stroke);
  }

  public sendUndo(strokeId: string): void {
    this.socket.emit("undo", strokeId);
  }

  public sendRedo(strokeId: string): void {
    this.socket.emit("redo", strokeId);
  }

  public sendClear(): void {
    this.socket.emit("clear");
  }

  public sendCursorMove(point: Point): void {
    this.socket.emit("cursor-move", point);
  }

  // Event registration
  public onStrokeStart(callback: (stroke: Stroke) => void): void {
    this.socket.on("stroke-start", callback);
  }

  public onStrokePoint(
    callback: (data: { strokeId: string; point: Point; userId: string }) => void
  ): void {
    this.socket.on("stroke-point", callback);
  }

  public onStrokeEnd(callback: (stroke: Stroke) => void): void {
    this.socket.on("stroke-end", callback);
  }

  public onUndo(callback: (strokeId: string) => void): void {
    this.socket.on("undo", callback);
  }

  public onRedo(callback: (strokeId: string) => void): void {
    this.socket.on("redo", callback);
  }

  public onClear(callback: () => void): void {
    this.socket.on("clear", callback);
  }

  public onFullState(callback: (state: any) => void): void {
    this.socket.on("full-state", callback);
  }

  public getLatency(): number {
    return this.latency;
  }

  public isConnected(): boolean {
    return this.socket.connected;
  }
}
