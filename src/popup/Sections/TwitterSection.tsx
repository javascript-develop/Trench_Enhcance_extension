import React, { useState } from 'react';
import {
  Twitter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  AlertCircle,
} from 'lucide-react';

interface UsernameHistory {
  username: string;
  changedAt: string;
}

export function TwitterSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // PLACEHOLDER data
  const previousUsernames: UsernameHistory[] = [
    {
      username: 'PLACEHOLDER @CryptoMoon_SOL',
      changedAt: 'PLACEHOLDER 2.8.2024',
    },
    {
      username: 'PLACEHOLDER @MoonShot_SOL',
      changedAt: 'PLACEHOLDER 1.8.2024',
    },
  ];

  const hasUsernameHistory = previousUsernames.length > 0;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Twitter className="w-5 h-5 text-purple-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              @POPMAS_SOL
            </div>
            <div className="text-xs text-gray-400">
              52 Followers
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
        <div className="p-3 rounded-lg bg-white/5 space-y-3 animate-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-sm">
              <div className="text-gray-400">Created</div>
              <div className="text-white">3.8.2024</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400">Following</div>
              <div className="text-white">24</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400">Tweet Count</div>
              <div className="text-white">8</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400">Verified</div>
              <div className="text-white">No</div>
            </div>
          </div>

          {/* Username History Section */}
          <div className="space-y-2">
            <div
              className={`flex items-center justify-between p-2 rounded-lg ${
                hasUsernameHistory
                  ? 'bg-yellow-500/10 border border-yellow-500/20'
                  : 'bg-green-500/10 border border-green-500/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {hasUsernameHistory ? (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                ) : (
                  <History className="w-4 h-4 text-green-500" />
                )}
                <span className="text-sm text-white">Username Changes</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    hasUsernameHistory ? 'text-yellow-500' : 'text-green-500'
                  }`}
                >
                  {hasUsernameHistory ? 'Found' : 'None'}
                </span>
                {hasUsernameHistory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHistoryExpanded(!isHistoryExpanded);
                    }}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {isHistoryExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {isHistoryExpanded && hasUsernameHistory && (
              <div className="space-y-1.5 pl-2 animate-in">
                {previousUsernames.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                  >
                    <span className="text-sm text-white">{item.username}</span>
                    <span className="text-xs text-gray-400">
                      {item.changedAt}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <a
            href="https://twitter.com/POPMAS_SOL"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2 mt-2 rounded-lg bg-purple-500/10 
              hover:bg-purple-500/20 transition-colors text-purple-400 hover:text-purple-300"
          >
            <span className="text-sm">View Profile</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
