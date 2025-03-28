import { useState, useRef, useEffect } from "react";
import { Button } from "./components/ui/Button"
import { Input } from "./components/ui/input";
import { SendHorizontal, Loader2 } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import React from "react";

const defaultPrompts = [
  "Create ticket for product investigation in BFA",
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const App = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hi! I'm your Jira Ticket Agent. I can help create tickets, assign priorities, and generate descriptions."
    }
  ]);
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
          userId: userId, 
          prompt: input 
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant", 
        content: data.message || "Please provide a more detailed prompt."
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
    <div className="h-screen w-full flex flex-col p-6 bg-gray-100">
      <div className="flex-1 overflow-auto mb-4 p-4 bg-white rounded-lg shadow-md">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            } mb-4`}
          >
            <div
              className={`max-w-lg p-3 rounded-lg shadow-md ${
                msg.role === "user" 
                  ? "bg-blue-500 text-white" 
                  : "bg-gray-200 text-black"
              }`}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  marked.parse(msg.content, { async: false })
                ),
              }}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {defaultPrompts.map((prompt, index) => (
          <Button
            key={index}
            onClick={() => setInput(prompt)}
            className="text-xs"
          >
            {prompt}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Create a Jira ticket..."
          onKeyDown={handleKeyDown}
        />
        <Button 
          onClick={handleSend} 
          disabled={loading}
          className="flex items-center"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="mr-2 h-4 w-4" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
};

export default App;