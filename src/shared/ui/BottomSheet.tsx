'use client';

import React from 'react';
import { Drawer } from 'vaul';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        {/* Затемнение фона с эффектом размытия */}
        <Drawer.Overlay
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={onClose}
        />
        {/* Контент шторки */}
        <Drawer.Content className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 flex flex-col bg-surface border-t border-border rounded-t-[24px] outline-none shadow-2xl focus:outline-none max-h-[85vh]">
          <div className="flex-1 overflow-y-auto p-5 select-none pb-sheet">
            {/* Палочка-слайдер для закрытия */}
            <div className="mx-auto w-12 h-1.5 bg-border rounded-full mb-4 cursor-grab active:cursor-grabbing" />

            {title && (
              <Drawer.Title className="text-xl font-extrabold text-text tracking-tight mb-4 text-center">
                {title}
              </Drawer.Title>
            )}

            <div className="mt-2 text-text-muted">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
