import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Printer, Search, Calendar, ChevronDown, Coins, Receipt, ArrowLeftRight } from 'lucide-react';
import api from '../services/api.js';
import Header from '../components/Header.tsx';
import { CashFlowChart, CategoryPieChart } from '../components/Charts.tsx';
import { useTranslation } from '../context/LanguageContext.tsx';

interface Transaction {
  id: number;
  amount: number;
  title: string;
  category: string;
  date: string;
  recurring: number;
  interval?: string;
  notes?: string;
  type: 'income' | 'expense';
}

const Reports: React.FC<{ user: any; onOpenCommandPalette: () => void; showToast: any }> = ({ user, onOpenCommandPalette, showToast }) => {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  // Filter parameters
  const [preset, setPreset] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/transactions/all');
      setAllTransactions(res.data.transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Compute date presets
  const getFilteredTransactions = () => {
    const now = new Date();
    let start = new Date(2000, 0, 1); // fallback
    let end = new Date(2100, 0, 1);

    if (preset === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (preset === 'weekly') {
      const day = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - day));
    } else if (preset === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (preset === 'quarterly') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      end = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 1);
    } else if (preset === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
    } else if (preset === 'custom') {
      if (startDate) start = new Date(startDate);
      if (endDate) {
        end = new Date(endDate);
        end.setDate(end.getDate() + 1); // inclusive
      }
    }

    return allTransactions.filter(item => {
      const itemDate = new Date(item.date);
      const matchesDate = itemDate >= start && itemDate < end;
      const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                            item.category.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' ? true : item.type === typeFilter;

      return matchesDate && matchesSearch && matchesType;
    });
  };

  const filtered = getFilteredTransactions();

  // Summary Metrics calculations
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpenses;

  // Generate category groupings for donut chart based on current filtered records
  const getCategoryBreakdown = () => {
    const map: any = {};
    filtered.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([category, value]) => ({ category, value: value as number }));
  };

  const getMonthlyTrends = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets: any = {};
    
    // Seed last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
      buckets[label] = { month: months[d.getMonth()], year: d.getFullYear(), income: 0, expense: 0 };
    }

    filtered.forEach(t => {
      const d = new Date(t.date);
      const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
      if (buckets[label]) {
        if (t.type === 'income') buckets[label].income += t.amount;
        else buckets[label].expense += t.amount;
      }
    });

    return Object.values(buckets) as any[];
  };

  // Trigger export CSV
  const handleExportCSV = async () => {
    if ((import.meta as any).env.VITE_BACKEND_PROVIDER === 'supabase') {
      try {
        const res = await api.get('/reports/export', {
          params: preset === 'custom' && startDate && endDate ? { startDate, endDate } : {}
        });
        const csvContent = res.data;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `elrawda_transactions_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(t('CSV transaction report downloaded.'), 'success');
      } catch (err: any) {
        showToast(t('Failed to export transactions.'), 'error');
      }
      return;
    }

    let url = '/api/reports/export';
    if (preset === 'custom' && startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    window.open(url, '_blank');
    showToast(t('CSV transaction report downloaded.'), 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const currencySymbol = user?.currency || '$';

  // Translate preset button labels
  const getPresetLabel = (p: string) => {
    const map: any = {
      all: language === 'ar' ? 'الكل' : 'All',
      daily: language === 'ar' ? 'يومي' : 'Daily',
      weekly: language === 'ar' ? 'أسبوعي' : 'Weekly',
      monthly: language === 'ar' ? 'شهري' : 'Monthly',
      quarterly: language === 'ar' ? 'ربع سنوي' : 'Quarterly',
      yearly: language === 'ar' ? 'سنوي' : 'Yearly',
      custom: language === 'ar' ? 'مخصص' : 'Custom'
    };
    return map[p] || p;
  };

  return (
    <div className="space-y-8 print:p-0 print:space-y-4">
      {/* Dynamic Header */}
      <div className="print:hidden">
        <Header title="Financial Reports" user={user} onOpenCommandPalette={onOpenCommandPalette} />
      </div>
      <div className="hidden print:flex justify-between items-center pb-4 border-b border-slate-300 mb-6 text-left rtl:text-right">
        <div>
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-wide">{t("ELRAWDA Wealth Report")}</h1>
          <p className="text-[10px] text-slate-500">Generated on {new Date().toLocaleDateString()} for {user?.name}</p>
        </div>
        <div className="text-right rtl:text-left">
          <p className="text-[10px] font-bold text-slate-500">{t("Total Balance")}</p>
          <p className="text-lg font-bold text-blue-700">{currencySymbol}{netSavings.toLocaleString()}</p>
        </div>
      </div>

      {/* Control panel bar */}
      <div className="flex flex-col gap-4 glass-panel p-6 rounded-3xl shadow-sm bg-white/40 dark:bg-slate-900/40 print:hidden">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-950/20 p-1 rounded-xl">
            {(['all', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  preset === p 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                {getPresetLabel(p)}
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-white/50 rounded-xl text-xs font-bold transition-all"
            >
              <Printer size={14} />
              <span>{t("Generate PDF Statement")}</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md font-poppins"
            >
              <Download size={14} />
              <span>{t("Generate CSV Export")}</span>
            </button>
          </div>
        </div>

        {/* Custom Date selection inputs */}
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 animate-slide-in text-left rtl:text-right">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t("Start Date")}</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t("End Date")}</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-955/20 text-xs rounded-xl focus:outline-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
          {/* Search bar */}
          <div className="relative">
            <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} size={16} />
            <input
              type="text"
              placeholder={t("Search by merchant, source or category...")}
              className={`${language === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-955/20 text-xs rounded-xl focus:outline-none w-full`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              className={`${language === 'ar' ? 'pr-3 pl-8 text-right' : 'pl-3 pr-8 text-left'} py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-955/20 text-xs rounded-xl focus:outline-none appearance-none w-full cursor-pointer`}
              value={typeFilter}
              onChange={(e: any) => setTypeFilter(e.target.value)}
            >
              <option value="all">{t("All Transactions")}</option>
              <option value="income">{t("Incomes Only")}</option>
              <option value="expense">{t("Expenses Only")}</option>
            </select>
            <ChevronDown size={14} className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-2.5 text-slate-400 pointer-events-none`} />
          </div>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-3 gap-6">
        {/* Income aggregate */}
        <div className="glass-panel p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30 text-center shadow-sm">
          <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">{t("Total Income")}</span>
          <span className="font-poppins font-extrabold text-base md:text-lg text-emerald-600 dark:text-emerald-450 mt-1 block">
            +{currencySymbol}{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        {/* Expense aggregate */}
        <div className="glass-panel p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30 text-center shadow-sm">
          <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">{t("Total Expenses")}</span>
          <span className="font-poppins font-extrabold text-base md:text-lg text-rose-600 dark:text-rose-450 mt-1 block">
            -{currencySymbol}{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        {/* Savings margin aggregate */}
        <div className="glass-panel p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30 text-center shadow-sm">
          <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">{t("Net Savings")}</span>
          <span className={`font-poppins font-extrabold text-base md:text-lg mt-1 block ${netSavings >= 0 ? 'text-blue-600' : 'text-rose-500'}`}>
            {netSavings >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(netSavings).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Visual Report Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash flow Bar chart (2/3 width) */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between card-shadow bg-white/40 dark:bg-slate-900/40 print:shadow-none">
          <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white mb-6 text-left rtl:text-right">{t("Income vs Expenses")}</h3>
          <div className="flex-1 w-full min-h-[160px] flex items-end">
            <CashFlowChart data={getMonthlyTrends()} />
          </div>
        </div>

        {/* Categories breakdown donut (1/3 width) */}
        <div className="glass-panel rounded-3xl p-6 card-shadow flex flex-col justify-between bg-white/40 dark:bg-slate-900/40 print:shadow-none">
          <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white mb-4 text-left rtl:text-right">{t("Expense Categories Breakdown")}</h3>
          <div className="flex-1 flex items-center">
            <CategoryPieChart data={getCategoryBreakdown()} />
          </div>
        </div>
      </div>

      {/* Detailed filtered transactions list */}
      <div className="glass-panel rounded-3xl p-6 card-shadow bg-white/40 dark:bg-slate-900/40 print:shadow-none">
        <h3 className="font-poppins font-bold text-sm text-slate-850 dark:text-white mb-4 print:text-xs text-left rtl:text-right">{t("Recent Transactions")}</h3>
        
        {loading ? (
          <div className="py-12 flex justify-center">
            <span className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400 py-12 text-center">{t("No recent transactions recorded.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className={`border-b border-slate-200/40 dark:border-slate-800/40 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ${
                  language === 'ar' ? 'text-right' : 'text-left'
                }`}>
                  <th className={`pb-3 ${language === 'ar' ? 'pr-2' : 'pl-2'}`}>{t("Date")}</th>
                  <th className="pb-3">{t("Type")}</th>
                  <th className="pb-3">{t("Source")}</th>
                  <th className="pb-3">{t("Category")}</th>
                  <th className={`pb-3 ${language === 'ar' ? 'text-left pl-2' : 'text-right pr-2'}`}>{t("Amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/40 dark:divide-slate-800/40 text-xs">
                {filtered.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-white/20 dark:hover:bg-slate-800/20 transition-colors">
                    <td className={`py-3 ${language === 'ar' ? 'pr-2' : 'pl-2'} text-slate-500 dark:text-slate-400`}>{item.date}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        item.type === 'income' ? 'text-emerald-600 dark:text-emerald-455' : 'text-purple-600 dark:text-purple-455'
                      }`}>
                        {item.type === 'income' ? <Coins size={12} /> : <Receipt size={12} />}
                        <span className="capitalize">{t(item.type === 'income' ? 'Income' : 'Expenses')}</span>
                      </span>
                    </td>
                    <td className="py-3 font-bold text-slate-850 dark:text-white text-left rtl:text-right">{item.title}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300">
                        {t(item.category)}
                      </span>
                    </td>
                    <td className={`py-3 ${
                      language === 'ar' ? 'text-left pl-2' : 'text-right pr-2'
                    } font-extrabold ${item.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
                      {item.type === 'income' ? '+' : '-'}{currencySymbol}{item.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
