import React, { useState, useEffect, useContext } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useCall } from '../context/CallContext';
import { LanguageContext } from '../context/LanguageContext';
import { getPersistentItem, setPersistentItem, safeStringify } from '../lib/storage';

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: number;
  room?: string;
}


export const Chat = () => {
    const { t } = useContext(LanguageContext);
    const { roomId, onlineUsers, joined, syncPresence, startCall, endCall, acceptCall, callStatus, localStream, remoteStream, incomingCallMetadata } = useCall();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sender, setSender] = useState(() => getPersistentItem('chatUsername') || '');
    const [isOpen, setIsOpen] = useState(false);
    const [isSettingName, setIsSettingName] = useState(!getPersistentItem('chatUsername'));

    const handleSenderChange = (val: string) => {
        setSender(val);
        setPersistentItem('chatUsername', val);
    };

    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => new Set(JSON.parse(getPersistentItem('hiddenMessages') || '[]')));
    const [error, setError] = useState('');

    const handleSetName = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sender.trim()) return;
        const isDuplicate = onlineUsers.some(u => u.username === sender && u.id !== getPersistentItem('chatUserId'));
        if (isDuplicate) {
            setError(t('user_exists'));
            return;
        }
        setError('');
        setPersistentItem('chatUsername', sender);
        setIsSettingName(false);
        syncPresence();
    };

    useEffect(() => {
        const q = query(collection(db, 'chatMessages'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
        });
        return () => unsubscribe();
    }, []);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !sender.trim()) return;
        
        await addDoc(collection(db, 'chatMessages'), {
            text: newMessage,
            sender,
            createdAt: Date.now(),
            room: roomId || ''
        });
        setNewMessage('');
    };

    const handleSelectAll = () => {
        if (selectedIds.size === visibleMessages.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleMessages.map(m => m.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const deleteSelected = () => {
        const newHidden = new Set(hiddenMessageIds);
        selectedIds.forEach(id => newHidden.add(id));
        setHiddenMessageIds(newHidden);
        setPersistentItem('hiddenMessages', safeStringify(Array.from(newHidden)));
        setSelectedIds(new Set());
        setIsSelecting(false);
    };

    const visibleMessages = messages.filter(m => !hiddenMessageIds.has(m.id));

    if (!isOpen) {
        return (
            <button 
                onClick={() => {
                    setIsOpen(true);
                    setIsSettingName(true);
                }}
                className="fixed bottom-4 right-4 bg-cyan-600 text-slate-950 p-3 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] z-50 transition-transform hover:scale-105"
            >
                Chat
            </button>
        );
    }

    if (isSettingName) {
        const hasExistingName = !!getPersistentItem('chatUsername');
        return (
            <div className="fixed bottom-4 right-4 w-80 bg-slate-900 border border-cyan-500 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] z-50 p-4 font-mono">
                <h3 className="font-bold mb-2 text-cyan-300">{t('set_name')}</h3>
                <form onSubmit={handleSetName} className="flex flex-col gap-2">
                    <input
                        value={sender}
                        onChange={(e) => {
                            handleSenderChange(e.target.value);
                            setError('');
                        }}
                        className="w-full bg-slate-950 border border-cyan-700 rounded p-2 text-sm outline-none text-cyan-100"
                        placeholder={t('enter_name')}
                    />
                    {error && <p className="text-red-500 text-xs">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        {hasExistingName && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSender(getPersistentItem('chatUsername'));
                                    setIsSettingName(false);
                                }}
                                className="bg-slate-700 text-slate-200 px-3 py-1 rounded text-sm hover:bg-slate-600 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                        )}
                        <button type="submit" className="bg-cyan-600 text-slate-950 font-bold px-3 py-1 rounded text-sm hover:bg-cyan-500 transition-colors">{t('save')}</button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-80 bg-slate-900 border border-cyan-500 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] z-50 flex flex-col h-[400px] overflow-hidden font-mono">
            <div className="p-3 border-b border-cyan-500 flex justify-between items-center bg-slate-800 rounded-t-xl">
                <h3 className="font-bold text-cyan-300 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        {joined ? (
                            <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </>
                        ) : (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        )}
                    </span>
                    {t('chat')}
                </h3>
                <div className="flex gap-2">
                  {isSelecting && (
                    <button onClick={handleSelectAll} className="text-cyan-500 hover:text-cyan-300 text-xs">
                      {selectedIds.size === visibleMessages.length ? 'Unselect All' : 'Select All'}
                    </button>
                  )}
                  <button 
                    onClick={() => isSelecting ? deleteSelected() : setIsSelecting(true)} 
                    className={`${isSelecting ? 'bg-red-900 text-red-100 px-2 py-1' : 'text-cyan-500'} hover:text-cyan-300 text-xs rounded`}
                  >
                    {isSelecting ? t('delete_selected') : t('select')}
                  </button>
                  {isSelecting && <button onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }} className="text-cyan-500 hover:text-cyan-300 text-xs">{t('cancel')}</button>}
                  <button onClick={() => setIsOpen(false)} className="text-cyan-500 hover:text-cyan-300">{t('close')}</button>
                </div>
            </div>
            <div className="px-3 py-1.5 bg-slate-850 border-b border-cyan-800 text-xs text-cyan-300 flex justify-between items-center gap-2">
                <span className="truncate">Nome: <strong className="text-cyan-100">{sender}</strong></span>
                <button 
                    onClick={() => setIsSettingName(true)} 
                    className="text-[10px] bg-cyan-950 border border-cyan-700 text-cyan-300 px-1.5 py-0.5 rounded hover:bg-cyan-900 transition-colors"
                >
                    {t('change_name')}
                </button>
            </div>
            <div className="px-3 py-1 bg-slate-800 border-b border-cyan-700 text-[10px] text-cyan-300 flex flex-wrap gap-2">
                <span>Usuários:</span>
                {onlineUsers.map((user, index) => {
                    const hasRoom = user.room && user.room.trim() !== '';
                    return (
                        <span key={`${user.id}-${index}`} className="flex items-center gap-1 mr-1">
                            {hasRoom ? (
                                <>
                                    <span className="text-green-500">🟢</span>
                                    <span>{user.username}</span>
                                    <div className="flex items-center gap-1 ml-1">
                                        <button
                                            onClick={() => startCall(user.peerId)}
                                            className="text-[10px] bg-emerald-900 text-emerald-100 px-1 py-0.5 rounded hover:bg-emerald-800"
                                        >
                                            Ligar
                                        </button>
                                        <span className="text-[9px] text-cyan-600 font-mono">ID: {user.room}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className="text-red-500">🔴</span>
                                    <span>{user.username}</span>
                                </>
                            )}
                        </span>
                    );
                })}
            </div>
            <div className="flex-1 overflow-y-auto p-3 bg-slate-950 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-slate-900">
                {visibleMessages.map((msg, index) => {
                    const senderUser = onlineUsers.find(u => u.username === msg.sender);
                    const isOnline = senderUser && senderUser.room && senderUser.room.trim() !== '';
                    return (
                        <div key={`${msg.id}-${index}`} className="mb-2 text-sm flex items-start gap-2">
                            {isSelecting && (
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.has(msg.id)}
                                    onChange={() => toggleSelect(msg.id)}
                                    className="mt-1"
                                />
                            )}
                            <div>
                                <span className="font-semibold text-cyan-400">
                                    <span className={`text-[10px] mr-1 ${isOnline ? 'text-green-500' : 'text-red-500'} font-bold`}>
                                        ● {isOnline ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                    {msg.sender}
                                </span>
                                <span className="font-semibold text-cyan-100">: </span>
                                <span className="text-cyan-50">{msg.text}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t border-cyan-500 flex flex-col gap-2 bg-slate-800">
                <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-slate-950 border border-cyan-700 rounded p-1 text-sm outline-none text-cyan-100 placeholder:text-cyan-900"
                    placeholder={t('type_message')}
                />
                <button type="submit" className="bg-cyan-600 text-slate-950 font-bold px-3 py-1 rounded text-sm hover:bg-cyan-500">{t('send')}</button>
            </form>
        </div>
    );
};
