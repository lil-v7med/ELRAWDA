import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, Database, FileText, ChevronDown, CheckCircle } from 'lucide-react';
import api from '../services/api.js';
import Header from '../components/Header.tsx';
import { useTranslation } from '../context/LanguageContext.tsx';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  user_email?: string;
  user_name?: string;
}

interface Telemetry {
  users: number;
  incomeRows: number;
  expenseRows: number;
  savingsGoals: number;
  auditLogs: number;
  dbStatus: string;
  environment: string;
}

const Admin: React.FC<{ user: any; onOpenCommandPalette: () => void; showToast: any }> = ({ user, onOpenCommandPalette, showToast }) => {
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [logsList, setLogsList] = useState<AuditLog[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  const fetchAdminData = async () => {
    try {
      const [usersRes, logsRes, telRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/audit-logs'),
        api.get('/admin/telemetry')
      ]);
      setUsersList(usersRes.data.users);
      setLogsList(logsRes.data.logs);
      setTelemetry(telRes.data.telemetry);
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to load admin logs.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleChangeRole = async (userId: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(t("Are you sure you want to change this user's role?") + ` (${newRole.toUpperCase()})?`)) return;

    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      showToast(t('User authorization role updated.'), 'success');
      fetchAdminData();
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to alter user role.'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Header title="Admin Board" user={user} onOpenCommandPalette={onOpenCommandPalette} />

      {/* Database Telemetry Grid */}
      {telemetry && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="glass-panel p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30 shadow-sm text-left rtl:text-right">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">{t("System Users")}</span>
            <span className="font-poppins font-extrabold text-xl text-slate-850 dark:text-white mt-1 block">{telemetry.users}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30 shadow-sm text-left rtl:text-right">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">{t("Total Income")}</span>
            <span className="font-poppins font-extrabold text-xl text-slate-850 dark:text-white mt-1 block">{telemetry.incomeRows}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30 shadow-sm text-left rtl:text-right">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">{t("Total Expenses")}</span>
            <span className="font-poppins font-extrabold text-xl text-slate-850 dark:text-white mt-1 block">{telemetry.expenseRows}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30 shadow-sm border-l-4 border-emerald-500 rtl:border-l-0 rtl:border-r-4 text-left rtl:text-right">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block flex items-center gap-1">
              <CheckCircle size={10} className="text-emerald-500" />
              {t("Database Health")}
            </span>
            <span className="font-poppins font-extrabold text-sm text-emerald-600 dark:text-emerald-450 mt-1.5 block">{t(telemetry.dbStatus) || telemetry.dbStatus}</span>
          </div>
        </div>
      )}

      {/* Main Admin Panels: User management & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User grid directory (1/3 width) */}
        <div className="glass-panel rounded-3xl p-6 card-shadow bg-white/40 dark:bg-slate-900/40 lg:col-span-1 space-y-4">
          <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5 border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
            <Users size={16} className="text-blue-500" />
            {t("Users Management")}
          </h3>

          <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
            {usersList.map((u) => (
              <div key={u.id} className="flex justify-between items-center p-3 rounded-xl border border-white/50 dark:border-white/5 bg-white/40 dark:bg-slate-950/10">
                <div className="flex gap-2.5 items-center">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100">
                    <img src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'} alt={t("Avatar")} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-[10px] truncate max-w-[120px] text-left rtl:text-right">
                    <p className="font-bold text-slate-800 dark:text-white">{u.name}</p>
                    <p className="text-slate-450 dark:text-slate-400 font-semibold">{u.email}</p>
                  </div>
                </div>

                {/* Role switch toggle */}
                <button
                  onClick={() => handleChangeRole(u.id, u.role)}
                  disabled={u.id === user.id} // prevent self demotion
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold shadow-sm ${
                    u.role === 'admin' 
                      ? 'bg-purple-100 text-purple-650 hover:bg-purple-200' 
                      : 'bg-slate-100 text-slate-650 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {u.role.toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* System audit log center (2/3 width) */}
        <div className="glass-panel rounded-3xl p-6 card-shadow bg-white/40 dark:bg-slate-900/40 lg:col-span-2 space-y-4">
          <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5 border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
            <Database size={16} className="text-blue-500" />
            {t("Security Audit Trail Logs")}
          </h3>

          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className={`border-b border-slate-200/40 dark:border-slate-800/40 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ${
                  language === 'ar' ? 'text-right' : 'text-left'
                }`}>
                  <th className={`pb-2.5 ${language === 'ar' ? 'pr-2' : 'pl-2'}`}>{t("Date")}</th>
                  <th className="pb-2.5">{t("Operator")}</th>
                  <th className="pb-2.5">{t("Action Log")}</th>
                  <th className={`pb-2.5 ${language === 'ar' ? 'text-left pl-2' : 'text-right pr-2'}`}>{t("IP Origin")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/40 dark:divide-slate-800/40 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                {logsList.map((log) => (
                  <tr key={log.id} className="hover:bg-white/20 dark:hover:bg-slate-800/20 transition-colors">
                    <td className={`py-2.5 ${language === 'ar' ? 'pr-2' : 'pl-2'} text-slate-450 truncate max-w-[125px]`}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(log.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 font-semibold text-slate-800 dark:text-white truncate max-w-[80px] text-left rtl:text-right">
                      {log.user_email || 'System'}
                    </td>
                    <td className="py-2.5 font-bold text-blue-650 dark:text-blue-400 text-left rtl:text-right">{t(log.action) || log.action}</td>
                    <td className={`py-2.5 ${
                      language === 'ar' ? 'text-left pl-2' : 'text-right pr-2'
                    } text-slate-500`}>{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Admin;
