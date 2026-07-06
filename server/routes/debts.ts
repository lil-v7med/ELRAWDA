import { Router, Response } from 'express';
import { run, query, get } from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Log audit helper
async function logAudit(userId: number, action: string, req: AuthenticatedRequest) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Unknown';
  await run(`
    INSERT INTO audit_logs (user_id, action, ip_address, user_agent)
    VALUES (?, ?, ?, ?)
  `, [userId, action, ip, ua]);
}

// 1. GET ALL DEBTS
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await query('SELECT * FROM debts WHERE user_id = ? ORDER BY due_date ASC', [userId]);
    res.json({ debts: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ADD DEBT
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { creditor, amount, interest_rate, monthly_payment, due_date, status, notes } = req.body;

    if (!creditor || amount === undefined || !due_date) {
      return res.status(400).json({ error: 'Creditor name, amount, and due date are required' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Debt amount must be a positive number' });
    }

    const result = await run(`
      INSERT INTO debts (user_id, creditor, amount, interest_rate, monthly_payment, due_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      creditor,
      numericAmount,
      parseFloat(interest_rate || '0.0'),
      parseFloat(monthly_payment || '0.0'),
      due_date,
      status || 'Active',
      notes || null
    ]);

    await logAudit(userId, `Added Debt: ${creditor} - $${numericAmount}`, req);
    res.status(201).json({ id: result.lastID, message: 'Debt registered successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. EDIT DEBT
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const debtId = req.params.id;
    const { creditor, amount, interest_rate, monthly_payment, due_date, status, notes } = req.body;

    const existing = await get('SELECT id FROM debts WHERE id = ? AND user_id = ?', [debtId, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Debt not found or unauthorized' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Debt amount must be a positive number' });
    }

    await run(`
      UPDATE debts
      SET creditor = ?, amount = ?, interest_rate = ?, monthly_payment = ?, due_date = ?, status = ?, notes = ?
      WHERE id = ? AND user_id = ?
    `, [
      creditor,
      numericAmount,
      parseFloat(interest_rate || '0.0'),
      parseFloat(monthly_payment || '0.0'),
      due_date,
      status,
      notes || null,
      debtId,
      userId
    ]);

    await logAudit(userId, `Updated Debt: ${creditor} - $${numericAmount}`, req);
    res.json({ message: 'Debt updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE DEBT
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const debtId = req.params.id;

    const existing = await get('SELECT creditor, amount FROM debts WHERE id = ? AND user_id = ?', [debtId, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Debt not found or unauthorized' });
    }

    await run('DELETE FROM debts WHERE id = ? AND user_id = ?', [debtId, userId]);
    await logAudit(userId, `Deleted Debt: ${existing.creditor} - $${existing.amount}`, req);

    res.json({ message: 'Debt deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
