import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Coins, Receipt, Target, BarChart3, Settings, ShieldAlert, ArrowRight } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext.tsx';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, isAdmin }) => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  // Keyboard shortcut listener (Ctrl+K / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { label: t('Overview Dashboard'), path: '/dashboard', description: t('Go to overview cards, charts, and transaction feeds'), icon: LayoutDashboard },
    { label: t('Income Management'), path: '/income', description: t('Record salaries, freelance payouts, or other revenue streams'), icon: Coins },
    { label: t('Expense Tracker'), path: '/expenses', description: t('Add expenses, view budgets, list recent card transactions'), icon: Receipt },
    { label: t('Goal Tracking'), path: '/savings', description: t('Manage emergency fund, college goals, and track milestones'), icon: Target },
    { label: t('Reports Center'), path: '/reports', description: t('Generate custom analytical files and export Excel/CSV sheets'), icon: BarChart3 },
    { label: t('User Settings'), path: '/settings', description: t('Toggle themes, manage passwords, download secure database backups'), icon: Settings },
  ];

  if (isAdmin) {
    items.push({
      label: t('Admin Control Board'),
      path: '/admin',
      description: t('Audit live database queries, security logs, and role permissions'),
      icon: ShieldAlert
    });
  }

  // Quick Action triggers
  const actions = [
    { label: t('Add new income record'), path: '/income?openAdd=true', desc: t('Add salary/consulting') },
    { label: t('Add new expense transaction'), path: '/expenses?openAdd=true', desc: t('Add groceries/bills') },
    { label: t('Adjust category budget limits'), path: '/expenses?openBudget=true', desc: t('Manage spending caps') },
    { label: t('Contribute savings sweep'), path: '/savings', desc: t('Fund a goal') }
  ];

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredActions = actions.filter(action =>
    action.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-[10vh] px-4">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Palette container */}
      <div className="relative w-full max-w-2xl glass-panel bg-white/95 dark:bg-slate-900/95 border border-white/60 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/50 dark:border-slate-800/50">
          <Search size={18} className="text-slate-400" />
          <input
            autoFocus
            type="text"
            className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 text-sm text-slate-800 dark:text-white placeholder-slate-400 p-0"
            placeholder={t("Type a screen name or action to search...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button 
            onClick={onClose}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white px-2 py-1 bg-slate-100 dark:bg-slate-850 rounded"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Screens Matches */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {t("App Screens")}
            </h3>
            {filteredItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">{t("No matching pages found.")}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/40 ${
                        language === 'ar' ? 'text-right' : 'text-left'
                      } w-full transition-all group`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                        <Icon size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight size={14} className={`text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ${
                        language === 'ar' ? 'rotate-180' : ''
                      }`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Matches */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              {t("Quick Actions")}
            </h3>
            {filteredActions.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">{t("No matching actions found.")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredActions.map(action => (
                  <button
                    key={action.path}
                    onClick={() => handleNavigate(action.path)}
                    className={`flex flex-col p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-950/20 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 ${
                      language === 'ar' ? 'text-right' : 'text-left'
                    } transition-all`}
                  >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {action.label}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {action.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px] text-slate-400 dark:text-slate-500 flex justify-between">
          <span>{t("Use Arrows to navigate, Enter to select")}</span>
          <span>{t("Press Esc to exit palette")}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

