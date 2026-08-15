'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Gift,
  Plus,
  Search,
  WalletCards,
  X,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  SectionCard,
  StatusBadge,
  SummaryMetricCard,
} from '../../components/ui/';

const api = '/api';

type Card = {
  id: string;
  code: string;
  balance: number;
  isActive: boolean;
};

const money = (value: number) => `$${(value / 100).toFixed(2)}`;

export default function GiftCardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function load() {
    setIsLoading(true);
    try {
      const response = await fetch(`${api}/gift-cards`, { headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to load gift cards.');
      }
      setCards(Array.isArray(data) ? data : []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load().catch((error: Error) => {
      setIsError(true);
      setMessage(error.message);
    });
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSaving(true);

    const element = event.currentTarget;
    const form = new FormData(element);
    try {
      const response = await fetch(`${api}/gift-cards`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: String(form.get('code') ?? '').trim(),
          balance: Math.round(Number(form.get('balance')) * 100),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to create gift card.');
      }

      element.reset();
      setIsError(false);
      setMessage('Gift card created and ready to use in POS.');
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : 'Unable to create gift card.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return cards;

    return cards.filter((card) =>
      card.code.toLowerCase().includes(normalizedQuery),
    );
  }, [cards, query]);

  const balance = cards.reduce((sum, card) => sum + card.balance, 0);
  const activeCards = cards.filter((card) => card.isActive).length;

  return (
    <main className="app-page">
      <PageHeading eyebrow="Customer credit" title="Gift cards" />

      <div>
        <PageContainer>
          {message && (
            <AlertBanner
              tone={isError ? 'error' : 'success'}
              icon={
                isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />
              }
              action={
                <Button
                  variant="ghost"
                  size="bareIcon"
                  onClick={() => setMessage('')}
                  aria-label="Dismiss message"
                  className="text-inherit hover:bg-transparent"
                >
                  <X size={16} />
                </Button>
              }
              className="mb-5"
            >
              {message}
            </AlertBanner>
          )}

          <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <SummaryMetricCard
              title="Customer credit"
              value={money(balance)}
              description="Outstanding balance"
              icon={<WalletCards size={20} />}
              tone="purple"
            />
            <SummaryMetricCard
              title="Active cards"
              value={activeCards}
              description="Ready at checkout"
              icon={<BadgeCheck size={20} />}
              tone="emerald"
            />
            <SummaryMetricCard
              title="Total cards"
              value={cards.length}
              description="Issued"
              icon={<CreditCard size={20} />}
              tone="sky"
            />
          </section>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
            <SectionCard
              title="Create gift card"
              description="Create store credit."
              icon={<Gift size={20} />}
            >
              <form className="flex flex-col gap-5" onSubmit={create}>
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4">
                  <FormField
                    id="gift-card-code"
                    label="Gift card code"
                    required
                    help="Use a readable code."
                  >
                    <Input
                      id="gift-card-code"
                      required
                      name="code"
                      placeholder="e.g. GIFT-1001"
                      autoComplete="off"
                      spellCheck={false}
                      onInput={(event) => {
                        event.currentTarget.value =
                          event.currentTarget.value.toUpperCase();
                      }}
                      className="font-mono uppercase"
                    />
                  </FormField>

                  <FormField
                    id="gift-card-balance"
                    label="Starting balance"
                    required
                    sublabel="(USD)"
                  >
                    <Input
                      id="gift-card-balance"
                      required
                      name="balance"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="25.00"
                      prefixText="$"
                    />
                  </FormField>
                </div>

                <div className="flex justify-end border-t border-border-subtle pt-5">
                  <Button type="submit" disabled={isSaving}>
                    <Plus size={16} />
                    {isSaving ? 'Creating…' : 'Create gift card'}
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Gift card balances"
              description={`${results.length} of ${cards.length} shown.`}
              actions={
                <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-muted-strong px-2.5 py-1 text-xs font-bold text-text-secondary">
                  {cards.length}
                </span>
              }
              bodyPadding={false}
            >
              <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search gift card code"
                  prefixIcon={<Search size={16} />}
                  aria-label="Search gift cards"
                />
              </div>

              {isLoading ? (
                <EmptyState
                  icon={<CreditCard size={24} />}
                  title="Loading gift cards"
                  description="Loading balances."
                />
              ) : results.length ? (
                <>
                  <div className="divide-y divide-border-subtle sm:hidden">
                    {results.map((card) => (
                      <article
                        key={card.id}
                        className="flex items-center gap-3 px-4 py-4 transition hover:bg-muted-surface"
                      >
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-subtle text-brand">
                          <CreditCard size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <strong className="block truncate font-mono text-sm text-text-main">
                            {card.code}
                          </strong>
                          <StatusBadge
                            tone={card.isActive ? 'success' : 'neutral'}
                            className="mt-1"
                          >
                            {card.isActive ? 'Active' : 'Inactive'}
                          </StatusBadge>
                        </div>
                        <strong className="shrink-0 text-right text-base font-extrabold text-brand">
                          {money(card.balance)}
                        </strong>
                      </article>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[34rem] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border-subtle bg-muted-surface text-xs font-bold tracking-wider text-text-secondary uppercase">
                          <th className="px-4 py-3 sm:pl-8">Gift card</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right sm:pr-8">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {results.map((card) => (
                          <tr
                            key={card.id}
                            className="transition hover:bg-muted-surface"
                          >
                            <td className="px-4 py-4 sm:pl-8">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-subtle text-brand">
                                  <CreditCard size={16} />
                                </span>
                                <span className="font-mono text-sm font-bold text-text-main">
                                  {card.code}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge
                                tone={card.isActive ? 'success' : 'neutral'}
                              >
                                {card.isActive ? 'Active' : 'Inactive'}
                              </StatusBadge>
                            </td>
                            <td className="px-4 py-4 text-right font-extrabold whitespace-nowrap text-brand sm:pr-8">
                              {money(card.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Search size={24} />}
                  title="No matching gift cards"
                  description="Try another code."
                />
              )}
            </SectionCard>
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
