# EVCSIMS User Manual

**EV Charging Station Intelligent Management System**
Simple Charge · Kigali, Rwanda
Version 1.0 · May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Roles and Permissions](#2-roles-and-permissions)
3. [Getting Started — Logging In](#3-getting-started--logging-in)
4. [Dashboard — Live Charger Status](#4-dashboard--live-charger-status)
5. [Starting a Charging Session](#5-starting-a-charging-session)
6. [Stopping a Charging Session](#6-stopping-a-charging-session)
7. [Sessions — History and Filtering](#7-sessions--history-and-filtering)
8. [Invoices — Generating and Downloading PDFs](#8-invoices--generating-and-downloading-pdfs)
9. [Operators — User Management](#9-operators--user-management)
10. [Allocations — kWh Quota Management](#10-allocations--kwh-quota-management)
11. [Reports](#11-reports)
12. [Signing Out](#12-signing-out)
13. [Charger Status Reference](#13-charger-status-reference)
14. [Troubleshooting](#14-troubleshooting)
15. [Quick Reference Card](#15-quick-reference-card)

---

## 1. System Overview

EVCSIMS is the management software for two DC fast-chargers installed at Simple Charge, Kigali. It connects to the chargers in real time using the OCPP 1.6J protocol and lets operators start and stop charging sessions, track energy consumption, manage agent quotas, and produce invoices — all from a web browser.

**Hardware managed:**

| Unit | Serial Number | Location |
|------|--------------|----------|
| Charger 1 — Bay A (`KIGALI-DC160-001`) | 20251218007 | Simple Charge, Kigali |
| Charger 2 — Bay B (`KIGALI-DC160-002`) | 20251218008 | Simple Charge, Kigali |

Each charger has two connector guns (Gun A and Gun B), giving four charging points in total.

**Access the system at:** `http://localhost:5173` (development) or your configured domain in production.

---

## 2. Roles and Permissions

Every user account is assigned one of three roles. The role controls which pages and actions are available.

| Feature | Admin | Accountant | Agent |
|---------|:-----:|:----------:|:-----:|
| Live dashboard | Yes | Yes | Yes |
| Start / stop sessions | Yes | — | Yes (own quota only) |
| View all sessions | Yes | Yes | Own sessions only |
| Generate invoices | Yes | Yes | Own sessions only |
| Download PDF invoices | Yes | Yes | Own sessions only |
| View all reports | Yes | Yes | — |
| Manage operators | Yes | — | — |
| Manage kWh allocations | Yes | — | — |

> **Admin** is the only role that can create new users and assign kWh quotas. There should always be at least one active admin account.

---

## 3. Getting Started — Logging In

1. Open a web browser and go to the system URL.
2. Enter your **email address** and **password**.
3. Click **Sign In**.

If your credentials are correct you are taken directly to the Dashboard. The token is stored in your browser and remains valid for 8 hours. After 8 hours you will be redirected to the login page automatically.

**Default admin account (first-time setup only):**

| Email | Password |
|-------|----------|
| `admin@simplecharge.rw` | `Admin@1234` |

> Change the default password immediately after first login. Ask your system administrator to update it via the Operators page.

---

## 4. Dashboard — Live Charger Status

The Dashboard is the main operational view. It refreshes automatically every 15 seconds.

### Layout

```
┌─────────────────────────────────────────────┐
│  Summary metrics row (sessions / kWh / FRW) │
├────────────────────┬────────────────────────┤
│  Charger 1 — Bay A │  Charger 2 — Bay B     │
│  ┌─────────────┐   │  ┌─────────────┐       │
│  │ Gun A  ●    │   │  │ Gun A  ●    │       │
│  │ Gun B  ●    │   │  │ Gun B  ●    │       │
│  └─────────────┘   │  └─────────────┘       │
└────────────────────┴────────────────────────┘
```

### Summary Metrics

Four figures shown at the top of the Dashboard:

- **Sessions This Month** — total completed sessions in the current calendar month.
- **Total Energy Sold** — kWh delivered this month.
- **Total Revenue** — RWF collected this month.
- **Online Chargers** — number of charger units currently registered.

### Charger Card

Each charger card shows:

- **Charger name and ID** (e.g., `Charger 1 — Bay A · KIGALI-DC160-001`)
- **Last heartbeat timestamp** — the last time the charger communicated with the server. If this is more than 2 minutes ago the charger may have lost connectivity.
- **Gun A and Gun B rows**, each with:
  - A coloured status indicator dot (see [Section 13](#13-charger-status-reference))
  - The current status label
  - Live kWh, FRW, and elapsed time when a session is active
  - **Start** or **Stop** button depending on the current state

---

## 5. Starting a Charging Session

Sessions can only be started from the Dashboard. A session requires an agent with sufficient kWh quota.

**Steps:**

1. On the Dashboard, locate the correct charger and gun.
2. Confirm the gun status shows **Available**.
3. Click the **Start** button next to the gun.
4. A modal dialog opens:

   | Field | Description |
   |-------|-------------|
   | **Operator / Agent** | Select the agent whose quota will be charged |
   | **Budget (RWF)** | Optional. The session will auto-stop when this amount is reached. Leave blank for no limit. |

5. Click **Start Charging**.
6. The system sends a `RemoteStartTransaction` command to the charger. Within a few seconds the gun status changes to **Preparing**, then **Charging**.
7. The live counter (kWh · FRW · elapsed time) appears on the card and updates every 30 seconds.

**What can go wrong:**

| Message | Cause | Action |
|---------|-------|--------|
| `Insufficient kWh quota` | The selected agent has zero remaining kWh | Add an allocation for the agent first (see Section 10) |
| `Charger rejected start command` | Charger returned a non-Accepted status | Check the charger's physical state; try again |
| `Charger not connected` | No OCPP connection to that charger | Check charger power and 4G signal; check Last Heartbeat |

---

## 6. Stopping a Charging Session

1. On the Dashboard, find the gun showing status **Charging**.
2. Click the **Stop** button.
3. The system sends a `RemoteStopTransaction` command to the charger.
4. The charger finalises the meter reading, sends a `StopTransaction` message, and the session is marked **completed**.
5. The gun status returns to **Available**.

The final kWh consumed and total cost in RWF are stored in the session record and are ready for invoicing.

> **Automatic stop:** If a budget was set when starting the session, the system monitors meter values in real time and triggers a remote stop automatically when the FRW threshold is reached.

---

## 7. Sessions — History and Filtering

The **Sessions** page shows a paginated table of all charging sessions.

### Columns

| Column | Description |
|--------|-------------|
| ID | Internal session ID |
| Charger | Charger unit ID |
| Gun | A or B |
| Operator | Agent who ran the session |
| Start | Session start time |
| End | Session end time (blank if still active) |
| kWh | Energy delivered |
| FRW | Cost charged |
| Status | pending / active / completed / faulted |

### Filtering

Use the filter row above the table to narrow results:

- **From / To** — filter by session start date (date picker)
- **Charger** — type a charger ID, e.g. `KIGALI-DC160-001`
- **Status** — drop-down: All / Active / Completed / Pending / Faulted

Filters apply immediately. The page resets to page 1 when any filter changes.

### Access rules

- **Agents** see only their own sessions.
- **Admins and Accountants** see all sessions.

### Printing an Invoice

On any **completed** session row, click the **Invoice** button. A dialog asks for the customer name (default: "Walk-in Customer"). Click **Generate & Download PDF** to create the invoice PDF and open it in a new browser tab.

---

## 8. Invoices — Generating and Downloading PDFs

The **Invoices** page lists every invoice that has been generated.

### Columns

| Column | Description |
|--------|-------------|
| Invoice # | Zero-padded invoice number, e.g. `#000003` |
| Session | Linked session ID |
| Customer | Customer name on the invoice |
| Operator | Agent who ran the session |
| Date | Invoice creation date |
| kWh | Energy billed |
| Total (RWF) | Amount billed |

Click the **PDF** button on any row to download or open the invoice PDF.

### Invoice content

Each PDF invoice includes:

- Simple Charge header and location
- Invoice number and date
- Session details (charger, gun, start/end time)
- Operator name and customer name
- Energy consumed (kWh)
- Price per kWh (RWF)
- **Total amount in RWF**
- Thank-you footer

PDFs are stored on the server at `uploads/invoices/` and are always available for re-download.

> **Note:** An invoice can only be generated for a session with status **completed**. Active or pending sessions do not appear as invoiceable.

---

## 9. Operators — User Management

_Admin only._

The **Operators** page lists all user accounts and lets you create or deactivate them.

### Viewing operators

Each row shows:
- Avatar initial, full name, and email
- Role badge (colour-coded: blue = admin, green = agent, amber = accountant)
- **Inactive** badge if the account is deactivated

### Adding an operator

1. Click **+ Add Operator**.
2. Fill in the form:

   | Field | Notes |
   |-------|-------|
   | Full Name | Display name shown throughout the system |
   | Email | Must be unique. Used to log in. |
   | Password | Minimum security: use a strong password |
   | Role | `admin`, `agent`, or `accountant` |

3. Click **Create Operator**.

The new user can log in immediately.

### Activating / Deactivating

Click the **Deactivate** button next to a user to prevent them from logging in. Their historical session data is preserved. Click **Activate** to restore access.

> You cannot deactivate your own account while logged in.

---

## 10. Allocations — kWh Quota Management

_Admin only._

Each agent must have an **allocation** before they can start a charging session. An allocation records the amount of kWh purchased for that agent, the price per kWh, and tracks how much has been used.

### Reading the allocation cards

Each card shows:

```
Agent Name                          145.000 kWh left
agent@example.com                   350 RWF/kWh

[████████████░░░░░░░░░] 62%

Assigned: 380.000 kWh   Used: 235.000 kWh   Value remaining: 50,750 RWF
```

The progress bar colour changes to indicate urgency:
- **Green** — less than 60 % used
- **Amber** — 60–90 % used
- **Red** — over 90 % used

### Adding an allocation (top-up)

1. Click **+ Add Allocation**.
2. Select the agent from the drop-down.
3. Enter **kWh to Allocate** (e.g., `100`).
4. Enter **Price per kWh (RWF)** (default: 350).
5. Click **Allocate kWh**.

The kWh is added to the agent's quota and a purchase entry is written to the inventory log.

> **Important:** Each allocation is a separate record (like a top-up voucher). The "remaining" figure shown on the card is the sum across all allocations for that agent. The price per kWh is set per allocation, so you can change the rate on new top-ups without affecting existing balance.

---

## 11. Reports

_Admin and Accountant only._

The Reports page has two tabs.

### Monthly Sales

Use the **Year**, **Month**, and optional **Agent** filters to generate a summary for any calendar month.

**Summary cards** show:
- Total sessions in the period
- Total kWh sold
- Total revenue in RWF

**Daily bar chart** — energy (kWh) and session count by day of month. Useful for identifying peak usage days.

**Per-agent breakdown table** — sessions, kWh, and revenue for each agent in the selected period, sorted by highest revenue.

### Inventory

Provides a real-time stock summary across all purchase and sale transactions.

| Panel | Description |
|-------|-------------|
| **Total Purchased** | kWh bought in total, and total RWF paid |
| **Total Sold** | kWh delivered to vehicles, and total RWF earned |
| **Remaining Stock** | kWh not yet delivered, and its RWF value at average purchase price |

Below the summary, the **Recent Transactions** table shows the last 100 inventory entries — both purchases (allocation top-ups) and sales (completed sessions).

---

## 12. Signing Out

Click **Sign Out** at the bottom of the left sidebar. You are redirected to the login page and your session token is removed from the browser. Anyone sharing your device will need your password to log back in.

---

## 13. Charger Status Reference

| Status | Colour | Meaning |
|--------|--------|---------|
| **Available** | Green | Gun is ready and waiting for a session to start |
| **Preparing** | Blue | Session has been initiated; charger is setting up |
| **Charging** | Amber (pulsing) | Vehicle is actively charging |
| **Finishing** | Purple | Session is ending; final meter reading being taken |
| **Reserved** | Purple | Gun is reserved (not used in Phase 1) |
| **Unavailable** | Gray | Gun is offline or disabled on the charger |
| **Faulted** | Red | Charger has reported an error condition |

If a charger shows **Unavailable** and was previously working, check:
1. The **Last Heartbeat** timestamp on the card. More than 5 minutes without a heartbeat means connectivity is lost.
2. The charger's 4G SIM card APN setting (must be set to the correct Rwanda operator APN).
3. Power supply to the charger unit.

---

## 14. Troubleshooting

### Cannot log in

- Verify the email address is correct (case-insensitive).
- Check Caps Lock is not on.
- Ask an admin to verify the account is **active** on the Operators page.
- If you are locked out of all admin accounts, contact the system administrator to re-run `npm run db:seed` (this re-creates the default admin).

### Dashboard shows both chargers as Unavailable

The chargers are not connected to the OCPP server. Possible causes:
- The backend server is not running.
- The charger's configured OCPP URL does not match the server address.
- The charger's 4G SIM has no data connectivity.

### "Insufficient kWh quota" when starting a session

The selected agent has no remaining kWh. An admin must add an allocation on the **Allocations** page before the session can proceed.

### "Charger not connected" when starting or stopping

The OCPP WebSocket connection to that charger is not active. The charger will appear as Unavailable on the dashboard. Check network and charger power.

### Session stays "active" after stopping

If `RemoteStopTransaction` was sent but the charger did not respond with `StopTransaction` (e.g., connectivity was lost), the session remains active in the database. Contact the system administrator to manually close it via a direct database update.

### Invoice PDF does not open

- Check your browser is not blocking pop-ups (the PDF opens in a new tab).
- Confirm the session status is **completed** — invoices cannot be generated for active sessions.
- Verify the `uploads/invoices/` directory is writable on the server.

### Live kWh counter is not updating

The live counter polls `/api/sessions/live` every 30 seconds. If it is frozen:
- The charger may not be sending `MeterValues` messages. This is a charger configuration setting (`MeterValueSampleInterval`).
- Check the browser console for network errors.

---

## 15. Quick Reference Card

| Task | Where | Who |
|------|-------|-----|
| Log in | `/login` | All |
| See live charger status | Dashboard | All |
| Start a charging session | Dashboard → Gun row → **Start** | Admin, Agent |
| Stop a charging session | Dashboard → Gun row → **Stop** | Admin, Agent |
| View session history | Sessions page | All (agents: own only) |
| Generate invoice PDF | Sessions page → **Invoice** | All (agents: own only) |
| Download saved invoice | Invoices page → **PDF** | All (agents: own only) |
| Add a new user | Operators page → **+ Add Operator** | Admin |
| Deactivate a user | Operators page → **Deactivate** | Admin |
| Top up agent's kWh quota | Allocations page → **+ Add Allocation** | Admin |
| View monthly revenue | Reports → Monthly Sales | Admin, Accountant |
| View inventory balance | Reports → Inventory | Admin, Accountant |
| Sign out | Sidebar → **Sign Out** | All |

---

_EVCSIMS User Manual · Simple Charge, Kigali, Rwanda · May 2026_
_For technical support contact your system administrator._
