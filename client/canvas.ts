export interface Point {
  x: number;
  y: number;
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

export class DrawingCanvas {
  private canvas: HTMLCanvasElement;
  private cursorCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cursorCtx: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private currentStroke: Stroke | null = null;
  private state: DrawingState = { strokes: [], redoStack: [] };

  // Tool settings
  private currentTool: "brush" | "eraser" = "brush";
  private currentColor: string = "#000000";
  private currentWidth: number = 5;

  // Callbacks
  private onStrokeStart?: (stroke: Stroke) => void;
  private onStrokePoint?: (strokeId: string, point: Point) => void;
  private onStrokeEnd?: (stroke: Stroke) => void;

  constructor(canvasId: string, cursorCanvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.cursorCanvas = document.getElementById(
      cursorCanvasId
    ) as HTMLCanvasElement;

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

  private setupEventListeners(): void {
    window.addEventListener("resize", () => this.resizeCanvas());

    // Mouse events
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseout", this.handleMouseUp.bind(this));

    // Touch events
    this.canvas.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this)
    );
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));
  }

  private resizeCanvas(): void {
    const container = this.canvas.parentElement!;
    const rect = container.getBoundingClientRect();

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    this.cursorCanvas.width = rect.width;
    this.cursorCanvas.height = rect.height;

    this.redraw();
  }

  private getCanvasPoint(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.startDrawing(this.getCanvasPoint(e.clientX, e.clientY));
  }

  private handleMouseMove(e: MouseEvent): void {
    const point = this.getCanvasPoint(e.clientX, e.clientY);
    this.updateDrawing(point);
  }

  private handleMouseUp(e: MouseEvent): void {
    this.endDrawing();
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.startDrawing(this.getCanvasPoint(touch.clientX, touch.clientY));
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1 && this.isDrawing) {
      const touch = e.touches[0];
      this.updateDrawing(this.getCanvasPoint(touch.clientX, touch.clientY));
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    this.endDrawing();
  }

  private startDrawing(point: Point): void {
    this.isDrawing = true;

    this.currentStroke = {
      id: Math.random().toString(36).substr(2, 9),
      userId: "local", // Will be set by WebSocket manager
      points: [point],
      color: this.currentColor,
      width: this.currentWidth,
      tool: this.currentTool,
      timestamp: Date.now(),
    };

    this.onStrokeStart?.(this.currentStroke);
    this.drawPoint(this.currentStroke, point);
  }

  private updateDrawing(point: Point): void {
    if (!this.isDrawing || !this.currentStroke) return;

    this.currentStroke.points.push(point);
    this.onStrokePoint?.(this.currentStroke.id, point);

    // Draw locally for immediate feedback
    this.drawPoint(this.currentStroke, point);
  }

  private endDrawing(): void {
    if (!this.isDrawing || !this.currentStroke) return;

    this.isDrawing = false;

    if (this.currentStroke.points.length > 1) {
      this.state.strokes.push(this.currentStroke);
      this.state.redoStack = []; // Clear redo stack on new action
      this.onStrokeEnd?.(this.currentStroke);
    }

    this.currentStroke = null;
  }

  private drawPoint(stroke: Stroke, point: Point): void {
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    this.ctx.strokeStyle =
      stroke.tool === "eraser" ? "rgba(0,0,0,1)" : stroke.color;
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

  public redraw(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Redraw all strokes
    this.state.strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      this.ctx.globalCompositeOperation =
        stroke.tool === "eraser" ? "destination-out" : "source-over";
      this.ctx.strokeStyle =
        stroke.tool === "eraser" ? "rgba(0,0,0,1)" : stroke.color;
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

  // Public methods
  public setTool(tool: "brush" | "eraser"): void {
    this.currentTool = tool;
  }

  public setColor(color: string): void {
    this.currentColor = color;
  }

  public setWidth(width: number): void {
    this.currentWidth = width;
  }

  public addRemoteStroke(stroke: Stroke): void {
    this.state.strokes.push(stroke);
    this.redraw();
  }

  public undo(): Stroke | null {
    if (this.state.strokes.length === 0) return null;

    const stroke = this.state.strokes.pop()!;
    this.state.redoStack.push(stroke);
    this.redraw();

    return stroke;
  }

  public redo(): Stroke | null {
    if (this.state.redoStack.length === 0) return null;

    const stroke = this.state.redoStack.pop()!;
    this.state.strokes.push(stroke);
    this.redraw();

    return stroke;
  }

  public clear(): void {
    this.state.strokes = [];
    this.state.redoStack = [];
    this.redraw();
  }

  // Callback setters
  public setOnStrokeStart(callback: (stroke: Stroke) => void): void {
    this.onStrokeStart = callback;
  }

  public setOnStrokePoint(
    callback: (strokeId: string, point: Point) => void
  ): void {
    this.onStrokePoint = callback;
  }

  public setOnStrokeEnd(callback: (stroke: Stroke) => void): void {
    this.onStrokeEnd = callback;
  }

  public getState(): DrawingState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public setState(state: DrawingState): void {
    this.state = state;
    this.redraw();
  }
}
