# Student Academic Personal and Career Profiling System

A full-stack unified hybrid platform combining student academic, personal, arrear history, and career profiling with multi-role placement tracking and analytics.

---

## 🌟 Built Modules & Roles

### 1. Common Authentication & Password Policy
- **Common Login:** Asks only `email` and `password` with a **Forgot Password** option.
  - Non-existent email: alerts **"User did not exist"** and clears all inputs.
  - Incorrect password: alerts **"Incorrect password"** and clears only password.
  - Role-based automatic redirection into respective dashboards based on DB record.
- **Single-Use 24-Hour Temporary Passwords:**
  - Every temporary password generated (for invitations or password resets) is valid for **a single use only** and automatically expires in **24 hours**.
  - Users are prompted to set their permanent password on first login or after reset.

---

### 2. Administrator Role
- **CRUD Placement Officers & Department Coordinators:**
  - Name, Role, Email, and Department.
  - Automatic dispatch of 24-hr single-use temporary password emails.
  - Bulk onboarding via Excel (`.xlsx`/`.xls`/`.csv`) with sample template download.
  - Toggle Active/Inactive status & 1-click re-invitation.
- **System Activity & Error Diagnostics Window:**
  - Comprehensive auditing: user actions, authentication events, and errors.
  - Inspect root causes with stack trace, HTTP codes, client IP, and user-agent.
  - Multi-filtering by date range, error status, log level, and module.
- **Account Deletion Approvals:**
  - Reviews and approves/rejects account deletion requests submitted by Department Coordinators.

---

### 3. Department Coordinator Role
Each coordinator manages students and staff strictly within their department across **4 core operational pages**:

#### Page A: Department Analytics Dashboard
- Comprehensive KPI cards: Total Students, Placement Rate %, Average CGPA (Highest / Lowest), Standing Arrear counts, Hosteller vs Day Scholar counts, Mentorship coverage %.
- Visual analytics breakdown:
  - Placed vs Unplaced & On-Campus vs Off-Campus mode.
  - Arrear Hotspots (Students with active standing arrears vs zero arrears).
  - Career Goal Segmentation (Placement, Higher Studies - India vs Abroad, Entrepreneurship, Undecided).
  - Top Technical Domain Interests.

#### Page B: Students & Mentors Management
- **Students Directory & Multi-Filter Engine:**
  - Multi-criteria filtering by CGPA range, Placement status (Placed/Not Placed, On-Campus/Off-Campus), Arrears (Standing Arrears vs Clean), Career Goals, Study Location (India vs Abroad), Domain Interest, Section, Category, and Assigned Mentor.
  - **Clicking any student row/name redirects/opens their Full Profile Modal** (Personal, Parent details, Semester progression table, Arrear histories with attempt counts, Technical skills, Strengths, and Career Goals).
  - **Export Safe Excel:** Downloads filtered student data into `.xlsx` while strictly omitting sensitive personal information (parents, income, emergency contact, passwords) under Privacy-by-Design.
  - Add Single Student (with 24-hr single-use temporary password dispatch).
  - Bulk Onboard Students via Excel (`.xlsx`/`.csv`) with downloadable template.
- **Mentors Directory & CRUD:**
  - Onboard department mentors (name, email, department).
  - Displays active mentees count for each mentor.
- **Student-to-Mentor Allocation Matrix:**
  - Select students using checkboxes and assign them in bulk to a selected mentor.
  - **Strict Policy:** Enforces that a student can be assigned only to **one mentor** at any time.

#### Page C: Communication & Messaging Hub
- Compose circulars, general messages, inquiries, or announcements.
- Broadcast to **All Students in Department**, **All Mentors in Department**, or **Selected Students (via checkboxes)**.
- Set priority (`Normal`, `Important`, `Urgent`).
- View conversation threads and reply directly to inquiries.

#### Page D: Department-Specific Drives (Special Flag)
- Post department-specific campus and off-campus drives.
- **Privacy Rule Enforced:** Marked under a special flag (`isDepartmentSpecific: true`). These drives are **hidden from Placement Officers** and visible only to the coordinator, mentors, and students of this department.
- Includes Company Name, Location, About Company, and dynamic **"+ Add Role"** button to configure multiple job roles (Job Role, Salary/CTC, Job Description, Required Docs, Eligibility Criteria, Deadlines).

#### Account Deletion Approval Hierarchy:
- **Requirement 6:** If a Coordinator needs to delete their account, they submit a formal request with a reason to the **Admin** for approval.
- **Requirements 7 & 8:** Students and Mentors cannot delete their accounts directly; they submit a request with a reason to the **Department Coordinator**, who reviews and approves or rejects it.

---

## 🔑 Demo Login Credentials (Ready to Test)

| Role | Email | Password |
| :--- | :--- | :--- |
| **System Administrator** | `admin@college.edu` | `AdminPassword123!` |
| **CSE Department Coordinator** | `coordinator.cse@college.edu` | `CoordPassword123!` |
| **Faculty Mentor (CSE)** | `mentor.cse@college.edu` | `MentorPassword123!` |
| **Student (CSE)** | `student.cse@college.edu` | `StudentPassword123!` |

---

## 🚀 Running the Application
```bash
# 1. Start Server
cd server
npm run dev

# 2. Start Client (in a separate terminal)
cd client
npm run dev
```
Open **`http://localhost:5173`** in your browser.

Role	Email	Password
System Administrator	admin@college.edu	AdminPassword123!
CSE Department Coordinator	coordinator.cse@college.edu	CoordPassword123!
Faculty Mentor (CSE)	mentor.cse@college.edu	MentorPassword123!
Student (CSE)	student.cse@college.edu	StudentPassword123!
