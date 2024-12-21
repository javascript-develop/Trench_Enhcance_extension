import React, { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

export function VerificationSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  const verifications = [
    { label: 'Token Name', matches: 5, status: 'Found' },
    { label: 'Token Symbol', matches: 5, status: 'Found' },
    { label: 'Contract Address', matches: 2, status: 'Found' },
  ];

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              Website Content Verify
            </div>
            <div className="text-xs text-gray-400">
              All checks passed
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
          {verifications.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">{item.label}</span>
                <span className="text-xs text-gray-400">
                  ({item.matches} matches)
                </span>
              </div>
              <span className="text-xs font-medium text-green-500">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
