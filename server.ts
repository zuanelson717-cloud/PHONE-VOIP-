import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createServer } from "http";
import { Server } from "socket.io";

const __dirname = process.cwd();

// Firebase
initializeApp();
const db = getFirestore(getApp());
const messaging = getMessaging(getApp());

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

    socket.on("call", async (data) => {
      try {
        // Notificar o outro utilizador via FCM
        const targetUserDoc = await db
          .collection("fcmTokens")
          .doc(data.targetUserId)
          .get();

        if (targetUserDoc.exists) {
          const token = targetUserDoc.data()?.token;

          if (token) {
            await messaging.send({
              token,
              notification: {
                title: "Nova Chamada VoIP",
                body: `Chamada recebida da sala: ${data.room}`,
              },
              data: {
                type: "CALL",
                room: data.room,
              },
            });
          }
        }
      } catch (error) {
        console.error("Erro ao enviar FCM:", error);
      }

      socket.to(data.room).emit("call", data);
    });

    socket.on("signal", (data) => {
      socket.to(data.room).emit("signal", {
        senderId: socket.id,
        signal: data.signal,
      });
    });
  });

  // Guardar token FCM
  app.post("/api/fcm-token", async (req, res) => {
    try {
      const { userId, token } = req.body;

      await db.collection("fcmTokens").doc(userId).set({
        token,
      });

      res.status(200).send("Token saved");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error saving token");
    }
  });

  // Utilizadores
  app.get("/api/users", async (req, res) => {
    try {
      const snapshot = await db.collection("users").get();
      const users = snapshot.docs.map((doc) => doc.data());
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
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