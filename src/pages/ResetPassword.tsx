import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Check, X, ShieldAlert } from 'lucide-react';
import api from '../services/api.js';
import { useTranslation } from '../context/LanguageContext.tsx';

interface ResetPasswordProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ showToast }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const resetToken = sessionStorage.getItem('elrawda_reset_token') || '';

  useEffect(() => {
    if (!resetToken) {
      showToast(t("Invalid or expired reset token."), 'error');
      navigate('/forgot-password');
    }
  }, [resetToken]);

  // Validation rules check
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  // Score computation
  const score = Object.values(checks).filter(Boolean).length;

  const getStrengthInfo = () => {
    switch (score) {
      case 0:
      case 1:
        return { text: t("Weak"), color: "bg-red-500", textClass: "text-red-500", width: "w-1/5" };
      case 2:
        return { text: t("Fair"), color: "bg-orange-500", textClass: "text-orange-500", width: "w-2/5" };
      case 3:
        return { text: t("Good"), color: "bg-yellow-500", textClass: "text-yellow-500", width: "w-3/5" };
      case 4:
        return { text: t("Strong"), color: "bg-emerald-500", textClass: "text-emerald-500", width: "w-4/5" };
      case 5:
        return { text: t("Excellent"), color: "bg-blue-600", textClass: "text-blue-600", width: "w-full" };
      default:
        return { text: t("Weak"), color: "bg-red-500", textClass: "text-red-500", width: "w-1/5" };
    }
  };

  const strength = getStrengthInfo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetToken) {
      showToast(t("Invalid or expired reset token."), 'error');
      navigate('/forgot-password');
      return;
    }

    if (password !== confirmPassword) {
      showToast(t("Passwords do not match."), 'error');
      return;
    }

    if (score < 5) {
      showToast(t("Password does not meet requirements."), 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        resetToken,
        password,
        confirmPassword
      });
      
      // Clean up session storage token
      sessionStorage.removeItem('elrawda_reset_token');
      
      showToast(t("Password updated successfully."), 'success');
      navigate('/reset-password-success');
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to update password.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-welcome min-h-screen relative flex items-center justify-center p-6 text-slate-800 dark:text-slate-200">
      {/* Decorative glass elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[20%] w-64 h-64 rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[70px] float-slow"></div>
        <div className="absolute bottom-[20%] right-[20%] w-80 h-80 rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[80px] float-slow" style={{ animationDelay: '-3s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-900/70">
        
        {/* Logo Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-poppins font-bold text-2xl shadow-lg mb-2">
            E
          </div>
          <h1 className="font-poppins font-extrabold text-xl text-blue-600 dark:text-blue-400">{t('ELRAWDA')}</h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase -mt-0.5">{t('Wealth Management')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <h2 className="font-poppins font-bold text-lg text-slate-800 dark:text-white">
              {t("Reset Password")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("Set a new strong password for your family console.")}
            </p>
          </div>

          {/* New Password */}
          <div className="relative">
            <Lock className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-3.5 text-slate-400`} size={16} />
            <input
              required
              type={showPassword ? 'text' : 'password'}
              placeholder={t("New Password")}
              className={`w-full ${language === 'ar' ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-sm focus:outline-none focus:border-blue-600`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button
              type="button"
              className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-3.5 text-slate-400 hover:text-slate-650`}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Live Password Strength Meter */}
          {password && (
            <div className="space-y-1.5 px-1">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">{t("Live Password Checklist")}</span>
                <span className={strength.textClass}>{strength.text}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`}></div>
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="relative">
            <Lock className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-3.5 text-slate-400`} size={16} />
            <input
              required
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder={t("Confirm Password")}
              className={`w-full ${language === 'ar' ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-sm focus:outline-none focus:border-blue-600`}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-3.5 text-slate-400 hover:text-slate-650`}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Requirements Checklist Card */}
          <div className="rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/20 p-4 space-y-2 text-[11px]">
            <div className="flex items-center gap-2">
              {checks.length ? <Check size={12} className="text-emerald-500 font-bold" /> : <X size={12} className="text-red-400" />}
              <span className={checks.length ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}>
                {t("Password must be at least 8 characters long.")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {checks.uppercase ? <Check size={12} className="text-emerald-500 font-bold" /> : <X size={12} className="text-red-400" />}
              <span className={checks.uppercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}>
                {t("Must contain at least one uppercase letter.")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {checks.lowercase ? <Check size={12} className="text-emerald-500 font-bold" /> : <X size={12} className="text-red-400" />}
              <span className={checks.lowercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}>
                {t("Must contain at least one lowercase letter.")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {checks.number ? <Check size={12} className="text-emerald-500 font-bold" /> : <X size={12} className="text-red-400" />}
              <span className={checks.number ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}>
                {t("Must contain at least one number.")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {checks.special ? <Check size={12} className="text-emerald-500 font-bold" /> : <X size={12} className="text-red-400" />}
              <span className={checks.special ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400"}>
                {t("Must contain at least one special character.")}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || score < 5 || !confirmPassword || password !== confirmPassword}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-lg transition-all flex justify-center items-center font-poppins disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                <span>{t("Updating Password...")}</span>
              </>
            ) : (
              t("Reset Password")
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
