# BudgetBloom — Smart Budget Planner

> A modern, elegant personal finance planner engineered with an emerald green and warm cream palette. Track expenses, manage monthly budget limits, analyze category breakdowns, and cultivate mindful financial balance.

![License: MIT](https://img.shields.io/badge/License-MIT-047857.svg)
![Vanilla JavaScript](https://img.shields.io/badge/Tech-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-064e3b.svg)
![Storage](https://img.shields.io/badge/Storage-Browser%20LocalStorage-10b981.svg)

---

## 1. Project Overview & Problem Statement

Managing personal finances often feels overwhelming due to cluttered spreadsheets, subscription-heavy apps with privacy concerns, or rigid interfaces that don't respect per-month budgeting.

**BudgetBloom** solves this by providing:
- **Zero-Barrier Financial Clarity:** An intuitive, single-page application with immediate real-time feedback.
- **Privacy-First Architecture:** 100% client-side data persistence via browser LocalStorage. No user passwords, no remote backend servers, and zero telemetry.
- **Strict Per-Month Isolation:** Every month maintains its own budget ceiling and transactions without cross-contamination.
- **Portfolio-Grade Aesthetics:** Crafted with a soothing emerald green and warm cream aesthetic, refined typography, and smooth micro-interactions.

---

## 2. Features

### A. Dynamic Dashboard
- **Real-Time KPIs:** Live calculations for Total Monthly Budget, Total Expenses, Remaining Balance, and Percentage Utilized.
- **Visual Progress Indicator:** Dynamically color-coded progress bars (Emerald `< 75%`, Warm Amber `75% - 99%`, Crimson Rose `≥ 100%`).
- **Recent Transactions Feed:** Instant overview of recent purchases with category indicators and formatted currency.
- **Category Spending Meters:** Visual progress bars displaying expense distribution across categories.
- **Pacing & Daily Average:** Real-time calculation of daily spending pace and remaining days in the active month.

### B. Expense Management
- **Add / Edit / Delete:** Full CRUD workflow with responsive modals, accessible focus trapping, and confirmation dialogs.
- **Validation:** Strict field validation rejecting empty descriptions, non-positive numbers, and missing categories.
- **Search & Multi-Filter:** Real-time search across titles, amounts, and notes; filter by category and month; sort by date, amount, or name.
- **XSS Protection:** Escaped user inputs preventing malicious HTML injection.

### C. Monthly Budget Management
- **Overall Budget Ceiling:** Set a dedicated monthly limit with quick one-click preset pills (₹20,000, ₹35,000, ₹50,000, ₹75,000).
- **8 Distinct Category Allocations:** Set individual spending ceilings for **Food**, **Transport**, **Shopping**, **Education**, **Bills**, **Health**, **Entertainment**, and **Other**.
- **Visual Health Warnings:** Instant alerts when spending approaches 80% or exceeds category limits.
- **Per-Month Budget Scoping:** Each calendar month maintains independent budget targets.

### D. Analytics & Smart Insights
- **Category Doughnut Chart:** Interactive breakdown of spending by category using Chart.js (with offline fallback).
- **Budget vs Actual Comparison:** Grouped bar chart comparing category limits against actual outlays.
- **6-Month Historical Trend:** Multi-month bar and line chart illustrating long-term spending patterns.
- **Data-Driven Insights:** Automated financial tips evaluating category concentration, budget overrun risks, and projected end-of-month spend.

### E. Quality & Usability
- **Light / Dark Mode:** Toggle between rich emerald warm cream and deep forest dark theme with persistent storage.
- **Multi-Currency:** Instant toggle between Indian Rupee (**INR ₹**) and US Dollar (**USD $**) using localized formatting.
- **One-Click Demo Data:** Pre-loads realistic sample transactions and budgets across multiple months for testing.
- **RFC 4180 CSV Export:** Export monthly transactions with UTF-8 BOM encoding for seamless Microsoft Excel and Google Sheets compatibility.
- **The 50/30/20 Rule Guide:** Interactive calculator in the About section dynamically calculating recommended allocations for Needs, Wants, and Savings based on the active budget.

---

## 3. Technology Stack

- **HTML5:** Semantic markup, accessible attributes (`aria-*`, `role`), and SVG icon sprites.
- **CSS3:** Custom CSS variables for light/dark theming, CSS Grid, Flexbox, responsive typography, and micro-animations.
- **Vanilla JavaScript (ES6+):** Pure functional architecture, modular event delegation, no framework overhead.
- **Chart.js (v4.4 via CDN):** Responsive data visualization with built-in offline SVG fallback.
- **Browser LocalStorage:** Robust JSON schema persistence with graceful corruption fallbacks.

---

## 4. How to Run the Application

BudgetBloom requires **no build steps, Node.js, or server installation**.

### Option 1: Direct Browser Launch
1. Clone or download the repository.
2. Open the `BudgetBloom` folder.
3. Double-click `index.html` (or right-click → Open with Chrome / Edge / Firefox / Safari).

### Option 2: Local HTTP Server (Optional)
If you prefer running through a lightweight local server:
```bash
# Using Python 3:
cd BudgetBloom
python -m http.server 8000

# Open in browser:
# http://localhost:8000
```
or with Node `npx serve`:
```bash
npx serve BudgetBloom
```

---

## 5. Folder Structure

```
BudgetBloom/
├── index.html        # Main semantic markup, modal structures, and SVG icon symbols
├── styles.css        # Emerald & warm cream design system, dark mode, responsive layout
├── script.js         # State management, data persistence, calculations, charts, and events
├── README.md         # Comprehensive project documentation and guides
└── .gitignore        # Standard web project ignores (OS files, editor artifacts)
```

---

## 6. Key Implementation Details

1. **State Isolation by Month:** Data is keyed by `YYYY-MM` (e.g., `2026-10`). When switching months via the sidebar or top dropdown, all metrics, recent items, category bars, and charts re-scope dynamically.
2. **Chart Lifecycle Management:** Chart.js canvas instances are destroyed and recreated cleanly upon theme, month, or transaction changes to prevent memory leaks and "Canvas is already in use" errors.
3. **Resilient Icon Architecture:** Core UI icons are defined in an inline SVG `<symbol>` sprite block in `index.html`. This ensures the application renders icons with zero latency even when offline or behind a strict firewall.
4. **CSV Export with BOM:** The CSV generator injects `\uFEFF` (Byte Order Mark), ensuring special symbols like `₹` and accented characters render accurately in spreadsheet software without encoding glitches.
5. **Safe Input Sanitization:** All user-supplied strings are sanitized through `escapeHTML()` before being inserted into innerHTML to prevent Cross-Site Scripting (XSS).

---

## 7. Current Limitations

- **Browser-Scoped Storage:** Data is saved in the local browser profile; it does not sync across multiple physical devices without manual CSV export/import.
- **Single Currency per Session:** Switching currency changes the display formatting across all amounts; it does not perform live foreign exchange rate conversion.
- **Recurring Transactions:** Recurring automatic transactions (e.g. daily coffee or monthly rent auto-deduct) must be entered manually each month or via the demo dataset.

---

## 8. Suggested Screenshots for Your Portfolio

When showcasing BudgetBloom on GitHub, LinkedIn, or your developer portfolio, consider capturing these 4 screenshots:

1. **Dashboard (Light Mode):** Featuring the emerald metric cards, visual budget utilization meter, recent transactions list, and category spending breakdown.
2. **Analytics & Insights View:** Showcasing the Category Doughnut chart, Budget vs Actual comparison bars, and 6-Month Spending Trend.
3. **Monthly Budget Manager (Dark Mode):** Displaying the category budget grid with progress bars and threshold warnings.
4. **Expense Management & Filter Panel:** Demonstrating the search bar, category dropdown, formatted transaction table, and active modals.

---

## 9. License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) — feel free to use, modify, and present it in your portfolio.
