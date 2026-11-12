import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.js';
import Footer from './Footer.js';
import CartDrawer from './CartDrawer.js';
import CookieBanner from './CookieBanner.js';

export default function Layout() {
  const location = useLocation();

  // LD-SCROLL-RESET: al cambiar de pÃ¡gina, comenzar desde su encabezado.
  // Las bÃºsquedas/categorÃ­as del menÃº conservan su desplazamiento especÃ­fico.
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const hasMenuTarget = location.pathname === '/menu' && (
      query.has('search') || query.has('category')
    );

    if (hasMenuTarget) return;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div data-ld-storefront className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <CookieBanner />
    </div>
  );
}
