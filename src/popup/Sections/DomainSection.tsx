import React, { useState } from 'react';
import { Globe, ChevronDown, ChevronUp } from 'lucide-react';

export function DomainSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-purple-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              popmas.xyz
            </div>
            <div className="text-xs text-gray-400">
              Created: 6.12.2024
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-3 rounded-lg bg-white/5 space-y-2 animate-in">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm">
              <div className="text-gray-400">Creation Date</div>
              <div className="text-white">7.12.2025</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400">Expiration Date</div>
              <div className="text-white">7.12.2025</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400">Registrar</div>
              <div className="text-white">Namecheap</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400">Origin Country</div>
              <div className="text-white">N/A</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
