import type { Stroke, Point } from "../client/canvas.js";
export type { Stroke, Point } from "../client/canvas.js";

export interface User {
  id: string;
  color: string;
  name: string;
}

export interface DrawingOperation {
  type: "add" | "remove" | "clear";
  stroke?: Stroke;
  strokeId?: string;
  timestamp: number;
  userId: string;
}

export class DrawingStateManager {
  private strokes: Map<string, Stroke> = new Map();
  private operationHistory: DrawingOperation[] = [];
  private redoStack: DrawingOperation[] = [];
  private maxHistorySize: number = 1000;

  constructor() {}

  // Add a new stroke to the state
  addStroke(stroke: Stroke): void {
    this.strokes.set(stroke.id, { ...stroke });

    // Add to operation history
    const operation: DrawingOperation = {
      type: "add",
      stroke: { ...stroke },
      timestamp: Date.now(),
      userId: stroke.userId,
    };

    this.operationHistory.push(operation);
    this.redoStack = []; // Clear redo stack on new operation

    // Trim history if it gets too large
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(-this.maxHistorySize);
    }
  }

  // Remove a stroke from the state
  removeStroke(strokeId: string, userId: string): boolean {
    const stroke = this.strokes.get(strokeId);
    if (!stroke) return false;

    this.strokes.delete(strokeId);

    // Add to operation history
    const operation: DrawingOperation = {
      type: "remove",
      strokeId,
      timestamp: Date.now(),
      userId,
    };

    this.operationHistory.push(operation);
    this.redoStack = [];

    return true;
  }

  // Clear all strokes
  clear(userId: string): void {
    const operation: DrawingOperation = {
      type: "clear",
      timestamp: Date.now(),
      userId,
    };

    this.operationHistory.push(operation);
    this.redoStack = [];
    this.strokes.clear();
  }

  getStroke(strokeId: string): Stroke | undefined {
    return this.strokes.get(strokeId);
  }

  getAllStrokes(): Stroke[] {
    return Array.from(this.strokes.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  getStrokesByUser(userId: string): Stroke[] {
    return Array.from(this.strokes.values())
      .filter((stroke) => stroke.userId === userId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  undo(userId: string): DrawingOperation | null {
    if (this.operationHistory.length === 0) return null;

    const lastOperation = this.operationHistory.pop()!;

    switch (lastOperation.type) {
      case "add":
        if (lastOperation.stroke) {
          this.strokes.delete(lastOperation.stroke.id);
        }
        break;

      case "remove":
        if (lastOperation.strokeId && lastOperation.stroke) {
          this.strokes.set(lastOperation.strokeId, lastOperation.stroke);
        }
        break;

      case "clear":
        // To undo a clear, we need to restore all strokes that were cleared
        // This is complex and would require storing the previous state
        // For now, we'll handle this at the room level
        break;
    }

    this.redoStack.push(lastOperation);
    return lastOperation;
  }

  redo(userId: string): DrawingOperation | null {
    if (this.redoStack.length === 0) return null;

    const lastUndone = this.redoStack.pop()!;

    switch (lastUndone.type) {
      case "add":
        if (lastUndone.stroke) {
          this.strokes.set(lastUndone.stroke.id, lastUndone.stroke);
        }
        break;

      case "remove":
        if (lastUndone.strokeId) {
          this.strokes.delete(lastUndone.strokeId);
        }
        break;

      case "clear":
        this.strokes.clear();
        break;
    }

    this.operationHistory.push(lastUndone);
    return lastUndone;
  }

  getState(): { strokes: Stroke[] } {
    return {
      strokes: this.getAllStrokes(),
    };
  }

  setState(state: { strokes: Stroke[] }): void {
    this.strokes.clear();
    this.operationHistory = [];
    this.redoStack = [];

    state.strokes.forEach((stroke) => {
      this.strokes.set(stroke.id, { ...stroke });
    });
  }

  getOperationHistory(): DrawingOperation[] {
    return [...this.operationHistory];
  }

  // Get statistics about the drawing state
  getStats(): {
    totalStrokes: number;
    totalPoints: number;
    historySize: number;
    redoStackSize: number;
  } {
    let totalPoints = 0;
    this.strokes.forEach((stroke) => {
      totalPoints += stroke.points.length;
    });

    return {
      totalStrokes: this.strokes.size,
      totalPoints,
      historySize: this.operationHistory.length,
      redoStackSize: this.redoStack.length,
    };
  }

  // Find strokes in a specific area (for potential collision detection)
  findStrokesInArea(x: number, y: number, radius: number = 10): Stroke[] {
    const strokesInArea: Stroke[] = [];

    this.strokes.forEach((stroke) => {
      for (const point of stroke.points) {
        const distance = Math.sqrt(
          Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
        );

        if (distance <= radius) {
          strokesInArea.push(stroke);
          break;
        }
      }
    });

    return strokesInArea;
  }

  cleanupOldStrokes(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let removedCount = 0;

    this.strokes.forEach((stroke, strokeId) => {
      if (now - stroke.timestamp > maxAge) {
        this.strokes.delete(strokeId);
        removedCount++;
      }
    });

    return removedCount;
  }
}

export function createDrawingStateManager(): DrawingStateManager {
  return new DrawingStateManager();
}
