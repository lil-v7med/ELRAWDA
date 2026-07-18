import { supabase } from '../supabase/supabaseClient.js';
import { logger } from '../utils/logger.js';
import { ServiceResponse } from './authService.js';

export async function getNotifications(): Promise<ServiceResponse<{ notifications: any[] }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.log('db', `Get notifications failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { notifications: data || [] } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markAsRead(id: number): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: 1 })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      logger.log('db', `Mark notification as read failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markAllAsRead(): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: 1 })
      .eq('user_id', session.user.id);

    if (error) {
      logger.log('db', `Mark all notifications as read failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
