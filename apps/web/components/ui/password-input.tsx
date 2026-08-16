'use client';

import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { useI18n } from '../../lib/i18n';

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  wrapperClassName?: string;
};

/** Standard password field with an accessible visibility control. */
export function PasswordInput({
  className = '',
  wrapperClassName = '',
  ...props
}: PasswordInputProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <Input
        type={visible ? 'text' : 'password'}
        prefixIcon={<LockKeyhole size={16} />}
        className={`pr-10 ${className}`.trim()}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 h-10 w-10 border-transparent p-0 text-text-muted shadow-none hover:bg-transparent hover:text-text-main"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </Button>
    </div>
  );
}
