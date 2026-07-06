import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Calendar, DollarSign, Tag, FileText, Paperclip, Search, ArrowUpDown, ChevronDown, Edit2 } from 'lucide-react';
import api from '../services/api.js';
import Header from '../components/Header.tsx';
import { useTranslation } from '../context/LanguageContext.tsx';

interface IncomeItem {
  id: number;
  amount: number;
  source: string;
  category: string;
  date: string;
  recurring: number;
  interval?: string;
  notes?: string;
  attachment?: string;
}

const Income: React.FC<{ user: any; onOpenCommandPalette: () => void; showToast: any }> = ({ user, onOpenCommandPalette, showToast }) => {
  const [searchParams] = useSearchParams();
  const [incomeList, setIncomeList] = useState<IncomeItem[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t, language } = useTranslation();

  // Form states
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Salary');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState(false);
  const [interval, setIntervalVal] = useState('monthly');
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<IncomeItem | null>(null);

  // Filters / Search
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const fetchIncome = async () => {
    try {
      const res = await api.get('/transactions/income');
      setIncomeList(res.data.income);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncome();
    // Catch URL trigger flags e.g. /income?openAdd=true
    if (searchParams.get('openAdd') === 'true') {
      setIsAddOpen(true);
    }
  }, [searchParams]);

  // Handle Base64 file conversions
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
        showToast(t('Receipt attachment loaded.'), 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setSource('');
    setAmount('');
    setCategory('Salary');
    setDate(new Date().toISOString().split('T')[0]);
    setRecurring(false);
    setIntervalVal('monthly');
    setNotes('');
    setAttachment(null);
    setEditingItem(null);
  };

  const handleEditClick = (item: IncomeItem) => {
    setEditingItem(item);
    setSource(item.source);
    setAmount(String(item.amount));
    setCategory(item.category);
    setDate(item.date);
    setRecurring(item.recurring === 1);
    setIntervalVal(item.interval || 'monthly');
    setNotes(item.notes || '');
    setAttachment(item.attachment || null);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !amount || !date) {
      showToast(t('Please fill all mandatory fields.'), 'error');
      return;
    }

    try {
      if (editingItem) {
        await api.put(`/transactions/income/${editingItem.id}`, {
          source,
          amount: parseFloat(amount),
          category,
          date,
          recurring,
          interval: recurring ? interval : null,
          notes,
          attachment
        });
        showToast(t('Income updated successfully!'), 'success');
      } else {
        await api.post('/transactions/income', {
          source,
          amount: parseFloat(amount),
          category,
          date,
          recurring,
          interval: recurring ? interval : null,
          notes,
          attachment
        });
        showToast(t('Income registered successfully!'), 'success');
      }

      setIsAddOpen(false);
      resetForm();
      fetchIncome();
    } catch (err: any) {
      showToast(err.response?.data?.error || t('Failed to save income record.'), 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('Are you sure you want to delete this income record?'))) return;
    try {
      await api.delete(`/transactions/income/${id}`);
      showToast(t('Income entry deleted successfully.'), 'success');
      fetchIncome();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter / Sort compute
  const categories = ['Salary', 'Investments', 'Business', 'Freelance', 'Other'];
  
  const filtered = incomeList
    .filter(item => 
      item.source.toLowerCase().includes(search.toLowerCase()) &&
      (catFilter === 'All' ? true : item.category === catFilter)
    )
    .sort((a, b) => {
      if (sortBy === 'amount') {
        return b.amount - a.amount;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const currencySymbol = user?.currency || '$';

  return (
    <div className="space-y-8">
      <Header title="Income Management" user={user} onOpenCommandPalette={onOpenCommandPalette} />

      {/* Control panel bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-panel p-4 rounded-2xl shadow-sm bg-white/40 dark:bg-slate-900/40">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative">
            <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} size={16} />
            <input
              type="text"
              placeholder={t("Search by source...")}
              className={`${language === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600 w-full sm:w-48`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              className={`${language === 'ar' ? 'pr-3 pl-8 text-right' : 'pl-3 pr-8 text-left'} py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600 appearance-none w-full cursor-pointer`}
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="All">{t("All Categories")}</option>
              {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
            </select>
            <ChevronDown size={14} className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-2.5 text-slate-400 pointer-events-none`} />
          </div>

          {/* Sort selection button */}
          <button
            onClick={() => setSortBy(prev => prev === 'date' ? 'amount' : 'date')}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-white/50 dark:hover:bg-slate-800/40 text-xs font-bold rounded-xl transition-all"
          >
            <ArrowUpDown size={14} />
            <span>{t("Sort by:")} {sortBy === 'date' ? t('Date') : t('Amount')}</span>
          </button>
        </div>

        {/* Add Income button */}
        <button
          onClick={() => setIsAddOpen(true)}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex justify-center items-center gap-1.5 shadow-md active:scale-95 transition-transform font-poppins"
        >
          <Plus size={16} />
          <span>{t("Add Income")}</span>
        </button>
      </div>

      {/* Main Income list grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-16 text-center rounded-3xl bg-white/20 dark:bg-slate-900/10">
          <DollarSign size={40} className="mx-auto text-slate-300 mb-2 animate-bounce" />
          <h3 className="font-poppins font-bold text-slate-700 dark:text-slate-200">{t("No income streams registered")}</h3>
          <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">{t("Use the Add Income button to register your salary, freelance payments or investments.")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div key={item.id} className="glass-panel rounded-3xl p-6 card-shadow flex flex-col justify-between bg-white/40 dark:bg-slate-900/40 group hover:scale-[1.01] transition-transform duration-250">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-left rtl:text-right">
                    <h3 className="font-poppins font-bold text-slate-850 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.source}
                    </h3>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mt-1 uppercase">
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

                <div className="space-y-2 text-xs font-medium text-slate-650 dark:text-slate-400 text-left rtl:text-right">
                  <p className="flex items-center gap-1.5 justify-start">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <span>{item.date}</span>
                    {item.recurring === 1 && (
                      <span className="mx-2 px-2 py-0.5 rounded-md bg-purple-55 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 text-[8px] font-bold uppercase">
                        {t(item.interval || 'monthly')}
                      </span>
                    )}
                  </p>

                  {item.notes && (
                    <p className="flex items-start gap-1.5 text-slate-550 dark:text-slate-500 leading-snug">
                      <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{item.notes}</span>
                    </p>
                  )}

                  {item.attachment && (
                    <div className="pt-2">
                      <img 
                        src={item.attachment} 
                        alt={t("Income slip")} 
                        className="w-full h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-800 cursor-zoom-in" 
                        onClick={() => window.open(item.attachment || '')}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-4 mt-4 flex justify-between items-baseline">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t("Type")}</span>
                <span className="font-poppins font-extrabold text-lg text-emerald-600 dark:text-emerald-400">
                  +{currencySymbol}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => { setIsAddOpen(false); resetForm(); }} />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-3xl shadow-2xl bg-white/95 dark:bg-slate-900/95 max-h-[90vh] overflow-y-auto text-left rtl:text-right">
            <h3 className="font-poppins font-bold text-lg text-slate-855 dark:text-white mb-4">
              {editingItem ? t("Edit Income Record") : t("Add New Income Record")}
            </h3>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Source")}*</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. TechCorp Salary"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Amount")} ({currencySymbol})*</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none focus:border-blue-600"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Category")}*</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t("Date")}*</label>
                <input
                  required
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-950/20 text-xs rounded-xl focus:outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Recurring controls */}
              <div className="p-3 bg-slate-50 dark:bg-slate-955/20 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-650 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 focus:ring-offset-0"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                  />
                  <span>{t("Is this recurring income?")}</span>
                </label>
                {recurring && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-550 mb-1">{t("Interval")}</label>
                    <select
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-955 text-xs rounded-lg"
                      value={interval}
                      onChange={(e) => setIntervalVal(e.target.value)}
                    >
                      <option value="weekly">{t("weekly")}</option>
                      <option value="monthly">{t("monthly")}</option>
                      <option value="quarterly">{t("quarterly")}</option>
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
                    {attachment ? t('File loaded successfully. Click to replace.') : t('Attach PNG / JPEG image')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); resetForm(); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-660 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-90"
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

export default Income;
