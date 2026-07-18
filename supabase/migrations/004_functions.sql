-- =========================================================================
-- ELRAWDA Migration: 004_functions.sql
-- Sets up database triggers, security checks, and transactional calculations.
-- =========================================================================

-- 1. Automating profiles creation and default budgets on signup in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  
  -- Seed initial budget limits
  INSERT INTO public.budgets (user_id, category, monthly_limit)
  VALUES 
    (NEW.id, 'Groceries', 500.00),
    (NEW.id, 'Utilities', 250.00)
  ON CONFLICT (user_id, category) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Restrict non-admins from changing roles in public.profiles
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    -- Validate whether the updater holds an admin role
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.role := OLD.role; -- prevent role change
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE OR REPLACE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.check_profile_update();


-- 3. Atomic Savings Goal Contribution Sweeper
CREATE OR REPLACE FUNCTION public.contribute_to_goal(goal_id BIGINT, amount DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  v_user_id UUID;
  v_goal_name TEXT;
  v_current DOUBLE PRECISION;
  v_target DOUBLE PRECISION;
  v_old_percent DOUBLE PRECISION;
  v_new_percent DOUBLE PRECISION;
  v_final_contribution DOUBLE PRECISION;
  v_new_current DOUBLE PRECISION;
  v_today TEXT;
  v_milestone INT;
  v_msg TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock row to prevent overlapping sweeps
  SELECT user_id, name, current, target INTO v_user_id, v_goal_name, v_current, v_target
  FROM public.savings_goals
  WHERE id = goal_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_goal_name IS NULL THEN
    RAISE EXCEPTION 'Savings goal not found or unauthorized';
  END IF;

  v_old_percent := (v_current / v_target) * 100;
  
  -- Calculate capped contribution
  IF v_current + amount > v_target THEN
    v_final_contribution := v_target - v_current;
  ELSE
    v_final_contribution := amount;
  END IF;

  IF v_final_contribution <= 0 THEN
    RETURN v_current;
  END IF;

  v_new_current := v_current + v_final_contribution;
  v_new_percent := (v_new_current / v_target) * 100;

  -- Update savings goal balance
  UPDATE public.savings_goals
  SET current = v_new_current
  WHERE id = goal_id;

  -- Record connected sweep expense transaction
  v_today := to_char(now(), 'YYYY-MM-DD');
  INSERT INTO public.expenses (user_id, amount, merchant, category, date, notes, savings_goal_id)
  VALUES (
    v_user_id,
    v_final_contribution,
    'Sweep to ' || v_goal_name,
    'Internal',
    v_today,
    'Contribution sweep to savings goal "' || v_goal_name || '"',
    goal_id
  );

  -- Handle milestones
  FOREACH v_milestone IN ARRAY ARRAY[50, 75, 100] LOOP
    IF v_old_percent < v_milestone AND v_new_percent >= v_milestone THEN
      IF v_milestone = 100 THEN
        v_msg := 'Goal Completed! 🎉 You have fully funded your "' || v_goal_name || '" savings goal!';
      ELSE
        v_msg := 'Milestone Reached! You have saved ' || v_milestone || '% of your target for "' || v_goal_name || '".';
      END IF;
      
      INSERT INTO public.notifications (user_id, type, message)
      VALUES (v_user_id, 'milestone', v_msg);
    END IF;
  END LOOP;

  RETURN v_new_current;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Secure Telemetry counts for admin board
CREATE OR REPLACE FUNCTION public.get_system_telemetry()
RETURNS JSON AS $$
DECLARE
  user_count BIGINT;
  income_count BIGINT;
  expense_count BIGINT;
  savings_count BIGINT;
  audit_count BIGINT;
BEGIN
  -- Authenticate and authorize admin user
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO user_count FROM public.profiles;
  SELECT count(*) INTO income_count FROM public.income;
  SELECT count(*) INTO expense_count FROM public.expenses;
  SELECT count(*) INTO savings_count FROM public.savings_goals;
  SELECT count(*) INTO audit_count FROM public.audit_logs;

  RETURN json_build_object(
    'users', user_count,
    'incomeRows', income_count,
    'expenseRows', expense_count,
    'savingsGoals', savings_count,
    'auditLogs', audit_count,
    'dbStatus', 'Healthy',
    'environment', 'production'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Secure Financial summary function for reports & dashboards
CREATE OR REPLACE FUNCTION public.get_financial_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_income DOUBLE PRECISION;
  v_total_expenses DOUBLE PRECISION;
  v_total_savings DOUBLE PRECISION;
  v_total_assets DOUBLE PRECISION;
  v_total_debts DOUBLE PRECISION;
  v_current_balance DOUBLE PRECISION;
  v_net_worth DOUBLE PRECISION;
  v_monthly_income DOUBLE PRECISION;
  v_monthly_expense DOUBLE PRECISION;
  v_start_of_month TEXT;
  v_now TIMESTAMPTZ;
  v_avg_monthly_expense DOUBLE PRECISION;
  v_emergency_fund DOUBLE PRECISION;
  v_emerg_coverage DOUBLE PRECISION;
  v_emerg_deficit DOUBLE PRECISION;
  v_recommended_months DOUBLE PRECISION := 6.0;
  v_recommended_target DOUBLE PRECISION;
  v_risk_level TEXT;
  
  -- health score components
  v_savings_ratio DOUBLE PRECISION;
  v_expense_ratio DOUBLE PRECISION;
  v_savings_score INT;
  v_savings_status TEXT;
  v_debt_ratio DOUBLE PRECISION;
  v_debt_score INT;
  v_debt_status TEXT;
  v_budget_limit DOUBLE PRECISION;
  v_expense_control_score INT;
  v_expense_control_status TEXT;
  v_recurring_inc_count BIGINT;
  v_income_stability_score INT;
  v_income_stability_status TEXT;
  v_emerg_score INT;
  v_emerg_status TEXT;
  v_asset_types_count BIGINT;
  v_investment_score INT;
  v_investment_status TEXT;
  v_net_worth_score INT;
  v_net_worth_status TEXT;
  v_final_health_score INT;
BEGIN
  -- Authenticated user validation
  IF auth.uid() <> p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_now := now();
  v_start_of_month := to_char(v_now, 'YYYY-MM-01');

  -- Aggregate overall totals
  SELECT COALESCE(SUM(amount), 0.0) INTO v_total_income FROM public.income WHERE user_id = p_user_id;
  
  SELECT COALESCE(SUM(amount), 0.0) INTO v_total_expenses FROM public.expenses 
  WHERE user_id = p_user_id 
    AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM public.savings_goals WHERE is_salary_deducted = 1));
    
  SELECT COALESCE(SUM(current), 0.0) INTO v_total_savings FROM public.savings_goals WHERE user_id = p_user_id;
  
  SELECT COALESCE(SUM(value), 0.0) INTO v_total_assets FROM public.assets WHERE user_id = p_user_id;
  
  SELECT COALESCE(SUM(amount), 0.0) INTO v_total_debts FROM public.debts WHERE user_id = p_user_id;

  v_current_balance := v_total_income - v_total_expenses;
  v_net_worth := v_current_balance + v_total_assets - v_total_debts;

  -- Current month income / expense
  SELECT COALESCE(SUM(amount), 0.0) INTO v_monthly_income FROM public.income 
  WHERE user_id = p_user_id AND date >= v_start_of_month;
  
  SELECT COALESCE(SUM(amount), 0.0) INTO v_monthly_expense FROM public.expenses 
  WHERE user_id = p_user_id AND date >= v_start_of_month
    AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM public.savings_goals WHERE is_salary_deducted = 1));

  -- Emergency Fund logic
  SELECT COALESCE(SUM(current), 0.0) INTO v_emergency_fund FROM public.savings_goals 
  WHERE user_id = p_user_id AND (name ILIKE '%طوارئ%' OR name ILIKE '%emergency%' OR category = 'Savings');

  -- Average monthly expense (last 6 months trend)
  SELECT COALESCE(AVG(m_total), 500.0) INTO v_avg_monthly_expense FROM (
    SELECT COALESCE(SUM(amount), 0.0) AS m_total 
    FROM public.expenses 
    WHERE user_id = p_user_id 
      AND (savings_goal_id IS NULL OR savings_goal_id IN (SELECT id FROM public.savings_goals WHERE is_salary_deducted = 1))
      AND date >= to_char(v_now - interval '6 months', 'YYYY-MM-01')
    GROUP BY substr(date, 1, 7)
  ) AS monthly_exp_sums;

  IF v_avg_monthly_expense IS NULL OR v_avg_monthly_expense <= 0 THEN
    v_avg_monthly_expense := 500.0;
  END IF;

  v_emerg_coverage := v_emergency_fund / v_avg_monthly_expense;
  v_recommended_target := v_avg_monthly_expense * v_recommended_months;
  v_emerg_deficit := GREATEST(0.0, v_recommended_target - v_emergency_fund);

  IF v_emerg_coverage >= 6.0 THEN v_risk_level := 'منخفض';
  ELSIF v_emerg_coverage >= 3.0 THEN v_risk_level := 'متوسط';
  ELSE v_risk_level := 'مرتفع';
  END IF;

  -- Health Score Calculations
  -- A. Savings Rate (20% weight)
  v_savings_ratio := CASE WHEN v_monthly_income > 0 THEN ((v_monthly_income - v_monthly_expense) / v_monthly_income) * 100 ELSE 0.0 END;
  v_expense_ratio := CASE WHEN v_monthly_income > 0 THEN (v_monthly_expense / v_monthly_income) * 100 ELSE 0.0 END;
  
  IF v_savings_ratio >= 25 THEN v_savings_score := 100; v_savings_status := 'ممتاز';
  ELSIF v_savings_ratio >= 15 THEN v_savings_score := 85; v_savings_status := 'جيد جداً';
  ELSIF v_savings_ratio >= 5 THEN v_savings_score := 60; v_savings_status := 'جيد';
  ELSE v_savings_score := 30; v_savings_status := 'يحتاج تحسين';
  END IF;

  -- B. Debt Ratio (15% weight)
  v_debt_ratio := CASE WHEN v_total_assets > 0 THEN (v_total_debts / v_total_assets) * 100 ELSE (CASE WHEN v_total_debts > 0 THEN 80.0 ELSE 0.0 END) END;
  IF v_debt_ratio > 50 THEN v_debt_score := 30; v_debt_status := 'يحتاج تحسين';
  ELSIF v_debt_ratio > 30 THEN v_debt_score := 60; v_debt_status := 'جيد';
  ELSIF v_debt_ratio > 10 THEN v_debt_score := 85; v_debt_status := 'جيد جداً';
  ELSE v_debt_score := 100; v_debt_status := 'ممتاز';
  END IF;

  -- C. Expense Control (15% weight)
  SELECT COALESCE(SUM(monthly_limit), 0.0) INTO v_budget_limit FROM public.budgets WHERE user_id = p_user_id;
  v_expense_control_score := 70;
  v_expense_control_status := 'جيد';
  IF v_budget_limit > 0 THEN
    IF v_monthly_expense / v_budget_limit <= 0.8 THEN v_expense_control_score := 100; v_expense_control_status := 'ممتاز';
    ELSIF v_monthly_expense / v_budget_limit <= 1.0 THEN v_expense_control_score := 85; v_expense_control_status := 'جيد جداً';
    ELSIF v_monthly_expense / v_budget_limit <= 1.25 THEN v_expense_control_score := 60; v_expense_control_status := 'جيد';
    ELSE v_expense_control_score := 30; v_expense_control_status := 'يحتاج تحسين';
    END IF;
  END IF;

  -- D. Income Stability (15% weight)
  SELECT COUNT(*) INTO v_recurring_inc_count FROM public.income WHERE user_id = p_user_id AND recurring = 1;
  IF v_recurring_inc_count >= 2 THEN v_income_stability_score := 100; v_income_stability_status := 'ممتاز';
  ELSIF v_recurring_inc_count = 1 THEN v_income_stability_score := 85; v_income_stability_status := 'جيد جداً';
  ELSE v_income_stability_score := 50; v_income_stability_status := 'جيد';
  END IF;

  -- E. Emergency Fund (15% weight)
  IF v_emerg_coverage >= 6.0 THEN v_emerg_score := 100; v_emerg_status := 'ممتاز';
  ELSIF v_emerg_coverage >= 3.0 THEN v_emerg_score := 80; v_emerg_status := 'جيد جداً';
  ELSIF v_emerg_coverage >= 1.0 THEN v_emerg_score := 60; v_emerg_status := 'جيد';
  ELSE v_emerg_score := 30; v_emerg_status := 'يحتاج تحسين';
  END IF;

  -- F. Investment Diversification (10% weight)
  SELECT COUNT(DISTINCT type) INTO v_asset_types_count FROM public.assets WHERE user_id = p_user_id;
  IF v_asset_types_count >= 3 THEN v_investment_score := 100; v_investment_status := 'ممتاز';
  ELSIF v_asset_types_count = 2 THEN v_investment_score := 75; v_investment_status := 'جيد';
  ELSE v_investment_score := 40; v_investment_status := 'يحتاج تحسين';
  END IF;

  -- G. Net Worth Growth (10% weight)
  IF v_net_worth > 100000 THEN v_net_worth_score := 100; v_net_worth_status := 'ممتاز';
  ELSIF v_net_worth > 20000 THEN v_net_worth_score := 75; v_net_worth_status := 'جيد';
  ELSE v_net_worth_score := 45; v_net_worth_status := 'يحتاج تحسين';
  END IF;

  -- Final Score
  v_final_health_score := ROUND(
    (v_savings_score * 0.20) +
    (v_debt_score * 0.15) +
    (v_expense_control_score * 0.15) +
    (v_income_stability_score * 0.15) +
    (v_emerg_score * 0.15) +
    (v_investment_score * 0.10) +
    (v_net_worth_score * 0.10)
  );

  RETURN json_build_object(
    'balance', v_current_balance,
    'netWorth', v_net_worth,
    'totalIncome', v_total_income,
    'totalExpenses', v_total_expenses,
    'totalSavings', v_total_savings,
    'totalAssets', v_total_assets,
    'totalDebts', v_total_debts,
    'monthlyIncome', v_monthly_income,
    'monthlyExpense', v_monthly_expense,
    'healthScore', v_final_health_score,
    'savingsRatio', GREATEST(0.0, v_savings_ratio),
    'expenseRatio', v_expense_ratio,
    'healthBreakdown', json_build_object(
      'savingsRate', json_build_object('score', v_savings_score, 'weight', 20, 'status', v_savings_status, 'desc', 'يقيس هذا العامل نسبة الادخار الفعلي الشهري من مجمل الدخل.'),
      'debtRatio', json_build_object('score', v_debt_score, 'weight', 15, 'status', v_debt_status, 'desc', 'يقيس حجم الالتزامات المستحقة للدائنين مقابل أصولك الإجمالية.'),
      'expenseControl', json_build_object('score', v_expense_control_score, 'weight', 15, 'status', v_expense_control_status, 'desc', 'مقارنة استهلاكك الفعلي بالحدود القصوى التي قمت بضبطها في الميزانية.'),
      'incomeStability', json_build_object('score', v_income_stability_score, 'weight', 15, 'status', v_income_stability_status, 'desc', 'يعتمد على عدد وتواتر مصادر الدخل النشطة والمتكررة.'),
      'emergencyFund', json_build_object('score', v_emerg_score, 'weight', 15, 'status', v_emerg_status, 'desc', 'نسبة السيولة النقدية المتاحة لتغطية النفقات الضرورية عند الأزمات.'),
      'investment', json_build_object('score', v_investment_score, 'weight', 10, 'status', v_investment_status, 'desc', 'يقيس تنوع المحفظة وتوزعها على فئات الأصول الاستثمارية المختلفة.'),
      'netWorthGrowth', json_build_object('score', v_net_worth_score, 'weight', 10, 'status', v_net_worth_status, 'desc', 'يقيس معدل نمو أصولك الصافية بعد خصم المطلوبات المالية.')
    ),
    'emergencyAnalysis', json_build_object(
      'coverage', v_emerg_coverage,
      'target', v_recommended_months,
      'risk', v_risk_level,
      'deficit', v_emerg_deficit
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Self Delete User account from auth.users (Security Definer to bypass client limitations)
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

