// State
let vaultData = [];
let activeCategory = 'All';
let isVaultInitialized = false;

// Initial check on load
document.addEventListener('DOMContentLoaded', async () => {
  await checkStatus();
  setupKeyboardShortcuts();
});

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('searchInput');
      if (input) input.focus();
    }
  });
}

async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    isVaultInitialized = data.initialized;

    const overlay = document.getElementById('authOverlay');
    const appContainer = document.getElementById('appContainer');
    const authSubtitle = document.getElementById('authSubtitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const masterPasswordLabel = document.getElementById('masterPasswordLabel');
    const authHint = document.getElementById('authHint');

    if (!data.initialized) {
      overlay.classList.remove('hidden');
      appContainer.classList.add('hidden');
      authSubtitle.innerText = 'Initialize Your Vault with a Master Password';
      masterPasswordLabel.innerText = 'Create Master Password';
      authSubmitBtn.innerHTML = '<i class="fa-solid fa-plus-circle mr-2"></i> Create Vault';
      authHint.innerText = 'Ensure you remember this password. It encrypts your entire database using PBKDF2 + AES.';
    } else if (!data.unlocked) {
      overlay.classList.remove('hidden');
      appContainer.classList.add('hidden');
      authSubtitle.innerText = 'Vault is Locked';
      masterPasswordLabel.innerText = 'Enter Master Password';
      authSubmitBtn.innerHTML = '<i class="fa-solid fa-lock-open mr-2"></i> Unlock Vault';
      authHint.innerText = 'Enter your master key to decrypt your vault.';
    } else {
      overlay.classList.add('hidden');
      appContainer.classList.remove('hidden');
      await loadPasswords();
    }
  } catch (err) {
    showToast('Failed to check vault status', 'error');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const pwdInput = document.getElementById('masterPassword');
  const pwd = pwdInput.value;
  const endpoint = isVaultInitialized ? '/api/unlock' : '/api/setup';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master_password: pwd })
    });
    const data = await res.json();

    if (!res.ok) {
      showAuthError(data.error || 'Authentication failed');
      return;
    }

    pwdInput.value = '';
    showToast(isVaultInitialized ? 'Vault unlocked successfully!' : 'Vault created successfully!', 'success');
    await checkStatus();
  } catch (err) {
    showAuthError('Connection error occurred.');
  }
}

function showAuthError(msg) {
  const notice = document.getElementById('authNotice');
  notice.innerText = msg;
  notice.className = 'auth-notice error';
  notice.classList.remove('hidden');
}

async function lockVault() {
  try {
    await fetch('/api/lock', { method: 'POST' });
    showToast('Vault locked', 'info');
    await checkStatus();
  } catch (e) {
    showToast('Failed to lock vault', 'error');
  }
}

async function loadPasswords() {
  try {
    const res = await fetch('/api/passwords');
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) checkStatus();
      return;
    }

    vaultData = data.passwords || [];
    updateAuditMetrics(data.audit);
    renderCards();
  } catch (err) {
    showToast('Failed to load password entries', 'error');
  }
}

function updateAuditMetrics(audit) {
  if (!audit) return;
  document.getElementById('statTotalLogins').innerText = audit.total;
  document.getElementById('statHealthScore').innerText = `${audit.health_score}%`;
  document.getElementById('statWeakCount').innerText = audit.weak_count;
  document.getElementById('statReusedCount').innerText = audit.reused_count;
  document.getElementById('catCountAll').innerText = audit.total;
}

function selectCategory(cat, element) {
  activeCategory = cat;
  document.querySelectorAll('.category-pills .pill').forEach(p => p.classList.remove('active'));
  element.classList.add('active');
  renderCards();
}

function filterPasswords() {
  renderCards();
}

function renderCards() {
  const grid = document.getElementById('vaultGrid');
  const empty = document.getElementById('emptyState');
  const query = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  const filtered = vaultData.filter(item => {
    const matchCat = (activeCategory === 'All' || item.category === activeCategory);
    const matchQuery = !query || 
      item.site.toLowerCase().includes(query) || 
      item.username.toLowerCase().includes(query) ||
      (item.notes && item.notes.toLowerCase().includes(query));
    return matchCat && matchQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = filtered.map(item => `
    <div class="vault-card" id="card-${item.id}">
      <div class="card-top">
        <div class="card-identity">
          <div class="card-avatar">${item.site.charAt(0).toUpperCase()}</div>
          <div class="card-title-group">
            <h4>${escapeHtml(item.site)}</h4>
            <div class="card-username">${escapeHtml(item.username || 'No username')}</div>
          </div>
        </div>
        <span class="card-badge">${item.category}</span>
      </div>

      <div class="card-password-field">
        <span class="pwd-text" id="pwd-${item.id}">••••••••••••</span>
        <div class="card-actions">
          <button class="btn-icon" onclick="toggleCardPassword('${item.id}', '${escapeAttr(item.password)}')" title="Show / Hide">
            <i class="fa-regular fa-eye" id="eye-${item.id}"></i>
          </button>
          <button class="btn-icon" onclick="copyPassword('${escapeAttr(item.password)}')" title="Copy password">
            <i class="fa-regular fa-copy"></i>
          </button>
        </div>
      </div>

      <div class="card-footer">
        <div class="strength-tag" style="color: ${item.strength.color}">
          <span class="dot" style="background-color: ${item.strength.color}"></span>
          <span>${item.strength.label}</span>
        </div>
        <div class="card-actions">
          ${item.url ? `<a href="${escapeAttr(item.url)}" target="_blank" class="btn-icon" title="Visit site"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
          <button class="btn-icon" onclick="editEntry('${item.id}')" title="Edit"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="btn-icon" onclick="deleteEntry('${item.id}')" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCardPassword(id, plainText) {
  const el = document.getElementById(`pwd-${id}`);
  const eye = document.getElementById(`eye-${id}`);
  if (el.innerText === '••••••••••••') {
    el.innerText = plainText;
    eye.className = 'fa-regular fa-eye-slash';
  } else {
    el.innerText = '••••••••••••';
    eye.className = 'fa-regular fa-eye';
  }
}

function togglePasswordVisibility(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-regular fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-regular fa-eye';
  }
}

// Copy to clipboard
function copyPassword(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Password copied to clipboard! (Auto-cleared soon)', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

// Entry Modal Handling
function openEntryModal() {
  document.getElementById('entryForm').reset();
  document.getElementById('entryId').value = '';
  document.getElementById('entryModalTitle').innerHTML = '<i class="fa-solid fa-shield-halved text-cyan mr-2"></i> Add Account';
  evaluatePasswordStrength('');
  document.getElementById('entryModal').classList.remove('hidden');
}

function closeEntryModal() {
  document.getElementById('entryModal').classList.add('hidden');
}

function editEntry(id) {
  const item = vaultData.find(x => x.id === id);
  if (!item) return;
  document.getElementById('entryId').value = item.id;
  document.getElementById('entrySite').value = item.site;
  document.getElementById('entryCategory').value = item.category;
  document.getElementById('entryUsername').value = item.username;
  document.getElementById('entryPassword').value = item.password;
  document.getElementById('entryUrl').value = item.url || '';
  document.getElementById('entryNotes').value = item.notes || '';
  document.getElementById('entryModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square text-cyan mr-2"></i> Edit Account';
  evaluatePasswordStrength(item.password);
  document.getElementById('entryModal').classList.remove('hidden');
}

async function saveEntry(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('entryId').value || undefined,
    site: document.getElementById('entrySite').value,
    category: document.getElementById('entryCategory').value,
    username: document.getElementById('entryUsername').value,
    password: document.getElementById('entryPassword').value,
    url: document.getElementById('entryUrl').value,
    notes: document.getElementById('entryNotes').value
  };

  try {
    const res = await fetch('/api/passwords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to save', 'error');
      return;
    }
    closeEntryModal();
    showToast('Account saved securely in encrypted vault!', 'success');
    await loadPasswords();
  } catch (err) {
    showToast('Error saving entry', 'error');
  }
}

async function deleteEntry(id) {
  if (!confirm('Are you sure you want to permanently delete this credential?')) return;
  try {
    const res = await fetch(`/api/passwords/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Credential removed', 'info');
      await loadPasswords();
    }
  } catch (e) {
    showToast('Failed to delete', 'error');
  }
}

// Password Generator
function openGeneratorModal() {
  document.getElementById('genModal').classList.remove('hidden');
  generateNewPassword();
}

function closeGeneratorModal() {
  document.getElementById('genModal').classList.add('hidden');
}

function updateSliderVal(val) {
  document.getElementById('sliderVal').innerText = val;
  generateNewPassword();
}

async function generateNewPassword() {
  const length = document.getElementById('genLength').value;
  const uppercase = document.getElementById('genUpper').checked;
  const lowercase = document.getElementById('genLower').checked;
  const digits = document.getElementById('genDigits').checked;
  const symbols = document.getElementById('genSymbols').checked;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ length, uppercase, lowercase, digits, symbols })
    });
    const data = await res.json();
    document.getElementById('genResult').innerText = data.password;
  } catch (err) {
    console.error(err);
  }
}

function copyGeneratedPassword() {
  const pwd = document.getElementById('genResult').innerText;
  copyPassword(pwd);
}

function copyAndCloseGenerator() {
  copyGeneratedPassword();
  closeGeneratorModal();
}

async function fillWithGenerated() {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ length: 18, uppercase: true, lowercase: true, digits: true, symbols: true })
  });
  const data = await res.json();
  const input = document.getElementById('entryPassword');
  input.value = data.password;
  evaluatePasswordStrength(data.password);
  showToast('Strong password generated!', 'info');
}

function evaluatePasswordStrength(pwd) {
  const bar = document.getElementById('strengthProgress');
  const txt = document.getElementById('strengthText');
  if (!pwd) {
    bar.style.width = '0%';
    bar.style.backgroundColor = 'transparent';
    txt.innerText = 'Strength: None';
    txt.style.color = '#64748b';
    return;
  }

  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 14) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  let label = 'Weak';
  let color = '#ef4444';
  let pct = '25%';

  if (score >= 5) {
    label = 'Very Strong';
    color = '#06b6d4';
    pct = '100%';
  } else if (score >= 4) {
    label = 'Strong';
    color = '#10b981';
    pct = '75%';
  } else if (score >= 3) {
    label = 'Medium';
    color = '#f59e0b';
    pct = '50%';
  }

  bar.style.width = pct;
  bar.style.backgroundColor = color;
  txt.innerText = `Strength: ${label}`;
  txt.style.color = color;
}

// Toast helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check text-cyan';
  else if (type === 'error') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
