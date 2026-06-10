import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store/StoreProvider';
import {
    MessageSquare,
    Plus,
    X,
    Send,
    Trash2,
    ChevronLeft,
    ChevronRight,
    User,
    Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ChatView = observer(() => {
    const { shellStore } = useStore();
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const chatSessions = shellStore.chatSessions;
    const activeChat = shellStore.activeChat;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeChat?.messages]);

    useEffect(() => {
        if (!activeChat && chatSessions.length === 0) {
            shellStore.createChatSession('General');
        }
    }, []);

    const handleSend = () => {
        if (!inputValue.trim() || !activeChat) return;

        shellStore.addMessageToChat(activeChat.id, {
            role: 'user',
            content: inputValue.trim(),
        });

        setInputValue('');

        // Simulate AI response
        setTimeout(() => {
            shellStore.addMessageToChat(activeChat.id, {
                role: 'assistant',
                content: 'I received your message. How can I help you further with your workspace?',
            });
        }, 800);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full w-full bg-[#0B0D0E] flex">
            {/* Chat Sidebar */}
            <div
                className={cn(
                    "w-64 border-r border-[#1f2123] bg-[#131314] flex flex-col transition-all duration-200",
                    !shellStore.isChatPanelOpen && "w-0 opacity-0 overflow-hidden"
                )}
            >
                <div className="p-3 border-b border-[#1f2123] flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Chats</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => shellStore.createChatSession()}
                    >
                        <Plus size={14} />
                    </Button>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1">
                    {chatSessions.map((chat) => (
                        <div
                            key={chat.id}
                            onClick={() => shellStore.selectChat(chat.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm group",
                                activeChat?.id === chat.id
                                    ? "bg-[#1f2123] text-white"
                                    : "text-[#8E918F] hover:bg-[#1a1a1b]"
                            )}
                        >
                            <MessageSquare size={14} />
                            <span className="flex-1 truncate">{chat.title}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    shellStore.deleteChatSession(chat.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-[#8E918F] hover:text-red-400 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Chat Header */}
                <div className="h-12 border-b border-[#1f2123] flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#8E918F]"
                            onClick={() => shellStore.isChatPanelOpen = !shellStore.isChatPanelOpen}
                        >
                            {shellStore.isChatPanelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                        </Button>
                        <span className="text-sm font-medium text-white">
                            {activeChat?.title || 'Chat'}
                        </span>
                    </div>
                    {activeChat && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#8E918F] hover:text-red-400"
                            onClick={() => shellStore.deleteChatSession(activeChat.id)}
                        >
                            <X size={14} />
                        </Button>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {!activeChat?.messages?.length ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#8E918F]">
                            <Bot size={48} className="mb-4 opacity-30" />
                            <p className="text-lg mb-1">Start a conversation</p>
                            <p className="text-sm opacity-60">Ask about your data, nodes, or insights</p>
                        </div>
                    ) : (
                        activeChat.messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex gap-3",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-7 h-7 rounded-full bg-[#1f2123] flex items-center justify-center shrink-0">
                                        <Bot size={14} className="text-[#A8C7FA]" />
                                    </div>
                                )}
                                <div
                                    className={cn(
                                        "max-w-[70%] px-4 py-2.5 rounded-xl text-sm",
                                        msg.role === 'user'
                                            ? "bg-[#A8C7FA] text-[#0B0D0E]"
                                            : "bg-[#1f2123] text-white"
                                    )}
                                >
                                    {msg.content}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-7 h-7 rounded-full bg-[#2A2D31] flex items-center justify-center shrink-0">
                                        <User size={14} className="text-[#8E918F]" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-[#1f2123]">
                    <div className="flex items-center gap-2 bg-[#131314] border border-[#2A2D31] rounded-lg px-3 py-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className="flex-1 bg-transparent text-sm text-white placeholder-[#8E918F] outline-none"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#A8C7FA]"
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                        >
                            <Send size={14} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ChatView;
