export interface Point {
  x: number;
  y: number;
}

export interface User {
  id: string;
  color: string;
  name: string;
}

export interface Stroke {
  id: string;
  userId: string;
  points: Point[];
  color: string;
  width: number;
  tool: "brush" | "eraser";
  timestamp: number;
}

export interface DrawingState {
  strokes: Stroke[];
  redoStack: Stroke[];
}

export interface DrawingStateManager {
  addStroke(stroke: Stroke): void;
  removeStroke(strokeId: string, userId: string): void;
  undo(userId: string): void;
  redo(userId: string): void;
  clear(userId: string): void;
  getState(): DrawingState;
  getStats(): { strokeCount: number; redoStackSize: number };
  getStroke(strokeId: string): Stroke | undefined;
}

export function createDrawingStateManager(): DrawingStateManager {
  return new DrawingStateManagerImpl();
}

class DrawingStateManagerImpl implements DrawingStateManager {
  private state: DrawingState = {
    strokes: [],
    redoStack: [],
  };

  addStroke(stroke: Stroke): void {
    this.state.strokes.push(stroke);
    this.state.redoStack = [];
  }

  removeStroke(strokeId: string, _userId: string): void {
    this.state.strokes = this.state.strokes.filter(
      (stroke) => stroke.id !== strokeId,
    );
    this.state.redoStack = [];
  }

  undo(_userId: string): void {
    const stroke = this.state.strokes.pop();
    if (stroke) {
      this.state.redoStack.push(stroke);
    }
  }

  redo(_userId: string): void {
    const stroke = this.state.redoStack.pop();
    if (stroke) {
      this.state.strokes.push(stroke);
    }
  }

  clear(_userId: string): void {
    this.state.strokes = [];
    this.state.redoStack = [];
  }

  getState(): DrawingState {
    return {
      strokes: [...this.state.strokes],
      redoStack: [...this.state.redoStack],
    };
  }

  getStats(): { strokeCount: number; redoStackSize: number } {
    return {
      strokeCount: this.state.strokes.length,
      redoStackSize: this.state.redoStack.length,
    };
  }

  getStroke(strokeId: string): Stroke | undefined {
    return (
      this.state.strokes.find((stroke) => stroke.id === strokeId) ??
      this.state.redoStack.find((stroke) => stroke.id === strokeId)
    );
  }
}
