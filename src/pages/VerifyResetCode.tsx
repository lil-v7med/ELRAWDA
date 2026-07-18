import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../services/api.js';
import { useTranslation } from '../context/LanguageContext.tsx';

interface VerifyResetCodeProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const VerifyResetCode: React.FC<VerifyResetCodeProps> = ({ showToast }) => {
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useTranslation();
  
  // Retrieve resetToken from sessionStorage or route state
  const resetToken = sessionStorage.getItem('elrawda_reset_token') || '';
  const email = location.state?.email || '';

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto focus first field
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    // Only accept numeric inputs
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) {
      const newDigits = [...codeDigits];
      newDigits[index] = '';
      setCodeDigits(newDigits);
      return;
    }

    const singleDigit = numericValue.substring(numericValue.length - 1);
    const newDigits = [...codeDigits];
    newDigits[index] = singleDigit;
    setCodeDigits(newDigits);

    // Auto-advance to next input field
    if (index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!codeDigits[index] && index > 0 && inputRefs.current[index - 1]) {
        // Move focus backward on backspace if current field is empty
        const newDigits = [...codeDigits];
        newDigits[index - 1] = '';
        setCodeDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...codeDigits];
        newDigits[index] = '';
        setCodeDigits(newDigits);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (pastedData.length >= 6) {
      const pasteDigits = pastedData.substring(0, 6).split('');
      setCodeDigits(pasteDigits);
      // Focus the last digit input
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = codeDigits.join('');
    if (fullCode.length !== 6) {
      showToast(t("Invalid code."), 'error');
      return;
    }

    if (!resetToken) {
      showToast(t("Invalid or expired reset token."), 'error');
      navigate('/forgot-password');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/verify-reset-code', { resetToken, code: fullCode });
      showToast(t("Code verified successfully."), 'success');
      navigate('/reset-password');
    } catch (err: any) {
      // Check if code was updated due to brute-force protection
      if (err.response?.data?.resetToken) {
        sessionStorage.setItem('elrawda_reset_token', err.response.data.resetToken);
        setCodeDigits(Array(6).fill(''));
        inputRefs.current[0]?.focus();
        setCooldown(60);
      }
      showToast(err.response?.data?.error || t('Invalid verification code.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    if (!resetToken) {
      showToast(t("Invalid or expired reset token."), 'error');
      navigate('/forgot-password');
      return;
    }

    setResending(true);
    try {
      const res = await api.post('/auth/resend-reset-code', { resetToken });
      showToast(t("Verification code sent."), 'success');
      
      // Update local storage resetToken if the endpoint generated a new one
      if (res.data.resetToken) {
        sessionStorage.setItem('elrawda_reset_token', res.data.resetToken);
      }
      
      setCodeDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
      setCooldown(60);
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to resend code.'), 'error');
    } finally {
      setResending(false);
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

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="text-center">
            <h2 className="font-poppins font-bold text-lg text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
              <KeyRound className="text-blue-600 dark:text-blue-400" size={18} />
              {t("Verification Code")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
              {t("Enter the 6-digit verification code sent to your email.")}
              {email && <span className="block font-semibold mt-0.5 text-blue-600 dark:text-blue-400">{email}</span>}
            </p>
          </div>

          {/* 6 digit passcode boxes */}
          <div className="flex justify-between gap-2 max-w-xs mx-auto" dir="ltr">
            {codeDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                maxLength={1}
                value={digit}
                className="w-12 h-12 rounded-xl text-center font-poppins font-bold text-lg border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-950 transition-all shadow-sm"
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={loading}
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || codeDigits.some(d => !d)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-lg transition-all flex justify-center items-center font-poppins disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                <span>{t("Verifying...")}</span>
              </>
            ) : (
              t("Verify Code")
            )}
          </button>

          {/* Resend actions */}
          <div className="flex flex-col items-center gap-3 text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline disabled:opacity-50 disabled:no-underline font-semibold"
            >
              <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
              {cooldown > 0 ? `${t("Resend code in")} ${cooldown}s` : t("Resend Code")}
            </button>

            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 hover:underline font-medium"
            >
              <ArrowLeft size={14} className={language === 'ar' ? 'rotate-180' : ''} />
              {t("Back to Login")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerifyResetCode;
