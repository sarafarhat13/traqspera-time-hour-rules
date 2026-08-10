# Traqspera — Time Hour Rules Prototype

Interactive React prototype reconstructed from the Figma Make file `Time Hour Rules.make`, styled with **Trimble Modus Web Components**.

## Live demo

GitHub Pages: https://sarafarhat13.github.io/traqspera-time-hour-rules/

## Run locally

```bash
cd prototype
npm install
npm run dev
```

## Stack

- React 19 + Vite + TypeScript + Tailwind CSS
- [@trimble-oss/moduswebcomponents](https://github.com/trimble-oss/modus-wc-2.0) + React wrappers (`ModusWcButton`, `ModusWcSwitch`, `ModusWcCheckbox`, `ModusWcTabs`, `ModusWcAlert`, `ModusWcBadge`)

## What's included

- **Settings → Hour Rules** — Company / Union / State hour rules, meal periods, breaks, premiums, exclusions, autosave
- **Time → Clock In and Out** — Clock UI with status, breaks, attestation
- **Time → Compliance Dashboard** — Exception dashboard with filters and Modus Send Alert actions

---

# Test plan

Manual test plan for the prototype. Everything below is exercised through the UI in a browser; there is no automated suite and no backend.

## Before you start

The app opens on **Settings → Hour Rules**. Only three areas are implemented — **Settings → Hour Rules**, **Time → Clock In and Out**, and **Time → Compliance Dashboard**. Every other left-nav item is an intentional stub reading "This page is under construction," so treat those as out of scope rather than defects.

Read these five points before filing anything, because each one looks like a bug and isn't:

1. **All state is in memory.** A page refresh resets the clock session, attestations, exclusions, and rule edits back to their seeded defaults. Finish a test case before reloading.
2. **Break timers are compressed to 30 seconds** so the flows are testable. The break reminder appears 30 seconds after clocking in, and a break must run 30 seconds before it can end without a warning. In production these are 30 minutes (`BREAK_INTERVAL` and `MANDATORY_BREAK` in `prototype/src/App.tsx`).
3. **Location is simulated, never real.** The browser's geolocation is never requested. Use the **Simulate: On site / Off site** control in the Job Details card to choose which fix the app sees.
4. **Job Details start empty on purpose.** Crew, Department, Job, and Phase are blank on first load and must be filled before a punch is accepted.
5. **On-Duty Meal is enabled by default**, so the On-Duty Meal action is available on the clock screen without changing settings first.

Test the Clock In and Out screen in both **Desktop** and **Mobile** using the switcher in that page's header. The two views share one session, so a change made in one must appear in the other.

---

## 1. Clock In and Out — job details

**TC-1.1 — A punch is refused until the required details are filled (Desktop)**
1. Go to **Time → Clock In and Out**.
2. Without touching the form, click **CLOCK IN**.

Expected: the punch is refused and the timer stays at `00:00:00` / **Not Clocked In**. The page scrolls to the Job Details card, which shows a red alert titled **"Add job details before clocking in"** with **"Still needed: Job, Phase, Crew, Department."** Each of those four fields shows a red **Required** message. Travel, Quantity, Per Diem, and Comment are *not* listed — they are optional.

**TC-1.2 — Filling the fields clears the errors and allows the punch**
1. Continuing from TC-1.1, choose a value for Crew, Department, Job, and Phase.
2. Click **CLOCK IN**.

Expected: the alert and all **Required** messages disappear as soon as the last field is set. The punch succeeds, the button becomes **CLOCK OUT**, and the right-hand panel shows **On the Clock** with the job and phase codes.

**TC-1.3 — The mobile punch opens the details sheet itself**
1. Reload the page, go to **Clock In and Out**, and switch to **Mobile**.
2. Press **CLOCK IN** without entering anything.

Expected: the punch is refused and the **Job Details** bottom sheet opens on its own, showing **"Add Job, Phase, Crew, Department to clock in."** with red borders on the four empty pickers. Behind the sheet, the Job Details card header shows a **4 missing** badge and its action reads **Add** rather than **Edit**.

**TC-1.4 — Optional fields never block a punch**
1. Fill only the four required fields and leave Travel, Quantity, Per Diem, and Comment untouched.

Expected: clocking in succeeds. On mobile, the chip row under the details (Travel / Qty / Per Diem / Comment added) is hidden entirely while those values are empty, and each chip appears only once its value is set.

---

## 2. Clock In and Out — location and geofence

**TC-2.1 — No job means no site**
1. Reload and open **Clock In and Out** with Job Details empty.

Expected: the site strip at the bottom of the Job Details card reads **"Select a job to check its site."** in grey, and the **Simulate** toggle is hidden because there is no geofence to test against.

**TC-2.2 — The site follows the selected job**
1. Set Job to **003699 - AEP Carrollton Sub**, then change it to **003700 - Job B**, then **003701 - Job C**.

Expected: the strip turns green and names the matching site each time — AEP Carrollton Substation (150 m), Richardson Yard (200 m), Plano Transfer Station (120 m). Every selectable job has a site; none should ever show as unmapped.

**TC-2.3 — An off-site punch warns, is allowed, and is flagged**
1. Fill the required details, then set **Simulate** to **Off site** and wait for the strip to settle.
2. Click **CLOCK IN**.

Expected: the strip turns amber and reads the distance away plus "outside the … radius". A dialog titled **"You're Away From the Job Site"** appears, stating the distance and that the entry will be flagged, and offering **Clock In Anyway** and **Cancel**.
3. Click **Cancel**.

Expected: no punch is recorded.
4. Click **CLOCK IN** again, then **Clock In Anyway**.

Expected: the punch is recorded, an amber "Clocked in off site — Flagged for supervisor review" banner appears, and the timeline entry carries a **Flagged** badge with the distance from the site.

**TC-2.4 — An on-site punch is not flagged**
1. Repeat TC-2.3 with **Simulate** set to **On site**.

Expected: no dialog, no banner, and the timeline entry records the site name and distance with no **Flagged** badge.

---

## 3. Clock In and Out — breaks and on-duty meal

**TC-3.1 — Break reminder**
1. Clock in and wait about 30 seconds.

Expected: a **Break Reminder** prompt appears offering **Take Break**.

**TC-3.2 — Ending a break early warns first**
1. Start a break, then immediately press **END BREAK**.

Expected: a **"Clocking Back In Early"** prompt appears showing the time remaining, with **Confirm Early Clock In** and **Wait — Stay on Break**. **Wait** keeps the break running; **Confirm** returns you to the clock. Waiting the full 30 seconds and then ending the break should not prompt at all.

**TC-3.3 — On-duty meal requires acknowledgement**
1. While clocked in, choose **On-Duty Meal**.

Expected: the prompt notes the waiver is assigned and that you stay clocked in and paid. **Start On-Duty Meal** is disabled until the "I agree to take my meal on duty today" box is ticked.
2. Tick the box and start the meal.

Expected: the status becomes an on-duty meal state, the timer keeps running, and the timeline records the meal start and end.

**TC-3.4 — Button spacing in the mobile sheets**
1. In **Mobile**, open the off-site, on-duty meal, and early-break sheets in turn.

Expected: in each sheet there is a visible gap between the stacked primary and secondary buttons. They must not sit flush against each other.

---

## 4. Daily attestation

**TC-4.1 — Attesting on desktop**
1. On **Clock In and Out**, scroll to the **Daily Attestation** panel above the timesheet.

Expected: it shows **0/4** with Tue 22, Wed 23, Thu 24, and Mon 28 marked incomplete.
2. Click a date, answer the questions, and submit.

Expected: **Submit** is refused until the breaks question is answered *and* its required comment is filled. After submitting, that date turns green and the counter increments.

**TC-4.2 — Attesting on mobile**
1. In **Mobile**, scroll to the **Daily Attestation** card and tap a date.

Expected: a bottom sheet titled **"Hello Adam!"** opens with the shift totals and the same two questions. **Submit** stays greyed out until both questions are answered and the breaks comment is filled.
2. Complete and submit.

Expected: the date turns green and the counter increments.

> Known difference: desktop currently accepts a submission without an answer to the injury question, while mobile requires it. Both mark the question with an asterisk. Treat this as a known inconsistency to be settled rather than a new defect.

**TC-4.3 — Attestations carry across views**
1. Attest a date in **Mobile**, then switch to **Desktop**.

Expected: the same date is already green in the desktop panel and both show the same count. The reverse direction must behave the same way.

---

## 5. Desktop / Mobile parity

**TC-5.1 — One session behind two views**
1. Clock in on **Desktop**, set Travel, Per Diem, and a comment, then switch to **Mobile**.

Expected: the mobile view shows the running timer, the same elapsed time, and the same job details. Switching views must never clock you in or out, reset the timer, or clear the form.

**TC-5.2 — Editing in either view updates the other**
1. In **Mobile**, open **Job Details**, change the Job, and press **Done**. Switch to **Desktop**.

Expected: the desktop form shows the new job, and its site strip names the new site.

---

## 6. Settings → Hour Rules

**TC-6.1 — Autosave feedback**
1. On **Timesheet Hour Rules**, change any value and pause for about a second.

Expected: the badge changes from **"Last updated by Admin · July 15, 2026"** to **"Saved at {time}"**. There is no save button and no toast on this page; that is expected.

**TC-6.2 — Rule precedence reordering**
1. Drag the entries in **Hour Rule Precedence** into a different order.

Expected: Company, Union, and State reorder and the new order persists while you stay on the page.

**TC-6.3 — Adding and deleting a State rule set**
1. Under **State Timesheet Hour Rules**, pick a state from **Select a State** and click **Add Rules**.

Expected: an editable rule set appears for that state and a chip for it appears in the configured list. State and Union rule sets show **Daily & Weekly Rules**, **Break Rules**, **Meal Periods**, and **Premiums**, but *not* **Kiosk Break** or **Equipment** — those are Company-only, by design.
2. Click **Delete** on that state.

Expected: the rule set and its chip are removed.
3. Repeat for **Union Timesheet Hour Rules** using **Select a Union**.

Expected: same behavior. The Company rule set has no Delete and cannot be removed.

**TC-6.4 — Meal periods and premiums**
1. Open the **Meal Periods** tab and toggle each meal card, changing triggers between **Relative to shift start** and **Fixed schedule window**.

Expected: the relevant inputs swap and the summary text under each card matches what was configured.
2. Open the **Premiums** tab and switch a violation's pay type to **Flat Dollar Amount**.

Expected: the rate input adapts to the chosen pay type.

---

## 7. Exclusions

**TC-7.1 — Adding an exclusion**
1. Open the **Exclusions** tab and click **Add** on **Jobs To Exclude From Rules**.

Expected: a picker titled **"Exclude a Job"** opens with a Job and a Phase selector, where the phase list adapts to the chosen job and offers an all-phases option.
2. Add it.

Expected: the row appears in the list showing the code and its description.

**TC-7.2 — Duplicates are rejected**
1. Add the same job and phase combination a second time.

Expected: the message **"This is already on the exclusion list."** appears and no duplicate row is created.

**TC-7.3 — Removing an exclusion**
1. Remove a row with the trash control.

Expected: the row disappears; emptying a section shows **"No excluded items configured."**
2. Repeat TC-7.1 to TC-7.3 for **Phases To Exclude From Rules** and **Rate Levels To Exclude From Rules**.

---

## 8. On-Duty Meal employee assignment

Reach this at **Settings → Hour Rules → Meal Periods → On-Duty Meal → Manage employees**.

**TC-8.1 — Assignment only, no signing**
Expected: the modal is titled **"On-Duty Meal Employees"** and every employee is either **Assigned** or **Not assigned**. There is no signed/unsigned concept anywhere — the admin assigns the waiver, and there is no mechanism for an employee to sign it.

**TC-8.2 — Filtering the roster**
1. Use the **Cost Center**, **Department**, and **Title** filters, alone and in combination, plus the **Search name or title** box.

Expected: the table narrows correctly, and the counts on the **All / Assigned / Not assigned** chips reflect the filtered population rather than the whole roster. **Clear filters** appears once a filter is set and restores the full list.

**TC-8.3 — Pagination and saving**
1. Clear the filters and page through the roster, then assign and unassign a few employees and click **Save**.

Expected: pages show 8 employees at a time with an accurate "1–8 of N" range; a filter combination that matches nothing shows **"No employees match these filters."** The footer count of assigned employees updates as you toggle, and saving returns you to the settings page with the assignment count reflected on the card.

---

## 9. Compliance Dashboard

**TC-9.1 — Summary cards filter the table**
1. Open **Time → Compliance Dashboard** and click **Upcoming Break**, then **Missed Break**, then **Late Break**.

Expected: the table filters to that category and the card reads as selected. Clicking the selected card again clears the filter. An employee can legitimately appear under more than one category, so overlapping counts are not a defect.

**TC-9.2 — Filters**
1. Apply the search box and the Employee, Crew, Supervisor, PM, Job, and Cost Center filters.

Expected: the table narrows, the footer **"Showing X of Y employees"** stays accurate, and **Clear filters** restores everything. With no matches, the table shows **"No exceptions to display."**

**TC-9.3 — Sending alerts**
1. Click **Send Alert** on a row with an **Upcoming** or **Missed** status.

Expected: the button becomes a disabled **Notified**. Rows that are **Late** or **On time** offer no alert action.
2. Select several employees with the checkboxes and use the toolbar **Send Alert (N)**.

Expected: a success toast reads **"Alert sent to N employee(s)"** and the toolbar reflects the selection count with a **Deselect all** option.

---

## 10. Cross-cutting checks

**TC-10.1 — Navigation.** Every left-nav item opens without a blank screen or console error. Implemented pages render real content; the rest show "This page is under construction."

**TC-10.2 — Console.** Complete the clock in / break / meal / clock out cycle in both views with devtools open. Expected: no React errors or warnings.

**TC-10.3 — Keyboard and focus.** Selects, checkboxes, and buttons are reachable by Tab and operable by keyboard, and focus is visible. Every dialog and bottom sheet closes on a backdrop click. Escape closes the exclusion picker and the on-duty employee modal; the clock dialogs currently close only via their own buttons or the backdrop, so that is a known gap rather than a regression.

**TC-10.4 — Layout.** At roughly 1280 px and 1440 px the desktop layout holds without clipped controls or horizontal scrolling. The mobile view is a fixed 390 × 844 frame and is expected to keep those proportions rather than adapt to the browser width.
