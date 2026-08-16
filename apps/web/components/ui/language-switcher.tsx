'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { Button } from './button';

type LanguageSwitcherProps = {
  dark?: boolean;
  className?: string;
};

export function LanguageSwitcher({
  dark = false,
  className = '',
}: LanguageSwitcherProps) {
  const { locale, toggleLocale, t } = useI18n();
  const nextLanguage = locale === 'en' ? t('language.khmer') : t('language.english');

  return (
    <Button
      type="button"
      variant={dark ? 'ghost' : 'secondary'}
      size="sm"
      className={`${dark ? '!border-white/10 !bg-white/5 !text-slate-200 hover:!bg-white/10 hover:!text-white' : ''} ${className}`.trim()}
      onClick={toggleLocale}
      aria-label={t('language.switchTo', { language: nextLanguage })}
      title={t('language.switchTo', { language: nextLanguage })}
    >
      <Languages size={16} />
      <span>{locale === 'en' ? 'ខ្មែរ' : 'EN'}</span>
    </Button>
  );
}
