import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Calendar, ShoppingBag, Receipt, Tag, FileText, Paperclip, Search, ArrowUpDown, ShieldAlert, Sparkles, ChevronDown, Edit2 } from 'lucide-react';
import api from '../services/api.js';
import Header from '../components/Header.tsx';
import { useTranslation } from '../context/LanguageContext.tsx';

interface ExpenseItem {
  id: number;
  amount: number;
  merchant: string;
  category: string;
  date: string;
  recurring: number;
  interval?: string;
  tags?: string;
  status: string;
  notes?: string;
  receipt?: string;
}

interface Budget {
  id: number;
  category: string;
  monthly_limit: number;
}

const Expenses: React.FC<{ user: any; onOpenCommandPalette: () => void; showToast: any }> = ({ user, onOpenCommandPalette, showToast }) => {
  const [searchParams] = useSearchParams();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  // Form states
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(false);
  const [interval, setIntervalVal] = useState('monthly');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('Completed');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);

  // Edit Budget states
  const [editCategory, setEditCategory] = useState('Groceries');
  const [editLimit, setEditLimit] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const fetchExpensesAndBudgets = async () => {
    try {
      const [expRes, bdgRes] = await Promise.all([
        api.get('/transactions/expenses'),
        api.get('/budgets')
      ]);
      setExpenses(expRes.data.expenses);
      setBudgets(bdgRes.data.budgets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpensesAndBudgets();
    // Catch URL trigger flags e.g. /expenses?openAdd=true
    if (searchParams.get('openAdd') === 'true') {
      setIsAddOpen(true);
    }
    if (searchParams.get('openBudget') === 'true') {
      setIsBudgetOpen(true);
    }
  }, [searchParams]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceipt(reader.result as string);
        showToast(t('Receipt receipt loaded successfully.'), 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setMerchant('');
    setAmount('');
    setCategory('Groceries');
    setDate(new Date().toISOString().split('T')[0]);
    setRecurring(false);
    setIntervalVal('monthly');
    setTags('');
    setStatus('Completed');
    setNotes('');
    setReceipt(null);
    setEditingItem(null);
  };

  const handleEditClick = (item: ExpenseItem) => {
    setEditingItem(item);
    setMerchant(item.merchant);
    setAmount(String(item.amount));
    setCategory(item.category);
    setDate(item.date);
    setRecurring(item.recurring === 1);
    setIntervalVal(item.interval || 'monthly');
    setTags(item.tags || '');
    setStatus(item.status);
    setNotes(item.notes || '');
    setReceipt(item.receipt || null);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant || !amount || !date) {
      showToast(t('Please fill all mandatory fields.'), 'error');
      return;
    }

    try {
      if (editingItem) {
        await api.put(`/transactions/expenses/${editingItem.id}`, {
          merchant,
          amount: parseFloat(amount),
          category,
          date,
          recurring,
          interval: recurring ? interval : null,
          tags,
          status,
          notes,
          receipt
        });
        showToast(t('Expense updated successfully!'), 'success');
      } else {
        await api.post('/transactions/expenses', {
          merchant,
          amount: parseFloat(amount),
          category,
          date,
          recurring,
          interval: recurring ? interval : null,
          tags,
          status,
          notes,
          receipt
        });
        showToast(t('Expense added successfully!'), 'success');
      }

      setIsAddOpen(false);
      resetForm();
      fetchExpensesAndBudgets();
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to save expense record.'), 'error');
    }
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLimit) {
      showToast(t('Please provide a budget limit.'), 'error');
      return;
    }

    try {
      await api.post('/budgets', {
        category: editCategory,
        monthly_limit: parseFloat(editLimit)
      });
      showToast(`${t('Budget limit for')} "${t(editCategory)}" ${t('updated!') || 'updated!'}`, 'success');
      setIsBudgetOpen(false);
      setEditLimit('');
      fetchExpensesAndBudgets();
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to update budget limit.'), 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('Are you sure you want to delete this expense record?'))) return;
    try {
      await api.delete(`/transactions/expenses/${id}`);
      showToast(t('Expense entry deleted successfully.'), 'success');
      fetchExpensesAndBudgets();
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ['Groceries', 'Utilities', 'Entertainment', 'Shopping', 'Transport', 'Internal', 'Other'];

  const filtered = expenses
    .filter(item => 
      (item.merchant.toLowerCase().includes(search.toLowerCase()) || (item.tags && item.tags.toLowerCase().includes(search.toLowerCase()))) &&
      (catFilter === 'All' ? true : item.category === catFilter)
    )
    .sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  // Calculate current month's expenses per category for the budget panel progress bars
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const getMonthlySpent = (catName: string) => {
    return expenses
      .filter(item => item.category === catName && new Date(item.date) >= startOfMonth)
      .reduce((sum, item) => sum + item.amount, 0);
  };

  const currencySymbol = user?.currency || '$';

  return (
    <div className="space-y-8">
      <Header title="Expense Management" user={user} onOpenCommandPalette={onOpenCommandPalette} />

      {/* Dynamic Budget planner progress panels */}
      <div className="glass-panel rounded-3xl p-6 shadow-sm bg-white/40 dark:bg-slate-900/40">
        <div className="flex justify-between items-center mb-6">
          <div className="text-left rtl:text-right">
            <h3 className="font-poppins font-bold text-base text-slate-855 dark:text-white">{t("Active Budget Limits")}</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("Monthly budget thresholds and category consumption rates")}</p>
          </div>
          <button
            onClick={() => setIsBudgetOpen(true)}
            className="px-4 py-2 rounded-xl border border-slate-355 dark:border-slate-700 hover:bg-white/50 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>{t("Manage Budgets")}</span>
          </button>
        </div>

        {budgets.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">{t("No budgets configured. Set limits in Settings.")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {budgets.map(b => {
              const spent = getMonthlySpent(b.category);
              const percent = Math.min(100, (spent / b.monthly_limit) * 100);
              const isOver = spent > b.monthly_limit;

              return (
                <div key={b.id} className="p-4 bg-white/30 dark:bg-slate-955/15 border border-white/50 dark:border-white/5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-350">
                    <span className="truncate">{t(b.category)}</span>
                    <span className={isOver ? 'text-rose-500' : 'text-slate-800 dark:text-white'}>
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-white/15">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-rose-500' : 'bg-blue-600'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                    <span>{t("Spent")}: {currencySymbol}{spent.toFixed(2)}</span>
                    <span>{t("Cap")}: {currencySymbol}{b.monthly_limit.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Control panel bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-panel p-4 rounded-2xl shadow-sm bg-white/40 dark:bg-slate-900/40">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative">
            <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} size={16} />
            <input
              type="text"
              placeholder={t("Search merchant or tag...")}
              className={`${language === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none w-full sm:w-48`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              className={`${language === 'ar' ? 'pr-3 pl-8 text-right' : 'pl-3 pr-8 text-left'} py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none appearance-none w-full cursor-pointer`}
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="All">{t("All Categories")}</option>
              {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
            </select>
            <ChevronDown size={14} className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-2.5 text-slate-400 pointer-events-none`} />
          </div>

          {/* Sort trigger button */}
          <button
            onClick={() => setSortBy(prev => prev === 'date' ? 'amount' : 'date')}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-white/50 dark:hover:bg-slate-800/40 text-xs font-bold rounded-xl transition-all"
          >
            <ArrowUpDown size={14} />
            <span>{t("Sort by:")} {sortBy === 'date' ? t('Date') : t('Amount')}</span>
          </button>
        </div>

        {/* Add Expense button */}
        <button
          onClick={() => setIsAddOpen(true)}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex justify-center items-center gap-1.5 shadow-md active:scale-95 transition-transform font-poppins"
        >
          <Plus size={16} />
          <span>{t("Add Expense")}</span>
        </button>
      </div>

      {/* Main Expenses listing grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-16 text-center rounded-3xl bg-white/20 dark:bg-slate-900/10">
          <ShoppingBag size={40} className="mx-auto text-slate-300 mb-2 animate-bounce" />
          <h3 className="font-poppins font-bold text-slate-700 dark:text-slate-200">{t("No expense records found")}</h3>
          <p className="text-xs text-slate-455 dark:text-slate-400 mt-1">{t("Use the Add Expense button to log family purchases, utility bills, or subscriptions.")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div key={item.id} className="glass-panel rounded-3xl p-6 card-shadow flex flex-col justify-between bg-white/40 dark:bg-slate-900/40 group hover:scale-[1.01] transition-transform duration-250">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-left rtl:text-right">
                    <h3 className="font-poppins font-bold text-slate-850 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.merchant}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-1 items-center justify-start">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 dark:bg-purple-955 text-purple-600 dark:text-purple-400 uppercase">
                        {t(item.category)}
                      </span>
                      {item.status === 'Pending' && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-bold bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-200/20 uppercase">
                          {t("Pending")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleEditClick(item)}
                      className="p-2 text-slate-400 hover:text-blue-500 rounded-xl hover:bg-slate-105 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-105 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-400 text-left rtl:text-right">
                  <p className="flex items-center gap-1.5 justify-start">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <span>{item.date}</span>
                    {item.recurring === 1 && (
                      <span className="mx-2 px-2 py-0.5 rounded-md bg-purple-55 dark:bg-purple-955/20 text-purple-600 dark:text-purple-400 text-[8px] font-bold uppercase">
                        {t(item.interval || 'monthly')}
                      </span>
                    )}
                  </p>

                  {item.tags && (
                    <p className="flex items-center gap-1.5 justify-start">
                      <Tag size={14} className="text-slate-400 shrink-0" />
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        {item.tags.split(',').join(', ')}
                      </span>
                    </p>
                  )}

                  {item.notes && (
                    <p className="flex items-start gap-1.5 text-slate-550 dark:text-slate-500 leading-snug">
                      <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{item.notes}</span>
                    </p>
                  )}

                  {item.receipt && (
                    <div className="pt-2">
                      <img 
                        src={item.receipt} 
                        alt={t("Receipt clip")} 
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-800 cursor-zoom-in" 
                        onClick={() => window.open(item.receipt || '')}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4 mt-4 flex justify-between items-baseline">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{t("Spent")}</span>
                <span className="font-poppins font-extrabold text-lg text-slate-855 dark:text-white">
                  -{currencySymbol}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Budgets limits dialog modal */}
      {isBudgetOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setIsBudgetOpen(false)} />
          <div className="relative w-full max-w-sm glass-panel p-6 rounded-3xl shadow-2xl bg-white/95 dark:bg-slate-900/95 text-left rtl:text-right">
            <h3 className="font-poppins font-bold text-lg text-slate-855 dark:text-white mb-3">{t("Adjust Category Budget")}</h3>
            
            <form onSubmit={handleBudgetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Select Category")}</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Monthly Spending Limit")} ({currencySymbol})</label>
                <input
                  required
                  type="number"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                  value={editLimit}
                  onChange={(e) => setEditLimit(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBudgetOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-660 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md"
                >
                  {t("Save Preferences")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Form Dialog Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => { setIsAddOpen(false); resetForm(); }} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-3xl shadow-2xl bg-white/95 dark:bg-slate-900/95 max-h-[90vh] overflow-y-auto text-left rtl:text-right">
            <h3 className="font-poppins font-bold text-lg text-slate-855 dark:text-white mb-4">
              {editingItem ? t("Edit Expense Record") : t("Add New Expense Record")}
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Merchant")}*</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Whole Foods Market"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-955 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase mb-1">{t("Amount")} ({currencySymbol})*</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Category")}*</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Date")}*</label>
                  <input
                    required
                    type="date"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950 text-xs rounded-xl focus:outline-none"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-550 dark:text-slate-400 uppercase mb-1">{t("Status")}</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-955 text-xs rounded-xl focus:outline-none"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Completed">{t("Completed")}</option>
                    <option value="Pending">{t("Pending")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Tags (comma separated)")}</label>
                <input
                  type="text"
                  placeholder="e.g. food, weekly, organic"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-955/20 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-650 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                  />
                  <span>{t("Is this recurring bill?")}</span>
                </label>
                {recurring && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 mb-1">{t("Interval")}</label>
                    <select
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs rounded-lg"
                      value={interval}
                      onChange={(e) => setIntervalVal(e.target.value)}
                    >
                      <option value="weekly">{t("weekly")}</option>
                      <option value="monthly">{t("monthly")}</option>
                      <option value="yearly">{t("yearly")}</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Notes")}</label>
                <textarea
                  placeholder={t("Additional context...")}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600 h-16"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Upload Receipt slip")}</label>
                <div className="relative border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                  />
                  <Paperclip className="mx-auto text-slate-400 mb-1" size={16} />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                    {receipt ? t('File loaded successfully. Click to replace.') : t('Attach PNG / JPEG image')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); resetForm(); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-705 text-slate-660 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md cursor-pointer"
                >
                  {editingItem ? t("Save Changes") : t("Save Record")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
