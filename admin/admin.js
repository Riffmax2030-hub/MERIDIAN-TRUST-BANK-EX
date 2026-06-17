/* ── Meridian Trust Bank — Administration Script ───────────────────────────── */
'use strict';

const API = window.location.origin;

let dataState = {
  applications: [],
  users: []
};

// Start
window.addEventListener('DOMContentLoaded', () => {
  loadAllData();
});

// Toast Notifications
function toast(title, msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-title">${title}</div><div class="toast-msg">${msg}</div>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastIn 0.25s reverse forwards';
    setTimeout(() => t.remove(), 280);
  }, 4500);
}

// Formatters
const sym = c => ({ USD: '$', EUR: '€', GBP: '£' }[c] ?? c);
function fmtMoney(amount, currency) {
  return `${sym(currency)}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Refresh Data
async function loadAllData() {
  try {
    const [apps, users] = await Promise.all([
      api('/api/admin/applications'),
      api('/api/admin/users')
    ]);
    dataState.applications = apps;
    dataState.users = users;
    
    renderDashboard();
  } catch (err) {
    toast('Data Load Error', err.message, 'error');
  }
}

function renderDashboard() {
  // Update Counts
  document.getElementById('m-apps').textContent = dataState.applications.length;
  document.getElementById('badge-apps-count').textContent = `${dataState.applications.length} Awaiting Review`;
  document.getElementById('m-users').textContent = dataState.users.length;
  document.getElementById('badge-users-count').textContent = `${dataState.users.length} Enrolled`;

  // Calculate total vault balance (converted to USD equivalencies)
  let totalUSD = 500000000.00; // Baseline institutional vault reserves
  dataState.users.forEach(u => {
    if (u.accounts) {
      u.accounts.forEach(a => {
        let val = parseFloat(a.balance);
        if (a.currency === 'EUR') val = val * 1.1; // estimate exchange rate
        if (a.currency === 'GBP') val = val * 1.3;
        totalUSD += val;
      });
    }
  });
  document.getElementById('m-vault').textContent = fmtMoney(totalUSD, 'USD');

  // Render Applications
  const appsBody = document.getElementById('applications-table-body');
  if (dataState.applications.length === 0) {
    appsBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#777;font-size:13px;">No applications awaiting review.</td></tr>`;
  } else {
    appsBody.innerHTML = dataState.applications.map(a => `
      <tr>
        <td><strong>${a.name}</strong><br><span style="font-size:11px;color:#777;">Type: ${a.accountType.toUpperCase()}</span></td>
        <td><a href="mailto:${a.email}" style="color:var(--citi-light-blue);text-decoration:none;">${a.email}</a></td>
        <td>${a.phone}</td>
        <td>${a.address}, ${a.state} ${a.zip}</td>
        <td><code style="font-family:monospace;font-weight:600;background:#f1f5f9;padding:2px 4px;border-radius:3px;">${a.ssn}</code></td>
        <td>${new Date(a.createdAt).toLocaleDateString()}</td>
        <td style="text-align:right;">
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn btn-success btn-sm" onclick="approveApplication('${a.id}')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="rejectApplication('${a.id}')">Decline</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Render Active Users
  const usersBody = document.getElementById('users-table-body');
  if (dataState.users.length === 0) {
    usersBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#777;font-size:13px;">No active client profiles enrolled in the system database.</td></tr>`;
  } else {
    usersBody.innerHTML = dataState.users.map(u => {
      // Accounts list html
      const accsHtml = (u.accounts || []).map(a => `
        <div class="acc-balance-pill">
          <span>${a.type.toUpperCase()} (${a.currency})<br><span style="font-size:10px;color:#777;">No: ${a.accountNumber}</span></span>
          <span style="font-weight:700;color:var(--citi-blue);">${fmtMoney(a.balance, a.currency)}</span>
        </div>
      `).join('');

      // Cards list html
      const cardsHtml = (u.cards || []).map(c => `
        <span class="card-pill" title="CVV: ${c.cvv} Exp: ${c.expiry}">
          ${c.type}: •••• ${c.cardNumber.slice(-4)} (${c.status})
        </span>
      `).join('') || '<span style="font-size:11px;color:#aaa;">No active programs</span>';

      const wireStatusText = u.wireStatus === 'ENABLED' ? 'Wires: Enabled' : 'Wires: Restricted';
      const wireStatusClass = u.wireStatus === 'ENABLED' ? 'approved' : 'declined';

      return `
        <tr>
          <td>
            <strong style="color:var(--citi-blue);font-family:monospace;font-size:14px;">${u.id}</strong>
            <br>
            <span class="status-pill approved" style="font-size:9px;padding:1px 4px;margin-top:4px;">${u.kycStatus}</span>
            <br>
            <span class="status-pill ${wireStatusClass}" style="font-size:9px;padding:1px 4px;margin-top:4px;display:inline-block;">${wireStatusText}</span>
          </td>
          <td>
            <div class="client-info-block"><strong>${u.name}</strong></div>
            <div class="client-meta">${u.email}</div>
            <div class="client-meta">Passcode: <code style="font-family:monospace;font-weight:600;background:#fee2e2;color:#991b1b;padding:2px 4px;border-radius:3px;">${u.password}</code></div>
            <div class="client-meta">${u.phone}</div>
            <div class="client-meta">${u.address}, ${u.state} ${u.zip}</div>
          </td>
          <td style="min-width:260px;">${accsHtml}</td>
          <td>${cardsHtml}</td>
          <td>${new Date(u.createdAt).toLocaleDateString()}</td>
          <td style="text-align:right;">
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
              <button class="btn btn-primary btn-sm btn-full" onclick="openBalanceModal('${u.id}')">Adjust Balance</button>
              <button class="btn btn-secondary btn-sm btn-full" onclick="openInboundModal('${u.id}')">Credit Deposit</button>
              <button class="btn btn-sm btn-full" style="background:#475569;color:#fff;border-color:#334155;" onclick="openWireModal('${u.id}')">Configure Wires</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// Actions
async function approveApplication(appId) {
  if (!confirm('Are you sure you want to approve this application? Credentials and seeded balances will be created, and a welcome HTML email will be dispatched to the applicant.')) return;
  try {
    const res = await api('/api/admin/approve', { applicationId: appId });
    toast('Application Approved', `Client profile created: ${res.userId}. Credentials generated.`, 'success');
    loadAllData();
  } catch (err) {
    toast('Approval Failed', err.message, 'error');
  }
}

async function rejectApplication(appId) {
  if (!confirm('Are you sure you want to decline this application? This profile will be deleted.')) return;
  try {
    await api('/api/admin/reject', { applicationId: appId });
    toast('Application Declined', 'Application records deleted from the queue.', 'info');
    loadAllData();
  } catch (err) {
    toast('Rejection Failed', err.message, 'error');
  }
}

// Modals
async function openBalanceModal(userId) {
  const user = dataState.users.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('adj-uid').value = userId;
  const select = document.getElementById('adj-accid');
  select.innerHTML = (user.accounts || []).map(a => `
    <option value="${a.id}">${a.type.toUpperCase()} (${a.currency}) — Balance: ${fmtMoney(a.balance, a.currency)}</option>
  `).join('');
  document.getElementById('adj-balance').value = '';

  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('balance-modal').classList.add('show');
}

function closeBalanceModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('balance-modal').classList.remove('show');
}

async function submitBalanceAdj() {
  const accountId = document.getElementById('adj-accid').value;
  const amount = parseFloat(document.getElementById('adj-balance').value);
  if (isNaN(amount)) {
    alert('Please enter a valid amount.');
    return;
  }
  try {
    await api('/api/admin/user/adjust-balance', { accountId, amount });
    toast('Balance Adjusted', 'Core ledger updated successfully.', 'success');
    closeBalanceModal();
    loadAllData();
  } catch (err) {
    toast('Adjustment Failed', err.message, 'error');
  }
}

// Inbound Deposit Modals
async function openInboundModal(userId) {
  const user = dataState.users.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('inbound-uid').value = userId;
  const select = document.getElementById('inbound-accid');
  select.innerHTML = (user.accounts || []).map(a => `
    <option value="${a.id}">${a.type.toUpperCase()} (${a.currency}) — Balance: ${fmtMoney(a.balance, a.currency)}</option>
  `).join('');
  document.getElementById('inbound-amount').value = '';
  document.getElementById('inbound-sender').value = '';
  document.getElementById('inbound-desc').value = '';

  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('inbound-modal').classList.add('show');
}

function closeInboundModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('inbound-modal').classList.remove('show');
}

async function submitInboundWire() {
  const accountId = document.getElementById('inbound-accid').value;
  const amount = parseFloat(document.getElementById('inbound-amount').value);
  const senderName = document.getElementById('inbound-sender').value;
  const description = document.getElementById('inbound-desc').value;

  if (isNaN(amount) || amount <= 0 || !senderName) {
    alert('Please fill out all fields correctly.');
    return;
  }

  try {
    await api('/api/admin/inbound-wire', { accountId, amount, senderName, description });
    toast('Deposit Credited', `Manual inbound wire of ${amount} credited.`, 'success');
    closeInboundModal();
    loadAllData();
  } catch (err) {
    toast('Deposit Failed', err.message, 'error');
  }
}

// Wire Configuration Modals
function toggleWirePresetSelector() {
  const status = document.getElementById('wire-status-select').value;
  const msgGroup = document.getElementById('wire-message-group');
  if (status === 'DISABLED') {
    msgGroup.style.display = 'block';
  } else {
    msgGroup.style.display = 'none';
  }
}

function applyWirePresetMessage() {
  const preset = document.getElementById('wire-preset-message').value;
  const msgInput = document.getElementById('wire-block-message');
  if (preset === 'downtime') {
    msgInput.value = 'Outbound wire transfers are temporarily unavailable due to scheduled system downtime. Please try again later.';
  } else if (preset === 'upgrade') {
    msgInput.value = 'The outbound wire transfer system is currently undergoing an upgrade. Service will resume shortly.';
  } else if (preset === 'issue') {
    msgInput.value = 'There is an issue with your account credentials. You must visit a local physical branch with two forms of valid ID to resolve this block.';
  } else if (preset === 'custom') {
    msgInput.value = '';
  }
}

function openWireModal(userId) {
  const user = dataState.users.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('wire-uid').value = userId;
  
  const statusSelect = document.getElementById('wire-status-select');
  statusSelect.value = user.wireStatus || 'ENABLED';
  
  const blockInput = document.getElementById('wire-block-message');
  blockInput.value = user.wireBlockMessage || '';
  
  // Set preset message selector to 'custom' by default if custom message, or match presets
  const presetSelect = document.getElementById('wire-preset-message');
  if (!user.wireBlockMessage) {
    presetSelect.value = 'downtime';
    applyWirePresetMessage();
  } else if (user.wireBlockMessage.includes('scheduled system downtime')) {
    presetSelect.value = 'downtime';
  } else if (user.wireBlockMessage.includes('undergoing an upgrade')) {
    presetSelect.value = 'upgrade';
  } else if (user.wireBlockMessage.includes('visit a local physical branch')) {
    presetSelect.value = 'issue';
  } else {
    presetSelect.value = 'custom';
  }

  toggleWirePresetSelector();

  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('wire-modal').classList.add('show');
}

function closeWireModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('wire-modal').classList.remove('show');
}

async function submitWireStatus() {
  const userId = document.getElementById('wire-uid').value;
  const status = document.getElementById('wire-status-select').value;
  const message = document.getElementById('wire-block-message').value;

  try {
    await api('/api/admin/user/toggle-wires', { userId, status, message });
    toast('Wire Status Saved', `Wire transfer controls updated successfully.`, 'success');
    closeWireModal();
    loadAllData();
  } catch (err) {
    toast('Configuration Failed', err.message, 'error');
  }
}


// Fetch API Wrapper
async function api(path, body) {
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' };
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
