import React from 'react';
import { X } from 'lucide-react';
import { SecurityIndicator } from './SecurityIndicator';
import { DomainSection } from './Sections/DomainSection';
import { VerificationSection } from './Sections/VerificationSection';
import { TwitterSection } from './Sections/TwitterSection';

export function SecurityInfo({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] animate-in">
        <div className="relative bg-[#1a1b1e] rounded-lg shadow-xl border border-purple-500/20">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <SecurityIndicator riskLevel="low" />
              <h2 className="text-lg font-semibold text-white">
                Security Check
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Content */}
          <div className="p-3 space-y-2">
            <DomainSection />
            <VerificationSection />
            <TwitterSection />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecurityInfo;
