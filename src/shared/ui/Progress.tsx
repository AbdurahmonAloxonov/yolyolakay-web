import React from 'react';

interface ProgressProps {
  value: number; // 0 to 100
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, className = '' }) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  return (
    <div className={`w-full bg-border/40 rounded-full h-2 overflow-hidden ${className}`}>
      {/* To'ldirish transform: scaleX orqali (kenglik animatsiyasi EMAS — spec 5) */}
      <div
        className="bg-accent h-full w-full rounded-full origin-left transition-transform duration-500 ease-out"
        style={{ transform: `scaleX(${clampedValue / 100})` }}
      />
    </div>
  );
};
