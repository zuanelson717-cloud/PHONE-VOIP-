import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';
import { initializeApp, applicationDefault, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from './firebase-applet-config.json';
import { createServer } from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
initializeApp({
  credential: applicationDefault()
});
const db = getFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
const messaging = getMessaging(getApp());

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  
  const PORT = 3000;

  app.use(express.json());

  // Socket.io for WebRTC signaling
  const globalUsers = new Map<string, { username: string; id: string; room: string; peerId?: string }>(); // socketId -> { username, id, room, peerId }

  io.on('connection', (socket) => {
    socket.on('join', ({ room, username, id, peerId }) => {
      socket.join(room);
      (socket as any).room = room;
      globalUsers.set(socket.id, { username, id, room, peerId });
      io.emit('users', Array.from(globalUsers.values()));
    });

    socket.on('disconnect', () => {
      if (globalUsers.has(socket.id)) {
        globalUsers.delete(socket.id);
        io.emit('users', Array.from(globalUsers.values()));
      }
    });

    socket.on('call', async (data) => {
      // Notify other user in the room via FCM
      const targetUserDoc = await db.collection('fcmTokens').doc(data.targetUserId).get();
      if (targetUserDoc.exists) {
        const token = targetUserDoc.data()?.token;
        if (token) {
          await messaging.send({
            token: token,
            notification: {
              title: 'Nova Chamada VoIP',
              body: `Chamada recebida do quarto: ${data.room}`
            },
            data: {
              type: 'CALL',
              room: data.room
            }
          });
        }
      }
      socket.to(data.room).emit('call', data);
    });

    socket.on('signal', (data) => {
      if (data.targetPeerId) {
        let targetSocketId: string | null = null;
        for (const [sId, u] of globalUsers.entries()) {
          if (u.peerId === data.targetPeerId) {
            targetSocketId = sId;
            break;
          }
        }
        if (targetSocketId) {
          io.to(targetSocketId).emit('signal', {
            senderId: socket.id,
            signal: data.signal
          });
          return;
        }
      }
      if (data.room) {
        socket.to(data.room).emit('signal', {
          senderId: socket.id,
          signal: data.signal
        });
      }
    });
  });

  // API routes
  app.post("/api/fcm-token", async (req, res) => {
    const { userId, token } = req.body;
    await db.collection('fcmTokens').doc(userId).set({ token });
    res.status(200).send('Token saved');
  });

  app.get("/api/users", async (req, res) => {
    try {
      const snapshot = await db.collection('users').get();
      const users = snapshot.docs.map(doc => doc.data());
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json([]);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
