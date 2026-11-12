import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

type Role = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
  children?: { path: string; label: string }[];
}

const navItems: NavItem[] = [
  { path: '/', label: 'Panel principal', icon: '\u25A1', roles: ['SUPER_ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/orders', label: 'Pedidos', icon: '\uD83D\uDCCB', roles: ['SUPER_ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/events', label: 'Eventos', icon: '🎉', roles: ['SUPER_ADMIN', 'MANAGER'] },
  { path: '/reviews', label: 'Reseñas', icon: '\u2B50', roles: ['SUPER_ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/kitchen', label: 'Cocina', icon: '\uD83C\uDF73', roles: ['SUPER_ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/locations', label: 'Ubicaciones', icon: '\u25CE', roles: ['SUPER_ADMIN', 'MANAGER'] },
  {
    path: '/menu',
    label: 'Menú',
    icon: '\u2630',
    roles: ['SUPER_ADMIN', 'MANAGER'],
    children: [
      { path: '/menu/items', label: 'Productos' },
      { path: '/menu/categories', label: 'Categorías' },
    ],
  },
  { path: '/coupons', label: 'Cupones', icon: '\uD83C\uDFF7', roles: ['SUPER_ADMIN', 'MANAGER'] },
  { path: '/automation', label: 'Automatización', icon: '\u26A1', roles: ['SUPER_ADMIN', 'MANAGER'] },
  { path: '/loyalty', label: 'Fidelización', icon: '\uD83C\uDF81', roles: ['SUPER_ADMIN', 'MANAGER'] },
  {
    path: '/design',
    label: 'Diseño',
    icon: '\uD83C\uDFA8',
    roles: ['SUPER_ADMIN', 'MANAGER'],
    children: [
      { path: '/design/landing', label: 'Página de inicio' },
      { path: '/design/branding', label: 'Identidad de marca' },
      { path: '/design/theme', label: 'Tema' },
      { path: '/design/templates', label: 'Plantillas' },
      { path: '/design/gallery', label: 'Galería' },
      { path: '/design/media', label: 'Biblioteca multimedia' },
    ],
  },
  {
    path: '/legal',
    label: 'Legal',
    icon: '\u2696',
    roles: ['SUPER_ADMIN', 'MANAGER'],
    children: [
      { path: '/legal/pages', label: 'Páginas' },
      { path: '/legal/cookies', label: 'Categorías de cookies' },
      { path: '/legal/consent', label: 'Registro de consentimientos' },
    ],
  },
  { path: '/settings', label: 'Configuración', icon: '\u2699', roles: ['SUPER_ADMIN', 'MANAGER'] },
  {
    path: '/developer',
    label: 'Herramientas técnicas',
    icon: '\uD83D\uDEE0',
    roles: ['SUPER_ADMIN', 'MANAGER'],
    children: [
      { path: '/developer/metrics', label: 'Métricas de API' },
      { path: '/developer/audit-log', label: 'Registro de auditoría' },
    ],
  },
  { path: '/staff', label: 'Personal', icon: '\uD83D\uDC65', roles: ['SUPER_ADMIN'] },
];

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'bg-red-500/20 text-red-300',
  MANAGER: 'bg-blue-500/20 text-blue-300',
  STAFF: 'bg-gray-500/20 text-gray-300',
};

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Superadministrador',
  MANAGER: 'Gerente',
  STAFF: 'Personal',
};

export default function AdminLayout({ children, onLogout }: { children: React.ReactNode; onLogout?: () => void }) {
  const location = useLocation();
  const { user, token } = useAuth();
  const [pendingEventCount, setPendingEventCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredNav = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  // Refresh pending event requests while an administrator is using the panel.
  // The badge is updated immediately and then every 60 seconds.
  useEffect(() => {
    if (
      !token ||
      (user?.role !== 'SUPER_ADMIN' && user?.role !== 'MANAGER')
    ) {
      setPendingEventCount(0);
      return;
    }

    let isActive = true;

    async function fetchPendingEvents() {
      try {
        const response = await fetch('/api/admin/events?status=PENDING&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const data = await response.json() as {
          success?: boolean;
          pagination?: { total?: number };
        };

        if (!data.success || !data.pagination) return;

        const total = Number(data.pagination.total ?? 0);
        if (isActive && Number.isFinite(total)) {
          setPendingEventCount(total);
        }
      } catch {
        // Keep the last known count if the API is temporarily unavailable.
      }
    }

    void fetchPendingEvents();
    const interval = window.setInterval(() => {
      void fetchPendingEvents();
    }, 60000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [token, user?.role]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isManagerPlus = user && (user.role === 'SUPER_ADMIN' || user.role === 'MANAGER');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-72 min-w-[18rem] bg-[#24131B] text-white flex flex-col" role="navigation" aria-label="Main navigation">
        <div className="px-4 py-5 border-b border-white/10 bg-[#24131B]">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 shrink-0 overflow-hidden rounded-xl bg-white p-1 shadow-lg">
              <img
                src="/brand/las-delicias-de-la-tia-logo.png"
                alt="Las Delicias de la Tía"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-tight text-white">
                Las Delicias de la Tía
              </h1>
              <p className="mt-1 text-xs text-[#F4B9C3]">
                Panel de administración
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          {filteredNav.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            return (
              <div key={item.path}>
                <Link
                  to={item.children ? item.children[0].path : item.path}
                  className={`flex items-center px-6 py-3 text-sm transition-colors ${isActive
                    ? 'bg-[#3B1D29] text-[#F4B9C3] border-r-2 border-[#D88A9B]'
                    : 'text-[#E9DCE0] hover:bg-[#3B1D29] hover:text-white'
                    }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
                {item.children && isActive && (
                  <div className="bg-gray-950">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`block pl-14 pr-6 py-2 text-xs transition-colors ${location.pathname.startsWith(child.path)
                          ? 'text-primary-400'
                          : 'text-gray-400 hover:text-white'
                          }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User info at bottom of sidebar */}
        {user && (
          <div className="px-6 py-4 border-t border-gray-700">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            {/* Notificación de solicitudes de eventos pendientes */}
            {isManagerPlus && (
              <Link
                to="/events"
                className="relative p-2 text-gray-400 transition-colors hover:text-[#A71942]"
                title="Solicitudes de eventos pendientes. Se actualiza automáticamente cada minuto."
                aria-label={`Solicitudes de eventos pendientes: ${pendingEventCount}`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="sr-only" aria-live="polite">
                  {pendingEventCount > 0
                    ? `${pendingEventCount} solicitudes de eventos pendientes`
                    : 'No hay solicitudes de eventos pendientes'}
                </span>
                {pendingEventCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white" aria-hidden="true">
                    {pendingEventCount > 99 ? '99+' : pendingEventCount}
                  </span>
                )}
              </Link>
            )}

            {/* Settings gear */}
            {isManagerPlus && (
              <Link
                to="/settings"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Configuración"
                aria-label="Configuración"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            )}

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200" />

            {/* User avatar + dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 font-medium hidden sm:block">{user.name}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {isManagerPlus && (
                      <Link
                        to="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Settings
                      </Link>
                    )}
                    {onLogout && (
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onLogout();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Logout
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
