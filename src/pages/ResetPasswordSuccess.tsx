import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext.tsx';

const ResetPasswordSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  return (
    <div className="bg-gradient-welcome min-h-screen relative flex items-center justify-center p-6 text-slate-800 dark:text-slate-200">
      {/* Decorative glass elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[20%] w-64 h-64 rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[70px] float-slow"></div>
        <div className="absolute bottom-[20%] right-[20%] w-80 h-80 rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[80px] float-slow" style={{ animationDelay: '-3s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 text-center">
        
        {/* Animated Checkmark Indicator */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 flex items-center justify-center animate-pulse">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-500 animate-bounce" size={40} />
            </div>
          </div>
        </div>

        {/* Branding Title */}
        <h1 className="font-poppins font-extrabold text-xl text-slate-800 dark:text-white mb-2">
          {t("Password Reset Successful")}
        </h1>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto mb-8">
          {t("Your family console access has been fully restored. Please sign in below using your newly created password.")}
        </p>

        {/* Back to Login action */}
        <button
          onClick={() => navigate('/login')}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-lg transition-all flex justify-center items-center gap-1.5 font-poppins"
        >
          <span>{t("Go to Login")}</span>
          <ArrowRight size={14} className={language === 'ar' ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  );
};

export default ResetPasswordSuccess;
