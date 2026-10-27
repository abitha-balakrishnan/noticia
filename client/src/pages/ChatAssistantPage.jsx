import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, RotateCcw, Database, Shield, Bot, User, Terminal } from 'lucide-react';
import { chatApi } from '../services/api';

const SUGGESTED_CHIPS = [
  "Show today's failed logins",
  "Any suspicious IPs today?",
  "Show brute force attempts on /api/auth/login",
  "Show all logs from IP 203.0.113.88"
];

const ChatAssistantPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello analyst. I am Noticia's grounded SOC security assistant. Ask me questions in plain English about your security logs. Every response is strictly translated into structured queries and grounded directly in actual retrieved database records — zero hallucination.",
      resultCount: null
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChips, setShowChips] = useState(true);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const question = (textToSend || input).trim();
    if (!question || loading) return;

    setShowChips(false);
    setInput('');

    const userMessageId = Date.now().toString();
    const newUserMessage = {
      id: userMessageId,
      role: 'user',
      content: question
    };

    // Optimistic update
    setMessages((prev) => [...prev, newUserMessage]);
    setLoading(true);

    try {
      const res = await chatApi.sendQuery(question);
      const data = res.data;

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        resultCount: data.resultCount,
        generatedQuery: data.generatedQuery
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error investigating security telemetry: ${err.message}. Please check your query or server connection.`,
        resultCount: 0
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: "New investigation session started. What security event or IP would you like to investigate?",
        resultCount: null
      }
    ]);
    setShowChips(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Top Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Natural Language Query Assistant
              <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                RAG Grounded
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Llama 3.3 70B &bull; Strict Database Translation &bull; Zero Hallucination
            </p>
          </div>
        </div>

        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`space-y-1.5 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div
                className={`p-4 rounded-xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white rounded-br-none shadow-md font-sans'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-bl-none font-sans'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Inspection query toggle for transparency */}
                {msg.generatedQuery && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 text-left">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                      <Terminal className="w-3 h-3 text-sky-400" />
                      <span>Validated MongoDB Filter:</span>
                    </div>
                    <code className="block mt-1 p-2 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-400 overflow-x-auto">
                      {JSON.stringify(msg.generatedQuery)}
                    </code>
                  </div>
                )}
              </div>

              {/* Transparency / Grounding Indicator */}
              {msg.role === 'assistant' && msg.resultCount !== null && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 px-1">
                  <Database className="w-3 h-3 text-sky-400" />
                  <span>Source: <strong className="text-slate-300">{msg.resultCount}</strong> records matched</span>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl rounded-bl-none p-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
              </div>
              <span className="text-xs font-mono text-slate-400">
                Generating query &amp; retrieving grounded telemetry...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Question Chips */}
      {showChips && (
        <div className="px-5 py-2.5 bg-slate-950/50 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-mono text-slate-500 shrink-0">Try asking:</span>
          {SUGGESTED_CHIPS.map((chip, index) => (
            <button
              key={index}
              onClick={() => handleSendMessage(chip)}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-sky-500/15 text-slate-300 hover:text-sky-300 border border-slate-700/80 hover:border-sky-500/40 text-[11px] font-mono whitespace-nowrap transition"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Fixed Input Bar */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your security logs (e.g. 'Show failed logins from 203.0.113.88 today')..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono transition"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!input.trim() || loading}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-semibold text-xs tracking-wide transition shadow-sm shadow-sky-500/20"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};

export default ChatAssistantPage;
