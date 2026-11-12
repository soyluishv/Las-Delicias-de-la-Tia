import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

type Role = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
  children?: { path: string; label: string; roles?: Role[] }[];
}

const navItems: NavItem[] = [
  { path: '/', label: 'Inicio', icon: '⌂', roles: ['SUPER_ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/orders', label: 'Pedidos', icon: '▤', roles: ['SUPER_ADMIN', 'MANAGER', 'STAFF'] },
  { path: '/events', label: 'Eventos especiales', icon: '✦', roles: ['SUPER_ADMIN', 'MANAGER'] },
  { path: '/delivery-zones', label: 'Domicilios', icon: '◎', roles: ['SUPER_ADMIN', 'MANAGER'] },
  {
    path: '/menu',
    label: 'Menú',
    icon: '☰',
    roles: ['SUPER_ADMIN', 'MANAGER'],
    children: [
      { path: '/menu/items', label: 'Productos' },
      { path: '/menu/categories', label: 'Categorías' },
    ],
  },
  {
    path: '/settings', label: 'Configuración', icon: '⚙', roles: ['SUPER_ADMIN', 'MANAGER'],
    children: [
      { path: '/settings/general', label: 'Datos del negocio' },
      { path: '/settings/homepage', label: 'Portada de la tienda' },
      { path: '/settings/social-links', label: 'Redes sociales y enlaces' },
      { path: '/settings/storefront-content', label: 'Contenido de la tienda' },
      { path: '/design/media', label: 'Biblioteca multimedia' },
      { path: '/design/gallery', label: 'Galería de fotografías' },
      { path: '/settings/theme', label: 'Diseño visual de la tienda' },
      { path: '/settings/restore-template', label: 'Plantilla original', roles: ['SUPER_ADMIN'] },
      { path: '/design/pages', label: 'Constructor de portada' },
      { path: '/design/branding', label: 'Identidad visual', roles: ['SUPER_ADMIN'] },
      { path: '/settings/hours', label: 'Horarios' },
      { path: '/settings/location', label: 'Dirección privada', roles: ['SUPER_ADMIN'] },
      { path: '/settings/orders', label: 'Pedidos y recogidas' },
      { path: '/settings/payment', label: 'Medios de pago', roles: ['SUPER_ADMIN'] },
    ],
  },
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

const FALLBACK_BUSINESS_NAME = 'Las Delicias de la Tía';
const FALLBACK_LOGO = '/brand/las-delicias-de-la-tia-logo.png';

interface PublicSettingsResponse {
  success?: boolean;
  data?: {
    siteName?: string;
    logo?: string | null;
  };
}

export default function AdminLayout({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  onLogout?: () => void;
}) {
  const location = useLocation();
  const { user, token } = useAuth();
  const [pendingEventCount, setPendingEventCount] = useState(0);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [businessName, setBusinessName] = useState(FALLBACK_BUSINESS_NAME);
  const [businessLogo, setBusinessLogo] = useState(FALLBACK_LOGO);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredNav = user
    ? navItems.filter((item) => item.roles.includes(user.role as Role))
    : [];

  // Read the public business identity so the sidebar reflects the configured name and logo.
  useEffect(() => {
    let isActive = true;

    async function fetchBusinessIdentity() {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) return;

        const result = (await response.json()) as PublicSettingsResponse;
        if (!isActive || !result.success || !result.data) return;

        if (typeof result.data.siteName === 'string' && result.data.siteName.trim()) {
          setBusinessName(result.data.siteName.trim());
        }
        if (typeof result.data.logo === 'string' && result.data.logo.trim()) {
          setBusinessLogo(result.data.logo.trim());
        }
      } catch {
        // Keep the local business identity when the settings API is unavailable.
      }
    }

    void fetchBusinessIdentity();
    return () => {
      isActive = false;
    };
  }, []);

  // Refresh pending event requests while an administrator is using the panel.
  useEffect(() => {
    if (!token || (user?.role !== 'SUPER_ADMIN' && user?.role !== 'MANAGER')) {
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

        const data = (await response.json()) as {
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

// Keep the number of new orders visible while the administrator uses any panel screen.
useEffect(() => {
  if (!token || !user || !['SUPER_ADMIN', 'MANAGER', 'STAFF'].includes(user.role)) {
    setPendingOrderCount(0);
    return;
  }

  let isActive = true;
  async function fetchPendingOrders() {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [pendingResponse, confirmedResponse] = await Promise.all([
        fetch('/api/admin/orders?view=kitchen&status=PENDING&limit=1&page=1', { headers }),
        fetch('/api/admin/orders?view=kitchen&status=CONFIRMED&limit=1&page=1', { headers }),
      ]);
      if (!pendingResponse.ok || !confirmedResponse.ok) return;

      const [pendingData, confirmedData] = await Promise.all([
        pendingResponse.json() as Promise<{ success?: boolean; pagination?: { total?: number } }>,
        confirmedResponse.json() as Promise<{ success?: boolean; pagination?: { total?: number } }>,
      ]);
      if (!pendingData.success || !confirmedData.success) return;

      const pending = Number(pendingData.pagination?.total ?? 0);
      const confirmed = Number(confirmedData.pagination?.total ?? 0);
      if (isActive && Number.isFinite(pending) && Number.isFinite(confirmed)) {
        setPendingOrderCount(pending + confirmed);
      }
    } catch {
      // Conserva el último contador conocido si la API no está disponible temporalmente.
    }
  }

  void fetchPendingOrders();
  const interval = window.setInterval(() => {
    void fetchPendingOrders();
  }, 15000);

  return () => {
    isActive = false;
    window.clearInterval(interval);
  };
}, [token, user?.role]);

  // Cierra el menu movil al cambiar de pantalla.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // En movil, Escape cierra el menu y el fondo no se desplaza mientras esta abierto.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  // Close the user menu when clicking outside it.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isManagerPlus = user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-gray-50 flex">
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Cerrar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[88vw] min-w-0 flex-col overflow-y-auto bg-[#2B1720] text-white shadow-xl transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:z-auto md:min-h-screen md:w-72 md:min-w-[18rem] md:max-w-none md:translate-x-0 md:shadow-none`}
        role="navigation"
        aria-label="Navegación principal"
      >
        <div className="px-4 py-5 border-b border-white/10 bg-[#2B1720]">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 shrink-0 overflow-hidden rounded-xl bg-white p-1 shadow-lg">
              <img
                src={businessLogo}
                alt={`Logo de ${businessName}`}
                className="w-full h-full object-contain"
                onError={() => setBusinessLogo(FALLBACK_LOGO)}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-tight text-white truncate">
                {businessName}
              </h1>
              <p className="mt-1 text-xs text-[#F4B9C3]">Panel de administración</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-4 pb-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            aria-label="Cerrar menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cerrar
          </button>
        </div>
        <nav className="flex-1 py-4">
          {filteredNav.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`) || Boolean(item.children?.some((child) => location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)));

            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-6 py-3 text-sm transition-colors ${isActive
                    ? 'bg-[#49303A] text-[#F2C8B7] border-r-2 border-[#D8A58E]'
                    : 'text-[#F0E5E1] hover:bg-[#49303A] hover:text-white'
                  }`}
                >
                  <span className="mr-3 w-5 text-center" aria-hidden="true">{item.icon}</span>
                  {item.label}
                  {item.path === '/events' && pendingEventCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      {pendingEventCount > 99 ? '99+' : pendingEventCount}
                    </span>
                  )}
                </Link>

                {item.children && isActive && (
                  <div className="bg-[#21131A] py-1">
                    {item.children.filter((child) => !child.roles || (user && child.roles.includes(user.role as Role))).map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block pl-14 pr-6 py-2 text-xs transition-colors ${location.pathname.startsWith(child.path)
                          ? 'text-[#F2C8B7]'
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

        {user && (
          <div className="px-6 py-4 border-t border-gray-700">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role as Role]}`}>
              {ROLE_LABELS[user.role as Role] ?? 'Usuario'}
            </span>
          </div>
        )}
      </aside>

      <div className="min-w-0 w-full flex-1 flex flex-col">
        <header className="min-w-0 bg-white border-b border-[#E8DDD7] px-3 py-3 flex items-center justify-between gap-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#E8DDD7] p-2 text-[#2B1720] hover:bg-[#FBF8F6] md:hidden"
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="min-w-0 truncate text-sm font-semibold text-[#2B1720] md:hidden">{businessName}</span>
          </div>

<div className="flex items-center gap-3">
  {pendingOrderCount > 0 && (
    <Link
      to="/orders"
      className="relative p-2 text-gray-400 transition-colors hover:text-[#A71942]"
      title={`${pendingOrderCount} pedidos nuevos por aceptar`}
      aria-label={`${pendingOrderCount} pedidos nuevos por aceptar`}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0H9m6 0v1a3 3 0 11-6 0v-1" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
        {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
      </span>
    </Link>
  )}
  {isManagerPlus && pendingEventCount > 0 && (
              <Link
                to="/events"
                className="relative p-2 text-gray-400 transition-colors hover:text-[#A71942]"
                title="Solicitudes de eventos pendientes"
                aria-label={`${pendingEventCount} solicitudes de eventos pendientes`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {pendingEventCount > 99 ? '99+' : pendingEventCount}
                </span>
              </Link>
            )}

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

            <div className="w-px h-6 bg-gray-200" />

            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Menú de usuario"
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
                    <Link
                      to="/account/security"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Seguridad de la cuenta
                    </Link>
                    {isManagerPlus && (
                      <Link
                        to="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Configuración
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
                        Cerrar sesión
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 w-full flex-1 overflow-x-auto bg-[#FBF8F6] p-3 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
