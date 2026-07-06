import React, { useState } from 'react';
import { Settings as SettingsIcon, User, Lock, Trash2, ShieldAlert, Sparkles, Download, Upload, CheckCircle2 } from 'lucide-react';
import api from '../services/api.js';
import { useTranslation } from '../context/LanguageContext.tsx';

interface SettingsProps {
  user: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    currency?: string;
    language?: string;
    theme?: string;
    date_format?: string;
  } | null;
  onLogout: () => void;
  onUpdateUser: (userData: any) => void;
  showToast: any;
}

const Settings: React.FC<SettingsProps> = ({ user, onLogout, onUpdateUser, showToast }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [currency, setCurrency] = useState(user?.currency || '$');
  const [language, setLanguage] = useState(user?.language || 'en');
  const [theme, setTheme] = useState(user?.theme || 'light');
  const [dateFormat, setDateFormat] = useState(user?.date_format || 'YYYY-MM-DD');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.put('/auth/profile', {
        name,
        avatar,
        currency,
        language,
        theme,
        date_format: dateFormat
      });

      onUpdateUser(res.data.user);
      showToast(t('Settings saved successfully!'), 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to save settings.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast(t('Passwords do not match.'), 'error');
      return;
    }

    setLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      showToast(t('Password updated successfully!'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to update password.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupDownload = () => {
    window.open('/api/auth/backup', '_blank');
    showToast(t('Secure database backup file downloaded successfully.'), 'success');
  };

  const handleRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          await api.post('/auth/restore', { backupData: parsed });
          showToast(t('Database restore completed successfully! Refreshing database...'), 'success');
          // Reload page to reflect changes
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (err) {
          showToast(t('Invalid backup file format.'), 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.post('/auth/delete-account');
      showToast(t('Account permanently deleted. Goodbye!'), 'success');
      onLogout();
    } catch (err) {
      showToast(t('Failed to delete account.'), 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <header className="mb-4">
        <h2 className="font-poppins font-bold text-2xl text-blue-700 dark:text-blue-400 tracking-tight">{t("System Settings")}</h2>
        <p className="text-xs text-slate-500 mt-1">{t("Configure themes, language parameters, and database backup routines.")}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Preferences */}
        <div className="glass-panel rounded-3xl p-6 shadow-sm bg-white/40 dark:bg-slate-900/40 lg:col-span-2 space-y-6">
          <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5 border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
            <User size={16} className="text-blue-500" />
            {t("General Profile & Settings")}
          </h3>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t("Display Name")}</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t("Avatar Image URL")}</label>
                <input
                  type="text"
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-955 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t("Primary Currency")}</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="$">{t("US Dollar ($)")}</option>
                  <option value="€">{t("Euro (€)")}</option>
                  <option value="£">{t("British Pound (£)")}</option>
                  <option value="EGP">{t("Egyptian Pound (EGP)")}</option>
                  <option value="SAR">{t("Saudi Riyal (SAR)")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t("Display Theme")}</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="light">{t("Light Mode")}</option>
                  <option value="dark">{t("Dark Mode")}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t("Language")}</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">{t("English")}</option>
                  <option value="ar">{t("Arabic")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t("Date Format")}</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              {t("Save Preferences")}
            </button>
          </form>
        </div>

        {/* Right column: Security controls */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Password update card */}
          <div className="glass-panel rounded-3xl p-6 shadow-sm bg-white/40 dark:bg-slate-900/40 space-y-4">
            <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5 border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
              <Lock size={16} className="text-blue-500" />
              {t("Update Password")}
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">{t("Current Password")}</label>
                <input
                  required
                  type="password"
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-lg focus:outline-none"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">{t("New Password")}</label>
                <input
                  required
                  type="password"
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-lg focus:outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">{t("Confirm New Password")}</label>
                <input
                  required
                  type="password"
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-lg focus:outline-none"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                {t("Update Password")}
              </button>
            </form>
          </div>

          {/* Database Backup / Import */}
          <div className="glass-panel rounded-3xl p-6 shadow-sm bg-white/40 dark:bg-slate-900/40 space-y-4">
            <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5 border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
              <Sparkles size={16} className="text-blue-500" />
              {t("Backup & Restore")}
            </h3>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleBackupDownload}
                className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white/40 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-semibold text-xs flex justify-center items-center gap-1.5 transition-colors"
              >
                <Download size={14} />
                <span>{t("Download Backup")}</span>
              </button>

              <div className="relative w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white/40 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-semibold text-xs flex justify-center items-center gap-1.5 transition-colors cursor-pointer text-center">
                <input
                  type="file"
                  accept="application/json"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleRestoreUpload}
                />
                <Upload size={14} />
                <span>{t("Restore Backup")}</span>
              </div>
            </div>
          </div>

          {/* Delete account panel */}
          <div className="glass-panel rounded-3xl p-6 shadow-sm bg-white/40 dark:bg-slate-900/40 border-t-4 border-rose-500 space-y-3">
            <h3 className="font-poppins font-bold text-sm text-rose-500 flex items-center gap-1.5">
              <ShieldAlert size={16} />
              {t("Danger Zone")}
            </h3>
            <p className="text-[10px] text-slate-500 leading-snug">
              {t("Permanent deletion will remove all asset records, income entries, goal progress, and profile configurations cascadingly. This action cannot be undone.")}
            </p>
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              {t("Permanently Delete Account")}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Warning Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setIsDeleteOpen(false)} />
          <div className="relative w-full max-w-sm glass-panel p-6 rounded-3xl shadow-2xl bg-white/95 dark:bg-slate-900/95 text-center">
            <Trash2 size={36} className="mx-auto text-rose-500 mb-2" />
            <h3 className="font-poppins font-bold text-slate-850 dark:text-white">{t("Delete Portfolio Account?")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {t("Confirming this will clear all user assets, invoices, budgets, and access tokens permanently from the system DB.")}
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-650 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md"
              >
                {t("Permanently Delete Account")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
