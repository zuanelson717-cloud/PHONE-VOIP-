import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface CallContextType {
  callStatus: 'idle' | 'calling' | 'incoming' | 'connected';
  setCallStatus: React.Dispatch<React.SetStateAction<'idle' | 'calling' | 'incoming' | 'connected'>>;
  joined: boolean;
  setJoined: React.Dispatch<React.SetStateAction<boolean>>;
  localStream: React.MutableRefObject<MediaStream | null>;
  peerConnection: React.MutableRefObject<RTCPeerConnection | null>;
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  socket: Socket | null;
  incomingOffer: RTCSessionDescriptionInit | null;
  setIncomingOffer: React.Dispatch<React.SetStateAction<RTCSessionDescriptionInit | null>>;
  fcmToken: string | null;
  setFcmToken: React.Dispatch<React.SetStateAction<string | null>>;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const s = io();
    setSocket(s);
    return () => { s.close(); };
  }, []);

  const endCall = () => {
    if (socket && roomId) {
        socket.emit('signal', { room: roomId, signal: { type: 'hangup' } });
    }
    if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
    }
    if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
    }
    setCallStatus('idle');
    setIncomingOffer(null);
  };

  return (
    <CallContext.Provider value={{
      callStatus, setCallStatus,
      joined, setJoined,
      localStream,
      peerConnection,
      roomId, setRoomId,
      socket,
      incomingOffer, setIncomingOffer,
      fcmToken, setFcmToken,
      endCall
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};
