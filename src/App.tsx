/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Copy, Check, Users, Shield, Radio } from 'lucide-react';
import { useCall } from './context/CallContext';
import ringtoneFile from './context/soynoviembre-classic-phone-ringtone-439034.mp3';
import { Chat } from './components/Chat';
import { BottomMenu } from './components/BottomMenu';

export default function App() {
  const { 
    callStatus, setCallStatus, 
    joined, setJoined, 
    roomId, setRoomId, 
    socket,
    incomingOffer, setIncomingOffer,
    fcmToken, setFcmToken,
    localStream, peerConnection,
    endCall 
  } = useCall();
  const [copied, setCopied] = useState(false);
  
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
          body: JSON.stringify({ userId: socket?.id, token })
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
      ringtoneRef.current?.play().catch((e) => console.error("Playback error:", e));
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [callStatus]);
  
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

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
        socket.emit('join', roomId);
        setJoined(true);
      }
    }
  }, [socket, roomId, joined]);

  const initPC = () => {
    const pc = new RTCPeerConnection({ 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ] 
    });
    
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket?.emit('signal', { room: roomIdRef.current, signal: { candidate: e.candidate } });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handleRemoteHangup();
      }
    };
    
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch(console.warn);
      }
    };
    
    peerConnection.current = pc;
    return pc;
  };

  const startCall = async () => {
    try {
      // 1. Get user mic access with high-quality constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      localStream.current = stream;
      
      // 2. Setup connection
      const pc = initPC();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 3. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // 4. Send signal
      socket?.emit('signal', { room: roomIdRef.current, signal: { offer } });
      setCallStatus('calling');
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Erro ao acessar microfone. Certifique-se de dar permissão.");
    }
  };

  const handleRemoteHangup = () => {
    endCall();
  };

  const answerCall = async () => {
    if (!incomingOffer || !peerConnection.current) return;
    try {
      // 1. Get local mic stream for communication with high-quality constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      localStream.current = stream;
      
      const pc = peerConnection.current;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      // 2. Create reaction answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // 3. Send answer to the calling peer
      socket?.emit('signal', { room: roomIdRef.current, signal: { answer } });
      setCallStatus('connected');
    } catch (err) {
      console.error("Erro ao atender chamada:", err);
      alert("Erro ao acessar microfone para atender a chamada.");
    }
  };

  const joinRoom = () => {
    if (socket && roomId) {
      socket.emit('join', roomId);
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
      console.error('Falha ao copiar link de partilha:', err);
    });
  };

  // Signal processing hook
  useEffect(() => {
    if (socket) {
      socket.on('signal', async (data) => {
        const { signal } = data;
        
        if (signal.offer) {
          console.log("Incoming call offer received from remote device");
          setIncomingOffer(signal.offer);
          setCallStatus('incoming');
          
          try {
            // Instantly setup peer connection ready to receive ICE candidates
            const pc = initPC();
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
            
            // Instantly apply any pending ICE candidates received before remote description was ready
            console.log(`Applying ${pendingCandidates.current.length} queued ICE candidates`);
            for (const candidate of pendingCandidates.current) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
            }
            pendingCandidates.current = [];
          } catch (e) {
            console.error("Failed to initialize remote offer SDP:", e);
          }
        } else if (signal.answer) {
          console.log("Callee accepted the call, setting answer description");
          const pc = peerConnection.current;
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
            setCallStatus('connected');
            
            // Consume remaining candidates
            for (const candidate of pendingCandidates.current) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
            }
            pendingCandidates.current = [];
          }
        } else if (signal.candidate) {
          const candidate = new RTCIceCandidate(signal.candidate);
          const pc = peerConnection.current;
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(candidate).catch(e => console.warn("Failed directly set candidate:", e));
          } else {
            // Queue up candidate until Peer Connection is ready
            pendingCandidates.current.push(signal.candidate);
          }
        } else if (signal.type === 'hangup') {
          console.log("Remote peer hung up or declined");
          handleRemoteHangup();
        }
      });
    }
  }, [socket]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-2 sm:p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-slate-950 to-slate-950">
      <Chat />
      <BottomMenu />
      {/* Phone Frame */}
      <div className="w-full max-w-[22rem] bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-700/50 p-6 flex flex-col overflow-hidden h-[85vh] sm:h-auto sm:aspect-[9/19] sm:rounded-3xl border-slate-800">
        
        {/* Top Header Badge - Mobile refined */}
        <div className="flex items-center justify-between mb-10 mt-2">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-white">VoIP IPPhone</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-950 px-3 py-1 rounded-full text-xs text-slate-400 border border-slate-800">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encriptado</span>
          </div>
        </div>

        {!joined ? (
          <div className="flex flex-col gap-6 flex-grow justify-center">
            <div className="text-center mb-4 pt-10">
              <h2 className="text-2xl font-semibold text-white">Iniciar Chamada</h2>
              <p className="text-sm text-slate-400 mt-2 px-4">
                Digite um ID de quarto para conectar-se em tempo real.
              </p>
            </div>

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
              disabled={!roomId}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold py-5 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
            >
              <Users className="w-6 h-6" />
              <span>Entrar no Canal</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-10 items-center py-6 flex-grow justify-center">
            
            {/* Visual Ring - Larger for Mobile */}
            <div className="relative flex items-center justify-center">
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
              
              {callStatus === 'idle' && (
                <span className="inline-block mt-4 px-5 py-2 bg-slate-950 rounded-full text-sm text-slate-400 border border-slate-800">
                  Pronto para ligar
                </span>
              )}
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

            {/* Mobile Action Buttons - Larger Touch Targets */}
            <div className="w-full mt-auto flex flex-col gap-6 px-2">
              {callStatus === 'idle' && (
                <button 
                  onClick={startCall} 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
                >
                  <Phone className="w-7 h-7 fill-white" />
                  <span>Iniciar</span>
                </button>
              )}
              
              {callStatus === 'calling' && (
                <button 
                  onClick={endCall} 
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
                >
                  <PhoneOff className="w-7 h-7" />
                  <span>Cancelar</span>
                </button>
              )}

              {callStatus === 'incoming' && (
                <div className="flex gap-4 w-full">
                  <button 
                    onClick={answerCall} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
                  >
                    <Phone className="w-7 h-7 fill-white" />
                    <span>Atender</span>
                  </button>
                  <button 
                    onClick={endCall} 
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-3xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-4 text-xl"
                  >
                    <PhoneOff className="w-7 h-7" />
                    <span>Recusar</span>
                  </button>
                </div>
              )}

              {callStatus === 'connected' && (
                <button 
                  onClick={endCall} 
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
          </div>
        )}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <audio ref={ringtoneRef} src={ringtoneFile} loop className="hidden" />
      </div>
    </div>
  );
}
