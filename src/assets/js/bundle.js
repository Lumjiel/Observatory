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
      viewContainers: {},
      mobileNav: null,
      themeToggle: null
    }
  };
  function initDOM() {
    state.dom = {
      cmdInput: document.getElementById("cmdInput"),
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
      mobileNav: document.getElementById("mobileNav"),
      themeToggle: document.getElementById("themeToggle")
    };
  }
  initDOM();
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
  }
  computeStats();
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

  // src/assets/js/modules/router.js
  function showView(viewName) {
    const { viewContainers, mobileNav } = state.dom;
    Object.keys(viewContainers).forEach((v) => viewContainers[v].classList.remove("active"));
    if (viewContainers[viewName]) viewContainers[viewName].classList.add("active");
    setCurrentView(viewName);
    document.body.classList.toggle("view-log-active", viewName === "log");
    mobileNav?.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    window.location.hash = viewName === "log" ? "" : viewName;
  }
  function handleHashRoute(renderers2) {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      renderers2.renderLogStream();
      showView("log");
      return;
    }
    const routes = {
      "dashboard": renderers2.renderDashboard,
      "errors": renderers2.renderErrors,
      "milestones": renderers2.renderMilestones,
      "projects": renderers2.renderProjects,
      "skills": renderers2.renderSkillsView,
      "about": renderers2.renderAbout,
      "help": renderers2.renderHelp
    };
    if (routes[hash]) {
      routes[hash]();
    } else {
      renderers2.renderLogStream();
      showView("log");
      return;
    }
    showView(hash);
  }
  window.addEventListener("hashchange", () => {
  });

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

  // src/assets/js/modules/events/logEvents.js
  function attachLogEvents() {
    document.querySelectorAll(".log-entry").forEach((entry) => {
      entry.addEventListener("click", function(e) {
        if (e.target.closest(".tag-hover") || e.target.closest(".log-time") || e.target.closest(".log-link")) return;
        const href = this.dataset.href;
        if (href) {
          window.location.href = href;
          return;
        }
        const logId = this.dataset.logId;
        toggleDetail(logId, this);
      });
      let pressTimer;
      entry.addEventListener("touchstart", function(e) {
        if (e.target.closest(".tag-hover") || e.target.closest(".log-link")) return;
        const href = this.dataset.href;
        pressTimer = setTimeout(() => {
          if (href) window.location.href = href;
        }, 500);
      }, { passive: true });
      entry.addEventListener("touchend", () => clearTimeout(pressTimer));
      entry.addEventListener("touchmove", () => clearTimeout(pressTimer));
    });
  }
  function attachTagHoverEvents() {
    document.querySelectorAll(".tag-hover").forEach((tag) => {
      tag.addEventListener("mouseenter", function() {
        this.style.cursor = "pointer";
      });
      tag.addEventListener("click", function(e) {
        e.stopPropagation();
        const t = this.dataset.tag;
        window.location.href = "/tags/?tag=" + encodeURIComponent(t);
      });
    });
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
  function renderLogStream(filterType = null, keyword = null, page = 1) {
    const { feed, PAGE_SIZE } = state;
    let filteredLogs = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (filterType && filterType !== "all") {
      filteredLogs = filteredLogs.filter((l) => l.typeLabel === filterType);
    }
    if (keyword) {
      const kw = keyword.toLowerCase();
      filteredLogs = filteredLogs.filter(
        (l) => l.description.toLowerCase().includes(kw) || l.tags.some((t) => t.toLowerCase().includes(kw)) || l.typeLabel.toLowerCase().includes(kw)
      );
    }
    setFilteredLogs(filteredLogs);
    setCurrentPage(page);
    const container = state.dom.viewContainers.log;
    if (!container) return;
    container.innerHTML = "";
    if (filteredLogs.length === 0) {
      container.innerHTML = '<p style="color:var(--gray)">\u6CA1\u6709\u5339\u914D\u7684\u6587\u7AE0\u3002</p>';
      return;
    }
    const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, filteredLogs.length);
    const pageLogs = filteredLogs.slice(startIdx, endIdx);
    const stream = document.createElement("div");
    stream.className = "log-stream";
    pageLogs.forEach((log, idx) => {
      const entry = document.createElement("div");
      entry.className = "log-entry";
      entry.dataset.logId = log.id;
      entry.dataset.index = startIdx + idx;
      entry.dataset.href = log.href;
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
            </div>`;
      stream.appendChild(entry);
    });
    container.appendChild(stream);
    if (totalPages > 1) {
      const pagination = document.createElement("div");
      pagination.className = "pagination";
      pagination.innerHTML = renderPaginationButtons(totalPages, page);
      container.appendChild(pagination);
      pagination.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", function() {
          const pageNum = parseInt(this.dataset.page);
          if (pageNum && pageNum !== page) {
            renderLogStream(state.activeFilter, state.activeKeyword, pageNum);
            container.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
    attachLogEvents();
    attachTagHoverEvents();
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
    const { categoryStats, feed } = state;
    const total = categoryStats.total;
    const blogCount = categoryStats.blog;
    const essaysCount = categoryStats.essays;
    const tutorialsCount = categoryStats.tutorials;
    const projectsCount = categoryStats.projects;
    const maxSourceCount = Math.max(blogCount, essaysCount, tutorialsCount, projectsCount, 1);
    const allTags = {};
    feed.forEach((l) => l.tags.forEach((t) => {
      allTags[t] = (allTags[t] || 0) + 1;
    }));
    const topTags = Object.entries(allTags).sort((a, b) => b[1] - a[1]).slice(0, 40);
    const maxTag = topTags.length > 0 ? topTags[0][1] : 1;
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
      const count = contributions[dateStr] || 0;
      heatmapDays.push({ date: dateStr, day: dayName, count });
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
    const recentLogs = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
    const catLabelMap = { tutorials: "\u6559\u7A0B", blog: "\u535A\u5BA2", essays: "\u968F\u7B14", projects: "\u9879\u76EE" };
    const catColorMap = { tutorials: "var(--blue)", blog: "var(--green)", essays: "var(--magenta)", projects: "var(--amber)" };
    const signalSection = `
        <div class="dash-section">
            <div class="dash-section-title">\u{1F4E1} \u4FE1\u53F7\u6E90\u72B6\u6001</div>
            <div class="source-list">
                <div class="source-row">
                    <span class="source-dot" style="color:var(--green)">\u{1F7E2}</span>
                    <span class="source-label">\u535A\u5BA2\u4FE1\u53F7</span>
                    <span class="source-count">${String(blogCount).padStart(2)}</span>
                    <span class="source-bar">${"\u2588".repeat(Math.round(blogCount / maxSourceCount * 22))}${"\u2591".repeat(22 - Math.round(blogCount / maxSourceCount * 22))}</span>
                </div>
                <div class="source-row">
                    <span class="source-dot" style="color:var(--magenta)">\u{1F7E3}</span>
                    <span class="source-label">\u968F\u7B14\u4FE1\u53F7</span>
                    <span class="source-count">${String(essaysCount).padStart(2)}</span>
                    <span class="source-bar">${"\u2588".repeat(Math.round(essaysCount / maxSourceCount * 22))}${"\u2591".repeat(22 - Math.round(essaysCount / maxSourceCount * 22))}</span>
                </div>
                <div class="source-row">
                    <span class="source-dot" style="color:var(--blue)">\u{1F535}</span>
                    <span class="source-label">\u6559\u7A0B\u4FE1\u53F7</span>
                    <span class="source-count">${String(tutorialsCount).padStart(2)}</span>
                    <span class="source-bar">${"\u2588".repeat(Math.round(tutorialsCount / maxSourceCount * 22))}${"\u2591".repeat(22 - Math.round(tutorialsCount / maxSourceCount * 22))}</span>
                </div>
                <div class="source-row">
                    <span class="source-dot" style="color:var(--amber)">\u{1F7E0}</span>
                    <span class="source-label">\u9879\u76EE\u4FE1\u53F7</span>
                    <span class="source-count">${String(projectsCount).padStart(2)}</span>
                    <span class="source-bar">${"\u2588".repeat(Math.round(projectsCount / maxSourceCount * 22))}${"\u2591".repeat(22 - Math.round(projectsCount / maxSourceCount * 22))}</span>
                </div>
            </div>
            <div class="source-summary">\u{1F4CB} \u603B\u8BA1 ${total} \u6761\u4FE1\u53F7 | \u4FE1\u53F7\u5F3A\u5EA6: \u7A33\u5B9A</div>
        </div>`;
    const tagGalaxySection = `
        <div class="dash-section">
            <div class="dash-section-title">\u{1F3F7}\uFE0F \u6807\u7B7E\u661F\u7CFB</div>
            <div class="tag-galaxy" id="tagGalaxy">
                ${topTags.map(([tag, count], i) => {
      const opacity = 0.45 + count / maxTag * 0.55;
      const colors = ["var(--green)", "var(--blue)", "var(--amber)", "var(--magenta)"];
      const color = colors[i % colors.length];
      const seed = tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const x = 2 + seed % 92;
      const y = 5 + seed * 7 % 85;
      const delay = seed % 30 / 10;
      const duration = 3 + seed % 20 / 10;
      const floatClass = count >= 2 ? "float" : "";
      return `<span class="galaxy-tag ${floatClass}" data-tag="${tag}" onclick="filterByTag('${tag}')" style="left:${x}%;top:${y}%;color:${color};opacity:${opacity};--float-delay:${delay}s;--float-dur:${duration}s;">#${tag}</span>`;
    }).join("")}
            </div>
        </div>`;
    const dayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];
    const heatmapSection = `
        <div class="dash-section">
            <div class="dash-section-title">\u{1F525} GitHub \u8D21\u732E\u70ED\u529B\u56FE (\u8FD190\u5929)</div>
            <div class="heatmap-wrap">
                <div class="heatmap-day-labels">
                    ${dayLabels.map((d) => `<div class="day-label">${d}</div>`).join("")}
                </div>
                <div class="heatmap-container">
                    <div class="heatmap-grid">
                        ${weeks.map((week, wi) => `
                            <div class="heatmap-col" style="grid-column:${wi + 1}">
                                ${week.map((day) => {
      const level = day.count === 0 ? 0 : day.count <= 2 ? 1 : day.count <= 5 ? 2 : 3;
      return `<div class="heatmap-cell" data-level="${level}" data-date="${day.date}" data-count="${day.count}" title="${day.date}: ${day.count}\u6B21"></div>`;
    }).join("")}
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>
            <div class="heatmap-legend">
                <span>\u5C11</span>
                <div class="heatmap-cell" data-level="0"></div>
                <div class="heatmap-cell" data-level="1"></div>
                <div class="heatmap-cell" data-level="2"></div>
                <div class="heatmap-cell" data-level="3"></div>
                <span>\u591A</span>
            </div>
        </div>`;
    const recentSection = `
        <div class="dash-section">
            <div class="dash-section-title">\u{1F4E1} \u6700\u8FD1\u4FE1\u53F7\u63A5\u6536\u8BB0\u5F55</div>
            <div class="recent-table-wrap">
                <table class="recent-table">
                    <thead><tr><th>\u65F6\u95F4</th><th>\u7C7B\u578B</th><th>\u5185\u5BB9</th><th>\u6807\u7B7E</th></tr></thead>
                    <tbody>
                        ${recentLogs.map((log) => `
                            <tr>
                                <td>${log.timestamp.slice(0, 10)}</td>
                                <td style="color:${catColorMap[log.typeLabel]}">${catLabelMap[log.typeLabel]}</td>
                                <td class="recent-desc"><a href="${log.href}">${log.description.slice(0, 20)}</a></td>
                                <td>${log.tags.slice(0, 1).map((t) => "#" + t).join("")}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </div>`;
    container.innerHTML = `
        <div class="dashboard-container">
            <div class="dash-header">\u{1F4CA} \u89C2\u6D4B\u7AD9\u4EEA\u8868\u76D8</div>
            ${signalSection}
            ${tagGalaxySection}
            ${recentSection}
            ${heatmapSection}
        </div>`;
    showView("dashboard");
  }

  // src/assets/js/modules/renderers/errors.js
  function renderErrors() {
    const container = state.dom.viewContainers.errors;
    if (!container) return;
    const githubData = window.GITHUB_DATA || {};
    const repos = githubData.repos || [];
    const username = githubData.username || "Lumjiel";
    const lastFetched = githubData.lastFetched ? new Date(githubData.lastFetched).toLocaleDateString("zh-CN") : "\u672A\u77E5";
    const mostRecent = repos.length > 0 && repos[0].updatedAt ? new Date(repos[0].updatedAt).toLocaleDateString("zh-CN") : "\u65E0\u6570\u636E";
    const langColors = {
      JavaScript: "#F7DF1E",
      TypeScript: "#3178C6",
      Python: "#3572A5",
      Java: "#B07219",
      Go: "#00ADD8",
      Vue: "#41B883",
      HTML: "#E34C26"
    };
    container.innerHTML = `
        <div class="report-container">
            <div class="report-header">
                <div class="report-title-wrap">
                    <div class="report-title">\u5916\u90E8\u4FE1\u53F7\u63A2\u6D4B\u62A5\u544A</div>
                    <div class="report-version">observatory v1.0</div>
                </div>
            </div>
            <div class="report-scan">
                <div class="scan-title">\u626B\u63CF\u7ED3\u679C</div>
                <div class="scan-stat"><span class="scan-icon">\u{1F4E1}</span><span>\u63A2\u6D4B\u5230 <strong>${repos.length}</strong> \u4E2A\u6D3B\u8DC3\u4EE3\u7801\u6784\u9020\u4F53</span></div>
                <div class="scan-stat"><span class="scan-dot" style="color:var(--green)">\u{1F7E2}</span><span>\u6700\u8FD1\u6D3B\u8DC3: ${mostRecent}</span></div>
            </div>
            <div class="report-divider"></div>
            <div class="repo-list">
                ${repos.slice(0, 6).map((r) => `
                    <a class="repo-card" href="${r.url}" target="_blank" rel="noopener">
                        <div class="repo-name">\u{1F4E6} ${r.name}</div>
                        <div class="repo-desc">${r.description || "\u6682\u65E0\u63CF\u8FF0"}</div>
                        <div class="repo-meta">
                            ${r.language ? `<span class="repo-lang"><span class="lang-dot" style="background:${langColors[r.language] || "#888"}"></span>${r.language}</span>` : ""}
                            <span>\u2B50 ${r.stars}</span>
                            <span>\u{1F374} ${r.forks}</span>
                            <span class="repo-updated">\u66F4\u65B0: ${r.updatedAgo || "\u672A\u77E5"}</span>
                        </div>
                    </a>
                `).join("")}
            </div>
            <div class="report-divider"></div>
            <div class="report-log">
                <div class="log-title">\u63A2\u6D4B\u65E5\u5FD7</div>
                <div class="log-entries">
                    <div class="log-entry">[${repos[0] ? new Date(repos[0].updatedAt).toLocaleDateString("zh-CN").replace(/-/g, "") : "05-08"}] \u63A2\u6D4B\u5230 ${repos[0]?.name || "observer"} \u6709\u65B0\u7684\u63D0\u4EA4</div>
                    <div class="log-entry">[${repos[1] ? new Date(repos[1].updatedAt).toLocaleDateString("zh-CN").replace(/-/g, "") : "05-03"}] \u63A2\u6D4B\u5230 ${repos[1]?.name || "project"} \u83B7\u5F97 ${repos[1]?.stars || 0} \u4E2A\u65B0\u661F</div>
                </div>
            </div>
            <div class="report-divider"></div>
            <div class="report-footer">
                <span>> \u6570\u636E\u6765\u6E90: github.com/${username}</span>
                <span>> \u66F4\u65B0\u9891\u7387: \u6BCF\u6B21\u6784\u5EFA\u65F6\u81EA\u52A8\u540C\u6B65</span>
            </div>
            <p class="report-updated">\u6570\u636E\u66F4\u65B0\u4E8E ${lastFetched}</p>
        </div>`;
    showView("errors");
  }

  // src/assets/js/modules/renderers/views.js
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
  function renderHelp() {
    const container = state.dom.viewContainers.help;
    if (!container) return;
    container.innerHTML = `
        <h2 style="color:var(--green);">\u{1F4D6} \u53EF\u7528\u547D\u4EE4</h2>
        <pre style="color:var(--text); line-height:1.6;">
filter [all|tutorials|blog|essays|projects]       \u6309\u5206\u7C7B\u7B5B\u9009
grep [\u5173\u952E\u8BCD]                                    \u5168\u6587\u641C\u7D22
status / dashboard                               \u6253\u5F00\u661F\u7CFB\uFF08\u4EEA\u8868\u76D8\uFF09
errors                                           \u5916\u90E8\u4FE1\u53F7\uFF08GitHub\u4ED3\u5E93\uFF09
milestones                                       \u5168\u90E8\u6587\u7AE0
skills / neofetch                                \u6280\u80FD\u6811
about                                            \u7CFB\u7EDF\uFF08\u5173\u4E8E\uFF09
help                                             \u663E\u793A\u6B64\u5E2E\u52A9
clear                                            \u6E05\u9664\u7B5B\u9009/\u8FD4\u56DE\u6587\u7AE0\u6D41
theme dark|light                                 \u5207\u6362\u4E3B\u9898
export txt|json                                  \u5BFC\u51FA\u5F53\u524D\u89C6\u56FE
        </pre>
        <p style="color:var(--text-dim);">\u5FEB\u6377\u952E: j/k \u79FB\u52A8 | Esc \u5173\u95ED | / \u805A\u7126\u641C\u7D22 | Tab \u8865\u5168</p>`;
    showView("help");
  }

  // src/assets/js/modules/renderers/about.js
  var ASCII_LINES = [
    "                    _\\  \\_                             ",
    `                     /__|         "Bug? That's not a    `,
    "                 ___//_           bug, that's a          ",
    '                /      \\              FEATURE."         ',
    "               /        /\\                              ",
    "              / /\\     \\/  )                           ",
    "              \\_\\|     |  /                            ",
    "               (_      |\\/                              ",
    "                 |     |                                 ",
    "                 |_    |                                 ",
    "                  /   |                                  ",
    "                 / /| |                                  ",
    "                /_/ |_|                                  ",
    "               /|    /\\                                 ",
    "      _______/_/____\\_\\______________________________________________________ "
  ];
  var TYPE_MAP = { tutorials: "INFO", blog: "READ", essays: "READ", projects: "BUILD" };
  function renderAbout() {
    const container = state.dom.viewContainers.about;
    if (!container) return;
    const siteData = window.SITE_DATA || {};
    const author = siteData.author || "[\u64CD\u4F5C\u5458\u4EE3\u53F7]";
    const location = siteData.location || "\u672A\u77E5\u5730\u70B9";
    const hostname = window.location.hostname || "observatory.local";
    const uptime = formatUptime();
    const { feed } = state;
    const total = feed.length;
    const published = feed.filter((a) => a.status === "done").length;
    const unpublished = feed.filter((a) => a.status !== "done").length;
    const healthPercent = total > 0 ? Math.round(published / total * 100) : 100;
    const barLen = 10;
    const filled = Math.round(healthPercent / 100 * barLen);
    const healthBar = "\u2588".repeat(filled) + "\u2591".repeat(barLen - filled);
    const recentSignals = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5).map((a) => ({
      date: a.timestamp.slice(0, 10),
      type: TYPE_MAP[a.typeLabel] || "READ",
      msg: a.description
    }));
    const currentTargets = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5).map((a) => a.description);
    const mkSection = (title, icon, color, items) => `
        <div class="about-section">
            <div class="about-section-title" style="color:var(--${color});">${icon} ${title}</div>
            ${items.map((t) => `<div class="about-row"><span class="about-label">${t.label}</span><span class="about-value">${t.value}</span></div>`).join("")}
        </div>`;
    const mkListSection = (title, icon, color, items) => `
        <div class="about-section">
            <div class="about-section-title" style="color:var(--${color});">${icon} ${title}</div>
            ${items.map((t) => `<div class="about-list-item">${t}</div>`).join("")}
        </div>`;
    const sysSection = mkSection("\u7CFB\u7EDF\u4FE1\u606F", "\u{1F5A5}\uFE0F", "green", [
      { label: "\u4E3B\u673A\u540D", value: hostname },
      { label: "\u64CD\u4F5C\u5458", value: author },
      { label: "\u89C2\u6D4B\u4F4D\u7F6E", value: location }
    ]);
    const runSection = mkSection("\u5B9E\u65F6\u8FD0\u884C\u6570\u636E", "\u{1F4CA}", "amber", [
      { label: "\u8FD0\u884C\u65F6\u95F4", value: uptime },
      { label: "\u63A5\u6536\u4FE1\u53F7", value: total + "\u6761" },
      { label: "\u5DF2\u89E3\u7801", value: published + "\u6761" },
      { label: "\u672A\u89E3\u51B3", value: unpublished + "\u6761" },
      { label: "\u7CFB\u7EDF\u5065\u5EB7\u5EA6", value: healthBar + " " + healthPercent + "%" }
    ]);
    const moduleSection = mkSection("\u6D3B\u8DC3\u6A21\u5757\u72B6\u6001", "\u2699\uFE0F", "blue", [
      { label: "\u65E5\u5FD7\u63A5\u6536\u5668", value: "\u{1F7E2} \u6B63\u5E38" },
      { label: "\u4FE1\u53F7\u5206\u6790\u4EEA", value: "\u{1F7E2} \u6B63\u5E38" },
      { label: "\u9879\u76EE\u8FFD\u8E2A\u5668", value: "\u{1F7E2} \u6B63\u5E38" },
      { label: "\u9519\u8BEF\u590D\u76D8\u5668", value: unpublished > 0 ? "\u{1F7E1} " + unpublished + "\u6761\u672A\u89E3\u51B3" : "\u{1F7E2} \u6B63\u5E38" }
    ]);
    const signalSection = mkListSection("\u8FD1\u671F\u4FE1\u53F7\u4E8B\u4EF6", "\u{1F4E1}", "green", recentSignals.map((s) => `[${s.date}] ${s.type} ${s.msg}`));
    const targetSection = mkListSection("\u5F53\u524D\u89C2\u6D4B\u76EE\u6807", "\u{1F3AF}", "magenta", currentTargets.map((t) => "\u25B8 " + t));
    container.innerHTML = `
        <div class="about-layout">
            <div class="about-ascii">
                <pre id="aboutAsciiPre" style="color:var(--green);line-height:1.4;font-size:0.7rem;"></pre>
            </div>
            <div class="about-info hidden">
                ${sysSection}${runSection}${moduleSection}${signalSection}${targetSection}
                <div class="about-footer">
                    <span>\u89C2\u6D4B\u4ECD\u5728\u7EE7\u7EED\u3002\u4E0B\u4E2A\u4FE1\u53F7\u968F\u65F6\u51FA\u73B0\u3002</span>
                    <span style="color:var(--text-dim);">$ _</span>
                </div>
            </div>
        </div>`;
    showView("about");
    const asciiPre = document.getElementById("aboutAsciiPre");
    if (asciiPre) {
      const fullText = ASCII_LINES.join("\n") + "\n";
      let charIdx = 0;
      asciiPre.textContent = "";
      const typeChar = () => {
        if (charIdx < fullText.length) {
          asciiPre.textContent += fullText[charIdx];
          charIdx++;
          setTimeout(typeChar, 8);
        } else {
          setTimeout(() => {
            const info = document.querySelector(".about-info.hidden");
            if (info) info.classList.remove("hidden");
          }, 300);
        }
      };
      typeChar();
    }
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
  var renderers = {};
  function setRenderers(r) {
    renderers = r;
  }
  function executeCommand(cmdStr) {
    playClickSound();
    const parts = cmdStr.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");
    if (cmd === "filter") {
      const cat = arg.toLowerCase();
      if (["all", "tutorials", "blog", "essays", "projects"].includes(cat)) {
        setActiveFilter(cat === "all" ? null : cat);
        setActiveKeyword(null);
        renderers.renderLogStream?.(state.activeFilter);
        renderers.renderFilterChips?.();
        renderers.renderSignalOverview?.();
        renderers.showView?.("log");
      }
    } else if (cmd === "grep") {
      if (arg) {
        setActiveKeyword(arg);
        setActiveFilter(null);
        renderers.renderLogStream?.(null, arg);
        renderers.renderFilterChips?.();
        renderers.showView?.("log");
      }
    } else if (cmd === "status" || cmd === "dashboard") {
      renderers.renderDashboard?.();
    } else if (cmd === "errors") {
      renderers.renderErrors?.();
    } else if (cmd === "milestones") {
      renderers.renderMilestones?.();
    } else if (cmd === "projects") {
      renderers.renderProjects?.();
    } else if (cmd === "skills" || cmd === "neofetch") {
      renderers.renderSkillsView?.();
    } else if (cmd === "about") {
      renderers.renderAbout?.();
    } else if (cmd === "help") {
      renderers.renderHelp?.();
    } else if (cmd === "clear") {
      setActiveFilter(null);
      setActiveKeyword(null);
      renderers.renderLogStream?.();
      renderers.renderFilterChips?.();
      renderers.renderSignalOverview?.();
      renderers.showView?.("log");
    } else if (cmd === "theme") {
      if (arg === "dark") {
        document.body.classList.remove("light");
        localStorage.setItem("terminal-theme", "dark");
      } else if (arg === "light") {
        document.body.classList.add("light");
        localStorage.setItem("terminal-theme", "light");
      }
    } else if (cmd === "export") {
      const data = state.activeFilter ? state.feed.filter((l) => l.typeLabel === state.activeFilter) : state.feed;
      if (arg === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "articles-export.json";
        a.click();
      } else {
        const text = data.map((l) => "[" + l.typeLabel + "] " + l.timestamp + " " + l.description).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
        a.download = "articles-export.txt";
        a.click();
      }
    } else if (cmd === "/admin") {
      window.location.href = "/admin";
    }
  }
  window.executeCommand = executeCommand;

  // src/assets/js/modules/components/signalOverview.js
  function renderSignalOverview() {
    const container = document.getElementById("signalOverview");
    if (!container) return;
    const { categoryStats, activeFilter } = state;
    const total = categoryStats.total;
    const techCount = categoryStats.tutorials;
    const readingCount = categoryStats.blog + categoryStats.essays;
    const projectsCount = categoryStats.projects;
    container.innerHTML = `
        <div class="signal-card green ${!activeFilter ? "active" : ""}" onclick="executeCommand('filter all')">
            <span class="sig-value">${total}</span>
            <span class="sig-label">\u5168\u90E8\u6587\u7AE0</span>
        </div>
        <div class="signal-card blue ${activeFilter === "tutorials" ? "active" : ""}" onclick="executeCommand('filter tutorials')">
            <span class="sig-value">${techCount}</span>
            <span class="sig-label">\u6559\u7A0B</span>
        </div>
        <div class="signal-card amber ${activeFilter === "blog" ? "active" : ""}" onclick="executeCommand('filter blog')">
            <span class="sig-value">${readingCount}</span>
            <span class="sig-label">\u535A\u5BA2</span>
        </div>
        <div class="signal-card magenta ${activeFilter === "projects" ? "active" : ""}" onclick="executeCommand('filter projects')">
            <span class="sig-value">${projectsCount}</span>
            <span class="sig-label">\u9879\u76EE</span>
        </div>`;
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
          window.executeCommand("filter all");
        } else {
          setActiveFilter(filter);
          window.executeCommand("filter " + filter);
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

  // src/assets/js/modules/events/input.js
  function initCommandInput() {
    const { cmdInput, tagCounts } = state;
    if (!cmdInput) return;
    cmdInput.addEventListener("keydown", function(e) {
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
        const commands = ["filter", "grep", "status", "dashboard", "errors", "milestones", "skills", "neofetch", "about", "help", "clear", "theme", "export"];
        const allTags = Object.keys(tagCounts);
        const parts = this.value.split(/\s+/);
        if (parts.length === 1) {
          const match = commands.find((c) => c.startsWith(val));
          if (match) this.value = match + " ";
        } else if (parts[0] === "filter") {
          const cats = ["all", "tutorials", "blog", "essays", "projects"];
          const match = cats.find((c) => c.startsWith(parts[1]?.toLowerCase()));
          if (match) this.value = "filter " + match + " ";
        } else if (parts[0] === "theme") {
          const themes = ["dark", "light"];
          const match = themes.find((t) => t.startsWith(parts[1]));
          if (match) this.value = "theme " + match + " ";
        } else if (parts[0] === "export") {
          const formats = ["txt", "json"];
          const match = formats.find((f) => f.startsWith(parts[1]));
          if (match) this.value = "export " + match + " ";
        } else {
          const match = allTags.find((t) => t.toLowerCase().startsWith(parts[1]?.toLowerCase()));
          if (match) this.value = parts[0] + " " + match + " ";
        }
      }
    });
  }

  // src/assets/js/modules/events/keyboard.js
  function initKeyboard() {
    document.addEventListener("keydown", function(e) {
      if (e.target === state.dom.cmdInput) return;
      if (e.key === "/") {
        e.preventDefault();
        if (state.dom.cmdInput) state.dom.cmdInput.focus();
      } else if (e.key === "Escape") {
        if (state.openLogId) {
          const entry = document.querySelector('.log-entry[data-log-id="' + state.openLogId + '"]');
          closeDetail(state.openLogId, entry);
        } else if (state.activeFilter || state.activeKeyword) {
          window.executeCommand("clear");
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

  // src/assets/js/modules/events/mobile.js
  var lastScrollY = 0;
  var hideTimer;
  function initMobileNav() {
    const { mobileNav } = state.dom;
    if (!mobileNav) return;
    mobileNav.addEventListener("click", function(e) {
      const btn = e.target.closest("button");
      if (btn) {
        const view = btn.dataset.view;
        window.executeCommand(view === "log" ? "clear" : view);
      }
    });
    if (window.innerWidth <= 899) {
      window.addEventListener("scroll", onMobileScroll, { passive: true });
    }
    window.addEventListener("beforeunload", () => {
      window.removeEventListener("scroll", onMobileScroll);
      clearTimeout(hideTimer);
    });
  }
  function onMobileScroll() {
    const currentY = window.scrollY;
    if (Math.abs(currentY - lastScrollY) > 10) {
      state.dom.mobileNav?.classList.add("hidden");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function() {
        state.dom.mobileNav?.classList.remove("hidden");
      }, 1500);
    }
    lastScrollY = currentY;
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
  window.addEventListener("hashchange", () => {
    handleHashRoute({
      renderLogStream,
      renderDashboard,
      renderErrors,
      renderMilestones,
      renderProjects,
      renderSkillsView,
      renderAbout,
      renderHelp
    });
  });
  try {
    setRenderers({
      renderLogStream,
      renderFilterChips,
      renderSignalOverview,
      renderDashboard,
      renderErrors,
      renderMilestones,
      renderProjects,
      renderSkillsView,
      renderAbout,
      renderHelp,
      showView
    });
    initTheme();
    generateParticles();
    renderSignalOverview();
    renderFilterChips();
    renderSidebarSkills();
    renderRecentErrors();
    renderQuote();
    updateStatusBar();
    setInterval(updateStatusBar, 6e4);
    initCommandInput();
    initKeyboard();
    initMobileNav();
    renderLogStream();
    showView("log");
    handleHashRoute({
      renderLogStream,
      renderDashboard,
      renderErrors,
      renderMilestones,
      renderProjects,
      renderSkillsView,
      renderAbout,
      renderHelp
    });
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
