import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Target, DollarSign, ArrowUpRight, ShieldCheck, Sparkles, ChevronRight, HelpCircle, Edit2 } from 'lucide-react';
import api from '../services/api.js';
import Header from '../components/Header.tsx';
import { useTranslation } from '../context/LanguageContext.tsx';

interface Goal {
  id: number;
  name: string;
  target: number;
  current: number;
  category: string;
  color: string;
  deadline: string;
  priority: string;
  auto_contribution: number;
}

const Savings: React.FC<{ user: any; onOpenCommandPalette: () => void; showToast: any }> = ({ user, onOpenCommandPalette, showToast }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSweepOpen, setIsSweepOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [sweepAmount, setSweepAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  // Form states
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [category, setCategory] = useState('Savings');
  const [color, setColor] = useState('blue');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [autoContribution, setAutoContribution] = useState('');

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const fetchGoals = async () => {
    try {
      const res = await api.get('/savings');
      setGoals(res.data.savings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const resetForm = () => {
    setName('');
    setTarget('');
    setCurrent('');
    setCategory('Savings');
    setColor('blue');
    setDeadline('');
    setPriority('Medium');
    setAutoContribution('');
    setEditingGoal(null);
  };

  const handleEditClick = (item: Goal) => {
    setEditingGoal(item);
    setName(item.name);
    setTarget(String(item.target));
    setCurrent(String(item.current));
    setCategory(item.category);
    setColor(item.color);
    setDeadline(item.deadline);
    setPriority(item.priority);
    setAutoContribution(String(item.auto_contribution));
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !target || !deadline) {
      showToast(t('Name, target, and deadline are required.'), 'error');
      return;
    }

    try {
      if (editingGoal) {
        await api.put(`/savings/${editingGoal.id}`, {
          name,
          target: parseFloat(target),
          current: parseFloat(current || '0'),
          category,
          color,
          deadline,
          priority,
          auto_contribution: parseFloat(autoContribution || '0')
        });
        showToast(t('Savings goal updated successfully!'), 'success');
      } else {
        await api.post('/savings', {
          name,
          target: parseFloat(target),
          current: parseFloat(current || '0'),
          category,
          color,
          deadline,
          priority,
          auto_contribution: parseFloat(autoContribution || '0')
        });
        showToast(t('Savings goal created successfully!'), 'success');
      }

      setIsAddOpen(false);
      resetForm();
      fetchGoals();
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to save goal.'), 'error');
    }
  };

  const handleSweepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !sweepAmount) return;

    try {
      const res = await api.post(`/savings/${selectedGoalId}/contribute`, {
        amount: parseFloat(sweepAmount)
      });
      showToast(res.data.message || t('Savings sweep complete.'), 'success');
      setIsSweepOpen(false);
      setSweepAmount('');
      setSelectedGoalId(null);
      fetchGoals();
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to sweep contribution.'), 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('Are you sure you want to remove this savings goal?'))) return;
    try {
      await api.delete(`/savings/${id}`);
      showToast(t('Goal removed successfully.'), 'success');
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const getEstimatedCompletion = (goal: Goal) => {
    const needed = goal.target - goal.current;
    if (needed <= 0) return t('Fully Funded! 🎉');
    
    const rate = goal.auto_contribution;
    if (rate <= 0) return t('No active recurring sweeps (set monthly contributions to estimate date).');

    const months = Math.ceil(needed / rate);
    const estDate = new Date();
    estDate.setMonth(estDate.getMonth() + months);
    
    return `${months} ${t('months remaining') || 'months remaining'} (${t('Estimated:') || 'Estimated:'} ${estDate.toLocaleString(language === 'ar' ? 'ar-EG' : 'default', { month: 'long', year: 'numeric' })}).`;
  };

  const colorsMap: any = {
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    green: 'bg-emerald-600',
    yellow: 'bg-amber-500',
    red: 'bg-rose-500',
    teal: 'bg-teal-600'
  };

  const colorsBorderMap: any = {
    blue: 'border-blue-200 dark:border-blue-900/30',
    purple: 'border-purple-200 dark:border-purple-900/30',
    green: 'border-emerald-200 dark:border-emerald-900/30',
    yellow: 'border-amber-200 dark:border-amber-900/30',
    red: 'border-rose-200 dark:border-rose-900/30',
    teal: 'border-teal-200 dark:border-teal-900/30'
  };

  const currencySymbol = user?.currency || '$';

  return (
    <div className="space-y-8">
      <Header title="Savings Goals" user={user} onOpenCommandPalette={onOpenCommandPalette} />

      {/* Control panel bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-panel p-4 rounded-2xl shadow-sm bg-white/40 dark:bg-slate-900/40">
        <div className="text-left rtl:text-right">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-350">{t("Active Savings Goals")}</h3>
          <p className="text-[9px] text-slate-450 dark:text-slate-500 uppercase tracking-widest mt-0.5">{t("Fund milestones and track auto-sweeps")}</p>
        </div>

        {/* Add Goals button */}
        <button
          onClick={() => setIsAddOpen(true)}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex justify-center items-center gap-1.5 shadow-md active:scale-95 transition-transform font-poppins"
        >
          <Plus size={16} />
          <span>{t("Create New Savings Goal")}</span>
        </button>
      </div>

      {/* Main savings goals list */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : goals.length === 0 ? (
        <div className="glass-panel p-16 text-center rounded-3xl bg-white/20 dark:bg-slate-900/10">
          <Target size={40} className="mx-auto text-slate-300 mb-2 animate-bounce" />
          <h3 className="font-poppins font-bold text-slate-700 dark:text-slate-200">{t("No active goals registered")}</h3>
          <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">{t("Use the Create Goal button to track emergency funds, education funding or major purchases.")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((item) => {
            const percent = Math.min(100, (item.current / item.target) * 100);
            const needed = Math.max(0, item.target - item.current);
            const colorClass = colorsMap[item.color] || 'bg-blue-600';
            const borderClass = colorsBorderMap[item.color] || 'border-blue-200';

            return (
              <div key={item.id} className={`glass-panel rounded-3xl p-6 card-shadow flex flex-col justify-between bg-white/40 dark:bg-slate-900/40 border-l-4 rtl:border-l-0 rtl:border-r-4 ${colorClass.replace('bg-', 'border-')} group hover:scale-[1.01] transition-transform`}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="text-left rtl:text-right">
                      <h3 className="font-poppins font-bold text-slate-850 dark:text-white">
                        {item.name}
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-1 uppercase">
                        {t(item.category)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleEditClick(item)}
                        className="p-2 text-slate-400 hover:text-blue-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Ring / Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-white">
                      <span>{percent.toFixed(1)}% {t("Completed")}</span>
                      <span>{currencySymbol}{item.current.toLocaleString()} / {currencySymbol}{item.target.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-white/20">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Timeline parameters */}
                  <div className="space-y-2 text-[10px] font-semibold text-slate-550 dark:text-slate-400 text-left rtl:text-right">
                    <p className="flex justify-between">
                      <span>{t("Deadline")}:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{item.deadline}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>{t("Priority")}:</span>
                      <span className={`font-bold ${item.priority === 'High' ? 'text-rose-500' : 'text-blue-600'}`}>{t(item.priority)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>{t("Auto-Save")}:</span>
                      <span className="font-bold text-purple-650 dark:text-purple-400">{currencySymbol}{item.auto_contribution}/mo</span>
                    </p>
                    
                    {/* Dynamic estimate */}
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[9px] text-slate-400 leading-snug">
                      <span className="font-semibold block uppercase tracking-wider text-[8px] text-slate-500">{t("Timeline Projection")}</span>
                      <p className="mt-0.5 font-medium">{getEstimatedCompletion(item)}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4 mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedGoalId(item.id);
                      setIsSweepOpen(true);
                    }}
                    disabled={needed <= 0}
                    className="w-full py-2 rounded-xl bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1 transition-all"
                  >
                    <ArrowUpRight size={14} className="rtl:rotate-90" />
                    <span>{t("Sweep Cash")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sweep Contribution Dialog Modal */}
      {isSweepOpen && selectedGoalId && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setIsSweepOpen(false)} />
          <div className="relative w-full max-w-sm glass-panel p-6 rounded-3xl shadow-2xl bg-white/95 dark:bg-slate-900/95 text-left rtl:text-right">
            <h3 className="font-poppins font-bold text-lg text-slate-850 dark:text-white mb-3 flex items-center gap-1">
              <Sparkles className="text-amber-500 animate-pulse" size={18} />
              {t("Sweep Cash to Goal")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t("Sweep spare savings from your balance sheet into this goal. This will create a savings transaction.")}
            </p>

            <form onSubmit={handleSweepSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Sweep Amount")} ({currencySymbol})</label>
                <input
                  required
                  type="number"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600 font-bold"
                  value={sweepAmount}
                  onChange={(e) => setSweepAmount(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSweepOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-650 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md"
                >
                  {t("Sweep Cash")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Goals Form Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => { setIsAddOpen(false); resetForm(); }} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-3xl shadow-2xl bg-white/95 dark:bg-slate-900/95 max-h-[90vh] overflow-y-auto text-left rtl:text-right">
            <h3 className="font-poppins font-bold text-lg text-slate-855 dark:text-white mb-4">
              {editingGoal ? t("Edit Savings Goal") : t("Create New Savings Goal")}
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-555 dark:text-slate-400 uppercase mb-1">{t("Goal Name")}*</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Emergency Fund"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Target Amount")} ({currencySymbol})*</label>
                  <input
                    required
                    type="number"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Current Savings")}</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-555 dark:text-slate-400 uppercase mb-1">{t("Category")}</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Savings">{t("Savings")}</option>
                    <option value="Education">{t("Education")}</option>
                    <option value="Transport">{t("Transport")}</option>
                    <option value="Real Estate">{t("Real Estate")}</option>
                    <option value="Investments">{t("Investments")}</option>
                    <option value="Leisure">{t("Leisure")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Priority")}</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-955 text-xs rounded-xl focus:outline-none"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="Low">{t("Low")}</option>
                    <option value="Medium">{t("Medium")}</option>
                    <option value="High">{t("High")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Target Deadline")}*</label>
                  <input
                    required
                    type="date"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-555 dark:text-slate-400 uppercase mb-1">{t("Goal Color Theme")}</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-955 text-xs rounded-xl focus:outline-none"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  >
                    <option value="blue">{t("Blue")}</option>
                    <option value="purple">{t("Purple")}</option>
                    <option value="green">{t("Green")}</option>
                    <option value="yellow">{t("Yellow")}</option>
                    <option value="red">{t("Red")}</option>
                    <option value="teal">{t("Teal")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Auto-Contribution / Mo")}</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                  value={autoContribution}
                  onChange={(e) => setAutoContribution(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); resetForm(); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-655 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md cursor-pointer"
                >
                  {editingGoal ? t("Save Changes") : t("Save Record")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Savings;
