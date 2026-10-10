'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
  activeTabRect: DOMRect | null;
  setActiveTabRect: (rect: DOMRect | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className = '',
}) => {
  const [localValue, setLocalValue] = useState(defaultValue);
  const [activeTabRect, setActiveTabRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : localValue;

  // MUHIM: har render'da yangi funksiya/obyekt yaratilsa, uni dependency sifatida ishlatuvchi
  // TabsTrigger useEffect'i cheksiz qayta ishga tushadi ("Maximum update depth exceeded").
  // Shuning uchun handleValueChange'ni useCallback, context value'ni useMemo bilan barqarorlashtiramiz.
  const handleValueChange = useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setLocalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  const contextValue = useMemo<TabsContextType>(
    () => ({
      value: activeValue,
      onValueChange: handleValueChange,
      activeTabRect,
      setActiveTabRect, // useState setter — barqaror
      containerRef,
    }),
    [activeValue, handleValueChange, activeTabRect]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={`w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className = '' }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsList must be used within Tabs');

  const { activeTabRect, containerRef } = context;
  const [containerRect, setContainerRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect());
    }
  }, [activeTabRect, containerRef]);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`relative inline-flex items-center justify-center rounded-2xl bg-border/30 dark:bg-bg/50 p-1 w-full max-w-md shadow-inner backdrop-blur-md ${className}`}
    >
      {/* Sliding Pill Animation Background */}
      {activeTabRect && containerRect && (
        <div
          className="absolute inset-y-1 left-0 bg-surface rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            width: activeTabRect.width,
            transform: `translateX(${activeTabRect.left - containerRect.left}px)`,
          }}
        />
      )}
      {children}
    </div>
  );
};

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, className = '' }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  // Butun `context` o'rniga faqat barqaror setter'ni ajratamiz — shunda effekt har render'da
  // emas, faqat isActive o'zgarganda ishga tushadi.
  const { value: activeValue, setActiveTabRect } = context;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isActive = activeValue === value;

  // getBoundingClientRect() har safar YANGI obyekt qaytaradi (qiymatlar bir xil bo'lsa ham).
  // Oldingi qiymatlar bilan solishtirib, faqat haqiqatan o'zgarganda setState qilamiz — bu
  // ortiqcha re-render va cheksiz siklning oldini oladi.
  const lastRect = useRef<{ left: number; width: number } | null>(null);
  const updateRect = useCallback(() => {
    if (!isActive || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const prev = lastRect.current;
    if (prev && prev.left === r.left && prev.width === r.width) return;
    lastRect.current = { left: r.left, width: r.width };
    setActiveTabRect(r);
  }, [isActive, setActiveTabRect]);

  useEffect(() => {
    updateRect();
  }, [updateRect]);

  // Oyna o'lchami o'zgarganda pill'ni qayta hizalaymiz.
  useEffect(() => {
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [updateRect]);

  return (
    <button
      ref={triggerRef}
      onClick={() => context.onValueChange(value)}
      className={`relative z-10 flex-1 rounded-xl px-4 py-2.5 text-[15px] font-bold transition-colors duration-300 select-none outline-none ${
        isActive ? 'text-accent' : 'text-text-muted hover:text-text'
      } ${className}`}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className = '' }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.value !== value) return null;

  return (
    <div
      className={`mt-5 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}
    >
      {children}
    </div>
  );
};
