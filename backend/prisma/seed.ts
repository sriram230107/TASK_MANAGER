import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
    PrismaClient,
    Role,
    TaskPriority,
    TaskStatus,
    AttendanceStatus,
    WorkSessionType,
    LeaveType,
    LeaveStatus,
    GoalLevel,
    GoalStatus,
    PayrollStatus,
    DocumentCategory,
    DocumentScope
} from "@prisma/client";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
    adapter,
});

async function main() {
    console.log("=================================================");
    console.log("🌱 SEEDING COMPLETE MULTI-TIER WORKFORCE PLATFORM");
    console.log("=================================================");

    const passwordHash = await bcrypt.hash("password123", 10);

    // 1. Clean existing database in safe dependency order
    console.log("Cleaning existing records...");
    await prisma.taskAttachment.deleteMany();
    await prisma.taskComment.deleteMany();
    await prisma.taskHistory.deleteMany();
    await prisma.taskUpdate.deleteMany();
    await prisma.taskAssignment.deleteMany();
    await prisma.recurrenceRule.deleteMany();
    await prisma.task.deleteMany();
    await prisma.taskTemplate.deleteMany();

    await prisma.workSession.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.leaveBalance.deleteMany();
    await prisma.performanceReview.deleteMany();
    await prisma.goal.deleteMany();
    await prisma.payrollRecord.deleteMany();
    await prisma.document.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.refreshToken.deleteMany();

    await prisma.teamMember.deleteMany();
    await prisma.team.updateMany({ data: { teamLeadId: null, departmentId: null } });
    await prisma.team.deleteMany();

    await prisma.department.updateMany({ data: { managerId: null } });
    await prisma.user.updateMany({ data: { departmentId: null, managerId: null, teamLeadId: null } });
    await prisma.department.deleteMany();

    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    // 2. Organization & Enterprise Settings
    console.log("Creating Organization & Settings...");
    const org = await prisma.organization.create({
        data: {
            name: "TaskBot Global Technologies",
            workingHoursPerDay: 8.0,
            workDaysPerWeek: 5,
            settings: {
                holidays: [
                    { name: "New Year's Day", date: "2026-01-01", isRecurring: true },
                    { name: "Memorial Day", date: "2026-05-25", isRecurring: true },
                    { name: "Independence Day", date: "2026-07-04", isRecurring: true },
                    { name: "Labor Day", date: "2026-09-07", isRecurring: true },
                    { name: "Thanksgiving Day", date: "2026-11-26", isRecurring: true },
                    { name: "Christmas Day", date: "2026-12-25", isRecurring: true }
                ],
                leavePolicies: {
                    annualLeaveDays: 20,
                    sickLeaveDays: 10,
                    casualLeaveDays: 5,
                    carryOverMaxDays: 5
                },
                taskPolicies: {
                    requireReviewForCompletion: true,
                    allowEmployeeSelfAssign: false,
                    autoOverdueGracePeriodHours: 24
                },
                notificationSettings: {
                    emailNotificationsEnabled: false,
                    taskDueRemindersHours: 24,
                    attendanceRemindersEnabled: true
                },
                reviewPeriods: {
                    frequency: "QUARTERLY",
                    nextReviewDate: "2026-10-01"
                }
            }
        }
    });

    // 3. Departments
    console.log("Creating Departments...");
    const deptEngineering = await prisma.department.create({
        data: { name: "Engineering & Technology", code: "ENG", organizationId: org.id }
    });
    const deptProduct = await prisma.department.create({
        data: { name: "Product & Design", code: "PRD", organizationId: org.id }
    });
    const deptOperations = await prisma.department.create({
        data: { name: "Sales & Operations", code: "OPS", organizationId: org.id }
    });

    // 4. Admin User
    console.log("Creating Admin...");
    const admin = await prisma.user.create({
        data: {
            email: "admin@taskbot.com",
            passwordHash,
            name: "Eleanor Vance (Chief Executive)",
            role: Role.ADMIN,
            organizationId: org.id
        }
    });

    // 5. Department Managers
    console.log("Creating Department Managers...");
    const mgrEng = await prisma.user.create({
        data: {
            email: "manager.eng@taskbot.com",
            passwordHash,
            name: "Marcus Brody (Director of Engineering)",
            role: Role.MANAGER,
            organizationId: org.id,
            departmentId: deptEngineering.id
        }
    });
    const mgrProd = await prisma.user.create({
        data: {
            email: "manager.prod@taskbot.com",
            passwordHash,
            name: "Sophia Chen (Head of Product)",
            role: Role.MANAGER,
            organizationId: org.id,
            departmentId: deptProduct.id
        }
    });
    const mgrOps = await prisma.user.create({
        data: {
            email: "manager.ops@taskbot.com",
            passwordHash,
            name: "David Miller (VP of Operations)",
            role: Role.MANAGER,
            organizationId: org.id,
            departmentId: deptOperations.id
        }
    });

    // Assign manager relations to departments
    await prisma.department.update({ where: { id: deptEngineering.id }, data: { managerId: mgrEng.id } });
    await prisma.department.update({ where: { id: deptProduct.id }, data: { managerId: mgrProd.id } });
    await prisma.department.update({ where: { id: deptOperations.id }, data: { managerId: mgrOps.id } });

    // 6. Team Leads (2 per department)
    console.log("Creating Team Leads...");
    // Engineering Leads
    const leadBackend = await prisma.user.create({
        data: {
            email: "lead.backend@taskbot.com",
            passwordHash,
            name: "Alex Rivera (Backend Lead)",
            role: Role.TEAM_LEAD,
            organizationId: org.id,
            departmentId: deptEngineering.id,
            managerId: mgrEng.id
        }
    });
    const leadFrontend = await prisma.user.create({
        data: {
            email: "lead.frontend@taskbot.com",
            passwordHash,
            name: "Sarah Connor (Frontend Lead)",
            role: Role.TEAM_LEAD,
            organizationId: org.id,
            departmentId: deptEngineering.id,
            managerId: mgrEng.id
        }
    });

    // Product Leads
    const leadDesign = await prisma.user.create({
        data: {
            email: "lead.design@taskbot.com",
            passwordHash,
            name: "Chloe Bennett (UX Design Lead)",
            role: Role.TEAM_LEAD,
            organizationId: org.id,
            departmentId: deptProduct.id,
            managerId: mgrProd.id
        }
    });
    const leadPM = await prisma.user.create({
        data: {
            email: "lead.pm@taskbot.com",
            passwordHash,
            name: "James Wilson (Product Strategy Lead)",
            role: Role.TEAM_LEAD,
            organizationId: org.id,
            departmentId: deptProduct.id,
            managerId: mgrProd.id
        }
    });

    // Operations Leads
    const leadSales = await prisma.user.create({
        data: {
            email: "lead.sales@taskbot.com",
            passwordHash,
            name: "Rachel Adams (Enterprise Sales Lead)",
            role: Role.TEAM_LEAD,
            organizationId: org.id,
            departmentId: deptOperations.id,
            managerId: mgrOps.id
        }
    });
    const leadSupport = await prisma.user.create({
        data: {
            email: "lead.support@taskbot.com",
            passwordHash,
            name: "Daniel Craig (Support Ops Lead)",
            role: Role.TEAM_LEAD,
            organizationId: org.id,
            departmentId: deptOperations.id,
            managerId: mgrOps.id
        }
    });

    // 7. Teams
    console.log("Creating Teams...");
    const teamCore = await prisma.team.create({
        data: { name: "Core Platform Engine", organizationId: org.id, departmentId: deptEngineering.id, teamLeadId: leadBackend.id }
    });
    const teamWeb = await prisma.team.create({
        data: { name: "Web Experience Team", organizationId: org.id, departmentId: deptEngineering.id, teamLeadId: leadFrontend.id }
    });
    const teamDesign = await prisma.team.create({
        data: { name: "UI/UX Design Studio", organizationId: org.id, departmentId: deptProduct.id, teamLeadId: leadDesign.id }
    });
    const teamStrategy = await prisma.team.create({
        data: { name: "Product Strategy & Growth", organizationId: org.id, departmentId: deptProduct.id, teamLeadId: leadPM.id }
    });
    const teamSales = await prisma.team.create({
        data: { name: "Enterprise Accounts Team", organizationId: org.id, departmentId: deptOperations.id, teamLeadId: leadSales.id }
    });
    const teamCS = await prisma.team.create({
        data: { name: "Customer Solutions & Support", organizationId: org.id, departmentId: deptOperations.id, teamLeadId: leadSupport.id }
    });

    // 8. Employees (3 per team = 18 employees)
    console.log("Creating Employees & Memberships...");
    const employeeConfigs = [
        // Core Platform (Backend)
        { email: "emp.dev1@taskbot.com", name: "Jordan Lee (Senior Backend Engineer)", lead: leadBackend, mgr: mgrEng, dept: deptEngineering, team: teamCore },
        { email: "emp.dev2@taskbot.com", name: "Maya Patel (Cloud Infrastructure Dev)", lead: leadBackend, mgr: mgrEng, dept: deptEngineering, team: teamCore },
        { email: "emp.dev3@taskbot.com", name: "Lucas Silva (API & Systems Dev)", lead: leadBackend, mgr: mgrEng, dept: deptEngineering, team: teamCore },
        // Web Experience (Frontend)
        { email: "emp.dev4@taskbot.com", name: "Emma Watson (UI Systems Engineer)", lead: leadFrontend, mgr: mgrEng, dept: deptEngineering, team: teamWeb },
        { email: "emp.dev5@taskbot.com", name: "Liam Johnson (Fullstack Developer)", lead: leadFrontend, mgr: mgrEng, dept: deptEngineering, team: teamWeb },
        { email: "emp.dev6@taskbot.com", name: "Zoe Garcia (Interactive Web Dev)", lead: leadFrontend, mgr: mgrEng, dept: deptEngineering, team: teamWeb },
        // UI/UX Design Studio
        { email: "emp.des1@taskbot.com", name: "Olivia Kim (Senior Product Designer)", lead: leadDesign, mgr: mgrProd, dept: deptProduct, team: teamDesign },
        { email: "emp.des2@taskbot.com", name: "Noah Brown (Design Systems Specialist)", lead: leadDesign, mgr: mgrProd, dept: deptProduct, team: teamDesign },
        { email: "emp.des3@taskbot.com", name: "Ava Davis (UX Researcher)", lead: leadDesign, mgr: mgrProd, dept: deptProduct, team: teamDesign },
        // Product Strategy & Growth
        { email: "emp.pm1@taskbot.com", name: "Ethan Taylor (Product Manager)", lead: leadPM, mgr: mgrProd, dept: deptProduct, team: teamStrategy },
        { email: "emp.pm2@taskbot.com", name: "Mia Thomas (Business Operations Analyst)", lead: leadPM, mgr: mgrProd, dept: deptProduct, team: teamStrategy },
        { email: "emp.pm3@taskbot.com", name: "Benjamin Moore (Growth Data Analyst)", lead: leadPM, mgr: mgrProd, dept: deptProduct, team: teamStrategy },
        // Enterprise Accounts
        { email: "emp.sales1@taskbot.com", name: "Harper Jackson (Senior Enterprise AE)", lead: leadSales, mgr: mgrOps, dept: deptOperations, team: teamSales },
        { email: "emp.sales2@taskbot.com", name: "William White (Account Development Rep)", lead: leadSales, mgr: mgrOps, dept: deptOperations, team: teamSales },
        { email: "emp.sales3@taskbot.com", name: "Ella Harris (Strategic Partnerships Mgr)", lead: leadSales, mgr: mgrOps, dept: deptOperations, team: teamSales },
        // Customer Solutions & Support
        { email: "emp.sup1@taskbot.com", name: "Oliver Martin (Technical Solutions Specialist)", lead: leadSupport, mgr: mgrOps, dept: deptOperations, team: teamCS },
        { email: "emp.sup2@taskbot.com", name: "Charlotte Clark (Client Onboarding Lead)", lead: leadSupport, mgr: mgrOps, dept: deptOperations, team: teamCS },
        { email: "emp.sup3@taskbot.com", name: "Henry Lewis (Customer Success Manager)", lead: leadSupport, mgr: mgrOps, dept: deptOperations, team: teamCS }
    ];

    const employees: any[] = [];
    for (const cfg of employeeConfigs) {
        const emp = await prisma.user.create({
            data: {
                email: cfg.email,
                passwordHash,
                name: cfg.name,
                role: Role.EMPLOYEE,
                organizationId: org.id,
                departmentId: cfg.dept.id,
                managerId: cfg.mgr.id,
                teamLeadId: cfg.lead.id
            }
        });
        await prisma.teamMember.create({
            data: { teamId: cfg.team.id, userId: emp.id }
        });
        employees.push({ ...emp, team: cfg.team, lead: cfg.lead, mgr: cfg.mgr, dept: cfg.dept });
    }

    const allStaff = [admin, mgrEng, mgrProd, mgrOps, leadBackend, leadFrontend, leadDesign, leadPM, leadSales, leadSupport, ...employees];

    // 9. Leave Balances for all workforce (Annual, Sick, Casual)
    console.log("Seeding Leave Balances...");
    for (const user of allStaff) {
        await prisma.leaveBalance.createMany({
            data: [
                {
                    userId: user.id,
                    leaveType: LeaveType.ANNUAL,
                    allocatedDays: 20,
                    usedDays: 3,
                    remainingDays: 17,
                    year: 2026
                },
                {
                    userId: user.id,
                    leaveType: LeaveType.SICK,
                    allocatedDays: 10,
                    usedDays: 1,
                    remainingDays: 9,
                    year: 2026
                },
                {
                    userId: user.id,
                    leaveType: LeaveType.CASUAL,
                    allocatedDays: 5,
                    usedDays: 1,
                    remainingDays: 4,
                    year: 2026
                }
            ]
        });
    }

    // 10. Realistic Tasks with 11-status lifecycle
    console.log("Seeding Tasks & Lifecycle History...");
    const dev1 = employees[0]; // Jordan Lee
    const dev2 = employees[1]; // Maya Patel
    const dev4 = employees[3]; // Emma Watson
    const des1 = employees[6]; // Olivia Kim
    const pm1 = employees[9];  // Ethan Taylor
    const sales1 = employees[12]; // Harper Jackson

    const taskDefinitions = [
        {
            title: "Migrate Core Database to PostgreSQL Cluster with Read Replicas",
            description: "Upgraded DB cluster to PostgreSQL with connection pooling adapter and high availability failover.",
            priority: TaskPriority.HIGH,
            status: TaskStatus.COMPLETED,
            creator: mgrEng,
            mgr: mgrEng,
            lead: leadBackend,
            emp: dev1,
            dept: deptEngineering,
            team: teamCore,
            progress: 100,
            estHours: 40,
            actHours: 38.5,
            completionNotes: "All 16 resource schemas synchronized and non-destructive migrations completed.",
            reviewNotes: "Excellent architecture execution and zero query regression."
        },
        {
            title: "Implement Real-time RBAC Middleware & Tenant Scope Isolator",
            description: "Enforce strict organizational tenant isolation, target capability evaluation, and department scope checks.",
            priority: TaskPriority.URGENT,
            status: TaskStatus.COMPLETED,
            creator: mgrEng,
            mgr: mgrEng,
            lead: leadBackend,
            emp: dev2,
            dept: deptEngineering,
            team: teamCore,
            progress: 100,
            estHours: 30,
            actHours: 32,
            completionNotes: "Full test matrix passed across all 4 workforce roles.",
            reviewNotes: "Security team verified zero privilege escalation vectors."
        },
        {
            title: "Refactor Frontend Navigation with Responsive Glassmorphic Sidebar",
            description: "Build clean, accessible sidebar with active route indicator, user profile trigger, and role badge.",
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.IN_PROGRESS,
            creator: leadFrontend,
            mgr: mgrEng,
            lead: leadFrontend,
            emp: dev4,
            dept: deptEngineering,
            team: teamWeb,
            progress: 65,
            estHours: 25,
            actHours: 16
        },
        {
            title: "Design System Dark Mode Tokens & Typography Hierarchy",
            description: "Establish WCAG AAA compliant color tokens, responsive font scales, and reusable card containers.",
            priority: TaskPriority.HIGH,
            status: TaskStatus.SUBMITTED,
            creator: leadDesign,
            mgr: mgrProd,
            lead: leadDesign,
            emp: des1,
            dept: deptProduct,
            team: teamDesign,
            progress: 95,
            estHours: 20,
            actHours: 19,
            completionNotes: "Token catalog and component playground deployed to internal preview."
        },
        {
            title: "Q3 Enterprise Product Roadmap & OKR Alignment",
            description: "Synthesize quarterly customer feedback, feature prioritization, and engineering capacity bounds.",
            priority: TaskPriority.HIGH,
            status: TaskStatus.UNDER_REVIEW,
            creator: mgrProd,
            mgr: mgrProd,
            lead: leadPM,
            emp: pm1,
            dept: deptProduct,
            team: teamStrategy,
            progress: 90,
            estHours: 35,
            actHours: 31,
            completionNotes: "Executive slide deck prepared for executive review."
        },
        {
            title: "Close Strategic Enterprise SaaS Pilot with Horizon Media",
            description: "Complete security questionnaire, vendor agreement, and legal review for 500 seat rollout.",
            priority: TaskPriority.URGENT,
            status: TaskStatus.IN_PROGRESS,
            creator: mgrOps,
            mgr: mgrOps,
            lead: leadSales,
            emp: sales1,
            dept: deptOperations,
            team: teamSales,
            progress: 75,
            estHours: 50,
            actHours: 36
        },
        {
            title: "Stripe Webhook Multi-Currency Settlement Integration",
            description: "Handle international VAT tax calculation and currency conversion webhooks.",
            priority: TaskPriority.HIGH,
            status: TaskStatus.BLOCKED,
            creator: leadBackend,
            mgr: mgrEng,
            lead: leadBackend,
            emp: dev1,
            dept: deptEngineering,
            team: teamCore,
            progress: 40,
            estHours: 20,
            actHours: 10,
            reviewNotes: "Blocked waiting on Stripe European banking merchant verification."
        },
        {
            title: "Client Onboarding Automation Workflow Guide",
            description: "Draft step-by-step interactive onboarding instructions for newly provisioned tenant organizations.",
            priority: TaskPriority.LOW,
            status: TaskStatus.CHANGES_REQUESTED,
            creator: leadSupport,
            mgr: mgrOps,
            lead: leadSupport,
            emp: employees[16], // Charlotte Clark
            dept: deptOperations,
            team: teamCS,
            progress: 50,
            estHours: 15,
            actHours: 12,
            reviewNotes: "Please expand section 3 to cover SSO configurations for Microsoft Entra ID."
        },
        {
            title: "Quarterly Platform Load & Stress Testing Benchmark",
            description: "Simulate 10,000 concurrent websocket connections and test database query latency under spike load.",
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.ACCEPTED,
            creator: mgrEng,
            mgr: mgrEng,
            lead: leadBackend,
            emp: dev2,
            dept: deptEngineering,
            team: teamCore,
            progress: 20,
            estHours: 16,
            actHours: 3
        },
        {
            title: "Draft Organization Remote Work Security & Compliance Guideline",
            description: "Corporate policy regarding device encryption, password managers, and VPN usage.",
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.ASSIGNED,
            creator: admin,
            mgr: mgrOps,
            lead: leadSales,
            emp: sales1,
            dept: deptOperations,
            team: teamSales,
            progress: 10,
            estHours: 12,
            actHours: 1
        }
    ];

    for (const td of taskDefinitions) {
        const task = await prisma.task.create({
            data: {
                title: td.title,
                description: td.description,
                priority: td.priority,
                status: td.status,
                createdById: td.creator.id,
                assignedManagerId: td.mgr.id,
                assignedTeamLeadId: td.lead.id,
                assignedEmployeeId: td.emp.id,
                assignedToId: td.emp.id,
                departmentId: td.dept.id,
                teamId: td.team.id,
                organizationId: org.id,
                startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                completedAt: td.status === TaskStatus.COMPLETED ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : null,
                estimatedHours: td.estHours,
                actualHours: td.actHours,
                progressPercent: td.progress,
                completionNotes: td.completionNotes || null,
                reviewNotes: td.reviewNotes || null
            }
        });

        // Assignment record
        await prisma.taskAssignment.create({
            data: { taskId: task.id, userId: td.emp.id, role: "ASSIGNEE" }
        });

        // Comments
        await prisma.taskComment.create({
            data: {
                taskId: task.id,
                userId: td.lead.id,
                content: `Initial kickoff for "${task.title}". Please prioritize sprint delivery.`
            }
        });
        await prisma.taskComment.create({
            data: {
                taskId: task.id,
                userId: td.emp.id,
                content: "Understood, requirements reviewed. Implementation underway."
            }
        });

        // Updates
        await prisma.taskUpdate.create({
            data: {
                taskId: task.id,
                userId: td.emp.id,
                progressPercent: td.progress,
                comment: "Milestone reached according to sprint objectives.",
                hoursLogged: td.actHours
            }
        });

        // History
        await prisma.taskHistory.create({
            data: {
                taskId: task.id,
                userId: td.creator.id,
                action: "STATUS_CHANGE",
                fromStatus: "DRAFT",
                toStatus: td.status,
                details: `Task status transitioned to ${td.status}`
            }
        });
    }

    // 11. Attendance & Work Sessions (Past 10 Days)
    console.log("Seeding Attendance Records & Timers...");
    for (let dayOffset = 10; dayOffset >= 0; dayOffset--) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - dayOffset);
        targetDate.setHours(0, 0, 0, 0);

        // Skip weekend (Saturday=6, Sunday=0)
        if (targetDate.getDay() === 0 || targetDate.getDay() === 6) continue;

        // Sample 4 active staff per day
        const dailyStaff = [dev1, dev4, leadBackend, mgrEng];
        for (const staff of dailyStaff) {
            const checkIn = new Date(targetDate);
            checkIn.setHours(9, 0, 0, 0);

            const checkOut = new Date(targetDate);
            checkOut.setHours(17, 30, 0, 0);

            const isCurrentDay = dayOffset === 0;

            const att = await prisma.attendance.create({
                data: {
                    userId: staff.id,
                    date: targetDate,
                    status: dayOffset === 2 ? AttendanceStatus.WORK_FROM_HOME : AttendanceStatus.PRESENT,
                    checkIn,
                    checkOut: isCurrentDay ? null : checkOut,
                    totalWorkingMinutes: isCurrentDay ? 270 : 480,
                    overtimeMinutes: isCurrentDay ? 0 : 30,
                    breakDurationMinutes: 30,
                    lateArrival: false,
                    earlyDeparture: false,
                    isWorkFromHome: dayOffset === 2,
                    notes: dayOffset === 2 ? "Scheduled Remote Work Day" : null
                }
            });

            // Work sessions
            await prisma.workSession.create({
                data: {
                    attendanceId: att.id,
                    type: WorkSessionType.WORKING,
                    startTime: checkIn,
                    endTime: new Date(checkIn.getTime() + 4 * 60 * 60 * 1000),
                    durationMinutes: 240
                }
            });
            await prisma.workSession.create({
                data: {
                    attendanceId: att.id,
                    type: WorkSessionType.BREAK,
                    startTime: new Date(checkIn.getTime() + 4 * 60 * 60 * 1000),
                    endTime: new Date(checkIn.getTime() + 4.5 * 60 * 60 * 1000),
                    durationMinutes: 30
                }
            });
            if (!isCurrentDay) {
                await prisma.workSession.create({
                    data: {
                        attendanceId: att.id,
                        type: WorkSessionType.WORKING,
                        startTime: new Date(checkIn.getTime() + 4.5 * 60 * 60 * 1000),
                        endTime: checkOut,
                        durationMinutes: 240
                    }
                });
            }
        }
    }

    // 12. Leave Requests
    console.log("Seeding Leave Requests & Approval Chains...");
    await prisma.leaveRequest.create({
        data: {
            employeeId: dev1.id,
            type: LeaveType.ANNUAL,
            startDate: new Date("2026-08-10"),
            endDate: new Date("2026-08-14"),
            daysCount: 5,
            reason: "Annual family summer vacation",
            status: LeaveStatus.APPROVED,
            teamLeadReviewerId: leadBackend.id,
            managerReviewerId: mgrEng.id,
            teamLeadReviewedAt: new Date("2026-08-01"),
            managerReviewedAt: new Date("2026-08-02"),
            reviewerNotes: "Approved. Sprint delivery covered by team."
        }
    });

    await prisma.leaveRequest.create({
        data: {
            employeeId: dev4.id,
            type: LeaveType.CASUAL,
            startDate: new Date("2026-09-18"),
            endDate: new Date("2026-09-19"),
            daysCount: 2,
            reason: "Personal medical checkup and family matters",
            status: LeaveStatus.PENDING_MANAGER,
            teamLeadReviewerId: leadFrontend.id,
            teamLeadReviewedAt: new Date("2026-09-07"),
            reviewerNotes: "Approved at lead level. Sprint delivery on track."
        }
    });

    await prisma.leaveRequest.create({
        data: {
            employeeId: des1.id,
            type: LeaveType.SICK,
            startDate: new Date("2026-09-25"),
            endDate: new Date("2026-09-25"),
            daysCount: 1,
            reason: "Scheduled doctor consultation",
            status: LeaveStatus.PENDING_LEAD
        }
    });

    // 13. Cascading Goals & Performance Reviews
    console.log("Seeding Cascading Goals & Reviews...");
    await prisma.goal.create({
        data: {
            title: "Achieve 99.99% Platform Uptime and Scale Enterprise Client Base",
            description: "Executive strategic priority to establish mission-critical SaaS reliability.",
            level: GoalLevel.ORGANIZATION,
            status: GoalStatus.IN_PROGRESS,
            progress: 75,
            target: "99.99% Uptime",
            deadline: new Date("2026-12-31"),
            organizationId: org.id,
            ownerId: admin.id
        }
    });

    await prisma.goal.create({
        data: {
            title: "Deliver Next-Gen Workforce Management Modules with Strict RBAC",
            description: "Complete all 16 platform modules on Express 5 and Vite 8.",
            level: GoalLevel.DEPARTMENT,
            status: GoalStatus.IN_PROGRESS,
            progress: 85,
            target: "16 Modules Verified",
            deadline: new Date("2026-09-30"),
            organizationId: org.id,
            departmentId: deptEngineering.id,
            ownerId: mgrEng.id
        }
    });

    await prisma.goal.create({
        data: {
            title: "Complete Non-Destructive Database Synchronization & Automated Tests",
            description: "Maintain zero data loss and 100% test pass rate across all services.",
            level: GoalLevel.TEAM,
            status: GoalStatus.ACHIEVED,
            progress: 100,
            target: "100% Pass Rate",
            deadline: new Date("2026-09-15"),
            organizationId: org.id,
            departmentId: deptEngineering.id,
            teamId: teamCore.id,
            ownerId: leadBackend.id
        }
    });

    await prisma.goal.create({
        data: {
            title: "Implement Formatted Payslip Generator and Attendance Overtime Engine",
            description: "Automate overtime computation linked directly to daily clock punch records.",
            level: GoalLevel.EMPLOYEE,
            status: GoalStatus.ACHIEVED,
            progress: 100,
            target: "Automated Overtime Net Formula",
            deadline: new Date("2026-09-10"),
            organizationId: org.id,
            departmentId: deptEngineering.id,
            teamId: teamCore.id,
            ownerId: dev1.id
        }
    });

    // Performance review
    await prisma.performanceReview.create({
        data: {
            employeeId: dev1.id,
            reviewerId: mgrEng.id,
            periodStart: new Date("2026-04-01"),
            periodEnd: new Date("2026-06-30"),
            cadence: "QUARTERLY",
            rating: 5,
            comments: "Outstanding contribution to the core platform architecture and multi-tier assignees engine.",
            goalsAchievedRate: 100,
            taskCompletionRate: 96.5,
            onTimeRate: 94.0,
            attendanceConsistency: 98.2
        }
    });

    // 14. Payroll & Compensation Records
    console.log("Seeding Payroll & Compensation Records...");
    const payrollSeeds = [
        { emp: dev1, base: 8500, allowances: 800, ot: 350, bonus: 500, ded: 1200, status: PayrollStatus.PAID, start: "2026-08-01", end: "2026-08-31" },
        { emp: dev2, base: 9000, allowances: 900, ot: 200, bonus: 600, ded: 1300, status: PayrollStatus.PAID, start: "2026-08-01", end: "2026-08-31" },
        { emp: leadBackend, base: 11000, allowances: 1200, ot: 0, bonus: 1000, ded: 1600, status: PayrollStatus.PAID, start: "2026-08-01", end: "2026-08-31" },
        { emp: dev4, base: 7500, allowances: 600, ot: 150, bonus: 300, ded: 950, status: PayrollStatus.PROCESSED, start: "2026-09-01", end: "2026-09-30" },
        { emp: dev1, base: 8500, allowances: 800, ot: 180, bonus: 0, ded: 1150, status: PayrollStatus.DRAFT, start: "2026-09-01", end: "2026-09-30" }
    ];

    for (const p of payrollSeeds) {
        const net = p.base + p.allowances + p.ot + p.bonus - p.ded;
        await prisma.payrollRecord.create({
            data: {
                employeeId: p.emp.id,
                periodStart: new Date(p.start),
                periodEnd: new Date(p.end),
                baseSalary: p.base,
                allowances: p.allowances,
                overtimePay: p.ot,
                bonuses: p.bonus,
                deductions: p.ded,
                netSalary: net,
                status: p.status,
                payslipUrl: `/api/v1/payroll/payslip-mock-${p.emp.id}.pdf`
            }
        });
    }

    // 15. Documents & Policies
    console.log("Seeding Documents & Governance Policies...");
    await prisma.document.create({
        data: {
            title: "Global Employee Handbook & Code of Conduct 2026",
            description: "Official enterprise standard operating procedures, workforce benefits, and ethics guidelines.",
            fileUrl: "/uploads/handbook-2026.pdf",
            fileName: "Employee_Handbook_2026.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2450000,
            category: DocumentCategory.POLICY,
            accessScope: DocumentScope.ORGANIZATION,
            uploadedById: admin.id,
            organizationId: org.id
        }
    });

    await prisma.document.create({
        data: {
            title: "Information Security & Remote Work Compliance Protocol",
            description: "Mandatory security controls regarding VPN, endpoint encryption, and data handling.",
            fileUrl: "/uploads/infosec-policy.pdf",
            fileName: "InfoSec_Compliance_Protocol.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1840000,
            category: DocumentCategory.POLICY,
            accessScope: DocumentScope.ORGANIZATION,
            uploadedById: admin.id,
            organizationId: org.id
        }
    });

    await prisma.document.create({
        data: {
            title: "Q3 All-Hands Keynote & Strategic Objectives",
            description: "Executive presentation deck from quarterly workforce assembly.",
            fileUrl: "/uploads/q3-keynote.pdf",
            fileName: "Q3_All_Hands_Keynote.pdf",
            mimeType: "application/pdf",
            sizeBytes: 5200000,
            category: DocumentCategory.ANNOUNCEMENT,
            accessScope: DocumentScope.ORGANIZATION,
            uploadedById: admin.id,
            organizationId: org.id
        }
    });

    await prisma.document.create({
        data: {
            title: "Engineering Technical Architecture Blueprint v4.2",
            description: "Detailed system architecture, database schema, and microservice communication patterns.",
            fileUrl: "/uploads/eng-arch-v4.pdf",
            fileName: "Engineering_Architecture_v4.pdf",
            mimeType: "application/pdf",
            sizeBytes: 3100000,
            category: DocumentCategory.REPORT,
            accessScope: DocumentScope.DEPARTMENT,
            departmentId: deptEngineering.id,
            uploadedById: mgrEng.id,
            organizationId: org.id
        }
    });

    // 16. Audit Log Entries
    console.log("Seeding Audit Trail...");
    const auditEvents = [
        { user: admin, action: "INITIALIZE_ORGANIZATION", entity: "Organization", entityId: org.id, metadata: { name: org.name } },
        { user: admin, action: "CREATE_DEPARTMENT", entity: "Department", entityId: deptEngineering.id, metadata: { code: "ENG" } },
        { user: admin, action: "CREATE_DEPARTMENT", entity: "Department", entityId: deptProduct.id, metadata: { code: "PRD" } },
        { user: admin, action: "CREATE_DEPARTMENT", entity: "Department", entityId: deptOperations.id, metadata: { code: "OPS" } },
        { user: mgrEng, action: "CREATE_TEAM", entity: "Team", entityId: teamCore.id, metadata: { lead: leadBackend.name } },
        { user: leadBackend, action: "ASSIGN_TASK", entity: "Task", entityId: "task-001", metadata: { assignee: dev1.name } },
        { user: dev1, action: "CLOCK_IN", entity: "Attendance", entityId: "att-today", metadata: { mode: "Office" } },
        { user: mgrEng, action: "APPROVE_LEAVE", entity: "LeaveRequest", entityId: "leave-001", metadata: { days: 5 } },
        { user: admin, action: "APPROVE_PAYROLL", entity: "Payroll", entityId: "payroll-001", metadata: { employee: dev1.name, net: 9400 } },
        { user: admin, action: "UPLOAD_DOCUMENT", entity: "Document", entityId: "doc-001", metadata: { title: "Employee Handbook" } }
    ];

    for (const evt of auditEvents) {
        await prisma.auditLog.create({
            data: {
                userId: evt.user.id,
                action: evt.action,
                entity: evt.entity,
                entityId: evt.entityId,
                metadata: evt.metadata,
                ipAddress: "127.0.0.1"
            }
        });
    }

    // 17. In-App Notifications
    console.log("Seeding In-App Notifications...");
    await prisma.notification.create({
        data: {
            userId: dev1.id,
            type: "TASK_ASSIGNED",
            message: "You have been assigned to 'Migrate Core Database to PostgreSQL Cluster'.",
            isRead: true
        }
    });

    await prisma.notification.create({
        data: {
            userId: dev1.id,
            type: "LEAVE_APPROVED",
            message: "Your Annual Leave application for Aug 10 - Aug 14 has been approved by Marcus Brody.",
            isRead: false
        }
    });

    await prisma.notification.create({
        data: {
            userId: leadBackend.id,
            type: "TASK_SUBMITTED",
            message: "Jordan Lee has submitted 'Migrate Core Database to PostgreSQL Cluster' for supervisor review.",
            isRead: false
        }
    });

    await prisma.notification.create({
        data: {
            userId: admin.id,
            type: "ANNOUNCEMENT",
            message: "All-Hands Quarterly Strategy Meeting scheduled for next Tuesday at 10:00 AM UTC.",
            isRead: false
        }
    });

    console.log("=================================================");
    console.log("✔ SEEDING COMPLETED SUCCESSFULLY!");
    console.log("-------------------------------------------------");
    console.log("Organization:", org.name);
    console.log("Departments: 3 (Engineering, Product, Operations)");
    console.log("Teams: 6 teams across 3 departments");
    console.log("Total Workforce: 28 accounts (1 Admin, 3 Managers, 6 Leads, 18 Employees)");
    console.log("Password for all accounts: password123");
    console.log("-------------------------------------------------");
    console.log("Demo Credentials:");
    console.log(" - Admin: admin@taskbot.com");
    console.log(" - Engineering Manager: manager.eng@taskbot.com");
    console.log(" - Backend Team Lead: lead.backend@taskbot.com");
    console.log(" - Senior Backend Dev: emp.dev1@taskbot.com");
    console.log("=================================================");
}

main()
    .catch((e) => {
        console.error("Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
