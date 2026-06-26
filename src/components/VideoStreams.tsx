import React, { useRef, useEffect } from 'react';

interface VideoStreamsProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export const VideoStreams: React.FC<VideoStreamsProps> = ({ localStream, remoteStream }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("Setting local stream");
      localVideoRef.current.srcObject = localStream;
    } else {
      console.log("Local stream or ref missing", "hasRef:", !!localVideoRef.current, "hasStream:", !!localStream);
    }
    if (remoteVideoRef.current && remoteStream) {
      console.log("Setting remote stream");
      remoteVideoRef.current.srcObject = remoteStream;
    } else {
      console.log("Remote stream or ref missing", "hasRef:", !!remoteVideoRef.current, "hasStream:", !!remoteStream);
    }
  }, [localStream, remoteStream]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full h-full bg-slate-950 rounded-3xl overflow-hidden p-2">
      <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
         <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
         <span className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">Você</span>
      </div>
      <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
         <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
         {!remoteStream && <div className="absolute inset-0 flex items-center justify-center text-slate-500">Aguardando...</div>}
         <span className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">Destinatário</span>
      </div>
    </div>
  );
};
