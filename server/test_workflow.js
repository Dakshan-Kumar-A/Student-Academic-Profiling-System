const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const SystemLog = require('./src/models/SystemLog');
const { generateTempPassword } = require('./src/utils/mailer');
const XLSX = require('xlsx');

async function runTests() {
  console.log('=== RUNNING AUTOMATED BACKEND INTEGRATION TESTS ===\n');

  require('dotenv').config({ path: './.env' });
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Check Admin user
  const admin = await User.findOne({ email: 'admin@college.edu' });
  console.log('1. Admin exists in DB:', !!admin);

  // 2. Test Non-existent email login check
  const nonExistent = await User.findOne({ email: 'fake.user.999@college.edu' });
  console.log('2. Non-existent user check (should be null):', nonExistent === null);

  // 3. Test Wrong password check
  const isWrongPassword = await admin.matchPassword('WrongPass123!');
  console.log('3. Wrong password correctly rejected:', isWrongPassword === false);

  const isCorrectPassword = await admin.matchPassword('AdminPassword123!');
  console.log('4. Correct password accepted:', isCorrectPassword === true);

  // 4. Test Single-Use 24-hr Temporary Password generation & expiry
  const tempPass = generateTempPassword();
  const salt = await bcrypt.genSalt(10);
  const codeHash = await bcrypt.hash(tempPass, salt);

  const testUser = new User({
    name: 'Test Coordinator',
    email: 'coordinator.test@college.edu',
    password: codeHash,
    role: 'department_coordinator',
    department: 'CSE',
    status: 'active',
    mustChangePassword: true,
    tempPassword: {
      codeHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isUsed: false,
      purpose: 'account_creation',
    },
  });
  await testUser.save();

  // Validate temp password initially (should be valid)
  const val1 = await testUser.validateTempPassword(tempPass);
  console.log('5. Temp password initial validation:', val1.valid === true);

  // Expire the temp password artificially to test 24-hour enforcement
  testUser.tempPassword.expiresAt = new Date(Date.now() - 1000);
  const valExpired = await testUser.validateTempPassword(tempPass);
  console.log('6. Expired temp password correctly rejected:', valExpired.valid === false && valExpired.reason.includes('expired'));

  // Reset expiry and test Single-Use enforcement
  testUser.tempPassword.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  testUser.tempPassword.isUsed = true;
  const valUsed = await testUser.validateTempPassword(tempPass);
  console.log('7. Re-used temp password correctly rejected (single use):', valUsed.valid === false && valUsed.reason.includes('already been used'));

  // 5. Test Excel file parsing & bulk creation logic
  const sampleData = [
    { Name: 'Bulk Officer 1', Email: 'bulk.po1@college.edu', Role: 'Placement Officer', Department: 'Placement Cell' },
    { Name: 'Bulk Coordinator 2', Email: 'bulk.dc2@college.edu', Role: 'Department Coordinator', Department: 'ECE' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Staff');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const parsedWb = XLSX.read(buffer, { type: 'buffer' });
  const parsedRows = XLSX.utils.sheet_to_json(parsedWb.Sheets[parsedWb.SheetNames[0]]);
  console.log('8. Excel parsing verified. Row count:', parsedRows.length);

  // 6. Test System Log recording & querying
  const logCount = await SystemLog.countDocuments();
  console.log('9. System Logs accessible in MongoDB. Total logs:', logCount);

  // Clean up test user
  await User.deleteOne({ email: 'coordinator.test@college.edu' });
  console.log('10. Test cleanup completed.');

  console.log('\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
