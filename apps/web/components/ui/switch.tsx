'use client';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  className = '',
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
        checked
          ? 'border-brand bg-brand'
          : 'border-border-default bg-muted-strong'
      } ${className}`.trim()}
    >
      <span
        className={`block size-4 rounded-full bg-card shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
