---
description: Assistant chat, risk prediction, smart assignment, plain-language reports, review drafting, anomaly flags
---
# Phase 7: advanced AI

Requires Phase 4. Re-read the "AI guardrails" in `docs/ROADMAP.md`; they are strict for this phase. Write an implementation plan first and wait for approval.

## Steps

1. **Assistant chat.** Conversational panel with tools (from Phase 4): "how many leave days do I have?", "what is overdue for my team?", "apply for leave next Friday" (produces a proposal). Policy Q&A grounded in permitted documents with citations to the source document and section. Conversation history stored per user, deletable.
2. **Deadline risk.** Score each open task from progress, elapsed time versus estimate, dependencies, assignee load and leave. Show a reason ("2 blocked dependencies, assignee on leave for 3 of 5 days"). Start with transparent rules, add a model only if it clearly beats them on your own data.
3. **Smart assignment.** Suggest up to three assignees with reasons (skills from past tasks, current workload, leave). The manager decides. Never auto-assign.
4. **Workload signals.** Aggregated overtime and load trends for managers, shown as team-level insight first; individual views need explicit policy and are off by default.
5. **Plain-language reports.** "Overdue tasks by team last month" is translated into a **fixed, validated report query** (allow-listed fields and filters), never raw SQL. Show the interpreted filters so the user can correct them.
6. **Review drafting.** Draft comments from goals and the reviewer's own notes. No numeric rating, ranking or recommendation on pay or termination. The reviewer edits and owns the text; label AI-assisted text.
7. **Anomaly flags.** Attendance, audit-log and payroll anomalies surfaced to admins with evidence and a "dismiss with reason" flow. A flag is a prompt to look, never an accusation.
8. **Governance.** Admin page: what data each feature uses, usage, cost, feedback, and switches. Document how to explain these features to employees; local law may require notice or consent.

## Acceptance criteria

Bias and fairness review notes for every feature touching people data; evals with golden cases; tests that no feature outputs ratings or employment decisions; permission and injection tests; all calls audited and budget-capped. Run `/verify-phase`.
