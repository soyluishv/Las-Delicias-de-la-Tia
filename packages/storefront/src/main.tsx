import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { CartProvider } from './context/CartContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import Layout from './components/Layout.js';
import Home from './pages/Home.js';
import Menu from './pages/Menu.js';
import Checkout from './pages/Checkout.js';
import OrderConfirmation from './pages/OrderConfirmation.js';
import Events from './pages/Events.js';
import Gallery from './pages/Gallery.js';
import OrderStatus from './pages/OrderStatus.js';
import PrivacyPolicy from './pages/PrivacyPolicy.js';
import Impressum from './pages/Impressum.js';
import NotFound from './pages/NotFound.js';
import './i18n/index.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <CartProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/locations" element={<Navigate to="/" replace />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/reservations" element={<Navigate to="/events" replace />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/events" element={<Events />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:id" element={<OrderConfirmation />} />
            {/* Customer accounts are not part of the initial guest-checkout launch. */}
            <Route path="/login" element={<Navigate to="/menu" replace />} />
            <Route path="/register" element={<Navigate to="/menu" replace />} />
            <Route path="/auth/callback" element={<Navigate to="/menu" replace />} />
            <Route path="/account/*" element={<Navigate to="/menu" replace />} />
            <Route path="/orders/:id" element={<OrderStatus />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </CartProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
