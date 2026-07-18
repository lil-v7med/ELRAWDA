import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import api from './services/api.js';
import { LanguageProvider, useTranslation } from './context/LanguageContext.tsx';

// Import Pages
import Landing from './pages/Landing.tsx';
import Login from './pages/Login.tsx';
import ForgotPassword from './pages/ForgotPassword.tsx';
import VerifyResetCode from './pages/VerifyResetCode.tsx';
import ResetPassword from './pages/ResetPassword.tsx';
import ResetPasswordSuccess from './pages/ResetPasswordSuccess.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Income from './pages/Income.tsx';
import Expenses from './pages/Expenses.tsx';
import Savings from './pages/Savings.tsx';
import Reports from './pages/Reports.tsx';
import Settings from './pages/Settings.tsx';
import Admin from './pages/Admin.tsx';

// Import Components
import Sidebar from './components/Sidebar.tsx';
import CommandPalette from './components/CommandPalette.tsx';
import Toast, { ToastMessage } from './components/Toast.tsx';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { syncPreferences, t } = useTranslation();

  // Toast notifier helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Re-verify session on boot
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
        
        // Sync preferences via context
        syncPreferences(res.data.user);
      } catch (err) {
        // Clear local storage cache
        localStorage.removeItem('elrawda_user');
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Global Ctrl+K command listener
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    localStorage.setItem('elrawda_user', JSON.stringify(userData));
    syncPreferences(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('elrawda_user');
    localStorage.removeItem('elrawda_theme');
    localStorage.removeItem('elrawda_language');
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('dir', 'ltr');
    showToast(t('Successfully logged out.'), 'success');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 animate-spin flex items-center justify-center text-white font-bold text-xl shadow-md">
            E
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest animate-pulse">
            ELRAWDA Loading...
          </span>
        </div>
      </div>
    );
  }

  // Route guarding components
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return (
      <div className="relative min-h-screen flex text-slate-900 dark:text-slate-100 bg-gradient-animated">
        {/* Unified Desktop/Mobile Sidebar */}
        <Sidebar user={user} onLogout={handleLogout} onUpdateUser={(u) => setUser(u)} />
        
        {/* Content Box */}
        <div className="flex-1 md:ml-64 p-4 md:p-8 min-h-screen pb-24 md:pb-8 overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>
      </div>
    );
  };

  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <ProtectedRoute>{children}</ProtectedRoute>;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing page */}
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        
        {/* Auth page */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <Login onLoginSuccess={handleLoginSuccess} showToast={showToast} />} 
        />
        <Route 
          path="/forgot-password" 
          element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword showToast={showToast} />} 
        />
        <Route 
          path="/verify-reset-code" 
          element={user ? <Navigate to="/dashboard" replace /> : <VerifyResetCode showToast={showToast} />} 
        />
        <Route 
          path="/reset-password" 
          element={user ? <Navigate to="/dashboard" replace /> : <ResetPassword showToast={showToast} />} 
        />
        <Route 
          path="/reset-password-success" 
          element={user ? <Navigate to="/dashboard" replace /> : <ResetPasswordSuccess />} 
        />

        {/* Private Workspace paths */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard user={user} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} showToast={showToast} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/income" 
          element={
            <ProtectedRoute>
              <Income user={user} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} showToast={showToast} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/expenses" 
          element={
            <ProtectedRoute>
              <Expenses user={user} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} showToast={showToast} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/savings" 
          element={
            <ProtectedRoute>
              <Savings user={user} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} showToast={showToast} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute>
              <Reports user={user} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} showToast={showToast} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Settings user={user} onLogout={handleLogout} onUpdateUser={(u) => setUser(u)} showToast={showToast} />
            </ProtectedRoute>
          } 
        />

        {/* Admin protected paths */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <Admin user={user} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} showToast={showToast} />
            </AdminRoute>
          } 
        />

        {/* Fallbacks */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Modals / Palettes */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
        isAdmin={user?.role === 'admin'} 
      />

      {/* Global toast notification system */}
      <Toast toasts={toasts} onClose={removeToast} />
    </BrowserRouter>
  );
};

const AppRoot: React.FC = () => {
  return (
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
};

export default AppRoot;
