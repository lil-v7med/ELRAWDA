import { Router } from 'express';
import { run, query, get } from '../db.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
const router = Router();
// Apply auth safeguards to all admin routes
router.use(authMiddleware);
router.use(requireAdmin);
// 1. GET ALL USERS
router.get('/users', async (req, res) => {
    try {
        const list = await query('SELECT id, email, name, avatar, role, currency, created_at FROM users ORDER BY created_at DESC');
        res.json({ users: list });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 2. CHANGE USER ROLE
router.put('/users/:id/role', async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const { role } = req.body;
        if (role !== 'user' && role !== 'admin') {
            return res.status(400).json({ error: 'Role must be user or admin' });
        }
        if (parseInt(targetUserId) === req.user.id) {
            return res.status(400).json({ error: 'Cannot modify your own administrative role' });
        }
        await run('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId]);
        // Log in audit trail
        const targetUser = await get('SELECT email FROM users WHERE id = ?', [targetUserId]);
        const targetEmail = targetUser ? targetUser.email : 'Unknown ID';
        const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
        await run(`
      INSERT INTO audit_logs (user_id, action, ip_address, user_agent)
      VALUES (?, ?, ?, ?)
    `, [req.user.id, `Changed user ${targetEmail} role to ${role}`, ip, req.headers['user-agent'] || 'Unknown']);
        res.json({ message: 'User role updated successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 3. GET SECURITY AUDIT LOGS
router.get('/audit-logs', async (req, res) => {
    try {
        const logs = await query(`
      SELECT a.*, u.email as user_email, u.name as user_name 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT 100
    `);
        res.json({ logs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 4. GET SYSTEM TELEMETRY
router.get('/telemetry', async (req, res) => {
    try {
        const userCount = await get('SELECT COUNT(*) as count FROM users');
        const incomeCount = await get('SELECT COUNT(*) as count FROM income');
        const expenseCount = await get('SELECT COUNT(*) as count FROM expenses');
        const savingsCount = await get('SELECT COUNT(*) as count FROM savings_goals');
        const logCount = await get('SELECT COUNT(*) as count FROM audit_logs');
        res.json({
            telemetry: {
                users: userCount.count,
                incomeRows: incomeCount.count,
                expenseRows: expenseCount.count,
                savingsGoals: savingsCount.count,
                auditLogs: logCount.count,
                dbStatus: 'Healthy',
                environment: process.env.NODE_ENV || 'development'
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
