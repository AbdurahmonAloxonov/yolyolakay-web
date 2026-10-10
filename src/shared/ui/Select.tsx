import React from 'react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = '', id, ...props }, ref) => {
    // Yorliq maydonga BOG'LANADI — izohi `Input.tsx` da (o'sha nuqson
    // ikkala komponentda ham bor edi).
    const autoId = React.useId();
    const selectId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {label && (
          <label htmlFor={selectId} className="text-sm font-semibold text-text-muted select-none">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={`w-full bg-surface border border-border rounded-xl px-4 text-text focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 min-h-[48px] text-base transition-colors duration-200 appearance-none cursor-pointer ${
              error ? 'border-error focus:border-error focus:ring-error/20' : ''
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-surface text-text"
              >
                {opt.label}
              </option>
            ))}
          </select>
          {/* Кастомная стрелочка */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-text-muted">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
        {error && (
          <span className="text-xs text-error font-medium select-none animate-in fade-in slide-in-from-top-1 duration-150">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
