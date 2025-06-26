import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const ChatDashboard = () => {
  const [messages, setMessages] = useState([
    { 
      sender: 'ai', 
      text: 'Good afternoon! Upload a document or ask me anything.', 
      isFile: false 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const response = await axios.post('/api/upload-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setActiveDocument({
        id: response.data.documentId,
        name: response.data.originalName,
      });
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Document "${response.data.originalName}" uploaded successfully. You can now ask questions about it.`,
          isFile: false,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Failed to upload document. Please try again.',
          isFile: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      sender: 'user',
      text: input,
      isFile: false,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const payload = {
        message: input,
      };
      if (activeDocument) {
        payload.documentId = activeDocument.id;
      }

      const response = await axios.post('/api/chat', payload);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: response.data.response,
          isFile: false,
          sources: response.data.sourceDocuments || [],
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Sorry, I encountered an error. Please try again.',
          isFile: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Clear active document
  const handleClearDocument = () => {
    setActiveDocument(null);
    setMessages((prev) => [
      ...prev,
      {
        sender: 'ai',
        text: 'You have switched to general chat mode. Feel free to ask any questions!',
        isFile: false,
      },
    ]);
  };

  // Format text
  const formatText = (text) => {
    if (!text) return null;

    return text.split('\n').map((paragraph, i) => {
      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
        return (
          <p key={i} className="font-semibold">
            {paragraph.replace(/\*\*/g, '')}
          </p>
        );
      }
      if (paragraph.startsWith('*') && paragraph.endsWith('*')) {
        return (
          <p key={i} className="italic">
            {paragraph.replace(/\*/g, '')}
          </p>
        );
      }
      if (paragraph.startsWith('### ')) {
        return (
          <h3 key={i} className="text-lg font-bold mt-4 mb-2">
            {paragraph.replace('### ', '')}
          </h3>
        );
      }
      if (paragraph.startsWith('## ')) {
        return (
          <h2 key={i} className="text-xl font-bold mt-6 mb-3">
            {paragraph.replace('## ', '')}
          </h2>
        );
      }
      if (paragraph.startsWith('# ')) {
        return (
          <h1 key={i} className="text-2xl font-bold mt-8 mb-4">
            {paragraph.replace('# ', '')}
          </h1>
        );
      }
      return (
        <p key={i} className="mb-2">
          {paragraph}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Document Analysis Assistant</h1>
          <div className="flex items-center space-x-2">
            {activeDocument && (
              <>
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {activeDocument.name}
                </span>
                <button
                  onClick={handleClearDocument}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
              }`}
            >
              {formatText(msg.text)}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2">Document References:</p>
                  <div className="space-y-2">
                    {msg.sources.map((source, idx) => (
                      <div
                        key={idx}
                        className="text-xs bg-gray-50 p-2 rounded border border-gray-200"
                      >
                        <p className="truncate">{source.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 rounded-bl-none shadow-sm flex space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-gray-500 hover:text-blue-600 transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.txt,.docx"
              className="hidden"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </label>
          
          <input
            type="text"
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={loading}
          />
          
          <button
            className="rounded-full bg-blue-600 text-white p-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatDashboard;
