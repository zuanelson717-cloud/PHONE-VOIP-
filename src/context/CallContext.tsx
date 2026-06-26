import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getPersistentItem, setPersistentItem, getOrCreateUserId } from '../lib/storage';
import { Peer, MediaConnection } from 'peerjs';

export interface UserPresence { username: string; id: string; room?: string; peerId?: string; }

interface CallContextType {
  callStatus: 'idle' | 'calling' | 'incoming' | 'connected';
  setCallStatus: React.Dispatch<React.SetStateAction<'idle' | 'calling' | 'incoming' | 'connected'>>;
  joined: boolean;
  setJoined: React.Dispatch<React.SetStateAction<boolean>>;
  localStream: MediaStream | null;
  setLocalStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  peerConnection: React.MutableRefObject<RTCPeerConnection | null>;
  peer: Peer | null;
  remoteStream: MediaStream | null;
  setRemoteStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  incomingCall: MediaConnection | null;
  incomingCallMetadata: any;
  startCall: (targetPeerId: string) => void;
  acceptCall: () => void;
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  socket: Socket | null;
  incomingOffer: RTCSessionDescriptionInit | null;
  setIncomingOffer: React.Dispatch<React.SetStateAction<RTCSessionDescriptionInit | null>>;
  fcmToken: string | null;
  setFcmToken: React.Dispatch<React.SetStateAction<string | null>>;
  onlineUsers: UserPresence[];
  endCall: () => void;
  syncPresence: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const incomingCallRef = useRef<MediaConnection | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const targetPeerIdRef = useRef<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [incomingCallMetadata, setIncomingCallMetadata] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  const endCall = useCallback((isRemoteTriggered: boolean = false) => {
    console.log("endCall: triggered", isRemoteTriggered, roomId);
    
    const targetPeerId = targetPeerIdRef.current;
    
    // Hangup signaling, only if we are the one initiating the hangup
    if (!isRemoteTriggered && socket) {
        console.log("endCall: emitting hangup signal to room or direct targetPeerId", { roomId, targetPeerId });
        socket.emit('signal', { 
            room: roomId || '', 
            targetPeerId: targetPeerId || undefined,
            signal: { type: 'hangup' } 
        });
    } else {
        console.log("endCall: not emitting hangup signal", { isRemoteTriggered, socket: !!socket, roomId, targetPeerId });
    }
    
    // Close active PeerJS calls
    if (activeCallRef.current) {
        console.log("endCall: closing activeCallRef");
        activeCallRef.current.close();
        activeCallRef.current = null;
    }
    targetPeerIdRef.current = null;
    if (incomingCallRef.current) {
        console.log("endCall: closing incomingCallRef");
        incomingCallRef.current.close();
        incomingCallRef.current = null;
    }
    
    // Clean up streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        setRemoteStream(null);
    }
    
    // Reset call status and references
    if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
    }
    setCallStatus('idle');
    setIncomingOffer(null);
    setIncomingCall(null);
    setIncomingCallMetadata(null);
  }, [socket, roomId, localStream, remoteStream]);

  useEffect(() => {
    if (!socket) return;
    const handleSignal = (data: any) => {
      console.log("CallContext: received signal", data);
      if (data.signal.type === 'hangup') {
        console.log("CallContext: hangup signal received, calling endCall(true)");
        endCall(true);
      }
    };
    socket.on('signal', handleSignal);
    return () => {
      socket.off('signal', handleSignal);
    };
  }, [socket, endCall]);

  useEffect(() => {
    let p: Peer | null = null;
    const initPeer = async () => {
        const userId = getOrCreateUserId();
        const uniquePeerId = `${userId}_${Math.random().toString(36).substring(2, 9)}`;
        p = new Peer(uniquePeerId, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            }
        });
        
        p.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            setPeer(p);
        });
        
        p.on('error', (err) => {
            console.error('PeerJS error:', err.message);
            if (err.type === 'unavailable-id') {
                console.log('ID taken, maybe another tab is open?');
            }
        });
        
        p.on('disconnected', () => {
            console.log('PeerJS disconnected, attempting to reconnect...');
            p?.reconnect();
        });
    };
    initPeer();

    const s = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    setSocket(s);

    s.on('users', (users: UserPresence[]) => {
      setOnlineUsers(users);
    });
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && s.disconnected) {
        console.log("Tab is visible again, reconnecting socket...");
        s.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => { 
      if (p) p.destroy();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      s.close(); 
    };
  }, []);

  const syncPresence = () => {
    if (!socket || !peer || !peer.id) return;
    const username = getPersistentItem('chatUsername') || '';
    const userId = getOrCreateUserId();
    console.log('syncPresence: syncing presence with peerId:', peer.id);
    socket.emit('join', {
      room: joined ? roomId : '',
      username,
      id: userId,
      peerId: peer.id // Send the uniquely generated PeerJS ID
    });
  };

  useEffect(() => {
    syncPresence();
  }, [socket, joined, roomId, peer]);

  const startCall = async (targetPeerId: string) => {
    console.log("startCall: initiating call to", targetPeerId);
    if (!peer) {
      alert("PeerJS ainda não inicializado. Tente novamente em instantes.");
      return;
    }
    
    try {
      console.log("startCall: requesting media.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setLocalStream(stream);
      
      console.log("startCall: calling peer", targetPeerId);
      const call = peer.call(targetPeerId, stream, { metadata: { isVideo: false } });
      
      if (!call) {
        console.error("startCall: call object is null!");
        return;
      }
      
      console.log("startCall: call object created, peer:", call.peer);
      activeCallRef.current = call;
      targetPeerIdRef.current = targetPeerId;
      
      call.on('close', () => { console.log("startCall: call closed"); endCall(true); });
      setCallStatus('calling');
      
      call.on('stream', (stream) => {
        console.log("startCall: received remote stream");
        setRemoteStream(stream);
        setCallStatus('connected');
      });
            call.on('error', (err) => {
        console.error('startCall: Call error', err.message);
        alert(`Erro na chamada: ${err.message}`);
        endCall(true);
      });
      
    } catch (err) {
      console.error("startCall: error", err instanceof Error ? err.message : String(err));
      alert("Erro ao iniciar chamada: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const acceptCall = async () => {
    const call = incomingCallRef.current;
    if (!call) {
      console.error("acceptCall: no incoming call found");
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      setLocalStream(stream);
      
      call.answer(stream);
      
      activeCallRef.current = call;
      targetPeerIdRef.current = call.peer;
      call.on('close', () => { endCall(true); });
      
      call.on('stream', (stream: MediaStream) => {
        setRemoteStream(stream);
        setCallStatus('connected');
      });
      
      call.on('error', (err) => {
        console.error('acceptCall: Accepted call error', err.message);
        alert(`Erro na chamada (aceita): ${err.message}`);
        endCall(true);
      });
      
      setIncomingCall(null);
      incomingCallRef.current = null;
      setIncomingCallMetadata(null);
    } catch (err) {
      console.error("acceptCall: error", err instanceof Error ? err.message : String(err));
      alert("Erro ao aceitar chamada: " + (err instanceof Error ? err.message : String(err)));
      endCall(true);
    }
  };

  useEffect(() => {
    if (!peer) return;
    peer.on('call', (call) => {
        console.log('Incoming call detected from peer:', call.peer);
        incomingCallRef.current = call;
        setIncomingCall(call);
        setIncomingCallMetadata(call.metadata);
        targetPeerIdRef.current = call.peer;
        setCallStatus('incoming');
    });
  }, [peer]);

  return (
    <CallContext.Provider value={{
      callStatus, setCallStatus,
      joined, setJoined,
      localStream, setLocalStream,
      peerConnection,
      peer,
      remoteStream, setRemoteStream, incomingCall, incomingCallMetadata, startCall, acceptCall,
      roomId, setRoomId,
      socket,
      onlineUsers,
      incomingOffer, setIncomingOffer,
      fcmToken, setFcmToken,
      endCall,
      syncPresence
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
