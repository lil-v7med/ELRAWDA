import axios from 'axios';
import { get, run } from '../server/db.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'http://localhost:5000/api';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hashOTP(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function runResetFlowTests() {
  console.log('==========================================================');
  console.log('  STARTING PASSWORD RESET FLOW INTEGRATION TESTS');
  console.log('==========================================================');

  // Let's create a test user directly in the database
  const email = `reset_test_${Date.now()}@elrawda-test.com`;
  const dummyPassHash = '$2a$10$vkRDHQsxynsGSQQxj0JvWu7.ye/9MxkVPExqkmv5laySjho1oEJmi'; // hash of IslamPass123!
  
  console.log(`Creating test user: ${email}`);
  const userResult = await run(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (?, ?, ?, 'user')
  `, [email, dummyPassHash, 'Reset Tester']);
  const userId = userResult.lastID;

  try {
    // ----------------------------------------------------
    // TEST 1: Forgot Password - Valid Existing Email
    // ----------------------------------------------------
    console.log('\n[TEST 1] Requesting password reset for existing email...');
    const forgotRes = await axios.post(`${API_URL}/auth/forgot-password`, { email });
    
    if (forgotRes.status === 200 && forgotRes.data.resetToken) {
      console.log('PASS: Forgot password response status and token received.');
    } else {
      throw new Error(`FAIL: Forgot password response invalid. Status: ${forgotRes.status}`);
    }

    const resetToken = forgotRes.data.resetToken;

    // Check database to verify record is created correctly
    const dbRecord = await get('SELECT * FROM password_resets WHERE reset_token = ?', [resetToken]);
    if (dbRecord && dbRecord.user_id === userId) {
      console.log('PASS: Database entry for password_resets exists and matches test user.');
      if (dbRecord.hashed_code && dbRecord.hashed_code.length === 64) {
        console.log('PASS: Verification code is securely hashed in SHA-256.');
      } else {
        throw new Error('FAIL: Verification code not hashed correctly.');
      }
    } else {
      throw new Error('FAIL: Database record not found for resetToken.');
    }

    // Verify debug HTML email is generated
    const emailDebugPath = path.resolve(__dirname, '../emails_debug.html');
    const emailHtml = await fs.readFile(emailDebugPath, 'utf8');
    if (emailHtml.includes(email) && emailHtml.includes('ELRAWDA')) {
      console.log('PASS: HTML email generated successfully in emails_debug.html.');
      const codeMatch = emailHtml.match(/<div class="code-value">(\d{6})<\/div>/);
      if (codeMatch && codeMatch[1]) {
        console.log(`PASS: Extracted OTP code from email: ${codeMatch[1]}`);
        const otpCode = codeMatch[1];

        // ----------------------------------------------------
        // TEST 2: Verify Code - Invalid Code
        // ----------------------------------------------------
        console.log('\n[TEST 2] Verifying incorrect code...');
        try {
          await axios.post(`${API_URL}/auth/verify-reset-code`, { resetToken, code: '000000' });
          throw new Error('FAIL: Allowed incorrect verification code.');
        } catch (err: any) {
          if (err.response && err.response.status === 400 && err.response.data.error.includes('Invalid')) {
            console.log('PASS: Correctly rejected incorrect code.');
          } else {
            throw err;
          }
        }

        // Verify attempts counter incremented
        const recordAfterAttempt = await get('SELECT attempts FROM password_resets WHERE reset_token = ?', [resetToken]);
        if (recordAfterAttempt && recordAfterAttempt.attempts === 1) {
          console.log('PASS: Attempt counter incremented in database.');
        } else {
          throw new Error('FAIL: Attempt counter not incremented.');
        }

        // ----------------------------------------------------
        // TEST 3: Verify Code - Success
        // ----------------------------------------------------
        console.log('\n[TEST 3] Verifying correct code...');
        const verifyRes = await axios.post(`${API_URL}/auth/verify-reset-code`, { resetToken, code: otpCode });
        if (verifyRes.status === 200 && verifyRes.data.message.includes('verified')) {
          console.log('PASS: Correct code successfully verified.');
        } else {
          throw new Error('FAIL: Correct code verification failed.');
        }

        // ----------------------------------------------------
        // TEST 4: Resend Cooldown
        // ----------------------------------------------------
        console.log('\n[TEST 4] Testing resend cooldown rate limit...');
        try {
          await axios.post(`${API_URL}/auth/resend-reset-code`, { resetToken });
          throw new Error('FAIL: Allowed resending code without 60-second cooldown.');
        } catch (err: any) {
          if (err.response && err.response.status === 429 && (err.response.data.error.includes('cooldown') || err.response.data.error.includes('wait'))) {
            console.log('PASS: Correctly rate-limited resend request within 60s cooldown.');
          } else {
            throw err;
          }
        }

        // ----------------------------------------------------
        // TEST 5: Password Reset - Reuse Prevention
        // ----------------------------------------------------
        console.log('\n[TEST 5] Testing password reuse prevention...');
        try {
          await axios.post(`${API_URL}/auth/reset-password`, {
            resetToken,
            password: 'IslamPass123!', // Matches current password
            confirmPassword: 'IslamPass123!'
          });
          throw new Error('FAIL: Allowed resetting to current password.');
        } catch (err: any) {
          if (err.response && err.response.status === 400 && err.response.data.error.includes('different')) {
            console.log('PASS: Correctly rejected password reuse.');
          } else {
            throw err;
          }
        }

        // ----------------------------------------------------
        // TEST 6: Password Reset - Strength Policy
        // ----------------------------------------------------
        console.log('\n[TEST 6] Testing weak password rejection...');
        try {
          await axios.post(`${API_URL}/auth/reset-password`, {
            resetToken,
            password: 'weak',
            confirmPassword: 'weak'
          });
          throw new Error('FAIL: Allowed weak password.');
        } catch (err: any) {
          if (err.response && err.response.status === 400 && err.response.data.error.includes('at least 8')) {
            console.log('PASS: Correctly rejected weak password.');
          } else {
            throw err;
          }
        }

        // ----------------------------------------------------
        // TEST 7: Password Reset - Success
        // ----------------------------------------------------
        console.log('\n[TEST 7] Testing password reset success...');
        const newPass = 'NewSecurePass123!';
        const resetRes = await axios.post(`${API_URL}/auth/reset-password`, {
          resetToken,
          password: newPass,
          confirmPassword: newPass
        });

        if (resetRes.status === 200 && resetRes.data.message.includes('successfully')) {
          console.log('PASS: Password reset submission returned success.');
        } else {
          throw new Error('FAIL: Password reset submission failed.');
        }

        // Verify password updated in DB
        const userAfterReset = await get('SELECT password_hash, password_changed_at FROM users WHERE id = ?', [userId]);
        if (userAfterReset && userAfterReset.password_changed_at) {
          console.log('PASS: password_changed_at timestamp set correctly.');
          const match = await bcrypt.compare(newPass, userAfterReset.password_hash);
          if (match) {
            console.log('PASS: Password correctly updated with bcrypt hash.');
          } else {
            throw new Error('FAIL: Hashed password does not match.');
          }
        } else {
          throw new Error('FAIL: password_changed_at column not updated.');
        }

        // Verify reset token is marked used / deleted
        const resetsCount = await get('SELECT COUNT(*) as count FROM password_resets WHERE user_id = ? AND used_at IS NULL', [userId]);
        if (resetsCount.count === 0) {
          console.log('PASS: All reset tokens for user successfully invalidated/marked used.');
        } else {
          throw new Error('FAIL: Reset tokens remain active.');
        }
      } else {
        throw new Error('FAIL: Monospace code token not found in emails_debug.html.');
      }
    } else {
      throw new Error('FAIL: Monospace check failed in emails_debug.html.');
    }

    // ----------------------------------------------------
    // TEST 8: Timing safe anonymous verification
    // ----------------------------------------------------
    console.log('\n[TEST 8] Requesting forgot password for non-existing email...');
    const start = Date.now();
    const fakeRes = await axios.post(`${API_URL}/auth/forgot-password`, { email: 'nonexisting_user@gmail.com' });
    const elapsed = Date.now() - start;

    if (fakeRes.status === 200 && fakeRes.data.resetToken) {
      console.log(`PASS: Received dummy resetToken. Elapsed time: ${elapsed}ms`);
      // Check database to ensure NO entry exists for this dummy token
      const dummyRecord = await get('SELECT * FROM password_resets WHERE reset_token = ?', [fakeRes.data.resetToken]);
      if (!dummyRecord) {
        console.log('PASS: Dummy token was NOT saved to database.');
      } else {
        throw new Error('FAIL: Dummy token was incorrectly saved to database.');
      }
    } else {
      throw new Error('FAIL: Did not receive dummy resetToken or success message.');
    }

    console.log('\n==========================================================');
    console.log('  ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('==========================================================');

  } catch (err: any) {
    console.error('\nERROR DURING INTEGRATION TESTS:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    // Cleanup test user
    console.log(`Cleaning up test user: ${email}`);
    await run('DELETE FROM users WHERE id = ?', [userId]);
    await run('DELETE FROM password_resets WHERE user_id = ?', [userId]);
  }
}

runResetFlowTests();
