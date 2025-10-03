import { ChatMessage } from "@/lib/types";
import { motion } from "framer-motion";

export function MessageBubbles({ items }: { items: ChatMessage[] }) {
  return (
    <div className="space-y-4">
      {items.map((m) =>
        m.role === "user" ? (
          <motion.div 
            key={m.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex justify-end"
          >
            <div className="max-w-[80%] rounded-xl bg-[#41205C] text-white px-4 py-2 text-sm leading-relaxed">
              {m.text}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key={m.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-[85%]"
          >
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
              {m.text && (
                <p className="text-sm text-neutral-800 leading-relaxed mb-3">
                  {m.text}
                </p>
              )}
              {m.chips && (
                <div className="flex flex-wrap gap-2">
                  {m.chips.map((c) => (
                    <span 
                      key={c} 
                      className="text-xs rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 hover:bg-neutral-100 cursor-pointer transition-colors"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )
      )}
    </div>
  );
}