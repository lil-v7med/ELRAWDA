import axios from 'axios';
import * as authService from './authService.js';
import * as transactionsService from './transactionsService.js';
import * as savingsService from './savingsService.js';
import * as assetsService from './assetsService.js';
import * as debtsService from './debtsService.js';
import * as reportsService from './reportsService.js';
import * as notificationsService from './notificationsService.js';
import * as adminService from './adminService.js';

const isSupabase = (import.meta as any).env.VITE_BACKEND_PROVIDER === 'supabase';

const axiosInstance = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response Interceptor for handling session expirations in SQLite mode
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('elrawda_user');
      const bypassList = ['/login', '/', '/forgot-password', '/verify-reset-code', '/reset-password', '/reset-password-success'];
      const shouldBypass = bypassList.some(path => window.location.pathname === path || window.location.pathname.startsWith(path + '/'));
      
      if (!shouldBypass) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper to construct an Axios-like error rejection
function rejectWithAxiosError(status: number, errorMessage: string) {
  const customError = {
    response: {
      status,
      data: { error: errorMessage }
    }
  };
  return Promise.reject(customError);
}

// Router for GET endpoints
async function handleSupabaseGet(url: string, config?: any): Promise<any> {
  const cleanUrl = url.replace(/^\/api/, '');
  const pathname = cleanUrl.split('?')[0];

  if (pathname === '/auth/me') {
    const res = await authService.getMe();
    if (!res.success) {
      return rejectWithAxiosError(401, res.error || 'Unauthorized');
    }
    return { data: res.data };
  }

  if (pathname === '/auth/backup') {
    const res = await authService.backup();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Backup failed');
    }
    return { data: res.data };
  }

  // Phase 4: Income
  if (pathname === '/transactions/income') {
    const res = await transactionsService.getIncome();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch income');
    }
    return { data: res.data };
  }

  // Phase 5: Expenses
  if (pathname === '/transactions/expenses') {
    const res = await transactionsService.getExpenses();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch expenses');
    }
    return { data: res.data };
  }

  // Combined Transactions
  if (pathname === '/transactions/all') {
    const res = await transactionsService.getCombinedTransactions();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch transactions');
    }
    return { data: res.data };
  }

  // Phase 6: Savings Goals
  if (pathname === '/savings') {
    const res = await savingsService.getSavingsGoals();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch savings goals');
    }
    return { data: res.data };
  }

  // Phase 7: Assets
  if (pathname === '/assets') {
    const res = await assetsService.getAssets();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch assets');
    }
    return { data: res.data };
  }

  // Phase 8: Debts
  if (pathname === '/debts') {
    const res = await debtsService.getDebts();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch debts');
    }
    return { data: res.data };
  }

  // Phase 9: Reports & Dashboard Aggregates
  if (pathname === '/reports/summary') {
    const res = await reportsService.getFinancialSummary();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to compile summary');
    }
    return { data: res.data };
  }

  // Phase 9: CSV Export Interceptor
  if (pathname === '/reports/export') {
    let startDate = config?.params?.startDate;
    let endDate = config?.params?.endDate;

    if (!startDate || !endDate) {
      try {
        const urlObj = new URL(url, 'http://localhost');
        startDate = urlObj.searchParams.get('startDate') || undefined;
        endDate = urlObj.searchParams.get('endDate') || undefined;
      } catch (e) {
        // Fallback if URL constructor fails due to partial URL
      }
    }

    const res = await reportsService.getExportCSV(startDate, endDate);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to export CSV');
    }
    return { data: res.data };
  }

  // Phase 10: Notifications
  if (pathname === '/notifications') {
    const res = await notificationsService.getNotifications();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch notifications');
    }
    return { data: res.data };
  }

  // Phase 10: Admin Users
  if (pathname === '/admin/users') {
    const res = await adminService.getAdminUsers();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch users list');
    }
    return { data: res.data };
  }

  // Phase 10: Admin Audit Logs
  if (pathname === '/admin/audit-logs') {
    const res = await adminService.getAdminAuditLogs();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch audit logs');
    }
    return { data: res.data };
  }

  // Phase 10: Admin Telemetry
  if (pathname === '/admin/telemetry') {
    const res = await adminService.getSystemTelemetry();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to fetch telemetry');
    }
    return { data: res.data };
  }

  // Placeholder stubs.
  console.warn(`[SUPABASE] GET endpoint stub: ${pathname}`);
  return { data: {} };
}

// Router for POST endpoints
async function handleSupabasePost(url: string, data?: any, config?: any): Promise<any> {
  const cleanUrl = url.replace(/^\/api/, '');
  const pathname = cleanUrl.split('?')[0];

  if (pathname === '/auth/register') {
    const res = await authService.register(data.name, data.email, data.password);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Registration failed');
    }
    return { data: { message: 'Success' } };
  }

  if (pathname === '/auth/login') {
    const res = await authService.login(data.email, data.password);
    if (!res.success) {
      return rejectWithAxiosError(401, res.error || 'Login failed');
    }
    return { data: res.data };
  }

  if (pathname === '/auth/logout') {
    const res = await authService.logout();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Logout failed');
    }
    return { data: { message: 'Success' } };
  }

  if (pathname === '/auth/forgot-password') {
    const res = await authService.forgotPassword(data.email);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to request code');
    }
    return { data: res.data };
  }

  if (pathname === '/auth/verify-reset-code') {
    const res = await authService.verifyResetCode(data.resetToken, data.code);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to verify code');
    }
    return { data: { message: 'Success' } };
  }

  if (pathname === '/auth/resend-reset-code') {
    const res = await authService.resendResetCode(data.resetToken);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to resend code');
    }
    return { data: res.data };
  }

  if (pathname === '/auth/reset-password') {
    const res = await authService.resetPassword(data.resetToken, data.password);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to reset password');
    }
    return { data: { message: 'Success' } };
  }

  if (pathname === '/auth/restore') {
    const res = await authService.restore(data.backupData);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Restore failed');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 4: Add Income
  if (pathname === '/transactions/income') {
    const res = await transactionsService.addIncome(data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to add income');
    }
    return { data: res.data };
  }

  // Phase 5: Add Expense
  if (pathname === '/transactions/expenses') {
    const res = await transactionsService.addExpense(data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to add expense');
    }
    return { data: res.data };
  }

  // Phase 6: Add Savings Goal
  if (pathname === '/savings') {
    const res = await savingsService.addSavingsGoal(data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to add goal');
    }
    return { data: res.data };
  }

  // Phase 6: Add Savings Contribution
  const matchContribute = pathname.match(/^\/savings\/(\d+)\/contribute$/);
  if (matchContribute) {
    const id = parseInt(matchContribute[1]);
    const res = await savingsService.addContribution(id, data.amount);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Contribution sweep failed');
    }
    return { data: res.data };
  }

  // Phase 7: Add Asset
  if (pathname === '/assets') {
    const res = await assetsService.addAsset(data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to add asset');
    }
    return { data: res.data };
  }

  // Phase 8: Add Debt
  if (pathname === '/debts') {
    const res = await debtsService.addDebt(data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to add debt');
    }
    return { data: res.data };
  }

  // Placeholder stubs.
  console.warn(`[SUPABASE] POST endpoint stub: ${pathname}`);
  return { data: {} };
}

// Router for PUT endpoints
async function handleSupabasePut(url: string, data?: any, config?: any): Promise<any> {
  const cleanUrl = url.replace(/^\/api/, '');
  const pathname = cleanUrl.split('?')[0];

  if (pathname === '/auth/profile') {
    const res = await authService.updateProfile(data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Profile update failed');
    }
    return { data: res.data };
  }

  if (pathname === '/auth/change-password') {
    const res = await authService.changePassword(data.currentPassword, data.newPassword);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Password update failed');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 4: Edit Income
  const matchIncome = pathname.match(/^\/transactions\/income\/(\d+)$/);
  if (matchIncome) {
    const id = parseInt(matchIncome[1]);
    const res = await transactionsService.updateIncome(id, data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to update income');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 5: Edit Expense
  const matchExpense = pathname.match(/^\/transactions\/expenses\/(\d+)$/);
  if (matchExpense) {
    const id = parseInt(matchExpense[1]);
    const res = await transactionsService.updateExpense(id, data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to update expense');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 6: Edit Savings Goal
  const matchGoal = pathname.match(/^\/savings\/(\d+)$/);
  if (matchGoal) {
    const id = parseInt(matchGoal[1]);
    const res = await savingsService.updateSavingsGoal(id, data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to update savings goal');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 7: Edit Asset
  const matchAsset = pathname.match(/^\/assets\/(\d+)$/);
  if (matchAsset) {
    const id = parseInt(matchAsset[1]);
    const res = await assetsService.updateAsset(id, data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to update asset');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 8: Edit Debt
  const matchDebt = pathname.match(/^\/debts\/(\d+)$/);
  if (matchDebt) {
    const id = parseInt(matchDebt[1]);
    const res = await debtsService.updateDebt(id, data);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to update debt');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 10: Read single notification
  const matchNotificationRead = pathname.match(/^\/notifications\/(\d+)\/read$/);
  if (matchNotificationRead) {
    const id = parseInt(matchNotificationRead[1]);
    const res = await notificationsService.markAsRead(id);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to mark read');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 10: Read all notifications
  if (pathname === '/notifications/read-all') {
    const res = await notificationsService.markAllAsRead();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to read all');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 10: Change User Role
  const matchRole = pathname.match(/^\/admin\/users\/([^\/]+)\/role$/);
  if (matchRole) {
    const targetUserId = matchRole[1];
    const res = await adminService.updateUserRole(targetUserId, data.role);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to modify role');
    }
    return { data: { message: 'Success' } };
  }

  // Placeholder stubs.
  console.warn(`[SUPABASE] PUT endpoint stub: ${pathname}`);
  return { data: {} };
}

// Router for DELETE endpoints
async function handleSupabaseDelete(url: string, config?: any): Promise<any> {
  const cleanUrl = url.replace(/^\/api/, '');
  const pathname = cleanUrl.split('?')[0];

  if (pathname === '/auth/delete-account') {
    const res = await authService.deleteAccount();
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Account deletion failed');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 4: Delete Income
  const matchIncome = pathname.match(/^\/transactions\/income\/(\d+)$/);
  if (matchIncome) {
    const id = parseInt(matchIncome[1]);
    const res = await transactionsService.deleteIncome(id);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to delete income');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 5: Delete Expense
  const matchExpense = pathname.match(/^\/transactions\/expenses\/(\d+)$/);
  if (matchExpense) {
    const id = parseInt(matchExpense[1]);
    const res = await transactionsService.deleteExpense(id);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to delete expense');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 6: Delete Savings Goal
  const matchGoal = pathname.match(/^\/savings\/(\d+)$/);
  if (matchGoal) {
    const id = parseInt(matchGoal[1]);
    const res = await savingsService.deleteSavingsGoal(id);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to delete savings goal');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 7: Delete Asset
  const matchAsset = pathname.match(/^\/assets\/(\d+)$/);
  if (matchAsset) {
    const id = parseInt(matchAsset[1]);
    const res = await assetsService.deleteAsset(id);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to delete asset');
    }
    return { data: { message: 'Success' } };
  }

  // Phase 8: Delete Debt
  const matchDebt = pathname.match(/^\/debts\/(\d+)$/);
  if (matchDebt) {
    const id = parseInt(matchDebt[1]);
    const res = await debtsService.deleteDebt(id);
    if (!res.success) {
      return rejectWithAxiosError(400, res.error || 'Failed to delete debt');
    }
    return { data: { message: 'Success' } };
  }

  // Placeholder stubs.
  console.warn(`[SUPABASE] DELETE endpoint stub: ${pathname}`);
  return { data: {} };
}

// Export the bridge matching Axios instance methods
const api = {
  interceptors: axiosInstance.interceptors,
  
  get: async (url: string, config?: any): Promise<any> => {
    if (!isSupabase) {
      return axiosInstance.get(url, config);
    }
    return handleSupabaseGet(url, config);
  },
  
  post: async (url: string, data?: any, config?: any): Promise<any> => {
    if (!isSupabase) {
      return axiosInstance.post(url, data, config);
    }
    return handleSupabasePost(url, data, config);
  },
  
  put: async (url: string, data?: any, config?: any): Promise<any> => {
    if (!isSupabase) {
      return axiosInstance.put(url, data, config);
    }
    return handleSupabasePut(url, data, config);
  },
  
  delete: async (url: string, config?: any): Promise<any> => {
    if (!isSupabase) {
      return axiosInstance.delete(url, config);
    }
    return handleSupabaseDelete(url, config);
  }
};

export default api;
