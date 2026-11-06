'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  CalendarDays,
  Users,
  ListChecks,
  BriefcaseBusiness,
  Clock3,
  Mail,
  FileText,
  ShieldCheck,
  Video,
  Settings2,
  PanelLeftClose,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAdminLanguage } from './AdminLanguage';
import { workspaceLabel } from '@/lib/v2/ui';
const icons = {
  dashboard: BarChart3,
  calendar: CalendarDays,
  clients: Users,
  tasks: ListChecks,
  bookings: Clock3,
  services: BriefcaseBusiness,
  schedule: Settings2,
  contacts: Mail,
  content: FileText,
  inquiries: Mail,
  staff: Users,
  faq: FileText,
  audit: ShieldCheck,
  video: Video,
};
export default function CrmShell({
  view,
  privileged,
  role,
  onNavigate,
  children,
}: {
  view: string;
  privileged: boolean;
  role: string;
  onNavigate: (view: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const { locale, t: adminT } = useAdminLanguage();
  const t = (s: string) => workspaceLabel(s, locale);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = sidebar.current;
    el?.querySelector<HTMLButtonElement>('button')?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
      if (e.key === 'Tab' && innerWidth <= 960 && el) {
        const controls = Array.from(
          el.querySelectorAll<HTMLElement>('button,a[href]'),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);
  const groups = [
    {
      label: t('Workspace'),
      keys: [
        'dashboard',
        'calendar',
        'bookings',
        'clients',
        'tasks',
        'inquiries',
      ],
    },
    {
      label: t('Management'),
      keys: privileged
        ? [
            'services',
            'schedule',
            'contacts',
            'content',
            'staff',
            'faq',
            'audit',
            'video',
          ]
        : ['staff', 'faq', 'video'],
    },
  ];
  return (
    <div className={`crm-layout ${open ? 'crm-nav-open' : ''}`}>
      <a className="crm-skip" href="#crm-content">
        {t('Skip to content')}
      </a>
      <button
        ref={toggle}
        className="crm-menu button secondary small"
        aria-label={t('Open navigation')}
        aria-expanded={open}
        aria-controls="crm-sidebar"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>
      {open && (
        <div
          className="crm-backdrop"
          onClick={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        />
      )}
      <aside
        id="crm-sidebar"
        className="crm-sidebar"
        ref={sidebar}
        aria-label={t('Navigation')}
      >
        <div className="crm-brand">
          <a href={`/${locale}`} className="logo">
            TaxSolutions<small>ACCOUNTING CRM</small>
          </a>
          <button
            className="crm-close button secondary small"
            aria-label={t('Close navigation')}
            onClick={() => {
              setOpen(false);
              toggle.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label={t('Workspace')}>
          {groups.map((group) => (
            <div className="crm-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.keys.map((key) => {
                const Icon = icons[key as keyof typeof icons] ?? PanelLeftClose;
                const label =
                  key === 'faq' ? 'FAQ' : key[0].toUpperCase() + key.slice(1);
                return (
                  <button
                    key={key}
                    aria-current={view === key ? 'page' : undefined}
                    className={view === key ? 'selected' : ''}
                    onClick={() => {
                      onNavigate(key);
                      setOpen(false);
                      if (innerWidth <= 960)
                        requestAnimationFrame(() =>
                          document.getElementById('crm-content')?.focus(),
                        );
                    }}
                  >
                    <Icon size={18} />
                    <span>
                      {['services', 'schedule', 'contacts', 'content'].includes(
                        key,
                      )
                        ? adminT(key)
                        : t(label)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="crm-sidebar-footer">
          <span className="crm-role">{t(role)} · Europe/Riga</span>
          <button
            className="button secondary small"
            onClick={async () => {
              const r = await fetch('/api/admin/logout', { method: 'POST' });
              if (r.ok) {
                router.replace('/admin');
                router.refresh();
              }
            }}
          >
            <LogOut size={16} />
            {adminT('Sign out')}
          </button>
        </div>
      </aside>
      <main
        className="workspace-shell crm-content"
        id="crm-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
