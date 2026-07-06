import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Info, ShieldCheck, Wallet, PieChart, Sparkles } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext.tsx';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="bg-gradient-welcome text-slate-800 dark:text-slate-200 min-h-screen relative font-sans overflow-x-hidden flex flex-col">
      {/* Decorative background glass floating blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[80px] float-slow"></div>
        <div className="absolute top-[40%] right-[5%] w-96 h-96 rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[100px] float-slower"></div>
        <div className="absolute bottom-[20%] left-[20%] w-80 h-80 rounded-full bg-teal-500/10 dark:bg-teal-500/5 blur-[80px] float-slow" style={{ animationDelay: '-4s' }}></div>
      </div>

      {/* Navigation header */}
      <header className="glass-header sticky top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-poppins font-bold text-xl shadow-md">
              E
            </div>
            <div>
              <span className="font-poppins font-bold text-xl text-blue-600 dark:text-blue-400 tracking-tight">{t('ELRAWDA')}</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-semibold -mt-1 tracking-wider uppercase">{t('Wealth Management')}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">


            <button 
              onClick={() => navigate('/login')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:opacity-85 transition-opacity px-4 py-2 text-sm"
            >
              {t("Login to Account")}
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-lg hover:scale-105 transition-transform"
            >
              {t("Get Started Now")}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
            {t("Smart Family Wealth Management")}
          </div>
          <h1 className="font-poppins font-extrabold text-4xl lg:text-5xl text-slate-900 dark:text-white leading-tight tracking-tight">
            {language === 'ar' ? (
              <>
                أدر <span className="text-blue-600 dark:text-blue-400">مالية عائلتك</span> ودخلك الشهري <span className="text-purple-600 dark:text-purple-400">ببساطة</span>
              </>
            ) : (
              <>
                Manage Your <span className="text-blue-600 dark:text-blue-400">Family's</span> Monthly Income <span className="text-purple-600 dark:text-purple-400">Easily</span>
              </>
            )}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
            {t("Take control of your family's finances with our glassmorphism-designed smart money registry tracker. Plan budgets, visualize assets, and set savings goals.")}
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              {t("Get Started Now")}
              <ArrowRight size={16} className={language === 'ar' ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>

        {/* Right Art Panel */}
        <div className="relative flex justify-center lg:justify-end">
          <div className="w-full max-w-[420px] aspect-square rounded-[36px] bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between float-slow border border-slate-700/50">
            <div className="absolute -top-[10%] -left-[10%] w-48 h-48 rounded-full bg-blue-600/25 blur-[40px]"></div>
            <div className="absolute -bottom-[20%] -right-[20%] w-64 h-64 rounded-full bg-purple-600/20 blur-[60px]"></div>
            
            <div className="flex justify-between items-center relative z-10">
              <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white font-semibold text-[10px] flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-400" />
                {t("Secure Cloud Sync") || "Secure Cloud Sync"}
              </div>
              <Sparkles className="text-amber-400" size={20} />
            </div>

            {/* SVG decoration representation */}
            <div className="my-auto relative z-10 flex flex-col gap-4 text-center">
              <div className="flex items-end gap-3 h-32 justify-center">
                <div className="w-8 rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 h-[30%] shadow-lg"></div>
                <div className="w-8 rounded-t-lg bg-gradient-to-t from-purple-600 to-purple-400 h-[65%] shadow-lg"></div>
                <div className="w-8 rounded-t-lg bg-gradient-to-t from-teal-600 to-teal-400 h-[45%] shadow-lg"></div>
                <div className="w-8 rounded-t-lg bg-gradient-to-t from-blue-600 to-indigo-400 h-[85%] shadow-lg"></div>
              </div>
              <div>
                <span className="text-[10px] text-white/50 tracking-widest uppercase">{t("Wealth Index") || "Wealth Index"}</span>
                <h3 className="font-poppins font-bold text-2xl text-white mt-0.5">$124,500.00</h3>
              </div>
            </div>

            <div className="flex justify-between items-center relative z-10 border-t border-white/10 pt-4 text-[10px] text-white/40 uppercase tracking-widest">
              <span>{t("ELRAWDA PLATFORM") || "ELRAWDA PLATFORM"}</span>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stats row */}
      <section className="max-w-7xl mx-auto px-6 py-8 w-full relative z-10">
        <div className="glass-panel rounded-[24px] p-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <Wallet size={18} />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Salary streams") || "Salary streams"}</span>
              <span className="font-poppins font-extrabold text-xl text-slate-900 dark:text-white">$12,450 / mo</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm shrink-0">
              <PieChart size={18} />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Average Expenses") || "Average Expenses"}</span>
              <span className="font-poppins font-extrabold text-xl text-slate-900 dark:text-white">$4,230 / mo</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-sm shrink-0">
              <TargetIcon size={18} />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Savings Swept") || "Savings Swept"}</span>
              <span className="font-poppins font-extrabold text-xl text-slate-900 dark:text-white">$3,100 / mo</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Assets Reserve") || "Assets Reserve"}</span>
              <span className="font-poppins font-extrabold text-xl text-slate-900 dark:text-white">$85,200</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full mt-auto border-t border-slate-200/50 dark:border-slate-800/50 bg-white/20 dark:bg-slate-950/20 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
              E
            </div>
            <span className="font-semibold text-slate-800 dark:text-white">{t("ELRAWDA")}</span>
          </div>
          <p>&copy; 2026 {t("ELRAWDA Wealth Management")}. {t("All rights reserved.")}</p>
        </div>
      </footer>
    </div>
  );
};

// Placeholder icon mapping
const TargetIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);

export default Landing;
