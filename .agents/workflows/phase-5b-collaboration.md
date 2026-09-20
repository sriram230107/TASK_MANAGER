---
description: Collaboration suite (company feed, chat, shared calendar and room booking, approvals, knowledge base)
---
# Phase 5b: collaboration suite

Requires Phase 3 (real-time, jobs, storage adapter, notifications) and the Phase 2 design system.
Every module is switchable per organization and respects the department and hierarchy visibility rules.
Read `AGENTS.md`. Write an implementation plan first and wait for approval.

## Steps

1. **Company feed.** Posts, announcements (pinned, with optional "acknowledge"), polls, appreciation posts, reactions, comments, @mentions, attachments. Audience by everyone, department, team or selected people.
   Admin and managers publish company-wide; permissions per role. Unread badge and email digest (behind `config.emailEnabled`).
2. **Chat.** Direct messages, group chats and department channels over the Phase 3 real-time layer. Threads, attachments (storage adapter), read receipts, typing indicator, search,
   message edit and delete with audit, mute, unread counts. Retention setting per organization. Users only see conversations they belong to; admins cannot read private chats.
   Link a chat to a task or project.
3. **Shared calendar and resources.** Personal, team and company calendars with leave, holidays and deadlines overlaid. Meeting-room and equipment booking with conflict prevention,
   capacity, and optional approval. Invitations with accept or decline. iCal feed export. Timezone-correct.
4. **Approvals.** A configurable approval engine: request types (expense, purchase, equipment, travel, general), form fields per type, ordered approvers (manager, department head, role, named person),
   parallel or sequential steps, delegate when away, reminders and escalation, full audit. Leave keeps using its own flow. Attachments and comments on requests.
5. **Knowledge base.** Spaces and pages (rich text with versions), templates, search (semantic search once Phase 4 exists), page-level access, "was this helpful", owner and review-by dates.
6. **Notifications.** All modules feed the one notification center with per-user preferences (in-app, email, push later) and quiet hours.
7. **Feature switches and navigation.** Each module can be turned off in settings; API and menus respect it.

## Acceptance criteria

Permission and audience tests per role; private chats unreadable by others including admins; booking conflicts impossible under concurrent requests (test it); approval routing tested for
sequential, parallel, delegation and rejection; real-time verified with two browser sessions; no cross-organization leakage; modules off hides everything. Run `/verify-phase`.
