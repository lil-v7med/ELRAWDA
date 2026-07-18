import { supabase } from '../supabase/supabaseClient.js';
import { logger } from '../utils/logger.js';
import { ServiceResponse } from './authService.js';

/**
 * Helper to convert Base64 data URL to standard binary Blob for Supabase upload
 */
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Uploads receipt file (Base64 data URL) to Supabase Storage receipts bucket
 * Returns the public URL, or the original string if it is already a URL or empty
 */
async function uploadReceiptFile(base64Data: string | null | undefined, folder: string): Promise<string | null> {
  if (!base64Data) return null;
  if (!base64Data.startsWith('data:')) {
    return base64Data; // Already uploaded URL or plain string
  }

  try {
    const blob = dataURLtoBlob(base64Data);
    const ext = blob.type.split('/')[1] || 'png';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err: any) {
    logger.log('db', `Storage upload failed: ${err.message}`, err);
    return null;
  }
}

/**
 * Overspending budget check helper. Triggers notification if total category spending exceeds monthly limit.
 */
async function checkBudgetAlert(userId: string, category: string, newExpenseAmount: number): Promise<void> {
  try {
    // 1. Fetch budget cap
    const { data: budget } = await supabase
      .from('budgets')
      .select('monthly_limit')
      .eq('user_id', userId)
      .eq('category', category)
      .maybeSingle();

    if (!budget) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startStr = startOfMonth.toISOString().split('T')[0];

    // 2. Fetch monthly spending sum
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, amount, savings_goal_id')
      .eq('user_id', userId)
      .eq('category', category)
      .gte('date', startStr);

    if (!expenses) return;

    // Filter salary-deducted savings goal linked expenses
    const { data: salaryDeductedGoals } = await supabase
      .from('savings_goals')
      .select('id')
      .eq('user_id', userId)
      .eq('is_salary_deducted', 1);

    const validGoalIds = new Set((salaryDeductedGoals || []).map(g => g.id));

    const currentSpent = expenses.reduce((sum, exp) => {
      if (!exp.savings_goal_id || validGoalIds.has(exp.savings_goal_id)) {
        return sum + exp.amount;
      }
      return sum;
    }, 0);

    const newSpentTotal = currentSpent + newExpenseAmount;

    if (newSpentTotal > budget.monthly_limit) {
      const alertMsg = `Overspending Alert: Monthly spending on "${category}" ($${newSpentTotal.toFixed(2)}) has exceeded your budget limit of $${budget.monthly_limit.toFixed(2)}!`;

      // Prevent duplicate notification spam
      const { data: existingAlert } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'budget')
        .eq('is_read', 0)
        .like('message', `%${category}%`)
        .maybeSingle();

      if (!existingAlert) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'budget',
          message: alertMsg
        });
      }
    }
  } catch (err: any) {
    logger.log('exception', `Budget alert checking failed: ${err.message}`, err);
  }
}

// =========================================================================
// INCOME OPERATIONS (Phase 4)
// =========================================================================

export async function getIncome(): Promise<ServiceResponse<{ income: any[] }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const { data, error } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false });

    if (error) {
      logger.log('db', `Get income failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { income: data || [] } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addIncome(income: {
  amount: number;
  source: string;
  category: string;
  date: string;
  recurring?: boolean;
  interval?: string;
  notes?: string;
  attachment?: string;
}): Promise<ServiceResponse<{ id: number }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;
    const uploadedUrl = await uploadReceiptFile(income.attachment, 'income');

    const { data, error } = await supabase
      .from('income')
      .insert({
        user_id: userId,
        amount: income.amount,
        source: income.source,
        category: income.category,
        date: income.date,
        recurring: income.recurring ? 1 : 0,
        interval: income.recurring ? (income.interval || 'monthly') : null,
        notes: income.notes || null,
        attachment: uploadedUrl
      })
      .select('id')
      .single();

    if (error) {
      logger.log('db', `Add income failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // Large transaction trigger
    if (income.amount >= 1000) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'large_transaction',
        message: `Large Income Alert: Registered salary/revenue of $${income.amount.toFixed(2)} from "${income.source}".`
      });
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Added Income: ${income.source} - $${income.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true, data: { id: data.id } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateIncome(id: number, income: {
  amount: number;
  source: string;
  category: string;
  date: string;
  recurring?: boolean;
  interval?: string;
  notes?: string;
  attachment?: string;
}): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;
    const uploadedUrl = await uploadReceiptFile(income.attachment, 'income');

    const { error } = await supabase
      .from('income')
      .update({
        amount: income.amount,
        source: income.source,
        category: income.category,
        date: income.date,
        recurring: income.recurring ? 1 : 0,
        interval: income.recurring ? (income.interval || 'monthly') : null,
        notes: income.notes || null,
        attachment: uploadedUrl
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Update income failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Updated Income: ${income.source} - $${income.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteIncome(id: number): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    // Fetch details for logging
    const { data: existing } = await supabase
      .from('income')
      .select('source, amount')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return { success: false, error: 'Income entry not found.' };

    const { error } = await supabase
      .from('income')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Delete income failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Deleted Income: ${existing.source} - $${existing.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// EXPENSE OPERATIONS (Phase 5)
// =========================================================================

export async function getExpenses(): Promise<ServiceResponse<{ expenses: any[] }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    // Get salary-deducted savings goal IDs
    const { data: salaryDeductedGoals } = await supabase
      .from('savings_goals')
      .select('id')
      .eq('user_id', userId)
      .eq('is_salary_deducted', 1);

    const validGoalIds = (salaryDeductedGoals || []).map(g => g.id);

    // Fetch expenses
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      logger.log('db', `Get expenses failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // Filter list: only display expenses with no savings goal OR where savings goal is salary-deducted
    const filtered = (data || []).filter(exp => {
      return !exp.savings_goal_id || validGoalIds.includes(Number(exp.savings_goal_id));
    });

    return { success: true, data: { expenses: filtered } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addExpense(expense: {
  amount: number;
  merchant: string;
  category: string;
  date: string;
  recurring?: boolean;
  interval?: string;
  tags?: string;
  status?: string;
  notes?: string;
  receipt?: string;
  savings_goal_id?: number | null;
}): Promise<ServiceResponse<{ id: number }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;
    const uploadedUrl = await uploadReceiptFile(expense.receipt, 'expenses');

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        amount: expense.amount,
        merchant: expense.merchant,
        category: expense.category,
        date: expense.date,
        recurring: expense.recurring ? 1 : 0,
        interval: expense.recurring ? (expense.interval || 'monthly') : null,
        tags: expense.tags || null,
        status: expense.status || 'Completed',
        notes: expense.notes || null,
        receipt: uploadedUrl,
        savings_goal_id: expense.savings_goal_id || null
      })
      .select('id')
      .single();

    if (error) {
      logger.log('db', `Add expense failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // Overspending checking
    await checkBudgetAlert(userId, expense.category, expense.amount);

    // Large transaction warning
    if (expense.amount >= 1000) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'large_transaction',
        message: `Large Expense Alert: Registered transaction of $${expense.amount.toFixed(2)} at "${expense.merchant}".`
      });
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Added Expense: ${expense.merchant} - $${expense.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true, data: { id: data.id } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateExpense(id: number, expense: {
  amount: number;
  merchant: string;
  category: string;
  date: string;
  recurring?: boolean;
  interval?: string;
  tags?: string;
  status?: string;
  notes?: string;
  receipt?: string;
  savings_goal_id?: number | null;
}): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;
    const uploadedUrl = await uploadReceiptFile(expense.receipt, 'expenses');

    const { error } = await supabase
      .from('expenses')
      .update({
        amount: expense.amount,
        merchant: expense.merchant,
        category: expense.category,
        date: expense.date,
        recurring: expense.recurring ? 1 : 0,
        interval: expense.recurring ? (expense.interval || 'monthly') : null,
        tags: expense.tags || null,
        status: expense.status || 'Completed',
        notes: expense.notes || null,
        receipt: uploadedUrl,
        savings_goal_id: expense.savings_goal_id || null
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Update expense failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await checkBudgetAlert(userId, expense.category, expense.amount);

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Updated Expense: ${expense.merchant} - $${expense.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteExpense(id: number): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    const { data: existing } = await supabase
      .from('expenses')
      .select('merchant, amount')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return { success: false, error: 'Expense entry not found.' };

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Delete expense failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Deleted Expense: ${existing.merchant} - $${existing.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch combined transactions (incomes + expenses) sorted by date DESC
 */
export async function getCombinedTransactions(): Promise<ServiceResponse<{ transactions: any[] }>> {
  try {
    const [incRes, expRes] = await Promise.all([
      getIncome(),
      getExpenses()
    ]);

    if (!incRes.success) return { success: false, error: incRes.error };
    if (!expRes.success) return { success: false, error: expRes.error };

    // Format fields to match combined query schema
    const formattedIncomes = (incRes.data?.income || []).map(inc => ({
      id: inc.id,
      amount: inc.amount,
      title: inc.source,
      category: inc.category,
      date: inc.date,
      recurring: inc.recurring,
      interval: inc.interval,
      notes: inc.notes,
      attachment: inc.attachment,
      type: 'income'
    }));

    const formattedExpenses = (expRes.data?.expenses || []).map(exp => ({
      id: exp.id,
      amount: exp.amount,
      title: exp.merchant,
      category: exp.category,
      date: exp.date,
      recurring: exp.recurring,
      interval: exp.interval,
      notes: exp.notes,
      attachment: exp.receipt,
      type: 'expense'
    }));

    const combined = [...formattedIncomes, ...formattedExpenses].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return { success: true, data: { transactions: combined } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
