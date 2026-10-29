<div align="center">

# 🍽️ MessMantra

### One QR. One meal. Zero wasted food.

A smart hostel mess system where students choose their meals in advance, check in with a QR code that refreshes every 30 seconds, and the kitchen always knows exactly how many plates to cook.

**Webster 2026 · Team Tsunami · Problem E2: The Kamar-Taj Refectory**

</div>

---

## 😩 The problem

Every hostel mess faces the same three headaches:

- 🍲 **Nobody knows how many students will eat**, so the kitchen cooks too much and food is wasted.
- ⏰ **Students cancel after cooking has started**, when it is already too late to adjust.
- 🎟️ **Paper coupons can be shared or used twice**, and there is no record of who actually ate.

## 💡 Our idea

**Decide early. Prove at the door. Record everything.**

MessMantra asks students to choose their meals before a cutoff time. When the cutoff passes, the server locks every choice, so the kitchen can trust its head-count. At meal time, each student shows a personal QR code that changes every 30 seconds and works only once. Staff scan it, and the meal is written into a permanent record.

## 🔄 How it works

| | Step | What happens |
|---|---|---|
| 1️⃣ | **Publish** | The admin adds the day's meals with the menu, cutoff time and serving time. |
| 2️⃣ | **Choose** | Students see a live countdown and opt in or cancel. |
| 3️⃣ | **Lock** | At the cutoff the server locks the choice. Late changes are refused. |
| 4️⃣ | **Show** | Opted-in students get a QR that renews every 30 seconds. |
| 5️⃣ | **Scan** | Staff scan with a phone camera and see a green or red screen with the reason. |
| 6️⃣ | **Record** | Every meal and every action is stored for the admin to review. |

## ✨ Features

### 🎓 Students
- A clean daily view with four slots: **breakfast, lunch, snacks and dinner**
- Pick any date with a day strip or calendar
- Live countdown to the cutoff
- QR code appears the moment you opt in, and disappears if you cancel
- **History** of everything you have eaten, by date and meal type

### 👩‍🍳 Kitchen staff
- Built-in camera scanner that works in the browser
- Big **green ✓ SCANNED** or **red ✕ REJECTED** screen, with the reason
- The camera switches off after each scan, ready for the next student
- Live head-count: how many are expected and how many have eaten

### 🛠️ Admin
- Add and edit meals, menus and timings
- Head-count forecast for every meal
- Complete ledger of who ate what, and who scanned them
- Audit log of every action in the system

### 📱 Everyone
- Works on phones, tablets and computers
- Light and dark mode
- Separate dashboards for each role

## 🔐 Built to be trustworthy

| What could go wrong | How MessMantra handles it |
|---|---|
| A QR is scanned twice | The database marks it used in a single step, so only one scan can ever succeed. |
| Two staff scan the same code at once | The database picks exactly one winner. |
| A student cancels after the deadline | The cutoff is checked on the server's clock, so changing a phone's time does nothing. |
| Someone fakes or edits a QR | Every QR carries a cryptographic signature, and any change breaks it. |
| A screenshot is shared | The code renews every 30 seconds, expires within a minute, and works once. |
| A student eats the same meal twice | The record allows one meal per student per meal. |
| Passwords leak | Passwords are stored only as secure hashes. |
| Someone peeks at the database | Direct access is locked, and only the server can read or write. |

## 🧱 How it is built

**Browser pages** → **Express server** (security checks, roles, validation) → **Services** (cutoff, QR, forecast, audit) → **Supabase database**

The browser never talks to the database directly. Every request is checked for who you are, what you are allowed to do, and whether the input makes sense, before anything is saved.

## 🛠️ Technology

| Part | Technology |
|---|---|
| Pages | HTML, CSS and JavaScript |
| Server | Node.js and Express |
| Database | Supabase (PostgreSQL) |
| Login | JSON Web Tokens |
| Passwords | bcrypt |
| QR codes | HMAC-SHA256 signing, qrcode, html5-qrcode |
| Security | helmet, rate limiting, row-level security |
| Testing | Vitest and Supertest |

Every library used is open source.

## 📂 What is inside

| Folder | Purpose |
|---|---|
| `public/` | The login page and the student, staff and admin dashboards |
| `server/` | The API: login, roles, meals, QR checking, forecast |
| `supabase/` | Database tables, safety rules and demo data |
| `tests/` | Automated tests, including simultaneous scans of one QR |


## 👥 Team Tsunami

| Name | Roll no. |
|---|---|
| Adarsh Babu | 20263019 |
| Shubham Lodhi | 20263279 |
| Mitakshara | 20263175 |

<div align="center">

Built for **Webster 2026** ☕

</div>