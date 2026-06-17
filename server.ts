import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, applicationDefault, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createServer } from "http";
import { Server } from "socket.io";

const __dirname = process.cwd();

// Firebase
initializeApp({
  credential: applicationDefault()
});

const db = getFirestore(getApp());
const messaging = getMessaging(getApp());

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  io.on("connection", (socket) => {
    socket.on("join", (room) => {
      socket.join(room);
    });

    socket.on("call", async (data) => {
      try {
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
        console.error("Erro FCM:", error);
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

  app.post("/api/fcm-token", async (req, res) => {
    const { userId, token } = req.body;
    await db.collection("fcmTokens").doc(userId).set({ token });
    res.status(200).send("Token saved");
  });

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