import { DrawingCanvas } from "./canvas.js";
import { WebSocketManager } from "./websocket.js";

class CollaborativeCanvasApp {
  private canvas: DrawingCanvas;
  private websocket: WebSocketManager;
  private isInitialized: boolean = false;

  constructor() {
    this.canvas = new DrawingCanvas("mainCanvas", "cursorCanvas");
    this.websocket = new WebSocketManager();

    this.initializeApp();
  }

  private initializeApp(): void {
    this.setupToolbar();
    this.setupWebSocketHandlers();
    this.setupCanvasHandlers();
    this.setupUndoRedo();

    this.isInitialized = true;
    console.log("Collaborative Canvas App initialized");
  }

  private setupToolbar(): void {
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tool = (e.target as HTMLElement).dataset.tool as
          | "brush"
          | "eraser";
        this.setTool(tool);

        // Update active state
        document
          .querySelectorAll(".tool-btn")
          .forEach((b) => b.classList.remove("active"));
        (e.target as HTMLElement).classList.add("active");
      });
    });

    // Color picker
    const colorPicker = document.getElementById(
      "colorPicker"
    ) as HTMLInputElement;
    colorPicker.addEventListener("input", (e) => {
      this.canvas.setColor((e.target as HTMLInputElement).value);
    });

    // Brush size
    const brushSize = document.getElementById("brushSize") as HTMLInputElement;
    const brushSizeValue = document.getElementById(
      "brushSizeValue"
    ) as HTMLSpanElement;

    brushSize.addEventListener("input", (e) => {
      const size = parseInt((e.target as HTMLInputElement).value);
      this.canvas.setWidth(size);
      brushSizeValue.textContent = `${size}px`;
    });

    // Clear button
    const clearBtn = document.getElementById("clearBtn");
    clearBtn?.addEventListener("click", () => {
      if (confirm("Clear the entire canvas? This will affect all users.")) {
        this.canvas.clear();
        this.websocket.sendClear();
      }
    });
  }

  private setupUndoRedo(): void {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");

    undoBtn?.addEventListener("click", () => {
      const stroke = this.canvas.undo();
      if (stroke) {
        this.websocket.sendUndo(stroke.id);
      }
    });

    redoBtn?.addEventListener("click", () => {
      const stroke = this.canvas.redo();
      if (stroke) {
        this.websocket.sendRedo(stroke.id);
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undoBtn?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redoBtn?.click();
      }
    });
  }

  private setupWebSocketHandlers(): void {
    // Handle incoming strokes
    this.websocket.onStrokeStart((stroke) => {
      this.canvas.addRemoteStroke(stroke);
    });

    this.websocket.onStrokePoint((data) => {
      // For real-time drawing, we'd need to update existing strokes
      // This is a simplified implementation
      console.log("Stroke point received", data);
    });

    this.websocket.onStrokeEnd((stroke) => {
      this.canvas.addRemoteStroke(stroke);
    });

    this.websocket.onUndo((strokeId) => {
      this.canvas.undo();
    });

    this.websocket.onRedo((strokeId) => {
      this.canvas.redo();
    });

    this.websocket.onClear(() => {
      this.canvas.clear();
    });

    this.websocket.onFullState((state) => {
      this.canvas.setState(state);
    });
  }

  private setupCanvasHandlers(): void {
    // Send drawing events to server
    this.canvas.setOnStrokeStart((stroke) => {
      this.websocket.sendStrokeStart(stroke);
    });

    this.canvas.setOnStrokePoint((strokeId, point) => {
      this.websocket.sendStrokePoint(strokeId, point);
    });

    this.canvas.setOnStrokeEnd((stroke) => {
      this.websocket.sendStrokeEnd(stroke);
    });

    // Send cursor position
    this.canvas["canvas"].addEventListener("mousemove", (e) => {
      const rect = this.canvas["canvas"].getBoundingClientRect();
      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      this.websocket.sendCursorMove(point);
    });
  }

  private setTool(tool: "brush" | "eraser"): void {
    this.canvas.setTool(tool);
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new CollaborativeCanvasApp();
});
