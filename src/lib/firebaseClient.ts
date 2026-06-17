import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const vapidKey = "BA9vL_4N_M3NO1wZyuAH9tR8qdsvlg0fX5YFf8LJAL0u3kezUelSb4Sr8ArrjUuE2BKZhfZIUNYjEr-5hUYosNU";

export const requestPermission = async () => {
  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    const token = await getToken(messaging, { vapidKey });
    console.log("FCM Token:", token);
    return token;
  }
};

export const listenMessages = () => {
  onMessage(messaging, (payload) => {
    console.log("Notificação recebida:", payload);

    const audio = new Audio("/ringtone.mp3");
    audio.loop = true;

    audio.play().catch(() => {
      console.log("Áudio bloqueado até interação do utilizador");
    });
  });
};