const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');

const seedInitialAdmin = async () => {
  try {
    const adminEmail = 'admin@college.edu';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('AdminPassword123!', salt);

      const adminUser = new User({
        name: 'System Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        department: 'Administration',
        status: 'active',
        mustChangePassword: false,
      });

      await adminUser.save();
      console.log('Initial Admin Account Seeded: admin@college.edu');
    }

    // Seed Demo Department Coordinator (CSE)
    const coordEmail = 'coordinator.cse@college.edu';
    let coordinator = await User.findOne({ email: coordEmail });
    if (!coordinator) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('CoordPassword123!', salt);

      coordinator = new User({
        name: 'Prof. Alan Turing (HOD Coordinator)',
        email: coordEmail,
        password: hashedPassword,
        role: 'department_coordinator',
        department: 'CSE',
        status: 'active',
        mustChangePassword: false,
      });
      await coordinator.save();
      console.log('Initial CSE Department Coordinator Seeded: coordinator.cse@college.edu');
    }

    // Seed Demo Mentors for CSE
    const mentorsList = [
      { name: 'Dr. Grace Hopper', email: 'mentor.cse@college.edu' },
      { name: 'Prof. John von Neumann', email: 'neumann.cse@college.edu' },
      { name: 'Dr. Ada Lovelace', email: 'ada.cse@college.edu' },
    ];

    const mentorDocs = [];
    for (const mData of mentorsList) {
      let m = await User.findOne({ email: mData.email });
      if (!m) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('MentorPassword123!', salt);
        m = new User({
          name: mData.name,
          email: mData.email,
          password: hashedPassword,
          role: 'mentor',
          department: 'CSE',
          status: 'active',
          mustChangePassword: false,
        });
        await m.save();
        console.log(`Demo Mentor Seeded: ${mData.email}`);
      }
      mentorDocs.push(m);
    }

    const mentor1 = mentorDocs[0];
    const mentor2 = mentorDocs[1];
    const mentor3 = mentorDocs[2];

    // Comprehensive Cohort of 12 Diverse Students
    const studentSeedData = [
      {
        name: 'Aditya Raman',
        email: 'student.cse@college.edu',
        rollNumber: '23CS101',
        section: 'A',
        studentCategory: 'Day Scholar',
        mentorId: mentor1._id,
        currentCGPA: 8.75,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 8.5, cgpa: 8.5, attendancePercentage: 92, arrearStatus: 'No', numberOfArrears: 0, strongSubjects: 'Python, Maths' },
          { semesterNumber: 2, sgpa: 8.9, cgpa: 8.7, attendancePercentage: 94, arrearStatus: 'No', numberOfArrears: 0, strongSubjects: 'Data Structures, C++' },
          { semesterNumber: 3, sgpa: 8.8, cgpa: 8.75, attendancePercentage: 90, arrearStatus: 'No', numberOfArrears: 0, strongSubjects: 'DBMS, OS' },
        ],
        technicalProfile: {
          programmingLanguages: ['Python', 'JavaScript', 'C++', 'Java'],
          domainInterest: 'Web Development',
          certifications: ['AWS Certified Cloud Practitioner', 'MongoDB Associate Developer'],
          projects: [{ projectTitle: 'Microservices LMS', domain: 'Cloud' }],
          profileLinks: { github: 'https://github.com/aditya', linkedin: 'https://linkedin.com/in/aditya' },
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'Full Stack Engineer', expectedSalaryRange: '8-12 LPA' } },
        placementStatus: { isPlaced: true, placementType: 'On-Campus', companyName: 'Zoho Corporation', jobRole: 'Member Technical Staff', packageCTC: 8.5 },
      },
      {
        name: 'Priya Sundaram',
        email: 'priya.s@college.edu',
        rollNumber: '23CS102',
        section: 'A',
        studentCategory: 'Hosteller',
        mentorId: mentor1._id,
        currentCGPA: 9.42,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 9.1, cgpa: 9.1, attendancePercentage: 96, arrearStatus: 'No', numberOfArrears: 0, strongSubjects: 'Python, Engineering Physics' },
          { semesterNumber: 2, sgpa: 9.3, cgpa: 9.2, attendancePercentage: 95, arrearStatus: 'No', numberOfArrears: 0, strongSubjects: 'Data Structures, OOP' },
          { semesterNumber: 3, sgpa: 9.6, cgpa: 9.42, attendancePercentage: 98, arrearStatus: 'No', numberOfArrears: 0, strongSubjects: 'Design and Analysis of Algorithms, AI' },
        ],
        technicalProfile: {
          programmingLanguages: ['Python', 'C++', 'Rust', 'TypeScript'],
          domainInterest: 'AI & Machine Learning',
          certifications: ['DeepLearning.AI TensorFlow Developer', 'AWS Machine Learning Specialty'],
          projects: [{ projectTitle: 'Multi-modal Brain Tumor Classifier', domain: 'AI & Machine Learning' }, { projectTitle: 'Edge AI Object Tracker', domain: 'Computer Vision' }],
          profileLinks: { github: 'https://github.com/priyas', linkedin: 'https://linkedin.com/in/priyas' },
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'AI Research Engineer', expectedSalaryRange: '16+ LPA' } },
        placementStatus: { isPlaced: true, placementType: 'On-Campus', companyName: 'Google India', jobRole: 'Associate Software Engineer - ML', packageCTC: 16.0 },
      },
      {
        name: 'Karthik Venkatesh',
        email: 'karthik.v@college.edu',
        rollNumber: '23CS103',
        section: 'B',
        studentCategory: 'Day Scholar',
        mentorId: mentor2._id,
        currentCGPA: 6.15,
        standingArrearsCount: 3,
        semesters: [
          { semesterNumber: 1, sgpa: 7.2, cgpa: 7.2, attendancePercentage: 80, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 6.4, cgpa: 6.8, attendancePercentage: 74, arrearStatus: 'Yes', numberOfArrears: 1, weakSubjects: 'Data Structures' },
          { semesterNumber: 3, sgpa: 5.8, cgpa: 6.15, attendancePercentage: 71, arrearStatus: 'Yes', numberOfArrears: 2, weakSubjects: 'Discrete Maths, DBMS' },
        ],
        arrears: [
          { semesterOccurred: 2, subjectCode: 'CS8391', subjectName: 'Data Structures', currentStatus: 'Pending', numberOfAttempts: 2, remedialSupportRequired: 'Yes' },
          { semesterOccurred: 3, subjectCode: 'MA8351', subjectName: 'Discrete Mathematics', currentStatus: 'Pending', numberOfAttempts: 1, remedialSupportRequired: 'Yes' },
          { semesterOccurred: 3, subjectCode: 'CS8492', subjectName: 'Database Management Systems', currentStatus: 'Pending', numberOfAttempts: 1, remedialSupportRequired: 'Yes' },
        ],
        technicalProfile: {
          programmingLanguages: ['C', 'Java'],
          domainInterest: 'Cloud Computing',
          certifications: [],
          projects: [],
          profileLinks: {},
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'System Administrator', expectedSalaryRange: '4-6 LPA' } },
        placementStatus: { isPlaced: false },
      },
      {
        name: 'Ananya Sharma',
        email: 'ananya.s@college.edu',
        rollNumber: '23CS104',
        section: 'A',
        studentCategory: 'Day Scholar',
        mentorId: mentor1._id,
        currentCGPA: 8.90,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 8.6, cgpa: 8.6, attendancePercentage: 91, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 8.8, cgpa: 8.7, attendancePercentage: 92, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 3, sgpa: 9.1, cgpa: 8.9, attendancePercentage: 94, arrearStatus: 'No', numberOfArrears: 0 },
        ],
        technicalProfile: {
          programmingLanguages: ['Python', 'Go', 'JavaScript'],
          domainInterest: 'Cloud Computing',
          certifications: ['AWS Solutions Architect Associate'],
          projects: [{ projectTitle: 'Distributed Cache in Go', domain: 'Cloud' }],
          profileLinks: { github: 'https://github.com/ananya', linkedin: 'https://linkedin.com/in/ananya' },
        },
        careerGoal: {
          primaryGoal: 'Higher Studies',
          higherStudies: {
            studyLocation: 'Abroad',
            targetExam: 'GRE & TOEFL',
            examScoreDetails: 'GRE: 324, TOEFL: 108',
            targetInstitution: 'Carnegie Mellon University / Georgia Tech',
            fieldOfSpecialization: 'M.S. Computer Systems',
          },
        },
        placementStatus: { isPlaced: false },
      },
      {
        name: 'Rahul Menon',
        email: 'rahul.m@college.edu',
        rollNumber: '23CS105',
        section: 'B',
        studentCategory: 'Hosteller',
        mentorId: mentor2._id,
        currentCGPA: 7.45,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 7.0, cgpa: 7.0, attendancePercentage: 86, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 7.3, cgpa: 7.15, attendancePercentage: 88, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 3, sgpa: 7.6, cgpa: 7.45, attendancePercentage: 89, arrearStatus: 'No', numberOfArrears: 0 },
        ],
        technicalProfile: {
          programmingLanguages: ['JavaScript', 'TypeScript', 'Node.js', 'React'],
          domainInterest: 'Web Development',
          certifications: ['Meta Front-End Developer Certificate'],
          projects: [{ projectTitle: 'Realtime Collaborative Editor', domain: 'Web Development' }],
          profileLinks: { github: 'https://github.com/rahulm', linkedin: 'https://linkedin.com/in/rahulm' },
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'Full Stack Engineer', expectedSalaryRange: '8-10 LPA' } },
        placementStatus: { isPlaced: true, placementType: 'Off-Campus', companyName: 'Thoughtworks', jobRole: 'Software Developer', packageCTC: 9.0 },
      },
      {
        name: 'Sneha Patel',
        email: 'sneha.p@college.edu',
        rollNumber: '23CS106',
        section: 'B',
        studentCategory: 'Day Scholar',
        mentorId: mentor2._id,
        currentCGPA: 7.80,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 7.9, cgpa: 7.9, attendancePercentage: 89, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 7.7, cgpa: 7.8, attendancePercentage: 85, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 3, sgpa: 7.8, cgpa: 7.8, attendancePercentage: 87, arrearStatus: 'No', numberOfArrears: 0 },
        ],
        technicalProfile: {
          programmingLanguages: ['Python', 'Dart', 'Flutter'],
          domainInterest: 'AI & Machine Learning',
          certifications: ['Google Professional Data Engineer'],
          projects: [{ projectTitle: 'Vernacular Learning AI Startup Prototype', domain: 'AI & EdTech' }],
          profileLinks: { github: 'https://github.com/snehap', linkedin: 'https://linkedin.com/in/snehap' },
        },
        careerGoal: {
          primaryGoal: 'Entrepreneurship',
          entrepreneurship: {
            ventureIdea: 'AI-driven personalized vernacular learning assistant for rural school kids',
            stage: 'Incubation & Prototype Pitching',
            registeredEntity: 'No (Pre-incorporation)',
            incubatorSupportNeeded: 'Yes - Seed Grant & Campus Incubation',
          },
        },
        placementStatus: { isPlaced: false },
      },
      {
        name: 'Vignesh Rajan',
        email: 'vignesh.r@college.edu',
        rollNumber: '23CS107',
        section: 'C',
        studentCategory: 'Hosteller',
        mentorId: mentor3._id,
        currentCGPA: 6.40,
        standingArrearsCount: 2,
        semesters: [
          { semesterNumber: 1, sgpa: 6.8, cgpa: 6.8, attendancePercentage: 78, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 6.3, cgpa: 6.55, attendancePercentage: 73, arrearStatus: 'Yes', numberOfArrears: 1 },
          { semesterNumber: 3, sgpa: 6.1, cgpa: 6.40, attendancePercentage: 70, arrearStatus: 'Yes', numberOfArrears: 1 },
        ],
        arrears: [
          { semesterOccurred: 2, subjectCode: 'CS8351', subjectName: 'Digital Principles & System Design', currentStatus: 'Pending', numberOfAttempts: 1, remedialSupportRequired: 'Yes' },
          { semesterOccurred: 3, subjectCode: 'CS8391', subjectName: 'Data Structures', currentStatus: 'Pending', numberOfAttempts: 1, remedialSupportRequired: 'Yes' },
        ],
        technicalProfile: {
          programmingLanguages: ['Java'],
          domainInterest: 'Cybersecurity',
          certifications: [],
          projects: [],
          profileLinks: {},
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'Junior QA Analyst', expectedSalaryRange: '4-5 LPA' } },
        placementStatus: { isPlaced: false },
      },
      {
        name: 'Deepika Nair',
        email: 'deepika.n@college.edu',
        rollNumber: '23CS108',
        section: 'A',
        studentCategory: 'Hosteller',
        mentorId: mentor1._id,
        currentCGPA: 8.20,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 8.0, cgpa: 8.0, attendancePercentage: 90, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 8.1, cgpa: 8.05, attendancePercentage: 91, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 3, sgpa: 8.3, cgpa: 8.20, attendancePercentage: 93, arrearStatus: 'No', numberOfArrears: 0 },
        ],
        technicalProfile: {
          programmingLanguages: ['C', 'C++', 'Python'],
          domainInterest: 'Cybersecurity',
          certifications: ['CompTIA Security+'],
          projects: [{ projectTitle: 'Network Packet Sniffer & Firewall Rules Engine', domain: 'Cybersecurity' }],
          profileLinks: { github: 'https://github.com/deepikan', linkedin: 'https://linkedin.com/in/deepikan' },
        },
        careerGoal: {
          primaryGoal: 'Higher Studies',
          higherStudies: {
            studyLocation: 'India',
            targetExam: 'GATE CS',
            examScoreDetails: 'GATE CSE Target Score: 720+',
            targetInstitution: 'IIT Madras / IISc Bangalore',
            fieldOfSpecialization: 'M.Tech Information Security',
          },
        },
        placementStatus: { isPlaced: false },
      },
      {
        name: 'Manoj Kumar',
        email: 'manoj.k@college.edu',
        rollNumber: '23CS109',
        section: 'C',
        studentCategory: 'Day Scholar',
        mentorId: mentor3._id,
        currentCGPA: 7.10,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 7.0, cgpa: 7.0, attendancePercentage: 83, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 7.0, cgpa: 7.0, attendancePercentage: 84, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 3, sgpa: 7.2, cgpa: 7.10, attendancePercentage: 85, arrearStatus: 'No', numberOfArrears: 0 },
        ],
        arrears: [
          { semesterOccurred: 2, subjectCode: 'CS8351', subjectName: 'Digital Principles & System Design', currentStatus: 'Cleared', clearedSemester: 3, numberOfAttempts: 2, remedialSupportRequired: 'No' },
        ],
        technicalProfile: {
          programmingLanguages: ['Java', 'SQL', 'HTML/CSS'],
          domainInterest: 'Web Development',
          certifications: ['Oracle Certified Associate Java SE 8'],
          projects: [{ projectTitle: 'Inventory Tracking Portal', domain: 'Web Development' }],
          profileLinks: { github: 'https://github.com/manojk' },
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'Systems Engineer', expectedSalaryRange: '4-6 LPA' } },
        placementStatus: { isPlaced: true, placementType: 'On-Campus', companyName: 'Infosys', jobRole: 'Systems Engineer', packageCTC: 4.5 },
      },
      {
        name: 'Harini Krishnan',
        email: 'harini.k@college.edu',
        rollNumber: '23CS110',
        section: 'B',
        studentCategory: 'Day Scholar',
        mentorId: mentor2._id,
        currentCGPA: 8.65,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 8.3, cgpa: 8.3, attendancePercentage: 92, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 8.5, cgpa: 8.4, attendancePercentage: 93, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 3, sgpa: 8.9, cgpa: 8.65, attendancePercentage: 95, arrearStatus: 'No', numberOfArrears: 0 },
        ],
        technicalProfile: {
          programmingLanguages: ['C#', '.NET', 'TypeScript', 'Python'],
          domainInterest: 'Cloud Computing',
          certifications: ['Microsoft Certified: Azure Fundamentals AZ-900', 'HashiCorp Terraform Associate'],
          projects: [{ projectTitle: 'Kubernetes GitOps Deployment Suite', domain: 'Cloud & DevOps' }],
          profileLinks: { github: 'https://github.com/harinik', linkedin: 'https://linkedin.com/in/harinik' },
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'Cloud Software Engineer', expectedSalaryRange: '12-16 LPA' } },
        placementStatus: { isPlaced: true, placementType: 'On-Campus', companyName: 'Microsoft', jobRole: 'Software Engineer', packageCTC: 14.5 },
      },
      {
        name: 'Suresh Babu',
        email: 'suresh.b@college.edu',
        rollNumber: '23CS111',
        section: 'C',
        studentCategory: 'Hosteller',
        mentorId: null, // intentionally unassigned to test unassigned filtering & intervention
        currentCGPA: 5.90,
        standingArrearsCount: 4,
        semesters: [
          { semesterNumber: 1, sgpa: 6.5, cgpa: 6.5, attendancePercentage: 74, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 5.9, cgpa: 6.2, attendancePercentage: 68, arrearStatus: 'Yes', numberOfArrears: 2 },
          { semesterNumber: 3, sgpa: 5.4, cgpa: 5.9, attendancePercentage: 65, arrearStatus: 'Yes', numberOfArrears: 2 },
        ],
        arrears: [
          { semesterOccurred: 2, subjectCode: 'MA8351', subjectName: 'Discrete Mathematics', currentStatus: 'Pending', numberOfAttempts: 2, remedialSupportRequired: 'Yes' },
          { semesterOccurred: 2, subjectCode: 'CS8391', subjectName: 'Data Structures', currentStatus: 'Pending', numberOfAttempts: 2, remedialSupportRequired: 'Yes' },
          { semesterOccurred: 3, subjectCode: 'CS8351', subjectName: 'Digital Principles & System Design', currentStatus: 'Pending', numberOfAttempts: 1, remedialSupportRequired: 'Yes' },
          { semesterOccurred: 3, subjectCode: 'CS8492', subjectName: 'Database Management Systems', currentStatus: 'Pending', numberOfAttempts: 1, remedialSupportRequired: 'Yes' },
        ],
        technicalProfile: {
          programmingLanguages: ['C'],
          domainInterest: 'Web Development',
          certifications: [],
          projects: [],
          profileLinks: {},
        },
        careerGoal: { primaryGoal: 'Undecided' },
        placementStatus: { isPlaced: false },
      },
      {
        name: 'Kavya Ramesh',
        email: 'kavya.r@college.edu',
        rollNumber: '23CS112',
        section: 'A',
        studentCategory: 'Day Scholar',
        mentorId: mentor3._id,
        currentCGPA: 7.55,
        standingArrearsCount: 0,
        semesters: [
          { semesterNumber: 1, sgpa: 7.4, cgpa: 7.4, attendancePercentage: 88, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 2, sgpa: 7.5, cgpa: 7.45, attendancePercentage: 87, arrearStatus: 'No', numberOfArrears: 0 },
          { semesterNumber: 3, sgpa: 7.6, cgpa: 7.55, attendancePercentage: 89, arrearStatus: 'No', numberOfArrears: 0 },
        ],
        arrears: [
          { semesterOccurred: 2, subjectCode: 'MA8351', subjectName: 'Discrete Mathematics', currentStatus: 'Cleared', clearedSemester: 3, numberOfAttempts: 1, remedialSupportRequired: 'No' },
        ],
        technicalProfile: {
          programmingLanguages: ['Python', 'SQL', 'R'],
          domainInterest: 'Data Science',
          certifications: ['IBM Data Science Professional Certificate'],
          projects: [{ projectTitle: 'Customer Churn Predictive Pipeline', domain: 'Data Science' }],
          profileLinks: { github: 'https://github.com/kavyar', linkedin: 'https://linkedin.com/in/kavyar' },
        },
        careerGoal: { primaryGoal: 'Placement', placement: { preferredRole: 'Data Analyst / Associate Scientist', expectedSalaryRange: '6-8 LPA' } },
        placementStatus: { isPlaced: true, placementType: 'Off-Campus', companyName: 'Freshworks', jobRole: 'Associate Data Analyst', packageCTC: 7.2 },
      },
    ];

    for (const st of studentSeedData) {
      let stUser = await User.findOne({ email: st.email });
      if (!stUser) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('StudentPassword123!', salt);
        stUser = new User({
          name: st.name,
          email: st.email,
          password: hashedPassword,
          role: 'student',
          rollNumber: st.rollNumber,
          department: 'CSE',
          mentorId: st.mentorId,
          status: 'active',
          mustChangePassword: false,
        });
        await stUser.save();
        console.log(`Demo Student User Seeded: ${st.email}`);
      }

      let profile = await StudentProfile.findOne({ email: st.email });
      if (!profile) {
        profile = new StudentProfile({
          userId: stUser._id,
          rollNumber: st.rollNumber,
          name: st.name,
          email: st.email,
          department: 'CSE',
          section: st.section,
          studentCategory: st.studentCategory,
          mentorId: st.mentorId,
          currentCGPA: st.currentCGPA,
          standingArrearsCount: st.standingArrearsCount,
          semesters: st.semesters || [],
          arrears: st.arrears || [],
          technicalProfile: st.technicalProfile || {},
          careerGoal: st.careerGoal || {},
          placementStatus: st.placementStatus || {},
        });
        await profile.save();
        console.log(`Demo Student Profile Seeded: ${st.rollNumber} - ${st.name}`);
      }
    }

    // Seed Demo Placement Officer
    const placementEmail = 'placement@college.edu';
    let placementOfficer = await User.findOne({ email: placementEmail });
    if (!placementOfficer) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('PlacementPassword123!', salt);

      placementOfficer = new User({
        name: 'Dr. Radhakrishnan (Chief Placement Officer)',
        email: placementEmail,
        password: hashedPassword,
        role: 'placement_officer',
        department: 'Placement Cell',
        status: 'active',
        mustChangePassword: false,
      });
      await placementOfficer.save();
      console.log('Demo Placement Officer Seeded: placement@college.edu');
    }

    // Seed Default Placement Policy
    const PlacementPolicy = require('../models/PlacementPolicy');
    const existingPolicy = await PlacementPolicy.findOne({ batch: '2023-2027' });
    if (!existingPolicy) {
      await PlacementPolicy.create({
        batch: '2023-2027',
        ctcMultiplier: 2,
        minCtcIncreaseLpa: 3,
        dreamTierThresholdLpa: 10,
        allowDreamUpgrade: true,
        maxOffersAllowed: 2,
        policyDescription: 'Students already placed can only attend drives offering at least 2x current CTC or Dream tier (>= 10 LPA).',
        isConfigured: true,
        updatedBy: placementOfficer ? placementOfficer._id : null,
      });
      console.log('Default Placement Policy Seeded for batch 2023-2027');
    }

    // Seed Initial Dynamic Template Fields
    const DynamicField = require('../models/DynamicField');
    const fieldCount = await DynamicField.countDocuments();
    if (fieldCount === 0) {
      await DynamicField.create([
        { fieldKey: 'sem_1_sgpa', fieldName: 'Semester 1 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 1, isRequired: true },
        { fieldKey: 'sem_2_sgpa', fieldName: 'Semester 2 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 2, isRequired: true },
        { fieldKey: 'sem_3_sgpa', fieldName: 'Semester 3 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 3, isRequired: true },
        { fieldKey: 'sem_4_sgpa', fieldName: 'Semester 4 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 4, isRequired: true },
        { fieldKey: 'sem_5_sgpa', fieldName: 'Semester 5 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 5, isRequired: false },
        { fieldKey: 'sem_6_sgpa', fieldName: 'Semester 6 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 6, isRequired: false },
        { fieldKey: 'sem_7_sgpa', fieldName: 'Semester 7 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 7, isRequired: false },
        { fieldKey: 'sem_8_sgpa', fieldName: 'Semester 8 SGPA', category: 'semester_academics', fieldType: 'number', semesterNumber: 8, isRequired: false },
        { fieldKey: 'certifications', fieldName: 'Global Certifications', category: 'student_profile', fieldType: 'text', isRequired: false },
        { fieldKey: 'github_profile', fieldName: 'GitHub URL', category: 'student_profile', fieldType: 'text', isRequired: false },
        { fieldKey: 'linkedin_profile', fieldName: 'LinkedIn URL', category: 'student_profile', fieldType: 'text', isRequired: false },
      ]);
      console.log('Default Dynamic Academic & Profile Templates Seeded');
    }
  } catch (error) {
    console.error('Error seeding initial records:', error.message);
  }
};

module.exports = { seedInitialAdmin };
