# App Store — App Review Information

Paste these into **App Store Connect → your app → (version) → App Review Information**.

---

## Sign-In Required: Yes

### Demo Account (the "Demo Account" username/password fields)

| Field | Value |
| --- | --- |
| **User name** | `review@lootloop.us` |
| **Password** | `LootReview2026!` |

This is a **parent** account in a pre-populated demo family (2 kids, chores, a
reward store, and pending approvals to review).

---

## Notes (the "Notes" text field)

```
LootLoop is a family chore & reward app with two roles — PARENT and KID — in one app.

GETTING IN
• The app opens on the parent Login screen.
• PARENT: sign in with the demo account review@lootloop.us / LootReview2026!
• KID: on the Login screen tap "Kid signing in? Use your family code", enter the
  family code LOOTDEMO, choose a child, and enter their PIN:
     – Ava → 1234
     – Max → 5678
  (Kids do NOT have email accounts. A parent owns the account; each child signs
   in with a family code + PIN, under parental supervision.)

WHAT TO TRY AS A PARENT (review@lootloop.us)
• Dashboard shows the family's kids and activity.
• Approvals: there are 2 chores awaiting approval — tap one and Approve to award
  points to the child.
• Browse Chores, Rewards, Kids, and Schedule.
• Account deletion (Apple Guideline 5.1.1(v)): tap the gear / Settings → Account
  → "Delete family" (removes the account and all family data) or "Leave family".

WHAT TO TRY AS A KID (family code LOOTDEMO, e.g. Ava / 1234)
• Home shows the child's points wallet, today's chores, savings, and a reading streak.
• Mark a chore "Done" — it goes to the parent for approval.
• Store: spend points on rewards. Savings: move points into savings. Reading: log reading.

PRIVACY / KIDS
• No third-party advertising or analytics SDKs. Data collected (parent email,
  display names, chore/reward activity) is used only for app functionality.
• Privacy Policy: https://lootloop.us/privacy
• Terms: https://lootloop.us/terms

Thanks for reviewing! Contact: <YOUR SUPPORT EMAIL/PHONE>
```

---

## Notes for us (not for Apple)

- The demo data lives in the prod Supabase project (`lootloop-prod`), seeded family
  **"The Demo Family"** (`kid_code = LOOTDEMO`). Re-seed by re-running the demo SQL
  if a reviewer mutates it (approving chores, spending points, etc.).
- The TestFlight/App Store build points at prod via `ENVFILE=.env.production`
  (fastlane `beta` lane). Dev/Maestro builds still use local Supabase (`.env`).
- Fill in a real **support email/phone** before submitting (Apple requires contact info).
