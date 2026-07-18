import { supabase } from '../supabase/supabaseClient.js';
import { logger } from '../utils/logger.js';

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// In-memory mapping to simulate the resetToken -> email mapping for password recovery
const recoverySessionStore = new Map<string, string>();

/**
 * Sign up a new user profile.
 */
export async function register(name: string, email: string, password: string): Promise<ServiceResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          name,
          role: 'user'
        }
      }
    });

    if (error) {
      logger.log('auth', `Registration failed for ${email}: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    logger.log('exception', `Registration encountered error for ${email}`, err);
    return { success: false, error: err.message || 'An unexpected exception occurred.' };
  }
}

/**
 * Sign in a user.
 */
export async function login(email: string, password: string): Promise<ServiceResponse<{ user: any; token: string }>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      logger.log('auth', `Login failed for ${email}: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    const session = data.session;
    if (!session) {
      return { success: false, error: 'No active session returned.' };
    }

    // Fetch the user's profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileErr) {
      logger.log('db', `Failed to load profile for user UUID ${session.user.id}: ${profileErr.message}`, profileErr);
      return { success: false, error: 'Failed to fetch user profile.' };
    }

    return {
      success: true,
      data: {
        user: profile,
        token: session.access_token
      }
    };
  } catch (err: any) {
    logger.log('exception', `Login error for ${email}`, err);
    return { success: false, error: err.message || 'Unexpected auth error occurred.' };
  }
}

/**
 * Sign out.
 */
export async function logout(): Promise<ServiceResponse> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.log('auth', `Sign out failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    logger.log('exception', 'Sign out exception', err);
    return { success: false, error: err.message || 'Failed to sign out.' };
  }
}

/**
 * Fetch currently logged in user profile.
 */
export async function getMe(): Promise<ServiceResponse<{ user: any }>> {
  try {
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session) {
      return { success: false, error: 'No active session.' };
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileErr || !profile) {
      return { success: false, error: 'User profile not found.' };
    }

    return {
      success: true,
      data: { user: profile }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update user profile preferences.
 */
export async function updateProfile(profileData: {
  name?: string;
  avatar?: string;
  currency?: string;
  language?: string;
  theme?: string;
  date_format?: string;
}): Promise<ServiceResponse<{ user: any }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Authentication required' };
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', session.user.id);

    if (updateErr) {
      logger.log('db', `Profile update failed: ${updateErr.message}`, updateErr);
      return { success: false, error: updateErr.message };
    }

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    return {
      success: true,
      data: { user: updatedProfile }
    };
  } catch (err: any) {
    logger.log('exception', 'Profile update exception', err);
    return { success: false, error: err.message };
  }
}

/**
 * Change active user password.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user.email) {
      return { success: false, error: 'Authentication required.' };
    }

    // Secure verification of current password by attempting re-login
    const { error: confirmErr } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    });

    if (confirmErr) {
      return { success: false, error: 'Incorrect current password.' };
    }

    // Set new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateErr) {
      logger.log('auth', `Password change failed: ${updateErr.message}`, updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    logger.log('exception', 'Password change exception', err);
    return { success: false, error: err.message };
  }
}

/**
 * Request password recovery email.
 */
export async function forgotPassword(email: string): Promise<ServiceResponse<{ resetToken: string }>> {
  try {
    const cleanEmail = email.toLowerCase().trim();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);

    if (error) {
      logger.log('auth', `Password reset request failed for ${cleanEmail}: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // Generate a temporary UUID for the client-side bridge resetToken
    const resetToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    
    // Associate resetToken with email for verification step
    recoverySessionStore.set(resetToken, cleanEmail);

    return {
      success: true,
      data: { resetToken }
    };
  } catch (err: any) {
    logger.log('exception', `Forgot password exception for ${email}`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Verify 6-digit recovery OTP.
 */
export async function verifyResetCode(resetToken: string, code: string): Promise<ServiceResponse> {
  try {
    const email = recoverySessionStore.get(resetToken);
    if (!email) {
      return { success: false, error: 'Invalid or expired reset session.' };
    }

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery'
    });

    if (error) {
      logger.log('auth', `OTP verification failed for ${email}: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    logger.log('exception', 'Verify OTP exception', err);
    return { success: false, error: err.message };
  }
}

/**
 * Resend OTP recovery code.
 */
export async function resendResetCode(resetToken: string): Promise<ServiceResponse<{ resetToken: string }>> {
  try {
    const email = recoverySessionStore.get(resetToken);
    if (!email) {
      return { success: false, error: 'Invalid or expired reset session.' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      return { success: false, error: error.message };
    }

    // Cycle token to reset throttling
    const newResetToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    recoverySessionStore.delete(resetToken);
    recoverySessionStore.set(newResetToken, email);

    return {
      success: true,
      data: { resetToken: newResetToken }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Submit and apply recovered password.
 */
export async function resetPassword(resetToken: string, password: string): Promise<ServiceResponse> {
  try {
    const email = recoverySessionStore.get(resetToken);
    if (!email) {
      return { success: false, error: 'Invalid or expired reset session.' };
    }

    // Since verifyOtp logged in the user, their active session is authenticated.
    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      logger.log('auth', `Reset password update failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // Clear session store association
    recoverySessionStore.delete(resetToken);
    
    // Sign out to force the user to re-log in with the new password
    await supabase.auth.signOut();

    return { success: true };
  } catch (err: any) {
    logger.log('exception', 'Reset password update exception', err);
    return { success: false, error: err.message };
  }
}

/**
 * Account deletion. Calls database security definer function 'delete_own_user' to clean up from auth.users.
 */
export async function deleteAccount(): Promise<ServiceResponse> {
  try {
    const { error } = await supabase.rpc('delete_own_user');
    if (error) {
      logger.log('db', `Account deletion RPC failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }
    
    // Clear client-side local session
    await supabase.auth.signOut();
    
    return { success: true };
  } catch (err: any) {
    logger.log('exception', 'Account deletion exception', err);
    return { success: false, error: err.message };
  }
}

/**
 * Backup all user tables to JSON format.
 */
export async function backup(): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Authentication required.' };
    }

    const userId = session.user.id;

    const [userRes, incomeRes, expensesRes, savingsRes, budgetsRes] = await Promise.all([
      supabase.from('profiles').select('email, name, currency, language, theme, date_format, role').eq('id', userId).single(),
      supabase.from('income').select('amount, source, category, date, recurring, interval, notes').eq('user_id', userId),
      supabase.from('expenses').select('amount, merchant, category, date, recurring, interval, tags, status, notes').eq('user_id', userId),
      supabase.from('savings_goals').select('name, target, current, category, color, deadline, priority, auto_contribution, is_salary_deducted').eq('user_id', userId),
      supabase.from('budgets').select('category, monthly_limit').eq('user_id', userId)
    ]);

    if (userRes.error) return { success: false, error: userRes.error.message };

    const backupPayload = {
      exportVersion: '1.0',
      timestamp: new Date().toISOString(),
      user: userRes.data,
      incomes: incomeRes.data || [],
      expenses: expensesRes.data || [],
      savings: savingsRes.data || [],
      budgets: budgetsRes.data || []
    };

    return {
      success: true,
      data: backupPayload
    };
  } catch (err: any) {
    logger.log('exception', 'Backup generation failed', err);
    return { success: false, error: err.message };
  }
}

/**
 * Restore user tables from a JSON backup.
 */
export async function restore(backupData: any): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Authentication required.' };
    }

    if (!backupData || !backupData.exportVersion) {
      return { success: false, error: 'Invalid backup file structure' };
    }

    const userId = session.user.id;

    // Purge old values in client-side transaction flow
    await Promise.all([
      supabase.from('income').delete().eq('user_id', userId),
      supabase.from('expenses').delete().eq('user_id', userId),
      supabase.from('savings_goals').delete().eq('user_id', userId),
      supabase.from('budgets').delete().eq('user_id', userId)
    ]);

    // Restore incomes
    if (Array.isArray(backupData.incomes) && backupData.incomes.length > 0) {
      const mappedIncomes = backupData.incomes.map((inc: any) => ({
        user_id: userId,
        amount: inc.amount,
        source: inc.source,
        category: inc.category,
        date: inc.date,
        recurring: inc.recurring || 0,
        interval: inc.interval || null,
        notes: inc.notes || null
      }));
      await supabase.from('income').insert(mappedIncomes);
    }

    // Restore expenses
    if (Array.isArray(backupData.expenses) && backupData.expenses.length > 0) {
      const mappedExpenses = backupData.expenses.map((exp: any) => ({
        user_id: userId,
        amount: exp.amount,
        merchant: exp.merchant,
        category: exp.category,
        date: exp.date,
        recurring: exp.recurring || 0,
        interval: exp.interval || null,
        tags: exp.tags || null,
        status: exp.status || 'Completed',
        notes: exp.notes || null
      }));
      await supabase.from('expenses').insert(mappedExpenses);
    }

    // Restore savings goals
    if (Array.isArray(backupData.savings) && backupData.savings.length > 0) {
      const mappedSavings = backupData.savings.map((svg: any) => ({
        user_id: userId,
        name: svg.name,
        target: svg.target,
        current: svg.current || 0.0,
        category: svg.category,
        color: svg.color || 'blue',
        deadline: svg.deadline,
        priority: svg.priority || 'Medium',
        auto_contribution: svg.auto_contribution || 0.0,
        is_salary_deducted: svg.is_salary_deducted || 0
      }));
      await supabase.from('savings_goals').insert(mappedSavings);
    }

    // Restore budgets
    if (Array.isArray(backupData.budgets) && backupData.budgets.length > 0) {
      const mappedBudgets = backupData.budgets.map((bdg: any) => ({
        user_id: userId,
        category: bdg.category,
        monthly_limit: bdg.monthly_limit
      }));
      await supabase.from('budgets').insert(mappedBudgets);
    }

    return { success: true };
  } catch (err: any) {
    logger.log('exception', 'Data restoration exception', err);
    return { success: false, error: err.message };
  }
}
