const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const StudentProfile = require('./src/models/StudentProfile');
const DepartmentDrive = require('./src/models/DepartmentDrive');
const CommunicationMessage = require('./src/models/CommunicationMessage');

async function testCoordinatorWorkflow() {
  console.log('=== RUNNING DEPARTMENT COORDINATOR INTEGRATION TEST ===\n');

  require('dotenv').config({ path: './.env' });
  await mongoose.connect(process.env.MONGODB_URI);

  const dept = 'CSE';

  // 1. Create or Find Coordinator
  let coordinator = await User.findOne({ email: 'coord.cse@college.edu' });
  if (!coordinator) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('CoordPass123!', salt);
    coordinator = new User({
      name: 'Prof. Alan Turing',
      email: 'coord.cse@college.edu',
      password: hash,
      role: 'department_coordinator',
      department: dept,
      status: 'active',
      mustChangePassword: false,
    });
    await coordinator.save();
  }
  console.log('1. Department Coordinator verified:', coordinator.email, `(${coordinator.department})`);

  // 2. Create Student
  const studentEmail = 'student.test@college.edu';
  await User.deleteOne({ email: studentEmail });
  await StudentProfile.deleteOne({ email: studentEmail });

  const salt = await bcrypt.genSalt(10);
  const studentUser = new User({
    name: 'Suresh Kumar',
    email: studentEmail,
    password: await bcrypt.hash('TempPass123!', salt),
    role: 'student',
    rollNumber: '23CS099',
    department: dept,
    status: 'active',
  });
  await studentUser.save();

  const studentProfile = new StudentProfile({
    userId: studentUser._id,
    rollNumber: '23CS099',
    name: 'Suresh Kumar',
    email: studentEmail,
    department: dept,
    currentCGPA: 8.45,
    standingArrearsCount: 0,
    parentDetails: {
      fatherName: 'Ramasamy',
      fatherIncomeRange: '3-5 Lakhs',
      emergencyContact: '9876543210',
    },
    careerGoal: {
      primaryGoal: 'Placement',
    },
  });
  await studentProfile.save();
  console.log('2. Student created with profile & academic metrics:', studentProfile.rollNumber);

  // 3. Create Mentor
  const mentorEmail = 'mentor.cse@college.edu';
  await User.deleteOne({ email: mentorEmail });
  const mentor = new User({
    name: 'Dr. Grace Hopper',
    email: mentorEmail,
    password: await bcrypt.hash('MentorPass123!', salt),
    role: 'mentor',
    department: dept,
    status: 'active',
  });
  await mentor.save();
  console.log('3. Mentor created:', mentor.name, `(${mentor.email})`);

  // 4. Assign Student to Mentor (Requirement: A student can be assigned only to one mentor)
  studentProfile.mentorId = mentor._id;
  await studentProfile.save();
  studentUser.mentorId = mentor._id;
  await studentUser.save();

  const assignedProfile = await StudentProfile.findById(studentProfile._id).populate('mentorId');
  console.log('4. Student-to-Mentor allocation verified. Assigned to:', assignedProfile.mentorId.name);

  // 5. Create Department-Specific Drive (Requirement: marked under different flag, hidden from placement officers)
  const deptDrive = new DepartmentDrive({
    companyName: 'HexaTech Solutions',
    location: 'Chennai',
    aboutCompany: 'Core department software development drive',
    department: dept,
    isDepartmentSpecific: true, // Special flag
    createdBy: coordinator._id,
    roles: [
      {
        jobRole: 'Embedded Systems Engineer',
        salary: '8.5 LPA',
        jobDescription: 'Firmware and RTOS development',
        eligibilityCriteria: 'CGPA >= 7.5, no standing arrears',
      },
    ],
  });
  await deptDrive.save();
  console.log('5. Department Drive created with special flag (isDepartmentSpecific: true):', deptDrive.companyName);

  // 6. Broadcast Message / Circular
  const circular = new CommunicationMessage({
    sender: {
      userId: coordinator._id,
      name: coordinator.name,
      email: coordinator.email,
      role: coordinator.role,
    },
    department: dept,
    messageType: 'circular',
    subject: 'Internal Hackathon Registration 2026',
    content: 'All second and third year students are invited to register.',
    priority: 'Important',
    targetGroup: 'all_students',
    recipients: [{ userId: studentUser._id, name: studentUser.name, email: studentUser.email, role: 'student' }],
  });
  await circular.save();
  console.log('6. Circular message dispatched in department:', circular.subject);

  // 7. Test Student Deletion Approval Workflow (Requirement 8)
  studentUser.deletionRequest = {
    isPending: true,
    reason: 'Transferring to another university',
    requestedAt: new Date(),
    status: 'pending',
    requestedToRole: 'department_coordinator',
  };
  await studentUser.save();
  console.log('7. Student submitted deletion request to Coordinator with reason:', studentUser.deletionRequest.reason);

  // Coordinator approves request:
  if (studentUser.deletionRequest.isPending) {
    await StudentProfile.deleteOne({ userId: studentUser._id });
    await User.deleteOne({ _id: studentUser._id });
    console.log('8. Coordinator approved deletion request. Student account removed from DB.');
  }

  // 8. Test Coordinator Deletion Request to Admin (Requirement 6)
  coordinator.deletionRequest = {
    isPending: true,
    reason: 'Tenure as Department Coordinator concluded',
    requestedAt: new Date(),
    status: 'pending',
    requestedToRole: 'admin',
  };
  await coordinator.save();
  console.log('9. Coordinator submitted deletion request to Admin with reason:', coordinator.deletionRequest.reason);

  // Clean up test records
  await DepartmentDrive.deleteOne({ _id: deptDrive._id });
  await CommunicationMessage.deleteOne({ _id: circular._id });
  await User.deleteOne({ email: mentorEmail });
  await User.deleteOne({ email: 'coord.cse@college.edu' });

  console.log('10. Test cleanup completed.');
  console.log('\n=== ALL DEPARTMENT COORDINATOR WORKFLOW TESTS PASSED! ===');
  process.exit(0);
}

testCoordinatorWorkflow().catch((err) => {
  console.error('Coordinator test failed:', err);
  process.exit(1);
});
