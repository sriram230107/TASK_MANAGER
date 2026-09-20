# Email and AI setup: what you need

Both are **optional and off by default**. The portal runs fully without them. When they are off, the
features that depend on them are hidden or fall back (for example, admins can copy an invitation link instead of emailing it).

---

## 1. Email

### What email is used for

Employee invitations (so admins never know anyone's password), password reset, task and leave
notifications, daily and weekly digests, and security alerts such as sign-in from a new device.

### What you need to provide

| Item | Notes |
|---|---|
| An SMTP account | Host, port, username, password (or API key) from an email provider |
| A "from" address on a domain you control | For example `portal@yourcompany.com` |
| DNS records for that domain | **SPF, DKIM and DMARC**. Without them, messages usually land in spam |

### Settings

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587            # 587 = STARTTLS (SMTP_SECURE=false), 465 = implicit TLS (SMTP_SECURE=true)
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="Your Company Portal <portal@yourcompany.com>"
```

### Which provider

| Option | Good for | Watch out for |
|---|---|---|
| Transactional service (Amazon SES, Postmark, SendGrid, Mailgun, Brevo, Resend) | **Best default.** Built for automated mail, good deliverability, cheap at portal volumes | Verify your domain first |
| Microsoft 365 or Google Workspace SMTP | Companies that already use them and want mail sent from a real mailbox | Sending limits apply, and modern authentication or app passwords may be required. Confirm current rules with your admin |
| Your own mail server | Full control | You own deliverability and blocklists |
| Personal Gmail or free mailboxes | Do not use | Blocked or limited quickly, unprofessional sender |

### Testing without sending real mail

```
docker compose --profile dev up -d      # starts Mailpit, a fake inbox
# then set SMTP_HOST=mailpit  SMTP_PORT=1025  MAIL_FROM=portal@example.com
# open http://localhost:8025 to see every message the portal "sends"
```

---

## 2. AI provider

### What AI is used for

Natural-language task creation, task breakdown, summaries and digests, semantic search, an assistant
for policy questions, and (later) risk prediction and suggestions. The full list and the safety rules are in `docs/ROADMAP.md`.

### What you need to decide

1. **Provider** (below)
2. **What data may be sent** to it (default: tasks and comments only; payroll, salary, confidential documents and performance reviews are excluded unless an admin turns them on per feature)
3. **A monthly budget**, and who may use AI features
4. **Notice to employees**, if your local privacy law requires it (for example GDPR or India's DPDP Act). Ask your legal or HR team

### Provider options

| Option | Setup | Best for |
|---|---|---|
| **Anthropic API (Claude), direct** | Create an account and API key at console.anthropic.com. Set a spend limit there too | Simplest, and the planned default |
| Claude through your existing cloud agreement (for example AWS Bedrock or Google Vertex AI) | Needs a different connector than the direct one | Companies whose data must stay inside a cloud they already contract |
| **Self-hosted or any OpenAI-compatible endpoint** (Ollama, vLLM, others) | Set `AI_PROVIDER=openai_compatible` and `AI_BASE_URL` | Strict data-residency, nothing leaves your network. Quality depends on the model |

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
AI_MODEL_FAST=claude-haiku-4-5-20251001     # cheap and quick: summaries, classification
AI_MODEL_SMART=claude-sonnet-5              # assistant and multi-step work
AI_MONTHLY_BUDGET_USD=50                    # the app stops calling AI when this is reached
```

Model names change over time. Confirm the current identifiers in the provider's documentation before deploying.

### Embeddings (for semantic search and duplicate detection)

Claude models do not produce embeddings, so search needs a **separate embeddings provider**. Anthropic's
documentation points to Voyage AI. You can also use an OpenAI-compatible or local model.

```
EMBEDDINGS_PROVIDER=voyage
EMBEDDINGS_API_KEY=...
EMBEDDINGS_MODEL=...
```

The database already runs the pgvector extension (the compose file uses the `pgvector/pgvector` image), so no extra database is needed.

### Cost and privacy checklist

- AI is billed per use by the provider. Set a spend limit in the provider console **and** `AI_MONTHLY_BUDGET_USD`.
- Read the provider's data retention and training terms before sending any employee data.
- Keep `AI_PROVIDER=none` until these decisions are made. Nothing else in the portal needs to change.
- The AI acts with the signed-in user's own permissions. It never sees more than that person can already see, and every AI action is written to the audit log.
