import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import api from '../services/api.js';
import { useTranslation } from '../context/LanguageContext.tsx';

interface ForgotPasswordProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ showToast }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<number[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || cooldown > 0) return;

    const now = Date.now();
    const recentAttempts = attempts.filter(time => now - time < 15000);
    if (recentAttempts.length >= 5) {
      const msg = language === 'ar'
        ? 'محاولات كثيرة جداً. يرجى الانتظار 30 ثانية قبل المحاولة مجدداً.'
        : 'Too many attempts. Please wait 30 seconds before trying again.';
      showToast(msg, 'error');
      setCooldown(30);
      return;
    }
    setAttempts([...recentAttempts, now]);

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      showToast(t("Verification code sent."), 'success');
      
      // Store the reset token in sessionStorage and navigate
      sessionStorage.setItem('elrawda_reset_token', res.data.resetToken);
      navigate('/verify-reset-code', { state: { email } });
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Authentication process encountered an error.'), 'error');
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
          <h2 className="text-center font-poppins font-bold text-lg text-slate-800 dark:text-white">
            {t("Recover Password")}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed -mt-2">
            {t("Provide your email, and we will send password reset coordinates.")}
          </p>

          <div className="relative">
            <Mail className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-3.5 text-slate-400`} size={16} />
            <input
              required
              type="email"
              placeholder={t("Email Address")}
              className={`w-full ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-955 text-sm focus:outline-none focus:border-blue-600`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || cooldown > 0}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-lg transition-all flex justify-center items-center font-poppins"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                <span>{t("Sending...")}</span>
              </>
            ) : cooldown > 0 ? (
              `${language === 'ar' ? 'انتظر' : 'Wait'} ${cooldown}s`
            ) : (
              t("Send Reset Link")
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-xs text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 hover:underline w-full mt-2 font-medium"
          >
            <ArrowLeft size={14} className={language === 'ar' ? 'rotate-180' : ''} />
            {t("Back to Login")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
