import { User, Stroke } from "./drawing-state.js";
import {
  DrawingStateManager,
  createDrawingStateManager,
} from "./drawing-state.js";

interface Room {
  state: DrawingStateManager;
  users: User[];
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private userRooms: Map<string, string> = new Map();

  joinRoom(userId: string, roomId: string, color: string, name: string): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        state: createDrawingStateManager(),
        users: [],
      });
    }

    const room = this.rooms.get(roomId)!;
    const existingUserIndex = room.users.findIndex((u) => u.id === userId);

    if (existingUserIndex === -1) {
      room.users.push({ id: userId, color, name });
    }

    this.userRooms.set(userId, roomId);
  }

  leaveRoom(userId: string): void {
    const roomId = this.userRooms.get(userId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.users = room.users.filter((u) => u.id !== userId);
        if (room.users.length === 0) {
          this.rooms.delete(roomId);
        }
      }
      this.userRooms.delete(userId);
    }
  }

  addStroke(roomId: string, stroke: Stroke): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.state.addStroke(stroke);
    }
  }

  removeStroke(roomId: string, strokeId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      const userId = this.getUserIdByStroke(roomId, strokeId);
      room.state.removeStroke(strokeId, userId || "unknown");
    }
  }

  undo(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.state.undo(userId);
    }
  }

  redo(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.state.redo(userId);
    }
  }

  clearRoom(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.state.clear(userId);
    }
  }

  getRoomUsers(roomId: string): User[] {
    const room = this.rooms.get(roomId);
    return room ? [...room.users] : [];
  }

  getRoomState(roomId: string): any {
    const room = this.rooms.get(roomId);
    return room ? room.state.getState() : { strokes: [] };
  }

  getUserRoom(userId: string): string | undefined {
    return this.userRooms.get(userId);
  }

  getRoomStats(roomId: string): any {
    const room = this.rooms.get(roomId);
    return room ? room.state.getStats() : null;
  }

  private getUserIdByStroke(roomId: string, strokeId: string): string | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const stroke = room.state.getStroke(strokeId);
    return stroke ? stroke.userId : null;
  }
}
