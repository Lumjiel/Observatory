import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { CATEGORIES, CATEGORY_LABELS } from './shared/constants.js';

const API_BASE = (window.BASE_PATH || '') + '/api';

let editor = null;
let currentSlug = null;
let currentTags = [];
let isPreviewOpen = false;
let currentDraftState = false; // true = 草稿, false = 已发布

// ============ Auth ============
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  if (res.status === 401) { window.location.href = (window.BASE_PATH || '') + '/admin'; return null; }
  return res.json();
}

// ============ List View ============
async function loadArticles() {
  const articles = await api('/articles');
  if (!articles) return;
  renderArticleList(articles);
  document.getElementById('articleCount').textContent = `${articles.length} 篇文章`;
}

function renderArticleList(articles) {
  const list = document.getElementById('articleList');
  if (!articles || articles.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>暂无文章</p></div>';
    return;
  }
  list.innerHTML = articles.map(a => `
    <div class="article-item${a.draft ? ' article-draft' : ''}" data-slug="${a.slug}" data-category="${a.category}">
      <div class="article-item-title">${a.title}</div>
      <div class="article-item-meta">
        <span class="cat-tag cat-${a.category}">${CATEGORY_LABELS[a.category] || a.category}</span>
        <span>${(a.tags || []).slice(0, 2).join(', ')}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.article-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.article-select')) return;
      const slug = item.dataset.slug;
      window.location.href = `${window.BASE_PATH || ''}/admin/article/${encodeURIComponent(slug)}`;
    });
  });
}

// ============ Editor ============
function initEditor(content = '') {
  if (editor) editor.destroy();

  const theme = EditorView.theme({
    '&': { height: '100%', fontSize: '14px' },
    '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, monospace)' },
    '.cm-content': { padding: '1rem' },
    '.cm-focused': { outline: 'none' },
    '.cm-line': { padding: '0 0.5rem' },
  });

  const state = EditorState.create({
    doc: content,
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      theme,
      EditorView.lineWrapping,
      placeholder('开始编写文章...'),
    ]
  });

  editor = new EditorView({ state, parent: document.getElementById('editor-container') });
}

function getEditorContent() {
  return editor ? editor.state.doc.toString() : '';
}

// ============ Preview ============
async function updatePreview() {
  const content = getEditorContent();
  const previewEl = document.getElementById('previewContent');
  const statusEl = document.getElementById('previewStatus');

  if (!content.trim()) {
    previewEl.innerHTML = '<div class="editor-loading"><div style="color: var(--text-dim); text-align: center; padding: 2rem;">开始编辑，实时预览将同步显示</div></div>';
    return;
  }

  statusEl.textContent = '渲染中...';
  const data = await api('/preview', {
    method: 'POST',
    body: JSON.stringify({ content, slug: currentSlug || '' })
  });

  if (data && data.html) {
    // 云端预览时修正图片/链接路径
    const base = window.BASE_PATH || '';
    previewEl.innerHTML = base ? data.html.replace(/(src|href)="\//g, `$1="${base}/`) : data.html;
    statusEl.textContent = '就绪';
  } else {
    statusEl.textContent = '渲染失败';
  }
}

let previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 500);
}

// ============ Tags ============
function renderTags() {
  const chips = document.getElementById('tagChips');
  chips.innerHTML = currentTags.map((tag, i) => `
    <span class="tag-chip">${tag}<button onclick="window.removeTag(${i})">×</button></span>
  `).join('');
}

window.addTag = function(tag) {
  tag = tag.trim();
  if (tag && !currentTags.includes(tag)) {
    currentTags.push(tag);
    renderTags();
  }
  document.getElementById('tagInput').value = '';
};

window.removeTag = function(index) {
  currentTags.splice(index, 1);
  renderTags();
};

// ============ Article CRUD ============
window.newArticle = function() {
  currentSlug = null;
  currentTags = [];
  currentDraftState = false;
  document.getElementById('editorTitle').textContent = '新建文章';
  document.getElementById('articleTitle').value = '';
  document.getElementById('articleExcerpt').value = '';
  document.getElementById('articleCategory').value = 'blog';
  document.getElementById('deleteBtn').style.display = 'none';
  document.getElementById('draftToggleBtn').style.display = 'none';
  document.getElementById('draftLabel').textContent = '发布';
  document.getElementById('tagInput').value = '';
  currentTags = [];
  renderTags();
  initEditor('');
  document.querySelector('.editor-content-area').classList.remove('preview-open');
  updatePreview();
};

window.loadArticle = async function(slug) {
  const article = await api(`/articles/${slug}`);
  if (!article) { showToast('文章不存在', 'error'); return; }

  currentSlug = article.slug;
  currentTags = article.tags || [];
  currentDraftState = !!article.draft;

  document.getElementById('editorTitle').textContent = '编辑文章';
  document.getElementById('articleTitle').value = article.title || '';
  document.getElementById('articleExcerpt').value = article.excerpt || '';
  document.getElementById('articleCategory').value = article.category || 'blog';
  document.getElementById('deleteBtn').style.display = '';
  document.getElementById('draftToggleBtn').style.display = '';
  document.getElementById('draftLabel').textContent = article.draft ? '转为草稿' : '重新发布';
  document.getElementById('tagInput').value = '';
  renderTags();

  // 立即清空预览，防止切换时残留旧内容
  document.getElementById('previewContent').innerHTML = '';
  initEditor(article.content || '');

  // Auto-open preview in editor mode
  document.querySelector('.editor-content-area').classList.add('preview-open');
  schedulePreview();
};

window.saveArticle = async function() {
  const title = document.getElementById('articleTitle').value.trim();
  const category = document.getElementById('articleCategory').value;
  const excerpt = document.getElementById('articleExcerpt').value.trim();
  const content = getEditorContent();

  if (!title) { showToast('请输入标题', 'error'); return; }
  if (!content) { showToast('请输入内容', 'error'); return; }

  const body = { title, category, content, tags: currentTags, excerpt, draft: currentDraftState };

  try {
    let res;
    if (currentSlug) {
      res = await api(`/articles/${currentSlug}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      res = await api('/articles', { method: 'POST', body: JSON.stringify(body) });
    }

    if (res && res.success) {
      showToast('保存成功', 'success');
      if (!currentSlug && res.slug) {
        window.location.href = `${window.BASE_PATH || ''}/admin/article/${encodeURIComponent(res.slug)}`;
      }
    } else {
      showToast(res?.error || '保存失败', 'error');
    }
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
};

window.deleteCurrentArticle = async function() {
  if (!currentSlug) return;
  if (!confirm('确定删除这篇文章？')) return;

  const res = await api(`/articles/${currentSlug}`, { method: 'DELETE' });
  if (res && res.success) {
    showToast('已删除', 'success');
    window.location.href = (window.BASE_PATH || '') + '/admin';
  } else {
    showToast(res?.error || '删除失败', 'error');
  }
};

window.toggleDraft = function() {
  // 切换状态：草稿 → 发布，或 发布 → 草稿
  currentDraftState = !currentDraftState;
  const label = document.getElementById('draftLabel');
  label.textContent = currentDraftState ? '重新发布' : '转为草稿';
  saveArticle();
};

// ============ Toolbar Actions ============
function insertAtCursor(before, after = '') {
  if (!editor) return;
  const { from, to } = editor.state.selection.main;
  editor.dispatch({
    changes: { from, to, insert: before + editor.state.sliceDoc(from, to) + after },
    selection: { anchor: from + before.length }
  });
  editor.focus();
}

window.insertHeading = function(level) {
  const prefix = '#'.repeat(level) + ' ';
  insertAtCursor(prefix);
  schedulePreview();
};

window.insertBold = function() {
  insertAtCursor('**', '**');
  schedulePreview();
};

window.insertItalic = function() {
  insertAtCursor('*', '*');
  schedulePreview();
};

window.insertCode = function() {
  insertAtCursor('`', '`');
  schedulePreview();
};

window.insertLink = function() {
  insertAtCursor('[', '](url)');
  schedulePreview();
};

window.insertImage = function() {
  insertAtCursor('![alt](', ')');
  schedulePreview();
};

// ============ Preview Toggle ============
window.togglePreview = function() {
  const area = document.querySelector('.editor-content-area');
  const btn = document.getElementById('previewToggle');
  isPreviewOpen = !isPreviewOpen;
  area.classList.toggle('preview-open', isPreviewOpen);
  btn.innerHTML = isPreviewOpen ? '✕ 预览' : '▶ 预览';
  if (isPreviewOpen) updatePreview();
};

// ============ Toast ============
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3000);
}
window.showToast = showToast;

// ============ Image Upload ============
function setupImageUpload() {
  const dropOverlay = document.getElementById('dropOverlay');
  const editorWrapper = document.getElementById('editorWrapper');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    editorWrapper.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
  });

  ['dragenter', 'dragover'].forEach(evt => editorWrapper.addEventListener(evt, () => dropOverlay.classList.add('active')));
  ['dragleave', 'drop'].forEach(evt => editorWrapper.addEventListener(evt, () => dropOverlay.classList.remove('active')));

  editorWrapper.addEventListener('drop', async e => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await uploadImage(file);
    }
  });

  // Paste image
  document.addEventListener('paste', async e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        await uploadImage(item.getAsFile());
        break;
      }
    }
  });
}

async function uploadImage(file) {
  if (!file) return;
  const indicator = document.getElementById('uploadIndicator');
  const uploadText = document.getElementById('uploadText');
  indicator.style.display = 'flex';
  uploadText.textContent = '上传中...';

  try {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      const slug = currentSlug || 'misc';
      const res = await api('/upload-image', {
        method: 'POST',
        body: JSON.stringify({ image: base64, slug })
      });
      if (res && res.path) {
        insertAtCursor(`![${file.name}](${res.path})`);
        showToast('上传成功', 'success');
        schedulePreview();
      } else {
        showToast('上传失败', 'error');
      }
    };
    reader.readAsDataURL(file);
  } finally {
    indicator.style.display = 'none';
  }
}

// ============ Batch Operations ============
window.batchDelete = async function(slugs) {
  if (!confirm(`确定删除 ${slugs.length} 篇文章？`)) return;
  const res = await api('/articles/batch-delete', { method: 'POST', body: JSON.stringify({ slugs }) });
  if (res && res.success) {
    showToast('已删除', 'success');
    loadArticles();
  }
};

window.doBatchMove = async function() {
  const target = document.getElementById('moveTargetCategory').value;
  const selected = getSelectedArticles();
  if (!selected.length) return;
  const res = await api('/articles/batch-move', { method: 'POST', body: JSON.stringify({ slugs: selected, targetCategory: target }) });
  if (res && res.success) {
    showToast('已移动', 'success');
    document.getElementById('moveDialog').classList.remove('active');
    loadArticles();
  }
};

// ============ Init ============
export function init() {
  // Check page mode
  const body = document.body;
  const isList = body.classList.contains('mode-list');
  const isDrafts = body.classList.contains('mode-drafts');
  const isEditor = body.classList.contains('mode-editor');
  const isSettings = body.classList.contains('mode-settings');

  if (isList) {
    loadArticles();
    setupSearch();
  } else if (isDrafts) {
    loadArticles();
    setupSearch();
  } else if (isEditor) {
    setupImageUpload();
    setupTagInput();
    editor?.then?.(() => {}); // editor already initialized

    // Load article from URL
    const path = window.location.pathname;
    const base = window.BASE_PATH || '';
    const stripped = base && path.startsWith(base) ? path.slice(base.length) : path;
    const match = stripped.match(/^\/admin\/article\/(.+)/);
    if (match) {
      const slugOrNew = decodeURIComponent(match[1]);
      if (slugOrNew === 'new') {
        window.newArticle();
      } else {
        window.loadArticle(slugOrNew);
      }
    }
  } else if (isSettings) {
    loadGithubRepos();
  }

  // Editor content changes trigger preview
  if (editor) {
    editor.dom.addEventListener('input', schedulePreview);
  }
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', () => {
    const keyword = input.value.toLowerCase();
    document.querySelectorAll('.article-item').forEach(item => {
      const title = item.querySelector('.article-item-title').textContent.toLowerCase();
      item.style.display = keyword && !title.includes(keyword) ? 'none' : '';
    });
  });
}

function setupTagInput() {
  const input = document.getElementById('tagInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.addTag(input.value);
    }
  });
}

async function loadGithubRepos() {
  const data = await api('/github');
  if (!data) return;
  const el = document.getElementById('repoList');
  el.innerHTML = data.repos.map(r => `
    <label class="repo-item">
      <input type="checkbox" data-repo="${r.name}"${r.shown ? ' checked' : ''}>
      <div class="repo-info">
        <div class="repo-top">
          <span class="repo-name">${r.name}</span>
          <span class="repo-stars">★ ${r.stars || 0}</span>
        </div>
        <div class="repo-desc">${r.description || '暂无描述'}</div>
        <div class="repo-meta">
          <span class="repo-lang">${r.language || '-'}</span>
          <span class="repo-updated">${r.updatedAgo || ''}</span>
        </div>
      </div>
    </label>
  `).join('');

  el.querySelectorAll('input').forEach(cb => cb.addEventListener('change', saveGithubRepos));
}

async function saveGithubRepos() {
  const checked = [...document.querySelectorAll('#repoList input:checked')].map(cb => cb.dataset.repo);
  await api('/github/repos', { method: 'PUT', body: JSON.stringify({ shownRepos: checked }) });
}

window.refreshGithub = async function() {
  const btn = document.getElementById('githubRefreshBtn');
  btn.disabled = true;
  btn.textContent = '刷新中...';
  await api('/github/refresh', { method: 'POST' });
  await loadGithubRepos();
  btn.disabled = false;
  btn.textContent = '↻ 刷新';
};

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}