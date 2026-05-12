(() => {
  // src/assets/js/modules/state.js
  var rawArticles = window.ARTICLES_DATA || [];
  var CATEGORY_TYPE_MAP = { tutorials: "INFO", blog: "READ", essays: "READ", projects: "BUILD" };
  var state = {
    feed: rawArticles.map((a) => ({
      id: a.id,
      slug: a.slug,
      type: CATEGORY_TYPE_MAP[a.category] || "READ",
      typeLabel: a.category,
      description: a.title,
      timestamp: a.date,
      tags: a.tags || [],
      detail: a.excerpt || "",
      status: "done",
      href: `/articles/${a.category}/${a.slug}/`,
      isArticle: true
    })),
    categoryStats: {
      tutorials: 0,
      blog: 0,
      essays: 0,
      projects: 0,
      total: 0
    },
    tagCounts: {},
    // 仪表盘缓存
    topTags: [],
    recentLogs: [],
    heatmapWeeks: [],
    // 过滤缓存: key = "type:keyword", value = 过滤+排序后的数组
    filterCache: /* @__PURE__ */ new Map(),
    // 视图状态
    currentView: "log",
    openLogId: null,
    // 命令历史
    commandHistory: JSON.parse(localStorage.getItem("cmdHistory") || "[]"),
    historyIndex: 0,
    // 筛选状态
    activeFilter: null,
    activeKeyword: null,
    // 导航状态
    focusedEntryIndex: -1,
    currentPage: 1,
    filteredLogs: [],
    isLoadingMore: false,
    // 常量
    PAGE_SIZE: 8,
    // DOM 引用
    dom: {
      cmdInput: null,
      mobileCmdInput: null,
      viewContainers: {},
      themeToggle: null
    }
  };
  function initDOM() {
    state.dom = {
      cmdInput: document.getElementById("cmdInput"),
      mobileCmdInput: document.getElementById("mobileCmdInput"),
      viewContainers: {
        log: document.getElementById("view-log"),
        dashboard: document.getElementById("view-dashboard"),
        errors: document.getElementById("view-errors"),
        milestones: document.getElementById("view-milestones"),
        projects: document.getElementById("view-projects"),
        skills: document.getElementById("view-skills"),
        about: document.getElementById("view-about"),
        help: document.getElementById("view-help")
      },
      themeToggle: document.getElementById("themeToggle")
    };
  }
  function computeStats() {
    state.categoryStats = {
      tutorials: state.feed.filter((a) => a.typeLabel === "tutorials").length,
      blog: state.feed.filter((a) => a.typeLabel === "blog").length,
      essays: state.feed.filter((a) => a.typeLabel === "essays").length,
      projects: state.feed.filter((a) => a.typeLabel === "projects").length,
      total: state.feed.length
    };
    const counts = {};
    state.feed.forEach((l) => l.tags.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
    }));
    state.tagCounts = counts;
    state.historyIndex = state.commandHistory.length;
    const sorted = [...state.feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    state.recentLogs = sorted.slice(0, 5);
    state.topTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40);
    const githubData = window.GITHUB_DATA || {};
    const contributions = githubData.contributions || {};
    const today = /* @__PURE__ */ new Date();
    const heatmapDays = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayNames = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];
      const dayName = dayNames[d.getDay()];
      heatmapDays.push({ date: dateStr, day: dayName, count: contributions[dateStr] || 0 });
    }
    const weeks = [];
    let currentWeek = [];
    heatmapDays.forEach((day, idx) => {
      if (idx > 0 && day.day === "\u4E00" && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);
    state.heatmapWeeks = weeks;
  }
  computeStats();
  function getFilterCacheKey(filterType, keyword) {
    return `${filterType || "all"}:${keyword || ""}`;
  }
  function clearFilterCache() {
    state.filterCache.clear();
  }
  function saveCommandHistory() {
    localStorage.setItem("cmdHistory", JSON.stringify(state.commandHistory));
  }
  function setCurrentView(view) {
    state.currentView = view;
  }
  function setActiveFilter(filter) {
    state.activeFilter = filter;
  }
  function setActiveKeyword(keyword) {
    state.activeKeyword = keyword;
  }
  function setOpenLogId(id) {
    state.openLogId = id;
  }
  function setCurrentPage(page) {
    state.currentPage = page;
  }
  function setFilteredLogs(logs) {
    state.filteredLogs = logs;
  }

  // src/assets/js/modules/utils/text.js
  function highlightText(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp("(" + keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return text.replace(regex, '<mark style="background:var(--amber);color:var(--bg);padding:0 2px;border-radius:2px;">$1</mark>');
  }
  function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
  }
  function parseMarkdown(text) {
    if (!text) return "";
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>').replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>").replace(/^[-*] (.+)$/gm, "<li>$1</li>").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
    if (html.includes("<li>")) html = "<ul>" + html + "</ul>";
    return "<p>" + html + "</p>";
  }
  function formatUptime() {
    const startDate = window.SITE_DATA && window.SITE_DATA.startDate ? window.SITE_DATA.startDate : "2026-05-07";
    const start = new Date(startDate);
    const now = /* @__PURE__ */ new Date();
    const diff = now - start;
    const days = Math.floor(diff / (1e3 * 60 * 60 * 24));
    if (days < 1) return "\u{1F680} \u4ECA\u5929\u4E0A\u7EBF";
    return `\u{1F4C8} \u5DF2\u8FD0\u884C ${days} \u5929`;
  }
  var CAT_LABELS = { tutorials: "\u6559\u7A0B", blog: "\u535A\u5BA2", essays: "\u968F\u7B14", projects: "\u9879\u76EE" };
  var TYPE_CLASS_MAP = { tutorials: "green", blog: "blue", essays: "blue", projects: "amber", default: "gray" };
  function getTypeClass(typeLabel) {
    return TYPE_CLASS_MAP[typeLabel] || TYPE_CLASS_MAP.default;
  }
  function getCatLabel(typeLabel) {
    return CAT_LABELS[typeLabel] || typeLabel;
  }

  // src/assets/js/modules/components/detail.js
  function renderDetail(log) {
    let html = "<h2>" + log.description + "</h2>";
    html += '<div class="detail-body">' + parseMarkdown(log.detail) + "</div>";
    if (log.duration) html += '<p style="color:var(--gray)">\u23F1\uFE0F \u8017\u65F6: ' + log.duration + "</p>";
    if (log.progress !== void 0 && log.progress !== null) {
      const bar = "\u2588".repeat(Math.floor(log.progress / 10)) + "\u2591".repeat(10 - Math.floor(log.progress / 10));
      html += '<p>\u{1F4CA} \u8FDB\u5EA6: <span class="progress-bar-ascii">[' + bar + "] " + log.progress + "%</span></p>";
    }
    if (log.related && log.related.length > 0) {
      html += '<p style="color:var(--gray)">\u{1F517} \u5173\u8054: ' + log.related.join(", ") + "</p>";
    }
    if (log.commit) {
      html += '<p style="color:var(--gray)">\u{1F4DD} Git: <code>' + log.commit.slice(0, 8) + "</code></p>";
    }
    return html;
  }
  function toggleDetail(logId, entryElement) {
    const panel = entryElement.querySelector(".detail-panel");
    if (!panel) return;
    const isOpen = entryElement.classList.contains("active");
    document.querySelectorAll(".log-entry.active").forEach((p) => {
      if (p !== entryElement) p.classList.remove("active");
    });
    if (!isOpen) {
      entryElement.classList.add("active");
      setOpenLogId(logId);
      if (window.innerWidth <= 899) panel.scrollIntoView({ behavior: "smooth" });
    } else {
      entryElement.classList.remove("active");
      setOpenLogId(null);
    }
  }
  function closeDetail(logId, entryElement) {
    if (entryElement) {
      entryElement.classList.remove("active");
      if (state.openLogId === logId) setOpenLogId(null);
    }
  }

  // src/assets/js/modules/renderers/logStream.js
  function renderPaginationButtons(totalPages, current) {
    let html = "";
    html += `<button ${current === 1 ? "disabled" : ""} data-page="${current - 1}">\u2190</button>`;
    const maxVisible = 5;
    let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    if (startPage > 1) {
      html += `<button data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="page-info">...</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === current ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="page-info">...</span>`;
      html += `<button data-page="${totalPages}">${totalPages}</button>`;
    }
    html += `<button ${current === totalPages ? "disabled" : ""} data-page="${current + 1}">\u2192</button>`;
    html += `<span class="page-info">${current}/${totalPages}</span>`;
    return html;
  }
  function createLogEntry(log, globalIndex) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.dataset.logId = log.id;
    entry.dataset.index = globalIndex;
    entry.dataset.href = log.href;
    return entry;
  }
  function renderLogEntry(log, globalIndex, keyword) {
    const entry = createLogEntry(log, globalIndex);
    const descHtml = keyword ? highlightText(log.description, keyword) : log.description;
    const typeClass = getTypeClass(log.typeLabel);
    const catLabel = getCatLabel(log.typeLabel);
    entry.innerHTML = `
        <div class="log-line">
          <span class="event-type-dot ${typeClass}"></span>
          <span class="log-time" data-timestamp="${log.id}">[${formatTimestamp(log.timestamp)}]</span>
          <span class="log-tag ${log.typeLabel}" data-tag="${log.typeLabel}">[${catLabel}]</span>
          <span class="log-desc"><a href="${log.href}" class="log-link">${descHtml}</a></span>
          <span class="log-meta">${log.tags.slice(0, 3).map((t) => `<span class="tag-hover" data-tag="${t}">#${t}</span>`).join(" ")}</span>
        </div>
        <div class="detail-panel">${renderDetail(log)}</div>`;
    return entry;
  }
  function attachStreamEvents() {
    const stream = document.querySelector(".log-stream");
    if (!stream) return;
    stream.addEventListener("click", function(e) {
      const entry = e.target.closest(".log-entry");
      if (!entry) return;
      if (e.target.closest(".tag-hover")) {
        const tag = e.target.dataset.tag;
        window.location.href = "/tags/?tag=" + encodeURIComponent(tag);
        return;
      }
      if (e.target.closest(".log-time")) return;
      if (e.target.closest(".log-link")) return;
      const href = entry.dataset.href;
      if (href) {
        window.location.href = href;
      } else {
        const logId = entry.dataset.logId;
        toggleDetail(logId, entry);
      }
    });
    let pressTimer;
    stream.addEventListener("touchstart", function(e) {
      const entry = e.target.closest(".log-entry");
      if (!entry || e.target.closest(".tag-hover") || e.target.closest(".log-link")) return;
      const href = entry.dataset.href;
      pressTimer = setTimeout(() => {
        if (href) window.location.href = href;
      }, 500);
    }, { passive: true });
    stream.addEventListener("touchend", () => clearTimeout(pressTimer));
    stream.addEventListener("touchmove", () => clearTimeout(pressTimer));
  }
  function renderLogStream(filterType = null, keyword = null, page = 1) {
    const { feed, PAGE_SIZE } = state;
    const cacheKey = getFilterCacheKey(filterType, keyword);
    let filteredLogs = state.filterCache.get(cacheKey);
    if (!filteredLogs) {
      filteredLogs = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (filterType && filterType !== "all") {
        filteredLogs = filteredLogs.filter((l) => l.typeLabel === filterType);
      }
      if (keyword) {
        const kw = keyword.toLowerCase();
        filteredLogs = filteredLogs.filter(
          (l) => l.description.toLowerCase().includes(kw) || l.tags.some((t) => t.toLowerCase().includes(kw)) || l.typeLabel.toLowerCase().includes(kw)
        );
      }
      state.filterCache.set(cacheKey, filteredLogs);
    }
    setFilteredLogs(filteredLogs);
    setCurrentPage(page);
    const container = state.dom.viewContainers.log;
    if (!container) return;
    if (filteredLogs.length === 0) {
      container.innerHTML = '<p style="color:var(--gray)">\u6CA1\u6709\u5339\u914D\u7684\u6587\u7AE0\u3002</p>';
      return;
    }
    const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, filteredLogs.length);
    const pageLogs = filteredLogs.slice(startIdx, endIdx);
    let stream = container.querySelector(".log-stream");
    if (!stream) {
      stream = document.createElement("div");
      stream.className = "log-stream";
      container.appendChild(stream);
      attachStreamEvents();
    }
    const newIds = new Set(pageLogs.map((l) => l.id));
    stream.querySelectorAll(".log-entry").forEach((el) => {
      if (!newIds.has(el.dataset.logId)) el.remove();
    });
    const existingById = new Map(
      [...stream.querySelectorAll(".log-entry")].map((el) => [el.dataset.logId, el])
    );
    pageLogs.forEach((log, idx) => {
      if (existingById.has(log.id)) {
        existingById.get(log.id).dataset.index = startIdx + idx;
      } else {
        stream.appendChild(renderLogEntry(log, startIdx + idx, keyword));
      }
    });
    const oldPagination = container.querySelector(".pagination");
    if (oldPagination) oldPagination.remove();
    if (totalPages > 1) {
      const pagination = document.createElement("div");
      pagination.className = "pagination";
      pagination.innerHTML = renderPaginationButtons(totalPages, page);
      container.appendChild(pagination);
      pagination.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", function() {
          const pageNum = parseInt(this.dataset.page);
          if (pageNum && pageNum !== page) {
            renderLogStream(filterType, keyword, pageNum);
            container.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
  }
  window.loadMoreLogs = function() {
    if (state.isLoadingMore) return;
    state.isLoadingMore = true;
    state.currentPage++;
    renderLogStream(state.activeFilter, state.activeKeyword, state.currentPage);
    state.isLoadingMore = false;
  };

  // src/assets/js/modules/renderers/dashboard.js
  function renderDashboard() {
    const container = state.dom.viewContainers.dashboard;
    if (!container) return;
    const { categoryStats, feed, topTags } = state;
    const githubData = window.GITHUB_DATA || {};
    const contributions = githubData.contributions || {};
    const total = categoryStats.total;
    const today = /* @__PURE__ */ new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear(), 11, 31);
    const yearDays = [];
    for (let d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      yearDays.push({ date: dateStr, count: contributions[dateStr] || 0, day: d.getDay() });
    }
    const months = [];
    let currentMonth = -1;
    yearDays.forEach((day) => {
      const month = parseInt(day.date.slice(5, 7));
      if (month !== currentMonth) {
        months.push({ label: day.date.slice(0, 7), weeks: [] });
        currentMonth = month;
      }
      if (months.length > 0) {
        months[months.length - 1].weeks.push(day);
      }
    });
    const activeDays = yearDays.filter((d) => d.count > 0).length;
    const activityRate = Math.round(activeDays / yearDays.length * 100);
    const catConfig = [
      { key: "tutorials", label: "\u6559\u7A0B", count: categoryStats.tutorials, color: "var(--blue)" },
      { key: "blog", label: "\u535A\u5BA2", count: categoryStats.blog, color: "var(--green)" },
      { key: "essays", label: "\u968F\u7B14", count: categoryStats.essays, color: "var(--magenta)" },
      { key: "projects", label: "\u9879\u76EE", count: categoryStats.projects, color: "var(--amber)" }
    ];
    const maxCount = Math.max(...Object.values(categoryStats), 1);
    container.innerHTML = `
        <div class="mobile-dashboard">
            <div class="mobile-header">
                <span class="mobile-title">\u{1F4E1} \u4FE1\u53F7\u9065\u6D4B</span>
                <span class="mobile-year">${today.getFullYear()}\u5E74</span>
            </div>

            <div class="mobile-heatmap-compact">
                <div class="heatmap-months">
                    ${months.map((m) => `
                        <div class="heatmap-month">
                            <div class="month-label">${parseInt(m.label.slice(5))}\u6708</div>
                            <div class="month-weeks">
                                ${Array.from({ length: Math.ceil(m.weeks.length / 7) }, (_, wi) => {
      const weekDays = m.weeks.slice(wi * 7, wi * 7 + 7);
      return `<div class="week-col">${weekDays.map((d) => {
        const level = d.count === 0 ? 0 : d.count <= 2 ? 1 : d.count <= 5 ? 2 : 3;
        return `<div class="strip-cell level${level}" title="${d.date}: ${d.count}\u6B21"></div>`;
      }).join("")}</div>`;
    }).join("")}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>

            <div class="mobile-table">
                <div class="table-header">
                    <span>\u5206\u7C7B</span>
                    <span>\u4FE1\u53F7\u6570</span>
                    <span>\u5F3A\u5EA6</span>
                </div>
                ${catConfig.map((c) => {
      const barLen = 10;
      const filled = Math.round(c.count / maxCount * barLen);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(barLen - filled);
      return `
                        <div class="table-row" data-category="${c.key}">
                            <span class="row-cat"><span class="cat-dot" style="background:${c.color}"></span>${c.label}</span>
                            <span class="row-count">${c.count}</span>
                            <span class="row-bar" style="color:${c.color}">${bar}</span>
                        </div>
                        <div class="table-detail" id="detail-${c.key}">
                            <div class="detail-content">
                                <div class="detail-item"><span>\u4FE1\u53F7\u6570\uFF1A</span><em>${c.count}</em></div>
                                <div class="detail-item"><span>\u5360\u6BD4\uFF1A</span><em>${Math.round(c.count / total * 100)}%</em></div>
                                <div class="detail-item"><span>\u70ED\u95E8\u6807\u7B7E\uFF1A</span><em>${getTopTagsForCategory(c.key, topTags)}</em></div>
                            </div>
                        </div>
                    `;
    }).join("")}
            </div>

            <div class="mobile-total">
                <span class="total-dot"></span>
                <span>\u603B\u4FE1\u53F7\uFF1A<em>${total}</em></span>
                <span class="total-rate">\u6D3B\u8DC3${activityRate}%</span>
            </div>

            <div class="mobile-section">
                <div class="mobile-section-title">\u{1F4E1} \u6700\u8FD1\u6D3B\u8DC3</div>
                <div class="recent-list">
                    ${feed.slice(0, 6).map((a) => `
                        <a class="recent-item" href="${a.href}">
                            <span class="recent-cat" style="color:${catConfig.find((c) => c.key === a.category)?.color || "var(--gray)"}">${catConfig.find((c) => c.key === a.category)?.label || a.category}</span>
                            <span class="recent-title">${a.description.length > 14 ? a.description.slice(0, 14) + "..." : a.description}</span>
                        </a>
                    `).join("")}
                </div>
            </div>

            <div class="mobile-section">
                <div class="mobile-section-title">\u{1F3F7}\uFE0F \u70ED\u95E8\u6807\u7B7E</div>
                <div class="tag-cloud">
                    ${topTags.slice(0, 8).map(([tag, count]) => `
                        <span class="tag-item" data-tag="${tag}">#${tag}<span class="tag-count">${count}</span></span>
                    `).join("")}
                </div>
            </div>
        </div>`;
    document.querySelectorAll(".table-row").forEach((row) => {
      row.addEventListener("click", function() {
        const cat = this.dataset.category;
        const detail = document.getElementById("detail-" + cat);
        if (detail) {
          detail.classList.toggle("open");
        }
      });
    });
    document.querySelectorAll(".tag-item").forEach((el) => {
      el.addEventListener("click", function() {
        window.executeCommand("/grep " + this.dataset.tag);
      });
    });
    showView("dashboard");
  }
  function getTopTagsForCategory(category, topTags) {
    return topTags.slice(0, 3).map(([t]) => "#" + t).join(" ") || "\u65E0";
  }

  // src/assets/js/modules/renderers/errors.js
  function renderErrors() {
    const container = state.dom.viewContainers.errors;
    if (!container) return;
    const githubData = window.GITHUB_DATA || {};
    const siteData = window.SITE_DATA || {};
    const repos = githubData.repos || [];
    const username = githubData.username || siteData.githubUsername || "Lumjiel";
    const shownRepos = siteData.shownRepos || [];
    const contributions = githubData.contributions || {};
    const lastFetched = githubData.lastFetched ? new Date(githubData.lastFetched).toLocaleDateString("zh-CN") : "\u672A\u77E5";
    const langColors = {
      JavaScript: "#F7DF1E",
      TypeScript: "#3178C6",
      Python: "#3572A5",
      Java: "#B07219",
      Go: "#00ADD8",
      Vue: "#41B883",
      HTML: "#E34C26"
    };
    const filteredRepos = repos.filter((r) => shownRepos.includes(r.name)).sort((a, b) => {
      const idxA = shownRepos.indexOf(a.name);
      const idxB = shownRepos.indexOf(b.name);
      return idxA - idxB;
    });
    const today = /* @__PURE__ */ new Date();
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + d));
        const dateStr = date.toISOString().slice(0, 10);
        week.push({ date: dateStr, count: contributions[dateStr] || 0, day: d });
      }
      weeks.push(week);
    }
    const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
    const truncateDesc = (desc, max = 80) => {
      if (!desc) return "\u6682\u65E0\u63CF\u8FF0";
      return desc.length > max ? desc.slice(0, max) + "..." : desc;
    };
    container.innerHTML = `
        <div class="report-container">
            <div class="report-header">
                <div class="report-user">
                    <div class="user-info">
                        <span class="user-name">${username}</span>
                        <span class="user-label">github</span>
                    </div>
                    <div class="user-stats">
                        <span>\u{1F4E1} ${filteredRepos.length} \u4ED3\u5E93</span>
                        <span>\u{1F550} ${lastFetched}</span>
                    </div>
                </div>
            </div>

            <div class="heatmap-section">
                <div class="heatmap-title">GitHub \u8D21\u732E\u70ED\u529B\u56FE</div>
                <div class="day-labels">
                    ${dayLabels.map((d) => `<span class="day-label">${d}</span>`).join("")}
                </div>
                <div class="heatmap-weeks">
                    ${weeks.map((week) => `
                        <div class="heatmap-week">
                            ${week.map((day) => {
      const level = day.count === 0 ? 0 : day.count <= 2 ? 1 : day.count <= 5 ? 2 : 3;
      return `<div class="heatmap-cell level${level}" data-date="${day.date}" data-count="${day.count}"></div>`;
    }).join("")}
                        </div>
                    `).join("")}
                </div>
                <div class="heatmap-footer">
                    <span></span>
                    <div class="heatmap-legend">
                        <span>Less</span>
                        <div class="legend-cell level0"></div>
                        <div class="legend-cell level1"></div>
                        <div class="legend-cell level2"></div>
                        <div class="legend-cell level3"></div>
                        <span>More</span>
                    </div>
                </div>
            </div>

            <div class="report-divider"></div>

            <div class="repo-list">
                ${filteredRepos.map((r) => `
                    <a class="repo-card" href="${r.url}" target="_blank" rel="noopener">
                        <div class="repo-name">\u{1F4E6} ${r.name}</div>
                        <div class="repo-desc">${truncateDesc(r.description)}</div>
                        <div class="repo-meta">
                            ${r.language ? `<span class="repo-lang"><span class="lang-dot" style="background:${langColors[r.language] || "#888"}"></span>${r.language}</span>` : ""}
                            <span>\u2B50 ${r.stars}</span>
                            <span>\u{1F374} ${r.forks}</span>
                            <span class="repo-updated">${r.updatedAgo || "\u672A\u77E5"}</span>
                        </div>
                    </a>
                `).join("")}
            </div>

            <div class="report-footer">
                <span>> \u6570\u636E\u6765\u6E90: github.com/${username}</span>
                <span>> \u66F4\u65B0\u9891\u7387: \u6BCF\u6B21\u6784\u5EFA\u65F6\u81EA\u52A8\u540C\u6B65</span>
            </div>
        </div>`;
    showView("errors");
  }

  // src/assets/js/modules/renderers/milestones.js
  function renderMilestones() {
    const container = state.dom.viewContainers.milestones;
    if (!container) return;
    const { feed } = state;
    const catLabelMap = { tutorials: "\u6559\u7A0B", blog: "\u535A\u5BA2", essays: "\u968F\u7B14", projects: "\u9879\u76EE" };
    container.innerHTML = `
        <h2 style="color:var(--magenta);margin-bottom:1rem;">\u{1F4DA} \u5168\u90E8\u6587\u7AE0</h2>
        <ul style="list-style:none;padding:0;">${feed.map((l) => {
      const typeClass = getTypeClass(l.typeLabel);
      const catLabel = getCatLabel(l.typeLabel);
      return `<li style="margin:0.4rem 0;display:flex;gap:0.5rem;">
                <span style="color:var(--gray);font-size:0.75rem;min-width:80px;">${l.timestamp}</span>
                <span style="color:var(--${typeClass});font-size:0.7rem;">[${catLabel}]</span>
                <a href="${l.href}" style="color:var(--text);">${l.description}</a>
            </li>`;
    }).join("")}</ul>`;
    showView("milestones");
  }

  // src/assets/js/modules/renderers/projects.js
  function renderProjects() {
    const container = state.dom.viewContainers.projects;
    if (!container) return;
    const projArticles = state.feed.filter((a) => a.typeLabel === "projects");
    container.innerHTML = projArticles.length ? `
        <h2 style="color:var(--amber);margin-bottom:1rem;">\u{1F6E0}\uFE0F \u9879\u76EE\u5C55\u677F</h2>
        <ul style="list-style:none;padding:0;">${projArticles.map((a) => `
            <li style="margin:0.5rem 0;padding:0.8rem;background:var(--surface);border:1px solid var(--border);border-radius:6px;">
                <a href="${a.href}" style="color:var(--text);font-weight:600;">${a.description}</a>
                <p style="color:var(--gray);font-size:0.8rem;margin:0.3rem 0 0 0;">${a.detail || ""}</p>
                <div style="margin-top:0.4rem;">${a.tags.map((t) => `<span style="font-size:0.7rem;color:var(--text-dim);">#${t} </span>`).join("")}</div>
            </li>`).join("")}</ul>` : '<p style="color:var(--gray);">\u6682\u65E0\u9879\u76EE\u6587\u7AE0\u3002</p>';
    showView("projects");
  }

  // src/assets/js/modules/renderers/skills.js
  function renderSkillsView() {
    const container = state.dom.viewContainers.skills;
    if (!container) return;
    const { categoryStats } = state;
    const techCount = categoryStats.tutorials;
    const readingCount = categoryStats.blog + categoryStats.essays;
    const projectsCount = categoryStats.projects;
    const total = categoryStats.total;
    container.innerHTML = `
        <h2 style="color:var(--green);">\u{1F333} \u6587\u7AE0\u5206\u7C7B\u7EDF\u8BA1</h2>
        <pre style="color:var(--green); background:transparent; line-height:1.6; margin:1rem 0;">
        student@observatory
        \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        Articles: ${total}
        \u251C\u2500\u2500 <span style="color:var(--green);">\u6280\u672F</span>: ${techCount} \u7BC7
        \u251C\u2500\u2500 <span style="color:var(--blue);">\u8BFB\u4E66</span>: ${readingCount} \u7BC7
        \u2514\u2500\u2500 <span style="color:var(--amber);">\u9879\u76EE</span>: ${projectsCount} \u7BC7
        </pre>
        <p style="color:var(--text-dim);">\u70B9\u51FB\u5206\u7C7B\u6807\u7B7E\u53EF\u7B5B\u9009\u6587\u7AE0</p>`;
    showView("skills");
  }

  // src/assets/js/modules/renderers/about.js
  var BUBBLES = [
    "$ whoami\n> \u51CC\u6668\u4E09\u70B9\u8FD8\u5728 debug \u7684 CS \u5927\u4E8C\u72D7",
    "$ man love\n> No manual entry for love",
    "$ ./run.sh\n> Segmentation fault (core dumped)",
    "$ sudo rm -rf /\n> [sudo] password for Lumjiel: ********\n> \u5144\u5F1F\u4F60\u522B\u6267\u884C\u8FD9\u4E2A\u554A\uFF01",
    "$ git push --force\n> Force push accepted. \u540E\u679C\u81EA\u8D1F\u3002",
    "$ cat README.md\n> README.md: No such file or directory",
    '$ echo "\u4E16\u754C\u4E0A\u6700\u6162\u7684\u7F16\u8BD1"\n> \u6B63\u5728\u7F16\u8BD1... \u9884\u8BA1\u5B8C\u6210\u65F6\u95F4\uFF1A\u660E\u5929',
    "$ npm install\n> added 2333 packages in 47m",
    "$ \u80FD\u8DD1\u3002\n> \u522B\u95EE\u4E3A\u4EC0\u4E48\u3002",
    "$ \u6CE8\u91CA\u4EE5\u540E\u518D\u8865\u3002\n> \u4EE5\u540E\u662F\u54EA\u4E00\u5929\uFF1F"
  ];
  var ASCII_ROBOT = `
                 _\\  \\_
                  /__|         "Bug? That's not a
              ___//_           bug, that's a
             /      \\              FEATURE."
            /        /\\
           / /\\     \\/  )
           \\_\\|     |  /
            (_      |\\/
              |     |
              |_    |
               /   |
              / /| |
             /_/ |_|
            /|    /\\
    _______/_/____\\_\\_______________________________`;
  var OPERATIONS = [
    "[2026-05-11] refactor: \u79FB\u9664\u4FE1\u53F7\u5361\u7247\uFF0C\u4FEE\u590D Spring \u6587\u7AE0\u89E3\u6790",
    "[2026-05-10] docs: \u5B8C\u5584 README",
    "[2026-05-10] chore: \u79FB\u9664\u8BBE\u8BA1\u6587\u6863.md",
    "[2026-05-10] ci: \u5347\u7EA7 Node.js \u5230 v22 \u907F\u514D 2026 \u5E74deprecated\u8B66\u544A",
    "[2026-05-10] refactor: \u62C6\u5206 views.js \u4E3A\u72EC\u7ACB\u6A21\u5757",
    "[2026-05-10] security: \u4FEE\u590D article-api.mjs \u5B89\u5168\u6F0F\u6D1E",
    "[2026-05-10] feat: \u6587\u7AE0\u7BA1\u7406\u6A21\u57577\u9879\u4F18\u5316",
    "[2026-05-10] fix: article-api \u4FDD\u5B58\u540E\u89E6\u53D1 Eleventy \u91CD\u5EFA\u9759\u6001\u7AD9\u70B9"
  ];
  function renderAbout() {
    const container = state.dom.viewContainers.about;
    if (!container) return;
    const siteData = window.SITE_DATA || {};
    const githubUsername = siteData.githubUsername || "Lumjiel";
    container.innerHTML = `
    <div class="about-terminal">
      <div class="about-header">
        <pre class="about-ascii" id="aboutAscii"></pre>
        <div class="about-bubble" id="aboutBubble" style="opacity:0">
          <span class="bubble-prefix">&gt;</span> <span id="aboutBubbleText"></span>
        </div>
      </div>

      <div class="about-body" id="aboutBody" style="display:none">
        <div class="about-section">
          <div class="about-section-title">\u{1F4E1} \u7CFB\u7EDF\u4FE1\u606F</div>
          <div class="about-contacts">
            <div class="about-contact-item">
              <span class="contact-label">\u64CD\u4F5C\u8005</span>
              <span class="contact-value">Lumjiel</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">\u5DE5\u4F5C\u76EE\u5F55</span>
              <span class="contact-value">~/project/terminal-observatory</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">\u7F16\u8F91\u5668</span>
              <span class="contact-value">Claude Code</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">\u72B6\u6001</span>
              <span class="contact-value" id="aboutStatus">\u{1F7E2} \u6478\u9C7C\u4E2D...</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">GitHub</span>
              <a href="https://github.com/${githubUsername}" target="_blank" class="contact-link">
                @${githubUsername}
              </a>
            </div>
          </div>
        </div>

        <div class="about-section">
          <div class="about-section-title">\u{1F4CB} \u8FD0\u7EF4\u8BB0\u5F55</div>
          <div class="about-ops">
            ${OPERATIONS.map((op) => `<div class="about-op">${op}</div>`).join("")}
          </div>
        </div>

        <div class="about-footer">
          <div class="about-maintainer">
            > \u7EF4\u62A4\u8005\uFF1ACS\u5927\u4E8C\u5728\u8BFB / \u540E\u7AEF\u65B9\u5411 / \u51CC\u6668\u7F16\u8BD1\u7231\u597D\u8005
          </div>
          <div class="about-status">
            > \u72B6\u6001\uFF1A\u5B58\u6D3B\uFF0C\u4ECD\u5728\u8F93\u51FA\u4FE1\u53F7
          </div>
          <div class="about-quit">
            > \u89C2\u6D4B\u4ECD\u5728\u7EE7\u7EED\u3002\u4E0B\u4E00\u4E2A\u4FE1\u53F7\u968F\u65F6\u4F1A\u51FA\u73B0\u3002
          </div>
          <span class="about-cursor">$ _</span>
        </div>
      </div>
    </div>`;
    showView("about");
    startTypewriter();
    startStatusUpdater();
  }
  var STATUS_STATES = ["\u6478\u9C7C\u4E2D...", "\u7F16\u8BD1\u4E2D...", "debug\u4E2D...", "\u91CD\u6784\u4E2D...", "\u770B\u6587\u6863\u4E2D...", "\u559D\u6C34\u4E2D..."];
  var statusInterval;
  function startStatusUpdater() {
    if (statusInterval) clearInterval(statusInterval);
    const statusEl = document.getElementById("aboutStatus");
    if (!statusEl) return;
    statusInterval = setInterval(() => {
      const state2 = STATUS_STATES[Math.floor(Math.random() * STATUS_STATES.length)];
      statusEl.textContent = "\u{1F7E2} " + state2;
    }, 2e3);
  }
  function startTypewriter() {
    const asciiEl = document.getElementById("aboutAscii");
    const bubbleEl = document.getElementById("aboutBubble");
    const bubbleTextEl = document.getElementById("aboutBubbleText");
    const bodyEl = document.getElementById("aboutBody");
    if (!asciiEl || !bubbleEl || !bubbleTextEl) return;
    const fullText = ASCII_ROBOT;
    const bubbleText = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];
    let charIdx = 0;
    function typeChar() {
      if (charIdx < fullText.length) {
        asciiEl.textContent += fullText[charIdx];
        charIdx++;
        setTimeout(typeChar, 6);
      } else {
        bubbleTextEl.textContent = bubbleText;
        bubbleEl.style.transition = "opacity 0.5s ease";
        bubbleEl.style.opacity = "1";
        setTimeout(() => {
          if (bodyEl) {
            bodyEl.style.display = "block";
            bodyEl.style.animation = "fadeIn 0.5s ease";
          }
        }, 600);
      }
    }
    typeChar();
  }

  // src/assets/js/modules/renderers/help.js
  function renderHelp() {
    const container = state.dom.viewContainers.help;
    if (!container) return;
    container.innerHTML = `
        <h2 style="color:var(--green);">\u{1F4D6} \u53EF\u7528\u547D\u4EE4</h2>
        <pre style="color:var(--text); line-height:1.6;">
/filter [category]    \u7B5B\u9009\uFF1Aall|tutorials|blog|essays|projects
/grep [\u5173\u952E\u8BCD]        \u641C\u7D22\u6587\u7AE0\u6807\u9898\u548C\u63CF\u8FF0
/stats                \u7EDF\u8BA1\u6982\u89C8
/issues              GitHub \u4ED3\u5E93 Issues
/projects             \u9879\u76EE\u5217\u8868
/milestones           \u6587\u7AE0\u5217\u8868
/skills               \u6280\u80FD\u6808
/about                \u5173\u4E8E
/help                 \u663E\u793A\u5E2E\u52A9
/clear                \u6E05\u9664\u7B5B\u9009
/theme [dark|light]   \u5207\u6362\u4E3B\u9898
/export [txt|json]    \u5BFC\u51FA\u6570\u636E
        </pre>
        <p style="color:var(--text-dim);">\u5FEB\u6377\u952E: j/k \u79FB\u52A8 | Esc \u5173\u95ED | Tab \u8865\u5168</p>`;
    showView("help");
  }

  // src/assets/js/modules/router.js
  var ROUTES = {
    "dashboard": renderDashboard,
    "errors": renderErrors,
    "milestones": renderMilestones,
    "projects": renderProjects,
    "skills": renderSkillsView,
    "about": renderAbout,
    "help": renderHelp
  };
  function showView(viewName) {
    const { viewContainers } = state.dom;
    Object.keys(viewContainers).forEach((v) => viewContainers[v].classList.remove("active"));
    if (viewContainers[viewName]) viewContainers[viewName].classList.add("active");
    setCurrentView(viewName);
    document.body.classList.toggle("view-log-active", viewName === "log");
    window.location.hash = viewName === "log" ? "" : viewName;
  }
  function handleHashRoute() {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      renderLogStream();
      showView("log");
      return;
    }
    const renderFn = ROUTES[hash];
    if (renderFn) {
      renderFn();
    } else {
      renderLogStream();
      showView("log");
      return;
    }
    showView(hash);
  }

  // src/assets/js/modules/utils/particles.js
  function generateParticles() {
    const container = document.getElementById("particleLayer");
    if (!container) return;
    container.innerHTML = "";
    const count = window.innerWidth < 768 ? 20 : 40;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = Math.random() * 100 + "%";
      p.style.top = Math.random() * 100 + "%";
      p.style.animationDelay = Math.random() * 12 + "s";
      p.style.animationDuration = 12 + Math.random() * 8 + "s";
      container.appendChild(p);
    }
  }

  // src/assets/js/modules/components/filterChips.js
  function renderFilterChips() {
    const container = document.getElementById("filterChips");
    if (!container) return;
    const categories = [
      { key: "all", label: "\u5168\u90E8" },
      { key: "tutorials", label: "\u6559\u7A0B" },
      { key: "blog", label: "\u535A\u5BA2" },
      { key: "essays", label: "\u968F\u7B14" },
      { key: "projects", label: "\u9879\u76EE" }
    ];
    container.innerHTML = categories.map(
      (c) => `<button class="filter-chip ${state.activeFilter === c.key || !state.activeFilter && c.key === "all" ? "active" : ""}" data-filter="${c.key}">${c.label}</button>`
    ).join("");
    container.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", function() {
        const filter = this.dataset.filter;
        if (filter === "all") {
          setActiveFilter(null);
          window.executeCommand("/filter all");
        } else {
          setActiveFilter(filter);
          window.executeCommand("/filter " + filter);
        }
      });
    });
  }

  // src/assets/js/modules/components/sidebar.js
  function renderSidebarSkills() {
    const container = document.getElementById("skillList");
    if (!container) return;
    const { categoryStats } = state;
    const cats = [
      { name: "\u6559\u7A0B", count: categoryStats.tutorials, color: "green" },
      { name: "\u535A\u5BA2", count: categoryStats.blog, color: "blue" },
      { name: "\u968F\u7B14", count: categoryStats.essays, color: "magenta" },
      { name: "\u9879\u76EE", count: categoryStats.projects, color: "amber" }
    ];
    const total = categoryStats.total;
    container.innerHTML = cats.map((c) => `
        <div class="skill-row"><span>${c.name}</span><span>${c.count}\u7BC7</span></div>
        <div class="skill-bar-wrap"><div class="skill-bar-fill ${c.color}" style="width:${total > 0 ? c.count / total * 100 : 0}%"></div></div>
    `).join("");
  }
  function renderRecentErrors() {
    const container = document.getElementById("recentErrors");
    if (!container) return;
    const recent = [...state.feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);
    container.innerHTML = recent.map((a) => `
        <li><span style="color:var(--blue);">\u{1F4C4}</span> ${a.description.slice(0, 20)}${a.description.length > 20 ? "..." : ""}</li>
    `).join("");
  }
  function renderQuote() {
    const container = document.getElementById("randomQuote");
    if (!container) return;
    const quotes = [
      '"Stay hungry, stay foolish." \u2014 Steve Jobs',
      '"The best way to predict the future is to invent it." \u2014 Alan Kay',
      '"Talk is cheap. Show me the code." \u2014 Linus Torvalds',
      '"Premature optimization is the root of all evil." \u2014 Donald Knuth',
      '"Any fool can write code that a computer can understand. Good programmers write code that humans can understand." \u2014 Martin Fowler',
      '"First, solve the problem. Then, write the code." \u2014 John Johnson'
    ];
    container.textContent = quotes[Math.floor(Math.random() * quotes.length)];
  }

  // src/assets/js/modules/utils/audio.js
  var _audioCtx = null;
  function playClickSound() {
    try {
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.frequency.value = 800;
      osc.type = "square";
      gain.gain.value = 0.03;
      gain.gain.exponentialRampToValueAtTime(1e-3, _audioCtx.currentTime + 0.08);
      osc.start(_audioCtx.currentTime);
      osc.stop(_audioCtx.currentTime + 0.08);
    } catch (e) {
    }
  }

  // src/assets/js/modules/commands.js
  var VALID_CATEGORIES = ["all", "tutorials", "blog", "essays", "projects"];
  var commands = {
    "/filter"(arg) {
      const cat = arg.toLowerCase();
      if (!VALID_CATEGORIES.includes(cat)) return;
      clearFilterCache();
      setActiveFilter(cat === "all" ? null : cat);
      setActiveKeyword(null);
      renderLogStream(state.activeFilter);
      renderFilterChips();
      showView("log");
    },
    "/grep"(arg) {
      if (!arg) return;
      clearFilterCache();
      setActiveKeyword(arg);
      setActiveFilter(null);
      renderLogStream(null, arg);
      renderFilterChips();
      showView("log");
    },
    "/stats"() {
      renderDashboard();
    },
    "/issues"() {
      renderErrors();
    },
    "/milestones"() {
      renderMilestones();
    },
    "/projects"() {
      renderProjects();
    },
    "/skills"() {
      renderSkillsView();
    },
    "/about"() {
      renderAbout();
    },
    "/help"() {
      renderHelp();
    },
    "/clear"() {
      clearFilterCache();
      setActiveFilter(null);
      setActiveKeyword(null);
      renderLogStream();
      renderFilterChips();
      showView("log");
    },
    "/theme"(arg) {
      if (arg === "dark") {
        document.body.classList.remove("light");
        localStorage.setItem("terminal-theme", "dark");
      } else if (arg === "light") {
        document.body.classList.add("light");
        localStorage.setItem("terminal-theme", "light");
      }
    },
    "/export"(arg) {
      const data = state.activeFilter ? state.feed.filter((l) => l.typeLabel === state.activeFilter) : state.feed;
      if (arg === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "articles-export.json";
        a.click();
      } else {
        const text = data.map((l) => `[${l.typeLabel}] ${l.timestamp} ${l.description}`).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
        a.download = "articles-export.txt";
        a.click();
      }
    },
    "/admin"() {
      window.location.href = "/admin";
    }
  };
  function executeCommand(cmdStr) {
    playClickSound();
    const parts = cmdStr.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");
    const handler = commands[cmd];
    if (handler) {
      handler(arg);
    } else if (cmdStr.trim()) {
      const suggestion = findSimilar(cmd);
      showError("Error: " + cmd + " not found.", suggestion);
    }
  }
  function showError(msg, suggestion) {
    const prev = document.querySelector(".cmd-error-output");
    if (prev) prev.remove();
    const errorEl = document.createElement("div");
    errorEl.className = "cmd-error-output";
    errorEl.style.cssText = "margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(255,60,60,0.08);border-left:2px solid #FF4444;color:#FF4444;font-family:var(--font-mono);font-size:0.8rem;line-height:1.4;";
    errorEl.innerHTML = msg + (suggestion ? `<br><span style="color:#00E5A0;cursor:pointer;" onclick="executeCommand('${suggestion}');this.closest('.cmd-error-output').remove();">\u2192 Did you mean: ${suggestion}?</span>` : "");
    const cmdArea = document.querySelector(".command-area") || document.querySelector(".mobile-cmd-area");
    if (cmdArea) {
      cmdArea.style.marginBottom = "0";
      cmdArea.insertAdjacentElement("afterend", errorEl);
    }
    setTimeout(() => errorEl.remove(), 3e3);
  }
  function findSimilar(cmd) {
    const cmds = Object.keys(commands);
    for (const c of cmds) {
      if (c.slice(1).startsWith(cmd.slice(1)) || cmd.slice(1).startsWith(c.slice(1))) {
        return c;
      }
    }
    return null;
  }
  window.executeCommand = executeCommand;

  // src/assets/js/modules/events/input.js
  function initCommandInput() {
    const { cmdInput, mobileCmdInput } = state.dom;
    const { tagCounts } = state;
    if (cmdInput) {
      cmdInput.addEventListener("keydown", handleKeyDown);
    }
    if (mobileCmdInput) {
      mobileCmdInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
          const cmd = this.value.trim();
          if (cmd) {
            state.commandHistory.push(cmd);
            if (state.commandHistory.length > 20) state.commandHistory.shift();
            state.historyIndex = state.commandHistory.length;
            saveCommandHistory();
            executeCommand(cmd);
          }
          this.value = "";
        } else if (e.key === "Tab") {
          e.preventDefault();
          const val = this.value.toLowerCase();
          const cmds = ["/filter", "/grep", "/stats", "/issues", "/milestones", "/projects", "/skills", "/about", "/help", "/clear", "/theme", "/export"];
          const allTags = Object.keys(tagCounts);
          const parts = this.value.split(/\s+/);
          if (parts.length === 1) {
            const match = cmds.find((c) => c.startsWith(val));
            if (match) this.value = match + " ";
          } else if (parts[0] === "/filter") {
            const cats = ["all", "tutorials", "blog", "essays", "projects"];
            const match = cats.find((c) => c.startsWith(parts[1]?.toLowerCase()));
            if (match) this.value = "/filter " + match + " ";
          } else if (parts[0] === "/theme") {
            const themes = ["dark", "light"];
            const match = themes.find((t) => t.startsWith(parts[1]));
            if (match) this.value = "/theme " + match + " ";
          } else if (parts[0] === "/export") {
            const formats = ["txt", "json"];
            const match = formats.find((f) => f.startsWith(parts[1]));
            if (match) this.value = "/export " + match + " ";
          } else {
            const match = allTags.find((t) => t.toLowerCase().startsWith(parts[1]?.toLowerCase()));
            if (match) this.value = parts[0] + " " + match + " ";
          }
        }
      });
    }
    function handleKeyDown(e) {
      if (e.key === "Enter") {
        const cmd = this.value.trim();
        if (cmd) {
          state.commandHistory.push(cmd);
          if (state.commandHistory.length > 20) state.commandHistory.shift();
          state.historyIndex = state.commandHistory.length;
          saveCommandHistory();
          executeCommand(cmd);
        }
        this.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.commandHistory.length && state.historyIndex > 0) {
          state.historyIndex--;
          this.value = state.commandHistory[state.historyIndex];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (state.historyIndex < state.commandHistory.length - 1) {
          state.historyIndex++;
          this.value = state.commandHistory[state.historyIndex];
        } else {
          state.historyIndex = state.commandHistory.length;
          this.value = "";
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        const val = this.value.toLowerCase();
        const cmds = ["/filter", "/grep", "/stats", "/issues", "/milestones", "/projects", "/skills", "/about", "/help", "/clear", "/theme", "/export"];
        const allTags = Object.keys(tagCounts);
        const parts = this.value.split(/\s+/);
        if (parts.length === 1) {
          const match = cmds.find((c) => c.startsWith(val));
          if (match) this.value = match + " ";
        } else if (parts[0] === "/filter") {
          const cats = ["all", "tutorials", "blog", "essays", "projects"];
          const match = cats.find((c) => c.startsWith(parts[1]?.toLowerCase()));
          if (match) this.value = "/filter " + match + " ";
        } else if (parts[0] === "/theme") {
          const themes = ["dark", "light"];
          const match = themes.find((t) => t.startsWith(parts[1]));
          if (match) this.value = "/theme " + match + " ";
        } else if (parts[0] === "/export") {
          const formats = ["txt", "json"];
          const match = formats.find((f) => f.startsWith(parts[1]));
          if (match) this.value = "/export " + match + " ";
        } else {
          const match = allTags.find((t) => t.toLowerCase().startsWith(parts[1]?.toLowerCase()));
          if (match) this.value = parts[0] + " " + match + " ";
        }
      }
    }
  }

  // src/assets/js/modules/events/keyboard.js
  function initKeyboard() {
    document.addEventListener("keydown", function(e) {
      if (e.target === state.dom.cmdInput || e.target === state.dom.mobileCmdInput) return;
      if (e.key === "Escape") {
        if (state.openLogId) {
          const entry = document.querySelector('.log-entry[data-log-id="' + state.openLogId + '"]');
          closeDetail(state.openLogId, entry);
        } else if (state.activeFilter || state.activeKeyword) {
          window.executeCommand("/clear");
        }
      } else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const entries = document.querySelectorAll(".log-entry");
        if (!entries.length) return;
        if (state.focusedEntryIndex < entries.length - 1) {
          state.focusedEntryIndex++;
          entries[state.focusedEntryIndex].scrollIntoView({ behavior: "smooth", block: "center" });
          entries[state.focusedEntryIndex].style.outline = "2px solid var(--green)";
          if (state.focusedEntryIndex > 0) entries[state.focusedEntryIndex - 1].style.outline = "";
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const entries = document.querySelectorAll(".log-entry");
        if (!entries.length) return;
        if (state.focusedEntryIndex > 0) {
          state.focusedEntryIndex--;
          entries[state.focusedEntryIndex].scrollIntoView({ behavior: "smooth", block: "center" });
          entries[state.focusedEntryIndex].style.outline = "2px solid var(--green)";
          if (state.focusedEntryIndex < entries.length - 1) entries[state.focusedEntryIndex + 1].style.outline = "";
        }
      } else if (e.key === "Enter" && state.focusedEntryIndex >= 0) {
        const entries = document.querySelectorAll(".log-entry");
        const entry = entries[state.focusedEntryIndex];
        if (entry && entry.dataset.href) {
          window.location.href = entry.dataset.href;
        }
      } else if (e.key === "J") {
        window.scrollBy({ top: 400, behavior: "smooth" });
      } else if (e.key === "K") {
        window.scrollBy({ top: -400, behavior: "smooth" });
      }
    });
  }

  // src/assets/js/app.js
  function initTheme() {
    const saved = localStorage.getItem("terminal-theme");
    const themeToggle2 = state.dom.themeToggle;
    if (saved === "light") {
      document.body.classList.add("light");
      if (themeToggle2) themeToggle2.textContent = "\u2600\uFE0F";
    } else if (saved === "dark") {
      document.body.classList.remove("light");
      if (themeToggle2) themeToggle2.textContent = "\u{1F319}";
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      document.body.classList.add("light");
      if (themeToggle2) themeToggle2.textContent = "\u2600\uFE0F";
    }
  }
  function updateStatusBar() {
    const uptime = document.getElementById("uptime");
    const activeCount = document.getElementById("activeCount");
    if (uptime) uptime.textContent = formatUptime();
    if (activeCount) activeCount.textContent = "\u{1F4CB} " + state.feed.length + "\u7BC7\u6587\u7AE0";
  }
  document.querySelectorAll(".breadcrumb-category").forEach(function(link) {
    link.addEventListener("click", function(e) {
      e.preventDefault();
      const cat = this.dataset.category;
      if (cat) {
        state.activeFilter = cat;
        state.activeKeyword = null;
        renderLogStream(cat);
        showView("log");
        window.scrollTo(0, 0);
      }
    });
  });
  var themeToggle = state.dom.themeToggle;
  if (themeToggle) {
    themeToggle.addEventListener("click", function() {
      document.body.classList.toggle("light");
      const isLight = document.body.classList.contains("light");
      this.textContent = isLight ? "\u2600\uFE0F" : "\u{1F319}";
      localStorage.setItem("terminal-theme", isLight ? "light" : "dark");
    });
  }
  window.addEventListener("hashchange", handleHashRoute);
  try {
    initDOM();
    initTheme();
    generateParticles();
    renderFilterChips();
    renderSidebarSkills();
    renderRecentErrors();
    renderQuote();
    updateStatusBar();
    setInterval(updateStatusBar, 6e4);
    initCommandInput();
    initKeyboard();
    handleHashRoute();
  } catch (e) {
    console.error(e);
  } finally {
    const loading = document.getElementById("loadingOverlay");
    if (loading) {
      loading.style.display = "none";
      loading.remove();
    }
  }
  console.log("\u{1F30C} \u89C2\u6D4B\u7AD9\u5DF2\u542F\u52A8\u3002");
  console.log("\u{1F4E1} \u6B63\u5728\u76D1\u542C\u5B66\u4E60\u5B87\u5B99\u7684\u4FE1\u53F7...");
  console.log("\u{1F4A1} \u8BD5\u8BD5\u70B9\u51FB\u5361\u7247\u3001\u5207\u6362\u8FC7\u6EE4\u5668\u3001\u6216\u6309 j/k \u952E\u6D4F\u89C8\u3002");
})();
//# sourceMappingURL=bundle.js.map
