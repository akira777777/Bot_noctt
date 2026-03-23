# Bot Noct Runbook

## Purpose

Operational steps for safe deploy, quick incident triage, rollback, and data recovery.

## Environments

- **Local**: developer machine (`npm start`).
- **Render**: production deployment via `render.yaml`.

## Standard Deployment

1. Ensure quality gates pass locally:
   - `npm run test:coverage`
   - `npm run build:web`
   - `npm run smoke:api`
2. Deploy to Render (Blueprint or connected branch).
3. Confirm service is healthy:
   - `GET /healthz` returns `200` and `{ ok: true }`.
4. Perform Telegram smoke:
   - admin `/start`
   - open mini app
   - create one lead and confirm admin notification.

## Post-Deploy Smoke Checklist

- API:
  - `/api/admin/me` works with valid init-data.
  - `/api/leads` returns list for admin.
- Bot:
  - client can open menu and send message to manager.
  - lead flow reaches `confirm` and successfully creates a lead.
- Observability:
  - request logs include `requestId`, status, and duration.

## Incident Triage

1. Check Render deploy status and recent logs.
2. Check `/healthz`.
3. If API is failing:
   - look for `unhandled_http_error` log entries with `requestId`.
   - identify failing route and payload.
4. If bot is failing:
   - inspect `Unhandled bot error` and lead/action callback logs.
5. If issue is active and user-facing, rollback immediately.

## Rollback Procedure

1. In Render, open the latest successful deployment before the incident.
2. Rollback to that deployment.
3. Re-check:
   - `/healthz`
   - Telegram `/start`
   - one lead creation path.
4. Record incident summary and root cause in team notes.

## Data Backup and Restore Drill

### Create backup

- `npm run backup`

### Verify backup integrity

- `npm run restore-check`

### Recovery drill (staging/local)

1. Stop app.
2. Replace DB with backup copy.
3. Start app.
4. Validate:
   - `/dialogs` shows historical conversations.
   - `/leads` shows expected lead statuses.

## Escalation Guidance

- **P1**: service unavailable, cannot create leads, admin cannot access API.
- **P2**: degraded behavior in one flow (for example callback actions failing).
- **P3**: non-blocking UI or formatting issues.

For P1/P2:

- rollback first, investigate second.
- include failing `requestId` and timestamp in escalation message.
