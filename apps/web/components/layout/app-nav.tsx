'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Archive,
  ArrowLeftRight,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronLeft,
  Clock,
  Coins,
  Cpu,
  FileText,
  Gift,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  Tag,
  TrendingUp,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

type NavGroup = NavItem & {
  children?: NavItem[];
};

const navigation: NavGroup[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/pos', label: 'POS', Icon: Calculator },
  {
    href: '/products',
    label: 'Products',
    Icon: Package,
    children: [
      { href: '/products', label: 'Product list', Icon: Package },
      { href: '/labels', label: 'Labels', Icon: Printer },
      { href: '/promotions', label: 'Promotions', Icon: Tag },
      { href: '/gift-cards', label: 'Gift cards', Icon: Gift },
    ],
  },
  {
    href: '/inventory',
    label: 'Inventory',
    Icon: Archive,
    children: [
      { href: '/inventory', label: 'Overview', Icon: Archive },
      { href: '/inventory/stock', label: 'Stock', Icon: Package },
      { href: '/transfers', label: 'Transfers', Icon: ArrowLeftRight },
      { href: '/receiving', label: 'Receiving', Icon: Inbox },
    ],
  },
  {
    href: '/purchase-orders',
    label: 'Purchasing',
    Icon: ShoppingCart,
    children: [
      { href: '/purchase-orders', label: 'Purchase orders', Icon: ShoppingCart },
      { href: '/suppliers', label: 'Suppliers', Icon: Truck },
      { href: '/supplier-invoices', label: 'Invoices', Icon: FileText },
      { href: '/supplier-statements', label: 'Statements', Icon: FileText },
    ],
  },
  { href: '/customers', label: 'Customers', Icon: Users },
  {
    href: '/sales',
    label: 'Sales',
    Icon: TrendingUp,
    children: [
      { href: '/sales', label: 'Transactions', Icon: TrendingUp },
      { href: '/expenses', label: 'Expenses', Icon: Coins },
    ],
  },
  { href: '/shifts', label: 'Shifts', Icon: Clock },
  { href: '/reports', label: 'Reports', Icon: BarChart3 },
  {
    href: '/branches',
    label: 'Management',
    Icon: Store,
    children: [
      { href: '/branches', label: 'Branches', Icon: Store },
      { href: '/staff', label: 'Staff', Icon: Shield },
      { href: '/activity', label: 'Activity', Icon: Activity },
    ],
  },
  {
    href: '/settings',
    label: 'Settings',
    Icon: Settings,
    children: [
      { href: '/settings', label: 'General', Icon: Settings },
      { href: '/account', label: 'Account', Icon: User },
      { href: '/hardware', label: 'Hardware', Icon: Cpu },
    ],
  },
];

const cashierLinks = new Set(['/pos', '/sales', '/shifts', '/customers', '/account']);
const ownerOnlyLinks = new Set(['/settings', '/staff', '/activity']);
const api = '/api';

function routeIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupIsActive(pathname: string, group: NavGroup) {
  return routeIsActive(pathname, group.href) || Boolean(group.children?.some((item) => routeIsActive(pathname, item.href)));
}

export function AppNav() {
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [hoveredFlyout, setHoveredFlyout] = useState<string | null>(null);
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isPosWorkspace = pathname === '/pos' || pathname.startsWith('/pos/');
  const compact = isPosWorkspace || collapsed;

  useEffect(() => {
    // Restore a user preference that only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem('pos_nav_collapsed') === 'true');
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('pos_access_token') ?? localStorage.getItem('pos_access_token');
    // Authentication storage is browser-only and must be synchronized after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(Boolean(token));
    if (!token) {
      setRole('');
      return;
    }
    void fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) {
          sessionStorage.removeItem('pos_access_token');
          localStorage.removeItem('pos_access_token');
          setSignedIn(false);
          router.replace('/login');
          return null;
        }
        return response.json();
      })
      .then((user) => {
        if (!user) return;
        const nextRole = String(user?.role ?? '').toUpperCase();
        setRole(nextRole);
        if (nextRole === 'CASHIER' && !cashierLinks.has(pathname) && !pathname.startsWith('/receipt/')) {
          router.replace('/pos');
        } else if (nextRole === 'MANAGER' && [...ownerOnlyLinks].some((href) => routeIsActive(pathname, href))) {
          router.replace('/dashboard');
        }
      })
      .catch(() => setRole(''));
  }, [pathname, router]);

  const visibleNavigation = useMemo<NavGroup[]>(() => {
    const allowed = (href: string) => {
      if (role === 'CASHIER') return cashierLinks.has(href);
      if (role === 'MANAGER') return !ownerOnlyLinks.has(href);
      return true;
    };

    if (role === 'CASHIER') {
      return navigation.flatMap((group) => {
        if (allowed(group.href)) return [{ ...group, children: undefined }];
        return group.children?.filter((item) => allowed(item.href)).map((item) => ({ ...item })) ?? [];
      });
    }

    return navigation.flatMap((group) => {
      const children = group.children?.filter((item) => allowed(item.href));
      if (!allowed(group.href) && !children?.length) return [];
      return [{ ...group, href: allowed(group.href) ? group.href : children![0].href, children }];
    });
  }, [role]);

  if (!signedIn) return null;

  function signOut() {
    sessionStorage.removeItem('pos_access_token');
    localStorage.removeItem('pos_access_token');
    localStorage.removeItem('pos_remembered_email');
    router.push('/login');
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('pos_nav_collapsed', String(next));
  }

  function toggleGroup(href: string) {
    setOpenGroup((current) => current === href ? '' : href);
  }

  function openFlyout(href: string) {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    setHoveredFlyout(href);
  }

  function scheduleFlyoutClose() {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    flyoutCloseTimer.current = setTimeout(() => setHoveredFlyout(null), 250);
  }

  const navigationContent = (mobile = false) => (
    <div className="grid gap-1">
      {visibleNavigation.map((group) => {
        const active = groupIsActive(pathname, group);
        const open = openGroup === group.href || (openGroup === null && active);
        const hasChildren = Boolean(group.children?.length);
        const Icon = group.Icon;
        const parentClassName = `relative flex min-h-11 w-full min-w-0 items-center rounded-md font-bold transition ${
          compact && !mobile ? 'justify-center px-2' : 'gap-3 px-3'
        } ${
          active
            ? mobile
              ? '!bg-brand-subtle !text-brand'
              : '!bg-white/10 !text-white'
            : mobile
              ? '!text-text-secondary hover:!bg-muted-surface hover:!text-text-main'
              : '!text-slate-300 hover:!bg-white/10 hover:!text-white'
        }`;
        const parentContent = (
          <>
            {active && !mobile && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-emerald-400" />}
            <Icon size={19} strokeWidth={2} className={`shrink-0 ${active && !mobile ? 'text-emerald-300' : ''}`} />
            {(!compact || mobile) && <span className="min-w-0 flex-1 truncate text-left text-sm">{group.label}</span>}
            {hasChildren && (!compact || mobile) && (
              <ChevronDown size={16} className={`shrink-0 opacity-70 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
            )}
          </>
        );

        return (
          <div
            key={group.href}
            className="group/nav relative min-w-0"
            onMouseEnter={() => compact && hasChildren && openFlyout(group.href)}
            onMouseLeave={() => compact && hasChildren && scheduleFlyoutClose()}
            onFocus={() => compact && hasChildren && openFlyout(group.href)}
            onBlur={() => compact && hasChildren && scheduleFlyoutClose()}
          >
            {hasChildren && (!compact || mobile) ? (
              <Button
                type="button"
                variant="ghost"
                size="bareIcon"
                className={parentClassName}
                onClick={() => toggleGroup(group.href)}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${group.label}`}
                aria-expanded={open}
              >
                {parentContent}
              </Button>
            ) : (
              <Link
                href={group.href}
                aria-label={compact && !mobile ? group.label : undefined}
                onClick={(event) => {
                  if (mobile) setMobileOpen(false);
                  if (compact && !mobile) event.currentTarget.blur();
                }}
                className={parentClassName}
              >
                {parentContent}
              </Link>
            )}

            {compact && !mobile && (
              hasChildren ? (
                <div
                  className={`fixed left-[80px] z-[120] -mt-11 w-56 rounded-lg border border-slate-600 bg-[var(--brand-navy-sidebar)] p-2 shadow-xl transition before:absolute before:-left-4 before:top-0 before:h-full before:w-4 before:content-[''] ${
                    hoveredFlyout === group.href
                      ? 'visible translate-x-0 opacity-100'
                      : 'pointer-events-none invisible translate-x-1 opacity-0'
                  }`}
                  onMouseEnter={() => openFlyout(group.href)}
                  onMouseLeave={scheduleFlyoutClose}
                >
                  <div className="border-b border-white/10 px-2.5 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </div>
                  <div className="mt-1 grid gap-0.5">
                    {group.children?.map((item) => {
                      const siblingMatch = group.children?.some(
                        (sibling) => sibling.href !== item.href && routeIsActive(pathname, sibling.href) && sibling.href.length > item.href.length,
                      );
                      const childActive = routeIsActive(pathname, item.href) && !siblingMatch;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition ${
                            childActive
                              ? 'bg-brand/20 text-emerald-200'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className={`size-1.5 shrink-0 rounded-full ${childActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none invisible fixed left-[80px] z-[120] -mt-9 translate-x-1 whitespace-nowrap rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition group-hover/nav:visible group-hover/nav:translate-x-0 group-hover/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:translate-x-0 group-focus-within/nav:opacity-100">
                  {group.label}
                </div>
              )
            )}

            {hasChildren && open && (!compact || mobile) && (
              <div className={`mb-1 ml-[5px] mt-1 grid gap-0.5 border-l pl-2 ${mobile ? 'border-border-subtle' : 'border-slate-600'}`}>
                {group.children?.map((item) => {
                  const siblingMatch = group.children?.some(
                    (sibling) => sibling.href !== item.href && routeIsActive(pathname, sibling.href) && sibling.href.length > item.href.length,
                  );
                  const childActive = routeIsActive(pathname, item.href) && !siblingMatch;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => mobile && setMobileOpen(false)}
                      className={`relative flex min-h-9 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold transition ${
                        childActive
                          ? mobile ? 'bg-brand-subtle text-brand' : 'bg-brand/20 text-emerald-200'
                          : mobile ? 'text-text-muted hover:bg-muted-surface hover:text-text-main' : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                      }`}
                    >
                      <span className={`size-1.5 shrink-0 rounded-full ${childActive ? 'bg-emerald-400' : mobile ? 'bg-border-default' : 'bg-slate-600'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <header className="mobile-app-header">
        <Link className="mobile-brand" href={role === 'CASHIER' ? '/pos' : '/dashboard'}>
          <Store size={22} strokeWidth={2.5} />
          <span>KN POS</span>
        </Link>
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-lg border-white/15 bg-white/10 p-0 text-white hover:bg-white/15 hover:text-white" onClick={() => setMobileOpen((value) => !value)} aria-label="Toggle navigation menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </Button>
      </header>

      <div
        className={`fixed inset-0 z-[220] min-[769px]:hidden ${
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
          <Button type="button" variant="overlay" size="bareIcon" className={`absolute inset-0 h-full w-full rounded-none p-0 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMobileOpen(false)} aria-label="Close navigation menu"><span className="sr-only">Close navigation menu</span></Button>
          <aside className={`fixed inset-y-0 right-0 z-[221] flex h-dvh w-full max-w-sm flex-col overflow-hidden border-l border-border-subtle bg-card shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`} role="dialog" aria-modal={mobileOpen ? 'true' : undefined} aria-labelledby="mobile-nav-title">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-4">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-brand text-white"><Store size={20} /></span><h2 id="mobile-nav-title" className="text-base font-bold text-text-main">Navigation</h2></div>
              <Button type="button" variant="iconBareDanger" size="icon" className="-mr-2" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu"><X size={20} /></Button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{navigationContent(true)}</nav>
            <div className="border-t border-border-subtle px-4 py-4"><Button type="button" variant="dangerSubtle" size="md" className="w-full" onClick={signOut}><LogOut size={18} /><span>Log out</span></Button></div>
          </aside>
        </div>

      <aside className={`hidden h-screen shrink-0 flex-col bg-[var(--brand-navy-sidebar)] shadow-sm transition-[width] duration-200 min-[769px]:sticky min-[769px]:left-0 min-[769px]:top-0 min-[769px]:z-[80] min-[769px]:flex print:hidden ${compact ? 'w-[72px] overflow-visible' : 'w-64 overflow-hidden'}`}>
        <div className={`flex h-[76px] shrink-0 items-center border-b border-white/10 ${compact ? 'justify-center px-2' : 'gap-3 px-4'}`}>
          <Link className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand text-white shadow-lg shadow-brand/25 transition hover:bg-brand-hover" href={role === 'CASHIER' ? '/pos' : '/dashboard'} title="KN POS"><Store size={23} strokeWidth={2.5} /></Link>
          {!compact && <div className="min-w-0"><div className="truncate text-sm font-bold text-white">KN POS</div><div className="truncate text-xs text-slate-400">Business workspace</div></div>}
        </div>

        <nav className={`min-h-0 flex-1 px-2 py-3 [scrollbar-width:thin] ${compact ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>{navigationContent()}</nav>

        <div className="shrink-0 border-t border-white/10">
          {!isPosWorkspace && (
            <Button type="button" variant="ghost" size="bareIcon" className={`!h-11 w-full rounded-none !border-0 !border-b !border-white/10 !bg-transparent !text-slate-300 hover:!bg-white/10 hover:!text-white ${compact ? 'justify-center px-0' : 'justify-start gap-3 px-4'}`} onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : undefined}>
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              {!compact && <span className="text-sm font-semibold">Collapse</span>}
            </Button>
          )}
          {isPosWorkspace && !collapsed && (
            <Link href="/dashboard" className="flex h-11 w-full items-center justify-center border-b border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white" title="Back to dashboard"><ChevronLeft size={18} /></Link>
          )}
          <Button type="button" variant="ghost" size="bareIcon" className={`!h-11 w-full rounded-none !border-0 !bg-transparent !text-slate-300 hover:!bg-rose-500/10 hover:!text-rose-300 ${compact ? 'justify-center px-0' : 'justify-start gap-3 px-4'}`} onClick={signOut} title="Log out">
            <LogOut size={18} />{!compact && <span className="text-sm font-semibold">Sign out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
