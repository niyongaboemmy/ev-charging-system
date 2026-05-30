# EVCSIMS User Manual

**EV Charging Station Intelligent Management System**
Simple Charge · Kigali, Rwanda
Version 1.1 · May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Roles and Permissions](#2-roles-and-permissions)
3. [Getting Started — Logging In](#3-getting-started--logging-in)
4. [First-Time Setup Guide](#4-first-time-setup-guide)
5. [Dashboard — Live Charger Status](#5-dashboard--live-charger-status)
6. [Starting a Charging Session](#6-starting-a-charging-session)
7. [Stopping a Charging Session](#7-stopping-a-charging-session)
8. [Sessions — History and Filtering](#8-sessions--history-and-filtering)
9. [Invoices — Generating and Downloading PDFs](#9-invoices--generating-and-downloading-pdfs)
10. [Operators — User Management](#10-operators--user-management)
11. [Allocations — kWh Quota Management](#11-allocations--kwh-quota-management)
12. [Reports](#12-reports)
13. [Settings — Connecting Charger Machines](#13-settings--connecting-charger-machines)
14. [Signing Out](#14-signing-out)
15. [Charger Status Reference](#15-charger-status-reference)
16. [Troubleshooting](#16-troubleshooting)
17. [Quick Reference Card](#17-quick-reference-card)

---

## 1. System Overview

EVCSIMS is the management software for DC fast-chargers at Simple Charge, Kigali. It connects to chargers in real time using the OCPP 1.6J protocol over WebSocket, and lets operators start and stop charging sessions, track energy consumption, manage agent quotas, and produce invoices — all from a web browser.

**How the system is structured:**

```
Physical Charger  →  (OCPP WebSocket :8887)  →  This Server  →  Dashboard
   Hardware                                      Backend               Browser
```

- The **backend server** runs on a computer on-site and listens for charger connections on port 8887.
- Each **physical charger machine** is configured with the server's IP address and connects automatically on power-up.
- The **dashboard** (this browser app) communicates with the backend over a REST API on port 3001.

**Default hardware managed:**

| Unit | ID | Guns | Serial Number |
|------|----|------|--------------|
| Charger 1 — Bay A | `KIGALI-DC160-001` | A + B | 20251218007 |
| Charger 2 — Bay B | `KIGALI-DC160-002` | A + B | 20251218008 |

You can register additional charger machines at any time through the Settings page.

**Access the system at:** `http://localhost:5173` (development) or your configured domain in production.

---

## 2. Roles and Permissions

Every user account is assigned one of three roles. The role controls which pages and actions are available.

| Feature | Admin | Accountant | Agent |
|---------|:-----:|:----------:|:-----:|
| Live dashboard | ✓ | ✓ | ✓ |
| Setup guide | ✓ | ✓ | ✓ |
| Help & manual | ✓ | ✓ | ✓ |
| Start / stop sessions | ✓ | — | ✓ (own quota) |
| View all sessions | ✓ | ✓ | Own only |
| Generate invoices | ✓ | ✓ | Own only |
| Download PDF invoices | ✓ | ✓ | Own only |
| View all reports | ✓ | ✓ | — |
| Manage operators | ✓ | — | — |
| Manage kWh allocations | ✓ | — | — |
| Settings (charger config) | ✓ | — | — |

> **Admin** is the only role that can register charger machines, create users, and assign kWh quotas. Always keep at least one active admin account.

---

## 3. Getting Started — Logging In

1. Open a web browser and go to the system URL.
2. Enter your **email address** and **password**.
3. Click **Sign In**.

You are taken directly to the Dashboard. The login token is stored in your browser and remains valid for **8 hours**. After that you are automatically redirected to the login page.

**Default admin account (first-time setup only):**

| Email | Password |
|-------|----------|
| `admin@simplecharge.rw` | `Admin@1234` |

> ⚠️ **Change the default password immediately** after first login. Go to **Operators**, find the Admin account, click **Edit**, and set a strong new password. The default credential is publicly known.

---

## 4. First-Time Setup Guide

When you log in for the first time the Dashboard shows a **Getting Started** panel that walks you through six steps. Each step is detected automatically — as you complete tasks, the step turns green and the next step becomes active.

| Step | What to do | Detected by |
|------|-----------|-------------|
| 1 | System is running | Always complete |
| 2 | Configure charger OCPP URL | At least one charger has a server IP saved in Settings |
| 3 | Create an agent account | At least one active user with role = agent |
| 4 | Allocate kWh quota to agent | At least one allocation record exists |
| 5 | Connect the charger hardware | At least one charger shows Online |
| 6 | Start your first session | At least one session has been created |

Each step expands to show numbered instructions and a direct navigation button (e.g., "Go to Settings →"). The guide re-checks every 15 seconds.

Once all six steps are complete, the panel transforms into a **Quick Reference** tile grid showing daily operations tips. You can collapse or dismiss the guide at any time using the button in the top-right of the panel.

---

## 5. Dashboard — Live Charger Status

The Dashboard is the primary operational view. It auto-refreshes every 15 seconds.

### Summary Metrics

Four figures at the top of the page:

| Metric | Description |
|--------|-------------|
| **Sessions This Month** | Total completed charging sessions in the current calendar month |
| **Total Energy Sold** | kWh delivered to vehicles this month |
| **Total Revenue** | RWF collected this month |
| **Online Chargers** | `X / Y` — chargers currently connected out of total registered |

### Charger Card

One card is shown per physical charger machine. Each card displays:

- **Name, ID, and location** of the charger machine
- **Online / Offline badge** — green dot if connected, red "Offline" badge if not
- **Last heartbeat** — shown as relative time ("Just now", "2m ago", "12m ago"). Turns **red** when more than 3 minutes have passed — this indicates a connectivity problem.
- **Offline warning banner** — appears when the charger has lost its OCPP connection. Sessions cannot be started until it reconnects.
- **Gun A and Gun B rows**, each showing:
  - Coloured status dot (see Section 15)
  - Current status label
  - Live kWh, RWF, elapsed time, and operator name when a session is active
  - **Start** button (only when gun is `Available` and charger is Online)
  - **Stop** button (only when gun is `Charging`)
  - Reason label when neither button is shown (e.g., "Charger offline", "Gun unavailable")

---

## 6. Starting a Charging Session

Sessions are started from the Dashboard. The **Start** button only appears when the gun status is **Available** and the charger is **Online**.

**Steps:**

1. On the Dashboard, find a charger card with an **Online** indicator.
2. Locate a gun showing **Available** (green dot).
3. Click **Start**.
4. Fill in the modal:

   | Field | Description |
   |-------|-------------|
   | **Operator / Agent** | Select the agent whose kWh quota will be used |
   | **Budget (RWF)** | Optional spending limit. Session stops automatically when reached. |

5. Click **Start Charging**.
6. The gun status changes: **Available → Preparing → Charging** (amber, pulsing).
7. A live counter appears showing **kWh · RWF · elapsed time**, updating every 30 seconds.

**Possible errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Insufficient kWh quota` | Agent has zero kWh remaining | Add an allocation — Section 11 |
| `Charger rejected start command` | Charger hardware declined | Check physical state of the charger |
| `Charger not connected` | No OCPP connection | Go to Settings and verify OCPP URL |

---

## 7. Stopping a Charging Session

1. On the Dashboard, find the gun showing **Charging** (amber, pulsing).
2. Click **Stop**.
3. The system sends `RemoteStopTransaction` to the charger.
4. The charger finalises the meter reading and sends `StopTransaction` back.
5. The session is marked **completed** and the gun returns to **Available**.

The final kWh and RWF values are saved and the session is ready for invoicing.

> **Automatic stop:** If a budget (RWF) was set at start, the system checks meter values every 5 seconds and triggers a remote stop when the budget is reached.

---

## 8. Sessions — History and Filtering

The **Sessions** page shows a paginated table of all charging sessions.

### Columns

| Column | Description |
|--------|-------------|
| ID | Internal session ID |
| Charger | Charger unit ID |
| Gun | A or B |
| Operator | Agent who ran the session |
| Start | Session start time |
| End | End time (blank if still active) |
| kWh | Energy delivered |
| FRW | Cost charged |
| Status | `pending` / `active` / `completed` / `faulted` |

### Filters

- **From / To** — filter by session start date
- **Charger** — type a charger ID (e.g. `KIGALI-DC160-001`)
- **Status** — All / Active / Completed / Pending / Faulted

Pagination: 50 rows per page. Arrows appear at the bottom when there are multiple pages.

### Access rules

- **Agents** see only their own sessions.
- **Admins and Accountants** see all sessions.

### Generating an Invoice

On any **completed** row, click **Invoice**. Enter the customer name (default: "Walk-in Customer") and click **Generate & Download PDF**.

---

## 9. Invoices — Generating and Downloading PDFs

The **Invoices** page lists every invoice that has been generated.

### Columns

| Column | Description |
|--------|-------------|
| Invoice # | Zero-padded number, e.g. `#000003` |
| Session | Linked session ID |
| Customer | Customer name on the invoice |
| Operator | Agent who ran the session |
| Date | Invoice creation date |
| kWh | Energy billed |
| Total (RWF) | Amount billed |

Click **PDF** on any row to open or download the invoice.

### What is on each PDF invoice

- Simple Charge header and Kigali location
- Invoice number and date
- Charger ID, gun letter, start and end time
- Operator name and customer name
- Energy consumed (kWh), price per kWh (RWF)
- **Total amount in RWF**

PDFs are stored on the server at `uploads/invoices/` and can always be re-downloaded.

> Invoices can only be generated for sessions with status **completed**.

---

## 10. Operators — User Management

_Admin only._

The **Operators** page lists all user accounts and lets you create or deactivate them.

### User card

Each user card shows: avatar initial · full name · email · role badge · Inactive badge (if deactivated).

Role badge colours: **blue** = admin · **green** = agent · **amber** = accountant.

### Adding an operator

1. Click **+ Add Operator**.
2. Fill in: Full Name, Email, Password, Role.
3. Click **Create Operator** — the user can log in immediately.

### Activating / Deactivating

Click **Deactivate** to prevent login (data is preserved). Click **Activate** to restore access.

> You cannot deactivate your own account.

---

## 11. Allocations — kWh Quota Management

_Admin only._

Each agent must have at least one **allocation** before they can start a session. An allocation records kWh purchased, price per kWh, and tracks usage.

### Reading allocation cards

```
Agent Name                         145.000 kWh left  350 RWF/kWh
agent@simplecharge.rw

[████████████░░░░░░░░░] 62%

Assigned: 380.000 kWh   Used: 235.000 kWh   Value remaining: 50,750 RWF
```

Progress bar colour: **green** < 60% · **amber** 60–90% · **red** > 90%.

### Adding an allocation (top-up)

1. Click **+ Add Allocation**.
2. Select the agent.
3. Enter **kWh to Allocate** and **Price per kWh (RWF)** (default 350).
4. Click **Allocate kWh**.

A purchase entry is written to the inventory log automatically.

> Each allocation is a separate record. New top-ups can use a different price per kWh without changing the existing balance.

---

## 12. Reports

_Admin and Accountant only._

Two tabs: **Monthly Sales** and **Inventory**.

### Monthly Sales

Select year, month, and optionally an agent to see:
- Sessions count · total kWh · total revenue in RWF
- **Daily bar chart** — kWh and session count per day of month
- **Per-agent table** — sessions, kWh, revenue, sorted by revenue

### Inventory

Real-time stock summary:

| Row | Description |
|-----|-------------|
| Total Purchased | Sum of all allocation top-ups |
| Total Sold | Sum of all completed sessions |
| Remaining Stock | Purchased minus sold, valued at average purchase price |

The **Recent Transactions** table shows the last 100 inventory entries (both purchases and sales).

---

## 13. Settings — Connecting Charger Machines

_Admin only._

The Settings page has two parts, labelled **A** and **B**.

### Part A — This Server

Shows the status of the OCPP server running on this machine:
- **Status** — always "Running" if you can see this page
- **Port** — 8887 (the port chargers connect to)
- **Protocol** — `ws://` (plain) or `wss://` (TLS, for production)
- **Chargers online now** — IDs of chargers with a live WebSocket connection
- **This machine's IP address** — auto-detected from the network interface. Only physical WiFi/Ethernet IPs are shown as "Use this one". VPN tunnels are hidden by default with an explanation if expanded.

This IP is what you type into each charger's touchscreen.

### Part B — Your Physical Charger Machines

Each card = one physical charger box on-site. One machine can have 1 or 2 guns. You can register as many machines as you own.

**Stats bar** at the top: Total machines · Online now · Total charging points (guns).

**To register a new charger machine:**
1. Click **+ Register New Charger Machine**.
2. Fill in: Machine ID (must match what the charger sends), Display Name, Location, number of guns.
3. Under "How the charger connects": select connection type (LAN or 4G SIM), and pick the server IP from the dropdown (auto-populated from Part A).
4. The **OCPP URL is generated live** as you type — copy it.
5. Click **Register Charger**.

**On the charger card:**
- The **📱 Type this into the charger's touchscreen** section shows 6 numbered steps and the exact URL to paste into the charger's Back Office.
- Once the charger is configured and reboots, the card shows a green **Online** badge within 30 seconds.
- Click **Show technical details** to see port, protocol, APN, heartbeat interval, and last heartbeat timestamp.
- Click **Edit config** to change any setting.
- Click **Remove** to delete (blocked while the charger is online).

### The "How it works" panel

A collapsible panel at the top of Settings explains the full connection flow:

```
🔌 Physical Charger → (OCPP WebSocket) → 🖥 This Server → (REST API) → 📊 Dashboard
```

Part A = your side (the listener). Part B = the charger's side (must be told where to connect). The URL on each charger card is the bridge between them.

---

## 14. Signing Out

Click **Sign Out** at the bottom of the left sidebar. Your session token is removed from the browser and you are redirected to the login page.

---

## 15. Charger Status Reference

| Status | Colour | Start button? | Meaning |
|--------|--------|:-------------:|---------|
| **Available** | Green | ✓ Yes | Gun is ready — a session can be started |
| **Preparing** | Blue | — | Start command sent; charger is setting up |
| **Charging** | Amber (pulsing) | — | Vehicle is actively charging |
| **Finishing** | Purple | — | Session ending; final meter reading in progress |
| **Reserved** | Purple | — | Gun reserved (Phase 2 feature) |
| **Unavailable** | Gray | — | Gun offline or disabled on the charger |
| **Faulted** | Red | — | Charger has reported an error |

**The Start button only appears when:**
- The charger is **Online** (has an active OCPP connection), AND
- The gun status is exactly **Available**

For all other statuses a dimmed reason label replaces the button (e.g., "Charger offline", "Gun unavailable", "Gun faulted").

**Heartbeat display:** shown as relative time — "Just now", "2m ago". Turns **red** when > 3 minutes old, indicating a connectivity problem. "Never" means the charger has not connected since the server started.

---

## 16. Troubleshooting

### Cannot log in
- Check email spelling (not case-sensitive) and Caps Lock.
- Ask an admin to confirm the account is **active** on the Operators page.
- If locked out of all admin accounts, re-run `npm run db:seed` on the server to restore the default admin.

### Dashboard shows a charger as Offline
- The charger has lost its OCPP WebSocket connection.
- Check: charger power supply · 4G SIM connectivity · the OCPP URL configured on the charger's touchscreen (go to Settings to verify).
- The Last Heartbeat field turns red when > 3 minutes old.

### Start button is not showing on a gun
- The gun must be **Available** and the charger must be **Online**.
- If the charger is Offline the entire card shows a red warning banner.
- If the gun shows a different status (Unavailable, Faulted, etc.), a reason label appears instead of the button.

### "Insufficient kWh quota" when starting a session
The selected agent has zero remaining kWh. An admin must add a new allocation on the Allocations page.

### "Charger not connected" error
The OCPP WebSocket is not active for that charger. Verify the OCPP URL in Settings matches the server's current IP and port.

### Session stays "active" after stopping
If the charger lost connectivity before sending StopTransaction, the session stays open in the database. Contact the system administrator to close it manually.

### Invoice PDF does not open
- Browser may be blocking pop-ups — allow pop-ups for this site.
- Session must be **completed** before an invoice can be generated.
- Verify the `uploads/invoices/` directory is writable on the server.

### Live kWh counter is frozen
The charger may not be sending `MeterValues` messages. Check the `MeterValueSampleInterval` setting in the charger's back office. The counter also only updates every 30 seconds even when working normally.

### The Online Chargers metric shows wrong count
The metric shows `X / Y` — online / total registered. If it shows `0 / 2`, both chargers are offline. Check the OCPP server is running (`npm run dev` in the backend folder) and the chargers are configured with the correct OCPP URL.

---

## 17. Quick Reference Card

| Task | Page | Who |
|------|------|-----|
| First-time setup | Dashboard → Getting Started panel | Admin |
| **Change default password** | Operators → Admin → Edit | Admin |
| Start a session | Dashboard → Gun row → **Start** | Admin, Agent |
| Stop a session | Dashboard → Gun row → **Stop** | Admin, Agent |
| View sessions | Sessions | All (agents: own only) |
| Generate invoice | Sessions → **Invoice** | All (agents: own only) |
| Download invoice | Invoices → **PDF** | All (agents: own only) |
| Add operator | Operators → **+ Add Operator** | Admin |
| Deactivate user | Operators → **Deactivate** | Admin |
| Add kWh quota | Allocations → **+ Add Allocation** | Admin |
| Monthly revenue report | Reports → Monthly Sales | Admin, Accountant |
| Inventory stock | Reports → Inventory | Admin, Accountant |
| Register new charger | Settings → **+ Register New Charger Machine** | Admin |
| Get charger OCPP URL | Settings → charger card → copy URL | Admin |
| Open this manual | Help (sidebar) | All |
| Sign out | Sidebar → **Sign Out** | All |

---

_EVCSIMS User Manual · Simple Charge, Kigali, Rwanda · May 2026 · v1.1_
_For technical support contact your system administrator._
