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

// 1. GET ALL SAVINGS GOALS
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await query('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY deadline ASC', [userId]);
    res.json({ savings: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ADD SAVINGS GOAL
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, target, current, category, color, deadline, priority, auto_contribution, is_salary_deducted } = req.body;

    if (!name || !target || !deadline) {
      return res.status(400).json({ error: 'Goal name, target amount, and deadline are required' });
    }

    const numericTarget = parseFloat(target);
    const numericCurrent = parseFloat(current || '0');
    const numericAuto = parseFloat(auto_contribution || '0');
    const numericSalaryDeducted = is_salary_deducted ? 1 : 0;

    if (isNaN(numericTarget) || numericTarget <= 0) {
      return res.status(400).json({ error: 'Target amount must be a positive number' });
    }

    const result = await run(`
      INSERT INTO savings_goals (user_id, name, target, current, category, color, deadline, priority, auto_contribution, is_salary_deducted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      name,
      numericTarget,
      numericCurrent,
      category || 'General',
      color || 'blue',
      deadline,
      priority || 'Medium',
      numericAuto,
      numericSalaryDeducted
    ]);

    // If it is a salary-deducted savings goal and has initial savings, record it as a linked expense
    if (numericSalaryDeducted === 1 && numericCurrent > 0) {
      await run(`
        INSERT INTO expenses (user_id, amount, merchant, category, date, notes, savings_goal_id)
        VALUES (?, ?, ?, 'Internal', ?, ?, ?)
      `, [
        userId,
        numericCurrent,
        `Initial sweep to ${name}`,
        'Internal',
        deadline,
        `Initial contribution to salary-deducted savings goal "${name}"`,
        result.lastID
      ]);
    }

    await logAudit(userId, `Created Savings Goal: ${name} (Target: $${numericTarget})`, req);
    res.status(201).json({ id: result.lastID, message: 'Savings goal created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. EDIT SAVINGS GOAL
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const goalId = req.params.id;
    const { name, target, current, category, color, deadline, priority, auto_contribution, is_salary_deducted } = req.body;

    const oldGoal = await get('SELECT current, is_salary_deducted, name FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
    if (!oldGoal) {
      return res.status(404).json({ error: 'Savings goal not found or unauthorized' });
    }

    const newCurrent = parseFloat(current || '0');
    const newSalaryDeducted = is_salary_deducted ? 1 : 0;

    await run(`
      UPDATE savings_goals
      SET name = ?, target = ?, current = ?, category = ?, color = ?, deadline = ?, priority = ?, auto_contribution = ?, is_salary_deducted = ?
      WHERE id = ? AND user_id = ?
    `, [
      name,
      parseFloat(target),
      newCurrent,
      category,
      color,
      deadline,
      priority,
      parseFloat(auto_contribution || '0'),
      newSalaryDeducted,
      goalId,
      userId
    ]);

    // If it is/becomes salary-deducted and the current savings amount increased during editing, record the difference as an expense
    if (newSalaryDeducted === 1 && newCurrent > oldGoal.current) {
      const diff = newCurrent - oldGoal.current;
      await run(`
        INSERT INTO expenses (user_id, amount, merchant, category, date, notes, savings_goal_id)
        VALUES (?, ?, ?, 'Internal', ?, ?, ?)
      `, [
        userId,
        diff,
        `Adjustment to ${name}`,
        'Internal',
        new Date().toISOString().split('T')[0],
        `Balance adjustment contribution to salary-deducted savings goal "${name}"`,
        goalId
      ]);
    }

    await logAudit(userId, `Edited Savings Goal: ${name}`, req);
    res.json({ message: 'Savings goal updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ADD CONTRIBUTION & CHECK MILESTONES
router.post('/:id/contribute', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const goalId = req.params.id;
    const { amount } = req.body;

    const contribution = parseFloat(amount);
    if (isNaN(contribution) || contribution <= 0) {
      return res.status(400).json({ error: 'Contribution amount must be a positive number' });
    }

    const goal = await get('SELECT name, current, target FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
    if (!goal) {
      return res.status(404).json({ error: 'Savings goal not found' });
    }

    const oldPercent = (goal.current / goal.target) * 100;
    const newCurrent = Math.min(goal.target, goal.current + contribution);
    const newPercent = (newCurrent / goal.target) * 100;

    await run('UPDATE savings_goals SET current = ? WHERE id = ? AND user_id = ?', [newCurrent, goalId, userId]);

    // Track also as a special sweep transaction in expenses
    await run(`
      INSERT INTO expenses (user_id, amount, merchant, category, date, notes, savings_goal_id)
      VALUES (?, ?, ?, 'Internal', ?, ?, ?)
    `, [userId, contribution, `Sweep to ${goal.name}`, 'Internal', new Date().toISOString().split('T')[0], `Contribution sweep to savings goal "${goal.name}"`, goalId]);

    await logAudit(userId, `Contributed $${contribution} to Savings Goal: ${goal.name}`, req);

    // Calculate milestone triggers
    const milestones = [50, 75, 100];
    for (const m of milestones) {
      if (oldPercent < m && newPercent >= m) {
        let text = `Milestone Reached! You have saved ${m}% of your target for "${goal.name}".`;
        if (m === 100) {
          text = `Goal Completed! 🎉 You have fully funded your "${goal.name}" savings goal!`;
        }
        await run(`
          INSERT INTO notifications (user_id, type, message)
          VALUES (?, 'milestone', ?)
        `, [userId, text]);
      }
    }

    res.json({ message: 'Contribution added successfully', current: newCurrent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE SAVINGS GOAL
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const goalId = req.params.id;

    const goal = await get('SELECT name FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
    if (!goal) {
      return res.status(404).json({ error: 'Savings goal not found or unauthorized' });
    }

    await run('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
    await logAudit(userId, `Deleted Savings Goal: ${goal.name}`, req);

    res.json({ message: 'Savings goal deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
