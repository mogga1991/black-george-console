"use client";

import { Property } from "@/lib/types";
import { motion } from "framer-motion";
import { Star, MapPin, Phone, Mail } from "lucide-react";

export function RecsPanel({ items }: { items: Property[] }) {
  return (
    <aside className="h-full w-full overflow-y-auto bg-white border-r border-neutral-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 bg-white sticky top-0 z-10">
        <h3 className="text-lg font-semibold text-neutral-900">AI Recommendations</h3>
        <p className="text-xs text-neutral-500 mt-1">
          {items.length > 0 ? `${items.length} matches found` : "Waiting for search results..."}
        </p>
      </div>

      {/* Results */}
      <div className="p-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-500">
              Upload an RFP or describe your requirements to see property recommendations.
            </p>
          </div>
        ) : (
          items.map((property, idx) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              className="rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer group"
            >
              {/* Image & Content */}
              <div className="flex gap-3 p-3">
                <div className="relative">
                  <img 
                    src={property.imageUrl ?? ""} 
                    className="h-16 w-20 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute -top-1 -left-1 w-6 h-6 bg-[#053771] text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {idx + 1}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-neutral-900 truncate group-hover:text-[#053771] transition-colors">
                      {property.title}
                    </h4>
                    {property.rating && (
                      <div className="flex items-center gap-1 text-xs text-yellow-600">
                        <Star className="w-3 h-3 fill-current" />
                        {property.rating}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-neutral-500 truncate mt-1">
                    {property.address}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="font-medium text-neutral-700">
                      {property.sqft.toLocaleString()} sf
                    </span>
                    {property.priceMonthly && (
                      <>
                        <span className="text-neutral-300">•</span>
                        <span className="font-semibold text-green-600">
                          ${property.priceMonthly.toLocaleString()}/mo
                        </span>
                      </>
                    )}
                  </div>
                  
                  {property.tags && property.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {property.tags.slice(0, 3).map((tag) => (
                        <span 
                          key={tag}
                          className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              {property.summary && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {property.summary}
                  </p>
                </div>
              )}

              {/* Broker Info */}
              {property.broker && (
                <div className="px-3 pb-3 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-neutral-200 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-neutral-600">
                          {property.broker.name?.charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-neutral-700">
                        {property.broker.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {property.broker.phone && (
                        <button className="w-6 h-6 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
                          <Phone className="w-3 h-3 text-neutral-600" />
                        </button>
                      )}
                      {property.broker.email && (
                        <button className="w-6 h-6 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
                          <Mail className="w-3 h-3 text-neutral-600" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </aside>
  );
}