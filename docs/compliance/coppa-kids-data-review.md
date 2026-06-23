# COPPA / Kids-Data Compliance Review

**Task:** #54 (Milestone 7 — Launch & Compliance)
**Status:** Draft for review
**Date:** 2026-06-22
**Scope:** US Children's Online Privacy Protection Act (COPPA, 16 CFR Part 312) and Apple App Store kids requirements, as they apply to LootLoop v1.

> **This is an engineering compliance review, not legal advice.** It maps LootLoop's actual data model and architecture against COPPA's requirements so that the team and its counsel can make informed decisions. Every "recommendation" below is a proposal for the product owner and a qualified attorney to ratify. Where this document asserts a legal conclusion, treat it as a starting hypothesis to confirm with counsel, not a settled fact.

---

## 1. Why COPPA applies, and scope

LootLoop is squarely a **children's app**: the kid role targets ages **5–15**, and the kid experience (chores, points, rewards, reading logs, savings) is built specifically for children. Under COPPA this matters in two ways:

- **Under-13 is the COPPA trigger.** COPPA governs the online collection of personal information from children **under 13** by operators of (a) websites/services directed to children, or (b) general-audience services with actual knowledge they're collecting from under-13s. LootLoop is plainly **directed to children**, so COPPA's full requirements apply to every under-13 kid profile.
- **13–15 is outside COPPA but not outside scrutiny.** Kids aged 13–15 (our `teen` age mode, ages 13–15) are above the COPPA threshold, so COPPA's verifiable-consent rules don't strictly apply to them. However:
  - Apple's App Store Review Guidelines (§1.3, §5.1.4 "Kids") apply to minors generally, not just under-13s.
  - Several US state privacy laws (e.g. California's CCPA/CPRA age provisions, and the broader "age-appropriate design" wave) and non-US regimes (UK Age-Appropriate Design Code, GDPR-K in the EU at the 13–16 member-state threshold) reach teens. v1 ships US-only, but the data model should not make a later expansion painful.

Because the **strictest** applicable rule (COPPA, under-13) is also the simplest to design to, the practical recommendation is to **treat all kid profiles as if COPPA applies**, regardless of the kid's age band. This avoids branching consent/data logic on a birthdate we may not even collect (see §3).

**Geographic scope for v1:** United States. This review is US-focused. If LootLoop ships outside the US, GDPR-K and the UK code must be reviewed separately by counsel — they are *not* covered here.

---

## 2. Verifiable parental consent

### 2.1 What COPPA requires

Before collecting personal information from a child under 13, an operator must (a) provide direct notice to the parent and (b) obtain **verifiable parental consent** (VPC). The "verifiable" bar scales with how the data is used: internal-use-only data permits lighter-weight methods (the FTC's historical "email plus" approach), while sharing data with third parties demands stronger methods (credit card, signed form, video ID, knowledge-based auth, etc.).

### 2.2 How LootLoop's architecture maps to VPC — this is our strongest asset

LootLoop's account model is **parent-gated by construction**, which aligns unusually well with COPPA:

- **Kids have no independent signup and no credential of their own to the outside world.** Verified in the schema: a kid is a `profiles` row with `role = 'kid'`, `auth_user_id IS NULL`, and a bcrypt `pin_hash` — they have **no `auth.users` row** (`supabase/migrations/001_initial_schema.sql`, the `profiles_kid_shape` CHECK constraint, lines 82–84). A kid cannot create an account, cannot reach the service without a parent first provisioning them, and signs in only by PIN on a device pre-bound to the family.
- **Only a confirmed parent can create a kid.** Kid creation goes exclusively through the `create_kid()` SECURITY DEFINER RPC, which self-authorizes `auth_role() = 'parent'` and scopes to `auth_family_id()` (`supabase/migrations/005_kid_management.sql`, lines 130–176). A kid session is explicitly rejected from family-bootstrap functions (`auth_is_kid()` guard in `004_auth_bootstrap.sql`). There is no code path by which a child enters their own PII.
- **The parent is always the account holder and gatekeeper.** The family is created by a confirmed Supabase Auth user (email + password) via `create_family_and_parent()`; that user is the parent of record and controls all kid profiles, all chore/reward/reading data, and family deletion.

In effect, **all kid PII is entered by an authenticated adult about their own child**, on an account the adult created and controls. This is materially stronger than apps where a child self-registers and a parent later "approves."

### 2.3 Gaps and open questions for counsel

The architecture is strong, but two things are *not* automatically satisfied and need a decision:

1. **Is "the parent created an email/password account" a sufficient VPC method?**
   Creating a Supabase Auth account (email + confirmed) is closer to the old "email plus" tier than to a high-assurance method. For LootLoop's data uses this *may* be adequate **because we do not share kid PII with third parties** (no ad SDKs, no analytics — see §3 and §4) and the data is internal-use-only. The FTC permits lighter VPC for internal-use-only collection. **Counsel should confirm** whether account creation + a clear consent affirmation meets VPC for our specific data uses, or whether we need an explicit consent step.

2. **We do not currently record a consent artifact.**
   There is no `consent` table, no timestamped "I am the parent and I consent" record, and no captured version of the privacy policy the parent agreed to. COPPA expects operators to *obtain* consent; in practice you want to be able to *prove* you obtained it. **Recommendation (engineering):** add a lightweight consent record — at minimum a timestamp + policy version captured at family creation (e.g. extend `create_family_and_parent()` to stamp `families.consent_accepted_at` and `families.consent_policy_version`, or a dedicated `parental_consents` row). This is a small migration and pays for itself the first time anyone asks "prove the parent consented."

3. **Direct notice content.** COPPA requires the parent be told *what* is collected, *how* it's used, and *that they can review/delete it*, **before** collection. Today the consent moment (onboarding) does not surface this. The onboarding flow (task referencing #53 privacy policy) must link the policy and present a plain-language summary at the point the parent creates the family / first kid.

---

## 3. Data minimization for under-13

COPPA requires collecting **only** what is reasonably necessary for the activity, and prohibits conditioning a child's participation on disclosing more than is needed. Here is every kid data element LootLoop stores, sourced from the schema, with a necessity assessment.

| Data element | Where stored | Necessary? | Assessment / recommendation |
| --- | --- | --- | --- |
| **Display name** | `profiles.display_name` | Yes | Core to the UX (kid picks their profile, sees their name). **Recommend guidance**, not a hard control: tell parents a first name / nickname is fine; discourage full legal names. This is a privacy-policy + UI-copy nudge, not a schema change. |
| **Age mode** (`simple`/`detailed`/`teen`) | `profiles.age_mode` | Yes | An age *band*, not a birthdate. Drives UI complexity. This is the minimal age signal we need and is preferable to a precise birthdate. Keep. |
| **Birthdate** | `profiles.birthdate` (nullable) | **No — flag** | Already **optional** (nullable column; `create_kid()` defaults it to `NULL`). Nothing in the v1 feature set requires an exact birthdate — age *mode* already drives every age-dependent behavior. **Recommendation (product):** either drop `birthdate` entirely for v1, or keep it optional and clearly label it optional in the UI with a stated purpose. Do **not** make it required. Precise birthdate is the single most sensitive field here and the hardest to justify under minimization. |
| **Avatar** | `profiles.avatar_url` (nullable) | Optional | Already optional. If avatars are uploaded photos of the child, that's a child image (sensitive). **Recommendation (product/engineering):** prefer a **preset avatar / emoji picker** over photo upload for v1; if photo upload is offered, it must be parent-initiated and covered explicitly in the privacy policy. Confirm what the avatar picker actually allows today. |
| **PIN hash** | `profiles.pin_hash` (bcrypt cost 10) | Yes | Authentication credential, stored hashed (never plaintext) — good practice. The PIN is a local family-device credential, not an account password. Keep. |
| **Points / wallet / savings balances** | `wallets`, `point_transactions`, `savings_transactions` | Yes | App-functional (the whole product). Internal-use only; no external sharing. Keep. |
| **Chore completions** | `chore_completions` | Yes | App-functional. Keep. |
| **Reading logs** (book title, minutes, date) | `reading_logs`, `reading_streaks` | Yes | App-functional. Book titles are free-text the kid enters — low sensitivity, but note it's child-entered content. Keep. |
| **Schedule items** | `schedule_items` | Yes | App-functional (parent-authored daily timeline). Keep. |

**Free-text / social surface:** There is **no** free-text social feature, no chat, no comments, no public profile, and no child-to-child or child-to-stranger communication. Kid-entered free text is limited to book titles and (parent-created) chore/reward/schedule titles. This is good for COPPA — there's no avenue for a child to inadvertently disclose PII to others.

**Third-party data sharing — verified absent.** A scan of `apps/mobile`, `apps/web`, and `packages/` found **no** analytics, advertising, attribution, crash-reporting, or tracking SDKs (no Firebase/AdMob/Facebook/AppsFlyer/Amplitude/Mixpanel/Segment/Sentry/Crashlytics/Google Analytics/PostHog/Vercel Analytics, etc.). The only backend is **Supabase** (Postgres + Auth + Edge Functions + Realtime), acting as our data processor. This is the single most important data-minimization fact and the foundation of the §4 Kids Category recommendation. **This must stay true** — see the §7 checklist. If any third-party SDK is ever added, this entire review must be re-run.

**Minimization verdict:** The data model is already lean. The two items to act on are **birthdate** (drop or keep-optional, never required) and **avatar** (prefer presets over photo upload). Everything else is app-functional and internal-use-only.

---

## 4. Apple "Kids Category" decision

Apple lets an app either (a) list in the **Kids Category** (App Store Connect age band 5 and under / 6–8 / 9–11), or (b) list in a normal category (e.g. Lifestyle / Productivity) while still being usable by children. The Kids Category is a stricter, badged shelf — not just a label.

### What the Kids Category requires / forbids (Apple Guideline 1.3 & 5.1.4)
- **No third-party analytics or third-party advertising.** Data may not be sent to third parties except as needed to provide the app's core functionality (and even then, narrowly).
- **No behavioral/targeted advertising at all**, and any ads must be age-appropriate and human-reviewed.
- **A parental gate** for any link out of the app (purchases, external links, etc.).
- **Heightened review scrutiny** and a privacy policy requirement.

### Pros of opting into the Kids Category
- **We already meet the hard bars.** No third-party analytics/ads (verified, §3); Supabase is a first-party data processor, not a data-sale third party. Adopting the category mostly *ratifies our existing posture* rather than forcing change.
- **Trust and discoverability.** The Kids badge signals to parents that the app meets Apple's child-safety bar; it's a credibility asset for a children's product.
- **Forcing function.** The category's ban on third-party tracking becomes an *enforced* constraint, which protects us from a future "let's just add analytics" decision that would silently break COPPA alignment.

### Cons / costs
- **Stricter, slower review** and less margin for error — any future feature touching external links, purchases, or data sharing gets scrutinized harder.
- **Parental gate requirements** on outbound links/actions add UI work (though LootLoop has almost no outbound links today).
- **Locks out monetization paths** that rely on third-party SDKs (ad networks, third-party analytics-driven growth). For LootLoop's likely model (family subscription / IAP via Apple), this is not a real loss — Apple's own IAP is permitted.
- **Age-band granularity** in App Store Connect tops out around 9–11; our 13–15 teen mode sits awkwardly with a "kids" shelf positioning. Worth a marketing/product conversation about whether the 13–15 band is better served by a standard listing with a high age rating.

### Recommendation

**Opt into the Kids Category (preliminary recommendation), conditioned on two checks.** Rationale: LootLoop is a genuine children's app that *already* satisfies the category's hardest requirements (no third-party tracking/ads, first-party-only backend), so the category mostly formalizes our existing design and buys real parent trust at low incremental cost. The conditions:

1. **Confirm the teen (13–15) positioning** with product/marketing — if the 13–15 audience is strategically important, weigh a standard listing with a 12+/17+ age rating instead, or accept that the Kids Category age bands skew younger than our full range.
2. **Confirm we will never need third-party analytics/ads in v1** — the category makes that a permanent constraint. Given §3, this is already our posture.

This is a **product + legal decision**; engineering's input is only that the technical posture (no third-party SDKs) already supports either path, and supports the Kids Category specifically. Counsel and the product owner should make the final call.

---

## 5. Privacy disclosures (cross-ref task #53)

The Privacy Policy delivered in **#53** must, at minimum, state the following for kids' data (COPPA §312.4 direct-notice + online-notice content):

1. **Operator identity and contact** — who collects the data and how a parent reaches us (name, email/contact for privacy requests).
2. **What is collected from children**, itemized — display name, age mode, optional birthdate, optional avatar, PIN (hashed), and the activity data: points/wallet/savings ledgers, chore completions, reading logs, schedule items. (Mirror the §3 table.)
3. **How it's used** — solely to provide the app's chore/reward/reading/savings functionality for the family. State plainly: **no advertising, no third-party analytics, no sale or sharing of children's data.**
4. **Who it's shared with** — only Supabase as our hosting/data processor (a service provider acting on our behalf), and no one else. Name the sub-processor.
5. **That collection is parent-initiated** — kids do not self-register; parents create and control kid profiles and enter all kid data.
6. **Parental rights** — the parent can **review** their child's data, **refuse further collection**, and **delete** the child's data and/or the whole family account (cross-ref §6 / #52). Explain *how* (in-app + contact path).
7. **Data retention & deletion policy** — how long data is kept and that deletion is honored (§6).
8. **Security** — that credentials are hashed and access is isolated per family (RLS).
9. **Effective date / version** — and how changes are communicated. (Tie this version string to the consent record proposed in §2.3.)

The policy must be **linked at the consent moment** (onboarding / first kid creation) and **publicly reachable** from the App Store listing and the web app footer.

---

## 6. Data subject rights / deletion (cross-ref task #52)

COPPA gives parents the right to review their child's information, refuse further collection, and **direct deletion**. Apple and general privacy expectations also demand an in-app account-deletion path.

### How #52 satisfies this — the schema already supports clean deletion

Every family-scoped table declares `family_id ... references families (id) **on delete cascade**` (verified across `001_initial_schema.sql` and `004_auth_bootstrap.sql`: `profiles`, `chores`, `chore_instances`, `chore_completions`, `wallets`, `point_transactions`, `rewards`, `reward_purchases`, `reading_logs`, `reading_streaks`, `savings_transactions`, `savings_goals`, `schedule_items`, `family_invites`). Deleting the `families` row therefore **atomically purges every byte of kid data** in one cascade — there are no orphan tables to sweep.

Per-kid deletion already exists today: `delete_kid()` (`005_kid_management.sql`, lines 267–293) hard-deletes a kid profile, and the same `profiles`-keyed cascades clear that kid's wallet, ledgers, completions, reading logs, and streak. So a parent can already remove an individual child's data.

**What #52 must add (engineering):**
- A **parent-initiated family/account deletion** path: a SECURITY DEFINER RPC that (a) self-authorizes `auth_role() = 'parent'`, (b) deletes the `families` row for `auth_family_id()` (triggering the cascade), and (c) deletes the parent's `auth.users` row(s) so the credential itself is gone. Note: kid `profiles` carry no `auth.users` row, so only parent auth users need explicit deletion; the cascade handles everything else.
- An **in-app entry point** for the parent to trigger it (Apple requires in-app account deletion for apps that support account creation), with a confirmation step.
- Consider whether **co-parents** complicate "delete the family" — if multiple parents share a family, deletion policy (any parent? owner only?) needs a product decision.

**Retention notes:**
- Define a retention policy in the privacy policy (§5.7). Recommended default: retain data only while the account is active; on deletion, purge immediately (the cascade does this synchronously — there is no soft-delete/tombstone today, which is *good* for COPPA).
- Confirm **backups**: Supabase point-in-time / daily backups may retain deleted data for the backup window. The privacy policy should disclose the backup retention window, and counsel should confirm that "deleted from production immediately, expires from backups within N days" satisfies the deletion obligation. (This is the one place where "deletion" isn't truly instantaneous.)
- **Edge Function / log hygiene:** confirm that `kid-auth`, `family-roster`, and other Edge Functions don't log kid PII (display names, PINs) into retained logs. PINs are already hashed; verify no plaintext PIN or name lands in logs.

---

## 7. Pre-submission checklist (gates for App Store submission, task #60)

Each item tagged **[engineering]**, **[legal]**, or **[product]**. All must be true/done before submitting to the App Store.

### Consent & notice
- [ ] **[legal]** Counsel confirms whether account creation + consent affirmation meets COPPA verifiable parental consent for our internal-use-only data, or whether a stronger/explicit step is required (§2.3).
- [ ] **[engineering]** Record a consent artifact at family creation — timestamp + privacy-policy version (e.g. `families.consent_accepted_at` / `consent_policy_version`, or a `parental_consents` table) (§2.3).
- [ ] **[product/engineering]** Onboarding surfaces a plain-language data summary and links the privacy policy **before** the parent creates the family / first kid (direct notice) (§2.3, §5).

### Data minimization
- [ ] **[product]** Decide birthdate: drop for v1, or keep optional and never required, with a stated purpose in-UI (§3).
- [ ] **[product/engineering]** Confirm the avatar picker is presets/emoji, or, if photo upload exists, that it's parent-initiated and disclosed (§3).
- [ ] **[product]** Add UI copy / guidance steering parents to first names / nicknames, not full legal names (§3).
- [ ] **[engineering]** Re-run the third-party-SDK scan immediately before submission and confirm **zero** analytics/ad/tracking SDKs in `apps/*` and `packages/*` (§3). This is a release gate, not a one-time check.

### Privacy policy (#53)
- [ ] **[legal/product]** Privacy policy drafted/reviewed covering all nine §5 elements; names Supabase as sub-processor; states "no ads, no third-party analytics, no sale/sharing of kids' data."
- [ ] **[engineering]** Policy linked at the consent moment, in the web app footer, and in App Store Connect metadata.

### Deletion & rights (#52)
- [ ] **[engineering]** Parent-initiated family/account deletion RPC implemented (cascade-delete family + delete parent `auth.users` rows) with an in-app entry point and confirmation (§6).
- [ ] **[engineering]** Verified in a test that deleting a family purges all kid rows across every table (cascade integration test) (§6).
- [ ] **[product/legal]** Retention policy defined and disclosed, including the Supabase backup-expiry window (§6).
- [ ] **[engineering]** Confirm Edge Functions / logs contain no plaintext PIN or kid names (§6).

### App Store / Kids Category
- [ ] **[product/legal]** Final decision on Kids Category vs standard listing ratified (preliminary recommendation: opt in — §4).
- [ ] **[product/engineering]** If Kids Category: add a parental gate on any outbound link/purchase; set correct App Store Connect age band; complete the App Privacy ("nutrition label") questionnaire consistent with §3 (data collected, not linked to identity for tracking, no tracking).
- [ ] **[legal]** Counsel signs off that the overall posture (consent, notice, minimization, deletion, listing choice) satisfies COPPA and Apple's kids requirements for a US launch.

---

### Appendix — source files cited
- `supabase/migrations/001_initial_schema.sql` — tables, `profiles_kid_shape` constraint, `family_id ... on delete cascade` across all family-scoped tables, `profiles.birthdate`/`avatar_url` nullability.
- `supabase/migrations/004_auth_bootstrap.sql` — `create_family_and_parent()` (parent account creation), `family_invites` cascade.
- `supabase/migrations/005_kid_management.sql` — `create_kid()` / `update_kid()` / `delete_kid()` (parent-only, self-authorizing), PIN bcrypt hashing.
- `apps/mobile/package.json`, `apps/web/package.json` — verified no third-party analytics/ad/tracking SDKs.
- `supabase/functions/` — `kid-auth`, `family-roster`, `calculate-interest`, `generate-recurring-chores` (review for PII logging).
