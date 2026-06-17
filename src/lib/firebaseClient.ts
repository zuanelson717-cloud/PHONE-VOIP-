import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const messaging = getMessaging(app);

export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, { 
                vapidKey: 'YOUR_PUBLIC_VAPID_KEY_HERE' // You must configure this in Firebase
            });
            console.log('FCM Token:', token);
            return token;
        }
    } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
    }
    return null;
};
