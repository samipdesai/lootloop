# LootLoop — TestFlight Beta Testing Guide

Thanks for helping test LootLoop! 🎉 This build is the **iOS beta** running against
our **production** backend. Please spend ~15–20 minutes on the flows below and send
feedback (see *How to report* at the bottom).

> **What is LootLoop?** A family chore & reward app. **Parents** create chores and
> rewards and approve completed work. **Kids** complete chores to earn points, then
> spend them in a reward store, save toward goals, and log their reading. One app,
> two roles. It adapts to your device (iPhone tabs / iPad split-view) and to the
> child's age mode (Simple 5–8, Detailed 9–12, Teen 13–15).

---

## Before you start

- Install via the **TestFlight** invite link.
- You can test on **iPhone and/or iPad** — if you have both, please try both, since
  the layout adapts.
- **Two ways to test:** sign in with the shared **demo family** below (fastest), or
  **create your own family** from scratch to test the full sign-up flow. Doing both
  is ideal.

### Shared demo account (fastest way in)

| Role | How to sign in |
| --- | --- |
| **Parent** | Email `review@lootloop.us` · Password `LootReview2026!` |
| **Kid** | On the Login screen tap **"Kid signing in? Use your family code"** → family code **`LOOTDEMO`** → pick a child → enter PIN: **Ava = 1234**, **Max = 5678** |

> ⚠️ The demo family is **shared** across all testers, so data may change under you
> (chores get approved, points get spent). That's expected. To test in a clean
> sandbox, create your own family instead.

---

## Test flows

### 1. Parent — first run & setup *(do this if creating your own family)*
1. Launch the app → tap **Sign up** → create a parent account with your email.
2. Confirm your email (check inbox for the LootLoop confirmation), then sign in.
3. Create your **family**, then **add a kid** (name, age — note how age sets the kid's "mode").
4. **Check:** Did the confirmation email arrive and look branded? Was onboarding clear?

### 2. Parent — chores & rewards
1. Create a **chore** (e.g. "Make your bed", set points).
2. Create a **reward** in the store (e.g. "30 min screen time", set a point cost).
3. Open **Kids** and **Schedule** — browse around.
4. **Check:** Could you find everything? Anything confusing or mislabeled?

### 3. Kid — earn points
1. Sign out, then sign in as a **kid** (family code + PIN).
2. On **Home**, see the points wallet, today's chores, savings, and reading streak.
3. Mark a chore **Done** → it goes to the parent for approval (kid can't self-approve).
4. **Check:** Is the kid UI age-appropriate and easy to navigate?

### 4. Parent — approve & award
1. Sign back in as the **parent**.
2. Go to **Approvals** — there should be a pending chore. **Approve** it.
3. **Check:** Did the child's point balance go up after approval?

### 5. Kid — spend, save, read
1. Back as the **kid**: open the **Store** and **buy a reward** with points.
2. Open **Savings** → move some points into savings / toward a goal.
3. Open **Reading** → log a reading session.
4. **Check:** Did balances update correctly everywhere? Any number look wrong?

### 6. Account controls *(important — Apple requires this)*
1. As the parent: **Settings (gear) → Account**.
2. Try **"Leave family"** and note the hard-confirm step (don't fully delete the
   shared demo — use your own test family if you want to confirm deletion works).
3. **Check:** Is it clear what gets deleted?

### 7. Adaptive layout *(if you have an iPad)*
- Open the same screens on iPad and notice the **split-view** layout vs the iPhone
  tab/stack layout.
- **Check:** Does anything look broken, cramped, or cut off on the larger screen?

---

## What we especially want to know

- 🐞 **Crashes or freezes** — what screen, what you tapped right before.
- 🔢 **Wrong numbers** — points, savings, or balances that don't add up.
- 😕 **Confusing UI** — anywhere you weren't sure what to do next.
- 🎨 **Visual glitches** — overlap, clipping, weird spacing (note device + iPhone/iPad).
- 📧 **Email issues** — confirmation/reset emails that don't arrive or look broken.
- ⏱️ **Slowness** — anything that felt laggy.

## How to report

- **In TestFlight:** take a screenshot → the TestFlight share sheet lets you attach
  it directly to feedback. This is the easiest path and includes device/build info.
- **Or email:** `support@lootloop.us` — include your **device model**, whether it was
  **iPhone or iPad**, and **steps to reproduce**.

Thank you! Every bug you find now is one a real family won't hit. 💛
