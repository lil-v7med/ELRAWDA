import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { run, get, query } from '../db.js';
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js';
const router = Router();
// Log audit helper
async function logAudit(userId, action, req) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Unknown';
    await run(`
    INSERT INTO audit_logs (user_id, action, ip_address, user_agent)
    VALUES (?, ?, ?, ?)
  `, [userId, action, ip, ua]);
}
// 1. REGISTER
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields (name, email, password) are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        // Check if user already exists
        const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const hashed = await bcrypt.hash(password, 10);
        const result = await run(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (?, ?, ?, 'user')
    `, [email.toLowerCase(), hashed, name]);
        const newUserId = result.lastID;
        // Seed initial budget limits for new user
        await run(`INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, 'Groceries', 500.00)`, [newUserId]);
        await run(`INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, 'Utilities', 250.00)`, [newUserId]);
        await logAudit(newUserId, 'User Registered', req);
        res.status(201).json({ message: 'User registered successfully. You can now login.' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 2. LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Create session token
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '2h' });
        // Set token as secure, HttpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000 // 30 days or 2 hours
        });
        await logAudit(user.id, 'User Login Success', req);
        // Exclude password hash from user object
        const { password_hash, ...safeUser } = user;
        res.json({ user: safeUser, token });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 3. LOGOUT
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        if (req.user) {
            await logAudit(req.user.id, 'User Logout', req);
        }
        res.clearCookie('token');
        res.json({ message: 'Logged out successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 4. GET ME (Session validation)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await get('SELECT id, email, name, avatar, currency, language, theme, date_format, role FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 5. UPDATE PROFILE SETTINGS
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { name, avatar, currency, language, theme, date_format } = req.body;
        const userId = req.user.id;
        await run(`
      UPDATE users 
      SET name = ?, avatar = ?, currency = ?, language = ?, theme = ?, date_format = ?
      WHERE id = ?
    `, [
            name || req.user.name,
            avatar || null,
            currency || '$',
            language || 'en',
            theme || 'light',
            date_format || 'YYYY-MM-DD',
            userId
        ]);
        const updatedUser = await get('SELECT id, email, name, avatar, currency, language, theme, date_format, role FROM users WHERE id = ?', [userId]);
        await logAudit(userId, 'Profile Settings Updated', req);
        res.json({ message: 'Profile updated successfully', user: updatedUser });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 6. CHANGE PASSWORD
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        const user = await get('SELECT password_hash FROM users WHERE id = ?', [userId]);
        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }
        const newHashed = await bcrypt.hash(newPassword, 10);
        await run('UPDATE users SET password_hash = ? WHERE id = ?', [newHashed, userId]);
        await logAudit(userId, 'Password Changed Successfully', req);
        res.json({ message: 'Password updated successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 7. BACKUP USER DATA (JSON export)
router.get('/backup', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const userData = await get('SELECT email, name, currency, language, theme, date_format, role FROM users WHERE id = ?', [userId]);
        const incomes = await query('SELECT amount, source, category, date, recurring, interval, notes FROM income WHERE user_id = ?', [userId]);
        const expenses = await query('SELECT amount, merchant, category, date, recurring, interval, tags, status, notes FROM expenses WHERE user_id = ?', [userId]);
        const savings = await query('SELECT name, target, current, category, color, deadline, priority, auto_contribution, is_salary_deducted FROM savings_goals WHERE user_id = ?', [userId]);
        const budgets = await query('SELECT category, monthly_limit FROM budgets WHERE user_id = ?', [userId]);
        const backupPayload = {
            exportVersion: '1.0',
            timestamp: new Date().toISOString(),
            user: userData,
            incomes,
            expenses,
            savings,
            budgets
        };
        await logAudit(userId, 'Database Backup Downloaded', req);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=elrawda_backup_${userId}.json`);
        res.json(backupPayload);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 8. RESTORE USER DATA (JSON import)
router.post('/restore', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { backupData } = req.body;
        if (!backupData || !backupData.exportVersion) {
            return res.status(400).json({ error: 'Invalid backup file structure' });
        }
        // Begin database transaction simulation by running sequentially
        // Clear user's existing records
        await run('DELETE FROM income WHERE user_id = ?', [userId]);
        await run('DELETE FROM expenses WHERE user_id = ?', [userId]);
        await run('DELETE FROM savings_goals WHERE user_id = ?', [userId]);
        await run('DELETE FROM budgets WHERE user_id = ?', [userId]);
        // Insert restored incomes
        if (Array.isArray(backupData.incomes)) {
            for (const inc of backupData.incomes) {
                await run(`
          INSERT INTO income (user_id, amount, source, category, date, recurring, interval, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, inc.amount, inc.source, inc.category, inc.date, inc.recurring || 0, inc.interval || null, inc.notes || null]);
            }
        }
        // Insert restored expenses
        if (Array.isArray(backupData.expenses)) {
            for (const exp of backupData.expenses) {
                await run(`
          INSERT INTO expenses (user_id, amount, merchant, category, date, recurring, interval, tags, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, exp.amount, exp.merchant, exp.category, exp.date, exp.recurring || 0, exp.interval || null, exp.tags || null, exp.status || 'Completed', exp.notes || null]);
            }
        }
        // Insert restored savings goals
        if (Array.isArray(backupData.savings)) {
            for (const svg of backupData.savings) {
                await run(`
          INSERT INTO savings_goals (user_id, name, target, current, category, color, deadline, priority, auto_contribution, is_salary_deducted)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, svg.name, svg.target, svg.current || 0.0, svg.category, svg.color || 'blue', svg.deadline, svg.priority || 'Medium', svg.auto_contribution || 0.0, svg.is_salary_deducted || 0]);
            }
        }
        // Insert restored budgets
        if (Array.isArray(backupData.budgets)) {
            for (const bdg of backupData.budgets) {
                await run(`
          INSERT INTO budgets (user_id, category, monthly_limit)
          VALUES (?, ?, ?)
        `, [userId, bdg.category, bdg.monthly_limit]);
            }
        }
        await logAudit(userId, 'Database Restored from Backup', req);
        res.json({ message: 'Wealth data successfully restored from backup file' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 9. DELETE ACCOUNT
router.post('/delete-account', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        await logAudit(userId, 'Account Permantly Deleted', req);
        // Cascading deletes will handle income, expenses, savings, budgets
        await run('DELETE FROM users WHERE id = ?', [userId]);
        res.clearCookie('token');
        res.json({ message: 'Account and associated financial data permanently deleted' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
