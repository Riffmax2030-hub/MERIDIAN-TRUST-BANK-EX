/* ── Meridian Trust Bank — Client SPA ───────────────────────────────────────── */
'use strict';

const API = window.location.origin;

// ── Application State ─────────────────────────────────────────────────────────
let state = {
  user:         null,
  accounts:     [],
  transactions: [],
  cards:        [],
  adminUsers:   [],
  regData:      {}      // temporary container for multi-step US signup
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function init() {
  const saved = localStorage.getItem('mtb_session');
  if (saved) {
    try { state.user = JSON.parse(saved); } catch { /* ignore */ }
  }
  window.addEventListener('hashchange', route);
  route();
}

// ── Router ────────────────────────────────────────────────────────────────────
const routeLoaderMessages = {
  '#':                       ['Initializing Secure Portal', 'Establishing encrypted connection to Meridian Trust systems…'],
  '#/':                      ['Initializing Secure Portal', 'Establishing encrypted connection to Meridian Trust systems…'],
  '#/portal/client-auth/login':     ['Loading Authentication Module', 'Preparing secure credential verification interface…'],
  '#/portal/client-onboarding/apply':  ['Loading Application Portal', 'Initializing US account onboarding compliance module…'],
  '#/portal/digital-banking/dashboard': ['Retrieving Account Data', 'Connecting to offshore ledger and loading client portfolio…'],
  '#/portal/digital-banking/wire-transfer':      ['Loading Wire Transfer Module', 'Preparing SWIFT outbound routing and compliance checks…'],
  '#/portal/digital-banking/transaction-history': ['Loading Transactions', 'Retrieving your transaction history and analytics…'],
  '#/portal/digital-banking/intrabank-transfer': ['Connecting Ledger', 'Authorizing account balance cross-transfer module…'],
};

let _routeTimer = null;

function route() {
  renderNav();
  const h = window.location.hash || '#';

  const publicRoutes  = ['#', '#/', '#/portal/client-auth/login', '#/portal/client-onboarding/apply'];
  const privateRoutes = [
    '#/portal/digital-banking/dashboard', 
    '#/portal/digital-banking/wire-transfer', 
    '#/portal/digital-banking/transaction-history',
    '#/portal/digital-banking/intrabank-transfer'
  ];

  if (privateRoutes.includes(h) && !state.user) { nav('#/portal/client-auth/login'); return; }
  if ((h === '#/portal/client-auth/login' || h === '#/portal/client-onboarding/apply') && state.user) { nav('#/portal/digital-banking/dashboard'); return; }

  // Redirect old page routes to landing (content is now inline)
  if (['#/products','#/services','#/legal','#/about','#/login','#/register','#/dashboard','#/send','#/history'].includes(h)) {
    if (h === '#/login') { nav('#/portal/client-auth/login'); return; }
    if (h === '#/register') { nav('#/portal/client-onboarding/apply'); return; }
    if (h === '#/dashboard') { nav('#/portal/digital-banking/dashboard'); return; }
    if (h === '#/send') { nav('#/portal/digital-banking/wire-transfer'); return; }
    if (h === '#/history') { nav('#/portal/digital-banking/transaction-history'); return; }
    nav('#');
    return;
  }

  // Clear any pending route timer
  if (_routeTimer) { clearTimeout(_routeTimer); _routeTimer = null; }

  // Determine loader text
  const msgs = routeLoaderMessages[h] || ['Loading', 'Please wait…'];
  showLoader(msgs[0], msgs[1]);

  _routeTimer = setTimeout(() => {
    hideLoader();
    _routeTimer = null;

    switch (h) {
      case '#':
      case '#/': renderLanding(); break;
      case '#/portal/client-auth/login':    renderLogin(); break;
      case '#/portal/client-onboarding/apply': renderRegister(); break;
      case '#/portal/digital-banking/dashboard': loadDashboard(); break;
      case '#/portal/digital-banking/wire-transfer':      loadSend(); break;
      case '#/portal/digital-banking/transaction-history': loadTransactionHistory(); break;
      case '#/portal/digital-banking/intrabank-transfer': loadIntrabankTransfer(); break;
      default: renderLanding();
    }
  }, 3000);
}

function nav(hash) { window.location.hash = hash; }

function toggleMobileMenu() {
  document.getElementById('nav-links')?.classList.toggle('open');
}

// ── Nav Rendering ─────────────────────────────────────────────────────────────
function renderNav() {
  const el = document.getElementById('nav-links');
  if (!el) return;
  const h = window.location.hash;

  // Toggle logged-in class on body
  document.body.classList.toggle('logged-in', !!state.user);

  // Render bottom nav if element exists
  const mNav = document.getElementById('mobile-bottom-nav');
  if (mNav) {
    if (state.user) {
      mNav.innerHTML = `
        <button class="mobile-nav-item ${h==='#/portal/digital-banking/dashboard'?'active':''}" onclick="nav('#/portal/digital-banking/dashboard')">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Home</span>
        </button>
        <button class="mobile-nav-item ${h==='#/portal/digital-banking/wire-transfer' || h==='#/portal/digital-banking/intrabank-transfer' ?'active':''}" onclick="nav('#/portal/digital-banking/wire-transfer')">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span>Transfer</span>
        </button>
        <button class="mobile-nav-item ${h==='#/portal/digital-banking/transaction-history'?'active':''}" onclick="nav('#/portal/digital-banking/transaction-history')">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <span>History</span>
        </button>
        <button class="mobile-nav-item" onclick="logout()">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Sign Out</span>
        </button>
      `;
    } else {
      mNav.innerHTML = '';
    }
  }

  if (state.user) {
    el.innerHTML = `
      <button class="nav-link ${h==='#/portal/digital-banking/dashboard'?'active':''}" onclick="nav('#/portal/digital-banking/dashboard')">Overview</button>
      <button class="nav-link ${h==='#/portal/digital-banking/transaction-history'?'active':''}" onclick="nav('#/portal/digital-banking/transaction-history')">Transactions</button>
      <button class="nav-link ${h==='#/portal/digital-banking/intrabank-transfer'?'active':''}" onclick="nav('#/portal/digital-banking/intrabank-transfer')">Intrabank Transfer</button>
      <button class="nav-link ${h==='#/portal/digital-banking/wire-transfer'?'active':''}"      onclick="nav('#/portal/digital-banking/wire-transfer')">Wire Transfer</button>
      <button class="nav-btn-primary" onclick="logout()">Sign Out</button>
    `;
  } else {
    el.innerHTML = `
      <button class="nav-link ${h==='#'?'active':''}"         onclick="nav('#')">Home</button>
      <button class="nav-link ${h==='#/portal/client-auth/login'?'active':''}"   onclick="nav('#/portal/client-auth/login')">Client Login</button>
      <button class="nav-btn-primary"                          onclick="nav('#/portal/client-onboarding/apply')">Open Account</button>
    `;
  }
}

// ── Toast System ──────────────────────────────────────────────────────────────
function toast(title, msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-title">${title}</div><div class="toast-msg">${msg}</div>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastIn 0.25s reverse forwards'; setTimeout(() => t.remove(), 280); }, 4500);
}

function showLoader(statusText, subtext = 'Meridian Trust Secure Operations') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.className = 'loading-overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="loading-spinner-container">
      <div class="loading-spinner"></div>
      <div class="loading-status-text">${statusText}</div>
      <div class="loading-subtext">${subtext}</div>
    </div>
  `;
  el.classList.add('show');
}

function hideLoader() {
  document.getElementById('loading-overlay')?.classList.remove('show');
}

// ── Utility Helpers ───────────────────────────────────────────────────────────
const sym = c => ({ USD: '$', EUR: '€', GBP: '£' }[c] ?? c);

function fmtMoney(amount, currency) {
  return `${sym(currency)}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

// Balance visibility state (default: hidden)
let balanceVisible = false;
function toggleBalanceVisibility() {
  balanceVisible = !balanceVisible;
  renderDashboard();
}
window.toggleBalanceVisibility = toggleBalanceVisibility;

function togglePasswordEye(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  } else {
    input.type = 'password';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
}
window.togglePasswordEye = togglePasswordEye;

function maskBalance(amount, currency) {
  if (!balanceVisible) return '••••••••';
  return fmtMoney(amount, currency);
}

function todayValue() {
  return new Date().toISOString().split('T')[0];
}

function setRoot(html) {
  const root = document.getElementById('app-root');
  if (root) root.innerHTML = html;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const icons = {
  arrowUp:   `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  shield:    `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  globe:     `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  lock:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  card:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  mail:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  check:     `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`,
  send:      `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  receive:   `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>`,
};

// ── VIEWS ─────────────────────────────────────────────────────────────────────

// Scroll-to-section helper for single-page nav
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.scrollToSection = scrollToSection;

// Web3-Style Single-Page Landing
function renderLanding() {
  setRoot(`
    <div class="w3-landing">

      <!-- ═══ HERO — Fullscreen immersive ═══ -->
      <section class="w3-hero" id="w3-top">
        <div class="w3-hero-bg"></div>
        <div class="w3-hero-overlay"></div>
        <div class="w3-hero-mesh"></div>
        <div class="w3-hero-particles">
          <div class="w3-particle"></div><div class="w3-particle"></div>
          <div class="w3-particle"></div><div class="w3-particle"></div>
          <div class="w3-particle"></div><div class="w3-particle"></div>
          <div class="w3-particle"></div><div class="w3-particle"></div>
        </div>

        <div class="w3-hero-content">
          <div class="w3-hero-badge">
            <span class="w3-hero-badge-dot"></span>
            Full-Reserve Offshore Banking
          </div>
          <h1 class="w3-hero-title">
            International Banking<br>Built for <span class="w3-highlight">Global Commerce</span>
          </h1>
          <p class="w3-hero-subtitle">
            Open offshore private placement treasury accounts in USD. Settle international wires with precision. Manage corporate treasuries and private wealth from a single secure platform.
          </p>
          <div class="w3-hero-cta">
            <button class="w3-btn-primary" onclick="nav('#/portal/client-onboarding/apply')">Open an Account</button>
            <button class="w3-btn-ghost" onclick="nav('#/portal/client-auth/login')">Client Portal Login</button>
          </div>
        </div>

        <div class="w3-scroll-indicator" onclick="scrollToSection('w3-stats')">
          <span>Explore</span>
          <div class="w3-scroll-line"></div>
        </div>
      </section>

      <!-- ═══ STATS BAR ═══ -->
      <section class="w3-stats-bar" id="w3-stats">
        <div class="w3-stats-inner">
          <div class="w3-stat-item">
            <div class="w3-stat-number">180<span class="w3-highlight">+</span></div>
            <div class="w3-stat-label">Countries Served</div>
          </div>
          <div class="w3-stat-item">
            <div class="w3-stat-number">$2.4<span class="w3-highlight">B</span></div>
            <div class="w3-stat-label">Assets Custodied</div>
          </div>
          <div class="w3-stat-item">
            <div class="w3-stat-number">99.97<span class="w3-highlight">%</span></div>
            <div class="w3-stat-label">Uptime SLA</div>
          </div>
          <div class="w3-stat-item">
            <div class="w3-stat-number">3</div>
            <div class="w3-stat-label">Major Currencies</div>
          </div>
        </div>
      </section>

      <!-- ═══ FEATURES — Platform capabilities ═══ -->
      <section class="w3-section w3-section-dark" id="w3-features">
        <div class="w3-section-inner">
          <div class="w3-section-header">
            <div class="w3-section-tag">
              <span class="w3-section-tag-line"></span>
              Our Platform
              <span class="w3-section-tag-line"></span>
            </div>
            <h2 class="w3-section-title">Everything Your Business Needs to Bank Globally</h2>
            <p class="w3-section-desc">Designed for startups, holding companies, and high-net-worth individuals requiring a sophisticated offshore banking partner.</p>
          </div>

          <div class="w3-features-grid">
            <div class="w3-feature-card">
              <div class="w3-feature-icon">${icons.globe}</div>
              <h3 class="w3-feature-title">Full-Reserve USD Accounts</h3>
              <p class="w3-feature-desc">Maintain checking, savings, and market treasury accounts in USD. Every dollar is backed 100% by cash or short-term U.S. treasury instruments.</p>
            </div>
            <div class="w3-feature-card">
              <div class="w3-feature-icon">${icons.send}</div>
              <h3 class="w3-feature-title">International Wire Transfers</h3>
              <p class="w3-feature-desc">Send outbound SWIFT wires to 180+ countries. Set custom settlement dates for historical reconciliation and retroactive ledger adjustments.</p>
            </div>
            <div class="w3-feature-card">
              <div class="w3-feature-icon">${icons.card}</div>
              <h3 class="w3-feature-title">Debit & Virtual Cards</h3>
              <p class="w3-feature-desc">Instantly issue physical debit cards and virtual cards for your team. Freeze, unfreeze, or cancel any card from within the client portal.</p>
            </div>
            <div class="w3-feature-card">
              <div class="w3-feature-icon">${icons.shield}</div>
              <h3 class="w3-feature-title">KYC & Compliance</h3>
              <p class="w3-feature-desc">Tiered identity verification for personal and corporate accounts. Real-time AML screening and suspicious transaction monitoring.</p>
            </div>
            <div class="w3-feature-card">
              <div class="w3-feature-icon">${icons.lock}</div>
              <h3 class="w3-feature-title">Full-Reserve Security</h3>
              <p class="w3-feature-desc">100% of client deposits are held in short-term sovereign treasury instruments. We do not engage in fractional reserve lending.</p>
            </div>
            <div class="w3-feature-card">
              <div class="w3-feature-icon">${icons.receive}</div>
              <h3 class="w3-feature-title">Personal & Business Accounts</h3>
              <p class="w3-feature-desc">Separate account profiles for individuals and corporate entities. Business accounts support multiple signatories and treasury controls.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ SECURITY & TRUST — Glass morphism split ═══ -->
      <section class="w3-section w3-section-navy" id="w3-security">
        <div class="w3-section-inner">
          <div class="w3-glass-grid">
            <div class="w3-glass-card">
              <h2 class="w3-glass-card-title">Bank-Grade Security Infrastructure</h2>
              <p class="w3-glass-card-text">Our offshore custody model ensures 100% of deposits are allocated directly to liquid short-term sovereign treasury instruments. No fractional reserve exposure.</p>
              <div class="w3-trust-list">
                <div class="w3-trust-item">
                  <div class="w3-trust-icon">${icons.shield}</div>
                  <span>AES-256 end-to-end encryption on all data channels</span>
                </div>
                <div class="w3-trust-item">
                  <div class="w3-trust-icon">${icons.lock}</div>
                  <span>Two-factor MFA verification on every login & wire</span>
                </div>
                <div class="w3-trust-item">
                  <div class="w3-trust-icon">${icons.globe}</div>
                  <span>SWIFT & SEPA network compatibility for global routing</span>
                </div>
                <div class="w3-trust-item">
                  <div class="w3-trust-icon">${icons.check}</div>
                  <span>Real-time AML/KYC screening & transaction monitoring</span>
                </div>
              </div>
            </div>

            <div class="w3-security-visual">
              <div class="w3-shield-circle">
                <div class="w3-shield-inner">
                  <svg viewBox="0 0 24 24" width="56" height="56" stroke="currentColor" stroke-width="1.5" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <polyline points="9 12 11 14 15 10" stroke-width="2"/>
                  </svg>
                </div>
              </div>
              <div class="w3-security-metrics">
                <div class="w3-metric-box">
                  <div class="w3-metric-value">100%</div>
                  <div class="w3-metric-label">Full Reserve</div>
                </div>
                <div class="w3-metric-box">
                  <div class="w3-metric-value">256-bit</div>
                  <div class="w3-metric-label">Encryption</div>
                </div>
                <div class="w3-metric-box">
                  <div class="w3-metric-value">6-Digit</div>
                  <div class="w3-metric-label">MFA Codes</div>
                </div>
                <div class="w3-metric-box">
                  <div class="w3-metric-value">24/7</div>
                  <div class="w3-metric-label">Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ SERVICES — What we offer ═══ -->
      <section class="w3-section w3-section-dark" id="w3-services">
        <div class="w3-section-inner">
          <div class="w3-section-header">
            <div class="w3-section-tag">
              <span class="w3-section-tag-line"></span>
              Core Services
              <span class="w3-section-tag-line"></span>
            </div>
            <h2 class="w3-section-title">Comprehensive Offshore Banking Solutions</h2>
            <p class="w3-section-desc">From international wire routing to real-time asset audits, every tool you need for global financial operations.</p>
          </div>

          <div class="w3-services-list">
            <div class="w3-service-card">
              <div class="w3-service-num">01</div>
              <div>
                <h3 class="w3-service-title">Outbound SWIFT Wire Transfers</h3>
                <p class="w3-service-desc">Submit international wire transfers globally. Secure 2FA multi-factor checks verify and authorize transactions before outbound routing is written to the ledger.</p>
              </div>
            </div>
            <div class="w3-service-card">
              <div class="w3-service-num">02</div>
              <div>
                <h3 class="w3-service-title">Treasury Asset Management</h3>
                <p class="w3-service-desc">Allocate surplus capital to yielding treasury assets. Enjoy sovereign protection under full-reserve regulatory compliance with immediate liquidity.</p>
              </div>
            </div>
            <div class="w3-service-card">
              <div class="w3-service-num">03</div>
              <div>
                <h3 class="w3-service-title">Offshore Debit & Virtual Cards</h3>
                <p class="w3-service-desc">Manage corporate spending instantly. Operators can issue cards, toggle status, and view CVV/expiry details directly inside the secure portal.</p>
              </div>
            </div>
            <div class="w3-service-card">
              <div class="w3-service-num">04</div>
              <div>
                <h3 class="w3-service-title">Identity & Compliance KYC</h3>
                <p class="w3-service-desc">We apply professional identity verification and tax classification checks to ensure profile compliance with international banking regulations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ CTA — Final call to action ═══ -->
      <section class="w3-cta" id="w3-cta">
        <div class="w3-cta-inner">
          <h2 class="w3-cta-title">Ready to Open Your Offshore Account?</h2>
          <p class="w3-cta-desc">Registration takes under three minutes. Accounts are provisioned instantly upon identity verification. Begin your application now.</p>
          <div class="w3-cta-actions">
            <button class="w3-btn-primary" onclick="nav('#/portal/client-onboarding/apply')">Begin Application</button>
            <button class="w3-btn-ghost" onclick="nav('#/portal/client-auth/login')">Existing Client Login</button>
          </div>
        </div>
      </section>

    </div>
  `);
}

// Modal Utility System for Custom Pop-ups
function showCustomModal(title, bodyText, confirmCallback, cancelCallback, confirmLabel = 'OK', cancelLabel = '') {
  document.getElementById('custom-confirm-modal')?.remove();
  
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('show');
  
  const modal = document.createElement('div');
  modal.id = 'custom-confirm-modal';
  modal.className = 'w3-confirm-modal';
  modal.style.display = 'block';
  
  let cancelBtnHtml = '';
  if (cancelLabel) {
    cancelBtnHtml = `<button class="btn btn-ghost" style="padding:10px 20px; font-size: 20px; font-weight:700;" onclick="closeCustomModal(false)">${cancelLabel}</button>`;
  }
  
  modal.innerHTML = `
    <div class="w3-confirm-modal-header">
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" style="flex-shrink:0;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>${title}</span>
    </div>
    <div class="w3-confirm-modal-body">
      ${bodyText}
    </div>
    <div class="w3-confirm-modal-actions">
      ${cancelBtnHtml}
      <button class="btn btn-primary" style="padding:10px 24px; font-size: 20px; font-weight:700;" onclick="closeCustomModal(true)">${confirmLabel}</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  window.customModalCallbacks = {
    confirm: () => {
      if (confirmCallback) confirmCallback();
    },
    cancel: () => {
      if (cancelCallback) cancelCallback();
    }
  };
}

function closeCustomModal(isConfirmed) {
  document.getElementById('custom-confirm-modal')?.remove();
  document.getElementById('modal-overlay')?.classList.remove('show');
  
  if (window.customModalCallbacks) {
    if (isConfirmed) {
      window.customModalCallbacks.confirm();
    } else {
      window.customModalCallbacks.cancel();
    }
    window.customModalCallbacks = null;
  }
}
window.showCustomModal = showCustomModal;
window.closeCustomModal = closeCustomModal;

// Form Validation System for visual errors (asterisk & red borders)
function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return true;
  
  let isValid = true;
  const requiredInputs = form.querySelectorAll('[required]');
  
  requiredInputs.forEach(input => {
    if (input.type === 'checkbox') {
      const parentLabel = input.closest('label') || input.parentElement;
      if (!input.checked) {
        isValid = false;
        parentLabel.classList.add('checkbox-invalid');
      } else {
        parentLabel.classList.remove('checkbox-invalid');
      }
    } else {
      if (!input.value.trim()) {
        isValid = false;
        input.classList.add('is-invalid');
      } else {
        input.classList.remove('is-invalid');
      }
      
      if (!input.hasInputListener) {
        input.hasInputListener = true;
        input.addEventListener('input', () => {
          if (input.value.trim()) {
            input.classList.remove('is-invalid');
          }
        });
      }
    }
  });
  
  requiredInputs.forEach(input => {
    if (input.type === 'checkbox' && !input.hasChangeListener) {
      input.hasChangeListener = true;
      input.addEventListener('change', () => {
        const parentLabel = input.closest('label') || input.parentElement;
        if (input.checked) {
          parentLabel.classList.remove('checkbox-invalid');
        }
      });
    }
  });

  if (!isValid) {
    toast('Required Fields', 'Please complete all highlighted required fields.', 'error');
  }
  
  return isValid;
}
window.validateForm = validateForm;

// Brand Monogram SVG Header Generator
function getLoginHeaderHtml(title, subtitle) {
  return `
    <div class="auth-card-header">
      <div class="auth-logo-wrap" style="display:flex; justify-content:center; align-items:center;">
        <svg class="bank-logo-icon" viewBox="0 0 32 32" width="46" height="46" fill="none" style="margin-right:10px;">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FFFDF0" />
              <stop offset="15%" stop-color="#FFDF6D" />
              <stop offset="30%" stop-color="#E5A922" />
              <stop offset="50%" stop-color="#FFF5C2" />
              <stop offset="70%" stop-color="#A5750F" />
              <stop offset="100%" stop-color="#4B3300" />
            </linearGradient>
            <linearGradient id="goldHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
              <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
            </linearGradient>
            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="1.5" dy="3.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.5"/>
              <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#001844" flood-opacity="0.25"/>
            </filter>
          </defs>
          <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" fill="#001F5A" filter="url(#goldGlow)"/>
          <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" stroke="url(#goldGrad)" stroke-width="2.5" fill="none" opacity="0.9"/>
          <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" stroke="url(#goldHighlight)" stroke-width="1.5" fill="none" opacity="0.6"/>
          <path d="M10.5 21.5 L10.5 11 H12.5 L16 16.5 L19.5 11 H21.5 L21.5 21.5 H19.5 L19.5 14.5 L16.5 19 H15.5 L12.5 14.5 L12.5 21.5 H10.5 Z" fill="url(#goldGrad)" filter="url(#goldGlow)"/>
          <path d="M8 9.5 H24 V11.5 H17 V21.5 H15 V11.5 H8 Z" fill="url(#goldGrad)" filter="url(#goldGlow)"/>
          <path d="M10.5 21.5 L10.5 11 H12.5 L16 16.5 L19.5 11 H21.5 L21.5 21.5 H19.5 L19.5 14.5 L16.5 19 H15.5 L12.5 14.5 L12.5 21.5 H10.5 Z" fill="url(#goldHighlight)" style="mix-blend-mode: overlay;"/>
        </svg>
        <span style="font-family:'Cormorant Garamond',serif;font-size: 26px;font-weight:700;letter-spacing:0.02em;color:var(--citi-navy);">Meridian Trust</span>
      </div>
      <h1 class="auth-title" style="margin-top:8px;">${title}</h1>
      <p class="auth-subtitle">${subtitle}</p>
    </div>
  `;
}

// Upgraded Login Page rendering (with Switch Views)
function renderLogin() {
  if (!state.loginView) state.loginView = 'password';

  if (state.loginView === 'password') {
    setRoot(`
      <div class="auth-shell">
        <div class="auth-card">
          ${getLoginHeaderHtml('Client Portal Login', 'Enter your assigned Client ID and passcode to access your accounts.')}
          <div class="auth-card-body">
            <form id="login-form" novalidate onsubmit="handleLogin(event)">
              <div class="form-group">
                <label class="form-label">Client Account ID <span style="color:#dc2626;">*</span></label>
                <input id="f-uid" type="text" class="form-input" placeholder="Client ID" autocomplete="username" required>
              </div>
              <div class="form-group">
                <label class="form-label">Secure Passcode <span style="color:#dc2626;">*</span></label>
                <div style="position:relative;">
                  <input id="f-pwd" type="password" class="form-input" placeholder="Passcode" autocomplete="current-password" required style="padding-right:44px;">
                  <button type="button" onclick="togglePasswordEye('f-pwd', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;color:var(--text-muted);" aria-label="Toggle password visibility">
                    <svg id="eye-icon-f-pwd" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-full" style="margin-top:6px;">Authenticate Session</button>
            </form>
            <div style="display:flex; justify-content:space-between; margin-top:16px; font-size: 19px; font-weight:600;">
              <a onclick="switchLoginView('forgot')">Forgot Passcode?</a>
              <a onclick="switchLoginView('link')">Sign In with Email Link</a>
            </div>
          </div>
          <div class="auth-card-footer">
            New to Meridian Trust? <a onclick="nav('#/portal/client-onboarding/apply')">Open an account</a>
          </div>
        </div>
      </div>
    `);
  } else if (state.loginView === 'forgot') {
    setRoot(`
      <div class="auth-shell">
        <div class="auth-card">
          ${getLoginHeaderHtml('Reset Secure Passcode', 'Provide your account credentials to request a passcode override link.')}
          <div class="auth-card-body">
            <form id="forgot-form" novalidate onsubmit="handleForgotSubmit(event)">
              <div class="form-group">
                <label class="form-label">Client Account ID <span style="color:#dc2626;">*</span></label>
                <input id="fg-uid" type="text" class="form-input" placeholder="Client ID" required>
              </div>
              <div class="form-group">
                <label class="form-label">Registered Email Address <span style="color:#dc2626;">*</span></label>
                <input id="fg-email" type="email" class="form-input" placeholder="Email Address" required>
              </div>
              <button type="submit" class="btn btn-primary btn-full" style="margin-top:6px;">Request Reset Link</button>
            </form>
            <div style="text-align:center; margin-top:16px; font-size: 19px; font-weight:600;">
              <a onclick="switchLoginView('password')">Return to Password Sign In</a>
            </div>
          </div>
          <div class="auth-card-footer">
            Back to <a onclick="nav('#')">Meridian Trust Home</a>
          </div>
        </div>
      </div>
    `);
  } else if (state.loginView === 'link') {
    setRoot(`
      <div class="auth-shell">
        <div class="auth-card">
          ${getLoginHeaderHtml('Sign In with Secure Link', 'Enter your registered email. We will send a one-click session authorization link.')}
          <div class="auth-card-body">
            <form id="link-login-form" novalidate onsubmit="handleLinkLoginSubmit(event)">
              <div class="form-group">
                <label class="form-label">Registered Email Address <span style="color:#dc2626;">*</span></label>
                <input id="lk-email" type="email" class="form-input" placeholder="Email Address" required>
              </div>
              <button type="submit" class="btn btn-primary btn-full" style="margin-top:6px;">Send Sign-In Link</button>
            </form>
            <div style="text-align:center; margin-top:16px; font-size: 19px; font-weight:600;">
              <a onclick="switchLoginView('password')">Return to Password Sign In</a>
            </div>
          </div>
          <div class="auth-card-footer">
            Back to <a onclick="nav('#')">Meridian Trust Home</a>
          </div>
        </div>
      </div>
    `);
  }
}

function switchLoginView(view) {
  state.loginView = view;
  renderLogin();
}
window.switchLoginView = switchLoginView;

function handleForgotSubmit(e) {
  e.preventDefault();
  if (!validateForm('forgot-form')) {
    return;
  }
  const uid = document.getElementById('fg-uid').value;
  const email = document.getElementById('fg-email').value;
  
  showLoader('Requesting Reset', 'Locating secure record and preparing passcode override instructions...');
  setTimeout(() => {
    hideLoader();
    showCustomModal(
      'Passcode Recovery Sent',
      `Password reset instructions have been successfully generated for Client ID <strong>${uid}</strong> and sent to <strong>${email}</strong>. Please check your spam folder if it does not arrive shortly.`,
      () => { switchLoginView('password'); },
      null,
      'Close'
    );
  }, 1200);
}
window.handleForgotSubmit = handleForgotSubmit;

function handleLinkLoginSubmit(e) {
  e.preventDefault();
  if (!validateForm('link-login-form')) {
    return;
  }
  const email = document.getElementById('lk-email').value;
  
  showLoader('Generating Link', 'Authenticating device signature and encoding session token...');
  setTimeout(() => {
    hideLoader();
    showCustomModal(
      'Secure Sign-In Link Sent',
      `A secure session verification link has been sent to <strong>${email}</strong>. Clicking this link will immediately sign you into your offshore digital banking dashboard.`,
      () => { switchLoginView('password'); },
      null,
      'Check Inbox'
    );
  }, 1200);
}
window.handleLinkLoginSubmit = handleLinkLoginSubmit;

// Registration Wizard Helpers
function initRegData() {
  if (!state.regStep) state.regStep = 1;
  if (!state.regData || !state.regData.selectedAccounts) {
    state.regData = {
      accountClassification: 'individual',
      selectedAccounts: ['checking', 'savings'],
      addOns: {
        debitCard: true,
        checks: true,
        overdraft: true,
        overdraftAccount: 'savings'
      },
      citizenshipConfirmed: false,
      firstName: '',
      lastName: '',
      dob: '',
      email: '',
      phone: '+1 ',
      ssn: '',
      address: '',
      addressUnit: '',
      city: '',
      state: '',
      zip: ''
    };
  }
}

function getProgressBarHtml(step) {
  const pct = step * 20;
  return `
    <div class="w3-reg-progress-container">
      <div class="w3-reg-progress-text">
        <span>Account Application</span>
        <span>Step ${step} of 5 (${pct}%)</span>
      </div>
      <div class="w3-reg-progress-bar">
        <div class="w3-reg-progress-fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  `;
}

function setRegClass(cls) {
  initRegData();
  state.regData.accountClassification = cls;
  renderRegister();
}
window.setRegClass = setRegClass;

function toggleRegProgram(type) {
  initRegData();
  const idx = state.regData.selectedAccounts.indexOf(type);
  if (idx > -1) {
    if (state.regData.selectedAccounts.length > 1) {
      state.regData.selectedAccounts.splice(idx, 1);
    } else {
      toast('Selection Required', 'At least one account program must remain selected.', 'warning');
    }
  } else {
    state.regData.selectedAccounts.push(type);
  }
  renderRegister();
}
window.toggleRegProgram = toggleRegProgram;

function toggleAddon(key) {
  initRegData();
  state.regData.addOns[key] = !state.regData.addOns[key];
  renderRegister();
}
window.toggleAddon = toggleAddon;

function setOverdraftAccount(acc) {
  initRegData();
  state.regData.addOns.overdraftAccount = acc;
  renderRegister();
}
window.setOverdraftAccount = setOverdraftAccount;

function prevRegStep(step) {
  state.regStep = step;
  renderRegister();
}
window.prevRegStep = prevRegStep;

function nextRegStep(step) {
  initRegData();
  if (step === 2) {
    if (state.regData.selectedAccounts.length === 0) {
      toast('Selection Required', 'Please select at least one account program to open.', 'error');
      return;
    }
  }
  state.regStep = step;
  renderRegister();
}
window.nextRegStep = nextRegStep;

function saveStep4Data(e) {
  e.preventDefault();
  if (!validateForm('reg-form-step4')) {
    return;
  }
  initRegData();
  
  state.regData.citizenshipConfirmed = true;
  if (state.regData.accountClassification === 'business') {
    state.regData.firstName = document.getElementById('r-company-name').value;
    state.regData.lastName = '';
  } else {
    state.regData.firstName = document.getElementById('r-fname').value;
    state.regData.lastName = document.getElementById('r-lname').value;
  }
  state.regData.dob = document.getElementById('r-dob').value;
  state.regData.email = document.getElementById('r-email').value;
  state.regData.phone = document.getElementById('r-phone').value;
  
  state.regStep = 5;
  renderRegister();
}
window.saveStep4Data = saveStep4Data;

async function handleRegisterSubmitWizard(e) {
  e.preventDefault();
  if (!validateForm('reg-form-step5')) {
    return;
  }
  initRegData();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Submitting…';
  
  showLoader('Processing Application', 'Verifying tax identification and registering offshore bank accounts…');

  const startTime = Date.now();
  try {
    const ssnVal = document.getElementById('r-ssn').value;
    const street = document.getElementById('r-address').value;
    const unit = document.getElementById('r-unit').value;
    const city = document.getElementById('r-city').value;
    const stateVal = document.getElementById('r-state').value;
    const zipVal = document.getElementById('r-zip').value;
    
    state.regData.address = street;
    state.regData.addressUnit = unit;
    state.regData.city = city;
    state.regData.state = stateVal;
    state.regData.zip = zipVal;
    
    const combinedAddress = `${street}${unit ? ', ' + unit : ''}, ${city}, ${stateVal} ${zipVal}`;
    const combinedName = state.regData.accountClassification === 'business'
      ? state.regData.firstName
      : `${state.regData.firstName} ${state.regData.lastName}`.trim();

    const payload = {
      name: combinedName,
      email: state.regData.email,
      phone: state.regData.phone,
      address: combinedAddress,
      state: stateVal,
      zip: zipVal,
      accountType: state.regData.accountClassification === 'business' ? 'business' : 'personal',
      selectedAccounts: state.regData.selectedAccounts,
      ssn: ssnVal
    };

    const data = await api('/api/auth/register-submit', payload);
    state.regData = {}; // Clear form memory
    state.regStep = 1;
    
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 1500 - elapsed);
    
    setTimeout(() => {
      hideLoader();
      toast('Application Submitted', 'Your registration is under review.', 'success');
      renderRegistrationSuccess(payload.email);
    }, delay);
  } catch (err) {
    hideLoader();
    toast('Application Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Submit Application';
  }
}
window.handleRegisterSubmitWizard = handleRegisterSubmitWizard;

// Onboarding Wizard - Core Page Router
function renderRegister() {
  initRegData();
  const step = state.regStep;

  // Icons used in Choice Cards
  const piggyIcon = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 12a7 7 0 1 1-14 0c0-2.2 1.4-4 3.5-4.6.6-.2 1.1-.8 1.1-1.4V4c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v2c0 .6.5 1.2 1.1 1.4 2.1.6 3.5 2.4 3.5 4.6z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M20 12h2M2 12h2M12 20v2"/></svg>`;
  const cashIcon = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>`;
  const cdIcon = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const checkingIcon = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;

  if (step === 1) {
    const d = state.regData;
    const isSel = (type) => d.selectedAccounts.includes(type) ? 'active' : '';
    const isClass = (cls) => d.accountClassification === cls ? 'active' : '';

    setRoot(`
      <div class="auth-shell">
        <div class="auth-card" style="max-width:580px;">
          ${getLoginHeaderHtml('Create Accounts', 'Select Account Classification & Programs')}
          <div class="auth-card-body">
            ${getProgressBarHtml(1)}
            
            <div style="margin-bottom:24px;">
              <h3 style="font-size: 19px; font-weight:700; color:var(--citi-navy); margin-bottom:12px;">Select Account Type</h3>
              <div class="w3-radio-option-list">
                <div class="w3-radio-option-card ${isClass('individual')}" onclick="setRegClass('individual')">
                  <div class="w3-radio-circle"><div class="w3-radio-inner-dot"></div></div>
                  <span class="w3-radio-label">Individual</span>
                </div>
                <div class="w3-radio-option-card ${isClass('joint')}" onclick="setRegClass('joint')">
                  <div class="w3-radio-circle"><div class="w3-radio-inner-dot"></div></div>
                  <span class="w3-radio-label">Joint</span>
                </div>
                <div class="w3-radio-option-card ${isClass('trust')}" onclick="setRegClass('trust')">
                  <div class="w3-radio-circle"><div class="w3-radio-inner-dot"></div></div>
                  <span class="w3-radio-label">In the name of a Trust</span>
                </div>
                <div class="w3-radio-option-card ${isClass('custodial')}" onclick="setRegClass('custodial')">
                  <div class="w3-radio-circle"><div class="w3-radio-inner-dot"></div></div>
                  <span class="w3-radio-label">Custodial Account</span>
                </div>
                <div class="w3-radio-option-card ${isClass('business')}" onclick="setRegClass('business')">
                  <div class="w3-radio-circle"><div class="w3-radio-inner-dot"></div></div>
                  <span class="w3-radio-label">Business / Corporate Entity</span>
                </div>
              </div>
            </div>

            <div style="margin-bottom:24px;">
              <h3 style="font-size: 19px; font-weight:700; color:var(--citi-navy); margin-bottom:12px;">Accounts to Open (Select at least one)</h3>
              <div class="w3-choice-cards-grid">
                
                <div class="w3-choice-card ${isSel('checking')}" onclick="toggleRegProgram('checking')">
                  <div class="w3-choice-card-header">
                    <div class="w3-choice-card-icon checking">${checkingIcon}</div>
                    <div class="w3-choice-card-checkbox"><span class="w3-choice-card-checkmark">✔</span></div>
                  </div>
                  <div class="w3-choice-card-body">
                    <span class="w3-choice-card-title">Spending / Checking</span>
                    <span class="w3-choice-card-apy">0.10% APY</span>
                    <span class="w3-choice-card-desc">Everyday transactions, wire routing.</span>
                  </div>
                </div>

                <div class="w3-choice-card ${isSel('savings')}" onclick="toggleRegProgram('savings')">
                  <div class="w3-choice-card-header">
                    <div class="w3-choice-card-icon savings">${piggyIcon}</div>
                    <div class="w3-choice-card-checkbox"><span class="w3-choice-card-checkmark">✔</span></div>
                  </div>
                  <div class="w3-choice-card-body">
                    <span class="w3-choice-card-title">Savings</span>
                    <span class="w3-choice-card-apy">3.00% APY</span>
                    <span class="w3-choice-card-desc">Compounding offshore yield preservation.</span>
                  </div>
                </div>

                <div class="w3-choice-card ${isSel('market')}" onclick="toggleRegProgram('market')">
                  <div class="w3-choice-card-header">
                    <div class="w3-choice-card-icon market">${cashIcon}</div>
                    <div class="w3-choice-card-checkbox"><span class="w3-choice-card-checkmark">✔</span></div>
                  </div>
                  <div class="w3-choice-card-body">
                    <span class="w3-choice-card-title">Money Market</span>
                    <span class="w3-choice-card-apy">3.25% APY</span>
                    <span class="w3-choice-card-desc">Highly liquid money market placements.</span>
                  </div>
                </div>

                <div class="w3-choice-card ${isSel('cd')}" onclick="toggleRegProgram('cd')">
                  <div class="w3-choice-card-header">
                    <div class="w3-choice-card-icon cd">${cdIcon}</div>
                    <div class="w3-choice-card-checkbox"><span class="w3-choice-card-checkmark">✔</span></div>
                  </div>
                  <div class="w3-choice-card-body">
                    <span class="w3-choice-card-title">CDs</span>
                    <span class="w3-choice-card-apy">4.10% APY</span>
                    <span class="w3-choice-card-desc">Guaranteed fixed return on term placements.</span>
                  </div>
                </div>

              </div>
            </div>

            <button class="btn btn-primary btn-full" onclick="nextRegStep(2)" style="margin-top:12px;">Continue</button>
          </div>
          <div class="auth-card-footer">
            Already registered? <a onclick="nav('#/portal/client-auth/login')">Sign in to your account</a>
          </div>
        </div>
      </div>
    `);
  } else if (step === 2) {
    const d = state.regData;
    const checkAddon = (key) => d.addOns[key] ? 'checked' : '';
    setRoot(`
      <div class="auth-shell">
        <div class="auth-card" style="max-width:580px;">
          ${getLoginHeaderHtml('Create Accounts', 'Select Add-ons & Overdraft Transfer')}
          <div class="auth-card-body">
            ${getProgressBarHtml(2)}
            
            <p style="font-size: 19.5px; color:var(--text-secondary); margin-bottom:20px; line-height:1.5;">
              Select complementary features for your new offshore banking account below.
            </p>

            <div class="w3-addon-row" onclick="toggleAddon('debitCard')">
              <div class="w3-addon-checkbox-wrap">
                <input type="checkbox" id="addon-debit" ${checkAddon('debitCard')} style="width:18px;height:18px;pointer-events:none;">
              </div>
              <div class="w3-addon-details">
                <span class="w3-addon-title">Free Debit Card</span>
                <span class="w3-addon-desc">Once you put money in your account, we'll mail a debit card to each account owner.</span>
              </div>
            </div>

            <div class="w3-addon-row" onclick="toggleAddon('checks')">
              <div class="w3-addon-checkbox-wrap">
                <input type="checkbox" id="addon-checks" ${checkAddon('checks')} style="width:18px;height:18px;pointer-events:none;">
              </div>
              <div class="w3-addon-details">
                <span class="w3-addon-title">Free Standard Checks</span>
                <span class="w3-addon-desc">We'll mail your first order of standard checks once you deposit funds in your account.</span>
              </div>
            </div>

            <div class="w3-addon-row" onclick="toggleAddon('overdraft')">
              <div class="w3-addon-checkbox-wrap">
                <input type="checkbox" id="addon-overdraft" ${checkAddon('overdraft')} style="width:18px;height:18px;pointer-events:none;">
              </div>
              <div class="w3-addon-details">
                <span class="w3-addon-title">Overdraft Transfer Service</span>
                <span class="w3-addon-desc">Open an Online Savings or Money Market account with us, and avoid overdraft fees with automatic transfers.</span>
              </div>
            </div>

            <div id="overdraft-source-section" style="display:${d.addOns.overdraft ? 'block' : 'none'}; background:#f8fafc; border:1px solid var(--border); padding:16px; border-radius:6px; margin-bottom:20px;">
              <label class="form-label">What type of account do you want to open for overdraft transfer service?</label>
              <select id="addon-overdraft-acc" class="form-select" onchange="setOverdraftAccount(this.value)">
                <option value="savings" ${d.addOns.overdraftAccount === 'savings' ? 'selected' : ''}>Savings</option>
                <option value="market" ${d.addOns.overdraftAccount === 'market' ? 'selected' : ''}>Money Market</option>
              </select>
            </div>

            <div style="display:flex; gap:12px; margin-top:20px;">
              <button class="btn btn-ghost" style="flex:1;" onclick="prevRegStep(1)">Back</button>
              <button class="btn btn-primary" style="flex:2;" onclick="nextRegStep(3)">Continue</button>
            </div>
          </div>
        </div>
      </div>
    `);
  } else if (step === 3) {
    const d = state.regData;
    const nameMap = {
      checking: { title: 'Spending Account', apy: '0.10% APY' },
      savings: { title: 'Savings Account', apy: '3.00% APY' },
      market: { title: 'Money Market Account', apy: '3.25% APY' },
      cd: { title: 'Certificate of Deposit (CD)', apy: '4.10% APY' }
    };
    
    const itemsHtml = d.selectedAccounts.map(type => {
      const item = nameMap[type];
      return `
        <div class="w3-review-item">
          <div class="w3-review-details">
            <span class="w3-review-title">${item.title}</span>
            <span class="w3-review-apy">Annual Percentage Yield: ${item.apy}</span>
          </div>
          <button class="w3-review-edit-btn" onclick="prevRegStep(1)">Edit</button>
        </div>
      `;
    }).join('');

    setRoot(`
      <div class="auth-shell">
        <div class="auth-card" style="max-width:580px;">
          ${getLoginHeaderHtml('Create Accounts', 'Review Account Selections')}
          <div class="auth-card-body">
            ${getProgressBarHtml(3)}
            
            <p style="font-size: 19.5px; color:var(--text-secondary); margin-bottom:16px;">
              Here are the accounts you've selected so far. Review your selections and add any other accounts you want to open.
            </p>

            <div style="margin-bottom:20px;">
              ${itemsHtml}
            </div>

            <button class="btn btn-ghost btn-full" onclick="prevRegStep(1)" style="margin-bottom:24px; font-weight:700;">+ Add Another Account</button>

            <div style="border:1px solid var(--border); padding:16px; border-radius:6px; background:#fcfcfc; margin-bottom:20px;">
              <h4 style="font-size: 18px; text-transform:uppercase; color:var(--citi-navy); letter-spacing:0.05em; margin:0 0 8px 0; font-weight:700;">Important Information About Opening a New Account</h4>
              <p style="font-size: 17.5px; color:var(--text-secondary); line-height:1.5; margin:0;">
                To help the U.S. government fight terrorism and money laundering, federal law requires us to obtain, verify, and record information identifying each person opening an account. We may ask to see your driver's license or other identifying documents.
              </p>
            </div>

            <div style="display:flex; gap:12px; margin-top:20px;">
              <button class="btn btn-ghost" style="flex:1;" onclick="prevRegStep(2)">Back</button>
              <button class="btn btn-primary" style="flex:2;" onclick="nextRegStep(4)">Next Step</button>
            </div>
          </div>
        </div>
      </div>
    `);
  } else if (step === 4) {
    const d = state.regData;
    setRoot(`
      <div class="auth-shell">
        <div class="auth-card" style="max-width:580px;">
          ${getLoginHeaderHtml('Create Accounts', 'Your Information')}
          <div class="auth-card-body">
            ${getProgressBarHtml(4)}

            <form id="reg-form-step4" novalidate onsubmit="saveStep4Data(event)">
              <p style="font-size: 19.5px; color:var(--text-secondary); margin-bottom:18px; line-height:1.5;">
                We are only able to open accounts for U.S. citizens and current U.S. residents. We also require a U.S. residential street address to complete the application.
              </p>

              <label style="display:flex; align-items:flex-start; gap:10px; font-size: 19.5px; cursor:pointer; background:#f8fafc; border:1px solid var(--border); padding:14px; border-radius:6px; margin-bottom:20px; line-height:1.4;">
                <input type="checkbox" id="r-citizen" ${d.citizenshipConfirmed ? 'checked' : ''} style="width:18px; height:18px; margin-top:1px;" required>
                <span>I'm a U.S. citizen or currently residing in the U.S. <span style="color:#dc2626;">*</span></span>
              </label>

              ${d.accountClassification === 'business' ? `
                <div class="form-group">
                  <label class="form-label">Company / Business Name <span style="color:#dc2626;">*</span></label>
                  <input id="r-company-name" type="text" class="form-input" placeholder="e.g. Acme Corporation LLC" value="${d.firstName || ''}" required>
                </div>
              ` : `
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">First Name <span style="color:#dc2626;">*</span></label>
                    <input id="r-fname" type="text" class="form-input" placeholder="First Name" value="${d.firstName || ''}" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Last Name <span style="color:#dc2626;">*</span></label>
                    <input id="r-lname" type="text" class="form-input" placeholder="Last Name" value="${d.lastName || ''}" required>
                  </div>
                </div>
              `}

              <div class="form-group">
                <label class="form-label">Date of Birth (MM/DD/YYYY) <span style="color:#dc2626;">*</span></label>
                <input id="r-dob" type="text" class="form-input" placeholder="MM/DD/YYYY" value="${d.dob || ''}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Email Address <span style="color:#dc2626;">*</span></label>
                <input id="r-email" type="email" class="form-input" placeholder="Email Address" value="${d.email || ''}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Phone Number <span style="color:#dc2626;">*</span></label>
                <input id="r-phone" type="tel" class="form-input" placeholder="Phone Number" value="${d.phone || ''}" required>
              </div>

              <div style="display:flex; gap:12px; margin-top:20px;">
                <button type="button" class="btn btn-ghost" style="flex:1;" onclick="prevRegStep(3)">Back</button>
                <button type="submit" class="btn btn-primary" style="flex:2;">Continue</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `);
  } else if (step === 5) {
    const d = state.regData;
    setRoot(`
      <div class="auth-shell">
        <div class="auth-card" style="max-width:580px;">
          ${getLoginHeaderHtml('Create Accounts', 'Address & Identity Verification')}
          <div class="auth-card-body">
            ${getProgressBarHtml(5)}

            <form id="reg-form-step5" novalidate onsubmit="handleRegisterSubmitWizard(event)">
              <p style="font-size: 19.5px; color:var(--text-secondary); margin-bottom:18px; line-height:1.5;">
                Enter your tax identification and U.S. residential street address details below.
              </p>

              <div class="form-group">
                <label class="form-label">Social Security Number (SSN) / ITIN <span style="color:#dc2626;">*</span></label>
                <input id="r-ssn" type="password" class="form-input" placeholder="Tax ID / SSN" style="letter-spacing:2px; font-family:monospace;" required>
              </div>

              <div class="form-group">
                <label class="form-label">Residential Address (no P.O. Boxes) <span style="color:#dc2626;">*</span></label>
                <input id="r-address" type="text" class="form-input" placeholder="Residential Street Address" value="${d.address || ''}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Apartment, Suite, Unit, etc. (Optional)</label>
                <input id="r-unit" type="text" class="form-input" placeholder="e.g. Apt 4B" value="${d.addressUnit || ''}">
              </div>

              <div class="form-group">
                <label class="form-label">City <span style="color:#dc2626;">*</span></label>
                <input id="r-city" type="text" class="form-input" placeholder="City" value="${d.city || ''}" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">State <span style="color:#dc2626;">*</span></label>
                  <input id="r-state" type="text" class="form-input" placeholder="State" value="${d.state || ''}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">ZIP Code <span style="color:#dc2626;">*</span></label>
                  <input id="r-zip" type="text" class="form-input" placeholder="ZIP Code" value="${d.zip || ''}" required>
                </div>
              </div>

              <div style="display:flex; gap:12px; margin-top:20px;">
                <button type="button" class="btn btn-ghost" style="flex:1;" onclick="prevRegStep(4)">Back</button>
                <button type="submit" class="btn btn-primary" style="flex:2;">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `);
  }
}

// Success Page — show success notice after registration with brand logo
function renderRegistrationSuccess(email) {
  setRoot(`
    <div class="auth-shell">
      <div class="auth-card" style="max-width:550px;">
        <div class="auth-card-header" style="text-align:center;">
            <svg class="bank-logo-icon" viewBox="0 0 32 32" width="56" height="56" fill="none" style="margin: 0 auto;">
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFFDF0" />
                  <stop offset="15%" stop-color="#FFDF6D" />
                  <stop offset="30%" stop-color="#E5A922" />
                  <stop offset="50%" stop-color="#FFF5C2" />
                  <stop offset="70%" stop-color="#A5750F" />
                  <stop offset="100%" stop-color="#4B3300" />
                </linearGradient>
                <linearGradient id="goldHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
                  <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.1"/>
                  <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
                </linearGradient>
                <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="1.5" dy="3.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.5"/>
                  <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#001844" flood-opacity="0.25"/>
                </filter>
              </defs>
              <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" fill="#001F5A" filter="url(#goldGlow)"/>
              <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" stroke="url(#goldGrad)" stroke-width="2.5" fill="none" opacity="0.9"/>
              <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" stroke="url(#goldHighlight)" stroke-width="1.5" fill="none" opacity="0.6"/>
              <path d="M10.5 21.5 L10.5 11 H12.5 L16 16.5 L19.5 11 H21.5 L21.5 21.5 H19.5 L19.5 14.5 L16.5 19 H15.5 L12.5 14.5 L12.5 21.5 H10.5 Z" fill="url(#goldGrad)" filter="url(#goldGlow)"/>
              <path d="M8 9.5 H24 V11.5 H17 V21.5 H15 V11.5 H8 Z" fill="url(#goldGrad)" filter="url(#goldGlow)"/>
              <path d="M10.5 21.5 L10.5 11 H12.5 L16 16.5 L19.5 11 H21.5 L21.5 21.5 H19.5 L19.5 14.5 L16.5 19 H15.5 L12.5 14.5 L12.5 21.5 H10.5 Z" fill="url(#goldHighlight)" style="mix-blend-mode: overlay;"/>
            </svg>
            <div style="font-family:'Cormorant Garamond',serif;font-size: 28px;font-weight:700;letter-spacing:0.02em;color:var(--citi-navy);margin-top:12px;">Meridian Trust</div>
          </div>
          <h1 class="auth-title">Application Submitted</h1>
          <p class="auth-subtitle">Your Meridian Trust offshore account application is under review.</p>
        </div>
        <div class="auth-card-body">
          <div style="background-color:#F4F6F9;border-left:4px solid #002C77;padding:16px;margin-bottom:24px;font-size: 19.5px;color:#333;line-height:1.6;border-radius:0 4px 4px 0;">
            <strong>📋 Compliance Review Status: PENDING</strong><br>
            Federal banking regulations require our verification team to review identity documents and tax designations (SSN/ITIN) before credentials can be activated.
          </div>
          
          <p style="font-size: 20.5px;line-height:1.6;color:#555;margin-bottom:24px;text-align:center;font-weight:500;">
            Your application has been submitted. Please check your email for confirmations.
          </p>

          <button class="btn btn-primary btn-full" onclick="nav('#/portal/client-auth/login')">Return to Login</button>
        </div>
      </div>
    </div>
  `);
}

// Dashboard
async function loadDashboard() {
  setRoot(`<div style="padding:60px;text-align:center;color:var(--text-muted);font-size: 20px;">Loading your account data…</div>`);
  try {
    const [accounts, transactions, cards] = await Promise.all([
      api(`/api/accounts?userId=${state.user.id}`),
      api(`/api/transactions?userId=${state.user.id}`),
      api(`/api/cards?userId=${state.user.id}`)
    ]);
    state.accounts     = accounts;
    state.transactions = transactions;
    state.cards        = cards;
    renderDashboard();
  } catch (e) {
    toast('Load Failed', 'Could not retrieve account data. Please refresh.', 'error');
  }
}

function renderDashboard() {
  const u = state.user;

  if (u.mustChangePassword) {
    setTimeout(() => {
      showPasswordChangeModal();
    }, 100);
  }

  // Compute net assets
  let netAssets = 0;
  state.accounts.forEach(a => {
    netAssets += parseFloat(a.balance) || 0;
  });

  const eyeOpenSvg = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeClosedSvg = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  // Transaction rows (show last 8)
  const recent = state.transactions.slice(0, 8);
  const txRows = recent.length ? recent.map(t => {
    const isCredit = t.type === 'DEPOSIT';
    return `
      <tr onclick="showTransactionDetails('${t.id}')" style="cursor:pointer;" class="txn-row-interactive">
        <td style="width:44px;">
          <div class="txn-icon ${isCredit ? 'credit' : 'debit'}">${isCredit ? icons.arrowDown : icons.arrowUp}</div>
        </td>
        <td>
          <div class="txn-desc">${t.description}</div>
          <div class="txn-party">${t.counterparty}</div>
        </td>
        <td class="txn-date">${fmtDateTime(t.date)}</td>
        <td>
          <span class="status-pill ${t.status}">${t.status}</span>
        </td>
        <td class="txn-amount ${isCredit ? 'credit' : 'debit'}">
          ${isCredit ? '+' : '−'}${fmtMoney(t.amount, t.currency)}
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);font-size: 19px;">No transactions on record.</td></tr>`;

  const txMobileRows = recent.length ? recent.map(t => {
    const isCredit = t.type === 'DEPOSIT';
    const accLabel = resolveAccountLabel(t.accountId);
    return `
      <div class="txn-mobile-item" onclick="showTransactionDetails('${t.id}')">
        <div class="txn-mobile-left">
          <div class="txn-icon ${isCredit ? 'credit' : 'debit'}">${isCredit ? icons.arrowDown : icons.arrowUp}</div>
          <div class="txn-mobile-info">
            <div class="txn-desc">${t.description}</div>
            <div class="txn-party">${t.counterparty} <span style="font-size: 16px; color:var(--text-muted);">(${accLabel})</span></div>
            <div class="txn-date">${fmtDateTime(t.date)}</div>
          </div>
        </div>
        <div class="txn-mobile-right">
          <div class="txn-amount ${isCredit ? 'credit' : 'debit'}">
            ${isCredit ? '+' : '−'}${fmtMoney(t.amount, t.currency)}
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="status-pill ${t.status}">${t.status}</span>
            <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation(); downloadWirePDF('${t.id}')" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center;" title="Download Receipt">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('') : `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size: 19px;">No transactions on record.</div>`;

  // Card panels (first 2) — Platinum & Diamond luxury design
  const cardPanels = state.cards.slice(0, 2).map((c, idx) => {
    const frozen = c.status === 'FROZEN';
    const tierClass = idx === 0 ? '' : 'diamond';
    const tierLabel = idx === 0 ? 'Platinum' : 'Diamond';
    return `
      <div class="card-item-container">
        <div class="card-visual ${frozen ? 'frozen' : 'active'} ${tierClass}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div class="card-chip"></div>
            <div>
              <div class="card-network">Meridian Trust</div>
              <div class="card-tier-label">${tierLabel}</div>
            </div>
          </div>
          <div>
            <div class="card-number-display">•••• &nbsp;•••• &nbsp;•••• &nbsp;${c.cardNumber.slice(-4)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;">
            <div><div class="card-label">Cardholder</div><div class="card-value">${c.cardholderName}</div></div>
            <div style="text-align:right;"><div class="card-label">Expires</div><div class="card-value">${c.expiry}</div></div>
          </div>
        </div>
        ${frozen ? `<div class="frozen-label" style="margin-bottom:8px;">Card Frozen</div>` : ''}
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm" onclick="toggleCard('${c.id}')">${frozen ? 'Unfreeze Card' : 'Freeze Card'}</button>
          <button class="btn btn-ghost btn-sm" disabled style="opacity:0.4;">View Details</button>
        </div>
      </div>
    `;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:16px 0;">');

  setRoot(`
    <div class="app-container">
      <div class="page-header" style="margin-bottom:0;">
        <div class="page-header-inner">
          <div style="flex:1;">
            <h2 class="page-greeting">Welcome, ${u.name ? u.name.split(' ')[0] : 'Client'}</h2>
            <p class="page-subtext">Client ID: ${u.id} &nbsp;·&nbsp; ${u.accountType === 'business' ? 'Corporate Account' : 'Personal Account'} &nbsp;·&nbsp; ${u.email}</p>

            <!-- Inline Net Balance with eye toggle -->
            <div style="margin-top:16px; display:flex; align-items:center; gap:10px;">
              <div>
                <div style="font-size: 17px; text-transform:uppercase; color:var(--text-muted); font-weight:600; letter-spacing:0.06em;">Total Balance</div>
                <div style="font-size: 30px; font-weight:800; color:var(--citi-navy); font-family:'Roboto Condensed',sans-serif; line-height:1.2;">${maskBalance(netAssets, 'USD')}</div>
              </div>
              <button onclick="toggleBalanceVisibility()" style="background:none; border:none; cursor:pointer; color:var(--text-muted); padding:6px; border-radius:50%; transition:all 0.15s ease;" onmouseover="this.style.background='rgba(0,44,119,0.08)'" onmouseout="this.style.background='none'" aria-label="Toggle balance visibility" title="${balanceVisible ? 'Hide balances' : 'Show balances'}">
                ${balanceVisible ? eyeOpenSvg : eyeClosedSvg}
              </button>
            </div>

            <!-- Compact account list -->
            <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;">
              ${state.accounts.map(a => `
                <div style="display:flex; align-items:center; gap:8px; background:var(--bg-card, #f8fafc); border:1px solid var(--border); border-radius:8px; padding:8px 14px; min-width:200px;">
                  <div style="width:6px; height:6px; border-radius:50%; flex-shrink:0; background:${a.type === 'checking' ? '#002C77' : a.type === 'savings' ? '#0066CC' : a.type === 'market' ? '#0099D6' : '#b5a25e'};"></div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-size: 17px; color:var(--text-muted); font-weight:600; text-transform:capitalize;">${a.type === 'market' ? 'Money Market' : a.type}</div>
                    <div style="font-size: 19px; font-weight:700; color:var(--citi-navy); font-family:'Roboto Condensed',sans-serif;">${maskBalance(a.balance, a.currency)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <span class="kyc-badge ${u.kycStatus}">
              ${icons.check} KYC ${u.kycStatus}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions" style="margin-top:20px;">
        <button class="quick-action-btn quick-action-span-2" onclick="nav('#/portal/digital-banking/wire-transfer')">
          <div class="quick-action-icon">${icons.send}</div>
          <div><div style="font-weight:600;">Initiate Outbound SWIFT Wire Transfer</div><div style="font-size: 18px;color:var(--text-muted);font-weight:400;">Transfer USD to global bank accounts instantly</div></div>
        </button>
      </div>

      <div class="dash-grid">
        <!-- Transactions -->
        <div>
          <div class="panel">
            <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
              <span class="panel-title">Transaction Ledger</span>
              <button class="btn btn-ghost btn-xs" onclick="nav('#/portal/digital-banking/transaction-history')" style="padding: 4px 8px; font-size: 17px; font-weight:600;">
                View All Transactions
              </button>
            </div>
            <div style="overflow-x:auto;">
              <table class="txn-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Description</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>${txRows}</tbody>
              </table>
              <div class="txn-list-mobile">
                ${txMobileRows}
              </div>
            </div>
          </div>
        </div>

        <!-- Cards & Actions -->
        <div>
          <div class="panel" style="margin-bottom:20px;">
            <div class="panel-header">
              <span class="panel-title">Payment Cards</span>
            </div>
            <div class="panel-body">
              ${state.cards.length ? cardPanels : '<p style="color:var(--text-muted);font-size: 19px;">No cards on file.</p>'}
              <button class="btn btn-secondary btn-full btn-sm" style="margin-top:16px;" onclick="issueVirtualCard()">
                ${icons.card} &nbsp; Issue New Virtual Card
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

}

let currentWireTab = 'send';

async function loadSend() {
  if (!state.accounts.length) {
    const accounts = await api(`/api/accounts?userId=${state.user.id}`);
    state.accounts = accounts;
  }
  if (state.wireStep === undefined || state.wireStep === 6) {
    state.wireStep = 1;
    state.wireData = {
      accountId: state.accounts[0]?.id || '',
      amount: '',
      recipientName: '',
      recipientAddress: '',
      swiftCode: '',
      routingNumber: '',
      accountNumber: '',
      bankName: '',
      description: ''
    };
  }
  renderWireTransfer();
}

function renderWireTransfer() {
  const u = state.user;
  const isBusiness = u.accountType === 'business';

  const opts = state.accounts.map(a => {
    const selected = state.wireData.accountId === a.id ? 'selected' : '';
    return `<option value="${a.id}" ${selected}>${a.type.charAt(0).toUpperCase() + a.type.slice(1)} (${a.currency}) — ${fmtMoney(a.balance, a.currency)}</option>`;
  }).join('');

  // Prepare wire details card for the incoming tab
  const detailsHtml = `
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Incoming SWIFT Wire Routing Instructions</span>
      </div>
      <div class="panel-body" style="padding:24px;">
        <p style="font-size: 20px; color:var(--text-secondary); margin-bottom:20px; line-height:1.5;">
          Use these official routing details to fund your accounts or receive high-value institutional wire transfers from third parties globally. All incoming wires are automatically processed and credited to your ledger in real time.
        </p>
        <div class="incoming-wire-grid">
          <div style="border-bottom:1px solid var(--border); padding-bottom:12px;">
            <div style="font-weight:700; color:var(--text-muted); text-transform:uppercase; font-size: 17px; margin-bottom:4px;">Receiving Bank</div>
            <div style="font-size: 20px; font-weight:600; color:var(--citi-navy);">Meridian Trust Bank Ltd.</div>
          </div>
          <div style="border-bottom:1px solid var(--border); padding-bottom:12px;">
            <div style="font-weight:700; color:var(--text-muted); text-transform:uppercase; font-size: 17px; margin-bottom:4px;">SWIFT / BIC Code</div>
            <div style="font-size: 20px; font-weight:600; color:var(--citi-navy); font-family:monospace;">MTBUSD2X</div>
          </div>
          <div style="border-bottom:1px solid var(--border); padding-bottom:12px;">
            <div style="font-weight:700; color:var(--text-muted); text-transform:uppercase; font-size: 17px; margin-bottom:4px;">Routing Transit Number (RTN)</div>
            <div style="font-size: 20px; font-weight:600; color:var(--citi-navy); font-family:monospace;">021000021</div>
          </div>
          <div style="border-bottom:1px solid var(--border); padding-bottom:12px;">
            <div style="font-weight:700; color:var(--text-muted); text-transform:uppercase; font-size: 17px; margin-bottom:4px;">Funding Currency</div>
            <div style="font-size: 20px; font-weight:600; color:var(--citi-navy);">United States Dollar (USD)</div>
          </div>
          <div style="border-bottom:1px solid var(--border); padding-bottom:12px; grid-column: span 2;">
            <div style="font-weight:700; color:var(--text-muted); text-transform:uppercase; font-size: 17px; margin-bottom:4px;">
              ${isBusiness ? 'Beneficiary Name (Company LLC)' : 'Beneficiary Name (Individual)'}
            </div>
            <div style="font-size: 20px; font-weight:700; color:var(--citi-navy);">${u.name}</div>
          </div>
          <div style="border-bottom:1px solid var(--border); padding-bottom:12px; grid-column: span 2;">
            <div style="font-weight:700; color:var(--text-muted); text-transform:uppercase; font-size: 17px; margin-bottom:4px;">Associated Account Numbers</div>
            <div style="display:flex; flex-direction:column; gap:4px; font-family:monospace; font-size: 19px; font-weight:600;">
              ${state.accounts.map(a => `<div>${a.type.charAt(0).toUpperCase() + a.type.slice(1)} Account: ${a.accountNumber}</div>`).join('')}
            </div>
          </div>
          <div style="grid-column: span 2; border-bottom:1px solid var(--border); padding-bottom:12px;">
            <div style="font-weight:700; color:var(--text-muted); text-transform:uppercase; font-size: 17px; margin-bottom:4px;">Intermediary Bank (Standard Settlement)</div>
            <div style="font-size: 19px; color:var(--text-secondary);">Citibank N.A., New York, NY &nbsp;|&nbsp; SWIFT: CITIUS33</div>
          </div>
        </div>
        <div style="margin-top:20px; background:#fffdf5; border:1px solid #ebd382; padding:14px; border-radius:6px; font-size: 18px; color:#744210; line-height:1.5;">
          <strong>Notice:</strong> Please ensure the beneficiary name matches your registered profile name exactly to avoid automated compliance holds or wire rejection. Wires are typically settled in 1–2 business hours.
        </div>
      </div>
    </div>
  `;

  // Step wizard progress indicator
  const progressHtml = '';

  let currentStepFormHtml = '';

  if (state.wireStep === 1) {
    const accountCardsHtml = state.accounts.map(a => {
      const isSelected = state.wireData.accountId === a.id;
      return `
        <div onclick="state.wireData.accountId = '${a.id}'; renderWireTransfer();" style="border: 1px solid ${isSelected ? 'var(--citi-blue)' : 'var(--border)'}; border-radius: 8px; padding: 16px; margin-bottom: 12px; cursor: pointer; background: ${isSelected ? '#f0f7ff' : 'var(--bg-card)'}; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s;">
          <div>
            <div style="font-weight:600; color:var(--citi-navy); font-size: 20px; margin-bottom:4px;">${a.type.charAt(0).toUpperCase() + a.type.slice(1)} Account</div>
            <div style="font-family:monospace; color:var(--text-secondary); font-size: 19px;">*${a.accountNumber.slice(-4)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:var(--citi-navy); font-size: 19px;">${fmtMoney(a.balance, a.currency)}</div>
            <div style="font-size: 18px; color:var(--text-muted);">Available Balance</div>
          </div>
        </div>
      `;
    }).join('');

    currentStepFormHtml = `
      <form id="wire-step-1" novalidate onsubmit="event.preventDefault(); nextWireStep();">
        <h3 style="font-size: 19px; color:var(--citi-blue); margin-bottom:16px; font-weight:600; border-bottom:1px solid var(--border); padding-bottom:8px;">1. Originating Account & Amount</h3>
        
        <div class="form-group">
          <label class="form-label" style="margin-bottom:12px; display:block;">Select Funding Account</label>
          <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; padding-right:10px;">
            ${accountCardsHtml}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Transfer Amount</label>
          <input id="s-amt" type="number" step="0.01" min="1" class="form-input" placeholder="" required value="${state.wireData.amount || ''}">
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:20px;">
          <button type="submit" class="btn btn-primary" style="padding: 10px 24px;">Next &nbsp;➜</button>
        </div>
      </form>
    `;
  } else if (state.wireStep === 2) {
    currentStepFormHtml = `
      <form id="wire-step-2" novalidate onsubmit="event.preventDefault(); nextWireStep();">
        <h3 style="font-size: 19px; color:var(--citi-blue); margin-bottom:16px; font-weight:600; border-bottom:1px solid var(--border); padding-bottom:8px;">2. Beneficiary (Recipient) Details</h3>
        
        <div class="form-group">
          <label class="form-label">Beneficiary Full Name</label>
          <input id="s-recipient-name" type="text" class="form-input" placeholder="" required value="${state.wireData.recipientName || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Street Address</label>
          <input id="s-recipient-addr" type="text" class="form-input" placeholder="" required value="${state.wireData.recipientAddress || ''}">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">State / Province</label>
            <input id="s-recipient-state" type="text" class="form-input" placeholder="" required value="${state.wireData.recipientState || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Zip / Postal Code</label>
            <input id="s-recipient-zip" type="text" class="form-input" placeholder="" required value="${state.wireData.recipientZip || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Country</label>
            <input id="s-recipient-country" type="text" class="form-input" placeholder="" required value="${state.wireData.recipientCountry || ''}">
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="prevWireStep();" style="padding: 10px 24px;">⬅&nbsp; Back</button>
          <button type="submit" class="btn btn-primary" style="padding: 10px 24px;">Next &nbsp;➜</button>
        </div>
      </form>
    `;
  } else if (state.wireStep === 3) {
    currentStepFormHtml = `
      <form id="wire-step-3" novalidate onsubmit="event.preventDefault(); nextWireStep();">
        <h3 style="font-size: 19px; color:var(--citi-blue); margin-bottom:16px; font-weight:600; border-bottom:1px solid var(--border); padding-bottom:8px;">3. Receiving Bank & Memo</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">SWIFT / BIC Code</label>
            <input id="s-swift-code" type="text" class="form-input" placeholder="" maxlength="11" required style="text-transform:uppercase; font-family:monospace;" value="${state.wireData.swiftCode || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">ABA Routing / Sort Code / IBAN</label>
            <input id="s-routing-num" type="text" class="form-input" placeholder="" required style="font-family:monospace;" value="${state.wireData.routingNumber || ''}">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Recipient Account Number</label>
            <input id="s-acc-num" type="text" class="form-input" placeholder="" required style="font-family:monospace;" value="${state.wireData.accountNumber || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Recipient Bank Name</label>
            <input id="s-bank-name" type="text" class="form-input" placeholder="" required value="${state.wireData.bankName || ''}">
          </div>
        </div>

        <div class="form-group" style="margin-top:12px;">
          <label class="form-label">Narrative / Description (For bank statement)</label>
          <input id="s-description" type="text" class="form-input" placeholder="" required value="${state.wireData.description || ''}">
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="prevWireStep();" style="padding: 10px 24px;">⬅&nbsp; Back</button>
          <button type="submit" class="btn btn-primary" style="padding: 10px 24px;">Next &nbsp;➜</button>
        </div>
      </form>
    `;
  } else if (state.wireStep === 4) {
    const fundingAcc = state.accounts.find(a => a.id === state.wireData.accountId);
    currentStepFormHtml = `
      <form id="wire-step-4" onsubmit="event.preventDefault(); handleWireCodeRequest();">
        <h3 style="font-size: 19px; color:var(--citi-blue); margin-bottom:16px; font-weight:600; border-bottom:1px solid var(--border); padding-bottom:8px;">4. Confirmation & Authorization</h3>
        
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size: 19.5px; line-height:1.8;">
            <tr><td style="color:var(--text-secondary); width:35%;">Funding Account:</td><td style="font-weight:600; color:var(--citi-navy);">${fundingAcc?.type.toUpperCase()} (*${fundingAcc?.accountNumber.slice(-4)})</td></tr>
            <tr><td style="color:var(--text-secondary);">Transfer Amount:</td><td style="font-weight:700; color:var(--citi-navy);">${fmtMoney(state.wireData.amount, fundingAcc?.currency || 'USD')}</td></tr>
            <tr><td style="color:var(--text-secondary);">Beneficiary Name:</td><td style="font-weight:600;">${state.wireData.recipientName}</td></tr>
            <tr><td style="color:var(--text-secondary);">Beneficiary Address:</td><td>${state.wireData.recipientAddress}, ${state.wireData.recipientState} ${state.wireData.recipientZip}, ${state.wireData.recipientCountry}</td></tr>
            <tr><td style="color:var(--text-secondary);">Receiving Bank:</td><td>${state.wireData.bankName}</td></tr>
            <tr><td style="color:var(--text-secondary);">SWIFT Code / Routing:</td><td style="font-family:monospace;">${state.wireData.swiftCode} / ${state.wireData.routingNumber}</td></tr>
            <tr><td style="color:var(--text-secondary);">Account Number:</td><td style="font-family:monospace;">${state.wireData.accountNumber}</td></tr>
            <tr><td style="color:var(--text-secondary);">Narrative Memo:</td><td style="font-style:italic;">"${state.wireData.description}"</td></tr>
          </table>
        </div>

        <div style="background:#fffdf5; border:1px solid #ebd382; padding:16px; border-radius:6px; font-size: 19px; color:#744210; line-height:1.5; margin-bottom:20px;">
          <strong>Authorization Notice:</strong> By checking the confirmation box below and proceeding, you authorize Meridian Trust Bank to transmit the specified funds to the designated beneficiary. You certify that this transaction is compliant with international wire transfer regulations.
        </div>

        <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:20px;">
          <input type="checkbox" id="s-authorize-check" style="width:18px; height:18px; margin-top:2px; cursor:pointer;" required>
          <label for="s-authorize-check" style="font-size: 19px; color:var(--text-secondary); cursor:pointer; font-weight:500; line-height:1.4;">
            I confirm that I have reviewed the transaction details above and verify that all beneficiary and routing details are accurate.
          </label>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:20px;">
          <button type="button" class="btn btn-secondary" onclick="prevWireStep();" style="padding: 10px 24px;">⬅&nbsp; Back</button>
          <button type="submit" id="btn-request-code" class="btn btn-primary" style="padding: 10px 24px;">Send Verification Code &nbsp;➜</button>
        </div>
      </form>
    `;
  } else if (state.wireStep === 5) {
    currentStepFormHtml = `
      <form id="wire-step-5" onsubmit="event.preventDefault(); submitWireTransfer();">
        <h3 style="font-size: 19px; color:var(--citi-blue); margin-bottom:16px; font-weight:600; border-bottom:1px solid var(--border); padding-bottom:8px;">5. Security Verification</h3>
        
        <p style="font-size: 19.5px; color:var(--text-secondary); margin-bottom:20px; line-height:1.5; text-align:center;">
          A 6-digit transaction verification code has been dispatched to your registered email address. Enter the code below to finalize authorized transmission.
        </p>

        <div class="form-group" style="text-align:center;">
          <label class="form-label" style="display:block; text-align:center; font-weight:600; margin-bottom:8px;">6-Digit Security Code</label>
          <input type="text" id="s-verification-code" class="form-input" required maxlength="6" placeholder="000000" style="text-align:center; font-size: 26px; letter-spacing:6px; font-family:monospace; max-width:220px; margin:0 auto;" autofocus>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:24px;">
          <button type="button" class="btn btn-secondary" onclick="prevWireStep();" style="padding: 10px 24px;">⬅&nbsp; Back</button>
          <button type="submit" id="btn-submit-wire" class="btn btn-primary" style="padding: 10px 24px;">Authorize & Submit Transfer</button>
        </div>
      </form>
    `;
  } else if (state.wireStep === 6) {
    const fundingAcc = state.accounts.find(a => a.id === state.wireData.accountId);
    const tx = state.wireTxn;
    currentStepFormHtml = `
      <div style="text-align:center; padding:10px 0;">
        <svg class="bank-logo-icon" viewBox="0 0 32 32" width="64" height="64" fill="none" style="margin: 0 auto;">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FFFDF0" />
              <stop offset="15%" stop-color="#FFDF6D" />
              <stop offset="30%" stop-color="#E5A922" />
              <stop offset="50%" stop-color="#FFF5C2" />
              <stop offset="70%" stop-color="#A5750F" />
              <stop offset="100%" stop-color="#4B3300" />
            </linearGradient>
            <linearGradient id="goldHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
              <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
            </linearGradient>
            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="1.5" dy="3.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.5"/>
              <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#001844" flood-opacity="0.25"/>
            </filter>
          </defs>
          <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" fill="#001F5A" filter="url(#goldGlow)"/>
          <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" stroke="url(#goldGrad)" stroke-width="2.5" fill="none" opacity="0.9"/>
          <path d="M16 2.5 L28 6.5 C28 18.5 16 27.5 16 30.5 C16 27.5 4 18.5 4 6.5 Z" stroke="url(#goldHighlight)" stroke-width="1.5" fill="none" opacity="0.6"/>
          <path d="M10.5 21.5 L10.5 11 H12.5 L16 16.5 L19.5 11 H21.5 L21.5 21.5 H19.5 L19.5 14.5 L16.5 19 H15.5 L12.5 14.5 L12.5 21.5 H10.5 Z" fill="url(#goldGrad)" filter="url(#goldGlow)"/>
          <path d="M8 9.5 H24 V11.5 H17 V21.5 H15 V11.5 H8 Z" fill="url(#goldGrad)" filter="url(#goldGlow)"/>
          <path d="M10.5 21.5 L10.5 11 H12.5 L16 16.5 L19.5 11 H21.5 L21.5 21.5 H19.5 L19.5 14.5 L16.5 19 H15.5 L12.5 14.5 L12.5 21.5 H10.5 Z" fill="url(#goldHighlight)" style="mix-blend-mode: overlay;"/>
        </svg>
        <div style="font-family:'Cormorant Garamond',serif; font-size: 26px; font-weight:700; color:var(--citi-navy); margin-top:8px;">Meridian Trust</div>
        
        <div style="width:50px; height:50px; border-radius:50%; background:#e6f4ea; display:flex; align-items:center; justify-content:center; color:#137333; font-size: 26px; margin:20px auto 12px auto; box-shadow:0 2px 8px rgba(19,115,51,0.15);">
          ✔
        </div>
        
        <h3 style="font-size: 22px; color:#137333; font-weight:700; margin-bottom:6px;">Wire Transfer Initiated</h3>
        <p style="font-size: 19px; color:var(--text-secondary); max-width:400px; margin:0 auto 20px auto; line-height:1.5;">
          Your international SWIFT wire transfer request has been successfully submitted and logged. Our operations desk is reviewing the transfer for compliance standards.
        </p>

        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:16px; margin:0 auto 24px auto; max-width:460px; text-align:left;">
          <table style="width:100%; border-collapse:collapse; font-size: 19px; line-height:1.8;">
            <tr><td style="color:var(--text-secondary); width:35%;">Transaction Ref:</td><td style="font-weight:700; font-family:monospace; color:var(--citi-navy);">${tx?.id}</td></tr>
            <tr><td style="color:var(--text-secondary);">Funding Account:</td><td style="font-weight:600;">${fundingAcc?.type.toUpperCase()} (*${fundingAcc?.accountNumber.slice(-4)})</td></tr>
            <tr><td style="color:var(--text-secondary);">Transfer Amount:</td><td style="font-weight:700; color:#002C77;">${fmtMoney(state.wireData.amount, fundingAcc?.currency || 'USD')}</td></tr>
            <tr><td style="color:var(--text-secondary);">Beneficiary:</td><td style="font-weight:600;">${state.wireData.recipientName}</td></tr>
            <tr><td style="color:var(--text-secondary);">Status:</td><td><span style="background:#fff4e5; color:#b25e00; padding:2px 8px; border-radius:4px; font-weight:600; font-size: 17px;">PENDING COMPLIANCE REVIEW</span></td></tr>
          </table>
        </div>

        <div style="display:flex; justify-content:center; gap:12px; margin-top:20px;">
          <button class="btn btn-secondary" onclick="downloadWirePDF('${tx?.id}')" style="padding: 10px 20px;">🖨&nbsp; Download Receipt</button>
          <button class="btn btn-primary" onclick="resetWireWizard(); nav('#/portal/digital-banking/dashboard');" style="padding: 10px 20px;">Done</button>
        </div>
      </div>
    `;
  }

  const formCardHtml = `
    <div class="panel">
      <div class="panel-header"><span class="panel-title">Wire Transfer Form</span></div>
      <div class="panel-body" style="padding:24px;">
        ${progressHtml}
        ${currentStepFormHtml}
      </div>
    </div>
  `;

  setRoot(`
    <div class="app-container transfer-shell">
      <div class="page-header" style="margin-bottom:20px;">
        <div>
          <h2 class="page-greeting">Wire Transfer Form</h2>
          <p class="page-subtext">Manage outbound international wires or view incoming transfer routing instructions.</p>
        </div>
      </div>

      <!-- Tab Toggle buttons group -->
      <div style="display:flex; gap:10px; margin-bottom:24px;">
        <button id="btn-tab-send" class="btn ${currentWireTab === 'send' ? 'btn-primary' : 'btn-ghost'}" onclick="setWireTab('send')" style="padding: 8px 16px; font-size: 19px; font-weight:600;">
          Send Wire Transfer
        </button>
        <button id="btn-tab-details" class="btn ${currentWireTab === 'details' ? 'btn-primary' : 'btn-ghost'}" onclick="setWireTab('details')" style="padding: 8px 16px; font-size: 19px; font-weight:600;">
          Incoming Wire Details
        </button>
      </div>

      <div id="wire-tab-content">
        ${currentWireTab === 'send' ? formCardHtml : detailsHtml}
      </div>
    </div>
  `);
}

window.setWireTab = function(tab) {
  currentWireTab = tab;
  renderWireTransfer();
};

window.nextWireStep = function() {
  const form = document.getElementById('wire-step-' + state.wireStep);
  if (form) {
    const requiredInputs = form.querySelectorAll('input[required], select[required]');
    let hasError = false;
    requiredInputs.forEach(inp => {
      if (!inp.value.trim()) {
        inp.style.border = '2px solid #ef4444';
        inp.style.backgroundColor = '#fdf2f2';
        inp.placeholder = '* Required';
        
        const label = inp.previousElementSibling;
        if (label && label.tagName === 'LABEL' && !label.innerHTML.includes('ef4444')) {
          label.innerHTML += ' <span style="color:#ef4444; font-weight:bold;">*</span>';
        }
        hasError = true;
      } else {
        inp.style.border = '';
        inp.style.backgroundColor = '';
        const label = inp.previousElementSibling;
        if (label && label.tagName === 'LABEL' && label.innerHTML.includes('ef4444')) {
          label.innerHTML = label.innerHTML.replace(' <span style="color:#ef4444; font-weight:bold;">*</span>', '');
        }
      }
    });
    
    if (hasError) {
      toast('Required Fields', 'Please fill in all highlighted fields.', 'error');
      return;
    }
  }

  saveCurrentStepInputs();
  
  if (state.wireStep === 1) {
    const acc = state.accounts.find(a => a.id === state.wireData.accountId);
    const amt = parseFloat(state.wireData.amount);
    if (!acc || isNaN(amt) || amt <= 0) {
      toast('Invalid Input', 'Please enter a valid positive transfer amount.', 'error');
      return;
    }
    if (acc.balance < amt) {
      toast('Transfer Declined', 'Insufficient available balance.', 'error');
      return;
    }
  }

  showLoader('Processing', 'Validating details...');
  setTimeout(() => {
    hideLoader();
    state.wireStep++;
    renderWireTransfer();
  }, 600);
};

window.prevWireStep = function() {
  saveCurrentStepInputs();
  if (state.wireStep > 1) {
    state.wireStep--;
    renderWireTransfer();
  }
};

window.resetWireWizard = function() {
  state.wireStep = 1;
  state.wireData = {
    accountId: state.accounts[0]?.id || '',
    amount: '',
    recipientName: '',
    recipientAddress: '',
    recipientState: '',
    recipientZip: '',
    recipientCountry: '',
    swiftCode: '',
    routingNumber: '',
    accountNumber: '',
    bankName: '',
    description: ''
  };
};

function saveCurrentStepInputs() {
  if (state.wireStep === 1) {
    const accEl = document.getElementById('s-acc');
    const amtEl = document.getElementById('s-amt');
    if (accEl) state.wireData.accountId = accEl.value;
    if (amtEl) state.wireData.amount = amtEl.value;
  } else if (state.wireStep === 2) {
    const nameEl = document.getElementById('s-recipient-name');
    const addrEl = document.getElementById('s-recipient-addr');
    const stateEl = document.getElementById('s-recipient-state');
    const zipEl = document.getElementById('s-recipient-zip');
    const countryEl = document.getElementById('s-recipient-country');
    if (nameEl) state.wireData.recipientName = nameEl.value;
    if (addrEl) state.wireData.recipientAddress = addrEl.value;
    if (stateEl) state.wireData.recipientState = stateEl.value;
    if (zipEl) state.wireData.recipientZip = zipEl.value;
    if (countryEl) state.wireData.recipientCountry = countryEl.value;
  } else if (state.wireStep === 3) {
    const swiftEl = document.getElementById('s-swift-code');
    const routEl = document.getElementById('s-routing-num');
    const accNumEl = document.getElementById('s-acc-num');
    const bankEl = document.getElementById('s-bank-name');
    const descEl = document.getElementById('s-description');
    
    if (swiftEl) state.wireData.swiftCode = swiftEl.value;
    if (routEl) state.wireData.routingNumber = routEl.value;
    if (accNumEl) state.wireData.accountNumber = accNumEl.value;
    if (bankEl) state.wireData.bankName = bankEl.value;
    if (descEl) state.wireData.description = descEl.value;
  }
}

window.handleWireCodeRequest = async function() {
  const checkEl = document.getElementById('s-authorize-check');
  if (!checkEl || !checkEl.checked) {
    toast('Confirmation Required', 'Please check the confirmation box to authorize this wire transfer.', 'error');
    return;
  }

  const btn = document.getElementById('btn-request-code');
  if (btn) { btn.disabled = true; btn.textContent = 'Requesting Code…'; }
  showLoader('Requesting Code', 'Requesting outbound transfer verification code from security server...');

  try {
    await api('/api/transactions/request-code', { userId: state.user.id });
    hideLoader();
    state.wireStep = 5;
    renderWireTransfer();
  } catch (err) {
    hideLoader();
    toast('Request Failed', err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Verification Code ➜'; }
  }
};

window.submitWireTransfer = async function() {
  const codeEl = document.getElementById('s-verification-code');
  const verificationCode = codeEl ? codeEl.value : '';
  if (verificationCode.length !== 6) {
    toast('Verification Failed', 'Code must be exactly 6 digits.', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-wire');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting Wire…'; }
  
  const acc = state.accounts.find(a => a.id === state.wireData.accountId);
  const amt = parseFloat(state.wireData.amount);

  showLoader('Transmitting SWIFT Wire', `Routing ${fmtMoney(amt, acc?.currency || 'USD')} out to international clearing systems…`);

  try {
    const res = await api('/api/transactions/send', {
      userId: state.user.id,
      accountId: state.wireData.accountId,
      amount: amt,
      currency: acc?.currency || 'USD',
      recipientName: state.wireData.recipientName,
      recipientAddress: state.wireData.recipientAddress,
      recipientBank: state.wireData.bankName,
      swiftCode: state.wireData.swiftCode.toUpperCase(),
      routingNumber: state.wireData.routingNumber,
      accountNumber: state.wireData.accountNumber,
      description: state.wireData.description,
      verificationCode
    });

    hideLoader();
    state.wireTxn = res.transaction;
    state.accounts = []; // clear cache to force refresh balances
    state.wireStep = 6;
    renderWireTransfer();
  } catch (err) {
    hideLoader();
    toast('Transfer Failed', err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Authorize & Submit Transfer'; }
  }
};

// ── Intrabank Account Transfer Module ──────────────────────────────────────────
async function loadIntrabankTransfer() {
  if (!state.accounts.length) {
    const accounts = await api(`/api/accounts?userId=${state.user.id}`);
    state.accounts = accounts;
  }
  renderIntrabankTransfer();
}

function renderIntrabankTransfer() {
  const fromOpts = state.accounts.map(a =>
    `<option value="${a.id}">${a.type.charAt(0).toUpperCase()+a.type.slice(1)} Account (*${a.accountNumber.slice(-4)}) — ${fmtMoney(a.balance, a.currency)}</option>`
  ).join('');

  const toOpts = state.accounts.map(a =>
    `<option value="${a.id}">${a.type.charAt(0).toUpperCase()+a.type.slice(1)} Account (*${a.accountNumber.slice(-4)}) — ${fmtMoney(a.balance, a.currency)}</option>`
  ).join('');

  setRoot(`
    <div class="app-container">
      <div class="page-header" style="margin-bottom:24px;">
        <div class="page-header-inner">
          <div style="flex:1;">
            <h2 class="page-greeting" style="font-family:'Cormorant Garamond',serif; font-size: 34px; font-weight:700; color:var(--citi-navy);">Intrabank Account Transfer</h2>
            <p class="page-subtext">Transfer funds instantly between your Checking, Savings, or Money Market accounts.</p>
          </div>
        </div>
      </div>

      <div style="max-width: 600px; margin: 0 auto;">
        <div class="panel">
          <div class="panel-header"><span class="panel-title">Transfer Parameters</span></div>
          <div class="panel-body" style="padding:24px;">
            <form id="intrabank-form" onsubmit="handleIntrabankTransfer(event)">
              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label" style="font-weight:600; color:var(--text-secondary); margin-bottom:8px; display:block;">Transfer From (Source Account)</label>
                <select id="t-from-acc" class="form-select" onchange="updateIntrabankToOptions()" style="width:100%;">${fromOpts}</select>
              </div>

              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label" style="font-weight:600; color:var(--text-secondary); margin-bottom:8px; display:block;">Transfer To (Destination Account)</label>
                <select id="t-to-acc" class="form-select" style="width:100%;">${toOpts}</select>
              </div>

              <div class="form-group" style="margin-bottom: 24px;">
                <label class="form-label" style="font-weight:600; color:var(--text-secondary); margin-bottom:8px; display:block;">Transfer Amount (USD)</label>
                <input id="t-amount" type="number" step="0.01" min="0.01" class="form-input" placeholder="0.00" required style="width:100%;">
              </div>

              <button type="submit" class="btn btn-primary btn-full" style="padding:12px; font-weight:600; font-size: 20px; width:100%;">
                Execute Instant Transfer
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `);

  updateIntrabankToOptions();
}

window.updateIntrabankToOptions = function() {
  const fromSelect = document.getElementById('t-from-acc');
  const toSelect = document.getElementById('t-to-acc');
  if (!fromSelect || !toSelect) return;
  const selectedFrom = fromSelect.value;
  
  const currentToVal = toSelect.value;
  toSelect.innerHTML = state.accounts
    .filter(a => a.id !== selectedFrom)
    .map(a => `<option value="${a.id}">${a.type.charAt(0).toUpperCase()+a.type.slice(1)} Account (*${a.accountNumber.slice(-4)}) — ${fmtMoney(a.balance, a.currency)}</option>`)
    .join('');
  
  if (currentToVal && currentToVal !== selectedFrom) {
    toSelect.value = currentToVal;
  }
};

async function handleIntrabankTransfer(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Processing…';

  const fromAccId = v('t-from-acc');
  const toAccId   = v('t-to-acc');
  const amt       = parseFloat(v('t-amount'));

  const fromAcc = state.accounts.find(a => a.id === fromAccId);
  if (!fromAcc || fromAcc.balance < amt) {
    toast('Transfer Failed', 'Insufficient available balance in originating account.', 'error');
    btn.disabled = false; btn.textContent = 'Execute Instant Transfer';
    return;
  }

  showLoader('Authorizing Transfer', 'Routing cross-balance ledger adjustments…');

  try {
    await api('/api/transactions/intrabank-transfer', {
      userId: state.user.id,
      fromAccountId: fromAccId,
      toAccountId: toAccId,
      amount: amt
    });

    const accounts = await api(`/api/accounts?userId=${state.user.id}`);
    state.accounts = accounts;

    hideLoader();
    toast('Transfer Successful', `Transferred ${fmtMoney(amt, 'USD')} successfully.`, 'success');
    nav('#/portal/digital-banking/dashboard');
  } catch (err) {
    hideLoader();
    toast('Transfer Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Execute Instant Transfer';
  }
}

// ── EVENT HANDLERS ────────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  if (!validateForm('login-form')) {
    return;
  }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Connecting…';
  
  showLoader('Authenticating Credentials', 'Establishing secure session with Meridian Trust offshore ledger…');

  const startTime = Date.now();
  try {
    const data = await api('/api/auth/login', { userId: v('f-uid'), password: v('f-pwd') });
    
    // Ensure loader shows for at least 1.5 seconds for premium effect
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 1500 - elapsed);
    
    if (data.requires2FA) {
      setTimeout(() => {
        hideLoader();
        renderLogin2FA(data.userId);
      }, delay);
      return;
    }

    setTimeout(() => {
      hideLoader();
      state.user = data.user;
      localStorage.setItem('mtb_session', JSON.stringify(state.user));
      toast('Session Authenticated', `Welcome, ${data.user.name}.`, 'success');
      nav('#/dashboard');
    }, delay);
  } catch (err) {
    hideLoader();
    toast('Authentication Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Authenticate Session';
  }
}

function renderLogin2FA(userId) {
  setRoot(`
    <div class="auth-shell">
      <div class="auth-card" style="max-width:420px;">
        <div class="auth-card-header" style="text-align:center;">
          <h1 class="auth-title">Security Verification</h1>
          <p class="auth-subtitle" style="font-size: 18.5px;line-height:1.5;">A 6-digit verification code has been dispatched to your registered email address.</p>
        </div>
        <div class="auth-card-body">
          <form onsubmit="handleLogin2FASubmit(event, '${userId}')">
            <div class="form-group">
              <label class="form-label">MFA Verification Code</label>
              <input type="text" id="login-2fa-code" class="form-input" required maxlength="6" placeholder="000000" style="text-align:center;font-size: 24px;letter-spacing:6px;font-family:monospace;" autofocus>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:12px;">Confirm Sign-In</button>
          </form>
        </div>
      </div>
    </div>
  `);
}

async function handleLogin2FASubmit(e, userId) {
  e.preventDefault();
  const code = v('login-2fa-code');
  if (code.length !== 6) {
    toast('Invalid Code', 'The verification code must be exactly 6 digits.', 'error');
    return;
  }

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Confirming…';

  showLoader('Verifying Code', 'Checking secure authentication parameters…');

  const startTime = Date.now();
  try {
    const data = await api('/api/auth/verify-login-2fa', { userId, code });
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 1500 - elapsed);

    setTimeout(() => {
      hideLoader();
      state.user = data.user;
      localStorage.setItem('mtb_session', JSON.stringify(state.user));
      toast('Session Authenticated', `Welcome back, ${data.user.name}.`, 'success');
      nav('#/dashboard');
    }, delay);
  } catch (err) {
    hideLoader();
    toast('Verification Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Confirm Sign-In';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Submitting…';
  
  showLoader('Processing Application', 'Verifying tax identification and provisioning offshore bank accounts…');

  const startTime = Date.now();
  try {
    const payload = {
      ...state.regData,
      ssn: document.getElementById('r-ssn').value
    };
    const data = await api('/api/auth/register-submit', payload);
    state.regData = {}; // Clear form memory
    
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 1500 - elapsed);
    
    setTimeout(() => {
      hideLoader();
      toast('Application Submitted', 'Your registration is under review.', 'success');
      renderRegistrationSuccess(payload.email);
    }, delay);
  } catch (err) {
    hideLoader();
    toast('Application Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Submit Application';
  }
}

function showPasswordChangeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.add('show');

  let modal = document.getElementById('password-change-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'password-change-modal';
    modal.className = 'modal-box show';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title" style="color:var(--citi-navy);font-weight:700;">Passcode Update Required</h3>
    </div>
    <div class="modal-body">
      <p style="font-size: 18.5px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
        As a security protocol, first-time users must replace their system-assigned passcode before accessing the private banking dashboard.
      </p>
      <form id="pwd-change-form" onsubmit="handlePasswordChangeSubmit(event)">
        <div class="form-group">
          <label class="form-label">Temporary Passcode</label>
          <input type="password" id="p-old" class="form-input" required placeholder="Enter temporary passcode">
        </div>
        <div class="form-group">
          <label class="form-label">New Secure Passcode</label>
          <input type="password" id="p-new" class="form-input" required placeholder="Min 8 chars, A-Z, 0-9, and symbols">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm New Passcode</label>
          <input type="password" id="p-confirm" class="form-input" required placeholder="Retype new passcode">
        </div>
        <button type="submit" class="btn btn-primary btn-full" style="margin-top:12px;">Modify Secure Passcode</button>
      </form>
    </div>
  `;
}

async function handlePasswordChangeSubmit(e) {
  e.preventDefault();
  const oldPassword = v('p-old');
  const newPassword = v('p-new');
  const confirmPassword = v('p-confirm');

  // Strength check rules
  const hasCapital = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

  if (newPassword.length < 8) {
    toast('Weak Passcode', 'The new passcode must be at least 8 characters in length.', 'error');
    return;
  }
  if (!hasCapital || !hasNumber || !hasSpecial) {
    toast('Weak Passcode', 'Your passcode must contain at least one capital letter (A-Z), one number (0-9), and one special character (e.g. !, @, #, etc.).', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    toast('Passcode Mismatch', 'The confirmed passcode does not match.', 'error');
    return;
  }

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Updating…';

  showLoader('Modifying Passcode', 'Updating credential record and generating new AES-256 session keys…');

  const startTime = Date.now();
  try {
    await api('/api/auth/change-password', {
      userId: state.user.id,
      oldPassword,
      newPassword
    });

    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 1500 - elapsed);

    setTimeout(() => {
      hideLoader();
      toast('Passcode Changed', 'Your security passcode has been successfully updated.', 'success');

      // Update session state
      state.user.mustChangePassword = false;
      localStorage.setItem('mtb_session', JSON.stringify(state.user));

      // Cleanup modal UI
      document.getElementById('password-change-modal')?.remove();
      document.getElementById('modal-overlay')?.classList.remove('show');

      // Reload the dashboard fully
      loadDashboard();
    }, delay);
  } catch (err) {
    hideLoader();
    toast('Update Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Modify Secure Passcode';
  }
}

function openWire2FAModal(onConfirm) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  
  let modal = document.getElementById('wire-2fa-modal');
  if (modal) modal.remove();
  
  modal = document.createElement('div');
  modal.id = 'wire-2fa-modal';
  modal.className = 'modal-box';
  modal.style.zIndex = '1001';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title" style="color:var(--citi-navy);font-weight:700;">Security Verification</h3>
      <button class="modal-close-btn" onclick="closeWire2FAModal()">&times;</button>
    </div>
    <div class="modal-body">
      <p style="font-size: 18.5px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
        Enter the 6-digit security verification code sent to your registered email to authorize this outbound transaction.
      </p>
      <form id="wire-2fa-form">
        <div class="form-group">
          <label class="form-label">6-Digit Code</label>
          <input type="text" id="wire-2fa-code" class="form-input" required maxlength="6" placeholder="000000" style="text-align:center;font-size: 24px;letter-spacing:6px;font-family:monospace;" autofocus>
        </div>
        <button type="submit" class="btn btn-primary btn-full" style="margin-top:12px;">Authorize SWIFT Transfer</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  overlay.classList.add('show');

  document.getElementById('wire-2fa-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('wire-2fa-code').value;
    if (code.length !== 6) {
      toast('Verification Failed', 'Code must be exactly 6 digits.', 'error');
      return;
    }
    closeWire2FAModal();
    onConfirm(code);
  });
}

function closeWire2FAModal() {
  document.getElementById('wire-2fa-modal')?.remove();
  document.getElementById('modal-overlay')?.classList.remove('show');
}

function showTransactionDetails(txnId) {
  const txn = state.transactions.find(t => t.id === txnId);
  if (!txn) return;

  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.add('show');

  let modal = document.getElementById('txn-details-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'txn-details-modal';
  modal.className = 'modal-box';
  modal.style.display = 'block';
  modal.style.maxWidth = '550px';

  const isWire = txn.type === 'TRANSFER_OUT';
  const swift = txn.swiftDetails || {};

  let swiftHtml = '';
  if (isWire && swift.recipientBank) {
    swiftHtml = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:18px; margin-top:18px;">
        <h4 style="margin:0 0 12px 0; color:var(--citi-navy); font-size: 20px; text-transform:uppercase; letter-spacing:0.06em;">SWIFT Routing Details</h4>
        <table style="width:100%; font-size: 20px; border-collapse:collapse;">
          <tr><td style="padding:8px 0; color:var(--text-muted);">Beneficiary Bank:</td><td style="padding:8px 0; font-weight:600; text-align:right;">${swift.recipientBank}</td></tr>
          <tr><td style="padding:8px 0; color:var(--text-muted);">SWIFT / BIC Code:</td><td style="padding:8px 0; font-weight:600; text-align:right; font-family:monospace;">${swift.swiftCode}</td></tr>
          <tr><td style="padding:8px 0; color:var(--text-muted);">Routing / Sort Code:</td><td style="padding:8px 0; font-weight:600; text-align:right; font-family:monospace;">${swift.routingNumber || 'N/A'}</td></tr>
          <tr><td style="padding:8px 0; color:var(--text-muted);">Beneficiary Account:</td><td style="padding:8px 0; font-weight:600; text-align:right; font-family:monospace;">${swift.accountNumber}</td></tr>
          <tr><td style="padding:8px 0; color:var(--text-muted);">Beneficiary Address:</td><td style="padding:8px 0; font-weight:600; text-align:right;">${swift.recipientAddress || 'N/A'}</td></tr>
        </table>
      </div>
    `;
  }

  let pdfButtonHtml = '';
  if (txn.status === 'COMPLETED') {
    pdfButtonHtml = `
      <button class="btn btn-primary btn-full" style="margin-top:16px;" onclick="downloadWirePDF('${txn.id}')">
        Download Receipt
      </button>
    `;
  } else if (isWire && txn.status === 'PENDING') {
    pdfButtonHtml = `
      <div style="background:#fff7ed; border:1px solid #ffedd5; color:#c2410c; padding:12px; border-radius:6px; font-size: 19px; text-align:center; font-weight:500; margin-top:16px;">
        ⏳ Outbound wire transfer is pending administrative clearance. advice PDF will be available upon approval.
      </div>
    `;
  }

  const txnDateObj = new Date(txn.date);
  const displayTxnId = `MTB-TRX-${txn.id.split('-')[0]?.toUpperCase()}-${txnDateObj.getTime().toString().slice(-6)}`;

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title" style="color:var(--citi-navy); font-weight:700;">Transaction Details</h3>
      <button class="modal-close-btn" onclick="closeTransactionDetails()">&times;</button>
    </div>
    <div class="modal-body" style="padding-top:12px;">
      <table style="width:100%; font-size: 20px; border-collapse:collapse; margin-bottom:18px;">
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 0; color:var(--text-muted);">Reference ID:</td><td style="padding:12px 0; font-weight:700; text-align:right; font-family:monospace;">${displayTxnId}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 0; color:var(--text-muted);">Original Ref:</td><td style="padding:12px 0; font-weight:500; text-align:right; font-family:monospace; font-size: 18px; color:#888;">${txn.id}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 0; color:var(--text-muted);">Description:</td><td style="padding:12px 0; font-weight:600; text-align:right;">${txn.description}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 0; color:var(--text-muted);">Counterparty:</td><td style="padding:12px 0; font-weight:600; text-align:right;">${txn.counterparty}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 0; color:var(--text-muted);">Value Date:</td><td style="padding:12px 0; font-weight:600; text-align:right;">${fmtDateTime(txn.date)}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 0; color:var(--text-muted);">Transfer Mode:</td><td style="padding:12px 0; font-weight:600; text-align:right; color:var(--citi-navy);">${isWire ? 'SWIFT International Wire' : 'Internal / Domestic ACH'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:12px 0; color:var(--text-muted);">Settlement Status:</td><td style="padding:12px 0; text-align:right;"><span class="status-pill ${txn.status}">${txn.status}</span></td></tr>
        <tr><td style="padding:12px 0; color:var(--text-muted); font-weight:600;">Settled Amount:</td><td style="padding:12px 0; font-weight:700; text-align:right; color:${txn.type==='DEPOSIT'?'#16a34a':'#b91c1c'}; font-size: 24px;">${txn.type==='DEPOSIT'?'+':'−'}${fmtMoney(txn.amount, txn.currency)}</td></tr>
      </table>
      ${swiftHtml}
      ${pdfButtonHtml}
    </div>
  `;
  document.body.appendChild(modal);
}

function closeTransactionDetails() {
  document.getElementById('txn-details-modal')?.remove();
  document.getElementById('modal-overlay')?.classList.remove('show');
}

function downloadWirePDF(txnId) {
  const txn = state.transactions.find(t => t.id === txnId);
  if (!txn) return;

  const isWire = txn.type === 'TRANSFER_OUT';
  const swift = txn.swiftDetails || {};
  const optEl = document.createElement('div');
  optEl.style.position = 'fixed';
  optEl.style.left = '-9999px';
  optEl.style.top = '0';
  optEl.style.width = '7.5in';
  optEl.style.padding = '30px';
  optEl.style.background = '#ffffff';
  optEl.style.color = '#0c1a30';
  optEl.style.fontFamily = "'DM Sans', sans-serif";
  document.body.appendChild(optEl);

  // Format date and time
  const txnDate = new Date(txn.date);
  const displayTxnId = `MTB-TRX-${txn.id.split('-')[0]?.toUpperCase()}-${txnDate.getTime().toString().slice(-6)}`;
  const formattedDate = txnDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = txnDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });

  let specSectionHtml = '';
  if (isWire) {
    specSectionHtml = `
      <!-- SWIFT Routing details -->
      <h3 style="font-size: 19px; text-transform:uppercase; color:#002C77; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin:22px 0 10px 0; letter-spacing:0.5px;">SWIFT MT103 Specifications</h3>
      <table style="width:100%; border-collapse:collapse; font-size: 19.5px; line-height:1.7;">
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="width:35%; padding:4px 0; color:#555;">Beneficiary Customer Name:</td><td style="padding:4px 0; font-weight:600;">${txn.counterparty}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; font-weight:600;">Beneficiary Bank Name:</td><td style="padding:4px 0; font-weight:600;">${swift.recipientBank || 'N/A'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; color:#555;">SWIFT / BIC Identifier:</td><td style="padding:4px 0; font-weight:600; font-family:monospace; color:#002C77;">${swift.swiftCode || 'N/A'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; font-weight:600; font-family:monospace;">${swift.routingNumber || 'N/A'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; color:#555;">Beneficiary Account Number:</td><td style="padding:4px 0; font-weight:600; font-family:monospace;">${swift.accountNumber || 'N/A'}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; color:#555;">Beneficiary Destination Address:</td><td style="padding:4px 0; font-weight:600;">${swift.recipientAddress || 'N/A'}</td></tr>
      </table>
    `;
  } else {
    specSectionHtml = `
      <!-- Settlement specifications -->
      <h3 style="font-size: 19px; text-transform:uppercase; color:#002C77; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin:22px 0 10px 0; letter-spacing:0.5px;">Settlement Specifications</h3>
      <table style="width:100%; border-collapse:collapse; font-size: 19.5px; line-height:1.7;">
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="width:35%; padding:4px 0; color:#555;">Originating Institution:</td><td style="padding:4px 0; font-weight:600;">${txn.counterparty}</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; color:#555;">Receiving Institution:</td><td style="padding:4px 0; font-weight:600;">Meridian Trust Bank</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; color:#555;">Settlement Channel:</td><td style="padding:4px 0; font-weight:600; font-family:monospace;">FEDWIRE / SWIFT INBOUND CLEARING</td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0; color:#555;">Transaction Status:</td><td style="padding:4px 0; font-weight:600; color:#137333;">COMPLETED & SETTLED</td></tr>
      </table>
    `;
  }

  optEl.innerHTML = `
    <!-- Header / Letterhead -->
    <div style="border-bottom:3px solid #002C77; padding-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center;">
        <svg viewBox="0 0 32 32" width="40" height="40" fill="none" style="margin-right:12px; display:inline-block; vertical-align:middle;">
          <path d="M16 3.5 L27 6.5 C27 17.5 16 25.5 16 28.5 C16 25.5 5 17.5 5 6.5 Z" stroke="#D4AF37" stroke-width="1.2" fill="#002C77" fill-opacity="0.05"/>
          <path d="M16 5 L25.5 7.5 C25.5 16.5 16 23.5 16 26.2 C16 23.5 6.5 16.5 6.5 7.5 Z" stroke="#D4AF37" stroke-width="0.5" stroke-dasharray="1.5 1.5"/>
          <ellipse cx="16" cy="16.5" rx="9" ry="3.5" stroke="#D4AF37" stroke-width="0.4" fill="none"/>
          <path d="M16 5 C19.5 9 19.5 24 16 26.2" stroke="#D4AF37" stroke-width="0.4" fill="none"/>
          <path d="M16 5 C12.5 9 12.5 24 16 26.2" stroke="#D4AF37" stroke-width="0.4" fill="none"/>
          <path d="M7 16.5 H25" stroke="#D4AF37" stroke-width="0.4"/>
          <path d="M16 5 V26.2" stroke="#D4AF37" stroke-width="0.4"/>
          <path d="M11 21 L11 12 H12.5 L16 17 L19.5 12 H21 L21 21 H19.5 L19.5 14 L16.5 18 H15.5 L12.5 14 L12.5 21 H11 Z" fill="#D4AF37"/>
          <path d="M9 10 H23 V12.2 H16.8 V21 H15.2 V12.2 H9 Z" fill="#D4AF37"/>
          <path d="M16 11.5 L17.5 13 L16 14.5 L14.5 13 Z" fill="#FFFFFF"/>
        </svg>
        <div>
          <h1 style="color:#002C77; margin:0; font-size: 24px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;">MERIDIAN TRUST BANK</h1>
          <div style="font-size: 15px; color:#a47c14; text-transform:uppercase; letter-spacing:1px; margin-top:2px; font-weight:700;">International Private Banking</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size: 16px; font-weight:700; color:#555; text-transform:uppercase;">Official Transaction Receipt</div>
        <div style="font-size: 17.5px; font-family:monospace; font-weight:700; color:#002C77; margin-top:2px;">TXN-ID: ${displayTxnId}</div>
      </div>
    </div>

    <!-- Status Alert Bar -->
    <div style="margin-top:16px; background:#e6f4ea; border-left:4px solid #137333; padding:10px 14px; color:#137333; border-radius:0 4px 4px 0; font-size: 18px; font-weight:600;">
      ✔ TRANSACTION COMPLETED — LEDGER ACCREDITED AND AUDITED SUCCESSFULLY.
    </div>

    <!-- Core Details Table -->
    <h3 style="font-size: 19px; text-transform:uppercase; color:#002C77; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin:20px 0 10px 0; letter-spacing:0.5px;">Transfer Summary</h3>
    <table style="width:100%; border-collapse:collapse; font-size: 19.5px; line-height:1.7;">
      <tr><td style="width:35%; padding:3px 0; color:#555;">Transaction ID:</td><td style="padding:3px 0; font-weight:700; font-family:monospace; color:#002C77;">${displayTxnId}</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Value Date:</td><td style="padding:3px 0; font-weight:600;">${formattedDate}</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Transaction Time:</td><td style="padding:3px 0; font-weight:600;">${formattedTime} (UTC)</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Mode of Transfer:</td><td style="padding:3px 0; font-weight:600;">${isWire ? 'SWIFT International Wire Transfer (MT103)' : 'Internal / Domestic ACH'}</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Settlement Currency:</td><td style="padding:3px 0; font-weight:600;">${txn.currency || 'USD'}</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Ordering Customer ID:</td><td style="padding:3px 0; font-weight:600; font-family:monospace;">${txn.userId}</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Sending Account:</td><td style="padding:3px 0; font-weight:600;">Offshore Private Placement Treasury (USD equivalent)</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Memo / Reference:</td><td style="padding:3px 0; font-weight:600;">${txn.description}</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Original System Ref:</td><td style="padding:3px 0; font-weight:500; font-family:monospace; font-size: 17px; color:#888;">${txn.id}</td></tr>
      <tr><td style="padding:3px 0; color:#555;">Settled Net Amount:</td><td style="padding:3px 0; font-weight:800; font-size: 20px; color:#002C77;">${fmtMoney(txn.amount, txn.currency)}</td></tr>
    </table>

    ${specSectionHtml}

    <!-- Sign-off / Compliance Seals -->
    <div style="margin-top:24px; border-top:1px solid #e2e8f0; padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size: 16px; font-weight:700; color:#002C77; text-transform:uppercase;">Security Compliance Audit</div>
        <div style="font-size: 15px; color:#777; margin-top:2px;">Digital Cryptographic Seal: AES-256 System Authenticated</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size: 16px; font-weight:700; color:#137333; text-transform:uppercase;">STATUS: COMPLETED & AUDITED</div>
        <div style="font-size: 15px; color:#777; margin-top:2px;">Funds Transmitted Under Sovereign reserve protection.</div>
      </div>
    </div>

    <!-- Reporting & Cancellation Support Desk -->
    <div style="margin-top:24px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:16px; font-size: 17.5px; color:#475569; line-height:1.5;">
      <strong>Support & Cancellation Operations Desk:</strong> For wire retroactive inquiries, reporting unauthorized movements, or requesting wire cancellations, please email us immediately at <a href="mailto:operations@meridiantrust.com" style="color:#0066CC; text-decoration:none; font-weight:600;">operations@meridiantrust.com</a>. Wire cancellation requests must be filed with our compliance desk within 1 hour of the transfer value date/time.
    </div>
  `;

  const opt = {
    margin:       [0.4, 0.4, 0.4, 0.4],
    filename:     `Meridian_Trust_Wire_Receipt_${txn.id}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(optEl).save().then(() => {
    optEl.remove();
  }).catch(() => {
    optEl.remove();
  });
}

// Old handleSend function removed.

function logout() {
  showCustomModal(
    'Are you ready to sign out?',
    '<p style="margin:0; font-size: 19px; color:var(--text-secondary); line-height:1.5;">Please confirm if you are ready to secure and terminate your active banking session. Any unsaved actions will be discarded.</p>',
    () => {
      state = { user: null, accounts: [], transactions: [], cards: [], adminUsers: [], pendingEmail: null, devOtp: null };
      localStorage.removeItem('mtb_session');
      toast('Signed Out', 'Your secure session has been terminated.', 'info');
      nav('#/portal/client-auth/login');
    },
    null,
    'Sign Out',
    'Cancel'
  );
}

// Toggle Card (freeze/unfreeze)
async function toggleCard(cardId) {
  try {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    const newStatus = card.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN';
    await api('/api/cards/toggle', { cardId, status: newStatus, userId: state.user.id });
    card.status = newStatus;
    toast('Card Updated', `Card ending ••${card.cardNumber.slice(-4)} is now ${newStatus}.`, 'success');
    renderDashboard();
  } catch (err) {
    toast('Card Action Failed', err.message, 'error');
  }
}

// Issue Virtual Card
async function issueVirtualCard() {
  try {
    showLoader('Issuing Card', 'Generating virtual card credentials...');
    await api('/api/cards/issue', { userId: state.user.id });
    const cards = await api(`/api/cards?userId=${state.user.id}`);
    state.cards = cards;
    hideLoader();
    toast('Card Issued', 'A new virtual card has been provisioned.', 'success');
    renderDashboard();
  } catch (err) {
    hideLoader();
    toast('Card Issue Failed', err.message, 'error');
  }
}

// FX Exchange Page
async function loadExchange() {
  if (!state.accounts.length) {
    const accounts = await api(`/api/accounts?userId=${state.user.id}`);
    state.accounts = accounts;
  }

  const fromOpts = state.accounts.map(a =>
    `<option value="${a.id}">${a.type.charAt(0).toUpperCase()+a.type.slice(1)} (${a.currency}) — ${fmtMoney(a.balance, a.currency)}</option>`
  ).join('');

  const toOpts = state.accounts.map(a =>
    `<option value="${a.id}">${a.type.charAt(0).toUpperCase()+a.type.slice(1)} (${a.currency}) — ${fmtMoney(a.balance, a.currency)}</option>`
  ).join('');

  setRoot(`
    <div class="app-container exchange-shell">
      <div class="page-header">
        <div>
          <h2 class="page-greeting">Interbank FX Conversion</h2>
          <p class="page-subtext">Exchange balances between your multi-currency accounts at estimated wholesale rates.</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Currency Exchange</span></div>
        <div class="panel-body">
          <form id="exchange-form" onsubmit="handleExchange(event)">
            <div class="form-group">
              <label class="form-label">From Account</label>
              <select id="ex-from" class="form-select">${fromOpts}</select>
            </div>
            <div class="form-group">
              <label class="form-label">To Account</label>
              <select id="ex-to" class="form-select">${toOpts}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Amount to Convert</label>
              <input id="ex-amt" type="number" step="0.01" min="1" class="form-input" placeholder="0.00" required>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:12px;">Execute FX Conversion</button>
          </form>
        </div>
      </div>
    </div>
  `);
}

async function handleExchange(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Converting…';

  const fromId = v('ex-from');
  const toId = v('ex-to');
  const amount = parseFloat(v('ex-amt'));

  if (fromId === toId) {
    toast('Exchange Error', 'Source and destination accounts must be different.', 'error');
    btn.disabled = false; btn.textContent = 'Execute FX Conversion';
    return;
  }

  showLoader('Converting Currency', 'Executing interbank FX conversion at wholesale rates…');

  try {
    await api('/api/transactions/exchange', { userId: state.user.id, fromAccountId: fromId, toAccountId: toId, amount });
    hideLoader();
    toast('FX Conversion Complete', `Successfully converted ${fmtMoney(amount, state.accounts.find(a=>a.id===fromId)?.currency || 'USD')}.`, 'success');
    state.accounts = [];
    nav('#/dashboard');
  } catch (err) {
    hideLoader();
    toast('Conversion Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Execute FX Conversion';
  }
}

// Products & Programs View
function renderProducts() {
  setRoot(`
    <div class="app-container">
      <div class="panel" style="margin-bottom:32px;">
        <div class="panel-header" style="background:#002C77;color:#fff;">
          <h2 class="panel-title" style="color:#fff;font-size: 20px;letter-spacing:0.05em;">Meridian Offshore Accounts & Programs</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:12px 18px;margin-bottom:24px;border-radius:4px;font-size: 19.5px;color:#991b1b;font-weight:600;">
            ⚠️ Simulated System Notice: The ledger account systems, credit limits, card placements, and balances presented here are part of a private banking digital simulation. No real funds are held or processed.
          </div>
          
          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Offshore Checking Programs</h3>
          <p style="margin-bottom:20px;font-size: 20px;color:#475569;">Our flagship checking program is designed for private corporate entities and high-net-worth individuals requiring immediate global liquidity. Key features include:</p>
          <ul style="padding-left:20px;margin-bottom:24px;font-size: 19.5px;color:#475569;line-height:1.8;">
            <li style="margin-bottom:6px;"><strong>Full-Reserve Auditing:</strong> Checking balances are verified and credited manually via secure ledger operators.</li>
            <li style="margin-bottom:6px;"><strong>SWIFT Settlement Routing:</strong> Seamless processing parameters matching international routing codes.</li>
            <li style="margin-bottom:6px;"><strong>Real-Time Ledger Audits:</strong> Instant balance adjustments and manual deposit credits via secure operators.</li>
          </ul>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">High-Yield Savings & Money Markets</h3>
          <p style="margin-bottom:20px;font-size: 20px;color:#475569;">For asset placements and reserve preservation, our savings and capital market programs offer fixed returns and structured ledger protection, yielding full capital backing across sovereign instruments.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Offshore Debit Cards & Virtual Programs</h3>
          <p style="margin-bottom:12px;font-size: 20px;color:#475569;">Manage corporate spending instantly with our debit card suite. Operators can issue cards, toggle status (active, frozen, cancelled), and view CVV/expiry details directly inside the portal.</p>
        </div>
      </div>
    </div>
  `);
}

// Services View
function renderServices() {
  setRoot(`
    <div class="app-container">
      <div class="panel" style="margin-bottom:32px;">
        <div class="panel-header" style="background:#002C77;color:#fff;">
          <h2 class="panel-title" style="color:#fff;font-size: 20px;letter-spacing:0.05em;">Core Banking Services</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:12px 18px;margin-bottom:24px;border-radius:4px;font-size: 19.5px;color:#991b1b;font-weight:600;">
            ⚠️ Simulated System Notice: All transfer routing and FX rates displayed on this platform are part of a private ledger simulation.
          </div>
          
          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Outbound SWIFT Wire Transfers</h3>
          <p style="margin-bottom:20px;font-size: 20px;color:#475569;">Submit international wire transfers globally. Secure 2FA multi-factor checks verify and authorize transactions before outbound routing is written to the ledger block.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Treasury Asset Management</h3>
          <p style="margin-bottom:20px;font-size: 20px;color:#475569;">Allocate surplus capital to yielding treasury assets. Enjoy sovereign protection under full-reserve regulatory compliance with immediate liquidity.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Identity Management & Compliance KYC</h3>
          <p style="margin-bottom:12px;font-size: 20px;color:#475569;">We apply professional identity verification and tax classification checks to ensure profile compliance. Operators approve or reject onboarding queues securely from the operations console.</p>
        </div>
      </div>
    </div>
  `);
}

// Legal & Compliance View
function renderLegal() {
  setRoot(`
    <div class="app-container">
      <div class="panel" style="margin-bottom:32px;">
        <div class="panel-header" style="background:#002C77;color:#fff;">
          <h2 class="panel-title" style="color:#fff;font-size: 20px;letter-spacing:0.05em;">Legal, Compliance & Disclaimers</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:16px;margin-bottom:24px;border-radius:4px;font-size: 20px;color:#991b1b;font-weight:700;">
            ⚠️ CRITICAL REGULATORY NOTICE & DISCLAIMER:<br>
            THIS PLATFORM IS AN ENTIRELY SIMULATED DIGITAL banking environment. It is constructed solely for private demonstrations, software testing, and auditing purposes. No real monetary transactions, deposits, or withdrawals are processed. All funds, balances, account details, and payment cards are fictional.
          </div>
          
          <h3 style="color:#002C77;font-size: 20px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">1. Purpose of Simulation</h3>
          <p style="margin-bottom:20px;font-size: 19.5px;color:#475569;">The Meridian Trust Bank digital interface mimics a secure corporate offshore banking client portal to demonstrate multi-currency ledgers, administrative compliance controls, and SWIFT wire authorizations. No real-world deposits are held or protected by the FDIC or other financial regulators.</p>

          <h3 style="color:#002C77;font-size: 20px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">2. Privacy & Data Integrity</h3>
          <p style="margin-bottom:20px;font-size: 19.5px;color:#475569;">All personal details entered during registration are treated as simulated inputs. For compliance, please do not use your real-world banking passcodes or critical credentials.</p>

          <h3 style="color:#002C77;font-size: 20px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">3. Anti-Money Laundering (AML) Compliance</h3>
          <p style="margin-bottom:12px;font-size: 19.5px;color:#475569;">The system simulates real-time transaction intercept filters to block transfers under preset administrative rules. These blocks mimic regulatory holds for auditing exercises.</p>
        </div>
      </div>
    </div>
  `);
}

// About View
function renderAbout() {
  setRoot(`
    <div class="app-container">
      <div class="panel" style="margin-bottom:32px;">
        <div class="panel-header" style="background:#002C77;color:#fff;">
          <h2 class="panel-title" style="color:#fff;font-size: 20px;letter-spacing:0.05em;">About Meridian Trust Bank</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:12px 18px;margin-bottom:24px;border-radius:4px;font-size: 19.5px;color:#991b1b;font-weight:600;">
            ⚠️ Simulated System Notice: This about section describes a simulated banking concept for auditing and demonstration.
          </div>
          
          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Private Offshore Capital Preservation</h3>
          <p style="margin-bottom:20px;font-size: 20px;color:#475569;">Meridian Trust represents a concept in full-reserve private offshore banking. In an era of fractional reserve exposure, our design prioritizes absolute ledger security and capital transparency.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Secure Offshore Custody Model</h3>
          <p style="margin-bottom:20px;font-size: 20px;color:#475569;">Under our simulated framework, 100% of capital reserves are allocated directly to liquid short-term government instruments. This prevents lending exposure, offering immediate availability on settlement requests.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size: 22px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Digital Core Infrastructure</h3>
          <p style="margin-bottom:12px;font-size: 20px;color:#475569;">With path-based admin consoles, dynamic transaction intercepts, and 2-phase MFA security, our core engineering represents a highly resilient system built for secure demonstration auditing.</p>
        </div>
      </div>
    </div>
  `);
}

// ── API Fetch Wrapper ─────────────────────────────────────────────────────────
async function api(path, body) {
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' };
  const res  = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'An unexpected error occurred.');
  return data;
}

// ── Transaction History statements Page ───────────────────────────────────────
function resolveAccountLabel(accId) {
  const acc = state.accounts.find(a => a.id === accId);
  if (!acc) return 'Account';
  return acc.type.charAt(0).toUpperCase() + acc.type.slice(1);
}

async function loadTransactionHistory() {
  setRoot(`<div style="padding:60px;text-align:center;color:var(--text-muted);font-size: 20px;">Loading statement and transaction ledger…</div>`);
  try {
    if (!state.accounts.length) {
      const accounts = await api(`/api/accounts?userId=${state.user.id}`);
      state.accounts = accounts;
    }
    // Always fetch latest transactions to ensure real-time accuracy
    const transactions = await api(`/api/transactions?userId=${state.user.id}`);
    state.transactions = transactions;
    
    renderTransactionHistory();
  } catch (e) {
    toast('Load Failed', 'Could not retrieve transaction history. Please refresh.', 'error');
  }
}

function renderTransactionHistory() {
  if (!state.historyFilter) {
    const defaultEnd = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    state.historyFilter = {
      accountId: 'all',
      type: 'all',
      search: '',
      startDate: '2023-06-20',
      endDate: defaultEnd,
      page: 1,
      pageSize: 15,
      chartGrouping: 'month'
    };
  }

  const accOptions = state.accounts.map(a => 
    `<option value="${a.id}">${a.type.charAt(0).toUpperCase() + a.type.slice(1)} Account (••${a.accountNumber.slice(-4)}) — ${fmtMoney(a.balance, 'USD')}</option>`
  ).join('');

  setRoot(`
    <div class="app-container">
      <div class="page-header">
        <div class="page-header-inner">
          <div>
            <h2 class="page-greeting">Transactions</h2>
            <p class="page-subtext">View your transaction history, filter by date or account, and download statements.</p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary btn-sm" onclick="exportHistoryCSV()">
              Export CSV Ledger
            </button>
            <button class="btn btn-primary btn-sm" onclick="exportHistoryPDF()">
              Print Statement
            </button>
          </div>
        </div>
      </div>

      <!-- Filters Panel -->
      <div class="panel" style="margin-bottom:24px;">
        <div class="panel-header">
          <span class="panel-title">Filters & Search</span>
        </div>
        <div class="panel-body" style="padding:20px;">
          <div class="form-row" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 17px;">Select Account</label>
              <select id="hist-account" class="form-select" onchange="updateHistoryFilter()">
                <option value="all">All USD Accounts</option>
                ${accOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 17px;">Transaction Type</label>
              <select id="hist-type" class="form-select" onchange="updateHistoryFilter()">
                <option value="all">All Types</option>
                <option value="DEPOSIT">Inflows (Deposits)</option>
                <option value="TRANSFER_OUT">Outflows (Transfers/Debits)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 17px;">Start Date</label>
              <input id="hist-start-date" type="date" class="form-input" value="${state.historyFilter.startDate}" onchange="updateHistoryFilter()">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 17px;">End Date</label>
              <input id="hist-end-date" type="date" class="form-input" value="${state.historyFilter.endDate}" onchange="updateHistoryFilter()">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" style="font-size: 17px;">Search Description / Counterparty</label>
              <input id="hist-search" type="text" class="form-input" placeholder="Search reference, description, counterparty..." value="${state.historyFilter.search}" oninput="updateHistoryFilter()">
            </div>
          </div>
        </div>
      </div>

      <!-- Ledger Panel -->
      <div class="panel">
        <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="panel-title">Transaction History</span>
          <span id="hist-count" style="font-size: 18px; font-weight:600; color:var(--text-secondary);">Showing 0 records</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="txn-table">
            <thead>
              <tr>
                <th></th>
                <th>Description</th>
                <th>Account</th>
                <th>Date & Time</th>
                <th>Status</th>
                <th style="text-align:right;">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="hist-table-body">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
          <div id="hist-list-mobile" class="txn-list-mobile"></div>
        </div>
        <div id="hist-pagination" class="panel-body" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding:16px 24px;">
          <!-- Pagination rendered dynamically -->
        </div>
      </div>
    </div>
  `);

  applyHistoryFiltersAndRender();
}

function applyHistoryFiltersAndRender() {
  const filter = state.historyFilter;
  if (!filter) return;

  const accountEl = document.getElementById('hist-account');
  const typeEl = document.getElementById('hist-type');
  const startEl = document.getElementById('hist-start-date');
  const endEl = document.getElementById('hist-end-date');
  const searchEl = document.getElementById('hist-search');
  const groupingEl = document.getElementById('hist-grouping');

  if (accountEl) filter.accountId = accountEl.value;
  if (typeEl) filter.type = typeEl.value;
  if (startEl) filter.startDate = startEl.value;
  if (endEl) filter.endDate = endEl.value;
  if (searchEl) filter.search = searchEl.value;
  if (groupingEl) filter.chartGrouping = groupingEl.value;

  const startMs = new Date(filter.startDate).getTime();
  const endMs = new Date(filter.endDate + 'T23:59:59Z').getTime();

  const filtered = state.transactions.filter(t => {
    if (filter.accountId !== 'all' && t.accountId !== filter.accountId) return false;
    
    if (filter.type !== 'all') {
      if (filter.type === 'DEPOSIT' && t.type !== 'DEPOSIT') return false;
      if (filter.type === 'TRANSFER_OUT' && t.type === 'DEPOSIT') return false;
    }

    const txMs = new Date(t.date).getTime();
    if (txMs < startMs || txMs > endMs) return false;

    if (filter.search.trim()) {
      const q = filter.search.toLowerCase();
      const descMatch = t.description?.toLowerCase().includes(q);
      const partnerMatch = t.counterparty?.toLowerCase().includes(q);
      const idMatch = t.id?.toLowerCase().includes(q);
      if (!descMatch && !partnerMatch && !idMatch) return false;
    }

    return true;
  });

  // Sort filtered transactions chronologically (newest first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  state.filteredTransactions = filtered;

  const countEl = document.getElementById('hist-count');
  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} records`;
  }

  const tableBody = document.getElementById('hist-table-body');
  const mobileListEl = document.getElementById('hist-list-mobile');
  const paginationEl = document.getElementById('hist-pagination');

  if (tableBody && paginationEl) {
    const total = filtered.length;
    const pageCount = Math.ceil(total / filter.pageSize) || 1;
    filter.page = Math.min(filter.page, pageCount);
    const startIdx = (filter.page - 1) * filter.pageSize;
    const endIdx = Math.min(startIdx + filter.pageSize, total);

    const pageTxs = filtered.slice(startIdx, endIdx);

    tableBody.innerHTML = pageTxs.length ? pageTxs.map(t => {
      const isCredit = t.type === 'DEPOSIT';
      const accLabel = resolveAccountLabel(t.accountId);
      return `
        <tr onclick="showTransactionDetails('${t.id}')" style="cursor:pointer;" class="txn-row-interactive">
          <td style="width:44px;">
            <div class="txn-icon ${isCredit ? 'credit' : 'debit'}">${isCredit ? icons.arrowDown : icons.arrowUp}</div>
          </td>
          <td>
            <div class="txn-desc">${t.description}</div>
            <div class="txn-party">${t.counterparty}</div>
          </td>
          <td>
            <span style="font-weight:600;font-size: 18px;color:var(--text-secondary);text-transform:capitalize;">${accLabel}</span>
          </td>
          <td class="txn-date">${fmtDateTime(t.date)}</td>
          <td>
            <span class="status-pill ${t.status}">${t.status}</span>
          </td>
          <td class="txn-amount ${isCredit ? 'credit' : 'debit'}">
            ${isCredit ? '+' : '−'}${fmtMoney(t.amount, t.currency)}
          </td>
          <td style="width:36px; text-align:center;">
            <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation(); downloadWirePDF('${t.id}')" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center;" title="Download Receipt">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);font-size: 19px;">No transaction statements match your search criteria.</td></tr>`;

    if (mobileListEl) {
      mobileListEl.innerHTML = pageTxs.length ? pageTxs.map(t => {
        const isCredit = t.type === 'DEPOSIT';
        const accLabel = resolveAccountLabel(t.accountId);
        return `
          <div class="txn-mobile-item" onclick="showTransactionDetails('${t.id}')">
            <div class="txn-mobile-left">
              <div class="txn-icon ${isCredit ? 'credit' : 'debit'}">${isCredit ? icons.arrowDown : icons.arrowUp}</div>
              <div class="txn-mobile-info">
                <div class="txn-desc">${t.description}</div>
                <div class="txn-party">${t.counterparty} <span style="font-size: 16px; color:var(--text-muted);">(${accLabel})</span></div>
                <div class="txn-date">${fmtDateTime(t.date)}</div>
              </div>
            </div>
            <div class="txn-mobile-right">
              <div class="txn-amount ${isCredit ? 'credit' : 'debit'}">
                ${isCredit ? '+' : '−'}${fmtMoney(t.amount, t.currency)}
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="status-pill ${t.status}">${t.status}</span>
                <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation(); downloadWirePDF('${t.id}')" style="padding:4px 6px; display:inline-flex; align-items:center; justify-content:center;" title="Download Receipt">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size: 19px;">No transaction statements match your search criteria.</div>`;
    }

    paginationEl.innerHTML = `
      <div style="font-size: 18px; color:var(--text-muted); font-weight:500;">
        Showing ${total ? startIdx + 1 : 0}–${endIdx} of ${total} records
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost btn-xs" ${filter.page === 1 ? 'disabled' : ''} onclick="changeHistoryPage(-1)" style="padding: 4px 10px;">Previous</button>
        <button class="btn btn-ghost btn-xs" ${filter.page === pageCount ? 'disabled' : ''} onclick="changeHistoryPage(1)" style="padding: 4px 10px;">Next</button>
      </div>
    `;
  }

  drawHistoryChart(filtered);
}

function drawHistoryChart(txs) {
  const canvas = document.getElementById('chart-history-trends');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Resolve width from parent element to prevent layout spill on mobile
  const parentEl = canvas.parentElement;
  const dWidth = parentEl ? parentEl.clientWidth : (canvas.clientWidth || 350);
  const dHeight = 220;
  
  canvas.width = dWidth;
  canvas.height = dHeight;
  
  // Attach resize redraw event listener once
  if (!window._chartResizeListenerAttached) {
    window._chartResizeListenerAttached = true;
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const activeCanvas = document.getElementById('chart-history-trends');
        if (activeCanvas && state.filteredTransactions) {
          drawHistoryChart(state.filteredTransactions);
        }
      }, 150);
    });
  }
  ctx.clearRect(0, 0, dWidth, dHeight);

  const filter = state.historyFilter;
  const grouping = filter.chartGrouping;
  const start = new Date(filter.startDate);
  const end = new Date(filter.endDate);
  const groups = [];

  if (grouping === 'year') {
    let currYear = start.getFullYear();
    const endYear = end.getFullYear();
    while (currYear <= endYear) {
      groups.push({ key: `${currYear}`, label: `${currYear}`, inflow: 0, outflow: 0 });
      currYear++;
    }
  } else if (grouping === 'month') {
    let curr = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (curr <= endMonth) {
      const label = curr.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
      groups.push({ key, label, inflow: 0, outflow: 0 });
      curr.setMonth(curr.getMonth() + 1);
    }
  } else {
    let curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let dayCount = 0;
    while (curr <= endDay && dayCount < 90) {
      const label = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const key = curr.toISOString().split('T')[0];
      groups.push({ key, label, inflow: 0, outflow: 0 });
      curr.setDate(curr.getDate() + 1);
      dayCount++;
    }
  }

  txs.forEach(t => {
    const d = new Date(t.date);
    let key = '';
    if (grouping === 'year') {
      key = `${d.getFullYear()}`;
    } else if (grouping === 'month') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = d.toISOString().split('T')[0];
    }

    const grp = groups.find(g => g.key === key);
    if (grp) {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'DEPOSIT') {
        grp.inflow += amt;
      } else {
        grp.outflow += amt;
      }
    }
  });

  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphWidth = dWidth - paddingLeft - paddingRight;
  const graphHeight = dHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(...groups.map(g => Math.max(g.inflow, g.outflow))) || 100000;
  
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px "DM Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = (maxVal * i) / gridSteps;
    const yPos = dHeight - paddingBottom - (graphHeight * i) / gridSteps;

    ctx.beginPath();
    ctx.moveTo(paddingLeft, yPos);
    ctx.lineTo(dWidth - paddingRight, yPos);
    ctx.stroke();

    let labelText = '';
    if (yVal >= 1000000) labelText = '$' + (yVal / 1000000).toFixed(1) + 'M';
    else if (yVal >= 1000) labelText = '$' + (yVal / 1000).toFixed(0) + 'k';
    else labelText = '$' + yVal.toFixed(0);
    ctx.fillText(labelText, paddingLeft - 10, yPos);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelInterval = Math.max(1, Math.ceil(groups.length / 12));
  groups.forEach((g, idx) => {
    if (idx % labelInterval === 0) {
      const xPos = paddingLeft + (graphWidth * idx) / Math.max(1, groups.length - 1) + (graphWidth / groups.length) / 2;
      ctx.fillText(g.label, xPos, dHeight - paddingBottom + 8);
    }
  });

  const grpWidth = graphWidth / Math.max(1, groups.length);
  const barSpacing = grpWidth * 0.1;
  const barWidth = (grpWidth - barSpacing * 3) / 2;

  groups.forEach((g, idx) => {
    const grpX = paddingLeft + idx * grpWidth + barSpacing;
    
    if (g.inflow > 0) {
      const hInflow = (g.inflow / maxVal) * graphHeight;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(grpX, dHeight - paddingBottom - hInflow, barWidth, hInflow, [3, 3, 0, 0]);
      ctx.fill();
    }

    if (g.outflow > 0) {
      const hOutflow = (g.outflow / maxVal) * graphHeight;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(grpX + barWidth + barSpacing, dHeight - paddingBottom - hOutflow, barWidth, hOutflow, [3, 3, 0, 0]);
      ctx.fill();
    }
  });
}

window.changeHistoryPage = function(delta) {
  if (state.historyFilter) {
    state.historyFilter.page += delta;
    applyHistoryFiltersAndRender();
  }
};

window.updateHistoryFilter = function() {
  const accountEl = document.getElementById('hist-account');
  const typeEl = document.getElementById('hist-type');
  const startEl = document.getElementById('hist-start-date');
  const endEl = document.getElementById('hist-end-date');
  const searchEl = document.getElementById('hist-search');
  const groupingEl = document.getElementById('hist-grouping');

  if (state.historyFilter) {
    if (accountEl) state.historyFilter.accountId = accountEl.value;
    if (typeEl) state.historyFilter.type = typeEl.value;
    if (startEl) state.historyFilter.startDate = startEl.value;
    if (endEl) state.historyFilter.endDate = endEl.value;
    if (searchEl) state.historyFilter.search = searchEl.value;
    if (groupingEl) state.historyFilter.chartGrouping = groupingEl.value;
    state.historyFilter.page = 1;
    applyHistoryFiltersAndRender();
  }
};

window.exportHistoryCSV = function() {
  const txs = state.filteredTransactions || [];
  if (!txs.length) {
    toast('No Records', 'There are no transactions to export.', 'warning');
    return;
  }
  let csv = 'Transaction ID,Account ID,Type,Description,Counterparty,Date,Status,Amount (USD)\n';
  txs.forEach(t => {
    const amtStr = (t.type === 'DEPOSIT' ? '' : '-') + t.amount.toFixed(2);
    csv += `"${t.id}","${t.accountId}","${t.type}","${t.description.replace(/"/g, '""')}","${t.counterparty.replace(/"/g, '""')}","${t.date}","${t.status}",${amtStr}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `MTB_Statement_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('Export Successful', 'Your statement has been downloaded as a CSV.', 'success');
};

window.exportHistoryPDF = function() {
  const txs = state.filteredTransactions || [];
  if (!txs.length) {
    toast('No Records', 'There are no transactions to print.', 'warning');
    return;
  }
  const client = state.user;
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  txs.forEach(t => {
    if (t.type === 'DEPOSIT') totalDeposits += t.amount;
    else totalWithdrawals += t.amount;
  });

  const rowsHTML = txs.map(t => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 18px;">
      <td style="padding: 10px 0;">${new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
      <td style="padding: 10px 0;"><strong>${t.description}</strong><br><span style="color:#64748b; font-size: 17px;">${t.counterparty}</span></td>
      <td style="padding: 10px 0;">${t.id}</td>
      <td style="padding: 10px 0;">${t.accountId.split('-').pop()}</td>
      <td style="padding: 10px 0; text-align: right; color: ${t.type === 'DEPOSIT' ? '#10b981' : '#ef4444'}; font-weight: 600;">
        ${t.type === 'DEPOSIT' ? '+' : '−'}${fmtMoney(t.amount, 'USD')}
      </td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Official Bank Statement - Meridian Trust Bank</title>
        <style>
          body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #0f172a; padding: 40px; margin: 0; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #002C77; padding-bottom: 20px; margin-bottom: 30px; }
          .brand { color: #002C77; }
          .brand h1 { margin: 0; font-size: 26px; font-family: 'Roboto Condensed', sans-serif; letter-spacing: 1px; }
          .brand p { margin: 4px 0 0 0; font-size: 17px; text-transform: uppercase; color: #a47c14; letter-spacing: 1.5px; font-weight: 700; }
          .meta-details { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 19px; }
          .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .summary-item { display: flex; flex-direction: column; }
          .summary-label { font-size: 17px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 6px; }
          .summary-value { font-size: 22px; font-weight: 700; color: #002C77; }
          .statement-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .statement-table th { border-bottom: 2px solid #cbd5e1; text-align: left; padding: 10px 0; font-size: 17px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .footer { margin-top: 50px; font-size: 17px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <h1>MERIDIAN TRUST BANK</h1>
            <p>International Private Banking</p>
          </div>
          <div style="text-align: right; font-size: 18px; color: #64748b;">
            <strong>OFFICIAL TRANSACTION STATEMENT</strong><br>
            Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div class="meta-details">
          <div>
            <strong>PREPARED FOR:</strong><br>
            ${client.name}<br>
            ${client.address || ''}<br>
            ${client.state || ''} ${client.zip || ''}
          </div>
          <div style="text-align: right;">
            <strong>CLIENT PROFILE:</strong><br>
            Client ID: ${client.id}<br>
            Email: ${client.email}<br>
            Statement Period: ${new Date(state.historyFilter.startDate).toLocaleDateString()} - ${new Date(state.historyFilter.endDate).toLocaleDateString()}
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-item">
            <span class="summary-label">Total Deposits</span>
            <span class="summary-value" style="color:#10b981;">+${fmtMoney(totalDeposits, 'USD')}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Withdrawals</span>
            <span class="summary-value" style="color:#ef4444;">-${fmtMoney(totalWithdrawals, 'USD')}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Net Flow</span>
            <span class="summary-value">${totalDeposits >= totalWithdrawals ? '+' : '−'}${fmtMoney(Math.abs(totalDeposits - totalWithdrawals), 'USD')}</span>
          </div>
        </div>

        <h3 style="font-size: 20px; color: #002C77; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Account Ledger Activity</h3>
        <table class="statement-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Reference ID</th>
              <th>Account</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="footer">
          Meridian Trust Bank Ltd. &nbsp;|&nbsp; Licensed Offshore Institution &nbsp;|&nbsp; Full-Reserve Custody &nbsp;|&nbsp; Confidential Client Document
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// ── DOM Value Helper ──────────────────────────────────────────────────────────
function v(id) { const el = document.getElementById(id); return el ? el.value : ''; }

// ── Start ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
