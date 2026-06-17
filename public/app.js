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
  '#/portal/digital-banking/currency-exchange':  ['Loading FX Exchange', 'Connecting to interbank currency conversion engine…'],
};

let _routeTimer = null;

function route() {
  renderNav();
  const h = window.location.hash || '#';

  const publicRoutes  = ['#', '#/', '#/portal/client-auth/login', '#/portal/client-onboarding/apply'];
  const privateRoutes = ['#/portal/digital-banking/dashboard', '#/portal/digital-banking/wire-transfer', '#/portal/digital-banking/currency-exchange'];

  if (privateRoutes.includes(h) && !state.user) { nav('#/portal/client-auth/login'); return; }
  if ((h === '#/portal/client-auth/login' || h === '#/portal/client-onboarding/apply') && state.user) { nav('#/portal/digital-banking/dashboard'); return; }

  // Redirect old page routes to landing (content is now inline)
  if (['#/products','#/services','#/legal','#/about','#/login','#/register','#/dashboard','#/send','#/exchange'].includes(h)) {
    if (h === '#/login') { nav('#/portal/client-auth/login'); return; }
    if (h === '#/register') { nav('#/portal/client-onboarding/apply'); return; }
    if (h === '#/dashboard') { nav('#/portal/digital-banking/dashboard'); return; }
    if (h === '#/send') { nav('#/portal/digital-banking/wire-transfer'); return; }
    if (h === '#/exchange') { nav('#/portal/digital-banking/currency-exchange'); return; }
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
      case '#/portal/digital-banking/currency-exchange':  loadExchange(); break;
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

  if (state.user) {
    el.innerHTML = `
      <button class="nav-link ${h==='#/portal/digital-banking/dashboard'?'active':''}" onclick="nav('#/portal/digital-banking/dashboard')">Overview</button>
      <button class="nav-link ${h==='#/portal/digital-banking/wire-transfer'?'active':''}"      onclick="nav('#/portal/digital-banking/wire-transfer')">Wire Transfer</button>
      <button class="nav-link ${h==='#/portal/digital-banking/currency-exchange'?'active':''}"  onclick="nav('#/portal/digital-banking/currency-exchange')">FX Exchange</button>
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
            Open multi-currency accounts in USD, EUR, and GBP. Settle international wires with precision. Manage corporate treasuries and private wealth from a single secure platform.
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
              <h3 class="w3-feature-title">Multi-Currency Accounts</h3>
              <p class="w3-feature-desc">Maintain separate ledger balances in US Dollars, Euros, and British Pounds. Switch between currencies in real time with interbank-rate FX conversions.</p>
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
            <p class="w3-section-desc">From international wire routing to real-time currency exchange, every tool you need for global financial operations.</p>
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
                <h3 class="w3-service-title">Interbank FX Conversion</h3>
                <p class="w3-service-desc">Exchange balances across USD, EUR, and GBP immediately at estimated wholesale conversion values, allowing real-time currency reallocation.</p>
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

// Login Page
function renderLogin() {
  setRoot(`
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-logo-wrap">
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
              <path d="M7 9 L14 16 L21 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="7" y1="20" x2="21" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <span style="font-family:'Roboto Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Meridian Trust</span>
          </div>
          <h1 class="auth-title">Client Portal Login</h1>
          <p class="auth-subtitle">Enter your assigned Client ID and passcode to access your accounts.</p>
        </div>
        <div class="auth-card-body">
          <form id="login-form" onsubmit="handleLogin(event)">
            <div class="form-group">
              <label class="form-label">Client Account ID</label>
              <input id="f-uid" type="text" class="form-input" placeholder="Client ID" autocomplete="username" required>
            </div>
            <div class="form-group">
              <label class="form-label">Secure Passcode</label>
              <input id="f-pwd" type="password" class="form-input" placeholder="Passcode" autocomplete="current-password" required>
            </div>
            <button type="submit" class="btn btn-primary btn-full" style="margin-top:6px;">Authenticate Session</button>
          </form>
        </div>
        <div class="auth-card-footer">
          New to Meridian Trust? <a onclick="nav('#/portal/client-onboarding/apply')">Open an account</a>
        </div>
      </div>
    </div>
  `);
}

// Register Page — Step 1: Account Information
function renderRegister() {
  const d = state.regData || {};
  setRoot(`
    <div class="auth-shell">
      <div class="auth-card" style="max-width:550px;">
        <div class="auth-card-header">
          <div class="auth-logo-wrap">
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
              <path d="M7 9 L14 16 L21 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="7" y1="20" x2="21" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <span style="font-family:'Roboto Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Meridian Trust</span>
          </div>
          <h1 class="auth-title">US Account Application</h1>
          <p class="auth-subtitle">Step 1 of 2: Personal & Contact Information</p>
        </div>
        <div class="auth-card-body">
          <form id="reg-form-step1" onsubmit="goToRegisterStep2(event)">
            <div class="form-group">
              <label class="form-label">Full Legal Name / Entity Name</label>
              <input id="r-name" type="text" class="form-input" placeholder="Full Legal Name" value="${d.name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input id="r-email" type="email" class="form-input" placeholder="Email Address" value="${d.email || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input id="r-phone" type="tel" class="form-input" placeholder="Phone Number" value="${d.phone || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Residential Address</label>
              <input id="r-address" type="text" class="form-input" placeholder="Residential Address" value="${d.address || ''}" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">State</label>
                <input id="r-state" type="text" class="form-input" placeholder="State" value="${d.state || ''}" required>
              </div>
              <div class="form-group">
                <label class="form-label">ZIP Code</label>
                <input id="r-zip" type="text" class="form-input" placeholder="ZIP Code" value="${d.zip || ''}" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Account Classification</label>
              <select id="r-type" class="form-select" onchange="toggleAccountTypeLabels()">
                <option value="personal" ${d.accountType === 'personal' ? 'selected' : ''}>Personal / Private Client</option>
                <option value="business" ${d.accountType === 'business' ? 'selected' : ''}>Corporate / Business Entity</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="margin-bottom:10px;">Select Account Programs to Open (Choose at least one)</label>
              <div style="display:flex;flex-direction:column;gap:12px;background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:4px;">
                <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="acc-checking" checked style="width:16px;height:16px;">
                  <div>
                    <strong id="lbl-checking-title">USD Private Checking</strong>
                    <div style="font-size:11px;color:var(--text-muted);" id="lbl-checking-desc">Everyday transactions, swift wires, debit card settlements</div>
                  </div>
                </label>
                <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="acc-savings" checked style="width:16px;height:16px;">
                  <div>
                    <strong id="lbl-savings-title">EUR High-Yield Savings</strong>
                    <div style="font-size:11px;color:var(--text-muted);" id="lbl-savings-desc">Compounding offshore yield, wealth preservation</div>
                  </div>
                </label>
                <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
                  <input type="checkbox" id="acc-market" style="width:16px;height:16px;">
                  <div>
                    <strong id="lbl-market-title">GBP Global Money Market</strong>
                    <div style="font-size:11px;color:var(--text-muted);" id="lbl-market-desc">For institutional currency placements and yields</div>
                  </div>
                </label>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="margin-top:6px;">Next: Identity Verification</button>
          </form>
        </div>
        <div class="auth-card-footer">
          Already registered? <a onclick="nav('#/portal/client-auth/login')">Sign in to your account</a>
        </div>
      </div>
    </div>
  `);
  setTimeout(() => { toggleAccountTypeLabels(); }, 10);
}

function toggleAccountTypeLabels() {
  const type = document.getElementById('r-type')?.value;
  if (!type) return;

  const chkTitle = document.getElementById('lbl-checking-title');
  const chkDesc  = document.getElementById('lbl-checking-desc');
  const savTitle = document.getElementById('lbl-savings-title');
  const savDesc  = document.getElementById('lbl-savings-desc');
  const mktTitle = document.getElementById('lbl-market-title');
  const mktDesc  = document.getElementById('lbl-market-desc');

  if (type === 'personal') {
    if (chkTitle) chkTitle.textContent = 'USD Private Checking';
    if (chkDesc)  chkDesc.textContent  = 'Everyday transactions, swift wires, debit card settlements';
    if (savTitle) savTitle.textContent = 'EUR High-Yield Savings';
    if (savDesc)  savDesc.textContent  = 'Compounding offshore yield, wealth preservation';
    if (mktTitle) mktTitle.textContent = 'GBP Global Money Market';
    if (mktDesc)  mktDesc.textContent  = 'For institutional currency placements and yields';
  } else {
    if (chkTitle) chkTitle.textContent = 'USD Business Treasury Checking';
    if (chkDesc)  chkDesc.textContent  = 'Operating account for wires, vendor bills, and payroll';
    if (savTitle) savTitle.textContent = 'EUR Corporate Reserve Savings';
    if (savDesc)  savDesc.textContent  = 'Asset-backed reserve holding with high-interest yields';
    if (mktTitle) mktTitle.textContent = 'GBP Institutional Investment Placement';
    if (mktDesc)  mktDesc.textContent  = 'High-balance multi-currency corporate treasury cash positioning';
  }
}
window.toggleAccountTypeLabels = toggleAccountTypeLabels;

function goToRegisterStep2(e) {
  e.preventDefault();
  const selected = [];
  if (document.getElementById('acc-checking').checked) selected.push('checking');
  if (document.getElementById('acc-savings').checked) selected.push('savings');
  if (document.getElementById('acc-market').checked) selected.push('market');

  if (selected.length === 0) {
    toast('Selection Required', 'Please select at least one account program to open.', 'error');
    return;
  }

  state.regData = {
    name: document.getElementById('r-name').value,
    email: document.getElementById('r-email').value,
    phone: document.getElementById('r-phone').value,
    address: document.getElementById('r-address').value,
    state: document.getElementById('r-state').value,
    zip: document.getElementById('r-zip').value,
    accountType: document.getElementById('r-type').value,
    selectedAccounts: selected
  };
  renderRegisterStep2();
}

// Register Page — Step 2: SSN / Submission
function renderRegisterStep2() {
  setRoot(`
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-logo-wrap">
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
              <path d="M7 9 L14 16 L21 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="7" y1="20" x2="21" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <span style="font-family:'Roboto Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Meridian Trust</span>
          </div>
          <h1 class="auth-title">US Account Application</h1>
          <p class="auth-subtitle">Step 2 of 2: Identity & Compliance Verification</p>
        </div>
        <div class="auth-card-body">
          <form id="reg-form-step2" onsubmit="handleRegisterSubmit(event)">
            <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">
              To comply with federal regulations, including USA PATRIOT Act requirements, we must verify your Social Security Number (SSN) or Individual Taxpayer Identification Number (ITIN).
            </p>
            <div class="form-group">
              <label class="form-label">Social Security Number (SSN) / ITIN</label>
              <input id="r-ssn" type="password" class="form-input" placeholder="Tax ID / SSN" style="letter-spacing:2px;font-family:monospace;" required>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;">
              <button type="button" class="btn btn-ghost" style="flex:1;" onclick="renderRegister()">Back</button>
              <button type="submit" class="btn btn-primary" style="flex:2;">Submit Application</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `);
}

// Success Page — show success notice after registration
function renderRegistrationSuccess(email) {
  setRoot(`
    <div class="auth-shell">
      <div class="auth-card" style="max-width:550px;">
        <div class="auth-card-header" style="text-align:center;">
          <div style="width:56px;height:56px;border-radius:50%;background:#E6F4EA;color:#137333;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:24px;">
            ${icons.check}
          </div>
          <h1 class="auth-title">Application Submitted</h1>
          <p class="auth-subtitle">Your Meridian Trust US offshore account application is under review.</p>
        </div>
        <div class="auth-card-body">
          <div style="background-color:#F4F6F9;border-left:4px solid #002C77;padding:16px;margin-bottom:24px;font-size:13.5px;color:#333;line-height:1.6;border-radius:0 4px 4px 0;">
            <strong>📋 Compliance Review Status: PENDING</strong><br>
            Federal banking regulations require our verification team to review identity documents and tax designations (SSN/ITIN) before credentials can be activated.
          </div>
          
          <p style="font-size:14.5px;line-height:1.6;color:#555;margin-bottom:24px;text-align:center;font-weight:500;">
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
  setRoot(`<div style="padding:60px;text-align:center;color:var(--text-muted);font-size:14px;">Loading your account data…</div>`);
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

  // Account tiles
  const accTiles = state.accounts.map(a => `
    <div class="acc-tile ${a.type}">
      <div>
        <span class="acc-type-label">${a.type === 'market' ? 'Money Market' : a.type} Account</span>
        <span class="acc-currency-tag">${a.currency}</span>
      </div>
      <div class="acc-balance">${fmtMoney(a.balance, a.currency)}</div>
      <div class="acc-number">Acct: ••${a.accountNumber.slice(-6)} &nbsp;|&nbsp; ${a.routingNumber}</div>
    </div>
  `).join('');

  // Transaction rows (show last 8)
  const recent = state.transactions.slice(0, 8);
  const txRows = recent.length ? recent.map(t => {
    const isCredit = t.type === 'DEPOSIT';
    return `
      <tr>
        <td style="width:44px;">
          <div class="txn-icon ${isCredit ? 'credit' : 'debit'}">${isCredit ? icons.arrowDown : icons.arrowUp}</div>
        </td>
        <td>
          <div class="txn-desc">${t.description}</div>
          <div class="txn-party">${t.counterparty}</div>
        </td>
        <td class="txn-date">${fmtDate(t.date)}</td>
        <td>
          <span class="status-pill ${t.status}">${t.status}</span>
        </td>
        <td class="txn-amount ${isCredit ? 'credit' : 'debit'}">
          ${isCredit ? '+' : '−'}${fmtMoney(t.amount, t.currency)}
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">No transactions on record.</td></tr>`;

  // Card panels (first 2)
  const cardPanels = state.cards.slice(0, 2).map(c => {
    const frozen = c.status === 'FROZEN';
    return `
      <div>
        <div class="card-visual ${frozen ? 'frozen' : 'active'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div class="card-chip"></div>
            <span class="card-network">${c.type}</span>
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
      <div class="page-header">
        <div class="page-header-inner">
          <div>
            <h2 class="page-greeting">Good day, ${u.name}</h2>
            <p class="page-subtext">Client ID: ${u.id} &nbsp;·&nbsp; ${u.accountType === 'business' ? 'Corporate Account' : 'Personal Account'} &nbsp;·&nbsp; ${u.email}</p>
          </div>
          <div>
            <span class="kyc-badge ${u.kycStatus}">
              ${icons.check} KYC ${u.kycStatus}
            </span>
          </div>
        </div>
      </div>

      <!-- Account Balances -->
      <div class="accounts-row">${accTiles || '<p style="color:var(--text-muted);font-size:13px;">No accounts found.</p>'}</div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="quick-action-btn" onclick="nav('#/send')" style="grid-column: span 2;">
          <div class="quick-action-icon">${icons.send}</div>
          <div><div style="font-weight:600;">Initiate Outbound SWIFT Wire Transfer</div><div style="font-size:12px;color:var(--text-muted);font-weight:400;">Transfer USD, EUR, or GBP to global bank accounts instantly</div></div>
        </button>
      </div>

      <div class="dash-grid">
        <!-- Transactions -->
        <div>
          <div class="panel">
            <div class="panel-header">
              <span class="panel-title">Transaction Ledger</span>
              <span style="font-size:12px;color:var(--text-muted);">Recent ${Math.min(8, state.transactions.length)} of ${state.transactions.length}</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="txn-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style="text-align:right;">Amount</th>
                  </tr>
                </thead>
                <tbody>${txRows}</tbody>
              </table>
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
              ${state.cards.length ? cardPanels : '<p style="color:var(--text-muted);font-size:13px;">No cards on file.</p>'}
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

// Send Wire Transfer
async function loadSend() {
  if (!state.accounts.length) {
    const accounts = await api(`/api/accounts?userId=${state.user.id}`);
    state.accounts = accounts;
  }

  const opts = state.accounts.map(a =>
    `<option value="${a.id}">${a.type.charAt(0).toUpperCase()+a.type.slice(1)} (${a.currency}) — ${fmtMoney(a.balance, a.currency)}</option>`
  ).join('');

  setRoot(`
    <div class="app-container transfer-shell">
      <div class="page-header">
        <div>
          <h2 class="page-greeting">International SWIFT Wire Transfer</h2>
          <p class="page-subtext">Transmit funds globally via international wire routing networks.</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><span class="panel-title">Outbound Wire Details</span></div>
        <div class="panel-body">
          <form id="send-form" onsubmit="handleSend(event)">
            <h3 style="font-size:14px;color:var(--citi-blue);margin-bottom:16px;font-weight:600;border-bottom:1px solid var(--border);padding-bottom:8px;">1. Originating Account & Amount</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Funding Account</label>
                <select id="s-acc" class="form-select">${opts || '<option>No accounts</option>'}</select>
              </div>
              <div class="form-group">
                <label class="form-label">Transfer Amount</label>
                <input id="s-amt" type="number" step="0.01" min="1" class="form-input" placeholder="0.00" required>
              </div>
            </div>

            <h3 style="font-size:14px;color:var(--citi-blue);margin-top:24px;margin-bottom:16px;font-weight:600;border-bottom:1px solid var(--border);padding-bottom:8px;">2. Beneficiary (Recipient) Details</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Beneficiary Full Name</label>
                <input id="s-recipient-name" type="text" class="form-input" placeholder="Name of individual or business entity" required>
              </div>
              <div class="form-group">
                <label class="form-label">Beneficiary Address</label>
                <input id="s-recipient-addr" type="text" class="form-input" placeholder="Street Address, City, Country" required>
              </div>
            </div>

            <h3 style="font-size:14px;color:var(--citi-blue);margin-top:24px;margin-bottom:16px;font-weight:600;border-bottom:1px solid var(--border);padding-bottom:8px;">3. Receiving Bank Routing (SWIFT) Details</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">SWIFT / BIC Code</label>
                <input id="s-swift-code" type="text" class="form-input" placeholder="8 or 11 character code" maxlength="11" required style="text-transform:uppercase;font-family:monospace;">
              </div>
              <div class="form-group">
                <label class="form-label">ABA Routing / Sort Code / IBAN</label>
                <input id="s-routing-num" type="text" class="form-input" placeholder="Routing or international account identifier" required style="font-family:monospace;">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Recipient Account Number</label>
                <input id="s-acc-num" type="text" class="form-input" placeholder="Beneficiary Account Number" required style="font-family:monospace;">
              </div>
              <div class="form-group">
                <label class="form-label">Recipient Bank Name</label>
                <input id="s-bank-name" type="text" class="form-input" placeholder="e.g. Citibank N.A., HSBC Bank" required>
              </div>
            </div>

            <h3 style="font-size:14px;color:var(--citi-blue);margin-top:24px;margin-bottom:16px;font-weight:600;border-bottom:1px solid var(--border);padding-bottom:8px;">4. Transfer Memo</h3>
            <div class="form-group">
              <label class="form-label">Narrative / Description (For bank statement)</label>
              <input id="s-description" type="text" class="form-input" placeholder="e.g. Invoice settlement, family support, property purchase" required>
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="margin-top:16px;">Transmit International Wire</button>
          </form>
        </div>
      </div>
    </div>
  `);
}

// ── EVENT HANDLERS ────────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
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
          <p class="auth-subtitle" style="font-size:12.5px;line-height:1.5;">A 6-digit verification code has been dispatched to your registered email address.</p>
        </div>
        <div class="auth-card-body">
          <form onsubmit="handleLogin2FASubmit(event, '${userId}')">
            <div class="form-group">
              <label class="form-label">MFA Verification Code</label>
              <input type="text" id="login-2fa-code" class="form-input" required maxlength="6" placeholder="000000" style="text-align:center;font-size:20px;letter-spacing:6px;font-family:monospace;" autofocus>
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
      <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
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
      <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
        Enter the 6-digit security verification code sent to your registered email to authorize this outbound transaction.
      </p>
      <form id="wire-2fa-form">
        <div class="form-group">
          <label class="form-label">6-Digit Code</label>
          <input type="text" id="wire-2fa-code" class="form-input" required maxlength="6" placeholder="000000" style="text-align:center;font-size:20px;letter-spacing:6px;font-family:monospace;" autofocus>
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

async function handleSend(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Processing…';
  const accId = v('s-acc');
  const acc   = state.accounts.find(a => a.id === accId);
  const amt   = parseFloat(v('s-amt'));
  if (!acc || acc.balance < amt) {
    toast('Transfer Declined', 'Insufficient available balance.', 'error');
    btn.disabled = false; btn.textContent = 'Transmit International Wire';
    return;
  }

  showLoader('Requesting Code', 'Requesting outbound transfer verification code from security server...');

  try {
    // Request verification code via API
    await api('/api/transactions/request-code', { userId: state.user.id });
    hideLoader();
    btn.disabled = false; btn.textContent = 'Transmit International Wire';

    // Show 2FA input modal
    openWire2FAModal(async (verificationCode) => {
      btn.disabled = true; btn.textContent = 'Processing…';
      showLoader('Transmitting SWIFT Wire', `Routing ${fmtMoney(amt, acc.currency)} out to international clearing systems…`);

      const startTime = Date.now();
      try {
        await api('/api/transactions/send', {
          userId: state.user.id, accountId: accId,
          amount: amt, currency: acc.currency,
          recipientName: v('s-recipient-name'),
          recipientAddress: v('s-recipient-addr'),
          recipientBank: v('s-bank-name'),
          swiftCode: v('s-swift-code').toUpperCase(),
          routingNumber: v('s-routing-num'),
          accountNumber: v('s-acc-num'),
          description: v('s-description'),
          verificationCode
        });

        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, 1800 - elapsed);

        setTimeout(() => {
          hideLoader();
          toast('Wire Transmitted', `${fmtMoney(amt, acc.currency)} dispatched to ${v('s-recipient-name')}.`, 'success');
          state.accounts = []; // Force refresh
          nav('#/dashboard');
        }, delay);
      } catch (err) {
        hideLoader();
        toast('Transfer Failed', err.message, 'error');
        btn.disabled = false; btn.textContent = 'Transmit International Wire';
      }
    });
  } catch (err) {
    hideLoader();
    toast('Request Failed', err.message, 'error');
    btn.disabled = false; btn.textContent = 'Transmit International Wire';
  }
}

function logout() {
  state = { user: null, accounts: [], transactions: [], cards: [], adminUsers: [], pendingEmail: null, devOtp: null };
  localStorage.removeItem('mtb_session');
  toast('Signed Out', 'Your secure session has been terminated.', 'info');
  nav('#/login');
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
          <h2 class="panel-title" style="color:#fff;font-size:14px;letter-spacing:0.05em;">Meridian Offshore Accounts & Programs</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:12px 18px;margin-bottom:24px;border-radius:4px;font-size:13.5px;color:#991b1b;font-weight:600;">
            ⚠️ Simulated System Notice: The ledger account systems, credit limits, card placements, and balances presented here are part of a private banking digital simulation. No real funds are held or processed.
          </div>
          
          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Multi-Currency Checking Programs</h3>
          <p style="margin-bottom:20px;font-size:14px;color:#475569;">Our flagship checking program is designed for private corporate entities and high-net-worth individuals requiring immediate global liquidity. Key features include:</p>
          <ul style="padding-left:20px;margin-bottom:24px;font-size:13.5px;color:#475569;line-height:1.8;">
            <li style="margin-bottom:6px;"><strong>Ledger Currency Splitting:</strong> Maintain independent balances in USD, EUR, and GBP within a single profile.</li>
            <li style="margin-bottom:6px;"><strong>SWIFT Settlement Routing:</strong> Seamless processing parameters matching international routing codes.</li>
            <li style="margin-bottom:6px;"><strong>Real-Time Ledger Audits:</strong> Instant balance adjustments and manual deposit credits via secure operators.</li>
          </ul>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">High-Yield Savings & Money Markets</h3>
          <p style="margin-bottom:20px;font-size:14px;color:#475569;">For asset placements and reserve preservation, our savings and capital market programs offer fixed returns and structured ledger protection, yielding full capital backing across sovereign instruments.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Offshore Debit Cards & Virtual Programs</h3>
          <p style="margin-bottom:12px;font-size:14px;color:#475569;">Manage corporate spending instantly with our debit card suite. Operators can issue cards, toggle status (active, frozen, cancelled), and view CVV/expiry details directly inside the portal.</p>
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
          <h2 class="panel-title" style="color:#fff;font-size:14px;letter-spacing:0.05em;">Core Banking Services</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:12px 18px;margin-bottom:24px;border-radius:4px;font-size:13.5px;color:#991b1b;font-weight:600;">
            ⚠️ Simulated System Notice: All transfer routing and FX rates displayed on this platform are part of a private ledger simulation.
          </div>
          
          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Outbound SWIFT Wire Transfers</h3>
          <p style="margin-bottom:20px;font-size:14px;color:#475569;">Submit international wire transfers globally. Secure 2FA multi-factor checks verify and authorize transactions before outbound routing is written to the ledger block.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Interbank FX Conversion</h3>
          <p style="margin-bottom:20px;font-size:14px;color:#475569;">Exchange balances across USD, EUR, and GBP immediately at estimated wholesale conversion values, allowing real-time currency reallocation.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Identity Management & Compliance KYC</h3>
          <p style="margin-bottom:12px;font-size:14px;color:#475569;">We apply professional identity verification and tax classification checks to ensure profile compliance. Operators approve or reject onboarding queues securely from the operations console.</p>
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
          <h2 class="panel-title" style="color:#fff;font-size:14px;letter-spacing:0.05em;">Legal, Compliance & Disclaimers</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:16px;margin-bottom:24px;border-radius:4px;font-size:14px;color:#991b1b;font-weight:700;">
            ⚠️ CRITICAL REGULATORY NOTICE & DISCLAIMER:<br>
            THIS PLATFORM IS AN ENTIRELY SIMULATED DIGITAL banking environment. It is constructed solely for private demonstrations, software testing, and auditing purposes. No real monetary transactions, deposits, or withdrawals are processed. All funds, balances, account details, and payment cards are fictional.
          </div>
          
          <h3 style="color:#002C77;font-size:16px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">1. Purpose of Simulation</h3>
          <p style="margin-bottom:20px;font-size:13.5px;color:#475569;">The Meridian Trust Bank digital interface mimics a secure corporate offshore banking client portal to demonstrate multi-currency ledgers, administrative compliance controls, and SWIFT wire authorizations. No real-world deposits are held or protected by the FDIC or other financial regulators.</p>

          <h3 style="color:#002C77;font-size:16px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">2. Privacy & Data Integrity</h3>
          <p style="margin-bottom:20px;font-size:13.5px;color:#475569;">All personal details entered during registration are treated as simulated inputs. For compliance, please do not use your real-world banking passcodes or critical credentials.</p>

          <h3 style="color:#002C77;font-size:16px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">3. Anti-Money Laundering (AML) Compliance</h3>
          <p style="margin-bottom:12px;font-size:13.5px;color:#475569;">The system simulates real-time transaction intercept filters to block transfers under preset administrative rules. These blocks mimic regulatory holds for auditing exercises.</p>
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
          <h2 class="panel-title" style="color:#fff;font-size:14px;letter-spacing:0.05em;">About Meridian Trust Bank</h2>
        </div>
        <div class="panel-body" style="line-height:1.75;color:#334155;padding:32px;">
          <div style="background:#fee2e2;border-left:4px solid #b91c1c;padding:12px 18px;margin-bottom:24px;border-radius:4px;font-size:13.5px;color:#991b1b;font-weight:600;">
            ⚠️ Simulated System Notice: This about section describes a simulated banking concept for auditing and demonstration.
          </div>
          
          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Private Offshore Capital Preservation</h3>
          <p style="margin-bottom:20px;font-size:14px;color:#475569;">Meridian Trust represents a concept in full-reserve private offshore banking. In an era of fractional reserve exposure, our design prioritizes absolute ledger security and capital transparency.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Secure Offshore Custody Model</h3>
          <p style="margin-bottom:20px;font-size:14px;color:#475569;">Under our simulated framework, 100% of capital reserves are allocated directly to liquid short-term government instruments. This prevents lending exposure, offering immediate availability on settlement requests.</p>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

          <h3 style="color:#002C77;font-size:18px;margin-bottom:8px;font-family:'Roboto Condensed',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Digital Core Infrastructure</h3>
          <p style="margin-bottom:12px;font-size:14px;color:#475569;">With path-based admin consoles, dynamic transaction intercepts, and 2-phase MFA security, our core engineering represents a highly resilient system built for secure demonstration auditing.</p>
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

// ── DOM Value Helper ──────────────────────────────────────────────────────────
function v(id) { const el = document.getElementById(id); return el ? el.value : ''; }

// ── Start ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
