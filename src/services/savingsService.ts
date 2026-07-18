import { supabase } from '../supabase/supabaseClient.js';
import { logger } from '../utils/logger.js';
import { ServiceResponse } from './authService.js';

export async function getSavingsGoals(): Promise<ServiceResponse<{ savings: any[] }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('deadline', { ascending: true });

    if (error) {
      logger.log('db', `Get savings goals failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { savings: data || [] } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addSavingsGoal(goal: {
  name: string;
  target: number;
  current?: number;
  category?: string;
  color?: string;
  deadline: string;
  priority?: string;
  auto_contribution?: number;
  is_salary_deducted?: boolean;
}): Promise<ServiceResponse<{ id: number }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;
    const numericTarget = goal.target;
    const numericCurrent = goal.current || 0;
    const numericAuto = goal.auto_contribution || 0;
    const numericSalaryDeducted = goal.is_salary_deducted ? 1 : 0;

    const { data, error } = await supabase
      .from('savings_goals')
      .insert({
        user_id: userId,
        name: goal.name,
        target: numericTarget,
        current: numericCurrent,
        category: goal.category || 'General',
        color: goal.color || 'blue',
        deadline: goal.deadline,
        priority: goal.priority || 'Medium',
        auto_contribution: numericAuto,
        is_salary_deducted: numericSalaryDeducted
      })
      .select('id')
      .single();

    if (error) {
      logger.log('db', `Add savings goal failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // SQLite parity: If salary-deducted and has initial savings, record it as a linked expense
    if (numericSalaryDeducted === 1 && numericCurrent > 0) {
      await supabase.from('expenses').insert({
        user_id: userId,
        amount: numericCurrent,
        merchant: `Initial sweep to ${goal.name}`,
        category: 'Internal',
        date: goal.deadline,
        notes: `Initial contribution to salary-deducted savings goal "${goal.name}"`,
        savings_goal_id: data.id
      });
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Created Savings Goal: ${goal.name} (Target: $${numericTarget})`,
      user_agent: navigator.userAgent
    });

    return { success: true, data: { id: data.id } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateSavingsGoal(id: number, goal: {
  name: string;
  target: number;
  current: number;
  category?: string;
  color?: string;
  deadline: string;
  priority?: string;
  auto_contribution?: number;
  is_salary_deducted?: boolean;
}): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;
    const newCurrent = goal.current;
    const newSalaryDeducted = goal.is_salary_deducted ? 1 : 0;

    // Fetch existing goal details for comparison
    const { data: oldGoal } = await supabase
      .from('savings_goals')
      .select('current, is_salary_deducted, name')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!oldGoal) {
      return { success: false, error: 'Savings goal not found or unauthorized.' };
    }

    const { error } = await supabase
      .from('savings_goals')
      .update({
        name: goal.name,
        target: goal.target,
        current: newCurrent,
        category: goal.category || 'General',
        color: goal.color || 'blue',
        deadline: goal.deadline,
        priority: goal.priority || 'Medium',
        auto_contribution: goal.auto_contribution || 0,
        is_salary_deducted: newSalaryDeducted
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Update savings goal failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // SQLite parity: If salary-deducted and current savings increased, log difference as sweep expense
    if (newSalaryDeducted === 1 && newCurrent > oldGoal.current) {
      const diff = newCurrent - oldGoal.current;
      await supabase.from('expenses').insert({
        user_id: userId,
        amount: diff,
        merchant: `Adjustment to ${goal.name}`,
        category: 'Internal',
        date: new Date().toISOString().split('T')[0],
        notes: `Balance adjustment contribution to salary-deducted savings goal "${goal.name}"`,
        savings_goal_id: id
      });
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Edited Savings Goal: ${goal.name}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSavingsGoal(id: number): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    const { data: existing } = await supabase
      .from('savings_goals')
      .select('name')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return { success: false, error: 'Savings goal not found.' };

    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.log('db', `Delete savings goal failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `Deleted Savings Goal: ${existing.name}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Atomic sweep contribution using transactional PostgreSQL function
 */
export async function addContribution(id: number, amount: number): Promise<ServiceResponse<{ current: number }>> {
  try {
    const { data, error } = await supabase.rpc('contribute_to_goal', {
      goal_id: id,
      amount
    });

    if (error) {
      logger.log('db', `Savings contribution RPC failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { current: data } };
  } catch (err: any) {
    logger.log('exception', `Contribution sweep exception`, err);
    return { success: false, error: err.message };
  }
}
