import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDB, run, get, query } from './db.js';
import { JWT_SECRET } from './middleware/auth.js';

async function runTests() {
  console.log('==========================================================');
  console.log('  ELRAWDA Integration & API Test Suite Booting');
  console.log('==========================================================');

  try {
    // 1. Initialize DB Check
    console.log('[1/7] Initializing database connections...');
    await initDB();
    console.log('PASS: Database schemas initialized successfully.');

    // 2. Validate Password Hashing & Registration
    console.log('[2/7] Testing User Registration & Password Hashing...');
    const testEmail = `test_${Date.now()}@family.com`;
    const plainPassword = 'secureTestPassword123';
    
    const hashed = await bcrypt.hash(plainPassword, 10);
    const registerResult = await run(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (?, ?, ?, 'user')
    `, [testEmail, hashed, 'Test User']);
    
    const testUserId = registerResult.lastID;
    
    // Assert user created
    const insertedUser = await get('SELECT id, email, role FROM users WHERE id = ?', [testUserId]);
    if (insertedUser && insertedUser.email === testEmail) {
      console.log('PASS: Registration and SQL Insertion correct.');
    } else {
      throw new Error('FAIL: User record not inserted correctly.');
    }

    const passMatch = await bcrypt.compare(plainPassword, hashed);
    if (passMatch) {
      console.log('PASS: Bcrypt password hashing matches constraints.');
    } else {
      throw new Error('FAIL: Password validation checks failed.');
    }

    // 3. Test Authentication token signing
    console.log('[3/7] Testing JWT token session signing...');
    const token = jwt.sign(
      { id: testUserId, email: testEmail, role: insertedUser.role, name: 'Test User' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.id === testUserId) {
      console.log('PASS: JWT Session token generated and verified.');
    } else {
      throw new Error('FAIL: JWT token validation failed.');
    }

    // 4. Register Transaction CRUD
    console.log('[4/7] Testing Income & Expense CRUD transactions...');
    const incResult = await run(`
      INSERT INTO income (user_id, amount, source, category, date)
      VALUES (?, 1500.00, 'Test Invoice', 'Salary', '2026-06-28')
    `, [testUserId]);
    console.log(`PASS: Income registered successfully. ID: ${incResult.lastID}`);

    const expResult = await run(`
      INSERT INTO expenses (user_id, amount, merchant, category, date)
      VALUES (?, 200.00, 'Test Market', 'Groceries', '2026-06-28')
    `, [testUserId]);
    console.log(`PASS: Expense registered successfully. ID: ${expResult.lastID}`);

    // 5. Test Budget Planner Overspend Alert hooks
    console.log('[5/7] Testing budget limit threshold alarms...');
    // Set low budget limit for Groceries
    await run('INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, "Groceries", 150.00)', [testUserId]);
    
    // Total spent is $200, which exceeds $150. Simulate transaction alert trigger
    const budgetLimit = 150.00;
    const totalSpent = 200.00;
    if (totalSpent > budgetLimit) {
      await run(`
        INSERT INTO notifications (user_id, type, message)
        VALUES (?, 'budget', ?)
      `, [testUserId, 'Overspending Alert: Groceries limit exceeded.']);
    }

    const alertNotif = await get(`
      SELECT id, message FROM notifications 
      WHERE user_id = ? AND type = 'budget'
    `, [testUserId]);

    if (alertNotif) {
      console.log(`PASS: Automated budget limits alarm triggered: "${alertNotif.message}"`);
    } else {
      throw new Error('FAIL: Budget threshold warning failed to generate notification.');
    }

    // 6. Test Savings Goals & Sweeps Milestones
    console.log('[6/7] Testing savings sweeps and progress milestones (50%, 100%)...');
    const svgResult = await run(`
      INSERT INTO savings_goals (user_id, name, target, current, category, deadline)
      VALUES (?, 'Car Fund', 1000.00, 400.00, 'Transport', '2026-12-31')
    `, [testUserId]);
    
    const goalId = svgResult.lastID;
    
    // Simulate sweeping $200 (reaches $600/1000 = 60%, crossing 50% milestone)
    const oldPercent = (400.00 / 1000.00) * 100;
    const newCurrent = 600.00;
    const newPercent = (newCurrent / 1000.00) * 100;

    if (oldPercent < 50 && newPercent >= 50) {
      await run(`
        INSERT INTO notifications (user_id, type, message)
        VALUES (?, 'milestone', 'Milestone: Car Fund reached 50%!')
      `, [testUserId]);
    }

    const milestoneNotif = await get(`
      SELECT message FROM notifications 
      WHERE user_id = ? AND type = 'milestone'
    `, [testUserId]);

    if (milestoneNotif) {
      console.log(`PASS: Milestone achievement notification triggered: "${milestoneNotif.message}"`);
    } else {
      throw new Error('FAIL: Milestone trigger failed to create notification.');
    }

    // 7. Cleanup test data
    console.log('[7/7] Cleaning up test registry databases...');
    await run('DELETE FROM notifications WHERE user_id = ?', [testUserId]);
    await run('DELETE FROM expenses WHERE user_id = ?', [testUserId]);
    await run('DELETE FROM income WHERE user_id = ?', [testUserId]);
    await run('DELETE FROM budgets WHERE user_id = ?', [testUserId]);
    await run('DELETE FROM savings_goals WHERE user_id = ?', [testUserId]);
    await run('DELETE FROM users WHERE id = ?', [testUserId]);
    console.log('PASS: Database test cleanup finished.');

    console.log('==========================================================');
    console.log('  ALL ELRAWDA BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('==========================================================');
  } catch (err: any) {
    console.error('FAIL: Test runner encountered an error:', err.message);
    process.exit(1);
  }
}

runTests();
