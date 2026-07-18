import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { run, get, query } from '../db.js';
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js';
import { emailService } from '../services/emailService.js';
function hashOTP(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
}
function timingSafeCompare(a, b) {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length)
        return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
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
// 10. FORGOT PASSWORD REQUEST
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address is required' });
        }
        const normalizedEmail = email.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }
        const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
        const ua = req.headers['user-agent'] || 'Unknown';
        // Rate Limiting check: max 5 requests per email or IP address within the last 15 minutes
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const user = await get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        let activeResetCount = 0;
        if (user) {
            const rateCheck = await get(`
        SELECT COUNT(*) as count FROM password_resets 
        WHERE (user_id = ? OR ip_address = ?) AND created_at > ?
      `, [user.id, ip, fifteenMinsAgo]);
            activeResetCount = rateCheck.count;
        }
        else {
            const rateCheck = await get(`
        SELECT COUNT(*) as count FROM password_resets 
        WHERE ip_address = ? AND created_at > ?
      `, [ip, fifteenMinsAgo]);
            activeResetCount = rateCheck.count;
        }
        if (activeResetCount >= 5) {
            await logAudit(user ? user.id : null, 'Password Reset Blocked: Rate limit exceeded', req);
            return res.status(429).json({ error: 'Too many requests. Please wait 15 minutes before trying again.' });
        }
        const successMessage = "If an account exists with this email, we've sent a verification code.";
        if (user) {
            // Invalidate previous unused codes
            await run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [new Date().toISOString(), user.id]);
            // Generate secure reset token (UUID) and secure 6-digit verification code
            const resetToken = crypto.randomUUID();
            const code = crypto.randomInt(100000, 999999).toString();
            const hashedCode = hashOTP(code);
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
            // Store in DB
            const createdAt = new Date().toISOString();
            await run(`
        INSERT INTO password_resets (user_id, reset_token, hashed_code, expires_at, created_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [user.id, resetToken, hashedCode, expiresAt, createdAt, ip, ua]);
            // Dispatch professional HTML email
            await emailService.sendResetEmail(normalizedEmail, code);
            await logAudit(user.id, 'Password Reset Requested', req);
            await logAudit(user.id, 'Verification Code Sent', req);
            return res.status(200).json({ message: successMessage, resetToken });
        }
        else {
            // Simulate database hashing/writing delay and return dummy token to prevent timing attacks
            const dummyDelay = 200 + Math.floor(Math.random() * 300);
            await new Promise(resolve => setTimeout(resolve, dummyDelay));
            const dummyToken = crypto.randomUUID();
            await logAudit(null, `Anonymous Password Reset Attempt: ${normalizedEmail}`, req);
            return res.status(200).json({ message: successMessage, resetToken: dummyToken });
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 11. VERIFY RESET CODE
router.post('/verify-reset-code', async (req, res) => {
    try {
        const { resetToken, code } = req.body;
        if (!resetToken || !code) {
            return res.status(400).json({ error: 'Reset token and verification code are required' });
        }
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: 'Verification code must be exactly 6 digits' });
        }
        // Find the code record
        const record = await get(`
      SELECT r.*, u.email FROM password_resets r
      JOIN users u ON r.user_id = u.id
      WHERE r.reset_token = ? AND r.used_at IS NULL
    `, [resetToken]);
        if (!record) {
            // Simulate delay to prevent brute-forcing token presence/timing
            await new Promise(resolve => setTimeout(resolve, 150));
            await logAudit(null, 'Reset Code Verification Failed: Token not found or already used', req);
            return res.status(400).json({ error: 'Invalid or expired verification code.' });
        }
        const now = new Date().toISOString();
        if (record.expires_at < now) {
            await run('UPDATE password_resets SET used_at = ? WHERE id = ?', [now, record.id]);
            await logAudit(record.user_id, 'Verification Code Expired', req);
            return res.status(400).json({ error: 'Verification code has expired.' });
        }
        if (record.attempts >= 5) {
            // Invalidate the code
            await run('UPDATE password_resets SET used_at = ? WHERE id = ?', [now, record.id]);
            // Auto-generate new code & reset cooldown/attempts, send new email
            const newCode = crypto.randomInt(100000, 999999).toString();
            const newHashed = hashOTP(newCode);
            const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            const newResetToken = crypto.randomUUID();
            const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
            const ua = req.headers['user-agent'] || 'Unknown';
            const newCreatedAt = new Date().toISOString();
            await run(`
        INSERT INTO password_resets (user_id, reset_token, hashed_code, expires_at, created_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [record.user_id, newResetToken, newHashed, newExpiresAt, newCreatedAt, ip, ua]);
            await emailService.sendResetEmail(record.email, newCode);
            await logAudit(record.user_id, 'Too Many Attempts: Verification code regenerated', req);
            return res.status(400).json({
                error: 'Too many attempts. A new verification code has been sent to your email.',
                resetToken: newResetToken
            });
        }
        // Increment attempt counter
        await run('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [record.id]);
        // Verify OTP using timing-safe comparison over SHA-256 hashes
        const inputHash = hashOTP(code);
        const isValid = timingSafeCompare(inputHash, record.hashed_code);
        if (!isValid) {
            await logAudit(record.user_id, 'Verification Failed: Incorrect code', req);
            return res.status(400).json({ error: 'Invalid verification code.' });
        }
        await logAudit(record.user_id, 'Verification Code Verified', req);
        return res.status(200).json({ message: 'Code verified successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 12. RESEND RESET CODE
router.post('/resend-reset-code', async (req, res) => {
    try {
        const { resetToken } = req.body;
        if (!resetToken) {
            return res.status(400).json({ error: 'Reset token is required' });
        }
        const record = await get(`
      SELECT r.*, u.email FROM password_resets r
      JOIN users u ON r.user_id = u.id
      WHERE r.reset_token = ?
    `, [resetToken]);
        const successMessage = "If an account exists with this email, we've sent a verification code.";
        if (!record) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const dummyToken = crypto.randomUUID();
            return res.status(200).json({ message: successMessage, resetToken: dummyToken });
        }
        // Check cooldown of 60 seconds
        const elapsedSeconds = (Date.now() - new Date(record.created_at).getTime()) / 1000;
        if (elapsedSeconds < 60) {
            const waitTime = Math.ceil(60 - elapsedSeconds);
            return res.status(429).json({ error: `Please wait ${waitTime} seconds before requesting a new code.` });
        }
        // Invalidate the old reset code record
        await run('UPDATE password_resets SET used_at = ? WHERE id = ?', [new Date().toISOString(), record.id]);
        // Create a new code record under a new reset token
        const newResetToken = crypto.randomUUID();
        const code = crypto.randomInt(100000, 999999).toString();
        const hashedCode = hashOTP(code);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
        const ua = req.headers['user-agent'] || 'Unknown';
        const newCreatedAt = new Date().toISOString();
        await run(`
      INSERT INTO password_resets (user_id, reset_token, hashed_code, expires_at, created_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [record.user_id, newResetToken, hashedCode, expiresAt, newCreatedAt, ip, ua]);
        await emailService.sendResetEmail(record.email, code);
        await logAudit(record.user_id, 'Verification Code Resent', req);
        return res.status(200).json({ message: successMessage, resetToken: newResetToken });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 13. RESET PASSWORD SUBMISSION
router.post('/reset-password', async (req, res) => {
    try {
        const { resetToken, password, confirmPassword } = req.body;
        if (!resetToken || !password || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }
        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }
        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one uppercase letter.' });
        }
        if (!/[a-z]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one lowercase letter.' });
        }
        if (!/\d/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one number.' });
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one special character.' });
        }
        // Find the verified reset code record
        const record = await get(`
      SELECT r.*, u.password_hash FROM password_resets r
      JOIN users u ON r.user_id = u.id
      WHERE r.reset_token = ? AND r.used_at IS NULL
    `, [resetToken]);
        if (!record) {
            await logAudit(null, 'Password Reset Failed: Token not found or already used', req);
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }
        const now = new Date().toISOString();
        if (record.expires_at < now) {
            await run('UPDATE password_resets SET used_at = ? WHERE id = ?', [now, record.id]);
            await logAudit(record.user_id, 'Password Reset Failed: Reset token expired', req);
            return res.status(400).json({ error: 'Reset request has expired.' });
        }
        // Prevent password reuse
        const isSamePassword = await bcrypt.compare(password, record.password_hash);
        if (isSamePassword) {
            return res.status(400).json({ error: 'New password must be different from your current password.' });
        }
        // Hash and update user's password
        const hashed = await bcrypt.hash(password, 10);
        const passwordChangedAt = new Date().toISOString();
        await run('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?', [hashed, passwordChangedAt, record.user_id]);
        // Mark current reset token as used and invalidate all other reset requests for this user
        await run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [passwordChangedAt, record.user_id]);
        await logAudit(record.user_id, 'Password Successfully Changed', req);
        return res.status(200).json({ message: 'Your password has been changed successfully. Please sign in with your new password.' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
