# Bar Frontend Apple Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static Apple-inspired dashboard prototype for the bar purchasing, inventory, customer storage, and AI Agent system.

**Architecture:** The prototype uses plain HTML, CSS, and JavaScript so it can be opened directly without dependency installation. `index.html` owns semantic page structure, `styles.css` owns visual tokens and responsive layout, and `app.js` owns small stateful interactions for nav, Agent answers, and activity selection.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript.

---

### Task 1: Static Page Structure

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create semantic HTML shell**

Create `index.html` with top navigation, sub navigation, hero metrics, inventory, Agent, storage, activities, supplier, and footer sections.

- [ ] **Step 2: Verify structure**

Run: `Select-String -Path index.html -Pattern '<section|<nav|agent-question|activity-card'`
Expected: output includes section and interactive class names.

### Task 2: Apple-Inspired Styling

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Create design tokens**

Define CSS variables for Action Blue, ink, white canvas, parchment canvas, dark tile, hairlines, spacing, radius, and typography.

- [ ] **Step 2: Style layout and responsive states**

Style full-width alternating sections, black global nav, frosted subnav, restrained cards, CSS bottle visual, and mobile breakpoints.

- [ ] **Step 3: Verify styling references**

Run: `Select-String -Path styles.css -Pattern '#0066cc|global-nav|@media|bottle'`
Expected: output includes design tokens, nav styles, media queries, and bottle visual classes.

### Task 3: Lightweight Interactions

**Files:**
- Create: `app.js`

- [ ] **Step 1: Add nav selected state**

Clicking a nav item updates the active nav class.

- [ ] **Step 2: Add Agent question switching**

Clicking an Agent question updates the answer title, body, and action text.

- [ ] **Step 3: Add activity selection**

Clicking an activity card marks it selected and updates the activity summary.

- [ ] **Step 4: Verify script references**

Run: `Select-String -Path app.js -Pattern 'agentAnswers|activitySummary|addEventListener'`
Expected: output includes interaction state and event listeners.

### Task 4: Local Verification

**Files:**
- Read: `index.html`
- Read: `styles.css`
- Read: `app.js`

- [ ] **Step 1: Check file presence**

Run: `Get-ChildItem -Name index.html, styles.css, app.js`
Expected: all three files are listed.

- [ ] **Step 2: Check HTML links**

Run: `Select-String -Path index.html -Pattern 'styles.css|app.js'`
Expected: both asset references are present.

- [ ] **Step 3: Check git diff**

Run: `git diff --stat`
Expected: output includes `index.html`, `styles.css`, `app.js`, the frontend spec, and this plan.
