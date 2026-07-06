import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Coins, 
  Receipt, 
  Target, 
  BarChart3, 
  Settings as SettingsIcon, 
  ShieldAlert, 
  LogOut,
  Sun,
  Moon,
  Gem
} from 'lucide-react';
import api from '../services/api.js';
import { useTranslation } from '../context/LanguageContext.tsx';

interface SidebarProps {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    currency?: string;
    language?: string;
    theme?: string;
    date_format?: string;
  } | null;
  onLogout: () => void;
  onUpdateUser?: (userData: any) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { t, language, setLanguage, theme, setTheme } = useTranslation();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      onLogout();
      navigate('/login');
    }
  };

  const navLinks = [
    { label: t('Overview'), path: '/dashboard', icon: LayoutDashboard },
    { label: t('Income'), path: '/income', icon: Coins },
    { label: t('Expenses'), path: '/expenses', icon: Receipt },
    { label: t('Goals'), path: '/savings', icon: Target },
    { label: t('Reports'), path: '/reports', icon: BarChart3 },
    { label: t('Settings'), path: '/settings', icon: SettingsIcon },
  ];

  // Conditional Admin Panel link
  if (user && user.role === 'admin') {
    navLinks.push({ label: t('Admin Board'), path: '/admin', icon: ShieldAlert });
  }

  const isLinkActive = (path: string) => {
    return currentPath === path;
  };

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 glass-panel border-r border-white/40 z-40 p-4 gap-2 transition-all duration-300">
        {/* Branding header */}
        <div className="flex items-center gap-3 px-4 py-6 mb-4 border-b border-white/20">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-poppins font-bold text-xl shadow-md">
            E
          </div>
          <div>
            <h1 className="font-poppins font-bold text-lg text-blue-600 dark:text-blue-400 tracking-tight">{t('ELRAWDA')}</h1>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider -mt-1">{t('Wealth Management')}</p>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
          {navLinks.map((link) => {
            const IconComp = link.icon;
            const active = isLinkActive(link.path);
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:scale-[1.02] transition-all duration-200 text-left font-medium text-sm w-full ${
                  active 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-660 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10'
                }`}
              >
                <IconComp size={18} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="mt-auto pt-4 flex flex-col gap-2 border-t border-white/20">
        

          <button 
            onClick={() => navigate('/settings')}
            className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mb-2 shadow-md"
          >
            {t("Upgrade Plan")}
            <Gem size={14} />
          </button>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 text-sm text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all w-full text-left font-medium"
          >
            <LogOut size={16} />
            <span>{t("Logout")}</span>
          </button>
        </div>
      </nav>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/70 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50 z-50 flex justify-around items-center px-2">
        {navLinks.slice(0, 5).map((link) => {
          const IconComp = link.icon;
          const active = isLinkActive(link.path);
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
                active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <IconComp size={20} />
              <span className="text-[10px] font-medium mt-1">{link.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => navigate('/settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-colors ${
            isLinkActive('/settings') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <SettingsIcon size={20} />
          <span className="text-[10px] font-medium mt-1">{t('Settings')}</span>
        </button>
      </nav>
    </>
  );
};

export default Sidebar;
