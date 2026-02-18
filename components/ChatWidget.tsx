import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { chatWithSupport } from '../services/geminiService';
import { chatFAQ } from '../services/chatFAQ';

interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

const API_URL = import.meta.env.VITE_API_URL || '';

const ChatWidget: React.FC = () => {
    const { user, planInfo } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            text: "Hi! I'm your LifeScope assistant. Ask me anything about the app, your goals, or your data.",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [failedExchanges, setFailedExchanges] = useState(0);
    const [escalated, setEscalated] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const logChat = async (msgs: ChatMessage[]) => {
        try {
            await fetch(`${API_URL}/api/chat/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: msgs })
            });
        } catch (e) {
            console.error('Failed to log chat:', e);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: ChatMessage = { role: 'user', text: input.trim(), timestamp: new Date() };
        const updated = [...messages, userMsg];
        setMessages(updated);
        setInput('');
        setLoading(true);

        try {
            // Try FAQ first
            const faqAnswer = chatFAQ(input.trim());

            let responseText: string;
            if (faqAnswer) {
                responseText = faqAnswer;
            } else {
                // Fall back to AI
                const context = {
                    userName: user?.full_name || 'User',
                    plan: planInfo?.effectivePlan || 'free',
                    trialActive: planInfo?.trialActive || false,
                    trialDaysLeft: planInfo?.trialDaysLeft || 0
                };
                responseText = await chatWithSupport(input.trim(), context, messages);
            }

            const assistantMsg: ChatMessage = {
                role: 'assistant',
                text: responseText,
                timestamp: new Date()
            };
            const withResponse = [...updated, assistantMsg];
            setMessages(withResponse);
            setFailedExchanges(0);

            // Log the conversation
            logChat(withResponse);
        } catch (err) {
            const errorMsg: ChatMessage = {
                role: 'assistant',
                text: "I'm sorry, I couldn't process that. Please try again or send your question to our support team.",
                timestamp: new Date()
            };
            setMessages([...updated, errorMsg]);
            setFailedExchanges(prev => prev + 1);
        } finally {
            setLoading(false);
        }
    };

    const handleEscalate = async () => {
        setEscalated(true);
        try {
            await fetch(`${API_URL}/api/chat/escalate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    messages: messages,
                    userName: user?.full_name,
                    userEmail: user?.email
                })
            });
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: "Your conversation has been sent to our support team. They'll get back to you via email shortly.",
                timestamp: new Date()
            }]);
        } catch (e) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: "Sorry, I couldn't send your message to support. Please try again later.",
                timestamp: new Date()
            }]);
            setEscalated(false);
        }
    };

    if (!user) return null;

    return (
        <>
            {/* Floating Chat Bubble */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-110 transition-all duration-300 pulse-ring"
                >
                    <MessageCircle className="w-6 h-6 text-white" />
                </button>
            )}

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] flex flex-col bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 animate-page-enter overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <MessageCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">LifeScope Assistant</h3>
                                <p className="text-xs text-emerald-400">Online</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-md'
                                        : 'bg-slate-800 text-slate-200 rounded-bl-md'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 text-slate-400 px-4 py-2.5 rounded-2xl rounded-bl-md text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Escalation button */}
                    {failedExchanges >= 3 && !escalated && (
                        <div className="px-4 pb-2">
                            <button
                                onClick={handleEscalate}
                                className="w-full flex items-center justify-center gap-2 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl py-2 transition-colors"
                            >
                                <AlertCircle className="w-4 h-4" />
                                Send to Support
                            </button>
                        </div>
                    )}

                    {/* Input */}
                    <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Ask anything..."
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                disabled={loading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                                className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl flex items-center justify-center text-white transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatWidget;
