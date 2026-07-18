import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client using Service Role Key (Admin privileges required for user provisioning)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper database wrapper to read SQLite
const dbPath = process.env.DATABASE_PATH || './elrawda.db';
const db = new sqlite3.Database(dbPath);

const sqliteQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function runMigration() {
  console.log(`==========================================================`);
  console.log(`  ELRAWDA SQLite to Supabase Migration Utility Starting   `);
  console.log(`  Source SQLite database: ${dbPath}`);
  console.log(`  Target Supabase: ${supabaseUrl}`);
  console.log(`==========================================================\n`);

  try {
    // 1. Fetch users from SQLite
    console.log('Step 1: Reading users from SQLite...');
    const sqliteUsers = await sqliteQuery('SELECT * FROM users');
    console.log(`Found ${sqliteUsers.length} users in SQLite.\n`);

    // Mapping: SQLite User ID (number) -> Supabase User ID (UUID string)
    const userMap = new Map<number, string>();

    // 2. Provision Users in Supabase Auth
    console.log('Step 2: Provisioning users in Supabase Auth...');
    for (const sqliteUser of sqliteUsers) {
      console.log(`Processing user: ${sqliteUser.email}...`);
      
      // Default passwords for demo accounts
      let password = 'TempPassword123!';
      if (sqliteUser.email === 'name@family.com') password = 'IslamPass123';
      if (sqliteUser.email === 'admin@elrawda.com') password = 'AdminPass123';

      let supabaseUserId = '';

      // Check if user already exists in auth.users
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        throw new Error(`Failed to check existing Supabase users: ${listError.message}`);
      }

      const existingUser = listData.users.find(u => u.email?.toLowerCase() === sqliteUser.email.toLowerCase());
      if (existingUser) {
        console.log(`- User already exists in Supabase. Reusing ID: ${existingUser.id}`);
        supabaseUserId = existingUser.id;
      } else {
        // Create user in auth.users
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
          email: sqliteUser.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            name: sqliteUser.name,
            role: sqliteUser.role
          }
        });

        if (createError) {
          console.error(`- Failed to create user ${sqliteUser.email}: ${createError.message}`);
          continue;
        }

        supabaseUserId = createData.user.id;
        console.log(`- User created successfully. Supabase UUID: ${supabaseUserId}`);
      }

      userMap.set(sqliteUser.id, supabaseUserId);

      // Copy user profile details into public.profiles (e.g. settings preferences)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: sqliteUser.name,
          avatar: sqliteUser.avatar || null,
          currency: sqliteUser.currency || '$',
          language: sqliteUser.language || 'en',
          theme: sqliteUser.theme || 'light',
          date_format: sqliteUser.date_format || 'YYYY-MM-DD',
          role: sqliteUser.role || 'user',
          is_2fa_enabled: sqliteUser.is_2fa_enabled === 1
        })
        .eq('id', supabaseUserId);

      if (profileError) {
        console.error(`- Failed to update profile details: ${profileError.message}`);
      }
    }
    console.log('User provisioning completed.\n');

    // 3. Migrate Budgets
    console.log('Step 3: Migrating budgets limits...');
    const sqliteBudgets = await sqliteQuery('SELECT * FROM budgets');
    const budgetsToInsert = [];
    for (const b of sqliteBudgets) {
      const sUserId = userMap.get(b.user_id);
      if (sUserId) {
        budgetsToInsert.push({
          user_id: sUserId,
          category: b.category,
          monthly_limit: b.monthly_limit
        });
      }
    }
    if (budgetsToInsert.length > 0) {
      const { error: err } = await supabase
        .from('budgets')
        .upsert(budgetsToInsert, { onConflict: 'user_id, category' });
      if (err) console.error(`Failed to seed budgets: ${err.message}`);
      else console.log(`Successfully migrated ${budgetsToInsert.length} budget limits.`);
    }

    // 4. Migrate Savings Goals (and store goal ID mappings for linked expenses)
    console.log('\nStep 4: Migrating savings goals...');
    const sqliteGoals = await sqliteQuery('SELECT * FROM savings_goals');
    const goalMap = new Map<number, string>(); // SQLite ID -> Supabase ID

    for (const g of sqliteGoals) {
      const sUserId = userMap.get(g.user_id);
      if (sUserId) {
        const { data, error } = await supabase
          .from('savings_goals')
          .insert({
            user_id: sUserId,
            name: g.name,
            target: g.target,
            current: g.current,
            category: g.category,
            color: g.color,
            deadline: g.deadline,
            priority: g.priority,
            auto_contribution: g.auto_contribution,
            is_salary_deducted: g.is_salary_deducted
          })
          .select('id')
          .single();

        if (error) {
          console.error(`Failed to migrate savings goal "${g.name}": ${error.message}`);
        } else if (data) {
          goalMap.set(g.id, data.id);
        }
      }
    }
    console.log(`Successfully migrated ${goalMap.size} savings goals.`);

    // 5. Migrate Income
    console.log('\nStep 5: Migrating income transactions...');
    const sqliteIncome = await sqliteQuery('SELECT * FROM income');
    const incomeToInsert = [];
    for (const inc of sqliteIncome) {
      const sUserId = userMap.get(inc.user_id);
      if (sUserId) {
        incomeToInsert.push({
          user_id: sUserId,
          amount: inc.amount,
          source: inc.source,
          category: inc.category,
          date: inc.date,
          recurring: inc.recurring,
          interval: inc.interval,
          notes: inc.notes,
          attachment: inc.attachment
        });
      }
    }
    if (incomeToInsert.length > 0) {
      const { error } = await supabase.from('income').insert(incomeToInsert);
      if (error) console.error(`Failed to migrate income: ${error.message}`);
      else console.log(`Successfully migrated ${incomeToInsert.length} income entries.`);
    }

    // 6. Migrate Expenses (mapping savings_goal_id)
    console.log('\nStep 6: Migrating expense transactions...');
    const sqliteExpenses = await sqliteQuery('SELECT * FROM expenses');
    const expensesToInsert = [];
    for (const exp of sqliteExpenses) {
      const sUserId = userMap.get(exp.user_id);
      if (sUserId) {
        // Map SQLite goal ID to new Supabase goal ID
        const sGoalId = exp.savings_goal_id ? goalMap.get(exp.savings_goal_id) : null;
        expensesToInsert.push({
          user_id: sUserId,
          amount: exp.amount,
          merchant: exp.merchant,
          category: exp.category,
          date: exp.date,
          recurring: exp.recurring,
          interval: exp.interval,
          tags: exp.tags,
          status: exp.status,
          notes: exp.notes,
          receipt: exp.receipt,
          savings_goal_id: sGoalId
        });
      }
    }
    if (expensesToInsert.length > 0) {
      const { error } = await supabase.from('expenses').insert(expensesToInsert);
      if (error) console.error(`Failed to migrate expenses: ${error.message}`);
      else console.log(`Successfully migrated ${expensesToInsert.length} expense entries.`);
    }

    // 7. Migrate Assets
    console.log('\nStep 7: Migrating assets...');
    const sqliteAssets = await sqliteQuery('SELECT * FROM assets');
    const assetsToInsert = [];
    for (const a of sqliteAssets) {
      const sUserId = userMap.get(a.user_id);
      if (sUserId) {
        assetsToInsert.push({
          user_id: sUserId,
          name: a.name,
          type: a.type,
          value: a.value,
          purchase_date: a.purchase_date,
          depreciation_rate: a.depreciation_rate,
          recognized_type: a.recognized_type,
          metadata: a.metadata
        });
      }
    }
    if (assetsToInsert.length > 0) {
      const { error } = await supabase.from('assets').insert(assetsToInsert);
      if (error) console.error(`Failed to migrate assets: ${error.message}`);
      else console.log(`Successfully migrated ${assetsToInsert.length} assets.`);
    }

    // 8. Migrate Debts
    console.log('\nStep 8: Migrating debts...');
    const sqliteDebts = await sqliteQuery('SELECT * FROM debts');
    const debtsToInsert = [];
    for (const d of sqliteDebts) {
      const sUserId = userMap.get(d.user_id);
      if (sUserId) {
        debtsToInsert.push({
          user_id: sUserId,
          creditor: d.creditor,
          amount: d.amount,
          interest_rate: d.interest_rate,
          monthly_payment: d.monthly_payment,
          due_date: d.due_date,
          status: d.status,
          notes: d.notes
        });
      }
    }
    if (debtsToInsert.length > 0) {
      const { error } = await supabase.from('debts').insert(debtsToInsert);
      if (error) console.error(`Failed to migrate debts: ${error.message}`);
      else console.log(`Successfully migrated ${debtsToInsert.length} debts.`);
    }

    // 9. Migrate Notifications
    console.log('\nStep 9: Migrating notifications...');
    const sqliteNotifs = await sqliteQuery('SELECT * FROM notifications');
    const notifsToInsert = [];
    for (const n of sqliteNotifs) {
      const sUserId = userMap.get(n.user_id);
      if (sUserId) {
        notifsToInsert.push({
          user_id: sUserId,
          type: n.type,
          message: n.message,
          is_read: n.is_read
        });
      }
    }
    if (notifsToInsert.length > 0) {
      const { error } = await supabase.from('notifications').insert(notifsToInsert);
      if (error) console.error(`Failed to migrate notifications: ${error.message}`);
      else console.log(`Successfully migrated ${notifsToInsert.length} notifications.`);
    }

    // 10. Migrate Audit Logs
    console.log('\nStep 10: Migrating audit logs...');
    const sqliteLogs = await sqliteQuery('SELECT * FROM audit_logs');
    const logsToInsert = [];
    for (const l of sqliteLogs) {
      const sUserId = l.user_id ? userMap.get(l.user_id) : null;
      logsToInsert.push({
        user_id: sUserId,
        action: l.action,
        ip_address: l.ip_address,
        user_agent: l.user_agent,
        timestamp: new Date(l.timestamp).toISOString()
      });
    }
    if (logsToInsert.length > 0) {
      const { error } = await supabase.from('audit_logs').insert(logsToInsert);
      if (error) console.error(`Failed to migrate audit logs: ${error.message}`);
      else console.log(`Successfully migrated ${logsToInsert.length} audit logs.`);
    }

    console.log(`\n==========================================================`);
    console.log(`  MIGRATION COMPLETED SUCCESSFULY!                        `);
    console.log(`==========================================================`);
  } catch (err: any) {
    console.error(`\nMigration failed with error: ${err.message}`);
  } finally {
    db.close();
  }
}

runMigration();
