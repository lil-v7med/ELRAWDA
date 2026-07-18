import { supabase } from '../supabase/supabaseClient.js';
import { logger } from '../utils/logger.js';
import { ServiceResponse } from './authService.js';

export async function getFinancialSummary(): Promise<ServiceResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    // 1. Invoke the secure PostgreSQL financial aggregator RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_financial_summary', {
      p_user_id: userId
    });

    if (rpcErr || !rpcData) {
      logger.log('db', `RPC get_financial_summary failed: ${rpcErr?.message}`, rpcErr);
      return { success: false, error: rpcErr?.message || 'Failed to aggregate statistics.' };
    }

    // 2. Fetch last 6 months of trends
    const trends = [];
    const now = new Date();

    // Query income and expenses for the last 6 months in parallel to maximize performance
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const startStr = sixMonthsAgo.toISOString().split('T')[0];

    const [incomeRes, expenseRes, salaryGoalsRes] = await Promise.all([
      supabase.from('income').select('amount, date').gte('date', startStr),
      supabase.from('expenses').select('amount, date, savings_goal_id, category').gte('date', startStr),
      supabase.from('savings_goals').select('id').eq('user_id', userId).eq('is_salary_deducted', 1)
    ]);

    const activeSalaryGoalIds = new Set((salaryGoalsRes.data || []).map(g => g.id));
    const rawIncomes = incomeRes.data || [];
    const rawExpenses = expenseRes.data || [];

    // Filter salary goal deductions
    const filteredExpenses = rawExpenses.filter(exp => {
      return !exp.savings_goal_id || activeSalaryGoalIds.has(Number(exp.savings_goal_id));
    });

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthLabel = d.toLocaleString('default', { month: 'short' });

      const monthlyIncSum = rawIncomes
        .filter(inc => {
          const incDate = new Date(inc.date);
          return incDate.getFullYear() === year && incDate.getMonth() === month;
        })
        .reduce((sum, item) => sum + item.amount, 0);

      const monthlyExpSum = filteredExpenses
        .filter(exp => {
          const expDate = new Date(exp.date);
          return expDate.getFullYear() === year && expDate.getMonth() === month;
        })
        .reduce((sum, item) => sum + item.amount, 0);

      trends.push({
        month: monthLabel,
        year,
        income: monthlyIncSum,
        expense: monthlyExpSum
      });
    }

    // 3. Current month category breakdowns
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    const curMonthStartStr = currentMonthStart.toISOString().split('T')[0];

    const currentMonthExpenses = filteredExpenses.filter(exp => exp.date >= curMonthStartStr);
    const categoryMap = new Map<string, number>();
    for (const exp of currentMonthExpenses) {
      const cat = exp.category || 'Other';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + exp.amount);
    }

    const categories = Array.from(categoryMap.entries()).map(([category, value]) => ({
      category,
      value
    }));

    // 4. Calculate whatIf predictions
    const finalHealthScore = rpcData.healthScore || 0;
    const savingsRateScore = rpcData.healthBreakdown?.savingsRate?.score || 0;
    const debtRatioScore = rpcData.healthBreakdown?.debtRatio?.score || 0;

    const whatIfSavingsScore = Math.min(100, Math.round(finalHealthScore + (100 - savingsRateScore) * 0.20));
    const improvedDebtScore = Math.min(100, debtRatioScore + 25);
    const whatIfDebtScore = Math.min(100, Math.round(finalHealthScore + (improvedDebtScore - debtRatioScore) * 0.15));

    // 5. Emergency Fund text runway helpers
    const emergAnalysis = rpcData.emergencyAnalysis || {};
    const runwayMonths = Math.floor(emergAnalysis.coverage || 0);
    const runwayDays = Math.round(((emergAnalysis.coverage || 0) - runwayMonths) * 30);
    
    const runwayText = runwayMonths > 0
      ? `${runwayMonths} أشهر و ${runwayDays} يوم`
      : `${runwayDays} يوم`;

    const avgExpense = Math.max(trends.reduce((sum, t) => sum + t.expense, 0) / (trends.filter(t => t.expense > 0).length || 1), 500);
    const runway20 = (rpcData.totalSavings || 0) / (avgExpense * 1.2);
    const runway20Text = Math.floor(runway20) > 0
      ? `${Math.floor(runway20)} أشهر`
      : `${Math.round(runway20 * 30)} يوم`;

    // Query active auto monthly emergency savings contributions
    const { data: allGoals } = await supabase
      .from('savings_goals')
      .select('name, category, auto_contribution')
      .eq('user_id', userId);

    const emergGoals = (allGoals || []).filter((g: any) => {
      const gName = (g.name || '').toLowerCase();
      return gName.includes('طوارئ') || gName.includes('emergency') || g.category === 'Savings';
    });

    const monthlyContribution = emergGoals.reduce((sum: number, g: any) => sum + (g.auto_contribution || 0), 0) || 3000;
    const monthsToSafeLimit = monthlyContribution > 0 ? Math.ceil((emergAnalysis.deficit || 0) / monthlyContribution) : 0;

    // 6. Dynamic Arabic Coach Insights
    const insights = [];
    const debtRatioVal = rpcData.totalAssets > 0 ? (rpcData.totalDebts / rpcData.totalAssets) * 100 : 0;

    // Weakness
    if ((emergAnalysis.coverage || 0) < 3.0) {
      insights.push({
        type: 'weakness',
        title: 'ضعف غطاء الطوارئ المالي',
        description: `صندوق الطوارئ الحالي يغطي فقط ${(emergAnalysis.coverage || 0).toFixed(1)} أشهر من نفقاتك. يوصى دائماً بتأمين مصروفات 6 أشهر لمواجهة أي ظرف مفاجئ مثل البطالة أو الحالات العائلية المستعجلة.`
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
    const monthlyIncome = rpcData.monthlyIncome || 0;
    const monthlyExpense = rpcData.monthlyExpense || 0;
    const savingsRatio = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

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
        title: 'تنوع في مصادر الدخل',
        description: 'لديك تدفقات دخل نشطة متعددة مما يقلل من مخاطر الاعتماد على وظيفة أو مصدر وحيد للدخل.'
      });
    }

    // Recommended Action
    if ((emergAnalysis.deficit || 0) > 0) {
      insights.push({
        type: 'action',
        title: 'تدعيم صندوق الطوارئ',
        description: `خصص مبلغاً شهرياً ثابتاً للوصول إلى غطاء الأمان المستهدف وهو $${((emergAnalysis.target || 6) * avgExpense).toLocaleString()} جنيه.`
      });
    } else {
      insights.push({
        type: 'action',
        title: 'تنويع الاستثمارات',
        description: 'وجه جزءاً من مدخراتك الزائدة نحو شراء سبائك الذهب أو صناديق الاستثمار كحل وقائي ضد تضخم الأسعار.'
      });
    }

    // Assemble final dashboard model
    const payload = {
      ...rpcData,
      trends,
      categories,
      whatIf: {
        increaseSavings: whatIfSavingsScore,
        payDebts: whatIfDebtScore
      },
      emergencyAnalysis: {
        ...emergAnalysis,
        monthlyContribution,
        monthsToTarget: monthsToSafeLimit,
        runwayText,
        runway20Text
      },
      aiInsights: insights
    };

    return {
      success: true,
      data: payload
    };
  } catch (err: any) {
    logger.log('exception', `getFinancialSummary exception`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Compiles custom transaction exports in UTF-8 BOM CSV format
 */
export async function getExportCSV(startDate?: string, endDate?: string): Promise<ServiceResponse<string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Unauthorized.' };

    const userId = session.user.id;

    let incQuery = supabase.from('income').select('amount, source, category, date, notes').eq('user_id', userId);
    let expQuery = supabase.from('expenses').select('amount, merchant, category, date, notes, savings_goal_id').eq('user_id', userId);

    if (startDate && endDate) {
      incQuery = incQuery.gte('date', startDate).lte('date', endDate);
      expQuery = expQuery.gte('date', startDate).lte('date', endDate);
    }

    const [incomeRes, expenseRes, salaryGoalsRes] = await Promise.all([
      incQuery,
      expQuery,
      supabase.from('savings_goals').select('id').eq('user_id', userId).eq('is_salary_deducted', 1)
    ]);

    if (incomeRes.error) return { success: false, error: incomeRes.error.message };
    if (expenseRes.error) return { success: false, error: expenseRes.error.message };

    const activeSalaryGoalIds = new Set((salaryGoalsRes.data || []).map(g => g.id));
    const incomes = incomeRes.data || [];
    const expenses = (expenseRes.data || []).filter(exp => {
      return !exp.savings_goal_id || activeSalaryGoalIds.has(Number(exp.savings_goal_id));
    });

    const formattedIncomes = incomes.map(inc => ({
      date: inc.date,
      type: 'Income',
      description: inc.source,
      category: inc.category,
      amount: inc.amount,
      notes: inc.notes || ''
    }));

    const formattedExpenses = expenses.map(exp => ({
      date: exp.date,
      type: 'Expense',
      description: exp.merchant,
      category: exp.category,
      amount: exp.amount,
      notes: exp.notes || ''
    }));

    const sorted = [...formattedIncomes, ...formattedExpenses].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Compile CSV layout with UTF-8 BOM
    let csvString = '\ufeffDate,Type,Description,Category,Amount,Notes\n';
    for (const row of sorted) {
      const cleanDesc = row.description.replace(/"/g, '""');
      const cleanNotes = row.notes.replace(/"/g, '""');
      csvString += `${row.date},${row.type},"${cleanDesc}","${row.category}",${row.amount},"${cleanNotes}"\n`;
    }

    return {
      success: true,
      data: csvString
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
