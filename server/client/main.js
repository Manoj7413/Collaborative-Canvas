import { DrawingCanvas } from "./canvas.js";
import { WebSocketManager } from "./websocket.js";

class CollaborativeCanvasApp {
  constructor() {
    this.isInitialized = false;
    this.canvas = new DrawingCanvas("mainCanvas", "cursorCanvas");
    this.websocket = new WebSocketManager();

    this.initializeApp();
  }

  initializeApp() {
    this.setupToolbar();
    this.setupWebSocketHandlers();
    this.setupCanvasHandlers();
    this.setupUndoRedo();

    this.isInitialized = true;
    console.log("Collaborative Canvas App initialized");
  }

  setupToolbar() {
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tool = e.target.dataset.tool;
        this.setTool(tool);

        document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
      });
    });

    const colorPicker = document.getElementById("colorPicker");
    colorPicker.addEventListener("input", (e) => {
      this.canvas.setColor(e.target.value);
    });

    const brushSize = document.getElementById("brushSize");
    const brushSizeValue = document.getElementById("brushSizeValue");

    brushSize.addEventListener("input", (e) => {
      const size = parseInt(e.target.value, 10);
      this.canvas.setWidth(size);
      brushSizeValue.textContent = `${size}px`;
    });

    const clearBtn = document.getElementById("clearBtn");
    clearBtn?.addEventListener("click", () => {
      if (confirm("Clear the entire canvas? This will affect all users.")) {
        this.canvas.clear();
        this.websocket.sendClear();
      }
    });
  }

  setupUndoRedo() {
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

  setupWebSocketHandlers() {
    this.websocket.onStrokeStart((stroke) => {
      this.canvas.addRemoteStroke(stroke);
    });

    this.websocket.onStrokePoint((data) => {
      console.log("Stroke point received", data);
    });

    this.websocket.onStrokeEnd((stroke) => {
      this.canvas.addRemoteStroke(stroke);
    });

    this.websocket.onUndo(() => {
      this.canvas.undo();
    });

    this.websocket.onRedo(() => {
      this.canvas.redo();
    });

    this.websocket.onClear(() => {
      this.canvas.clear();
    });

    this.websocket.onFullState((state) => {
      this.canvas.setState(state);
    });
  }

  setupCanvasHandlers() {
    this.canvas.setOnStrokeStart((stroke) => {
      this.websocket.sendStrokeStart(stroke);
    });

    this.canvas.setOnStrokePoint((strokeId, point) => {
      this.websocket.sendStrokePoint(strokeId, point);
    });

    this.canvas.setOnStrokeEnd((stroke) => {
      this.websocket.sendStrokeEnd(stroke);
    });

    this.canvas.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.canvas.getBoundingClientRect();
      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      this.websocket.sendCursorMove(point);
    });
  }

  setTool(tool) {
    this.canvas.setTool(tool);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CollaborativeCanvasApp();
});
