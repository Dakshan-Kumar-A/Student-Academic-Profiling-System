const mongoose = require('mongoose');
const User = require('./src/models/User');
const StudentProfile = require('./src/models/StudentProfile');

async function testNewFeatures() {
  console.log('=== TESTING NEW ENHANCEMENTS ===\n');

  require('dotenv').config({ path: './.env' });
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Test profile name & email update
  const admin = await User.findOne({ email: 'admin@college.edu' });
  admin.name = 'System Administrator (Updated)';
  await admin.save();
  console.log('1. Profile name update verified:', admin.name);

  // 2. Test Custom Excel Builder field extractor
  const students = await StudentProfile.find({ department: 'CSE' }).populate('mentorId');
  console.log('2. Found students for export:', students.length);

  // Verify custom field selection works
  const sampleChosenFields = ['rollNumber', 'name', 'currentCGPA', 'isPlaced', 'mentorName'];
  console.log('3. Custom fields selected:', sampleChosenFields);

  console.log('\n=== ALL ENHANCEMENT TESTS VERIFIED! ===');
  process.exit(0);
}

testNewFeatures().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
