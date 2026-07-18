import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../elrawda.db');
const db = new sqlite3.Database(dbPath);

// Helper wrappers to support async/await with SQLite3
export const query = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const run = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: any, err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export async function initDB() {
  // Create tables sequentially
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      currency TEXT DEFAULT '$',
      language TEXT DEFAULT 'en',
      theme TEXT DEFAULT 'light',
      date_format TEXT DEFAULT 'YYYY-MM-DD',
      role TEXT DEFAULT 'user',
      two_factor_secret TEXT,
      is_2fa_enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      recurring INTEGER DEFAULT 0,
      interval TEXT,
      notes TEXT,
      attachment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      recurring INTEGER DEFAULT 0,
      interval TEXT,
      tags TEXT,
      status TEXT DEFAULT 'Completed',
      notes TEXT,
      receipt TEXT,
      savings_goal_id INTEGER REFERENCES savings_goals(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      current REAL DEFAULT 0.0,
      category TEXT NOT NULL,
      color TEXT DEFAULT 'blue',
      deadline TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      auto_contribution REAL DEFAULT 0.0,
      is_salary_deducted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, category)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      purchase_date TEXT NOT NULL,
      depreciation_rate REAL DEFAULT 0.0,
      recognized_type TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      creditor TEXT NOT NULL,
      amount REAL NOT NULL,
      interest_rate REAL DEFAULT 0.0,
      monthly_payment REAL DEFAULT 0.0,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'Active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reset_token TEXT UNIQUE NOT NULL,
      hashed_code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME NULL,
      attempts INTEGER DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Seed default data if users table is empty
  const userCount = await get(`SELECT COUNT(*) as count FROM users`);
  if (userCount.count === 0) {
    console.log('Seeding default users and wealth metrics database entries...');
    
    // Default user passwords
    const userPassHash = await bcrypt.hash('IslamPass123', 10);
    const adminPassHash = await bcrypt.hash('AdminPass123', 10);

    // 1. Seed Users
    const regularUser = await run(`
      INSERT INTO users (email, password_hash, name, role, currency, avatar)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'name@family.com', 
      userPassHash, 
      'Islam', 
      'user', 
      '$', 
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDOJ9DKPP9X1Xen6i9IJn67lr-U-VNQGEXnIvQu6anV5_IgTm-Bnzt5RXKVNCzRRTVduomYeZa3ik590TLx4t81CQqm-laQiPSmCEHjETm4lt67GEGqw-eZ9YvnJKzfuzM6r1jgBuQI8eM_KIBkwpV_f5seWtqWzPYxHbbnLONyADydWemi6SYpnl_w1l_26Nzmr1DQhissOCeRml00F_XjtfB9dlumriDj5k3SdwDrF0TxNDtUIre4ENoeGo2YAE5plhL7gzYkNtI'
    ]);

    const adminUser = await run(`
      INSERT INTO users (email, password_hash, name, role, currency)
      VALUES (?, ?, ?, ?, ?)
    `, ['admin@elrawda.com', adminPassHash, 'Admin Administrator', 'admin', '$']);

    const userId = regularUser.lastID;
    const adminId = adminUser.lastID;

    // 2. Seed Income
    await run(`
      INSERT INTO income (user_id, amount, source, category, date, recurring, interval, notes)
      VALUES 
      (?, 4250.00, 'TechCorp Inc.', 'Salary', '2026-06-22', 1, 'monthly', 'Monthly base salary payout'),
      (?, 850.00, 'Freelance Dev', 'Consulting', '2026-06-15', 0, null, 'Website redesign consulting project'),
      (?, 150.00, 'Dividend Payout', 'Investments', '2026-06-05', 1, 'quarterly', 'Quarterly stock portfolio dividend')
    `, [userId, userId, userId]);

    // 3. Seed Expenses
    await run(`
      INSERT INTO expenses (user_id, amount, merchant, category, date, recurring, interval, tags, status, notes)
      VALUES 
      (?, 145.20, 'Whole Foods Market', 'Groceries', '2026-06-24', 0, null, 'groceries,organic', 'Completed', 'Weekly family groceries shopping'),
      (?, 85.50, 'Electric Co.', 'Utilities', '2026-06-20', 1, 'monthly', 'bills,electricity', 'Pending', 'Monthly utilities bill'),
      (?, 500.00, 'Transfer to Savings', 'Internal', '2026-06-18', 1, 'monthly', 'savings', 'Completed', 'Recurring monthly goal sweep'),
      (?, 15.99, 'Netflix Subscription', 'Entertainment', '2026-06-10', 1, 'monthly', 'subscription,leisure', 'Completed', 'Streaming account')
    `, [userId, userId, userId, userId]);

    // 4. Seed Savings Goals
    await run(`
      INSERT INTO savings_goals (user_id, name, target, current, category, color, deadline, priority, auto_contribution)
      VALUES 
      (?, 'College Fund', 50000.00, 32800.00, 'Education', 'purple', '2028-09-01', 'High', 200.00),
      (?, 'New Car', 25000.00, 12000.00, 'Transport', 'blue', '2027-06-01', 'Medium', 150.00),
      (?, 'Emergency Fund', 15000.00, 10000.00, 'Savings', 'green', '2026-12-31', 'High', 100.00)
    `, [userId, userId, userId]);

    // 5. Seed Budgets
    await run(`
      INSERT INTO budgets (user_id, category, monthly_limit)
      VALUES 
      (?, 'Groceries', 600.00),
      (?, 'Utilities', 300.00),
      (?, 'Entertainment', 200.00),
      (?, 'Shopping', 400.00)
    `, [userId, userId, userId, userId]);

    // 5a. Seed Assets
    await run(`
      INSERT INTO assets (user_id, name, type, value, purchase_date, depreciation_rate, recognized_type, metadata)
      VALUES 
      (?, 'Nissan Sunny 2025', 'Car', 18000.00, '2025-01-15', -12.0, 'Car', '{"brand":"Nissan","model":"Sunny","year":2025}'),
      (?, 'ذهب عيار 21 (50 جرام)', 'Gold', 6000.00, '2024-05-10', 15.0, 'Gold', '{"gold_purity":"21k","weight_grams":50}'),
      (?, 'شقة سكنية بالتجمع الخامس', 'Real Estate', 120000.00, '2023-08-20', 10.0, 'Real Estate', '{"region":"Tegamoa","rooms":3}')
    `, [userId, userId, userId]);

    // 5b. Seed Debts
    await run(`
      INSERT INTO debts (user_id, creditor, amount, interest_rate, monthly_payment, due_date, status, notes)
      VALUES 
      (?, 'Banque Misr Mortgage', 45000.00, 4.5, 800.00, '2035-12-01', 'Active', 'Housing purchase loan'),
      (?, 'CIB Credit Card', 2500.00, 15.0, 150.00, '2026-08-25', 'Active', 'Discretionary card balance')
    `, [userId, userId]);

    // 6. Seed Notifications
    await run(`
      INSERT INTO notifications (user_id, type, message, is_read)
      VALUES 
      (?, 'bill', 'Reminder: Electric Co. bill ($85.50) is due on 2026-07-20.', 0),
      (?, 'milestone', 'Congratulations! College Fund reached 65% of its goal.', 0),
      (?, 'budget', 'Alert: You have spent 72% of your Groceries budget for this month.', 1)
    `, [userId, userId, userId]);

    // 7. Seed Audit Logs
    await run(`
      INSERT INTO audit_logs (user_id, action, ip_address, user_agent)
      VALUES 
      (?, 'User Account Created', '127.0.0.1', 'Mozilla/5.0'),
      (?, 'Database Seeded & Loaded', '127.0.0.1', 'System Bot'),
      (?, 'User Login (Initial Seed)', '127.0.0.1', 'Mozilla/5.0')
    `, [userId, adminId, userId]);
  }

  // Run schema migrations for savings_goals and expenses
  try {
    await run(`ALTER TABLE savings_goals ADD COLUMN is_salary_deducted INTEGER DEFAULT 0`);
    console.log('Migration: Added is_salary_deducted to savings_goals');
  } catch (err) {
    // Column might already exist, ignore
  }

  try {
    await run(`ALTER TABLE expenses ADD COLUMN savings_goal_id INTEGER REFERENCES savings_goals(id) ON DELETE SET NULL`);
    console.log('Migration: Added savings_goal_id to expenses');
  } catch (err) {
    // Column might already exist, ignore
  }

  try {
    await run(`ALTER TABLE users ADD COLUMN password_changed_at DATETIME`);
    console.log('Migration: Added password_changed_at to users');
  } catch (err) {
    // Column might already exist, ignore
  }
}
