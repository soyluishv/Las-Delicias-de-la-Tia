import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import AdminLayout from './components/AdminLayout.js';
import RequireRole from './components/RequireRole.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import CategoryList from './pages/CategoryList.js';
import CategoryForm from './pages/CategoryForm.js';
import MenuItemList from './pages/MenuItemList.js';
import MenuItemForm from './pages/MenuItemForm.js';
import OrderList from './pages/OrderList.js';
import OrderDetailPage from './pages/OrderDetail.js';
import EventRequests from './pages/EventRequests.js';
import EventRequestDetail from './pages/EventRequestDetail.js';
import DeliveryZoneList from './pages/DeliveryZoneList.js';
import DesignBranding from './pages/DesignBranding.js';
import DesignMedia from './pages/DesignMedia.js';
import DesignGallery from './pages/DesignGallery.js';
import AccountSecurity from './pages/AccountSecurity.js';
import Settings from './pages/Settings.js';
import SettingsGeneral from './pages/SettingsGeneral.js';
import SettingsHomepage from './pages/SettingsHomepage.js';
import SettingsPayments from './pages/SettingsPayments.js';
import SocialLinks from './pages/SocialLinks.js';
import StorefrontContentSettings from './pages/StorefrontContentSettings.js';
import DesignTheme from './pages/DesignTheme.js';
import PageBuilder from './pages/PageBuilder.js';
import TemplateRestore from './pages/TemplateRestore.js';
import SettingsDraft from './pages/SettingsDraft.js';
import './index.css';

function AppRoutes() {
  const { token, user, loading, login, logout } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#2B1720]"><div className="h-9 w-9 animate-spin rounded-full border-4 border-[#E9B9A9] border-t-transparent" /></div>;
  if (!token || !user) return <Routes><Route path="*" element={<Login onLogin={login} />} /></Routes>;

  return (
    <AdminLayout onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<OrderList />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/events" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><EventRequests /></RequireRole>} />
        <Route path="/events/:id" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><EventRequestDetail /></RequireRole>} />
        <Route path="/delivery-zones" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><DeliveryZoneList /></RequireRole>} />
        <Route path="/menu" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><Navigate to="/menu/items" replace /></RequireRole>} />
        <Route path="/menu/items" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><MenuItemList /></RequireRole>} />
        <Route path="/menu/items/new" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><MenuItemForm /></RequireRole>} />
        <Route path="/menu/items/:id" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><MenuItemForm /></RequireRole>} />
        <Route path="/menu/categories" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><CategoryList /></RequireRole>} />
        <Route path="/menu/categories/new" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><CategoryForm /></RequireRole>} />
        <Route path="/menu/categories/:id" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><CategoryForm /></RequireRole>} />
        <Route path="/settings" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><Settings /></RequireRole>} />
        <Route path="/settings/general" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><SettingsGeneral /></RequireRole>} />
        <Route path="/settings/homepage" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><SettingsHomepage /></RequireRole>} />
        <Route path="/settings/social-links" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><SocialLinks /></RequireRole>} />
        <Route path="/settings/storefront-content" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><StorefrontContentSettings /></RequireRole>} />
        <Route path="/settings/theme" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><DesignTheme /></RequireRole>} />
        <Route path="/settings/restore-template" element={<RequireRole roles={['SUPER_ADMIN']}><TemplateRestore /></RequireRole>} />
        <Route path="/design/media" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><DesignMedia /></RequireRole>} />
        <Route path="/design/gallery" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><DesignGallery /></RequireRole>} />
        <Route path="/design/pages" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><PageBuilder /></RequireRole>} />
        <Route path="/settings/branding" element={<RequireRole roles={['SUPER_ADMIN']}><DesignBranding /></RequireRole>} />
        <Route path="/design/branding" element={<RequireRole roles={['SUPER_ADMIN']}><DesignBranding /></RequireRole>} />
        <Route path="/settings/hours" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><SettingsDraft section="hours" /></RequireRole>} />
        <Route path="/settings/location" element={<RequireRole roles={['SUPER_ADMIN']}><SettingsDraft section="location" /></RequireRole>} />
        <Route path="/settings/orders" element={<RequireRole roles={['SUPER_ADMIN', 'MANAGER']}><SettingsDraft section="orders" /></RequireRole>} />
        <Route path="/settings/payment" element={<RequireRole roles={['SUPER_ADMIN']}><SettingsPayments /></RequireRole>} />
        <Route path="/account/security" element={<AccountSecurity />} />
        <Route path="/staff/*" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminLayout>
  );
}

function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
