import React, { useState, useEffect, useContext } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useCall } from '../context/CallContext';
import { LanguageContext } from '../context/LanguageContext';

interface Message {
  id: string;
  text: string;
  sender: string;
  recipient?: string;
  createdAt: number;
}

export const Chat = () => {
    const { t } = useContext(LanguageContext);
    const { roomId } = useCall();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [recipientId, setRecipientId] = useState(() => localStorage.getItem('chatRecipientId') || '');
    const [sender, setSender] = useState(() => localStorage.getItem('chatUsername') || '');
    const [isOpen, setIsOpen] = useState(false);
    const [isSettingName, setIsSettingName] = useState(!localStorage.getItem('chatUsername'));

    const handleSenderChange = (val: string) => {
        setSender(val);
        localStorage.setItem('chatUsername', val);
    };

    const handleRecipientIdChange = (val: string) => {
        setRecipientId(val);
        localStorage.setItem('chatRecipientId', val);
    };
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('hiddenMessages') || '[]')));

    const handleSetName = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sender.trim()) return;
        localStorage.setItem('chatUsername', sender);
        setIsSettingName(false);
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
            recipient: recipientId || undefined,
            createdAt: Date.now()
        });
        setNewMessage('');
    };

    const shareId = () => {
        setNewMessage(`My ID is: ${roomId}. Let's chat!`);
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
        localStorage.setItem('hiddenMessages', JSON.stringify(Array.from(newHidden)));
        setSelectedIds(new Set());
        setIsSelecting(false);
    };

    const visibleMessages = messages.filter(m => !hiddenMessageIds.has(m.id));

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-cyan-600 text-slate-950 p-3 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] z-50 transition-transform hover:scale-105"
            >
                Chat
            </button>
        );
    }

    if (isSettingName) {
        return (
            <div className="fixed bottom-4 right-4 w-80 bg-slate-900 border border-cyan-500 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] z-50 p-4 font-mono">
                <h3 className="font-bold mb-2 text-cyan-300">{t('set_name')}</h3>
                <form onSubmit={handleSetName} className="flex gap-2">
                    <input
                        value={sender}
                        onChange={(e) => handleSenderChange(e.target.value)}
                        className="flex-1 bg-slate-950 border border-cyan-700 rounded p-1 text-sm outline-none text-cyan-100"
                        placeholder={t('enter_name')}
                    />
                    <button type="submit" className="bg-cyan-600 text-slate-950 font-bold px-3 py-1 rounded text-sm hover:bg-cyan-500">{t('save')}</button>
                </form>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-80 bg-slate-900 border border-cyan-500 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] z-50 flex flex-col h-96 overflow-hidden font-mono">
            <div className="p-3 border-b border-cyan-500 flex justify-between items-center bg-slate-800 rounded-t-xl">
                <h3 className="font-bold text-cyan-300 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    {t('chat')} ({sender})
                </h3>
                <div className="flex gap-2">
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
            <div className="flex-1 overflow-y-auto p-3 bg-slate-950 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-slate-900">
                {visibleMessages.map(msg => (
                    <div key={msg.id} className="mb-2 text-sm flex items-start gap-2">
                        {isSelecting && (
                            <input 
                                type="checkbox" 
                                checked={selectedIds.has(msg.id)}
                                onChange={() => toggleSelect(msg.id)}
                                className="mt-1"
                            />
                        )}
                        <div>
                            <span className="font-semibold text-cyan-400">{msg.sender}</span>
                            {msg.recipient && <span className="text-cyan-600 text-xs mx-1">to {msg.recipient}</span>}
                            <span className="font-semibold text-cyan-100">: </span>
                            <span className="text-cyan-50">{msg.text}</span>
                        </div>
                    </div>
                ))}
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t border-cyan-500 flex flex-col gap-2 bg-slate-800">
                <div className="flex gap-2">
                    <input
                        value={sender}
                        onChange={(e) => handleSenderChange(e.target.value)}
                        className="w-1/3 bg-slate-950 border border-cyan-700 rounded p-1 text-xs outline-none text-cyan-300 placeholder:text-cyan-900"
                        placeholder={t('name')}
                    />
                    <input
                        type="number"
                        value={recipientId}
                        onChange={(e) => handleRecipientIdChange(e.target.value)}
                        className="w-1/3 bg-slate-950 border border-cyan-700 rounded p-1 text-xs outline-none text-cyan-300 placeholder:text-cyan-900"
                        placeholder={t('id')}
                    />
                    <button type="button" onClick={shareId} className="w-1/3 bg-slate-700 text-cyan-100 px-2 py-1 rounded text-xs hover:bg-slate-600">{t('share_id')}</button>
                </div>
                <div className="flex gap-2">
                    <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-slate-950 border border-cyan-700 rounded p-1 text-sm outline-none text-cyan-100 placeholder:text-cyan-900"
                        placeholder={t('type_message')}
                    />
                    <button type="submit" className="bg-cyan-600 text-slate-950 font-bold px-3 py-1 rounded text-sm hover:bg-cyan-500">{t('send')}</button>
                </div>
            </form>
        </div>
    );
};
