'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleDollarSign,
  ClipboardCheck,
  LockKeyhole,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import {
  AlertBanner,
  Button,
  CustomSelect,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeading,
  SectionCard,
  StatusBadge,
} from '../../components/ui/';
import { PageContainer } from '../../components/layout/page-container';

const api = '/api';
type Movement = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};
type Shift = {
  id: string;
  openingCash: number;
  closingCash?: number | null;
  varianceReason?: string | null;
  openedAt?: string;
  expectedCash?: number;
  closedAt?: string | null;
  branch?: { name: string };
  movements?: Movement[];
};
type Approver = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};
const money = (value: number) => `$${(value / 100).toFixed(2)}`;
async function readResponse(
  response: Response,
): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      'The API returned an unexpected response. Restart the API and try again.',
    );
  }
}

export default function ShiftsPage() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [amount, setAmount] = useState('0');
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>(
    'CASH_IN',
  );
  const [movementAmount, setMovementAmount] = useState('0');
  const [movementReason, setMovementReason] = useState('');
  const [role, setRole] = useState('');
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approvalUserId, setApprovalUserId] = useState('');
  const [approvalPin, setApprovalPin] = useState('');
  const [cashOutApprovalToken, setCashOutApprovalToken] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [needsVarianceReason, setNeedsVarianceReason] = useState(false);
  const [message, setMessage] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
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
    const [me, current, managerList, past] = await Promise.all([
      fetch(`${api}/auth/me`, { headers }),
      fetch(`${api}/shifts/current`, { headers }),
      fetch(`${api}/auth/manager-approvers`, { headers }),
      fetch(
        `${api}/shifts/history?page=${historyPage}&search=${encodeURIComponent(historySearch)}`,
        { headers },
      ),
    ]);
    if (!me.ok) throw new Error('Please sign in again.');
    const user = await readResponse(me);
    if (!user || typeof user.branchId !== 'string')
      throw new Error('Unable to load your branch.');
    setBranchId(user.branchId);
    setRole(String(user.role ?? '').toUpperCase());
    if (managerList.ok) {
      const list = (await readResponse(managerList)) as unknown as Approver[];
      if (Array.isArray(list)) {
        setApprovers(list);
        if (list.length === 1) setApprovalUserId(list[0].id);
      }
    }
    setShift(
      (current.ok
        ? await readResponse(current)
        : null) as unknown as Shift | null,
    );
    if (past.ok) {
      const data = (await past.json()) as { items?: Shift[]; total?: number };
      setHistory(data.items ?? []);
      setHistoryTotal(data.total ?? 0);
    }
  }
  useEffect(() => {
    void load().catch((error: Error) => setMessage(error.message));
  }, [historyPage, historySearch]);
  const drawerMovement = useMemo(
    () =>
      shift?.movements?.reduce((sum, movement) => sum + movement.amount, 0) ??
      0,
    [shift],
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    const closing = Boolean(shift);
    try {
      const response = await fetch(
        `${api}/shifts/${closing ? 'close' : 'open'}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(
            closing
              ? {
                  closingCash: Math.round(Number(amount) * 100),
                  ...(varianceReason.trim()
                    ? { varianceReason: varianceReason.trim() }
                    : {}),
                }
              : { branchId, openingCash: Math.round(Number(amount) * 100) },
          ),
        },
      );
      const data = await readResponse(response);
      if (!response.ok) {
        const errorMessage =
          typeof data?.message === 'string'
            ? data.message
            : 'Unable to save shift.';
        if (/reason for the cash variance/i.test(errorMessage)) {
          setNeedsVarianceReason(true);
        }
        setMessage(errorMessage);
        return;
      }
      setAmount('0');
      setVarianceReason('');
      setNeedsVarianceReason(false);
      if (
        closing &&
        typeof data?.expectedCash === 'number' &&
        typeof data?.difference === 'number'
      ) {
        const difference = data.difference / 100;
        setMessage(
          `Shift closed. Expected ${money(data.expectedCash)} · ${difference === 0 ? 'balanced' : difference > 0 ? `${money(Math.round(difference * 100))} over` : `${money(Math.round(-difference * 100))} short`}.`,
        );
      } else setMessage('Shift opened.');
      if (closing) setCloseOpen(false);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to save shift.',
      );
    }
  }
  async function addMovement(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${api}/shifts/movement`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: movementType,
          amount: Math.round(Number(movementAmount) * 100),
          reason: movementReason,
          ...(cashOutApprovalToken
            ? { managerApprovalToken: cashOutApprovalToken }
            : {}),
        }),
      });
      const data = await readResponse(response);
      if (!response.ok) {
        setMessage(
          typeof data?.message === 'string'
            ? data.message
            : 'Unable to record cash movement.',
        );
        return;
      }
      setMovementAmount('0');
      setMovementReason('');
      setCashOutApprovalToken('');
      setApprovalMessage('');
      setMessage(
        movementType === 'CASH_IN'
          ? 'Cash added to the drawer.'
          : 'Cash removed from the drawer.',
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to record cash movement.',
      );
    }
  }
  async function approveCashOut() {
    try {
      const response = await fetch(`${api}/auth/manager-approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: approvalUserId,
          pin: approvalPin,
          action: 'CASH_OUT',
        }),
      });
      const data = await readResponse(response);
      if (!response.ok) {
        setApprovalMessage(
          typeof data?.message === 'string'
            ? data.message
            : 'Unable to approve cash-out.',
        );
        return;
      }
      const result = data as unknown as {
        approvalToken: string;
        manager: { firstName: string; lastName: string };
      };
      setCashOutApprovalToken(result.approvalToken);
      setApprovalPin('');
      setApprovalMessage(
        `Approved by ${result.manager.firstName} ${result.manager.lastName}. Record this cash-out within 2 minutes.`,
      );
    } catch {
      setApprovalMessage('Unable to approve cash-out.');
    }
  }
  const expectedCash =
    shift?.expectedCash ?? (shift ? shift.openingCash + drawerMovement : 0);
  const countedCashIsValid =
    amount.trim() !== '' && Number.isFinite(Number(amount));
  const countedCash = countedCashIsValid ? Math.round(Number(amount) * 100) : 0;
  const cashVariance = countedCash - expectedCash;
  const hasCashVariance = countedCashIsValid && cashVariance !== 0;

  function openCloseReview() {
    setAmount((expectedCash / 100).toFixed(2));
    setVarianceReason('');
    setNeedsVarianceReason(false);
    setCloseOpen(true);
  }

  function closeCloseReview() {
    setCloseOpen(false);
    setVarianceReason('');
    setNeedsVarianceReason(false);
  }

  const pageCount = Math.ceil(historyTotal / 20);
  const summaryCards = shift
    ? [
        {
          label: 'Opening cash',
          value: money(shift.openingCash),
          Icon: CircleDollarSign,
          tone: 'info',
        },
        {
          label: 'Drawer movements',
          value: `${drawerMovement >= 0 ? '+' : ''}${money(drawerMovement)}`,
          Icon: drawerMovement >= 0 ? BanknoteArrowUp : BanknoteArrowDown,
          tone: drawerMovement >= 0 ? 'success' : 'danger',
        },
        {
          label: 'Expected cash',
          value: money(expectedCash),
          Icon: CircleDollarSign,
          tone: 'info',
        },
        {
          label: 'Opened',
          value: shift.openedAt
            ? new Date(shift.openedAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })
            : 'Now',
          Icon: ClipboardCheck,
          tone: 'neutral',
        },
      ]
    : [];

  return (
    <main className="w-full pb-16">
      <PageHeading
        eyebrow="Cash drawer"
        title={shift ? 'Active cash shift' : 'Open a cash shift'}
      />

      <div className="py-6">
        <PageContainer>
          <div className="flex flex-col gap-5">
            {message && <AlertBanner tone="info">{message}</AlertBanner>}

            {shift && (
              <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {summaryCards.map(({ label, value, Icon, tone }) => {
                  const iconTone =
                    tone === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : tone === 'danger'
                        ? 'bg-rose-50 text-rose-600'
                        : tone === 'neutral'
                          ? 'bg-muted-surface text-text-muted'
                          : 'bg-brand-subtle text-brand';

                  return (
                    <SectionCard
                      key={label}
                      bodyClassName="px-4 py-4 sm:px-5"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <span
                          className={
                            'flex size-9 shrink-0 items-center justify-center rounded-md sm:size-10 ' +
                            iconTone
                          }
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 text-xs font-medium text-text-muted">
                            {label}
                          </p>
                          <strong className="mt-1 block truncate text-lg font-bold tracking-tight text-text-main sm:text-xl">
                            {value}
                          </strong>
                        </div>
                      </div>
                    </SectionCard>
                  );
                })}
              </section>
            )}

            <section
              className={
                shift
                  ? 'grid grid-cols-1 items-start gap-5 lg:grid-cols-2'
                  : 'max-w-2xl'
              }
            >
              <SectionCard
                title={shift ? 'Close shift' : 'Open shift'}
                description={
                  shift
                    ? 'Count the drawer and confirm the final cash.'
                    : 'Enter the starting cash for change.'
                }
                icon={
                  shift ? (
                    <ClipboardCheck size={20} />
                  ) : (
                    <CircleDollarSign size={20} />
                  )
                }
              >
                <form
                  onSubmit={
                    shift
                      ? (event) => {
                          event.preventDefault();
                          openCloseReview();
                        }
                      : submit
                  }
                  className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  {!shift ? (
                    <FormField
                      label="Opening cash (USD)"
                      required
                      id="opening-cash"
                    >
                      <Input
                        id="opening-cash"
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        prefixText="$"
                      />
                    </FormField>
                  ) : (
                    <div className="rounded-md border border-border-subtle bg-muted-surface px-4 py-3">
                      <p className="m-0 text-xs font-medium text-text-muted">
                        Expected cash
                      </p>
                      <strong className="mt-1 block text-lg text-text-main">
                        {money(expectedCash)}
                      </strong>
                    </div>
                  )}
                  <Button type="submit" className="whitespace-nowrap">
                    {shift ? 'Review close' : 'Open shift'}
                  </Button>
                </form>
              </SectionCard>

              {shift && (
                <SectionCard
                  title="Cash movement"
                  description="Add or remove drawer cash."
                  icon={
                    movementType === 'CASH_OUT' ? (
                      <BanknoteArrowDown size={20} />
                    ) : (
                      <BanknoteArrowUp size={20} />
                    )
                  }
                >
                  <form
                    onSubmit={addMovement}
                    className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2"
                  >
                    <FormField label="Type">
                      <CustomSelect
                        value={movementType}
                        onChange={(value) => {
                          setMovementType(value as 'CASH_IN' | 'CASH_OUT');
                          setCashOutApprovalToken('');
                          setApprovalMessage('');
                        }}
                        options={[
                          { value: 'CASH_IN', label: 'Cash in' },
                          { value: 'CASH_OUT', label: 'Cash out' },
                        ]}
                      />
                    </FormField>
                    <FormField
                      label="Amount (USD)"
                      required
                      id="movement-amount"
                    >
                      <Input
                        id="movement-amount"
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={movementAmount}
                        onChange={(event) => {
                          setMovementAmount(event.target.value);
                          setCashOutApprovalToken('');
                        }}
                        prefixText="$"
                      />
                    </FormField>
                    <FormField
                      label="Reason"
                      required
                      id="movement-reason"
                      className="md:col-span-2"
                    >
                      <Input
                        id="movement-reason"
                        required
                        value={movementReason}
                        placeholder="e.g. Paid supplier"
                        onChange={(event) => {
                          setMovementReason(event.target.value);
                          setCashOutApprovalToken('');
                        }}
                      />
                    </FormField>

                    {movementType === 'CASH_OUT' && role === 'CASHIER' && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:col-span-2">
                        <div className="mb-4 flex items-start gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-amber-700">
                            <LockKeyhole size={16} />
                          </span>
                          <div>
                            <h3 className="m-0 text-sm font-bold text-amber-900">
                              Manager approval required
                            </h3>
                            <p className="mt-1 mb-0 text-xs text-amber-800">
                              Ask a manager to approve this cash-out.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto]">
                          <FormField label="Manager">
                            <CustomSelect
                              value={approvalUserId}
                              onChange={setApprovalUserId}
                              placeholder="Select manager"
                              options={approvers.map((user) => ({
                                value: user.id,
                                label: user.firstName + ' ' + user.lastName,
                                sublabel: user.role,
                              }))}
                            />
                          </FormField>
                          <FormField label="PIN" required id="approval-pin">
                            <Input
                              id="approval-pin"
                              required
                              type="password"
                              value={approvalPin}
                              onChange={(event) =>
                                setApprovalPin(
                                  event.target.value.replace(/\D/g, ''),
                                )
                              }
                              inputMode="numeric"
                              minLength={4}
                              maxLength={8}
                            />
                          </FormField>
                          <Button
                            variant="warningSubtle"
                            onClick={() => void approveCashOut()}
                          >
                            Approve
                          </Button>
                        </div>
                        {approvalMessage && (
                          <p className="mt-3 mb-0 text-xs font-semibold text-amber-800">
                            {approvalMessage}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end md:col-span-2">
                      <Button
                        type="submit"
                        disabled={
                          movementType === 'CASH_OUT' &&
                          role === 'CASHIER' &&
                          !cashOutApprovalToken
                        }
                      >
                        Record movement
                      </Button>
                    </div>
                  </form>
                </SectionCard>
              )}
            </section>

            {shift && closeOpen && (
              <Modal
                title="Close shift"
                description="Enter the counted drawer cash."
                density="compact"
                onClose={closeCloseReview}
                size="sm"
                footer={
                  <>
                    <Button variant="secondary" onClick={closeCloseReview}>
                      Cancel
                    </Button>
                    <Button type="submit" form="close-shift-form">
                      Close shift
                    </Button>
                  </>
                }
              >
                <form
                  id="close-shift-form"
                  onSubmit={submit}
                  className="flex flex-col gap-4"
                >
                  <div className="rounded-md border border-border-subtle bg-muted-surface px-4 py-3">
                    <p className="m-0 text-xs font-medium text-text-muted">
                      Expected cash
                    </p>
                    <strong className="mt-1 block text-lg text-text-main">
                      {money(expectedCash)}
                    </strong>
                  </div>
                  <FormField
                    label="Counted cash at closing (USD)"
                    required
                    id="closing-cash"
                    help="Count all physical notes and coins currently in the drawer."
                  >
                    <Input
                      id="closing-cash"
                      required
                      autoFocus
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        setNeedsVarianceReason(false);
                      }}
                      prefixText="$"
                    />
                  </FormField>

                  {countedCashIsValid &&
                    (hasCashVariance ? (
                      <AlertBanner
                        tone={cashVariance > 0 ? 'warning' : 'error'}
                        title={cashVariance > 0 ? 'Cash over' : 'Cash short'}
                        description={`${money(Math.abs(cashVariance))} ${
                          cashVariance > 0
                            ? 'over expected.'
                            : 'short of expected.'
                        }`}
                      />
                    ) : (
                      <AlertBanner
                        tone="success"
                        title="Drawer balanced"
                        description="Counted cash matches expected cash."
                      />
                    ))}

                  {(hasCashVariance || needsVarianceReason) && (
                    <FormField
                      label="Reason for cash variance"
                      required
                      id="variance-reason"
                      help="Explain the difference for the shift record."
                    >
                      <Input
                        id="variance-reason"
                        required
                        value={varianceReason}
                        onChange={(event) =>
                          setVarianceReason(event.target.value)
                        }
                        placeholder="e.g. Wrong change given"
                      />
                    </FormField>
                  )}
                </form>
              </Modal>
            )}

            {shift && (
              <SectionCard
                title="Current shift movements"
                icon={<CircleDollarSign size={20} />}
                bodyPadding={false}
              >
                {shift.movements?.length ? (
                  <div>
                    {shift.movements.map((movement) => (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 hover:bg-muted-surface sm:px-8"
                      >
                        <div className="min-w-0">
                          <strong className="block truncate text-sm text-text-main">
                            {movement.reason}
                          </strong>
                          <span className="mt-1 block text-xs text-text-muted">
                            {new Date(movement.createdAt).toLocaleTimeString(
                              [],
                              {
                                hour: 'numeric',
                                minute: '2-digit',
                              },
                            )}
                          </span>
                        </div>
                        <strong
                          className={
                            'shrink-0 text-sm tabular-nums ' +
                            (movement.amount >= 0
                              ? 'text-emerald-700'
                              : 'text-rose-600')
                          }
                        >
                          {movement.amount >= 0 ? '+' : ''}
                          {money(movement.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No cash movements"
                    description="Drawer cash changes will appear here."
                    icon={<CircleDollarSign size={24} />}
                  />
                )}
              </SectionCard>
            )}

            <SectionCard
              title="Shift history"
              description={
                historyTotal +
                ' closed' +
                (historyTotal === 1 ? '' : 's') +
                '.'
              }
              icon={<ClipboardCheck size={20} />}
              actions={
                <Input
                  value={historySearch}
                  onChange={(event) => {
                    setHistorySearch(event.target.value);
                    setHistoryPage(1);
                  }}
                  placeholder="Search branch or variance"
                  prefixIcon={<Search size={15} />}
                  wrapperClassName="w-full sm:w-80"
                />
              }
              bodyPadding={false}
            >
              {history.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-muted-surface">
                        {[
                          'Branch',
                          'Opened',
                          'Closed',
                          'Opening',
                          'Closing',
                          'Variance reason',
                          'Movements',
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-xs font-bold tracking-wide text-text-secondary uppercase first:pl-8 last:pr-8"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                        >
                          <td className="px-4 py-4 pl-8 font-bold text-text-main">
                            {item.branch?.name ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-text-secondary">
                            {item.openedAt
                              ? new Date(item.openedAt).toLocaleString()
                              : '—'}
                          </td>
                          <td className="px-4 py-4 text-text-secondary">
                            {item.closedAt
                              ? new Date(item.closedAt).toLocaleString()
                              : '—'}
                          </td>
                          <td className="px-4 py-4 font-semibold tabular-nums text-text-main">
                            {money(item.openingCash)}
                          </td>
                          <td className="px-4 py-4 font-semibold tabular-nums text-text-main">
                            {item.closingCash === null ||
                            item.closingCash === undefined
                              ? '—'
                              : money(item.closingCash)}
                          </td>
                          <td className="max-w-64 px-4 py-4 text-text-secondary">
                            {item.varianceReason ===
                            'Enter a reason for the cash variance.'
                              ? '—'
                              : (item.varianceReason ?? '—')}
                          </td>
                          <td className="px-4 py-4 pr-8 text-center">
                            <StatusBadge tone="neutral">
                              {item.movements?.length ?? 0}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No closed shifts"
                  description="Closed shift records will appear here."
                  icon={<ClipboardCheck size={24} />}
                />
              )}
              {pageCount > 1 && (
                <footer className="flex items-center justify-end gap-3 border-t border-border-subtle px-4 py-4 sm:px-8">
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Previous page"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((page) => page - 1)}
                    className="size-8"
                  >
                    <ChevronLeft size={17} />
                  </Button>
                  <span className="text-xs font-semibold text-text-muted">
                    Page {historyPage} of {pageCount}
                  </span>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Next page"
                    disabled={historyPage >= pageCount}
                    onClick={() => setHistoryPage((page) => page + 1)}
                    className="size-8"
                  >
                    <ChevronRight size={17} />
                  </Button>
                </footer>
              )}
            </SectionCard>
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
