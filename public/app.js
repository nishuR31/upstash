// Upstash Redis Enterprise Cloud Console - Master Application Logic

// ------------------------------------------------------------------
// GLOBAL AUTHENTICATION & FETCH INTERCEPTOR (ANTI-BYPASS SECURITY)
// ------------------------------------------------------------------
let authToken = sessionStorage.getItem('upstash_auth_token') || null;

const originalFetch = window.fetch;
window.fetch = async function (resource, config = {}) {
  config = config || {};
  config.headers = config.headers || {};
  if (authToken) {
    if (config.headers instanceof Headers) {
      config.headers.set('Authorization', `Bearer ${authToken}`);
    } else if (typeof config.headers === 'object') {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }
  }

  try {
    const response = await originalFetch(resource, config);
    const urlStr = typeof resource === 'string' ? resource : (resource && resource.url) ? resource.url : '';

    if (response.status === 401 && urlStr.includes('/api/') && !urlStr.includes('/api/auth/unlock') && !urlStr.includes('/api/auth/check')) {
      authToken = null;
      sessionStorage.removeItem('upstash_auth_token');
      if (window.triggerAppLock) {
        window.triggerAppLock('Session expired or locked. Authentication required.');
      }
    }

    return response;
  } catch (err) {
    console.error("Fetch Exception:", err);
    throw err;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Lock Screen DOM Elements
  const headerLockBtn = document.getElementById('headerLockBtn');
  const appLockOverlay = document.getElementById('appLockOverlay');
  const appUnlockForm = document.getElementById('appUnlockForm');
  const lockPasswordInput = document.getElementById('lockPasswordInput');
  const toggleLockPasswordBtn = document.getElementById('toggleLockPasswordBtn');
  const lockEyeIcon = document.getElementById('lockEyeIcon');
  const lockEyeSlashIcon = document.getElementById('lockEyeSlashIcon');
  const lockErrorAlert = document.getElementById('lockErrorAlert');
  const lockErrorMsg = document.getElementById('lockErrorMsg');

  // Navigation Tab Elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewPanels = document.querySelectorAll('.view-panel');
  const headerProvisionBtn = document.getElementById('headerProvisionBtn');
  const clustersCountBadge = document.getElementById('clustersCountBadge');

  // Provisioner Form & Controls
  const provisionForm = document.getElementById('provisionForm');
  const keyTagInput = document.getElementById('keyTag');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const dbNameInput = document.getElementById('dbName');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const eyeIcon = document.getElementById('eyeIcon');
  const eyeSlashIcon = document.getElementById('eyeSlashIcon');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');

  // Terminal & OTP
  const terminalBody = document.getElementById('terminalBody');
  const clearTerminalBtn = document.getElementById('clearTerminalBtn');
  const otpBanner = document.getElementById('otpBanner');
  const otpForm = document.getElementById('otpForm');
  const otpInput = document.getElementById('otpInput');
  const otpBadge = document.getElementById('otpBadge');
  const otpErrorAlert = document.getElementById('otpErrorAlert');
  const otpErrorMsg = document.getElementById('otpErrorMsg');

  // Overview & Cluster Grids
  const overviewClusterGrid = document.getElementById('overviewClusterGrid');
  const fullClustersList = document.getElementById('fullClustersList');
  const refreshClusterStatsBtn = document.getElementById('refreshClusterStatsBtn');
  const clusterSearchInput = document.getElementById('clusterSearchInput');

  // Diagnostics Tab
  const diagTargetSelect = document.getElementById('diagTargetSelect');
  const customUrlInput = document.getElementById('customUrlInput');
  const runDiagBtn = document.getElementById('runDiagBtn');
  const diagOutputConsole = document.getElementById('diagOutputConsole');
  const diagLatencyBadge = document.getElementById('diagLatencyBadge');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // ------------------------------------------------------------------
  // 0. APP LOCK CONTROLLER & SESSION CHECKER
  // ------------------------------------------------------------------

  let isProdMode = false;

  async function checkInitialSession() {
    loadDatabases();
    pollStatus();
    if (!pollInterval) {
      pollInterval = setInterval(pollStatus, 1500);
    }
  }

  // ------------------------------------------------------------------
  // 1. TAB NAVIGATION CONTROLLER
  // ------------------------------------------------------------------

  function switchTab(tabId) {
    navTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tabId));
    viewPanels.forEach(p => p.classList.toggle('active', p.id === `view-${tabId}`));

    if (tabId === 'clusters' || tabId === 'overview') {
      loadDatabases();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      switchTab(target);
    });
  });

  if (headerProvisionBtn) {
    headerProvisionBtn.addEventListener('click', () => switchTab('provisioner'));
  }

  // ------------------------------------------------------------------
  // 2. TOAST & MODAL UTILITY SYSTEM
  // ------------------------------------------------------------------

  function showToast(msg, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    let icon = '';
    if (type === 'success') icon = '[OK] ';
    else if (type === 'error') icon = '[ERROR] ';
    else if (type === 'warn') icon = '[WARN] ';
    toast.innerHTML = `<span style="font-size:0.9em; font-weight:600">${icon}</span> <span>${msg}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  function copyToClipboard(text, label) {
    if (!text) {
      showToast(`No ${label} available to copy!`, 'warn');
      return;
    }
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} to clipboard!`, 'success');
  }

  // Delete Confirm Modal Handlers
  let pendingDeleteDbName = null;
  const customConfirmModal = document.getElementById('customConfirmModal');
  const confirmModalText = document.getElementById('confirmModalText');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  function openDeleteConfirmModal(dbName) {
    pendingDeleteDbName = dbName;
    if (confirmModalText) {
      confirmModalText.innerHTML = `Are you sure you want to remove database link <strong>"${dbName}"</strong> from <code>apis.env</code>?`;
    }
    if (customConfirmModal) {
      customConfirmModal.classList.remove('hidden');
    }
  }

  function closeDeleteConfirmModal() {
    pendingDeleteDbName = null;
    if (customConfirmModal) {
      customConfirmModal.classList.add('hidden');
    }
  }

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', closeDeleteConfirmModal);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!pendingDeleteDbName) return;
      const dbName = pendingDeleteDbName;
      closeDeleteConfirmModal();
      await executeDeleteDatabaseLink(dbName);
    });
  }

  // ------------------------------------------------------------------
  // 3. INPUT AUTO SYNC & PASSWORD VISIBILITY
  // ------------------------------------------------------------------

  if (keyTagInput) {
    keyTagInput.addEventListener('input', () => {
      const tag = keyTagInput.value.trim();
      if (tag) {
        let currentEmail = emailInput.value;
        if (currentEmail.includes('+')) {
          emailInput.value = currentEmail.replace(/\+[^@]*@/, `+${tag}@`);
        } else if (currentEmail.includes('@')) {
          const parts = currentEmail.split('@');
          emailInput.value = `${parts[0]}+${tag}@${parts[1]}`;
        }
        dbNameInput.value = `redis-db${tag}`;
      }
    });
  }

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      eyeIcon.classList.toggle('hidden', isPassword);
      eyeSlashIcon.classList.toggle('hidden', !isPassword);
    });
  }

  // ------------------------------------------------------------------
  // 4. DATABASE LISTING & RENDER ENGINE
  // ------------------------------------------------------------------

  async function loadDatabases() {
    try {
      const res = await fetch('/api/databases');
      if (!res.ok) return;
      const data = await res.json();
      activeDatabases = data.databases || [];
      if (typeof data.isProd === 'boolean') {
        isProdMode = data.isProd;
      }

      // If production mode, also merge any database credentials stored in browser localStorage
      if (isProdMode) {
        try {
          const stored = JSON.parse(localStorage.getItem('upstash_prod_databases') || '[]');
          stored.forEach(item => {
            const epMatch = item.redisUrl ? item.redisUrl.match(/@([^:\/]+)/) : null;
            const endpoint = epMatch ? epMatch[1] : item.endpoint || `${item.name}.upstash.io`;
            const dbName = item.name || endpoint.replace('.upstash.io', '');
            if (!activeDatabases.some(d => d.name === dbName || d.redisUrl === item.redisUrl)) {
              activeDatabases.push({
                id: `db-local-${Date.now()}`,
                name: dbName,
                endpoint: endpoint,
                port: 6379,
                tls: true,
                region: "us-east-1 (N. Virginia)",
                redisUrl: item.redisUrl || `rediss://default:${item.restToken}@${endpoint}:6379`,
                restUrl: item.restUrl || `https://${endpoint}`,
                restToken: item.restToken || item.password || '',
                commandsUsed: 1,
                maxCommands: 500000,
                bandwidthUsed: "0 B",
                maxBandwidth: "50 GB",
                storageUsed: "0 B",
                maxStorage: "256 MB",
                locked: false,
              });
            }
          });
        } catch (e) {
          console.error("Failed reading localStorage databases:", e);
        }
      }

      if (clustersCountBadge) {
        clustersCountBadge.innerText = activeDatabases.length;
      }

      renderOverviewGrid();
      renderFullClustersList();
      updateDiagnosticsDropdown();
    } catch (err) {
      console.error("Failed to load database list:", err);
    }
  }

  function renderOverviewGrid() {
    if (!overviewClusterGrid) return;
    overviewClusterGrid.innerHTML = '';

    activeDatabases.forEach(db => {
      let effectiveTcpUrl = db.redisUrl || '';
      if ((!effectiveTcpUrl || effectiveTcpUrl.includes('default:@')) && db.restToken && db.endpoint) {
        effectiveTcpUrl = `rediss://default:${db.restToken}@${db.endpoint}:6379`;
      }

      const card = document.createElement('div');
      card.className = 'cluster-card';
      card.innerHTML = `
        <div class="cluster-header">
          <div class="cluster-name-block">
            <h3>${db.name}</h3>
            <span class="region-tag">${db.region}</span>
          </div>
          <span class="cluster-badge-online">
            <span class="status-dot"></span> ONLINE
          </span>
        </div>

        <div class="cluster-details-list">
          <div class="detail-row">
            <span class="detail-label">Endpoint:</span>
            <span class="detail-val">${db.endpoint}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Port:</span>
            <span class="detail-val">${db.port || 6379} (TLS)</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Monthly Usage:</span>
            <span class="detail-val">${db.commandsUsed || 1} / 500k</span>
          </div>
        </div>

        <div class="cluster-actions-row">
          <button type="button" class="btn-secondary btn-copy copy-tcp-btn" data-url="${effectiveTcpUrl}">
            Copy TCP Link
          </button>
          <button type="button" class="btn-secondary btn-copy copy-rest-btn" data-url="${db.restUrl}">
            Copy REST URL
          </button>
          <button type="button" class="btn-secondary btn-copy copy-token-btn" data-token="${db.restToken || ''}">
            Copy Token
          </button>
          <button type="button" class="btn-secondary save-env-btn" data-name="${db.name}">
            Save to apis.env
          </button>
          <button type="button" class="btn-secondary lock-btn ${db.locked ? 'btn-locked' : ''}" data-name="${db.name}">
            ${db.locked ? 'Locked' : 'Unlock'}
          </button>
          <button type="button" class="btn-danger delete-btn ${db.locked ? 'btn-disabled' : ''}" data-name="${db.name}" ${db.locked ? 'disabled' : ''}>
            Delete
          </button>
          <button type="button" class="btn-secondary test-cluster-btn" data-url="${effectiveTcpUrl}">
            Ping Test
          </button>
        </div>
      `;
      overviewClusterGrid.appendChild(card);
    });

    // Attach copy, save, lock, delete & test listeners
    overviewClusterGrid.querySelectorAll('.copy-tcp-btn').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.getAttribute('data-url'), 'TCP Connection String'));
    });
    overviewClusterGrid.querySelectorAll('.copy-rest-btn').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.getAttribute('data-url'), 'REST Endpoint URL'));
    });
    overviewClusterGrid.querySelectorAll('.copy-token-btn').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.getAttribute('data-token'), 'REST Authorization Token'));
    });
    overviewClusterGrid.querySelectorAll('.save-env-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-name');
        const db = activeDatabases.find(d => d.name === name);
        if (db) await saveToApisEnv(db);
      });
    });
    overviewClusterGrid.querySelectorAll('.lock-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        toggleLockDatabase(name);
      });
    });
    overviewClusterGrid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        const db = activeDatabases.find(d => d.name === name);
        if (db) deleteDatabaseLink(db.name, db.locked);
      });
    });
    overviewClusterGrid.querySelectorAll('.test-cluster-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab('diagnostics');
        if (customUrlInput) customUrlInput.value = btn.getAttribute('data-url');
        runHealthDiagnostics(btn.getAttribute('data-url'));
      });
    });
  }

  async function toggleLockDatabase(dbName) {
    try {
      const res = await fetch('/api/databases/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dbName })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        loadDatabases();
      } else {
        showToast(data.error || 'Failed to toggle lock.', 'error');
      }
    } catch (err) {
      showToast('Network error toggling lock.', 'error');
    }
  }

  async function deleteDatabaseLink(dbName, isLocked) {
    if (isLocked) {
      showToast(`"${dbName}" is LOCKED! Unlock it first to delete.`, 'warn');
      return;
    }
    openDeleteConfirmModal(dbName);
  }

  async function executeDeleteDatabaseLink(dbName) {
    if (isProdMode) {
      try {
        const list = JSON.parse(localStorage.getItem('upstash_prod_databases') || '[]');
        const updated = list.filter(item => item.name !== dbName && item.endpoint !== dbName);
        localStorage.setItem('upstash_prod_databases', JSON.stringify(updated));
        showToast(`Successfully deleted database link for "${dbName}" from local storage!`, 'success');
        loadDatabases();
        return;
      } catch (e) {}
    }
    try {
      const res = await fetch('/api/databases/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dbName, confirmed: true })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        loadDatabases();
      } else {
        showToast(data.error || 'Failed to delete database link.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting database link.', 'error');
    }
  }

  function saveToLocalStorage(db) {
    try {
      const list = JSON.parse(localStorage.getItem('upstash_prod_databases') || '[]');
      const idx = list.findIndex(item => item.name === db.name || item.redisUrl === db.redisUrl);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...db };
      } else {
        list.push(db);
      }
      localStorage.setItem('upstash_prod_databases', JSON.stringify(list));
      showToast(`Saved ${db.name} credentials to browser local storage!`, 'success');
      loadDatabases();
    } catch (e) {
      showToast('Failed to save credentials to local storage.', 'error');
    }
  }

  async function saveToApisEnv(db) {
    if (!db || !db.redisUrl) return;
    if (db.redisUrl.includes("default:@") || db.redisUrl.includes("****") || !db.redisUrl.includes("rediss://")) {
      console.warn("Invalid or masked TCP connection string. Skipping save to apis.env.");
      return;
    }
    if (isProdMode) {
      saveToLocalStorage(db);
      return;
    }
    try {
      const res = await fetch('/api/save-to-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: db.name,
          redisUrl: db.redisUrl,
          restUrl: db.restUrl,
          restToken: db.restToken || db.password || ''
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Saved ${db.name} credentials to apis.env!`, 'success');
        loadDatabases();
      } else {
        showToast(data.error || 'Failed to save to apis.env', 'error');
      }
    } catch (err) {
      showToast('Network error saving to apis.env', 'error');
    }
  }

  function renderFullClustersList() {
    if (!fullClustersList) return;
    const filterText = (clusterSearchInput?.value || '').toLowerCase().trim();
    fullClustersList.innerHTML = '';

    const filtered = activeDatabases.filter(db =>
      db.name.toLowerCase().includes(filterText) ||
      db.endpoint.toLowerCase().includes(filterText)
    );

    if (filtered.length === 0) {
      fullClustersList.innerHTML = `
        <div style="text-align:center; padding: 3rem; color: var(--text-dim);">
          No matching database clusters found.
        </div>
      `;
      return;
    }

    filtered.forEach(db => {
      let effectiveTcpUrl = db.redisUrl || '';
      if ((!effectiveTcpUrl || effectiveTcpUrl.includes('default:@')) && db.restToken && db.endpoint) {
        effectiveTcpUrl = `rediss://default:${db.restToken}@${db.endpoint}:6379`;
      }

      const hasValidToken = db.restToken && db.restToken.length > 5 && !db.restToken.includes('required');
      const tokenDisplayHtml = hasValidToken
        ? `<div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="font-mono" style="color:var(--primary); font-weight:600;">${db.restToken}</span>
            <button type="button" class="btn-secondary btn-copy copy-token-inline-btn" data-token="${db.restToken}" style="padding:0.2rem 0.5rem; font-size:0.75rem;">
              Copy Token
            </button>
          </div>`
        : `<span style="color:var(--warning); font-size:0.85rem;">Token Required / Pending Scraping</span>`;

      const card = document.createElement('div');
      card.className = 'cluster-full-card';
      card.innerHTML = `
        <div class="cluster-header">
          <div>
            <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:0.6rem;">
              <span>${db.name}</span>
              <span class="region-tag">${db.region}</span>
            </h3>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
              Upstash Serverless Redis Cluster & Direct REST API
            </p>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn-secondary save-env-full-btn" data-name="${db.name}">
              Save to apis.env
            </button>
            <button type="button" class="btn-secondary lock-full-btn ${db.locked ? 'btn-locked' : ''}" data-name="${db.name}">
              ${db.locked ? 'Locked' : 'Unlock'}
            </button>
            <button type="button" class="btn-danger delete-full-btn ${db.locked ? 'btn-disabled' : ''}" data-name="${db.name}" ${db.locked ? 'disabled' : ''}>
              Delete
            </button>
            <span class="cluster-badge-online">
              <span class="status-dot"></span> ACTIVE & ONLINE
            </span>
          </div>
        </div>

        <div class="cluster-details-list" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1rem; margin-bottom:1.25rem;">
          <div>
            <span class="detail-label">Endpoint Hostname:</span>
            <div class="detail-val font-mono">${db.endpoint}</div>
          </div>
          <div>
            <span class="detail-label">TCP Port:</span>
            <div class="detail-val">6379 (SSL Enabled)</div>
          </div>
          <div>
            <span class="detail-label">REST Endpoint URL:</span>
            <div class="detail-val font-mono">${db.restUrl}</div>
          </div>
          <div>
            <span class="detail-label">REST Authorization Token:</span>
            <div class="detail-val">${tokenDisplayHtml}</div>
          </div>
        </div>

        <div>
          <span class="form-label">Client Code Snippets & Credentials:</span>
          <div class="snippet-tabs">
            <button type="button" class="snippet-tab-btn active" data-type="cli">redis-cli</button>
            <button type="button" class="snippet-tab-btn" data-type="node">Node.js (@upstash/redis)</button>
            <button type="button" class="snippet-tab-btn" data-type="ioredis">ioredis</button>
            <button type="button" class="snippet-tab-btn" data-type="python">Python</button>
            <button type="button" class="snippet-tab-btn" data-type="curl">cURL REST</button>
            <button type="button" class="snippet-tab-btn" data-type="env">.env Format</button>
          </div>
          <div class="code-box">
            <button type="button" class="copy-icon-btn copy-snippet-btn">Copy Code</button>
            <pre class="snippet-code-text">redis-cli --tls -u ${effectiveTcpUrl}</pre>
          </div>
        </div>
      `;

      const snippetText = card.querySelector('.snippet-code-text');
      const snippetCopyBtn = card.querySelector('.copy-snippet-btn');
      const tabs = card.querySelectorAll('.snippet-tab-btn');

      const tokenVal = db.restToken || 'YOUR_REST_TOKEN';
      const codeSnippets = {
        cli: `redis-cli --tls -u ${effectiveTcpUrl}`,
        node: `import { Redis } from '@upstash/redis'\n\nconst redis = new Redis({\n  url: '${db.restUrl}',\n  token: '${tokenVal}',\n})\n\nawait redis.set('foo', 'bar');\nconst data = await redis.get('foo');`,
        ioredis: `import Redis from 'ioredis';\n\nconst redis = new Redis('${effectiveTcpUrl}');\nawait redis.set('key', 'value');\nconsole.log(await redis.get('key'));`,
        python: `import redis\n\nr = redis.from_url('${effectiveTcpUrl}')\nr.set('foo', 'bar')\nprint(r.get('foo'))`,
        curl: `curl -H "Authorization: Bearer ${tokenVal}" ${db.restUrl}/set/foo/bar`,
        env: `UPSTASH_REDIS_REST_URL="${db.restUrl}"\nUPSTASH_REDIS_REST_TOKEN="${tokenVal}"\nREDIS_URL="${effectiveTcpUrl}"`
      };

      tabs.forEach(t => {
        t.addEventListener('click', () => {
          tabs.forEach(x => x.classList.remove('active'));
          t.classList.add('active');
          const type = t.getAttribute('data-type');
          if (snippetText && codeSnippets[type]) {
            snippetText.innerText = codeSnippets[type];
          }
        });
      });

      const copyTokenInlineBtn = card.querySelector('.copy-token-inline-btn');
      if (copyTokenInlineBtn) {
        copyTokenInlineBtn.addEventListener('click', () => {
          copyToClipboard(copyTokenInlineBtn.getAttribute('data-token'), 'REST Authorization Token');
        });
      }

      const saveFullBtn = card.querySelector('.save-env-full-btn');
      if (saveFullBtn) {
        saveFullBtn.addEventListener('click', () => saveToApisEnv(db));
      }

      const lockFullBtn = card.querySelector('.lock-full-btn');
      if (lockFullBtn) {
        lockFullBtn.addEventListener('click', () => toggleLockDatabase(db.name));
      }

      const deleteFullBtn = card.querySelector('.delete-full-btn');
      if (deleteFullBtn) {
        deleteFullBtn.addEventListener('click', () => deleteDatabaseLink(db.name, db.locked));
      }

      if (snippetCopyBtn) {
        snippetCopyBtn.addEventListener('click', () => copyToClipboard(snippetText.innerText, 'Code Snippet'));
      }

      fullClustersList.appendChild(card);
    });
  }

  if (refreshClusterStatsBtn) {
    refreshClusterStatsBtn.addEventListener('click', () => {
      loadDatabases();
      showToast('Refreshed database status!');
    });
  }

  if (clusterSearchInput) {
    clusterSearchInput.addEventListener('input', renderFullClustersList);
  }

  function updateDiagnosticsDropdown() {
    if (!diagTargetSelect) return;
    diagTargetSelect.innerHTML = '';
    activeDatabases.forEach(db => {
      const opt = document.createElement('option');
      opt.value = db.redisUrl;
      opt.innerText = `${db.name} (${db.endpoint})`;
      diagTargetSelect.appendChild(opt);
    });
  }

  // ------------------------------------------------------------------
  // 5. PROVISIONER AUTOMATION ENGINE & OTP
  // ------------------------------------------------------------------

  if (clearTerminalBtn) {
    clearTerminalBtn.addEventListener('click', () => {
      terminalBody.innerHTML = '<div class="log-line log-info">[Terminal Cleared] Ready...</div>';
      lastLogLength = 0;
    });
  }

  function appendLogLines(logs) {
    if (!logs || logs.length === 0) return;
    if (logs.length < lastLogLength) lastLogLength = 0;

    const newLogs = logs.slice(lastLogLength);
    if (newLogs.length > 0 && lastLogLength === 0) {
      if (terminalBody) terminalBody.innerHTML = '';
    }

    newLogs.forEach(line => {
      const div = document.createElement('div');
      div.className = 'log-line';
      if (line.includes('✓') || line.includes('SUCCESS') || line.includes('COMPLETE')) {
        div.classList.add('log-success');
      } else if (line.includes('❌') || line.includes('Error') || line.includes('FAILED')) {
        div.classList.add('log-error');
      } else if (line.includes('⚠️') || line.includes('WARNING') || line.includes('ACTION NEEDED')) {
        div.classList.add('log-warn');
      } else {
        div.classList.add('log-info');
      }
      div.innerText = line;
      if (terminalBody) terminalBody.appendChild(div);
    });

    lastLogLength = logs.length;
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  async function pollStatus() {
    try {
      const res = await fetch('/api/automate/status');
      if (!res.ok) return;
      const data = await res.json();

      appendLogLines(data.logs);

      // Handle OTP Banner & Interactivity
      if (data.status === 'WAITING_FOR_OTP') {
        otpBanner.classList.remove('hidden');
        if (otpBadge) otpBadge.innerText = `Attempt ${data.otpAttempt || 1} of ${data.maxOtpAttempts || 3}`;
        if (data.otpError) {
          otpErrorAlert.classList.remove('hidden');
          otpErrorMsg.innerText = data.otpError;
        } else {
          otpErrorAlert.classList.add('hidden');
        }
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.innerHTML = '<span>Action Required: Enter 6-Digit OTP Code Above</span>';
        }
        if (otpInput && document.activeElement !== otpInput) {
          otpInput.focus();
        }
      } else {
        otpBanner.classList.add('hidden');
      }

      // Handle Active vs Completion Statuses
      if (data.status === 'RUNNING' || data.status === 'WAITING_FOR_OTP') {
        if (stopBtn) stopBtn.classList.remove('hidden');
        if (data.status === 'RUNNING' && startBtn) {
          startBtn.disabled = true;
          startBtn.innerHTML = '<span>Provisioning Engine Running...</span>';
        }
      }

      if (data.status === 'SUCCESS') {
        clearInterval(pollInterval);
        startBtn.disabled = false;
        startBtn.innerHTML = '<span>Provisioning Completed Successfully!</span>';
        if (stopBtn) stopBtn.classList.add('hidden');
        showToast('Database provisioned successfully!');

        if (data.credentials && data.credentials.redisUrl) {
          const c = data.credentials;
          const endpointMatch = c.redisUrl.match(/@([^:\/]+)/);
          const ep = endpointMatch ? endpointMatch[1] : "new-upstash-db.upstash.io";
          const dbItem = {
            name: ep.replace(".upstash.io", ""),
            redisUrl: c.redisUrl,
            restUrl: c.restUrl || `https://${ep}`,
            restToken: c.restToken || c.password || ''
          };
          if (isProdMode) {
            saveToLocalStorage(dbItem);
          } else {
            saveToApisEnv(dbItem);
          }
        }

        loadDatabases();
      } else if (data.status === 'FAILED') {
        clearInterval(pollInterval);
        startBtn.disabled = false;
        startBtn.innerHTML = '<span>Execute Provisioning Process</span>';
        if (stopBtn) stopBtn.classList.add('hidden');
        showToast('Provisioning engine encountered an error.');
      } else if (data.status === 'STOPPED') {
        clearInterval(pollInterval);
        startBtn.disabled = false;
        startBtn.innerHTML = '<span>Execute Provisioning Process</span>';
        if (stopBtn) stopBtn.classList.add('hidden');
        showToast('Provisioning execution stopped by user.');
      }
    } catch (err) {
      console.error("Status poll error:", err);
    }
  }

  if (provisionForm) {
    provisionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const dbName = dbNameInput.value.trim();

      if (!email || !password || !dbName) return;

      startBtn.disabled = true;
      startBtn.innerHTML = '<span>Provisioning Engine Running...</span>';
      if (stopBtn) stopBtn.classList.remove('hidden');

      try {
        const res = await fetch('/api/automate/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, dbName })
        });
        const data = await res.json();

        if (res.ok) {
          showToast('Automation engine initialized!');
          lastLogLength = 0;
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = setInterval(pollStatus, 1500);
        } else {
          showToast(data.error || 'Failed to start automation.');
          startBtn.disabled = false;
          startBtn.innerHTML = '<span>Execute Provisioning Process</span>';
          if (stopBtn) stopBtn.classList.add('hidden');
        }
      } catch (err) {
        showToast('Network error starting automation.');
        startBtn.disabled = false;
        startBtn.innerHTML = '<span>Execute Provisioning Process</span>';
        if (stopBtn) stopBtn.classList.add('hidden');
      }
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<span>Stopping...</span>';
        const res = await fetch('/api/automate/stop', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          showToast('Execution stopped.');
          clearInterval(pollInterval);
          startBtn.disabled = false;
          startBtn.innerHTML = '<span>Execute Provisioning Process</span>';
          stopBtn.classList.add('hidden');
        } else {
          showToast(data.error || 'Failed to stop execution.');
        }
      } catch (err) {
        showToast('Network error stopping execution.');
      } finally {
        stopBtn.disabled = false;
        stopBtn.innerHTML = '<span>Stop Execution</span>';
      }
    });
  }

  if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otp = otpInput.value.trim();
      if (!otp || otp.length < 6) {
        showToast('Please enter a valid 6-digit OTP code.');
        return;
      }

      try {
        const res = await fetch('/api/automate/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp })
        });
        if (res.ok) {
          showToast('OTP submitted to headless engine!');
          otpInput.value = '';
          otpBanner.classList.add('hidden');
        } else {
          const data = await res.json();
          showToast(data.error || 'OTP submission failed.');
        }
      } catch (err) {
        showToast('Error submitting OTP.');
      }
    });
  }

  // ------------------------------------------------------------------
  // 6. DIAGNOSTICS & LIVE PLAYGROUND
  // ------------------------------------------------------------------

  async function runHealthDiagnostics(targetUrl) {
    const url = targetUrl || customUrlInput?.value.trim() || diagTargetSelect?.value;
    if (!url) {
      showToast('Please select or enter a valid Redis connection string.');
      return;
    }

    if (runDiagBtn) {
      runDiagBtn.disabled = true;
      runDiagBtn.innerText = '⏳ Testing Connection...';
    }

    diagOutputConsole.innerText = 'Connecting to Upstash Redis cluster via IORedis driver...\nRunning PING, SET, GET, and DEL tests...';

    const startTime = Date.now();
    try {
      const res = await fetch('/api/redis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const elapsed = Date.now() - startTime;

      const data = await res.json();
      if (res.ok && data.success) {
        if (diagLatencyBadge) {
          diagLatencyBadge.classList.remove('hidden');
          diagLatencyBadge.innerText = `${data.result.latencyMs || elapsed} ms latency`;
        }

        diagOutputConsole.innerText = `CLUSTER DIAGNOSTIC SUCCESSFUL!\n\n` +
          `Status:       ONLINE\n` +
          `Ping Response: ${data.result.ping}\n` +
          `Round-Trip:   ${data.result.latencyMs} ms\n` +
          `Test Payload:  "${data.result.val}"\n\n` +
          `Full Response Object:\n` +
          JSON.stringify(data.result, null, 2);
        showToast('Redis diagnostic test passed!');
      } else {
        if (diagLatencyBadge) diagLatencyBadge.classList.add('hidden');
        diagOutputConsole.innerText = `[FAILED] DIAGNOSTIC TEST FAILED\n\nError: ${data.error || 'Unknown error'}`;
        showToast('Diagnostic test failed.');
      }
    } catch (err) {
      if (diagLatencyBadge) diagLatencyBadge.classList.add('hidden');
      diagOutputConsole.innerText = `[ERROR] NETWORK ERROR\n\n${err.message}`;
      showToast('Network error during test.');
    } finally {
      if (runDiagBtn) {
        runDiagBtn.disabled = false;
        runDiagBtn.innerText = 'Run Health Check (PING / SET / GET)';
      }
    }
  }

  if (runDiagBtn) {
    runDiagBtn.addEventListener('click', () => runHealthDiagnostics());
  }

  // Initial Session Check & Data Load
  checkInitialSession();
});
