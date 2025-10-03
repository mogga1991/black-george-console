"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp, Mic, Upload, FileText, Search, BrainCircuit, Building2,
  MapPin, Landmark, BadgeDollarSign, CalendarClock, Ruler, ParkingCircle,
  Train, ShieldCheck, Sprout, Accessibility, Timer
} from "lucide-react";

type StartPayload = {
  text?: string;
  search?: boolean;
  deepResearch?: boolean;
  reason?: boolean;
  files?: File[];
};

export function CREAssistantIntro({
  onStart,
}: {
  onStart: (payload: StartPayload) => void;
}) {
  console.log("🎯 CREAssistantIntro component is rendering!");
  
  const [input, setInput] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [reasonEnabled, setReasonEnabled] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // quick-add chips (from your screenshot + CRE context)
  const chips = [
    { icon: <Train className="w-4 h-4" />, label: "near transit" },
    { icon: <Building2 className="w-4 h-4" />, label: "open plan" },
    { icon: <ParkingCircle className="w-4 h-4" />, label: "parking" },
    { icon: <Sprout className="w-4 h-4" />, label: "LEED / energy efficient" },
    { icon: <Landmark className="w-4 h-4" />, label: "class A" },
    { icon: <MapPin className="w-4 h-4" />, label: "downtown" },
    { icon: <Ruler className="w-4 h-4" />, label: "≥ 20,000 SF" },
    { icon: <BadgeDollarSign className="w-4 h-4" />, label: "budget ≤ $45/SF" },
    { icon: <CalendarClock className="w-4 h-4" />, label: "occupancy in 90 days" },
    { icon: <ShieldCheck className="w-4 h-4" />, label: "gov security specs" },
    { icon: <Accessibility className="w-4 h-4" />, label: "ADA compliant" },
    { icon: <Timer className="w-4 h-4" />, label: "short-term/flex" },
  ];

  function addChip(text: string) {
    setInput((prev) => (prev ? `${prev}; ${text}` : text));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const picked = Array.from(e.dataTransfer.files || []);
    if (!picked.length) return;
    beginUpload(picked);
  }

  function beginUpload(picked: File[]) {
    setUploading(true);
    // fake delay to show dots; replace with your real uploader
    setTimeout(() => {
      setFiles((prev) => [...prev, ...picked]);
      setUploading(false);
    }, 900);
  }

  function handleSend() {
    const payload: StartPayload = {
      text: input.trim() || undefined,
      search: searchEnabled,
      deepResearch: deepResearchEnabled,
      reason: reasonEnabled,
      files: files.length ? files : undefined,
    };
    onStart(payload);
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
      {/* card constrained to the 420px column */}
      <div
        className="w-full max-w-sm mx-auto bg-white border border-neutral-200 rounded-2xl shadow-sm p-5
                   flex flex-col items-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {/* logo */}
        <div className="mb-4 w-16 h-16 relative">
          {/* animated gradient circle (uses globals.css keyframes) */}
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <g clipPath="url(#clip)">
              <circle cx="100" cy="100" r="90" className="animate-gradient" fill="#0066FF" opacity="0.25" />
              <circle cx="100" cy="100" r="60" fill="#0099FF" opacity="0.35" />
              <circle cx="100" cy="100" r="30" fill="#00CCFF" opacity="0.65" />
            </g>
            <defs><clipPath id="clip"><rect width="200" height="200" /></clipPath></defs>
          </svg>
        </div>

        {/* title */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-3"
        >
          <h2 className="text-xl font-semibold text-neutral-900">Ready to assist you</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Upload an RFP/RLP or describe the space you need with as much detail as possible.
          </p>
        </motion.div>

        {/* input */}
        <div className="w-full bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3">
            <input
              ref={useRef(null)}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., 25–40k SF office in downtown DC, Sec. 508, SCIF, 120 parking…"
              className="w-full text-sm text-neutral-800 placeholder:text-neutral-400 outline-none"
            />
          </div>

          {/* file pills */}
          {files.length > 0 && (
            <div className="px-3 pb-2">
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-2 text-xs bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1">
                    <FileText className="w-3 h-3 text-blue-600" />
                    <span className="truncate max-w-[8rem]">{f.name}</span>
                    <button
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-neutral-400 hover:text-neutral-600"
                      aria-label="remove file"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* toggles + actions */}
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchEnabled((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  searchEnabled ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              <button
                onClick={() => setDeepResearchEnabled((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  deepResearchEnabled ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 ${deepResearchEnabled ? "border-blue-600 bg-blue-600" : "border-neutral-400"}`} />
                Deep research
              </button>
              <button
                onClick={() => setReasonEnabled((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  reasonEnabled ? "bg-blue-50 text-blue-600" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                <BrainCircuit className="w-4 h-4" />
                Reason
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-neutral-400 hover:text-neutral-600">
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() && files.length === 0}
                className={`w-8 h-8 flex items-center justify-center rounded-full ${
                  input.trim() || files.length > 0
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                }`}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* upload row */}
          <div className="px-3 py-2 border-t border-neutral-100">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
            >
              {uploading ? (
                <motion.span
                  className="inline-flex gap-1 items-center"
                  initial="hidden"
                  animate="visible"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-blue-600"
                      variants={{
                        hidden: { opacity: 0, y: 5 },
                        visible: { opacity: 1, y: 0, transition: { repeat: Infinity, repeatType: "mirror", duration: 0.4, delay: i * 0.1 } },
                      }}
                    />
                  ))}
                </motion.span>
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload RFP/RLP or solicitation
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                if (picked.length) beginUpload(picked);
              }}
              accept=".pdf,.doc,.docx,.rtf"
              className="hidden"
            />
          </div>
        </div>

        {/* quick chips */}
        <div className="w-full grid grid-cols-2 gap-2 mt-3">
          {chips.map((c, i) => (
            <motion.button
              key={c.label}
              onClick={() => addChip(c.label)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-700 hover:bg-neutral-50"
              title={`Add "${c.label}" to the request`}
            >
              <span className="text-blue-600">{c.icon}</span>
              <span className="truncate">{c.label}</span>
            </motion.button>
          ))}
        </div>

        {/* subtle helper */}
        <p className="text-[11px] text-neutral-500 mt-3 text-center">
          Drop files anywhere on this card to attach. The assistant will extract all requirements and summarize them for you.
        </p>
      </div>
    </div>
  );
}