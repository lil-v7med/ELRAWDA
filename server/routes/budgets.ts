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

// 1. GET ALL BUDGETS
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await query('SELECT * FROM budgets WHERE user_id = ? ORDER BY category ASC', [userId]);
    res.json({ budgets: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. SET/UPDATE BUDGET LIMIT (Upsert)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { category, monthly_limit } = req.body;

    if (!category || monthly_limit === undefined) {
      return res.status(400).json({ error: 'Category and monthly limit are required' });
    }

    const limit = parseFloat(monthly_limit);
    if (isNaN(limit) || limit < 0) {
      return res.status(400).json({ error: 'Monthly limit must be a non-negative number' });
    }

    // Insert or replace category budget limit
    await run(`
      INSERT INTO budgets (user_id, category, monthly_limit)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit
    `, [userId, category, limit]);

    await logAudit(userId, `Updated Budget limit: "${category}" to $${limit}`, req);
    res.json({ message: `Budget limit for "${category}" set to $${limit}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET DYNAMIC BUDGET INSIGHTS
router.get('/insights', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get current month sums
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const incTotalObj = await get('SELECT SUM(amount) as total FROM income WHERE user_id = ? AND date >= ?', [userId, startOfMonth]);
    const expTotalObj = await get(`
      SELECT SUM(amount) as total FROM expenses 
      WHERE user_id = ? AND date >= ?
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
    `, [userId, startOfMonth]);

    const totalIncome = incTotalObj.total || 0;
    const totalExpenses = expTotalObj.total || 0;

    // Default calculations if no transactions exist in the current month
    const baselineIncome = totalIncome || 5250; 
    const baselineExpenses = totalExpenses || 1200;

    const savingsRatio = ((baselineIncome - baselineExpenses) / baselineIncome) * 100;
    const expenseRatio = (baselineExpenses / baselineIncome) * 100;

    const recommendations = [];
    const suggestions = [];

    // Financial health comments
    if (savingsRatio >= 20) {
      recommendations.push({
        title: 'Excellent Savings Rate',
        description: `Your monthly savings ratio is ${savingsRatio.toFixed(1)}%, which exceeds the standard 20% rule. Keep sweeps active!`,
        type: 'success'
      });
      suggestions.push('Consider moving $150.00 of your idle balance into your College Fund or portfolio index.');
    } else if (savingsRatio >= 5) {
      recommendations.push({
        title: 'Moderate Savings Rate',
        description: `Your monthly savings ratio is ${savingsRatio.toFixed(1)}%. Try cutting discretionary leisure subscriptions to reach the 20% milestone.`,
        type: 'warning'
      });
      suggestions.push('Try decreasing your Entertainment budget cap by $30.00 next month.');
    } else {
      recommendations.push({
        title: 'High Expense Exposure',
        description: `Your spending accounts for ${expenseRatio.toFixed(1)}% of your earnings. Your reserve margins are low.`,
        type: 'danger'
      });
      suggestions.push('Review utility plans and grocery subscriptions to establish a primary emergency buffer.');
    }

    // Category breakdown comparison
    const categorySpent = await query(`
      SELECT category, SUM(amount) as total FROM expenses 
      WHERE user_id = ? AND date >= ?
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
      GROUP BY category
    `, [userId, startOfMonth]);

    for (const item of categorySpent) {
      const budget = await get('SELECT monthly_limit FROM budgets WHERE user_id = ? AND category = ?', [userId, item.category]);
      if (budget) {
        const pct = (item.total / budget.monthly_limit) * 100;
        if (pct > 90) {
          recommendations.push({
            title: `Budget Limit Exceeded or Near Cap: ${item.category}`,
            description: `You have consumed ${pct.toFixed(0)}% of your $${budget.monthly_limit} monthly budget for ${item.category}.`,
            type: 'danger'
          });
        }
      }
    }

    res.json({
      savingsRatio: Math.max(0, savingsRatio),
      expenseRatio,
      recommendations,
      suggestions,
      score: Math.min(100, Math.max(30, Math.round(50 + (savingsRatio * 1.2))))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE BUDGET LIMIT
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const budgetId = req.params.id;

    const budget = await get('SELECT category FROM budgets WHERE id = ? AND user_id = ?', [budgetId, userId]);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found or unauthorized' });
    }

    await run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [budgetId, userId]);
    await logAudit(userId, `Deleted Budget limit for category: "${budget.category}"`, req);

    res.json({ message: 'Budget limit removed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
