# MessMantra

**Zero-waste hostel mess: opt in before the cutoff, show a rotating signed QR, one QR = one meal.**

Webster 2026 | Team Tsunami (Team ID 114) | Problem E2: The Kamar-Taj Refectory

Team: Adarsh Babu, Shubham Lodhi, Mitakshara

## The problem
In a hostel mess the kitchen does not know how many students will eat, so food is wasted. Students cancel after cooking starts, paper coupons can be shared or used twice, and nobody keeps a record of who ate what.

## The solution
- Before a **cutoff time** students choose whether they will eat each meal. After the cutoff the **server locks** the choice, so nobody can cancel late.
- An opted-in student gets a **QR code that changes every 30 seconds**. Staff scan it with a phone camera. Each QR works **only once**.
- Every action is saved in an **audit log** and every eaten meal in a **ledger**, so the kitchen gets a correct head-count and the admin can check what happened.

## Features
- Three role-based dashboards: **Student**, **Staff**, **Admin**
- Login with email and password; a signed JWT carries the role
- Admin adds and edits meals (breakfast, lunch, snacks, dinner) with menu, cutoff time and serving window
- Student dashboard shows one date at a time (date strip and date picker) with four slots; empty slots show "Not published yet"
- Live countdown to the cutoff; cutoff enforced by the server clock inside SQL
- QR appears as soon as the student opts in and disappears if the student cancels
- Staff scanner: camera stops after each scan, green or red result with the reason, press Start camera for the next
- Head-count forecast (projected vs consumed, 5 second cache)
- Student **History** tab: what was eaten, by date and meal type
- Admin ledger and audit log
- Works on phone, tablet and computer, with dark mode

## Tech stack
| Part | Technology |
|---|---|
| Pages | HTML, CSS, JavaScript |
| Server | Node.js + Express |
| Database | Supabase (PostgreSQL) with SQL functions |
| Login | JWT (jsonwebtoken) |
| Passwords | bcryptjs |
| QR signing | Node crypto (HMAC-SHA256) |
| QR image / scan | qrcode / html5-qrcode |
| Security | helmet, express-rate-limit, row-level security |
| Tests | Vitest + Supertest |

All libraries are open source.

## How it works
1. Login returns a signed JWT with the role.
2. Admin publishes meals with a cutoff and a serving window.
3. Student opts in or cancels before the cutoff; the QR is generated and renewed every 30 seconds.
4. At the cutoff the server locks the meal.
5. Staff scan the QR during the serving window. The server checks the signature and expiry, then marks the token used with one atomic database update.
6. Valid: the meal is saved in the ledger and staff see a green screen. Otherwise a red screen with the reason (expired, already used, not opted in, ...).

## Why it cannot be cheated
- **One QR, one meal:** the database function `redeem_qr` runs one transaction with an atomic update:
  ```sql
  UPDATE qr_tokens SET used_at = :now, used_by = :staff
  WHERE nonce = :nonce AND used_at IS NULL AND expires_at > :now;
  ```
  A second simultaneous scan finds `used_at` already set and is rejected. The ledger also has `UNIQUE (user_id, meal_id)` as a second safety.
- **Cutoff:** checked in SQL using the server clock; the phone or browser clock is only used to draw the countdown.
- **QR:** HMAC-SHA256 signed with a random nonce and a 60 second expiry; old unused codes are deleted when a new one is issued.
- **Passwords:** bcrypt hashes. **Database:** row-level security on, and the secret key stays on the server.
- **API:** helmet headers, rate limits, role-based middleware, parameterized queries, safe DOM building.

## Folder structure
```
messmantra/
  package.json  .env.example  .gitignore  README.md
  supabase/
    schema.sql          tables, security rules, SQL functions (run first)
    sample_data.sql     demo users, meals, opt-ins, ledger
    update_v2.sql       snacks type + past history for the History tab
  server/
    server.js app.js config.js db.js seed.js
    middleware/         auth.js (JWT, roles), wrap.js (async errors)
    routes/             auth.js meals.js staff.js admin.js
    services/           cutoff.js qr.js forecast.js audit.js
  public/
    index.html student.html staff.html admin.html
    css/style.css
    js/                 common.js login.js student.js staff.js admin.js
  tests/api.test.js
```

## Setup
1. Create a free project at https://supabase.com.
2. In the Supabase **SQL Editor** run, in this order: `supabase/schema.sql`, `supabase/sample_data.sql`, `supabase/update_v2.sql`.
3. Copy `.env.example` to `.env` and fill it:
   ```
   PORT=3000
   JWT_SECRET=long-random-text
   QR_SECRET=different-long-random-text
   SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```
   `JWT_SECRET` and `QR_SECRET` are values you make up yourself. The URL and key come from Supabase: Project Settings, API.
4. Install and run:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000

**Security note:** never commit `.env` or share the service key. It is already listed in `.gitignore`.

## Demo logins
| Role | Email | Password |
|---|---|---|
| Admin | admin@mess.com | admin12345 |
| Staff | staff@mess.com | staff12345 |
| Student | student@mess.com | student12345 |

Other demo students: aarav@, priya@, rohan@, sneha@, vikram@, ananya@, karan@ (all @mess.com), password `student12345`. Change these passwords before any real use.

## Tests
```bash
npm test
```
Integration tests run against Supabase (use a separate test project, they insert rows). They cover wrong passwords, role blocking, cutoff before and after, tampered QR codes, and ten simultaneous scans of one QR where exactly one must succeed.

## Deploy
Use any Node host with HTTPS (Render, Railway); the phone camera needs HTTPS. Set `NODE_ENV=production`, `JWT_SECRET`, `QR_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the host's environment settings.

## Future work
Realtime updates, httpOnly cookie login, food-waste charts, rebates for early cancellation, and an offline scan queue that syncs later.
