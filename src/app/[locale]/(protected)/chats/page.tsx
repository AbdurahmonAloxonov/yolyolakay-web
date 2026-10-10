'use client';

import { Suspense } from 'react';
import { ChatsContent } from './ChatsContent';

export default function ChatsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
        </div>
      }
    >
      <ChatsContent />
    </Suspense>
  );
}
