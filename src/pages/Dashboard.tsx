import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Minus, 
  ArrowLeftRight, 
  Calendar,
  AlertCircle,
  Award
} from 'lucide-react';
import api from '../services/api.js';
import Header from '../components/Header.tsx';
import { CashFlowChart, CategoryPieChart, ForecastAreaChart } from '../components/Charts.tsx';
import { useTranslation } from '../context/LanguageContext.tsx';

interface SummaryData {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  monthlyIncome: number;
  monthlyExpense: number;
  healthScore: number;
  savingsRatio: number;
  expenseRatio: number;
  trends: any[];
  categories: any[];
  forecasts: any[];
}

interface Transaction {
  id: number;
  amount: number;
  title: string;
  category: string;
  date: string;
  type: 'income' | 'expense';
}

const Dashboard: React.FC<{ user: any; onOpenCommandPalette: () => void; showToast: any }> = ({ user, onOpenCommandPalette, showToast }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  const fetchDashboardData = async () => {
    try {
      const [sumRes, txRes, billRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/transactions/all'),
        api.get('/transactions/expenses') // to parse pending ones as bills
      ]);
      setSummary(sumRes.data);
      setTransactions(txRes.data.transactions.slice(0, 5)); // recent 5
      setBills(billRes.data.expenses.filter((e: any) => e.status === 'Pending').slice(0, 3));
    } catch (err) {
      console.error('Error fetching dashboard summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handlePayBill = async (id: number, merchant: string, amount: number) => {
    try {
      // Find and update status to completed
      await api.delete(`/transactions/expenses/${id}`); // delete pending entry
      await api.post('/transactions/expenses', {
        amount,
        merchant,
        category: 'Utilities',
        date: new Date().toISOString().split('T')[0],
        status: 'Completed',
        notes: 'Paid recurring bill'
      });
      showToast(`${t('Paid bill:')} $${amount} to ${merchant}`, 'success');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !summary) {
    return (
      <div className="py-20 flex justify-center">
        <span className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  const currencySymbol = user?.currency || '$';

  return (
    <div className="space-y-8">
      {/* Dynamic Header */}
      <Header title="Dashboard Overview" user={user} onOpenCommandPalette={onOpenCommandPalette} />

      {/* 1. Metric summary cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total balance card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between card-shadow bg-white/40 dark:bg-slate-900/40">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Wallet size={20} />
            </div>
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
              <ArrowUpRight size={12} />
              +2.4%
            </span>
          </div>
          <div className="mt-6 text-left rtl:text-right">
            <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Total Balance")}</span>
            <span className="font-poppins font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white mt-1 block">
              {currencySymbol}{summary.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Total income card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between card-shadow bg-white/40 dark:bg-slate-900/40">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <TrendingUp size={20} />
            </div>
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
              <ArrowUpRight size={12} />
              +5.1%
            </span>
          </div>
          <div className="mt-6 text-left rtl:text-right">
            <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Total Income")}</span>
            <span className="font-poppins font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white mt-1 block">
              {currencySymbol}{summary.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Total expenses card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between card-shadow bg-white/40 dark:bg-slate-900/40">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrendingDown size={20} />
            </div>
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
              <ArrowDownRight size={12} />
              -1.2%
            </span>
          </div>
          <div className="mt-6 text-left rtl:text-right">
            <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Total Expenses")}</span>
            <span className="font-poppins font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white mt-1 block">
              {currencySymbol}{summary.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Total savings goals card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between card-shadow bg-white/40 dark:bg-slate-900/40">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Target size={20} />
            </div>
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
              <ArrowUpRight size={12} />
              +8.4%
            </span>
          </div>
          <div className="mt-6 text-left rtl:text-right">
            <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Total Savings")}</span>
            <span className="font-poppins font-extrabold text-2xl md:text-3xl text-slate-900 dark:text-white mt-1 block">
              {currencySymbol}{summary.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle Row Grid (Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash flow trends (2/3 width) */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between card-shadow bg-white/40 dark:bg-slate-900/40">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-poppins font-bold text-lg text-slate-800 dark:text-white">{t("Cash Flow")}</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("Income vs Expenses")}</p>
            </div>
            <div className="flex gap-4 text-[10px] font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                <span>{t("Income")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                <span>{t("Expenses")}</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-[200px] flex items-end">
            <CashFlowChart data={summary.trends} />
          </div>
        </div>

        {/* Expenses category & College Goal (1/3 width) */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Category distribution ring */}
          <div className="glass-panel rounded-3xl p-6 card-shadow flex-1 flex flex-col justify-between bg-white/40 dark:bg-slate-900/40">
            <h3 className="font-poppins font-bold text-base text-slate-850 dark:text-white mb-2">{t("Expense Categories Breakdown")}</h3>
            <div className="flex-1 flex items-center">
              <CategoryPieChart data={summary.categories} />
            </div>
          </div>

          {/* Emergency Fund progress card */}
          <div className="glass-panel rounded-3xl p-6 card-shadow flex flex-col gap-4 bg-white/40 dark:bg-slate-900/40">
            <div className="flex justify-between items-center">
              <h3 className="font-poppins font-bold text-sm text-slate-800 dark:text-white">{t("Emergency Fund")}</h3>
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-650 dark:text-violet-400 uppercase">{t("Emergency")}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between font-semibold text-[10px] text-slate-505 dark:text-slate-400">
                <span>{currencySymbol}10,000 {t("saved")}</span>
                <span>{t("Goal")}: {currencySymbol}15,000</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden border border-white/20">
                <div className="h-full bg-gradient-to-r from-blue-600 to-violet-500 rounded-full transition-all duration-500" style={{ width: '66%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Third Row Grid (Analytics Projecting & Health Meter) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projections area line chart */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between card-shadow bg-white/40 dark:bg-slate-900/40">
          <div>
            <h3 className="font-poppins font-bold text-base text-slate-850 dark:text-white">{t("Assets Growth Projection")}</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("Projected Net Worth Trends for the Next 3 Months")}</p>
          </div>
          <div className="mt-6 flex-1 w-full min-h-[110px] flex items-end">
            <ForecastAreaChart data={summary.forecasts} currentBalance={summary.balance} />
          </div>
        </div>

        {/* Health Score Meter */}
        <div className="glass-panel rounded-3xl p-6 card-shadow flex flex-col justify-between bg-white/40 dark:bg-slate-900/40">
          <h3 className="font-poppins font-bold text-base text-slate-850 dark:text-white mb-2">{t("Financial Health Score")}</h3>
          
          <div className="flex flex-col items-center py-2 relative">
            {/* Round indicator */}
            <div className="w-20 h-20 rounded-full border-4 border-slate-200 dark:border-slate-800 flex items-center justify-center relative">
              <span className="font-poppins font-extrabold text-2xl text-blue-600 dark:text-blue-400">{summary.healthScore}</span>
              <div className="absolute inset-0 w-full h-full rounded-full border-4 border-blue-500 border-t-transparent animate-pulse pointer-events-none" />
            </div>
            
            <div className="text-center mt-3 space-y-1">
              <span className="text-[10px] font-bold text-slate-505 dark:text-slate-400 uppercase tracking-widest">{t("Savings Ratio")}</span>
              <h4 className="font-extrabold text-slate-800 dark:text-white text-sm">{summary.savingsRatio.toFixed(1)}%</h4>
            </div>
          </div>

          <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-3 text-center">
            <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 flex items-center gap-1.5 justify-center font-medium">
              <Award size={14} className="text-amber-500 shrink-0" />
              {summary.healthScore >= 75 ? t('Excellent wealth reserve strategy.') : t('Review budgets to improve margins.')}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row Grid (Recent Feed & Action Centers) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transactions summary feed */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 card-shadow bg-white/40 dark:bg-slate-900/40">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-poppins font-bold text-base text-slate-850 dark:text-white">{t("Recent Transactions")}</h3>
            <button 
              onClick={() => navigate('/expenses')}
              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {t("View All")}
              <ArrowUpRight size={12} className="rtl:rotate-180" />
            </button>
          </div>

          {transactions.length === 0 ? (
            <p className="text-xs text-slate-400 py-12 text-center">{t("No recent transactions recorded.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className={`border-b border-slate-200/30 dark:border-slate-800/30 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ${
                    language === 'ar' ? 'text-right' : 'text-left'
                  }`}>
                    <th className={`pb-3 ${language === 'ar' ? 'pr-2' : 'pl-2'}`}>{t("Transaction")}</th>
                    <th className="pb-3">{t("Date")}</th>
                    <th className="pb-3">{t("Category")}</th>
                    <th className={`pb-3 ${language === 'ar' ? 'text-left pl-2' : 'text-right pr-2'}`}>{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/40 dark:divide-slate-800/40 text-xs">
                  {transactions.map((tx) => (
                    <tr key={`${tx.type}-${tx.id}`} className="hover:bg-white/20 dark:hover:bg-slate-800/20 transition-colors">
                      <td className={`py-3 ${language === 'ar' ? 'pr-2' : 'pl-2'} font-bold text-slate-850 dark:text-white`}>{t(tx.title)}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400">{tx.date}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-850 text-slate-650 dark:text-slate-300">
                          {t(tx.category)}
                        </span>
                      </td>
                      <td className={`py-3 ${
                        language === 'ar' ? 'text-left pl-2' : 'text-right pr-2'
                      } font-extrabold ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                        {tx.type === 'income' ? '+' : '-'}{currencySymbol}{tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Panel & Bills tracker */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Quick buttons grid */}
          <div className="glass-panel rounded-3xl p-6 card-shadow bg-white/40 dark:bg-slate-900/40">
            <h3 className="font-poppins font-bold text-base text-slate-850 dark:text-white mb-4">{t("Quick Actions")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => navigate('/income')}
                className="flex flex-col items-center justify-center p-3 bg-white/30 dark:bg-slate-950/20 hover:bg-white/50 dark:hover:bg-slate-800/40 border border-white/40 dark:border-white/5 hover:scale-[1.03] active:scale-[0.98] transition-all rounded-2xl text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                  <Plus size={18} />
                </div>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 mt-2 block">{t("Add Income")}</span>
              </button>

              <button 
                onClick={() => navigate('/expenses')}
                className="flex flex-col items-center justify-center p-3 bg-white/30 dark:bg-slate-950/20 hover:bg-white/50 dark:hover:bg-slate-800/40 border border-white/40 dark:border-white/5 hover:scale-[1.03] active:scale-[0.98] transition-all rounded-2xl text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                  <Minus size={18} />
                </div>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 mt-2 block">{t("Add Expense")}</span>
              </button>

              <button 
                onClick={() => navigate('/savings')}
                className="flex flex-col items-center justify-center p-3 bg-white/30 dark:bg-slate-950/20 hover:bg-white/50 dark:hover:bg-slate-800/40 border border-white/40 dark:border-white/5 hover:scale-[1.03] active:scale-[0.98] transition-all rounded-2xl text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                  <ArrowLeftRight size={18} />
                </div>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 mt-2 block">{t("Transfer Goal")}</span>
              </button>

              <button 
                onClick={() => navigate('/reports')}
                className="flex flex-col items-center justify-center p-3 bg-white/30 dark:bg-slate-950/20 hover:bg-white/50 dark:hover:bg-slate-800/40 border border-white/40 dark:border-white/5 hover:scale-[1.03] active:scale-[0.98] transition-all rounded-2xl text-center group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/30 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                  <Calendar size={18} />
                </div>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 mt-2 block">{t("Generate Files")}</span>
              </button>
            </div>
          </div>

          {/* Pending Bills Checklist */}
          <div className="glass-panel rounded-3xl p-6 card-shadow flex-1 flex flex-col justify-between bg-white/40 dark:bg-slate-900/40">
            <div>
              <h3 className="font-poppins font-bold text-base text-slate-850 dark:text-white">{t("Upcoming Bills")}</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("Bills requiring payment validation this month")}</p>
            </div>

            {bills.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {t("All bills have been settled! 🎉")}
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-4">
                {bills.map((bill) => (
                  <div key={bill.id} className="flex justify-between items-center p-2.5 rounded-xl border border-white/50 dark:border-white/5 bg-white/40 dark:bg-slate-950/10">
                    <div className="flex gap-2 items-center">
                      <AlertCircle className="text-amber-500 shrink-0" size={14} />
                      <div className="text-[10px] text-left rtl:text-right">
                        <p className="font-bold text-slate-800 dark:text-white">{t(bill.merchant)}</p>
                        <p className="text-slate-450 dark:text-slate-400">{bill.date}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[11px] font-extrabold text-slate-850 dark:text-white">{currencySymbol}{bill.amount.toFixed(2)}</span>
                      <button 
                        onClick={() => handlePayBill(bill.id, bill.merchant, bill.amount)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold shadow-sm"
                      >
                        {t("Pay")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
