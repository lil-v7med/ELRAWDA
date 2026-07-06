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

// Check budget limit alert helper
async function checkBudgetAlert(userId: number, category: string, newExpenseAmount: number) {
  const budget = await get('SELECT monthly_limit FROM budgets WHERE user_id = ? AND category = ?', [userId, category]);
  if (!budget) return;

  // Get start of current month
  const now = new Date();
  const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const expenseSum = await get(`
    SELECT SUM(amount) as total FROM expenses 
    WHERE user_id = ? AND category = ? AND date >= ?
      AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
  `, [userId, category, startStr]);

  const currentSpent = expenseSum.total || 0;
  const newSpentTotal = currentSpent + newExpenseAmount;

  if (newSpentTotal > budget.monthly_limit) {
    const alertMsg = `Overspending Alert: Monthly spending on "${category}" ($${newSpentTotal.toFixed(2)}) has exceeded your budget limit of $${budget.monthly_limit.toFixed(2)}!`;
    
    // Check if we already sent this notification recently to avoid spam
    const existingAlert = await get(`
      SELECT id FROM notifications 
      WHERE user_id = ? AND type = 'budget' AND message LIKE ? AND is_read = 0
    `, [userId, `%${category}%`]);

    if (!existingAlert) {
      await run(`
        INSERT INTO notifications (user_id, type, message)
        VALUES (?, 'budget', ?)
      `, [userId, alertMsg]);
    }
  }
}

// 1. GET ALL TRANSACTIONS COMBINED
router.get('/all', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const incomes = await query(`
      SELECT id, amount, source as title, category, date, recurring, interval, notes, attachment, 'income' as type 
      FROM income WHERE user_id = ?
    `, [userId]);

    const expenses = await query(`
      SELECT id, amount, merchant as title, category, date, recurring, interval, tags, status, notes, receipt as attachment, 'expense' as type 
      FROM expenses 
      WHERE user_id = ?
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
    `, [userId]);

    const combined = [...incomes, ...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({ transactions: combined });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET INCOME
router.get('/income', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await query('SELECT * FROM income WHERE user_id = ? ORDER BY date DESC', [userId]);
    res.json({ income: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ADD INCOME
router.post('/income', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, source, category, date, recurring, interval, notes, attachment } = req.body;

    if (!amount || !source || !category || !date) {
      return res.status(400).json({ error: 'Amount, source, category, and date are required' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const result = await run(`
      INSERT INTO income (user_id, amount, source, category, date, recurring, interval, notes, attachment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      numericAmount,
      source,
      category,
      date,
      recurring ? 1 : 0,
      interval || null,
      notes || null,
      attachment || null
    ]);

    await logAudit(userId, `Added Income: ${source} - $${numericAmount}`, req);

    if (numericAmount >= 1000) {
      await run(`
        INSERT INTO notifications (user_id, type, message)
        VALUES (?, 'large_transaction', ?)
      `, [userId, `Large Income Alert: Registered salary/revenue of $${numericAmount.toFixed(2)} from "${source}".`]);
    }

    res.status(201).json({ id: result.lastID, message: 'Income registered successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3a. EDIT INCOME
router.put('/income/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = req.params.id;
    const { amount, source, category, date, recurring, interval, notes, attachment } = req.body;

    const existing = await get('SELECT id FROM income WHERE id = ? AND user_id = ?', [itemId, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Income entry not found or unauthorized' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    await run(`
      UPDATE income
      SET amount = ?, source = ?, category = ?, date = ?, recurring = ?, interval = ?, notes = ?, attachment = ?
      WHERE id = ? AND user_id = ?
    `, [
      numericAmount,
      source,
      category,
      date,
      recurring ? 1 : 0,
      interval || null,
      notes || null,
      attachment || null,
      itemId,
      userId
    ]);

    await logAudit(userId, `Updated Income: ${source} - $${numericAmount}`, req);
    res.json({ message: 'Income updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE INCOME
router.delete('/income/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = req.params.id;

    const item = await get('SELECT source, amount FROM income WHERE id = ? AND user_id = ?', [itemId, userId]);
    if (!item) {
      return res.status(404).json({ error: 'Income entry not found or unauthorized' });
    }

    await run('DELETE FROM income WHERE id = ?', [itemId]);
    await logAudit(userId, `Deleted Income: ${item.source} - $${item.amount}`, req);

    res.json({ message: 'Income deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET EXPENSES
router.get('/expenses', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await query(`
      SELECT * FROM expenses 
      WHERE user_id = ? 
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
      ORDER BY date DESC
    `, [userId]);
    res.json({ expenses: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. ADD EXPENSE
router.post('/expenses', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, merchant, category, date, recurring, interval, tags, status, notes, receipt } = req.body;

    if (!amount || !merchant || !category || !date) {
      return res.status(400).json({ error: 'Amount, merchant, category, and date are required' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const result = await run(`
      INSERT INTO expenses (user_id, amount, merchant, category, date, recurring, interval, tags, status, notes, receipt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      numericAmount,
      merchant,
      category,
      date,
      recurring ? 1 : 0,
      interval || null,
      tags || null,
      status || 'Completed',
      notes || null,
      receipt || null
    ]);

    await logAudit(userId, `Added Expense: ${merchant} - $${numericAmount}`, req);

    // Run async budget overspending checks
    await checkBudgetAlert(userId, category, numericAmount);

    if (numericAmount >= 1000) {
      await run(`
        INSERT INTO notifications (user_id, type, message)
        VALUES (?, 'large_transaction', ?)
      `, [userId, `Large Expense Alert: Registered transaction of $${numericAmount.toFixed(2)} at "${merchant}".`]);
    }

    res.status(201).json({ id: result.lastID, message: 'Expense registered successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6a. EDIT EXPENSE
router.put('/expenses/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = req.params.id;
    const { amount, merchant, category, date, recurring, interval, tags, status, notes, receipt } = req.body;

    const existing = await get('SELECT id FROM expenses WHERE id = ? AND user_id = ?', [itemId, userId]);
    if (!existing) {
      return res.status(404).json({ error: 'Expense entry not found or unauthorized' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    await run(`
      UPDATE expenses
      SET amount = ?, merchant = ?, category = ?, date = ?, recurring = ?, interval = ?, tags = ?, status = ?, notes = ?, receipt = ?
      WHERE id = ? AND user_id = ?
    `, [
      numericAmount,
      merchant,
      category,
      date,
      recurring ? 1 : 0,
      interval || null,
      tags || null,
      status || 'Completed',
      notes || null,
      receipt || null,
      itemId,
      userId
    ]);

    await logAudit(userId, `Updated Expense: ${merchant} - $${numericAmount}`, req);
    
    // Run budget checks
    await checkBudgetAlert(userId, category, numericAmount);

    res.json({ message: 'Expense updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. DELETE EXPENSE
router.delete('/expenses/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const itemId = req.params.id;

    const item = await get('SELECT merchant, amount FROM expenses WHERE id = ? AND user_id = ?', [itemId, userId]);
    if (!item) {
      return res.status(404).json({ error: 'Expense entry not found or unauthorized' });
    }

    await run('DELETE FROM expenses WHERE id = ?', [itemId]);
    await logAudit(userId, `Deleted Expense: ${item.merchant} - $${item.amount}`, req);

    res.json({ message: 'Expense deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
