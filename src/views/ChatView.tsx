
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowRight, Key, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { chatWithTeacher } from '../services/geminiService';
import { useChat } from '../hooks/useChat';

interface ChatViewProps {
  isApiOk: boolean;
  onOpenApiModal: () => void;
}

const ChatView = ({ isApiOk, onOpenApiModal }: ChatViewProps) => {
  const { messages, sendMessage, clearHistory, loading } = useChat();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [useKB, setUseKB] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userText = input;
    setInput('');
    setIsThinking(true);

    try {
      // Save user message to Firestore
      await sendMessage(userText, 'user');

      let kbContext = "";
      if (useKB) {
        const { semanticSearch } = await import('../services/knowledgeBaseService');
        const results = await semanticSearch(userText, {});
        if (results.length > 0) {
          kbContext = results.map(r => r.content).join("\n\n");
        }
      }

      const aiResponse = await chatWithTeacher(userText, messages, kbContext);
      // Save AI response to Firestore
      await sendMessage(aiResponse || 'Қате орын алды.', 'ai');
    } catch (error) {
      console.error("Chat Error:", error);
      await sendMessage('Қате орын алды. Қайталап көріңіз.', 'ai');
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fu h-full flex flex-col"
    >
      <div className="chat-wrap relative">
        <div className="chat-header">
          <div className="chat-avatar bg-emerald-600 text-white">D</div>
          <div className="chat-hinfo">
            <h3 translate="no">DostUstaz</h3>
            <p>Желіде • AI Көмекші</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button 
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              onClick={() => {
                if (confirm('Чат тарихын өшіруді растайсыз ба?')) {
                  clearHistory();
                }
              }}
              title="Тарихты тазалау"
            >
              <Trash2 size={16} />
            </button>
            <div className="flex items-center gap-2">
              <div 
                className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative ${useKB ? 'bg-emerald-600' : 'bg-slate-300'}`}
                onClick={() => setUseKB(!useKB)}
                title={useKB ? "Білім базасы қосулы" : "Білім базасы өшірулі"}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useKB ? 'left-4.5' : 'left-0.5'}`} />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KB</span>
            </div>
          </div>
        </div>

        <div className="chat-msgs" ref={scrollRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
              {msg.role === 'ai' && <div className="msg-avatar bg-emerald-600 text-white">D</div>}
              <div className="msg-bubble markdown-body" translate="no">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="msg ai">
              <div className="msg-avatar bg-emerald-600 text-white">D</div>
              <div className="chat-thinking">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
        </div>

        <div className="chat-prompts">
          {['Математикадан есеп шығару', 'Физика заңдары', 'Ағылшын грамматикасы'].map((p, i) => (
            <button key={i} className="chat-prompt-btn" onClick={() => setInput(p)}>
              {p}
            </button>
          ))}
        </div>

        <div className="chat-input-area">
          <textarea 
            className="chat-inp" 
            placeholder="Сұрағыңызды жазыңыз..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          ></textarea>
          <button className="chat-send" onClick={handleSend} disabled={isThinking}>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatView;
