import { useState, useRef, useEffect } from "react";
import { Button } from "./components/ui/Button"
import { Input } from "./components/ui/input";
import { SendHorizontal, Loader2, MessageSquare, User, Bot } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import React from "react";
import { v4 as uuidv4 } from "uuid";

const defaultPrompts = [
  "Create ticket for writing e2e test for Looks Feature in BFA",
  "Update the description of the ticket to ...",
  "Update the Story point to 3",
  "Move ticket to To Do",
  "Move ticket to In Progress",
  "Move ticket to In Code Review",
  "Move ticket to In Stage",
  "Move ticket On Live",
  "Get My working hours for today",
  "List all my tickets in <projectKey>",
  "Add 1 hour to the ticket",
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const App = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hi! I'm your Jira Ticket Agent. I can help you to maintain your JIRA including create, update your ticket and transition your ticket from one state to another state, assign priorities, and generate descriptions, Log hours, Get all working hours for today."
    }
  ]);
  const [threadId] = useState(() => uuidv4());
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      let userId = localStorage.getItem("userId");
      if (!userId) {
        userId = `user-${Math.random().toString(36).substring(2)}`;
        localStorage.setItem("userId", userId);
      }

      const response = await fetch("http://localhost:5001/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          threadId,
          prompt: input 
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant", 
        content: data.result || "Please provide a more detailed prompt."
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: "Sorry, something went wrong. Please try again." 
        }
      ]);
    } finally {
      setInput("");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">JIRA AI Agent</h1>
          </div>
          <div className="text-sm text-gray-500">
            Thread ID: {threadId}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 space-y-4">
        {/* Messages Container */}
        <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm p-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className="flex items-start space-x-2 max-w-2xl">
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-lg ${
                    msg.role === "user" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-100 text-gray-800"
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      marked.parse(msg.content, { async: false })
                    ),
                  }}
                />
                {msg.role === "user" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-2">
          {defaultPrompts.map((prompt, index) => (
            <Button
              key={index}
              onClick={() => setInput(prompt)}
              className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-50 border border-gray-200 shadow-sm text-sm"
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* Input Area */}
        <div className="flex gap-2 bg-white p-4 rounded-lg shadow-sm">
          <Input
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
            <span>Send</span>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default App;