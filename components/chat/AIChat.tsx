"use client";

import { useState } from "react";
import { ChatMessage, Property, RfpCriteria } from "@/lib/types";
import { MessageBubbles } from "./MessageBubbles";
import { Paperclip, Mic, SendHorizonal, Upload } from "lucide-react";
import { motion } from "framer-motion";

export function AIChat({
  onResults,
}: {
  onResults?: (items: Property[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "greet",
      role: "assistant",
      text: "👋 Welcome to CRE Console! Upload your RFP/RLP document or tell me what you're looking for. I'll extract key requirements and show matching spaces on the map.",
      chips: ["near transit", "open plan", "parking", "pet friendly", "class A", "downtown"],
    },
  ]);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpload(file: File) {
    setIsLoading(true);
    
    // Add user message
    const userMsg: ChatMessage = { 
      id: crypto.randomUUID(), 
      role: "user", 
      text: `📎 Uploaded: ${file.name}`,
      files: [file]
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/rfp/extract", { method: "POST", body: form });
      const data = await res.json();
      const criteria: RfpCriteria = data.criteria;

      // Add extraction result
      setMessages((prev) => [
        ...prev,
        { 
          id: crypto.randomUUID(), 
          role: "assistant", 
          text: `✅ I've analyzed your RFP. Key requirements: ${[
            criteria.minSqft && `${criteria.minSqft?.toLocaleString()}–${criteria.maxSqft?.toLocaleString()} sf`,
            criteria.leaseType,
            criteria.locationText,
            criteria.mustHaves?.slice(0,2).join(", ")
          ].filter(Boolean).join(" · ")}`,
          chips: [...(criteria.mustHaves ?? []), ...(criteria.niceToHaves ?? [])].slice(0,6)
        },
      ]);

      // Search for properties
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria, topK: 10 }),
      });
      const searchData = await searchRes.json();
      
      onResults?.(searchData.results as Property[]);

      // Add search results message
      setMessages((prev) => [
        ...prev,
        { 
          id: crypto.randomUUID(), 
          role: "assistant", 
          text: `🏢 Found ${searchData.results.length} matching properties. Check the recommendations panel and map for details!`,
          chips: ["price range", "location", "amenities", "availability"]
        },
      ]);

    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { 
          id: crypto.randomUUID(), 
          role: "assistant", 
          text: "❌ Sorry, I had trouble processing your file. Please try again or describe your requirements in text.",
        },
      ]);
    }
    
    setIsLoading(false);
  }

  async function handleSend() {
    if (!text.trim() || isLoading) return;
    
    setIsLoading(true);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((p) => [...p, userMsg]);
    setText("");

    try {
      // Mock search based on user text
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          criteria: { 
            locationText: text.includes("San Francisco") ? "San Francisco" : "Bay Area",
            minSqft: text.includes("small") ? 500 : 1000,
            maxSqft: text.includes("large") ? 10000 : 5000,
          }, 
          topK: 6 
        }),
      });
      const searchData = await searchRes.json();
      
      onResults?.(searchData.results);
      
      setMessages((p) => [
        ...p,
        { 
          id: crypto.randomUUID(), 
          role: "assistant", 
          text: `🔍 Based on your message, I found ${searchData.results.length} properties that might work. Take a look at the recommendations and map!`,
          chips: ["refine search", "price filter", "size filter", "location"]
        },
      ]);
    } catch (error) {
      setMessages((p) => [
        ...p,
        { 
          id: crypto.randomUUID(), 
          role: "assistant", 
          text: "❌ I had trouble searching. Please try rephrasing your request.",
        },
      ]);
    }
    
    setIsLoading(false);
  }

  function handleVoiceInput() {
    if ("webkitSpeechRecognition" in window || (window as any).SpeechRecognition) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setText(transcript);
      };
      rec.start();
    } else {
      alert("Voice recognition not available in this browser");
    }
  }

  return (
    <section className="h-1/2 lg:h-full w-full overflow-hidden bg-white border-r lg:border-r border-b lg:border-b-0 border-neutral-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 bg-white sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-neutral-900">AI Assistant</h2>
        <p className="text-xs text-neutral-500 mt-1">Upload RFP or describe your space needs</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <MessageBubbles items={messages} />
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mt-4"
          >
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
            <span className="text-xs text-neutral-500">AI is thinking...</span>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-neutral-200 bg-white">
        <div className="flex items-center gap-3">
          {/* File Upload */}
          <label className="h-12 w-12 inline-flex items-center justify-center rounded-full border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors touch-manipulation">
            <input 
              hidden 
              type="file" 
              accept=".pdf,.doc,.docx" 
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} 
            />
            <Upload className="h-4 w-4 text-neutral-600" />
          </label>

          {/* Voice Input */}
          <button
            type="button"
            className="h-12 w-12 inline-flex items-center justify-center rounded-full border border-neutral-200 hover:bg-neutral-50 transition-colors touch-manipulation"
            title="Voice input"
            onClick={handleVoiceInput}
          >
            <Mic className="h-4 w-4 text-neutral-600" />
          </button>

          {/* Text Input */}
          <input
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 h-12 text-base outline-none focus:ring-2 focus:ring-[#41205C] focus:border-transparent touch-manipulation"
            placeholder="Describe your space requirements..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isLoading}
          />

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!text.trim() || isLoading}
            className="h-12 px-6 inline-flex items-center gap-2 rounded-xl bg-[#41205C] text-white hover:bg-[#331649] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base font-medium touch-manipulation"
          >
            <SendHorizonal className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
    </section>
  );
}