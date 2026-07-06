import { Router, Response } from 'express';
import { query, get } from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET ANALYTICS SUMMARY
router.get('/summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // 1. Retrieve total balances
    const incSum = await get('SELECT SUM(amount) as total FROM income WHERE user_id = ?', [userId]);
    const expSum = await get(`
      SELECT SUM(amount) as total FROM expenses 
      WHERE user_id = ? 
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
    `, [userId]);
    const svgSum = await get('SELECT SUM(current) as total FROM savings_goals WHERE user_id = ?', [userId]);
    const assetSum = await get('SELECT SUM(value) as total FROM assets WHERE user_id = ?', [userId]);
    const debtSum = await get('SELECT SUM(amount) as total FROM debts WHERE user_id = ?', [userId]);

    const totalIncome = incSum.total || 0;
    const totalExpenses = expSum.total || 0;
    const totalSavings = svgSum.total || 0;
    const totalAssets = assetSum.total || 0;
    const totalDebts = debtSum.total || 0;

    // Capital ledger starting point adjusted by transactions
    const initialBalance = 0.00;
    const currentBalance = initialBalance + totalIncome - totalExpenses;
    const netWorth = currentBalance + totalAssets - totalDebts;

    // Get current month details
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const currentMonthInc = await get('SELECT SUM(amount) as total FROM income WHERE user_id = ? AND date >= ?', [userId, currentMonthStart]);
    const currentMonthExp = await get(`
      SELECT SUM(amount) as total FROM expenses 
      WHERE user_id = ? AND date >= ?
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
    `, [userId, currentMonthStart]);

    const monthlyIncome = currentMonthInc.total || 0;
    const monthlyExpense = currentMonthExp.total || 0;

    // Last 6 months cash flow breakdown
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthLabel = d.toLocaleString('default', { month: 'short' });

      const start = `${year}-${month}-01`;
      const nextMonth = d.getMonth() === 11 ? 1 : d.getMonth() + 2;
      const nextYear = d.getMonth() === 11 ? year + 1 : year;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const incObj = await get('SELECT SUM(amount) as total FROM income WHERE user_id = ? AND date >= ? AND date < ?', [userId, start, end]);
      const expObj = await get(`
        SELECT SUM(amount) as total FROM expenses 
        WHERE user_id = ? AND date >= ? AND date < ? 
          AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
      `, [userId, start, end]);

      monthlyTrends.push({
        month: monthLabel,
        year,
        income: incObj.total || 0,
        expense: expObj.total || 0
      });
    }

    // Expenses by category
    const categoryBreakdown = await query(`
      SELECT category, SUM(amount) as value 
      FROM expenses 
      WHERE user_id = ? AND date >= ?
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
      GROUP BY category
    `, [userId, currentMonthStart]);

    // Emergency Fund calculation
    const emergFundObj = await get(`
      SELECT SUM(current) as total FROM savings_goals 
      WHERE user_id = ? AND (name LIKE '%طوارئ%' OR name LIKE '%emergency%' OR category = 'Savings')
    `, [userId]);
    const emergencyFund = emergFundObj.total || 0;

    // Monthly average expenses (based on last 6 months)
    const activeExpenseMonths = monthlyTrends.filter(t => t.expense > 0).length || 1;
    const avgMonthlyExpense = Math.max(monthlyTrends.reduce((sum, item) => sum + item.expense, 0) / activeExpenseMonths, 500);

    const emergCoverageMonths = emergencyFund / avgMonthlyExpense;
    const recommendedTargetMonths = 6.0;
    const recommendedTargetVal = avgMonthlyExpense * recommendedTargetMonths;
    const emergDeficit = Math.max(0, recommendedTargetVal - emergencyFund);

    let emergRiskLevel = 'مرتفع';
    if (emergCoverageMonths >= 6.0) emergRiskLevel = 'منخفض';
    else if (emergCoverageMonths >= 3.0) emergRiskLevel = 'متوسط';

    // 1. Calculate Score Factors
    // A. Savings Rate (20% weight)
    const savingsRatio = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;
    const expenseRatio = monthlyIncome > 0 ? (monthlyExpense / monthlyIncome) * 100 : 0;
    let savingsRateScore = 30;
    let savingsRateStatus = 'يحتاج تحسين';
    if (savingsRatio >= 25) { savingsRateScore = 100; savingsRateStatus = 'ممتاز'; }
    else if (savingsRatio >= 15) { savingsRateScore = 85; savingsRateStatus = 'جيد جداً'; }
    else if (savingsRatio >= 5) { savingsRateScore = 60; savingsRateStatus = 'جيد'; }

    // B. Debt Ratio (15% weight)
    const debtRatioVal = totalAssets > 0 ? (totalDebts / totalAssets) * 100 : (totalDebts > 0 ? 80 : 0);
    let debtRatioScore = 100;
    let debtRatioStatus = 'ممتاز';
    if (debtRatioVal > 50) { debtRatioScore = 30; debtRatioStatus = 'يحتاج تحسين'; }
    else if (debtRatioVal > 30) { debtRatioScore = 60; debtRatioStatus = 'جيد'; }
    else if (debtRatioVal > 10) { debtRatioScore = 85; debtRatioStatus = 'جيد جداً'; }

    // C. Expense Control (15% weight)
    const budgetLimitObj = await get('SELECT SUM(monthly_limit) as total FROM budgets WHERE user_id = ?', [userId]);
    const totalBudgetLimit = budgetLimitObj.total || 0;
    let expenseControlScore = 70;
    let expenseControlStatus = 'جيد';
    if (totalBudgetLimit > 0) {
      const ratio = monthlyExpense / totalBudgetLimit;
      if (ratio <= 0.8) { expenseControlScore = 100; expenseControlStatus = 'ممتاز'; }
      else if (ratio <= 1.0) { expenseControlScore = 85; expenseControlStatus = 'جيد جداً'; }
      else if (ratio <= 1.25) { expenseControlScore = 60; expenseControlStatus = 'جيد'; }
      else { expenseControlScore = 30; expenseControlStatus = 'يحتاج تحسين'; }
    }

    // D. Income Stability (15% weight)
    const recurringIncObj = await get('SELECT COUNT(*) as count FROM income WHERE user_id = ? AND recurring = 1', [userId]);
    const recurringCount = recurringIncObj.count || 0;
    let incomeStabilityScore = 50;
    let incomeStabilityStatus = 'جيد';
    if (recurringCount >= 2) { incomeStabilityScore = 100; incomeStabilityStatus = 'ممتاز'; }
    else if (recurringCount === 1) { incomeStabilityScore = 85; incomeStabilityStatus = 'جيد جداً'; }

    // E. Emergency Fund (15% weight)
    let emergencyFundScore = 30;
    let emergencyFundStatus = 'يحتاج تحسين';
    if (emergCoverageMonths >= 6.0) { emergencyFundScore = 100; emergencyFundStatus = 'ممتاز'; }
    else if (emergCoverageMonths >= 3.0) { emergencyFundScore = 80; emergencyFundStatus = 'جيد جداً'; }
    else if (emergCoverageMonths >= 1.0) { emergencyFundScore = 60; emergencyFundStatus = 'جيد'; }

    // F. Investment Diversification (10% weight)
    const assetTypesObj = await get('SELECT COUNT(DISTINCT type) as count FROM assets WHERE user_id = ?', [userId]);
    const assetTypesCount = assetTypesObj.count || 0;
    let investmentScore = 40;
    let investmentStatus = 'يحتاج تحسين';
    if (assetTypesCount >= 3) { investmentScore = 100; investmentStatus = 'ممتاز'; }
    else if (assetTypesCount === 2) { investmentScore = 75; investmentStatus = 'جيد'; }

    // G. Net Worth Growth (10% weight)
    let netWorthScore = 45;
    let netWorthStatus = 'يحتاج تحسين';
    if (netWorth > 100000) { netWorthScore = 100; netWorthStatus = 'ممتاز'; }
    else if (netWorth > 20000) { netWorthScore = 75; netWorthStatus = 'جيد'; }

    // Aggregate Score
    const finalHealthScore = Math.round(
      (savingsRateScore * 0.20) +
      (debtRatioScore * 0.15) +
      (expenseControlScore * 0.15) +
      (incomeStabilityScore * 0.15) +
      (emergencyFundScore * 0.15) +
      (investmentScore * 0.10) +
      (netWorthScore * 0.10)
    );

    // Compute What-If predictions
    // 1. What if savings rate increases by 10% (equivalent to adding 10 pts to savings score)
    const whatIfSavingsScore = Math.min(100, Math.round(finalHealthScore + (100 - savingsRateScore) * 0.20));
    // 2. What if debts reduced by 50% (equivalent to improving debt ratio score)
    const improvedDebtScore = Math.min(100, debtRatioScore + 25);
    const whatIfDebtScore = Math.min(100, Math.round(finalHealthScore + (improvedDebtScore - debtRatioScore) * 0.15));

    // Emergency Fund Scenarios
    const runwayMonths = Math.floor(emergCoverageMonths);
    const runwayDays = Math.round((emergCoverageMonths - runwayMonths) * 30);
    const runwayText = runwayMonths > 0 
      ? `${runwayMonths} أشهر و ${runwayDays} يوم`
      : `${runwayDays} يوم`;

    const runway20 = emergencyFund / (avgMonthlyExpense * 1.2);
    const runway20Text = Math.floor(runway20) > 0
      ? `${Math.floor(runway20)} أشهر`
      : `${Math.round(runway20 * 30)} يوم`;

    const monthlyContributionObj = await get(`
      SELECT SUM(auto_contribution) as total FROM savings_goals 
      WHERE user_id = ? AND (name LIKE '%طوارئ%' OR name LIKE '%emergency%' OR category = 'Savings')
    `, [userId]);
    const monthlyContribution = monthlyContributionObj.total || 3000; // default to 3000 if not specified
    const monthsToSafeLimit = monthlyContribution > 0 ? Math.ceil(emergDeficit / monthlyContribution) : 0;

    // AI advisor insights logic (Dynamic Arabic Coach advice)
    const insights = [];
    
    // Weakness
    if (emergCoverageMonths < 3.0) {
      insights.push({
        type: 'weakness',
        title: 'ضعف غطاء الطوارئ المالي',
        description: `صندوق الطوارئ الحالي يغطي فقط ${emergCoverageMonths.toFixed(1)} أشهر من نفقاتك. يوصى دائماً بتأمين مصروفات 6 أشهر لمواجهة أي ظرف مفاجئ مثل البطالة أو الحالات العائلية المستعجلة.`
      });
    } else if (debtRatioVal > 30) {
      insights.push({
        type: 'weakness',
        title: 'ارتفاع نسبة الالتزامات المالية للديون',
        description: `ديونك تمثل نسبة ${debtRatioVal.toFixed(1)}% من إجمالي أصولك. ننصح بالتركيز على سداد الديون ذات الفائدة الأعلى لتقليل تكلفة الفائدة المركبة.`
      });
    } else {
      insights.push({
        type: 'weakness',
        title: 'ضعف العوائد على النقدية الراكدة',
        description: 'جزء كبير من محفظتك يكمن في حسابات جارية تتعرض للتآكل بسبب التضخم السنوي. ينصح بتحويل جزء من الفائض نحو استثمارات ذات عائد.'
      });
    }

    // Strength
    if (savingsRatio >= 20) {
      insights.push({
        type: 'strength',
        title: 'معدل ادخار شهري ممتاز',
        description: `نسبة ادخارك تبلغ ${savingsRatio.toFixed(1)}% من الدخل الإجمالي. هذا يعكس وعياً مالياً ممتازاً ويمهد لبناء ثروة سريعة ومستقرة.`
      });
    } else if (debtRatioVal <= 15) {
      insights.push({
        type: 'strength',
        title: 'نسبة ديون منخفضة جداً',
        description: 'ديونك منخفضة جداً مقارنة بحجم ميزانيتك العمومية وأصولك، مما يمنحك مرونة عالية وقدرة ممتازة على المناورة المالية والاستثمار.'
      });
    } else {
      insights.push({
        type: 'strength',
        title: 'تنوع متوسط في مصادر الدخل',
        description: 'لديك تدفقات دخل نشطة متعددة مما يقلل من مخاطر الاعتماد على وظيفة أو مصدر وحيد للدخل.'
      });
    }

    // Next Action Recommendation
    if (emergDeficit > 0) {
      insights.push({
        type: 'action',
        title: 'تدعيم صندوق الطوارئ',
        description: `خصص مبلغاً شهرياً ثابتاً للوصول إلى غطاء الأمان المستهدف وهو ${recommendedTargetVal.toLocaleString()} جنيه.`
      });
    } else {
      insights.push({
        type: 'action',
        title: 'تنويع الاستثمارات',
        description: 'وجه جزءاً من مدخراتك الزائدة نحو شراء سبائك الذهب أو صناديق الاستثمار كحل وقائي ضد تضخم الأسعار.'
      });
    }

    res.json({
      balance: currentBalance,
      netWorth,
      totalIncome,
      totalExpenses,
      totalSavings,
      totalAssets,
      totalDebts,
      monthlyIncome,
      monthlyExpense,
      healthScore: finalHealthScore,
      savingsRatio: Math.max(0, savingsRatio),
      expenseRatio,
      trends: monthlyTrends,
      categories: categoryBreakdown,
      healthBreakdown: {
        savingsRate: { score: savingsRateScore, weight: 20, status: savingsRateStatus, desc: 'يقيس هذا العامل نسبة الادخار الفعلي الشهري من مجمل الدخل.' },
        debtRatio: { score: debtRatioScore, weight: 15, status: debtRatioStatus, desc: 'يقيس حجم الالتزامات المستحقة للدائنين مقابل أصولك الإجمالية.' },
        expenseControl: { score: expenseControlScore, weight: 15, status: expenseControlStatus, desc: 'مقارنة استهلاكك الفعلي بالحدود القصوى التي قمت بضبطها في الميزانية.' },
        incomeStability: { score: incomeStabilityScore, weight: 15, status: incomeStabilityStatus, desc: 'يعتمد على عدد وتواتر مصادر الدخل النشطة والمتكررة.' },
        emergencyFund: { score: emergencyFundScore, weight: 15, status: emergencyFundStatus, desc: 'نسبة السيولة النقدية المتاحة لتغطية النفقات الضرورية عند الأزمات.' },
        investment: { score: investmentScore, weight: 10, status: investmentStatus, desc: 'يقيس تنوع المحفظة وتوزعها على فئات الأصول الاستثمارية المختلفة.' },
        netWorthGrowth: { score: netWorthScore, weight: 10, status: netWorthStatus, desc: 'يقيس معدل نمو أصولك الصافية بعد خصم المطلوبات المالية.' }
      },
      whatIf: {
        increaseSavings: whatIfSavingsScore,
        payDebts: whatIfDebtScore
      },
      emergencyAnalysis: {
        coverage: emergCoverageMonths,
        target: recommendedTargetMonths,
        risk: emergRiskLevel,
        deficit: emergDeficit,
        monthlyContribution,
        monthsToTarget: monthsToSafeLimit,
        runwayText,
        runway20Text
      },
      aiInsights: insights
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// EXPORT RAW TRANSACTION DATA (CSV format generator)
router.get('/export', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    let sqlInc = 'SELECT amount, source as description, category, date, "Income" as type, notes FROM income WHERE user_id = ?';
    let sqlExp = `
      SELECT amount, merchant as description, category, date, "Expense" as type, notes 
      FROM expenses 
      WHERE user_id = ?
        AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM savings_goals WHERE is_salary_deducted = 1))
    `;
    const params: any[] = [userId];

    if (startDate && endDate) {
      sqlInc += ' AND date >= ? AND date <= ?';
      sqlExp += ' AND date >= ? AND date <= ?';
      params.push(startDate, endDate);
    }

    const incomes = await query(sqlInc, params);
    const expenses = await query(sqlExp, params);

    const transactions = [...incomes, ...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Generate CSV string
    let csv = '\ufeffDate,Type,Description,Category,Amount,Notes\n'; // Add UTF-8 BOM for Excel Arabic encoding support
    for (const t of transactions) {
      const cleanDesc = (t.description || '').replace(/"/g, '""');
      const cleanNotes = (t.notes || '').replace(/"/g, '""');
      csv += `${t.date},${t.type},"${cleanDesc}","${t.category}",${t.amount},"${cleanNotes}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=elrawda_transactions_${Date.now()}.csv`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
