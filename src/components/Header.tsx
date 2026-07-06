import React, { useState, useEffect } from 'react';
import { Bell, Search, CheckCircle, MailWarning, Award, Target as TargetIcon } from 'lucide-react';
import api from '../services/api.js';
import { useTranslation } from '../context/LanguageContext.tsx';

interface Notification {
  id: number;
  type: string;
  message: string;
  is_read: number;
  created_at: string;
}

interface HeaderProps {
  title: string;
  user: {
    name: string;
    avatar?: string;
    currency?: string;
  } | null;
  onOpenCommandPalette: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, user, onOpenCommandPalette }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { t, language } = useTranslation();

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll notifications every 45 seconds to keep the alert banner fresh
      const interval = setInterval(fetchNotifications, 45000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'budget':
        return <MailWarning className="text-rose-500" size={16} />;
      case 'milestone':
        return <Award className="text-amber-500" size={16} />;
      case 'large_transaction':
        return <CheckCircle className="text-emerald-500" size={16} />;
      default:
        return <TargetIcon className="text-blue-500" size={16} />;
    }
  };

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <h2 className="font-poppins font-bold text-2xl md:text-3xl text-blue-700 dark:text-blue-400 tracking-tight">
          {t(title)}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t("Welcome back")}, {user?.name || 'User'}! {t("Monitor your family assets here.")}
        </p>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
        {/* Ctrl+K Search Bar */}
        <div 
          onClick={onOpenCommandPalette}
          className={`relative flex-1 md:flex-initial glass-panel rounded-full ${
            language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'
          } py-2 text-sm text-slate-400 dark:text-slate-400 cursor-pointer hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all flex items-center h-10 w-full md:w-64 select-none border border-white/40 dark:border-white/10`}
        >
          <Search size={16} className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'}`} />
          <span className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'} text-slate-400`}>
            {t("Search everywhere...")}
          </span>
          <kbd className={`hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 font-sans text-[10px] font-medium text-slate-400 shadow-sm ${
            language === 'ar' ? 'mr-auto' : 'ml-auto'
          }`}>
            Ctrl K
          </kbd>
        </div>

        {/* Notifications Alert Center */}
        <div className="relative">
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="w-10 h-10 rounded-xl glass-panel border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-950/20 flex items-center justify-center cursor-pointer shadow-sm relative text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className={`absolute top-1.5 ${
                language === 'ar' ? 'left-1.5' : 'right-1.5'
              } w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border border-white dark:border-slate-900`} />
            )}
          </button>

          {isNotifOpen && (
            <div className={`absolute ${
              language === 'ar' ? 'left-0' : 'right-0'
            } mt-2 w-80 glass-panel rounded-2xl p-4 shadow-xl z-50 border border-white/50 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 max-h-[380px] overflow-y-auto`}>
              <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-200/50 dark:border-slate-800/50">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  {t("Notifications")} ({unreadCount} {t("unread")})
                </span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t("Mark all read")}
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {t("No notifications yet.")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => notif.is_read === 0 && handleMarkAsRead(notif.id)}
                      className={`flex gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                        notif.is_read === 0 
                          ? 'bg-blue-50/70 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 font-semibold' 
                          : 'opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                      }`}
                    >
                      <div className="mt-0.5">{getNotifIcon(notif.type)}</div>
                      <div className="flex-1 space-y-0.5">
                        <p className={`text-[11px] leading-snug text-slate-700 dark:text-slate-300 ${
                          language === 'ar' ? 'text-right' : 'text-left'
                        }`}>
                          {notif.message}
                        </p>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block">
                          {new Date(notif.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Profile Image */}
        <div 
          onClick={() => window.location.href = '/settings'}
          className="w-10 h-10 rounded-xl overflow-hidden border border-white dark:border-white/10 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 transition-transform"
        >
          <img 
            alt={t("User profile")} 
            className="w-full h-full object-cover" 
            src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60'} 
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
