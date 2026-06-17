# Product Requirements Document (PRD) & User Stories

## 1. Project Overview & Objectives
The goal is to build **Meridian Trust Bank**, a secure, highly performant, and sophisticated offshore digital banking platform. The platform supports checking, savings, and money market accounts, personal and business profiles, multi-currency wallets (USD, EUR, GBP), debit/virtual card issuing, international transfers, backdated payments, and an administrative dashboard.

---

## 2. Scope of Features

### A. Authentication & Onboarding
- **Self-Service Registration:** Users can sign up for either a **Personal** or **Business** account.
- **Auto-Generated Credentials:** Upon registration, the system auto-generates a secure **User ID** and a temporary/default password (with the recommendation to change it).
- **Automated Account Provisioning:** Every new user is automatically assigned:
  1. A Checking Account (with generated Routing/Account Numbers for USD, EUR, and GBP).
  2. A Savings Account (with competitive interest accrual tracking).
  3. A Money Market Account (for higher-yield investment holdings).

### B. Account & Portfolio Dashboard
- **Multi-Currency Wallets:** View aggregate balances converted into a base currency (USD) or toggle individual wallet views for USD, EUR, and GBP.
- **Card Panel:** Interactive debit card and virtual cards interface. Users can view card numbers, expiration dates, CVVs, and toggle the card's freeze/unfreeze status.

### C. Transfer System (Send & Receive)
- **Send Money (Outbound Wire):** Users can send funds internally to another User ID, or externally via SWIFT/Routing numbers.
- **Receive Money (Inbound Wire):** Users can simulate an incoming deposit to check functionality.
- **Backdated Payments:** The key system capability: when making or receiving payments, users can specify a historical date (e.g., last month) instead of the current system time, enabling past transaction recording.

### D. Compliance & KYC Workflow
- Users are assigned a KYC status: `PENDING`, `APPROVED`, or `REJECTED`.
- Transactions above certain thresholds generate compliance warnings, which require admin review.

### E. Internal Admin Dashboard
- **User Management:** Administrators can see all users, their profiles (Personal/Business), and KYC statuses.
- **KYC Control:** Approve or reject KYC requests.
- **Balance Adjuster:** Manually credit or debit user balances across accounts.
- **Audit Ledger Controls:** Create, edit, or delete transaction history logs, including overriding transaction dates (backdating).

---

## 3. User Stories

### Client Onboarding & Session
- **US-1:** *As a new business owner, I want to register for a Meridian Trust account so that I can hold offshore funds.*
- **US-2:** *As a registered client, I want the system to generate a unique login ID so that I don't have to choose one that conflicts with other users.*
- **US-3:** *As a user, I want to log in using my secure User ID and password so that I can access my private dashboard.*

### Banking & Money Management
- **US-4:** *As a business client, I want to manage separate Checking, Savings, and Money Market accounts in USD, EUR, and GBP so that I can organize company cash flow.*
- **US-5:** *As a global merchant, I want to send an international wire transfer and choose the transaction date (backdate) so that my bookkeeping matches the exact date my contract was executed.*
- **US-6:** *As a client, I want to simulate receiving funds from an offshore partner so that I can verify my account details work.*

### Cards
- **US-7:** *As a client, I want to instantly provision a virtual card so that I can securely complete online corporate purchases.*
- **US-8:** *As a cardholder, I want to freeze my card instantly in the app if it is misplaced, and unfreeze it when found.*

### Administrative Oversight
- **US-9:** *As an administrative officer, I want to review all registered client accounts and their balances in real-time so that I can detect anomalies.*
- **US-10:** *As a compliance officer, I want to override transaction records and change dates or amounts to correct data errors or reconcile offshore audits.*
