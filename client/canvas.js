export class DrawingCanvas {
  constructor(canvasId, cursorCanvasId) {
    this.isDrawing = false;
    this.currentStroke = null;
    this.state = { strokes: [], redoStack: [] };
    this.currentTool = "brush";
    this.currentColor = "#000000";
    this.currentWidth = 5;
    this.onStrokeStart = undefined;
    this.onStrokePoint = undefined;
    this.onStrokeEnd = undefined;

    this.canvas = document.getElementById(canvasId);
    this.cursorCanvas = document.getElementById(cursorCanvasId);

    const ctx = this.canvas.getContext("2d");
    const cursorCtx = this.cursorCanvas.getContext("2d");

    if (!ctx || !cursorCtx) {
      throw new Error("Could not get canvas context");
    }

    this.ctx = ctx;
    this.cursorCtx = cursorCtx;

    this.setupEventListeners();
    this.resizeCanvas();
  }

  setupEventListeners() {
    window.addEventListener("resize", () => this.resizeCanvas());

    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseout", this.handleMouseUp.bind(this));

    this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this));
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    this.cursorCanvas.width = rect.width;
    this.cursorCanvas.height = rect.height;

    this.redraw();
  }

  getCanvasPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  handleMouseDown(e) {
    e.preventDefault();
    this.startDrawing(this.getCanvasPoint(e.clientX, e.clientY));
  }

  handleMouseMove(e) {
    const point = this.getCanvasPoint(e.clientX, e.clientY);
    this.updateDrawing(point);
  }

  handleMouseUp() {
    this.endDrawing();
  }

  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.startDrawing(this.getCanvasPoint(touch.clientX, touch.clientY));
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && this.isDrawing) {
      const touch = e.touches[0];
      this.updateDrawing(this.getCanvasPoint(touch.clientX, touch.clientY));
    }
  }

  handleTouchEnd() {
    this.endDrawing();
  }

  startDrawing(point) {
    this.isDrawing = true;

    this.currentStroke = {
      id: Math.random().toString(36).substr(2, 9),
      userId: "local",
      points: [point],
      color: this.currentColor,
      width: this.currentWidth,
      tool: this.currentTool,
      timestamp: Date.now(),
    };

    this.onStrokeStart?.(this.currentStroke);
    this.drawPoint(this.currentStroke, point);
  }

  updateDrawing(point) {
    if (!this.isDrawing || !this.currentStroke) return;

    this.currentStroke.points.push(point);
    this.onStrokePoint?.(this.currentStroke.id, point);
    this.drawPoint(this.currentStroke, point);
  }

  endDrawing() {
    if (!this.isDrawing || !this.currentStroke) return;

    this.isDrawing = false;

    if (this.currentStroke.points.length > 1) {
      this.state.strokes.push(this.currentStroke);
      this.state.redoStack = [];
      this.onStrokeEnd?.(this.currentStroke);
    }

    this.currentStroke = null;
  }

  drawPoint(stroke, point) {
    this.ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    this.ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : stroke.color;
    this.ctx.lineWidth = stroke.width;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    const points = stroke.points;
    if (points.length === 1) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
    }
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.state.strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      this.ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      this.ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : stroke.color;
      this.ctx.lineWidth = stroke.width;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";

      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      this.ctx.stroke();
    });
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.currentColor = color;
  }

  setWidth(width) {
    this.currentWidth = width;
  }

  addRemoteStroke(stroke) {
    this.state.strokes.push(stroke);
    this.redraw();
  }

  undo() {
    if (this.state.strokes.length === 0) return null;

    const stroke = this.state.strokes.pop();
    this.state.redoStack.push(stroke);
    this.redraw();

    return stroke;
  }

  redo() {
    if (this.state.redoStack.length === 0) return null;

    const stroke = this.state.redoStack.pop();
    this.state.strokes.push(stroke);
    this.redraw();

    return stroke;
  }

  clear() {
    this.state.strokes = [];
    this.state.redoStack = [];
    this.redraw();
  }

  setOnStrokeStart(callback) {
    this.onStrokeStart = callback;
  }

  setOnStrokePoint(callback) {
    this.onStrokePoint = callback;
  }

  setOnStrokeEnd(callback) {
    this.onStrokeEnd = callback;
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  setState(state) {
    this.state = state;
    this.redraw();
  }
}
