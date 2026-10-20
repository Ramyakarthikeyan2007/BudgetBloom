/**
 * BUDGETBLOOM — Smart Budget Planner
 * Modern, Client-Side Personal Finance Application
 * Pure HTML5, CSS3, & Vanilla JavaScript with LocalStorage Persistence
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & DEFAULT CONFIGURATION
  // ==========================================================================
  const STORAGE_KEY = 'budgetbloom_v1_store';

  const CATEGORIES = [
    { id: 'Food', label: 'Food & Dining', icon: 'cat-food', color: '#f97316' },
    { id: 'Transport', label: 'Transportation', icon: 'cat-transport', color: '#0284c7' },
    { id: 'Shopping', label: 'Shopping', icon: 'cat-shopping', color: '#ec4899' },
    { id: 'Education', label: 'Education', icon: 'cat-education', color: '#8b5cf6' },
    { id: 'Bills', label: 'Bills & Utilities', icon: 'cat-bills', color: '#eab308' },
    { id: 'Health', label: 'Healthcare', icon: 'cat-health', color: '#14b8a6' },
    { id: 'Entertainment', label: 'Entertainment', icon: 'cat-entertainment', color: '#6366f1' },
    { id: 'Other', label: 'Other', icon: 'cat-other', color: '#64748b' }
  ];

  const CATEGORY_MAP = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  }, {});

  // ==========================================================================
  // 2. STATE MANAGEMENT
  // ==========================================================================
  const state = {
    expenses: [],
    budgets: {}, // { 'YYYY-MM': { total: 45000, categories: { Food: 8000, ... } } }
    settings: {
      currency: 'INR',
      theme: 'light',
      activeMonth: getCurrentMonthString()
    },
    filters: {
      search: '',
      category: 'all',
      month: 'active', // 'active' or specific 'YYYY-MM' or 'all'
      sortBy: 'date-desc'
    },
    currentView: 'dashboard',
    activeConfirmAction: null
  };

  // Chart instances container
  const chartInstances = {
    pie: null,
    bar: null,
    trend: null
  };

  let chartJsLoading = false;

  function ensureChartJs(callback) {
    if (typeof Chart !== 'undefined') {
      callback(true);
      return;
    }
    if (chartJsLoading) {
      setTimeout(() => callback(typeof Chart !== 'undefined'), 300);
      return;
    }
    chartJsLoading = true;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    script.async = true;
    script.onload = () => {
      chartJsLoading = false;
      callback(true);
    };
    script.onerror = () => {
      chartJsLoading = false;
      console.warn('BudgetBloom: Chart.js CDN did not load. Falling back to clean built-in visualizations.');
      callback(false);
    };
    document.head.appendChild(script);
  }

  // ==========================================================================
  // 3. STORAGE & DATA ACCESS LAYER
  // ==========================================================================
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.expenses)) {
          state.expenses = parsed.expenses;
        }
        if (parsed.budgets && typeof parsed.budgets === 'object') {
          state.budgets = parsed.budgets;
        }
        if (parsed.settings && typeof parsed.settings === 'object') {
          state.settings = Object.assign({}, state.settings, parsed.settings);
        }
      }
    } catch (err) {
      console.warn('BudgetBloom: Could not parse saved LocalStorage data. Resetting to default defaults.', err);
    }

    // Fallback active month if not set
    if (!state.settings.activeMonth) {
      state.settings.activeMonth = getCurrentMonthString();
    }
  }

  function saveState() {
    try {
      const payload = {
        expenses: state.expenses,
        budgets: state.budgets,
        settings: state.settings
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('BudgetBloom: Failed to save to LocalStorage:', err);
      showToast('Could not save data. Browser storage might be restricted or full.', 'error');
    }
  }

  // ==========================================================================
  // 4. UTILITIES & FORMATTERS
  // ==========================================================================
  function getCurrentMonthString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function getMonthLabel(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return monthStr;
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function formatDateFriendly(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatCurrency(amount, currencyCode = null) {
    const cur = currencyCode || state.settings.currency || 'INR';
    const numeric = Number(amount) || 0;

    try {
      if (cur === 'INR') {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 2,
          minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2
        }).format(numeric);
      } else {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
          minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2
        }).format(numeric);
      }
    } catch (e) {
      const sym = cur === 'INR' ? '₹' : '$';
      return `${sym}${numeric.toLocaleString()}`;
    }
  }

  function getCurrencySymbol(cur = null) {
    const c = cur || state.settings.currency;
    return c === 'INR' ? '₹' : '$';
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateUUID() {
    return 'bb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  // ==========================================================================
  // 5. BUDGET HELPERS FOR CURRENT CONTEXT
  // ==========================================================================
  function ensureMonthBudget(monthStr) {
    if (!state.budgets[monthStr]) {
      // Initialize with reasonable defaults
      state.budgets[monthStr] = {
        total: 45000,
        categories: {
          Food: 12000,
          Transport: 4500,
          Shopping: 6000,
          Education: 3000,
          Bills: 8000,
          Health: 3500,
          Entertainment: 5000,
          Other: 3000
        }
      };
    }
    return state.budgets[monthStr];
  }

  function getMonthBudget(monthStr) {
    return state.budgets[monthStr] || null;
  }

  function getExpensesForMonth(monthStr) {
    return state.expenses.filter(item => item.date && item.date.startsWith(monthStr));
  }

  function calculateMonthFinancials(monthStr) {
    const monthExpenses = getExpensesForMonth(monthStr);
    const totalSpent = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const budgetConfig = getMonthBudget(monthStr);
    let totalBudget = 0;

    if (budgetConfig && typeof budgetConfig.total === 'number') {
      totalBudget = budgetConfig.total;
    } else if (budgetConfig && budgetConfig.categories) {
      totalBudget = Object.values(budgetConfig.categories).reduce((sum, val) => sum + (Number(val) || 0), 0);
    }

    const remaining = totalBudget - totalSpent;
    const percentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    // Category-wise totals
    const categoryTotals = {};
    CATEGORIES.forEach(c => { categoryTotals[c.id] = 0; });

    monthExpenses.forEach(item => {
      if (categoryTotals[item.category] !== undefined) {
        categoryTotals[item.category] += Number(item.amount) || 0;
      } else {
        categoryTotals['Other'] = (categoryTotals['Other'] || 0) + (Number(item.amount) || 0);
      }
    });

    return {
      monthStr,
      totalSpent,
      totalBudget,
      remaining,
      percentage,
      categoryTotals,
      transactionCount: monthExpenses.length
    };
  }

  // ==========================================================================
  // 6. UI RENDERERS
  // ==========================================================================

  // Synchronize dynamic headers & currency symbols
  function syncGlobalLabels() {
    const activeMonth = state.settings.activeMonth;
    const monthName = getMonthLabel(activeMonth);
    const curSymbol = getCurrencySymbol();

    // Active Month Heading
    const activeMonthEl = document.getElementById('active-month-heading');
    if (activeMonthEl) activeMonthEl.textContent = monthName;

    // Currency symbols in modals
    document.querySelectorAll('.form-currency-symbol').forEach(el => {
      el.textContent = curSymbol;
    });

    // Sidebar Active Month Selector
    const globalMonthSelect = document.getElementById('global-month-select');
    if (globalMonthSelect && globalMonthSelect.value !== activeMonth) {
      globalMonthSelect.value = activeMonth;
    }

    // Expense Filter Month Selector
    const expMonthSelect = document.getElementById('expense-month-filter');
    if (expMonthSelect && expMonthSelect.value !== activeMonth) {
      expMonthSelect.value = activeMonth;
    }

    // Expense Count badge in sidebar
    const badge = document.getElementById('expenses-count-badge');
    if (badge) {
      const count = getExpensesForMonth(activeMonth).length;
      badge.textContent = count;
    }

    // Sync Currency select value
    const curSelect = document.getElementById('currency-select');
    if (curSelect && curSelect.value !== state.settings.currency) {
      curSelect.value = state.settings.currency;
    }
  }

  // Render Alert Banner when limits approached or exceeded
  function renderAlertBanner(financials) {
    const container = document.getElementById('alert-banner-container');
    if (!container) return;

    container.innerHTML = '';

    // Check overall overrun
    if (financials.totalBudget > 0 && financials.totalSpent > financials.totalBudget) {
      const overBy = financials.totalSpent - financials.totalBudget;
      const banner = document.createElement('div');
      banner.className = 'alert-banner danger';
      banner.innerHTML = `
        <svg class="icon"><use href="#icon-alert"></use></svg>
        <span><strong>Budget Exceeded!</strong> You have surpassed your allocated budget for ${getMonthLabel(financials.monthStr)} by <strong>${formatCurrency(overBy)}</strong>.</span>
        <button class="alert-banner-btn" data-action="manage-budgets">Review Budgets</button>
      `;
      container.appendChild(banner);
      return;
    }

    // Check approaching budget (>= 85%)
    if (financials.totalBudget > 0 && financials.percentage >= 85) {
      const banner = document.createElement('div');
      banner.className = 'alert-banner warning';
      banner.innerHTML = `
        <svg class="icon"><use href="#icon-alert"></use></svg>
        <span><strong>Budget Alert:</strong> You have utilized <strong>${financials.percentage}%</strong> of your monthly allowance with ${formatCurrency(financials.remaining)} remaining.</span>
        <button class="alert-banner-btn" data-action="manage-budgets">Adjust Limits</button>
      `;
      container.appendChild(banner);
      return;
    }

    // Check individual category overruns
    const budgetConfig = getMonthBudget(financials.monthStr);
    if (budgetConfig && budgetConfig.categories) {
      const overCategories = [];
      for (const catId of Object.keys(budgetConfig.categories)) {
        const limit = Number(budgetConfig.categories[catId]) || 0;
        const spent = financials.categoryTotals[catId] || 0;
        if (limit > 0 && spent > limit) {
          overCategories.push({ catId, diff: spent - limit });
        }
      }

      if (overCategories.length > 0) {
        const first = overCategories[0];
        const catInfo = CATEGORY_MAP[first.catId] || { label: first.catId };
        const banner = document.createElement('div');
        banner.className = 'alert-banner warning';
        banner.innerHTML = `
          <svg class="icon"><use href="#icon-alert"></use></svg>
          <span><strong>Category Warning:</strong> Your spending in <strong>${catInfo.label}</strong> exceeded its limit by ${formatCurrency(first.diff)}.</span>
          <button class="alert-banner-btn" data-action="manage-budgets">View Limits</button>
        `;
        container.appendChild(banner);
      }
    }
  }

  // --------------------------------------------------------------------------
  // RENDER VIEW: DASHBOARD
  // --------------------------------------------------------------------------
  function renderDashboard() {
    const activeMonth = state.settings.activeMonth;
    const financials = calculateMonthFinancials(activeMonth);

    // KPI Cards
    const budgetEl = document.getElementById('dash-total-budget');
    const spentEl = document.getElementById('dash-total-spent');
    const remainingEl = document.getElementById('dash-remaining-budget');
    const pctEl = document.getElementById('dash-percentage-text');
    const progressBar = document.getElementById('dash-progress-bar');
    const healthBadge = document.getElementById('dash-health-badge');
    const txCountEl = document.getElementById('dash-tx-count');
    const avgDailyEl = document.getElementById('dash-avg-daily');
    const daysLeftEl = document.getElementById('dash-days-left');
    const paceIndicatorEl = document.getElementById('dash-pace-indicator');

    if (budgetEl) budgetEl.textContent = formatCurrency(financials.totalBudget);
    if (spentEl) spentEl.textContent = formatCurrency(financials.totalSpent);
    if (remainingEl) remainingEl.textContent = formatCurrency(Math.max(0, financials.remaining));
    if (txCountEl) txCountEl.textContent = `${financials.transactionCount} ${financials.transactionCount === 1 ? 'item' : 'items'}`;

    // Average daily spending calculation
    const [y, m] = activeMonth.split('-').map(Number);
    const totalDaysInMonth = new Date(y, m, 0).getDate();
    const today = new Date();
    const isCurrentCalendarMonth = (today.getFullYear() === y && (today.getMonth() + 1) === m);
    const daysElapsed = isCurrentCalendarMonth ? Math.max(1, today.getDate()) : totalDaysInMonth;
    const avgPerDay = financials.totalSpent > 0 ? (financials.totalSpent / daysElapsed) : 0;
    if (avgDailyEl) avgDailyEl.textContent = `Avg ${formatCurrency(avgPerDay)} / day`;

    // Remaining days info
    const daysRemaining = isCurrentCalendarMonth ? Math.max(0, totalDaysInMonth - today.getDate()) : 0;
    if (daysLeftEl) {
      if (isCurrentCalendarMonth) {
        daysLeftEl.textContent = `${daysRemaining} days left in month`;
      } else {
        daysLeftEl.textContent = `Completed period (${totalDaysInMonth} days)`;
      }
    }

    // Progress and Utilization
    const pct = Math.min(100, financials.percentage);
    if (pctEl) pctEl.textContent = `${financials.percentage}%`;
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
      progressBar.className = 'progress-bar-fill';
      if (financials.percentage >= 100) {
        progressBar.classList.add('progress-rose');
      } else if (financials.percentage >= 75) {
        progressBar.classList.add('progress-amber');
      } else {
        progressBar.classList.add('progress-emerald');
      }
    }

    // Health Badge
    if (healthBadge) {
      if (financials.totalBudget === 0) {
        healthBadge.className = 'badge badge-neutral';
        healthBadge.textContent = 'No Budget';
      } else if (financials.totalSpent > financials.totalBudget) {
        healthBadge.className = 'badge badge-danger';
        healthBadge.textContent = 'Over Budget';
      } else if (financials.percentage >= 85) {
        healthBadge.className = 'badge badge-warning';
        healthBadge.textContent = 'Caution';
      } else {
        healthBadge.className = 'badge badge-success';
        healthBadge.textContent = 'On Track';
      }
    }

    if (paceIndicatorEl) {
      if (financials.totalBudget === 0) {
        paceIndicatorEl.textContent = 'Set a budget to track spending pace';
      } else if (financials.totalSpent > financials.totalBudget) {
        paceIndicatorEl.textContent = `Over limit by ${formatCurrency(financials.totalSpent - financials.totalBudget)}`;
      } else {
        paceIndicatorEl.textContent = `${formatCurrency(financials.remaining)} available to spend`;
      }
    }

    // Update Sidebar mini health pill
    const sidebarStatus = document.getElementById('sidebar-status-text');
    const sidebarFill = document.getElementById('sidebar-progress-fill');
    const sidebarSpent = document.getElementById('sidebar-spent-text');
    const sidebarPct = document.getElementById('sidebar-pct-text');
    const sidebarDot = document.querySelector('.sidebar-health-pill .health-dot');

    if (sidebarStatus && sidebarFill && sidebarSpent && sidebarPct && sidebarDot) {
      sidebarSpent.textContent = `${formatCurrency(financials.totalSpent)} spent`;
      sidebarPct.textContent = `${financials.percentage}%`;
      sidebarFill.style.width = `${pct}%`;
      sidebarFill.className = 'health-mini-fill';
      sidebarDot.className = 'health-dot';

      if (financials.totalSpent > financials.totalBudget && financials.totalBudget > 0) {
        sidebarStatus.textContent = 'Over Budget';
        sidebarFill.classList.add('danger');
        sidebarDot.classList.add('danger');
      } else if (financials.percentage >= 85) {
        sidebarStatus.textContent = 'Budget Caution';
        sidebarFill.classList.add('warning');
        sidebarDot.classList.add('warning');
      } else {
        sidebarStatus.textContent = 'Budget On Track';
      }
    }

    // Recent Transactions List (Latest 5 items)
    const recentContainer = document.getElementById('dash-recent-list');
    const monthExpenses = getExpensesForMonth(activeMonth);
    const sortedExpenses = [...monthExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentItems = sortedExpenses.slice(0, 5);

    if (recentContainer) {
      if (recentItems.length === 0) {
        recentContainer.innerHTML = `
          <div class="empty-state" style="padding: 30px 10px;">
            <div class="empty-icon-wrap" style="width: 50px; height: 50px;">
              <svg class="empty-icon" style="width: 24px; height: 24px;"><use href="#icon-expenses"></use></svg>
            </div>
            <h4 class="empty-title" style="font-size: 1rem;">No expenses recorded yet</h4>
            <p class="empty-desc" style="font-size: 0.8rem; margin-bottom: 14px;">Add your first transaction for ${getMonthLabel(activeMonth)} to begin tracking.</p>
            <button class="btn btn-primary btn-sm" id="dash-empty-add-btn">
              <svg class="icon-sm"><use href="#icon-plus"></use></svg>
              <span>+ Add Expense</span>
            </button>
          </div>
        `;
        const addBtn = document.getElementById('dash-empty-add-btn');
        if (addBtn) addBtn.addEventListener('click', openAddExpenseModal);
      } else {
        recentContainer.innerHTML = recentItems.map(item => {
          const cat = CATEGORY_MAP[item.category] || { label: item.category, icon: 'cat-other', color: '#64748b' };
          return `
            <div class="transaction-item" data-id="${item.id}">
              <div class="tx-left">
                <div class="tx-icon-wrap cat-${cat.id || 'Other'}">
                  <svg class="icon"><use href="#${cat.icon}"></use></svg>
                </div>
                <div class="tx-details">
                  <span class="tx-title" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</span>
                  <div class="tx-meta">
                    <span>${formatDateFriendly(item.date)}</span>
                    <span>•</span>
                    <span class="category-badge cat-${cat.id || 'Other'}" style="padding: 1px 6px; font-size: 0.72rem;">${escapeHTML(cat.label)}</span>
                  </div>
                </div>
              </div>
              <div class="tx-amount">${formatCurrency(item.amount)}</div>
            </div>
          `;
        }).join('');
      }
    }

    // Category Spending Breakdown List
    const categoryBreakdownContainer = document.getElementById('dash-category-breakdown');
    if (categoryBreakdownContainer) {
      const budgetConfig = getMonthBudget(activeMonth);
      const activeCats = CATEGORIES.filter(c => (financials.categoryTotals[c.id] || 0) > 0 || (budgetConfig && budgetConfig.categories && budgetConfig.categories[c.id] > 0));

      if (activeCats.length === 0) {
        categoryBreakdownContainer.innerHTML = `
          <div class="empty-state" style="padding: 30px 10px;">
            <p class="empty-desc" style="margin-bottom: 0;">No category spending recorded for this month.</p>
          </div>
        `;
      } else {
        // Sort active categories by spent amount descending
        activeCats.sort((a, b) => (financials.categoryTotals[b.id] || 0) - (financials.categoryTotals[a.id] || 0));

        categoryBreakdownContainer.innerHTML = activeCats.map(cat => {
          const spent = financials.categoryTotals[cat.id] || 0;
          const limit = (budgetConfig && budgetConfig.categories && Number(budgetConfig.categories[cat.id])) || 0;
          const pctOfTotal = financials.totalSpent > 0 ? Math.round((spent / financials.totalSpent) * 100) : 0;
          const pctOfBudget = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : pctOfTotal;

          let barColor = cat.color;
          if (limit > 0 && spent > limit) barColor = 'var(--danger)';
          else if (limit > 0 && spent >= limit * 0.85) barColor = 'var(--warning)';

          return `
            <div class="category-row-item">
              <div class="cat-row-top">
                <span class="cat-row-title">
                  <span class="cat-dot" style="background-color: ${cat.color};"></span>
                  ${cat.label}
                </span>
                <span class="cat-row-amounts">
                  <strong>${formatCurrency(spent)}</strong>
                  ${limit > 0 ? `<span style="color: var(--text-muted); font-weight: 500;"> / ${formatCurrency(limit)}</span>` : `<span style="color: var(--text-muted); font-weight: 500;"> (${pctOfTotal}%)</span>`}
                </span>
              </div>
              <div class="cat-row-bar-track">
                <div class="cat-row-bar-fill" style="width: ${pctOfBudget}%; background-color: ${barColor};"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Quick Insights Ribbon
    const insightTextEl = document.getElementById('dash-quick-insight-text');
    if (insightTextEl) {
      if (financials.totalSpent === 0) {
        insightTextEl.innerHTML = `<strong>Welcome to BudgetBloom!</strong> Track your first expense or click <strong>Load Demo Data</strong> in the sidebar to test all interactive features.`;
      } else {
        // Find highest category
        let highestCatId = null;
        let highestAmount = -1;
        CATEGORIES.forEach(c => {
          const val = financials.categoryTotals[c.id] || 0;
          if (val > highestAmount) {
            highestAmount = val;
            highestCatId = c.id;
          }
        });

        const highestCatName = CATEGORY_MAP[highestCatId]?.label || 'General';
        const highestCatPct = financials.totalSpent > 0 ? Math.round((highestAmount / financials.totalSpent) * 100) : 0;

        if (financials.totalSpent > financials.totalBudget && financials.totalBudget > 0) {
          insightTextEl.innerHTML = `<strong>Attention needed:</strong> You are currently <strong>${formatCurrency(financials.totalSpent - financials.totalBudget)}</strong> over your monthly plan. <strong>${highestCatName}</strong> represents ${highestCatPct}% of your total outlays.`;
        } else if (financials.remaining > 0) {
          insightTextEl.innerHTML = `<strong>On Track:</strong> You have <strong>${formatCurrency(financials.remaining)}</strong> remaining for ${getMonthLabel(activeMonth)}. Your top spending category is <strong>${highestCatName}</strong> (${highestCatPct}%).`;
        } else {
          insightTextEl.innerHTML = `<strong>Steady Progress:</strong> Total recorded spending for ${getMonthLabel(activeMonth)} is <strong>${formatCurrency(financials.totalSpent)}</strong> across ${financials.transactionCount} transactions.`;
        }
      }
    }

    // Render alert banner
    renderAlertBanner(financials);
  }

  // --------------------------------------------------------------------------
  // RENDER VIEW: EXPENSES MANAGEMENT
  // --------------------------------------------------------------------------
  function renderExpensesList() {
    const tableBody = document.getElementById('expenses-table-body');
    const emptyState = document.getElementById('expenses-empty-state');
    const tableCard = document.querySelector('.expenses-table');
    const metaCount = document.getElementById('expense-meta-count');
    const metaTotal = document.getElementById('expense-meta-total');

    if (!tableBody) return;

    // Filter & Sort expenses
    let list = [...state.expenses];

    // Filter by Month
    const monthFilter = state.filters.month;
    if (monthFilter && monthFilter !== 'all') {
      const targetMonth = monthFilter === 'active' ? state.settings.activeMonth : monthFilter;
      list = list.filter(item => item.date && item.date.startsWith(targetMonth));
    }

    // Filter by Category
    if (state.filters.category && state.filters.category !== 'all') {
      list = list.filter(item => item.category === state.filters.category);
    }

    // Filter by Search Query
    if (state.filters.search.trim()) {
      const q = state.filters.search.toLowerCase().trim();
      list = list.filter(item => {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const notesMatch = (item.notes || '').toLowerCase().includes(q);
        const amountMatch = String(item.amount).includes(q);
        return titleMatch || notesMatch || amountMatch;
      });
    }

    // Sorting
    switch (state.filters.sortBy) {
      case 'date-asc':
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case 'amount-desc':
        list.sort((a, b) => Number(b.amount) - Number(a.amount));
        break;
      case 'amount-asc':
        list.sort((a, b) => Number(a.amount) - Number(b.amount));
        break;
      case 'title-asc':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'date-desc':
      default:
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        break;
    }

    // Compute meta sums
    const totalFilteredSum = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    if (metaCount) metaCount.textContent = `Showing ${list.length} ${list.length === 1 ? 'transaction' : 'transactions'}`;
    if (metaTotal) metaTotal.textContent = `Total: ${formatCurrency(totalFilteredSum)}`;

    // Render Table Rows or Empty State
    if (list.length === 0) {
      tableBody.innerHTML = '';
      if (tableCard) tableCard.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'flex';
        const descEl = document.getElementById('expenses-empty-desc');
        if (descEl) {
          if (state.filters.search) {
            descEl.textContent = `No expenses match "${escapeHTML(state.filters.search)}". Try a different search term.`;
          } else {
            descEl.textContent = `You haven't recorded any expenses for ${getMonthLabel(state.settings.activeMonth)}.`;
          }
        }
      }
    } else {
      if (tableCard) tableCard.style.display = 'table';
      if (emptyState) emptyState.style.display = 'none';

      tableBody.innerHTML = list.map(item => {
        const cat = CATEGORY_MAP[item.category] || { label: item.category, icon: 'cat-other', color: '#64748b' };
        return `
          <tr data-id="${item.id}">
            <td class="td-date">${formatDateFriendly(item.date)}</td>
            <td class="td-title-cell">
              <span class="td-title-main">${escapeHTML(item.title)}</span>
              ${item.notes ? `<span class="td-notes" title="${escapeHTML(item.notes)}">${escapeHTML(item.notes)}</span>` : ''}
            </td>
            <td>
              <span class="category-badge cat-${cat.id || 'Other'}">
                <span class="cat-dot"></span>
                ${escapeHTML(cat.label)}
              </span>
            </td>
            <td class="td-amount-val text-right">${formatCurrency(item.amount)}</td>
            <td class="text-center">
              <div class="table-action-btns">
                <button class="action-btn edit-btn" data-action="edit-expense" data-id="${item.id}" title="Edit Expense" aria-label="Edit Expense">
                  <svg class="icon-sm"><use href="#icon-edit"></use></svg>
                </button>
                <button class="action-btn delete-btn" data-action="delete-expense" data-id="${item.id}" title="Delete Expense" aria-label="Delete Expense">
                  <svg class="icon-sm"><use href="#icon-trash"></use></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // --------------------------------------------------------------------------
  // RENDER VIEW: MONTHLY BUDGET MANAGEMENT
  // --------------------------------------------------------------------------
  function renderBudgetsView() {
    const activeMonth = state.settings.activeMonth;
    const financials = calculateMonthFinancials(activeMonth);
    const budgetConfig = ensureMonthBudget(activeMonth);

    // Hero Total Card
    const heroTotalEl = document.getElementById('budget-hero-total');
    const heroMonthEl = document.getElementById('budget-hero-month-name');
    const summaryPill = document.getElementById('category-budget-summary-pill');

    if (heroTotalEl) heroTotalEl.textContent = formatCurrency(financials.totalBudget);
    if (heroMonthEl) heroMonthEl.textContent = getMonthLabel(activeMonth);

    // Calculate sum of category budgets
    const allocatedSum = Object.values(budgetConfig.categories || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    if (summaryPill) {
      summaryPill.textContent = `Category Sum: ${formatCurrency(allocatedSum)} / Overall: ${formatCurrency(financials.totalBudget)}`;
    }

    // Render Grid of Category Cards
    const grid = document.getElementById('category-budget-grid');
    if (!grid) return;

    grid.innerHTML = CATEGORIES.map(cat => {
      const spent = financials.categoryTotals[cat.id] || 0;
      const limit = (budgetConfig.categories && Number(budgetConfig.categories[cat.id])) || 0;
      const remaining = limit - spent;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const progressWidth = limit > 0 ? Math.min(100, pct) : (spent > 0 ? 100 : 0);

      let statusBadge = '';
      let progressClass = 'progress-emerald';

      if (limit === 0) {
        statusBadge = `<span class="badge badge-neutral">No limit set</span>`;
        progressClass = 'progress-emerald';
      } else if (spent > limit) {
        statusBadge = `<span class="badge badge-danger">Over by ${formatCurrency(spent - limit)}</span>`;
        progressClass = 'progress-rose';
      } else if (pct >= 80) {
        statusBadge = `<span class="badge badge-warning">${pct}% Used</span>`;
        progressClass = 'progress-amber';
      } else {
        statusBadge = `<span class="badge badge-success">${pct}% Used</span>`;
        progressClass = 'progress-emerald';
      }

      return `
        <div class="cat-budget-card" data-category="${cat.id}">
          <div class="cat-budget-top">
            <div class="cat-budget-icon-title">
              <div class="cat-budget-icon cat-${cat.id}">
                <svg class="icon"><use href="#${cat.icon}"></use></svg>
              </div>
              <span class="cat-budget-name">${cat.label}</span>
            </div>
            ${statusBadge}
          </div>

          <div class="cat-budget-amounts">
            <span class="cat-budget-spent">${formatCurrency(spent)}</span>
            <span class="cat-budget-limit">Limit: ${limit > 0 ? formatCurrency(limit) : 'Not defined'}</span>
          </div>

          <div class="cat-budget-progress-row">
            <div class="progress-bar-track">
              <div class="progress-bar-fill ${progressClass}" style="width: ${progressWidth}%;"></div>
            </div>
          </div>

          <div class="cat-budget-footer">
            <span class="cat-budget-remaining">
              ${limit > 0 ? (remaining >= 0 ? `${formatCurrency(remaining)} left` : `Exceeded by ${formatCurrency(Math.abs(remaining))}`) : 'Unlimited'}
            </span>
            <button class="cat-budget-edit-btn" data-action="edit-category-budget" data-category="${cat.id}">
              <svg class="icon-sm"><use href="#icon-edit"></use></svg>
              Edit Limit
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --------------------------------------------------------------------------
  // RENDER VIEW: CHARTS & ANALYTICS
  // --------------------------------------------------------------------------
  function renderAnalyticsView() {
    const activeMonth = state.settings.activeMonth;
    const financials = calculateMonthFinancials(activeMonth);
    const budgetConfig = ensureMonthBudget(activeMonth);

    // 1. KPI Cards
    const kpiHighestCat = document.getElementById('kpi-highest-cat');
    const kpiHighestAmount = document.getElementById('kpi-highest-cat-amount');
    const kpiDailyAvg = document.getElementById('kpi-daily-avg');
    const kpiProjectedSpend = document.getElementById('kpi-projected-spend');
    const kpiAdherence = document.getElementById('kpi-adherence-pct');
    const kpiAdherenceSub = document.getElementById('kpi-adherence-sub');

    // Find highest expense category
    let maxCat = null;
    let maxSpent = 0;
    CATEGORIES.forEach(c => {
      const v = financials.categoryTotals[c.id] || 0;
      if (v > maxSpent) {
        maxSpent = v;
        maxCat = c;
      }
    });

    if (kpiHighestCat) kpiHighestCat.textContent = maxCat ? maxCat.label : 'None';
    if (kpiHighestAmount) {
      const pct = financials.totalSpent > 0 ? Math.round((maxSpent / financials.totalSpent) * 100) : 0;
      kpiHighestAmount.textContent = `${formatCurrency(maxSpent)} (${pct}% of total)`;
    }

    // Daily Avg & Projections
    const [y, m] = activeMonth.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    const now = new Date();
    const isCurrentMonth = (now.getFullYear() === y && (now.getMonth() + 1) === m);
    const daysElapsed = isCurrentMonth ? Math.max(1, now.getDate()) : totalDays;
    const dailyAvg = financials.totalSpent > 0 ? (financials.totalSpent / daysElapsed) : 0;
    const projectedTotal = dailyAvg * totalDays;

    if (kpiDailyAvg) kpiDailyAvg.textContent = formatCurrency(dailyAvg);
    if (kpiProjectedSpend) kpiProjectedSpend.textContent = formatCurrency(projectedTotal);

    // Budget Adherence
    if (kpiAdherence && kpiAdherenceSub) {
      if (financials.totalBudget > 0) {
        if (financials.totalSpent <= financials.totalBudget) {
          const remPct = Math.round(((financials.totalBudget - financials.totalSpent) / financials.totalBudget) * 100);
          kpiAdherence.textContent = `${100 - financials.percentage}%`;
          kpiAdherenceSub.textContent = 'Budget headroom remaining';
        } else {
          kpiAdherence.textContent = `-${financials.percentage - 100}%`;
          kpiAdherenceSub.textContent = 'Exceeded planned budget';
        }
      } else {
        kpiAdherence.textContent = '—';
        kpiAdherenceSub.textContent = 'No budget configured';
      }
    }

    // 2. Charts Rendering via Chart.js with Offline Safe Fallback
    renderCharts(financials, budgetConfig);

    // 3. Smart Actionable Insights List
    renderSmartInsights(financials, budgetConfig, maxCat, maxSpent, projectedTotal);
  }

  function renderCharts(financials, budgetConfig) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#a3c4b5' : '#4a6356';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
      ensureChartJs((loaded) => {
        if (loaded && state.currentView === 'analytics') {
          renderCharts(financials, budgetConfig);
        }
      });
      renderOfflineChartFallbacks(financials, budgetConfig);
      return;
    }

    // ----------------------------------------------------
    // Chart 1: Category Spending Doughnut
    // ----------------------------------------------------
    const pieCanvas = document.getElementById('categoryPieChart');
    const pieEmpty = document.getElementById('chart-pie-empty');
    const pieContainer = document.getElementById('chart-pie-container');

    if (pieCanvas) {
      if (chartInstances.pie) {
        chartInstances.pie.destroy();
        chartInstances.pie = null;
      }

      const activeCategories = CATEGORIES.filter(c => (financials.categoryTotals[c.id] || 0) > 0);

      if (activeCategories.length === 0) {
        if (pieCanvas) pieCanvas.style.display = 'none';
        if (pieEmpty) pieEmpty.style.display = 'flex';
      } else {
        if (pieCanvas) pieCanvas.style.display = 'block';
        if (pieEmpty) pieEmpty.style.display = 'none';

        const labels = activeCategories.map(c => c.label);
        const dataValues = activeCategories.map(c => financials.categoryTotals[c.id] || 0);
        const bgColors = activeCategories.map(c => c.color);

        chartInstances.pie = new Chart(pieCanvas, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: dataValues,
              backgroundColor: bgColors,
              borderColor: isDark ? '#122822' : '#ffffff',
              borderWidth: 2,
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  color: textColor,
                  font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 },
                  padding: 12,
                  boxWidth: 12,
                  boxHeight: 12
                }
              },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    const val = ctx.parsed || 0;
                    const pct = financials.totalSpent > 0 ? Math.round((val / financials.totalSpent) * 100) : 0;
                    return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
                  }
                }
              }
            },
            cutout: '62%'
          }
        });
      }
    }

    // ----------------------------------------------------
    // Chart 2: Budget vs Actual Bar Chart
    // ----------------------------------------------------
    const barCanvas = document.getElementById('budgetComparisonChart');
    const barEmpty = document.getElementById('chart-bar-empty');

    if (barCanvas) {
      if (chartInstances.bar) {
        chartInstances.bar.destroy();
        chartInstances.bar = null;
      }

      // Show categories that have either spending or a budget
      const relevantCats = CATEGORIES.filter(c => {
        const spent = financials.categoryTotals[c.id] || 0;
        const limit = (budgetConfig.categories && budgetConfig.categories[c.id]) || 0;
        return spent > 0 || limit > 0;
      });

      if (relevantCats.length === 0) {
        if (barCanvas) barCanvas.style.display = 'none';
        if (barEmpty) barEmpty.style.display = 'flex';
      } else {
        if (barCanvas) barCanvas.style.display = 'block';
        if (barEmpty) barEmpty.style.display = 'none';

        const labels = relevantCats.map(c => c.label);
        const actualData = relevantCats.map(c => financials.categoryTotals[c.id] || 0);
        const budgetData = relevantCats.map(c => (budgetConfig.categories && budgetConfig.categories[c.id]) || 0);

        chartInstances.bar = new Chart(barCanvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Budget Limit',
                data: budgetData,
                backgroundColor: isDark ? 'rgba(52, 211, 153, 0.35)' : 'rgba(6, 78, 59, 0.25)',
                borderColor: isDark ? '#34d399' : '#047857',
                borderWidth: 1.5,
                borderRadius: 6
              },
              {
                label: 'Actual Spent',
                data: actualData,
                backgroundColor: isDark ? '#34d399' : '#047857',
                borderRadius: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: textColor, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
              },
              y: {
                grid: { color: gridColor },
                ticks: {
                  color: textColor,
                  callback: val => formatCurrency(val)
                }
              }
            },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  color: textColor,
                  font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 }
                }
              },
              tooltip: {
                callbacks: {
                  label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
                }
              }
            }
          }
        });
      }
    }

    // ----------------------------------------------------
    // Chart 3: 6-Month Spending Trend
    // ----------------------------------------------------
    const trendCanvas = document.getElementById('monthlyTrendChart');

    if (trendCanvas) {
      if (chartInstances.trend) {
        chartInstances.trend.destroy();
        chartInstances.trend = null;
      }

      // Calculate past 6 calendar months
      const months = [];
      const [curYear, curMonth] = state.settings.activeMonth.split('-').map(Number);

      for (let i = 5; i >= 0; i--) {
        const d = new Date(curYear, curMonth - 1 - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
      }

      const trendLabels = months.map(mStr => {
        const [y, m] = mStr.split('-');
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      });

      const trendSpendData = months.map(mStr => {
        return getExpensesForMonth(mStr).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      });

      const trendBudgetData = months.map(mStr => {
        const b = getMonthBudget(mStr);
        return b ? b.total : 0;
      });

      chartInstances.trend = new Chart(trendCanvas, {
        type: 'bar',
        data: {
          labels: trendLabels,
          datasets: [
            {
              type: 'line',
              label: 'Monthly Budget',
              data: trendBudgetData,
              borderColor: isDark ? '#fbbf24' : '#d97706',
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 4,
              pointBackgroundColor: isDark ? '#fbbf24' : '#d97706',
              fill: false,
              tension: 0.1
            },
            {
              type: 'bar',
              label: 'Total Expenses',
              data: trendSpendData,
              backgroundColor: isDark ? '#34d399' : '#059669',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 } }
            },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                callback: val => formatCurrency(val)
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: textColor,
                font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 }
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
              }
            }
          }
        }
      });
    }
  }

  // Graceful offline fallback if Chart.js CDN fails
  function renderOfflineChartFallbacks(financials, budgetConfig) {
    const pieCanvas = document.getElementById('categoryPieChart');
    const barCanvas = document.getElementById('budgetComparisonChart');
    if (pieCanvas && pieCanvas.parentElement) {
      pieCanvas.parentElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted);">
          <p><strong>Offline Fallback Mode:</strong> Category Breakdown:</p>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px; text-align: left;">
            ${CATEGORIES.map(c => `
              <div style="display:flex; justify-content:space-between; font-size: 0.85rem;">
                <span>${c.label}</span>
                <strong>${formatCurrency(financials.categoryTotals[c.id] || 0)}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    if (barCanvas && barCanvas.parentElement) {
      barCanvas.parentElement.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted);">
          <p>Chart.js is offline. Budget: <strong>${formatCurrency(financials.totalBudget)}</strong> | Spent: <strong>${formatCurrency(financials.totalSpent)}</strong></p>
        </div>
      `;
    }
  }

  // Smart actionable insights generator
  function renderSmartInsights(financials, budgetConfig, maxCat, maxSpent, projectedTotal) {
    const container = document.getElementById('analytics-insights-list');
    if (!container) return;

    const insights = [];

    // Rule 1: Over Budget or Approaching
    if (financials.totalBudget > 0 && financials.totalSpent > financials.totalBudget) {
      insights.push({
        type: 'danger',
        icon: 'icon-alert',
        text: `<strong>Budget Overrun:</strong> You have spent <strong>${formatCurrency(financials.totalSpent - financials.totalBudget)}</strong> more than your target ceiling for ${getMonthLabel(financials.monthStr)}. Consider reallocating discretionary expenses in Shopping or Entertainment.`
      });
    } else if (financials.totalBudget > 0 && financials.percentage >= 85) {
      insights.push({
        type: 'warning',
        icon: 'icon-alert',
        text: `<strong>Threshold Notice:</strong> You have consumed <strong>${financials.percentage}%</strong> of your monthly allocation. Slowing down your discretionary transactions will prevent an end-of-month overrun.`
      });
    } else if (financials.totalBudget > 0) {
      insights.push({
        type: 'success',
        icon: 'icon-check',
        text: `<strong>Healthy Financial Discipline:</strong> You have <strong>${formatCurrency(financials.remaining)}</strong> available in reserve (${100 - financials.percentage}% unspent). You are maintaining a sound buffer.`
      });
    }

    // Rule 2: Top Category dominance
    if (maxCat && maxSpent > 0 && financials.totalSpent > 0) {
      const pct = Math.round((maxSpent / financials.totalSpent) * 100);
      if (pct >= 40) {
        insights.push({
          type: 'info',
          icon: 'icon-sparkles',
          text: `<strong>Category Concentration:</strong> <strong>${maxCat.label}</strong> makes up <strong>${pct}%</strong> of your entire monthly spending (${formatCurrency(maxSpent)}). Examine if this aligns with your essential living requirements.`
        });
      }
    }

    // Rule 3: Projected Spend Rate
    if (financials.totalBudget > 0 && projectedTotal > financials.totalBudget && financials.totalSpent < financials.totalBudget) {
      insights.push({
        type: 'warning',
        icon: 'icon-sparkles',
        text: `<strong>Pacing Projection:</strong> At your current average pace of <strong>${formatCurrency(financials.totalSpent > 0 ? (financials.totalSpent / Math.max(1, new Date().getDate())) : 0)}/day</strong>, you are projected to reach <strong>${formatCurrency(projectedTotal)}</strong> by month-end, exceeding your budget by ${formatCurrency(projectedTotal - financials.totalBudget)}.`
      });
    }

    // Rule 4: Zero expenses empty advice
    if (financials.totalSpent === 0) {
      insights.push({
        type: 'info',
        icon: 'icon-sparkles',
        text: `<strong>No Expenses Recorded:</strong> You haven't added expenses for this month yet. Begin entering receipts or click <strong>Load Demo Data</strong> to simulate complete analytical reporting.`
      });
    }

    container.innerHTML = insights.map(item => `
      <div class="insight-item">
        <div class="insight-icon cat-${item.type === 'danger' ? 'Shopping' : (item.type === 'warning' ? 'Bills' : 'Health')}">
          <svg class="icon-sm"><use href="#${item.icon}"></use></svg>
        </div>
        <div class="insight-text">${item.text}</div>
      </div>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // RENDER VIEW: ABOUT & 50/30/20 CALCULATOR
  // --------------------------------------------------------------------------
  function renderAboutView() {
    const activeMonth = state.settings.activeMonth;
    const financials = calculateMonthFinancials(activeMonth);
    const baseBudget = financials.totalBudget > 0 ? financials.totalBudget : 50000;

    const needsEl = document.getElementById('rule-calc-needs');
    const wantsEl = document.getElementById('rule-calc-wants');
    const savingsEl = document.getElementById('rule-calc-savings');

    if (needsEl) needsEl.textContent = formatCurrency(baseBudget * 0.50);
    if (wantsEl) wantsEl.textContent = formatCurrency(baseBudget * 0.30);
    if (savingsEl) savingsEl.textContent = formatCurrency(baseBudget * 0.20);
  }

  // --------------------------------------------------------------------------
  // MASTER RENDER DISPATCHER
  // --------------------------------------------------------------------------
  function renderAll() {
    syncGlobalLabels();

    // Render all view DOMs so all sections remain in perfect sync
    renderDashboard();
    renderExpensesList();
    renderBudgetsView();
    renderAboutView();

    // Only render/resize Chart.js canvas when Analytics view is visible
    if (state.currentView === 'analytics') {
      renderAnalyticsView();
    }
  }

  // ==========================================================================
  // 7. TOAST NOTIFICATION SYSTEM
  // ==========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconId = 'icon-sparkles';
    if (type === 'success') iconId = 'icon-check';
    else if (type === 'error') iconId = 'icon-alert';
    else if (type === 'warning') iconId = 'icon-alert';

    toast.innerHTML = `
      <svg class="toast-icon"><use href="#${iconId}"></use></svg>
      <span class="toast-message">${escapeHTML(message)}</span>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
      toast.classList.add('hiding');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 200);
    };

    if (closeBtn) closeBtn.addEventListener('click', removeToast);
    setTimeout(removeToast, 3500);
  }

  // ==========================================================================
  // 8. MODAL CONTROLS & FORM HANDLERS
  // ==========================================================================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first input
    const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');

    // Only restore body scrolling if no other modals are active
    if (!document.querySelector('.modal-backdrop.active')) {
      document.body.style.overflow = '';
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
    document.body.style.overflow = '';
  }

  // Generic Confirmation Modal
  function showConfirmDialog(title, message, confirmBtnLabel, onConfirmCallback, isDanger = false) {
    const modal = document.getElementById('confirm-modal-backdrop');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const proceedBtn = document.getElementById('confirm-modal-proceed');

    if (!modal || !titleEl || !messageEl || !proceedBtn) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    proceedBtn.textContent = confirmBtnLabel || 'Confirm';

    proceedBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

    state.activeConfirmAction = onConfirmCallback;
    openModal('confirm-modal-backdrop');
  }

  // --- Add / Edit Expense Modal ---
  function openAddExpenseModal() {
    const form = document.getElementById('expense-form');
    if (!form) return;

    form.reset();
    document.getElementById('expense-id-input').value = '';
    document.getElementById('expense-modal-title').textContent = 'Add New Expense';

    // Reset error classes
    form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

    // Default date to today or 1st of active month if viewing a past/future month
    const activeMonth = state.settings.activeMonth;
    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr.startsWith(activeMonth)) {
      document.getElementById('expense-date-input').value = todayStr;
    } else {
      document.getElementById('expense-date-input').value = `${activeMonth}-01`;
    }

    openModal('expense-modal-backdrop');
  }

  function openEditExpenseModal(id) {
    const item = state.expenses.find(x => x.id === id);
    if (!item) {
      showToast('Expense record not found.', 'error');
      return;
    }

    const form = document.getElementById('expense-form');
    if (!form) return;

    form.reset();
    form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

    document.getElementById('expense-id-input').value = item.id;
    document.getElementById('expense-modal-title').textContent = 'Edit Expense';
    document.getElementById('expense-title-input').value = item.title || '';
    document.getElementById('expense-amount-input').value = item.amount || '';
    document.getElementById('expense-category-input').value = item.category || '';
    document.getElementById('expense-date-input').value = item.date || '';
    document.getElementById('expense-notes-input').value = item.notes || '';

    openModal('expense-modal-backdrop');
  }

  function handleExpenseFormSubmit(e) {
    e.preventDefault();

    const form = document.getElementById('expense-form');
    const idInput = document.getElementById('expense-id-input');
    const titleInput = document.getElementById('expense-title-input');
    const amountInput = document.getElementById('expense-amount-input');
    const catInput = document.getElementById('expense-category-input');
    const dateInput = document.getElementById('expense-date-input');
    const notesInput = document.getElementById('expense-notes-input');

    // Validation
    let isValid = true;

    // Reset error states
    form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));

    const titleVal = titleInput.value.trim();
    if (!titleVal) {
      titleInput.closest('.form-group').classList.add('has-error');
      isValid = false;
    }

    const amountVal = parseFloat(amountInput.value);
    if (isNaN(amountVal) || amountVal <= 0) {
      amountInput.closest('.form-group').classList.add('has-error');
      isValid = false;
    }

    const catVal = catInput.value;
    if (!catVal) {
      catInput.closest('.form-group').classList.add('has-error');
      isValid = false;
    }

    const dateVal = dateInput.value;
    if (!dateVal || !dateVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateInput.closest('.form-group').classList.add('has-error');
      isValid = false;
    }

    if (!isValid) return;

    const isEdit = Boolean(idInput.value);

    if (isEdit) {
      const item = state.expenses.find(x => x.id === idInput.value);
      if (item) {
        item.title = titleVal;
        item.amount = Math.round(amountVal * 100) / 100;
        item.category = catVal;
        item.date = dateVal;
        item.notes = notesInput.value.trim();
        item.updatedAt = new Date().toISOString();
        showToast('Expense updated successfully!', 'success');
      }
    } else {
      const newExpense = {
        id: generateUUID(),
        title: titleVal,
        amount: Math.round(amountVal * 100) / 100,
        category: catVal,
        date: dateVal,
        notes: notesInput.value.trim(),
        createdAt: new Date().toISOString()
      };
      state.expenses.unshift(newExpense);
      showToast('Expense added successfully!', 'success');
    }

    saveState();
    closeModal('expense-modal-backdrop');
    renderAll();
  }

  function handleDeleteExpense(id) {
    const item = state.expenses.find(x => x.id === id);
    if (!item) return;

    showConfirmDialog(
      'Delete Expense',
      `Are you sure you want to delete "${item.title}" (${formatCurrency(item.amount)})? This action cannot be undone.`,
      'Delete',
      () => {
        state.expenses = state.expenses.filter(x => x.id !== id);
        saveState();
        renderAll();
        showToast('Expense deleted.', 'info');
      },
      true
    );
  }

  // --- Overall Monthly Budget Modal ---
  function openSetOverallBudgetModal() {
    const activeMonth = state.settings.activeMonth;
    const config = ensureMonthBudget(activeMonth);

    const monthLabelEl = document.getElementById('overall-budget-modal-month');
    const amountInput = document.getElementById('overall-budget-amount-input');
    const form = document.getElementById('overall-budget-form');

    if (monthLabelEl) monthLabelEl.textContent = getMonthLabel(activeMonth);
    if (amountInput) amountInput.value = config.total || 0;
    if (form) form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

    openModal('overall-budget-modal-backdrop');
  }

  function handleOverallBudgetFormSubmit(e) {
    e.preventDefault();
    const amountInput = document.getElementById('overall-budget-amount-input');
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount < 0) {
      amountInput.closest('.form-group').classList.add('has-error');
      return;
    }

    const activeMonth = state.settings.activeMonth;
    const config = ensureMonthBudget(activeMonth);
    config.total = Math.round(amount);

    saveState();
    closeModal('overall-budget-modal-backdrop');
    renderAll();
    showToast(`Monthly budget for ${getMonthLabel(activeMonth)} set to ${formatCurrency(amount)}.`, 'success');
  }

  // --- Category Budget Modal ---
  function openCategoryBudgetModal(catId) {
    const cat = CATEGORY_MAP[catId];
    if (!cat) return;

    const activeMonth = state.settings.activeMonth;
    const config = ensureMonthBudget(activeMonth);

    const catNameEl = document.getElementById('category-budget-target-name');
    const monthEl = document.getElementById('category-budget-modal-month');
    const catTargetInput = document.getElementById('category-budget-target');
    const amountInput = document.getElementById('category-budget-amount-input');
    const form = document.getElementById('category-budget-form');

    if (catNameEl) catNameEl.textContent = cat.label;
    if (monthEl) monthEl.textContent = getMonthLabel(activeMonth);
    if (catTargetInput) catTargetInput.value = cat.id;

    const currentLimit = (config.categories && config.categories[cat.id]) || 0;
    if (amountInput) amountInput.value = currentLimit;
    if (form) form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));

    openModal('category-budget-modal-backdrop');
  }

  function handleCategoryBudgetFormSubmit(e) {
    e.preventDefault();
    const catTargetInput = document.getElementById('category-budget-target');
    const amountInput = document.getElementById('category-budget-amount-input');
    const catId = catTargetInput.value;
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount < 0) {
      amountInput.closest('.form-group').classList.add('has-error');
      return;
    }

    const activeMonth = state.settings.activeMonth;
    const config = ensureMonthBudget(activeMonth);
    if (!config.categories) config.categories = {};
    config.categories[catId] = Math.round(amount);

    saveState();
    closeModal('category-budget-modal-backdrop');
    renderAll();
    showToast(`${CATEGORY_MAP[catId]?.label || catId} limit set to ${formatCurrency(amount)}.`, 'success');
  }

  // ==========================================================================
  // 9. DEMO DATA GENERATOR
  // ==========================================================================
  function loadDemoData() {
    showConfirmDialog(
      'Load Sample Data?',
      'This will populate BudgetBloom with realistic sample transactions, monthly budgets, and category allocations for demonstration. Existing data will be replaced.',
      'Load Demo Data',
      () => {
        const curMonth = getCurrentMonthString();
        const [y, m] = curMonth.split('-').map(Number);

        // Previous month string
        const prevDate = new Date(y, m - 2, 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        // Helper to format date in month
        const dInCur = (day) => `${curMonth}-${String(day).padStart(2, '0')}`;
        const dInPrev = (day) => `${prevMonth}-${String(day).padStart(2, '0')}`;

        const sampleExpenses = [
          // Current Month transactions
          { id: generateUUID(), title: 'Whole Foods Organic Groceries', amount: 3450, category: 'Food', date: dInCur(3), notes: 'Weekly fresh produce & staples' },
          { id: generateUUID(), title: 'Metro Monthly Rail Transit Pass', amount: 1200, category: 'Transport', date: dInCur(4), notes: 'Public transit card reload' },
          { id: generateUUID(), title: 'High-Speed Fiber Internet Bill', amount: 999, category: 'Bills', date: dInCur(5), notes: 'Airtel broadband connection' },
          { id: generateUUID(), title: 'Online Learning Platform Subscription', amount: 1499, category: 'Education', date: dInCur(7), notes: 'Frontend Masterclass subscription' },
          { id: generateUUID(), title: 'Cozy Cafe Brunch & Coffee', amount: 780, category: 'Food', date: dInCur(9), notes: 'Weekend brunch with friends' },
          { id: generateUUID(), title: 'Autumn Wardrobe & Shoes', amount: 3850, category: 'Shopping', date: dInCur(11), notes: 'Winter jacket and footwear' },
          { id: generateUUID(), title: 'Annual Health Checkup & Vitamins', amount: 1650, category: 'Health', date: dInCur(12), notes: 'Pharmacy & blood test panel' },
          { id: generateUUID(), title: 'Cinema Tickets & Popcorn', amount: 850, category: 'Entertainment', date: dInCur(14), notes: 'Weekend IMAX movie' },
          { id: generateUUID(), title: 'Gourmet Dinner with Family', amount: 2600, category: 'Food', date: dInCur(16), notes: 'Celebration dinner' },
          { id: generateUUID(), title: 'Fuel & Car Maintenance', amount: 2200, category: 'Transport', date: dInCur(18), notes: 'Petrol refuel and tire pressure' },
          { id: generateUUID(), title: 'Electricity & Utility Bill', amount: 2450, category: 'Bills', date: dInCur(19), notes: 'State electricity board' },
          { id: generateUUID(), title: 'Books & Programming Manuals', amount: 1100, category: 'Education', date: dInCur(20), notes: 'JavaScript performance guide' },

          // Previous Month transactions
          { id: generateUUID(), title: 'Supermarket Grocery Run', amount: 4800, category: 'Food', date: dInPrev(2), notes: 'Monthly groceries stock' },
          { id: generateUUID(), title: 'Flight Ticket to Tech Conference', amount: 5600, category: 'Transport', date: dInPrev(6), notes: 'Annual developer summit' },
          { id: generateUUID(), title: 'Apartment Utility Maintenance', amount: 2200, category: 'Bills', date: dInPrev(10), notes: 'Water and community fee' },
          { id: generateUUID(), title: 'Noise-Cancelling Headphones', amount: 4500, category: 'Shopping', date: dInPrev(15), notes: 'Productivity equipment' },
          { id: generateUUID(), title: 'Streaming Service Subscriptions', amount: 799, category: 'Entertainment', date: dInPrev(20), notes: 'Netflix & Spotify family' },
          { id: generateUUID(), title: 'Dentist Cleaning & Checkup', amount: 1500, category: 'Health', date: dInPrev(25), notes: 'Routine check' }
        ];

        state.expenses = sampleExpenses;

        // Sample Budgets
        state.budgets = {
          [curMonth]: {
            total: 38000,
            categories: {
              Food: 10000,
              Transport: 4500,
              Shopping: 5000,
              Education: 3000,
              Bills: 6500,
              Health: 3000,
              Entertainment: 3500,
              Other: 2500
            }
          },
          [prevMonth]: {
            total: 35000,
            categories: {
              Food: 9000,
              Transport: 6500,
              Shopping: 5000,
              Education: 2500,
              Bills: 5500,
              Health: 2500,
              Entertainment: 2500,
              Other: 1500
            }
          }
        };

        state.settings.activeMonth = curMonth;
        saveState();
        renderAll();
        showToast('Demo data loaded successfully! Enjoy exploring BudgetBloom.', 'success');
      }
    );
  }

  function clearAllData() {
    showConfirmDialog(
      'Reset All Application Data?',
      'Warning: This will permanently erase all your saved expenses, category budgets, and preferences from LocalStorage. Are you completely sure?',
      'Reset All Data',
      () => {
        state.expenses = [];
        state.budgets = {};
        state.settings.activeMonth = getCurrentMonthString();
        localStorage.removeItem(STORAGE_KEY);
        renderAll();
        showToast('All application data has been wiped clean.', 'info');
      },
      true
    );
  }

  // ==========================================================================
  // 10. CSV EXPORT ENGINE (RFC 4180 Compliant with UTF-8 BOM)
  // ==========================================================================
  function exportExpensesToCSV() {
    const activeMonth = state.settings.activeMonth;
    const monthExpenses = getExpensesForMonth(activeMonth);

    if (monthExpenses.length === 0) {
      showToast(`No expense transactions found in ${getMonthLabel(activeMonth)} to export.`, 'warning');
      return;
    }

    // CSV Headers
    const headers = ['ID', 'Date', 'Description', 'Category', 'Amount', 'Currency', 'Notes'];

    // CSV Rows
    const rows = monthExpenses.map(item => {
      return [
        item.id,
        item.date,
        `"${(item.title || '').replace(/"/g, '""')}"`,
        `"${item.category || ''}"`,
        Number(item.amount).toFixed(2),
        state.settings.currency,
        `"${(item.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    // Prepend UTF-8 BOM (\uFEFF) so Excel & spreadsheet apps render international currency symbols correctly
    const csvContent = '\uFEFF' + headers.join(',') + '\r\n' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', `BudgetBloom_Expenses_${activeMonth}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    showToast(`Exported ${monthExpenses.length} transactions as CSV.`, 'success');
  }

  // ==========================================================================
  // 11. NAVIGATION & VIEW SWITCHING
  // ==========================================================================
  function switchView(viewName) {
    if (!['dashboard', 'expenses', 'budgets', 'analytics', 'about'].includes(viewName)) return;

    state.currentView = viewName;

    // Update Nav buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update View Containers
    document.querySelectorAll('.app-view').forEach(view => {
      if (view.id === `view-${viewName}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update Topbar Title
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const activeMonth = state.settings.activeMonth;
    const monthName = getMonthLabel(activeMonth);

    if (pageTitle) {
      switch (viewName) {
        case 'dashboard':
          pageTitle.textContent = 'Dashboard';
          if (pageSubtitle) pageSubtitle.innerHTML = `Real-time overview of your finances for <span class="active-month-text" id="active-month-heading">${monthName}</span>`;
          break;
        case 'expenses':
          pageTitle.textContent = 'Expenses';
          if (pageSubtitle) pageSubtitle.innerHTML = `Manage, search, and filter transactions for <span class="active-month-text" id="active-month-heading">${monthName}</span>`;
          break;
        case 'budgets':
          pageTitle.textContent = 'Monthly Budgets';
          if (pageSubtitle) pageSubtitle.innerHTML = `Set spending ceilings and prevent overspending for <span class="active-month-text" id="active-month-heading">${monthName}</span>`;
          break;
        case 'analytics':
          pageTitle.textContent = 'Analytics & Insights';
          if (pageSubtitle) pageSubtitle.innerHTML = `Visual charts and data-driven insights for <span class="active-month-text" id="active-month-heading">${monthName}</span>`;
          break;
        case 'about':
          pageTitle.textContent = 'About BudgetBloom';
          if (pageSubtitle) pageSubtitle.innerHTML = 'Privacy-first architecture and the 50/30/20 budgeting philosophy';
          break;
      }
    }

    // Close mobile sidebar if open
    closeMobileSidebar();

    // Render newly selected view
    renderAll();
  }

  function openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  // ==========================================================================
  // 12. MONTH SELECTOR POPULATOR
  // ==========================================================================
  function populateMonthSelectors() {
    const curDate = new Date();
    const curY = curDate.getFullYear();
    const curM = curDate.getMonth(); // 0-based

    // Generate past 11 months, current month, and next 3 months (total 15 months)
    const options = [];
    for (let i = 3; i >= -11; i--) {
      const d = new Date(curY, curM + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${y}-${m}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ val, label, isCurrent: (i === 0) });
    }

    const globalSelect = document.getElementById('global-month-select');
    const expenseMonthFilter = document.getElementById('expense-month-filter');

    const htmlOptions = options.map(opt => {
      const tag = opt.isCurrent ? ' (Current)' : '';
      return `<option value="${opt.val}">${opt.label}${tag}</option>`;
    }).join('');

    if (globalSelect) {
      globalSelect.innerHTML = htmlOptions;
      globalSelect.value = state.settings.activeMonth;
    }

    if (expenseMonthFilter) {
      expenseMonthFilter.innerHTML = `
        <option value="active">Active Month (${getMonthLabel(state.settings.activeMonth)})</option>
        <option value="all">All Months</option>
        ${htmlOptions}
      `;
      expenseMonthFilter.value = 'active';
    }
  }

  // ==========================================================================
  // 13. EVENT LISTENERS INITIALIZATION
  // ==========================================================================
  function initEventListeners() {
    // Nav Items View Switching
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        switchView(view);
      });
    });

    // Mobile Sidebar Toggle & Close
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const mobileClose = document.getElementById('mobile-sidebar-close');
    const mobileBackdrop = document.getElementById('sidebar-backdrop');

    if (mobileToggle) mobileToggle.addEventListener('click', openMobileSidebar);
    if (mobileClose) mobileClose.addEventListener('click', closeMobileSidebar);
    if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileSidebar);

    // Global Month Selector
    const globalMonthSelect = document.getElementById('global-month-select');
    if (globalMonthSelect) {
      globalMonthSelect.addEventListener('change', (e) => {
        state.settings.activeMonth = e.target.value;
        saveState();
        populateMonthSelectors();
        renderAll();
      });
    }

    // Currency Switcher
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) {
      currencySelect.addEventListener('change', (e) => {
        state.settings.currency = e.target.value;
        saveState();
        renderAll();
        showToast(`Currency changed to ${state.settings.currency} (${getCurrencySymbol()}).`, 'info');
      });
    }

    // Theme Toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const nextTheme = state.settings.theme === 'light' ? 'dark' : 'light';
        state.settings.theme = nextTheme;
        document.documentElement.setAttribute('data-theme', nextTheme);
        saveState();
        renderAll();
        showToast(`Switched to ${nextTheme} theme.`, 'info');
      });
    }

    // Demo Data & Reset Data Buttons
    const loadDemoBtn = document.getElementById('load-demo-btn');
    const clearDataBtn = document.getElementById('clear-data-btn');
    const emptyLoadDemoBtn = document.getElementById('empty-load-demo-btn');

    if (loadDemoBtn) loadDemoBtn.addEventListener('click', loadDemoData);
    if (clearDataBtn) clearDataBtn.addEventListener('click', clearAllData);
    if (emptyLoadDemoBtn) emptyLoadDemoBtn.addEventListener('click', loadDemoData);

    // Export CSV Buttons
    const topbarExportBtn = document.getElementById('topbar-export-btn');
    if (topbarExportBtn) topbarExportBtn.addEventListener('click', exportExpensesToCSV);

    // Add Expense Buttons
    const openAddExpenseBtn = document.getElementById('open-add-expense-btn');
    const emptyAddExpenseBtn = document.getElementById('empty-add-expense-btn');
    if (openAddExpenseBtn) openAddExpenseBtn.addEventListener('click', openAddExpenseModal);
    if (emptyAddExpenseBtn) emptyAddExpenseBtn.addEventListener('click', openAddExpenseModal);

    // Add/Edit Expense Form
    const expenseForm = document.getElementById('expense-form');
    const expenseModalClose = document.getElementById('expense-modal-close');
    const expenseCancelBtn = document.getElementById('expense-cancel-btn');
    if (expenseForm) expenseForm.addEventListener('submit', handleExpenseFormSubmit);
    if (expenseModalClose) expenseModalClose.addEventListener('click', () => closeModal('expense-modal-backdrop'));
    if (expenseCancelBtn) expenseCancelBtn.addEventListener('click', () => closeModal('expense-modal-backdrop'));

    // Dashboard Shortcuts
    const dashViewAll = document.getElementById('dash-view-all-expenses');
    const dashManageBudgets = document.getElementById('dash-manage-budgets-btn');
    const dashEditBudgetBtn = document.getElementById('dash-edit-budget-btn');

    if (dashViewAll) dashViewAll.addEventListener('click', () => switchView('expenses'));
    if (dashManageBudgets) dashManageBudgets.addEventListener('click', () => switchView('budgets'));
    if (dashEditBudgetBtn) dashEditBudgetBtn.addEventListener('click', openSetOverallBudgetModal);

    // Dynamic Alert Banner Action Delegation
    const alertBannerContainer = document.getElementById('alert-banner-container');
    if (alertBannerContainer) {
      alertBannerContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="manage-budgets"]');
        if (btn) switchView('budgets');
      });
    }

    // Overall Budget Form
    const openSetOverallBudgetBtn = document.getElementById('open-set-overall-budget-btn');
    const overallBudgetForm = document.getElementById('overall-budget-form');
    const overallBudgetClose = document.getElementById('overall-budget-modal-close');
    const overallBudgetCancel = document.getElementById('overall-budget-cancel-btn');

    if (openSetOverallBudgetBtn) openSetOverallBudgetBtn.addEventListener('click', openSetOverallBudgetModal);
    if (overallBudgetForm) overallBudgetForm.addEventListener('submit', handleOverallBudgetFormSubmit);
    if (overallBudgetClose) overallBudgetClose.addEventListener('click', () => closeModal('overall-budget-modal-backdrop'));
    if (overallBudgetCancel) overallBudgetCancel.addEventListener('click', () => closeModal('overall-budget-modal-backdrop'));

    // Overall Budget Preset Pills
    document.querySelectorAll('.preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const amount = pill.getAttribute('data-amount');
        const amountInput = document.getElementById('overall-budget-amount-input');
        if (amountInput) amountInput.value = amount;
      });
    });

    // Category Budget Form
    const categoryBudgetForm = document.getElementById('category-budget-form');
    const categoryBudgetClose = document.getElementById('category-budget-modal-close');
    const categoryBudgetCancel = document.getElementById('category-budget-cancel-btn');

    if (categoryBudgetForm) categoryBudgetForm.addEventListener('submit', handleCategoryBudgetFormSubmit);
    if (categoryBudgetClose) categoryBudgetClose.addEventListener('click', () => closeModal('category-budget-modal-backdrop'));
    if (categoryBudgetCancel) categoryBudgetCancel.addEventListener('click', () => closeModal('category-budget-modal-backdrop'));

    // Category Grid "Edit Limit" Button Delegation
    const catBudgetGrid = document.getElementById('category-budget-grid');
    if (catBudgetGrid) {
      catBudgetGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="edit-category-budget"]');
        if (btn) {
          const catId = btn.getAttribute('data-category');
          openCategoryBudgetModal(catId);
        }
      });
    }

    // Expenses Table Action Delegation (Edit & Delete)
    const expensesTableBody = document.getElementById('expenses-table-body');
    if (expensesTableBody) {
      expensesTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-action="edit-expense"]');
        if (editBtn) {
          const id = editBtn.getAttribute('data-id');
          openEditExpenseModal(id);
          return;
        }

        const deleteBtn = e.target.closest('[data-action="delete-expense"]');
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-id');
          handleDeleteExpense(id);
          return;
        }
      });
    }

    // Expense Filters & Search
    const searchInput = document.getElementById('expense-search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const catFilter = document.getElementById('expense-cat-filter');
    const monthFilter = document.getElementById('expense-month-filter');
    const sortByFilter = document.getElementById('expense-sort-by');
    const filterResetBtn = document.getElementById('filter-reset-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        if (searchClearBtn) searchClearBtn.style.display = e.target.value ? 'block' : 'none';
        renderExpensesList();
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.filters.search = '';
        searchClearBtn.style.display = 'none';
        renderExpensesList();
      });
    }

    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        renderExpensesList();
      });
    }

    if (monthFilter) {
      monthFilter.addEventListener('change', (e) => {
        state.filters.month = e.target.value;
        renderExpensesList();
      });
    }

    if (sortByFilter) {
      sortByFilter.addEventListener('change', (e) => {
        state.filters.sortBy = e.target.value;
        renderExpensesList();
      });
    }

    if (filterResetBtn) {
      filterResetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (searchClearBtn) searchClearBtn.style.display = 'none';
        if (catFilter) catFilter.value = 'all';
        if (monthFilter) monthFilter.value = 'active';
        if (sortByFilter) sortByFilter.value = 'date-desc';

        state.filters.search = '';
        state.filters.category = 'all';
        state.filters.month = 'active';
        state.filters.sortBy = 'date-desc';

        renderExpensesList();
        showToast('Expense filters reset.', 'info');
      });
    }

    // Confirmation Modal Action Buttons
    const confirmProceed = document.getElementById('confirm-modal-proceed');
    const confirmCancel = document.getElementById('confirm-modal-cancel');
    const confirmClose = document.getElementById('confirm-modal-close');

    if (confirmProceed) {
      confirmProceed.addEventListener('click', () => {
        if (typeof state.activeConfirmAction === 'function') {
          state.activeConfirmAction();
        }
        state.activeConfirmAction = null;
        closeModal('confirm-modal-backdrop');
      });
    }

    if (confirmCancel) {
      confirmCancel.addEventListener('click', () => {
        state.activeConfirmAction = null;
        closeModal('confirm-modal-backdrop');
      });
    }

    if (confirmClose) {
      confirmClose.addEventListener('click', () => {
        state.activeConfirmAction = null;
        closeModal('confirm-modal-backdrop');
      });
    }

    // Global Keyboard Accessibility (Escape to close modals)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
        closeMobileSidebar();
      }
    });

    // Close modal on clicking backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop.id);
        }
      });
    });
  }

  // ==========================================================================
  // 14. APPLICATION INITIALIZATION (BOOTSTRAP)
  // ==========================================================================
  function init() {
    loadState();

    // Apply saved theme
    document.documentElement.setAttribute('data-theme', state.settings.theme);

    // If user has no data yet, load realistic initial state so the app is immediately attractive and functional
    if (state.expenses.length === 0 && Object.keys(state.budgets).length === 0) {
      const curMonth = getCurrentMonthString();
      const [y, m] = curMonth.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      state.budgets = {
        [curMonth]: {
          total: 45000,
          categories: {
            Food: 12000,
            Transport: 4500,
            Shopping: 6000,
            Education: 3000,
            Bills: 8000,
            Health: 3500,
            Entertainment: 5000,
            Other: 3000
          }
        },
        [prevMonth]: {
          total: 42000,
          categories: {
            Food: 11000,
            Transport: 4000,
            Shopping: 5500,
            Education: 3000,
            Bills: 7500,
            Health: 3000,
            Entertainment: 4500,
            Other: 3500
          }
        }
      };

      const dInCur = (day) => `${curMonth}-${String(day).padStart(2, '0')}`;
      const dInPrev = (day) => `${prevMonth}-${String(day).padStart(2, '0')}`;

      state.expenses = [
        { id: generateUUID(), title: 'Organic Supermarket Groceries', amount: 3450, category: 'Food', date: dInCur(3), notes: 'Fresh produce, dairy and pantry essentials' },
        { id: generateUUID(), title: 'Monthly Metro Rail Commuter Pass', amount: 1400, category: 'Transport', date: dInCur(4), notes: 'Smart card recharge' },
        { id: generateUUID(), title: 'High-Speed Fiber Broadband Bill', amount: 999, category: 'Bills', date: dInCur(5), notes: 'Monthly internet tariff' },
        { id: generateUUID(), title: 'Advanced Web Architecture Masterclass', amount: 2200, category: 'Education', date: dInCur(7), notes: 'Frontend engineering course' },
        { id: generateUUID(), title: 'Weekend Cafe & Bakery Brunch', amount: 820, category: 'Food', date: dInCur(9), notes: 'Coffee and brunch' },
        { id: generateUUID(), title: 'Warm Knit Sweater & Boots', amount: 4200, category: 'Shopping', date: dInCur(11), notes: 'Seasonal apparel shopping' },
        { id: generateUUID(), title: 'Pharmacy Prescriptions & Vitamins', amount: 1350, category: 'Health', date: dInCur(12), notes: 'Supplements and vitamins' },
        { id: generateUUID(), title: 'IMAX Cinema Movie Night & Snacks', amount: 950, category: 'Entertainment', date: dInCur(14), notes: 'Sci-fi film screening' },
        { id: generateUUID(), title: 'Dinner at Italian Trattoria', amount: 2450, category: 'Food', date: dInCur(16), notes: 'Dinner with colleagues' },
        { id: generateUUID(), title: 'Electric Vehicle Charging & Parking', amount: 1650, category: 'Transport', date: dInCur(18), notes: 'Weekly charging station fee' },
        { id: generateUUID(), title: 'Residential Electricity Utility Bill', amount: 2850, category: 'Bills', date: dInCur(19), notes: 'Monthly power consumption' },
        { id: generateUUID(), title: 'Clean Architecture Programming Books', amount: 1250, category: 'Education', date: dInCur(20), notes: 'Software design literature' },
        // Previous month expenses
        { id: generateUUID(), title: 'Monthly Provision Store Supplies', amount: 4800, category: 'Food', date: dInPrev(4), notes: 'Grains and staples' },
        { id: generateUUID(), title: 'Train Tickets for Family Visit', amount: 3200, category: 'Transport', date: dInPrev(8), notes: 'Intercity return train tickets' },
        { id: generateUUID(), title: 'Water & Maintenance Municipal Fee', amount: 1800, category: 'Bills', date: dInPrev(12), notes: 'Quarterly maintenance' },
        { id: generateUUID(), title: 'Ergonomic Desk Accessories', amount: 3100, category: 'Shopping', date: dInPrev(16), notes: 'Keyboard wrist rest and laptop stand' },
        { id: generateUUID(), title: 'Dental Cleaning & Fluoride Treatment', amount: 1800, category: 'Health', date: dInPrev(22), notes: 'Biannual dental checkup' },
        { id: generateUUID(), title: 'Concert Festival Passes', amount: 3500, category: 'Entertainment', date: dInPrev(26), notes: 'Live music concert' }
      ];

      saveState();
    }

    populateMonthSelectors();
    initEventListeners();
    renderAll();
  }

  // Execute on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
