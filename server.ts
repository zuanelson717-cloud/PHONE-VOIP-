import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from './firebase-applet-config.json';
import { createServer } from "http";
import { Server } from "socket.io";

const __dirname = process.cwd();

// Firebase
initializeApp();
const db = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Socket.io (VoIP signaling)
  io.on("connection", (socket) => {
    socket.on("join", (room) => {
      socket.join(room);
    });

    socket.on("signal", (data) => {
      socket.to(data.room).emit("signal", {
        senderId: socket.id,
        signal: data.signal,
      });
    });
  });

  // API
  app.get("/api/users", async (req, res) => {
    try {
      const snapshot = await db.collection("users").get();
      const users = snapshot.docs.map((doc) => doc.data());
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json([]);
    }
  });

  // Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();