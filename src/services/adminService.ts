import { supabase } from '../supabase/supabaseClient.js';
import { logger } from '../utils/logger.js';
import { ServiceResponse } from './authService.js';

export async function getAdminUsers(): Promise<ServiceResponse<{ users: any[] }>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, avatar, role, currency, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.log('db', `Get admin users list failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { users: data || [] } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateUserRole(targetUserId: string, role: 'user' | 'admin'): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const activeUserId = session.user.id;

    if (targetUserId === activeUserId) {
      return { success: false, error: 'Cannot modify your own administrative role.' };
    }

    // 1. Update target user's role in public.profiles
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', targetUserId);

    if (updateErr) {
      logger.log('db', `Failed to update user role: ${updateErr.message}`, updateErr);
      return { success: false, error: updateErr.message };
    }

    // 2. Fetch target user's email for the audit log description
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', targetUserId)
      .maybeSingle();

    const targetEmail = targetProfile?.email || 'Unknown';

    // 3. Register audit log entry
    await supabase.from('audit_logs').insert({
      user_id: activeUserId,
      action: `Changed user ${targetEmail} role to ${role}`,
      user_agent: navigator.userAgent
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAdminAuditLogs(): Promise<ServiceResponse<{ logs: any[] }>> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, user_id, action, ip_address, user_agent, timestamp')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      logger.log('db', `Get audit logs failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    // Map to link user emails and names. Since we are using client side, we can fetch profiles in batch to resolve emails.
    const userIds = Array.from(new Set(data.map(log => log.user_id).filter(Boolean)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    const profileMap = new Map<string, { email: string; name: string }>();
    if (profiles) {
      profiles.forEach(p => profileMap.set(p.id, { email: p.email, name: p.name }));
    }

    const formattedLogs = data.map(log => {
      const prof = log.user_id ? profileMap.get(log.user_id) : null;
      return {
        ...log,
        user_email: prof?.email || 'System / Auto',
        user_name: prof?.name || 'System'
      };
    });

    return { success: true, data: { logs: formattedLogs } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getSystemTelemetry(): Promise<ServiceResponse<{ telemetry: any }>> {
  try {
    const { data, error } = await supabase.rpc('get_system_telemetry');
    if (error) {
      logger.log('db', `get_system_telemetry RPC failed: ${error.message}`, error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        telemetry: data
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
