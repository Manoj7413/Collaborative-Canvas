import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { RoomManager } from "./rooms.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const roomManager = new RoomManager();

// Serve static files from client directory
app.use(express.static(path.join(__dirname, "../dist/client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/client/index.html"));
});

app.get("/api/rooms/:roomId/stats", (req, res) => {
  const roomId = req.params.roomId;
  const stats = roomManager.getRoomStats(roomId);
  if (stats) {
    res.json(stats);
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Generate a random color and name for the user
  const userColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
  const userName = `User${Math.floor(Math.random() * 1000)}`;

  socket.on("join-room", (roomId: string) => {
    console.log(`User ${socket.id} joining room: ${roomId}`);
    roomManager.joinRoom(socket.id, roomId, userColor, userName);

    const roomUsers = roomManager.getRoomUsers(roomId);
    socket.join(roomId);

    // Send current users to the new user
    socket.emit("user-joined", roomUsers);

    // Notify other users
    socket.to(roomId).emit("user-joined", roomUsers);

    // Send current canvas state
    const roomState = roomManager.getRoomState(roomId);
    socket.emit("full-state", roomState);

    console.log(`Room ${roomId} now has ${roomUsers.length} users`);
  });

  socket.on("stroke-start", (stroke) => {
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      stroke.userId = socket.id;
      roomManager.addStroke(roomId, stroke);
      socket.to(roomId).emit("stroke-start", stroke);
    }
  });

  socket.on("stroke-point", (data) => {
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      socket.to(roomId).emit("stroke-point", {
        ...data,
        userId: socket.id,
      });
    }
  });

  socket.on("stroke-end", (stroke) => {
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      stroke.userId = socket.id;
      roomManager.addStroke(roomId, stroke);
      socket.to(roomId).emit("stroke-end", stroke);
    }
  });

  socket.on("undo", (strokeId) => {
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      roomManager.undo(roomId, socket.id);
      socket.to(roomId).emit("undo", strokeId);
    }
  });

  socket.on("redo", (strokeId) => {
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      roomManager.redo(roomId, socket.id);
      socket.to(roomId).emit("redo", strokeId);
    }
  });

  socket.on("clear", () => {
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      roomManager.clearRoom(roomId, socket.id);
      socket.to(roomId).emit("clear");
    }
  });

  socket.on("cursor-move", (point) => {
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      socket.to(roomId).emit("cursor-move", {
        userId: socket.id,
        ...point,
      });
    }
  });

  socket.on("ping", (callback) => {
    callback(Date.now());
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    const roomId = roomManager.getUserRoom(socket.id);
    if (roomId) {
      roomManager.leaveRoom(socket.id);
      socket.to(roomId).emit("user-left", socket.id);

      const remainingUsers = roomManager.getRoomUsers(roomId);
      console.log(`Room ${roomId} now has ${remainingUsers.length} users`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to view the app`);
});
