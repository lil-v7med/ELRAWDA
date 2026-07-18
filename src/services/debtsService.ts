import { supabase } from '../supabase/supabaseClient.js';
import { logger } from '../utils/logger.js';
import { ServiceResponse } from './authService.js';

export async function getDebts(): Promise<ServiceResponse<{ debts: any[] }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('due_date', { ascending: true });

    if (error) {
      logger.log('db', `Get debts failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { debts: data || [] } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addDebt(debt: {
  creditor: string;
  amount: number;
  interest_rate?: number;
  monthly_payment?: number;
  due_date: string;
  status?: string;
  notes?: string;
}): Promise<ServiceResponse<{ id: number }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    const { data, error } = await supabase
      .from('debts')
      .insert({
        user_id: userId,
        creditor: debt.creditor,
        amount: debt.amount,
        interest_rate: debt.interest_rate || 0.0,
        monthly_payment: debt.monthly_payment || 0.0,
        due_date: debt.due_date,
        status: debt.status || 'Active',
        notes: debt.notes || null
      })
      .select('id')
      .single();

    if (error) {
      logger.log('db', `Add debt failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Added Debt: ${debt.creditor} - $${debt.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true, data: { id: data.id } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateDebt(id: number, debt: {
  creditor: string;
  amount: number;
  interest_rate?: number;
  monthly_payment?: number;
  due_date: string;
  status: string;
  notes?: string;
}): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    const { error } = await supabase
      .from('debts')
      .update({
        creditor: debt.creditor,
        amount: debt.amount,
        interest_rate: debt.interest_rate || 0.0,
        monthly_payment: debt.monthly_payment || 0.0,
        due_date: debt.due_date,
        status: debt.status,
        notes: debt.notes || null
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Update debt failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Updated Debt: ${debt.creditor} - $${debt.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteDebt(id: number): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    const { data: existing } = await supabase
      .from('debts')
      .select('creditor, amount')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return { success: false, error: 'Debt not found.' };

    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Delete debt failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Deleted Debt: ${existing.creditor} - $${existing.amount}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
