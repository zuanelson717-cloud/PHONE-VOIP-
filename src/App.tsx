/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Copy, Check, Users, Shield, Radio, Camera, User, Menu } from 'lucide-react';
import { useCall } from './context/CallContext';
import ringtoneFile from './context/soynoviembre-classic-phone-ringtone-439034.mp3';
import { Chat } from './components/Chat';
import { VideoStreams } from './components/VideoStreams';
import { getPersistentItem, getOrCreateUserId, safeStringify } from './lib/storage';

import { useLanguage } from './context/LanguageContext';

export default function App() {
  const { t, setLanguage, language } = useLanguage();
  const { 
    callStatus, setCallStatus, 
    joined, setJoined, 
    roomId, setRoomId, 
    socket,
    incomingOffer, setIncomingOffer,
    fcmToken, setFcmToken,
    localStream, setLocalStream, remoteStream, setRemoteStream,
    endCall, startCall, acceptCall, incomingCallMetadata, onlineUsers, peer
  } = useCall();
  const [copied, setCopied] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState('baixo');

  const initiateCall = () => {
    if (!peer) {
      alert("Conectando ao servidor de chamadas... aguarde um momento.");
      return;
    }
    
    console.log("Initiating call. targetId:", targetId);
    console.log("Number of online users:", onlineUsers.length);
    
    const user = onlineUsers.find(u => 
      u.id === targetId || 
      u.username === targetId || 
      u.peerId === targetId
    );
    
    if (!user) {
      alert(`Usuário "${targetId}" não encontrado ou não está online.`);
      return;
    }
    
    if (!user.peerId) {
      alert(`Usuário "${targetId}" encontrado, mas não possui PeerID (pode estar offline).`);
      return;
    }
    
    console.log("Calling user:", user.username, "PeerID:", user.peerId);
    startCall(user.peerId);
  };
  
  // Register FCM
  useEffect(() => {
    const registerFcm = async () => {
      const { requestNotificationPermission } = await import('./lib/firebaseClient');
      const token = await requestNotificationPermission();
      if (token) {
        setFcmToken(token);
        await fetch('/api/fcm-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: safeStringify({ userId: socket?.id, token })
        });
      }
    };
    if (socket) registerFcm();
  }, [socket]);
  
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  
  // Manage ringtone playback
  useEffect(() => {
    console.log("Call status changed to:", callStatus);
    if (callStatus === 'incoming') {
      ringtoneRef.current?.play().catch((e) => console.error("Playback error:", e instanceof Error ? e.message : String(e)));
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [callStatus]);

  // Hook up remote audio
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((e) => console.error("Remote audio playback error:", e instanceof Error ? e.message : String(e)));
    }
  }, [remoteStream]);
  
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Reset pending candidates when the call is idle/disconnected
  useEffect(() => {
    if (callStatus === 'idle') {
      pendingCandidates.current = [];
    }
  }, [callStatus]);

  // Check for room in URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, []);

  // Auto-join room
  useEffect(() => {
    if (socket && roomId && !joined) {
      const params = new URLSearchParams(window.location.search);
      const roomFromUrl = params.get('room');
      if (roomFromUrl && roomFromUrl === roomId) {
        socket.emit('join', { 
         room: roomId, 
         username: getPersistentItem('chatUsername') || 'Anonymous',
         id: getOrCreateUserId()
       });
        setJoined(true);
      }
    }
  }, [socket, roomId, joined]);


  const joinRoom = () => {
    if (socket && roomId) {
      socket.emit('join', { 
        room: roomId, 
        username: getPersistentItem('chatUsername') || t('anonymous'),
        id: getOrCreateUserId()
      });
      setJoined(true);
    }
  };

  const getShareUrl = () => {
    const base = window.location.origin + window.location.pathname;
    return `${base}?room=${encodeURIComponent(roomId || 'convite')}`;
  };

  const copyShareLink = () => {
    const url = getShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(err => {
      console.error('Falha ao copiar link de partilha:', err instanceof Error ? err.message : String(err));
    });
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-0 sm:p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-slate-950 to-slate-950">
      <Chat />
      <VideoStreams localStream={localStream} remoteStream={remoteStream} />
      {/* Phone Frame */}
      <div className="w-full h-full sm:h-auto sm:max-w-[22rem] bg-slate-900 shadow-2xl border border-slate-700/50 p-6 flex flex-col overflow-hidden sm:aspect-[9/19] sm:rounded-3xl border-slate-800">
          
          {!joined ? (
          <div className="flex flex-col gap-6 flex-grow justify-center">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-400 px-2">ID da Chamada</label>
              <input 
                placeholder="Exemplo: minha-linha-voip" 
                value={roomId} 
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-5 py-4 text-white placeholder-slate-600 outline-none transition-all font-mono text-lg"
              />
            </div>

            <button 
              onClick={joinRoom} 
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-5 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
            >
              <Users className="w-6 h-6" />
              <span>Entrar</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-10 items-center py-6 flex-grow justify-center">
            <div className="flex flex-col gap-4 text-center items-center">
              <h3 className="text-2xl font-bold text-white">Conectado: {roomId}</h3>
              <button onClick={() => setShowMenu(true)} className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
                <Menu className="w-8 h-8 text-slate-400" />
              </button>
            </div>
            
            <>{/* Simplified UI - No Video */}
              <div className="relative flex items-center justify-center py-6">
                {callStatus === 'connected' && (
                  <>
                    <div className="absolute w-44 h-44 rounded-full border border-emerald-500/10 animate-ping" />
                    <div className="absolute w-36 h-36 rounded-full border border-emerald-500/20 animate-pulse" />
                  </>
                )}
                {callStatus === 'calling' && (
                  <>
                    <div className="absolute w-44 h-44 rounded-full border border-indigo-500/10 animate-pulse" />
                    <div className="absolute w-36 h-36 rounded-full border border-indigo-500/20 animate-pulse" />
                  </>
                )}
                {callStatus === 'incoming' && (
                  <>
                    <div className="absolute w-44 h-44 rounded-full border border-amber-500/20 animate-ping" />
                    <div className="absolute w-36 h-36 rounded-full border border-amber-500/30 animate-pulse" />
                  </>
                )}
                
                <div className={`w-36 h-36 rounded-full bg-slate-950 border-4 flex items-center justify-center shadow-inner relative z-10 transition-colors duration-300 ${
                  callStatus === 'connected' ? 'border-emerald-500/60' :
                  callStatus === 'calling' ? 'border-indigo-500/60' :
                  callStatus === 'incoming' ? 'border-amber-500/60' : 'border-slate-800'
                }`}>
                  {callStatus === 'connected' ? (
                    <Phone className="w-16 h-16 text-emerald-400 animate-bounce" />
                  ) : callStatus === 'calling' ? (
                    <Phone className="w-16 h-16 text-indigo-400 animate-pulse" />
                  ) : callStatus === 'incoming' ? (
                    <Phone className="w-16 h-16 text-amber-500 animate-bounce" />
                  ) : (
                    <Users className="w-16 h-16 text-slate-500" />
                  )}
                </div>
              </div>

              <div className="text-center w-full">
                <h3 className="text-3xl font-bold text-white mt-1 break-all tracking-tight">{roomId}</h3>
                {callStatus === 'calling' && (
                  <span className="inline-block mt-4 px-5 py-2 bg-indigo-950 text-indigo-300 rounded-full text-sm border border-indigo-900/50 animate-pulse">
                    Chamando...
                  </span>
                )}
                {callStatus === 'incoming' && (
                  <span className="inline-block mt-4 px-5 py-2 bg-amber-950 text-amber-300 rounded-full text-sm border border-amber-900/50 animate-pulse">
                    Chamada recebida...
                  </span>
                )}
                {callStatus === 'connected' && (
                  <span className="inline-block mt-4 px-5 py-2 bg-emerald-950 text-emerald-300 rounded-full text-sm font-semibold border border-emerald-900/50">
                    Em Chamada VoIP Ativa
                  </span>
                )}
              </div>
            </>
          </div>
        )}

          {/* Mobile Action Buttons - Larger Touch Targets */}
          <div className="w-full mt-auto flex flex-col gap-6 px-2">
            
            {callStatus === 'calling' && (
              <button 
                onClick={() => endCall()} 
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
              >
                <PhoneOff className="w-7 h-7" />
                <span>Cancelar</span>
              </button>
            )}

            {callStatus === 'incoming' && (
              <div className="flex gap-4 w-full">
                <button 
                  onClick={() => acceptCall()} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
                >
                  <Phone className="w-7 h-7 fill-white" />
                  <span>Atender</span>
                </button>
                <button 
                  onClick={() => endCall()} 
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
                >
                  <PhoneOff className="w-7 h-7" />
                  <span>Recusar</span>
                </button>
              </div>
            )}

            {callStatus === 'connected' && (
              <button 
                onClick={() => endCall()} 
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
              >
                <PhoneOff className="w-7 h-7" />
                <span>Desligar</span>
              </button>
            )}

            <button 
              onClick={() => {
                endCall();
                setJoined(false);
              }} 
              className="w-full text-sm text-slate-500 hover:text-white transition-colors text-center"
            >
              Sair
            </button>
          </div>



          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          <audio ref={ringtoneRef} src={ringtoneFile} loop className="hidden" />
        </div>
      </div>
    );
  }
