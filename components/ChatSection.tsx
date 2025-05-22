
import React, { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon } from './icons/PaperAirplaneIcon';
import { Spinner } from './Spinner';
import { ChatMessage as DisplayChatMessage } from '../services/geminiService'; // Renamed to avoid conflict, type for UI display

interface ChatSectionProps {
  transcriptContext: string | null;
  geminiChatFunction: (
    transcript: string,
    // chatHistory is no longer needed here as Chat object manages it
    newMessage: string
  ) => Promise<string>;
  onChatError: (message: string) => void;
  isFullScreen?: boolean;
}

interface UIMessage extends DisplayChatMessage { // Extended for UI purposes
  isLoading?: boolean;
  id?: string; 
  isError?: boolean;
}

export const ChatSection: React.FC<ChatSectionProps> = ({
  transcriptContext,
  geminiChatFunction,
  onChatError,
  isFullScreen,
}) => {
  const [chatInput, setChatInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<UIMessage[]>([]); // This state is for UI rendering
  const [isChatting, setIsChatting] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Clear chat history if transcript context changes (e.g., new file processed)
  useEffect(() => {
    setChatHistory([]);
  }, [transcriptContext]);


  const handleSendMessage = async () => {
    if (!chatInput.trim() || !transcriptContext) return;

    const newUserMessage: UIMessage = { sender: 'user', text: chatInput.trim() };
    setChatHistory(prev => [...prev, newUserMessage]);
    const currentInput = chatInput.trim(); // Store before clearing
    setChatInput('');
    setIsChatting(true);
    
    const loadingAiMessageId = Date.now().toString(); 
    setChatHistory(prev => [...prev, { sender: 'ai', text: '...', isLoading: true, id: loadingAiMessageId }]);


    try {
      // Call the updated geminiChatFunction without chatHistory
      const aiResponseText = await geminiChatFunction(
        transcriptContext,
        currentInput // Use the stored current input
      );
      
      setChatHistory(prev => prev.map(msg => 
        msg.id === loadingAiMessageId ? { sender: 'ai', text: aiResponseText, isLoading: false } : msg
      ));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Произошла неизвестная ошибка в чате.';
      console.error("Chat error:", error);
      onChatError(errorMessage);
       
      setChatHistory(prev => prev.map(msg => 
        msg.id === loadingAiMessageId ? { sender: 'ai', text: `Ошибка: ${errorMessage}`, isLoading: false, isError: true } : msg
      ));
    } finally {
      setIsChatting(false);
    }
  };
  
  const rootClasses = `bg-slate-800/50 rounded-b-xl ${isFullScreen ? 'flex flex-col flex-grow h-full' : 'p-4'}`;
  const chatContainerClasses = `mb-4 p-3 bg-slate-900/70 rounded-lg space-y-3 ${isFullScreen ? 'flex-grow overflow-y-auto' : 'h-64 sm:h-80 overflow-y-auto'}`;

  return (
    <div className={rootClasses}>
      <div 
        ref={chatContainerRef}
        className={chatContainerClasses}
        aria-live="polite"
      >
        {chatHistory.length === 0 && (
            <p className="text-slate-500 italic text-center py-4">
                Задайте вопрос по содержанию транскрипции.
            </p>
        )}
        {chatHistory.map((msg, index) => (
          <div
            key={index} // Consider more stable keys if messages can be reordered/deleted
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-xl text-sm sm:text-base break-words ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white'
                  : msg.isError 
                  ? 'bg-rose-700/80 text-rose-100'
                  : 'bg-slate-700 text-slate-200'
              }`}
            >
              {msg.isLoading ? <Spinner className="h-5 w-5" /> : (msg.text || '').split('\n').map((line, i) => <span key={i}>{line}<br/></span>) }
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center space-x-2">
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isChatting && chatInput.trim()) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Спросите что-нибудь о транскрипции..."
          className="flex-grow p-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:ring-sky-500 focus:border-sky-500 transition-shadow resize-none"
          rows={2}
          disabled={isChatting || !transcriptContext}
          aria-label="Введите ваш вопрос по транскрипции"
        />
        <button
          onClick={handleSendMessage}
          disabled={isChatting || !chatInput.trim() || !transcriptContext}
          className="p-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Отправить сообщение"
        >
          <PaperAirplaneIcon className="h-6 w-6" />
        </button>
      </div>
      {!transcriptContext && (
        <p className="text-xs text-amber-400 mt-2">
          Чат будет доступен после успешной транскрипции аудио.
        </p>
      )}
    </div>
  );
};
