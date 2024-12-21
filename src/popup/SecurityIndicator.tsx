import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';

interface SecurityIndicatorProps {
  riskLevel: 'low' | 'medium' | 'high';
}

export function SecurityIndicator({ riskLevel }: SecurityIndicatorProps) {
  const indicators = {
    low: {
      icon: ShieldCheck,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      pulseColor: 'bg-green-500',
    },
    medium: {
      icon: ShieldAlert,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      pulseColor: 'bg-yellow-500',
    },
    high: {
      icon: ShieldOff,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      pulseColor: 'bg-red-500',
    },
  };

  const { icon: Icon, color, bgColor, pulseColor } = indicators[riskLevel];

  return (
    <div className={`relative p-1.5 rounded-lg ${bgColor}`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <div
        className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${pulseColor} animate-pulse`}
      />
    </div>
  );
}
