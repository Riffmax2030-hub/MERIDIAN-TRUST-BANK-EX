# Customer Support Workflows & SOPs

To maintain the high-touch, premium feel required by offshore business clients, **Meridian Trust Bank** coordinates customer service through structured Standard Operating Procedures (SOPs).

---

## 1. Support Channels

- **Secure In-App Chat:** First-line support for authenticated clients. Resolves account inquiries, balance checks, and card freezing.
- **Dedicated Corporate Email:** `support@meridiantrust.com` for complex wire adjustments, corporate onboarding assistance, and compliance follow-ups.
- **Priority Phone Helpline:** Provided exclusively to premium business subscribers ($49/mo tier) for instant connection to their dedicated Account Manager.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-101: Wire Transfer Dispute & Trace
- **Trigger:** A client reports that an outgoing international wire transfer has not reached the recipient after 3 business days.
- **Steps:**
  1. Verify transaction status in the **Admin Dashboard**. Confirm the transaction status is `COMPLETED`.
  2. Retrieve the SWIFT message containing the **UETR (Unique End-to-End Transaction Reference)**.
  3. Provide the SWIFT MT103 document to the customer so their recipient can trace the payment with their local intermediary bank.
  4. If the funds bounce back due to incorrect IBAN/Routing, credit the client's account balance (deducting the external wire processing fee).

### SOP-102: Card Fraud & Chargeback Claims
- **Trigger:** Cardholder reports an unauthorized charge on their virtual or debit card.
- **Steps:**
  1. Direct the user to freeze the compromised card immediately in the app dashboard.
  2. If the user cannot access the dashboard, the Support Agent must look up the user's profile in the Admin panel and toggle the card status to `FROZEN`.
  3. Initiate a dispute file: gather merchant details, amount, currency, and date of transaction.
  4. Submit the dispute file to the payment network processor (Visa/Mastercard interchange portal) within 45 days.
  5. Provision a new virtual card for the client immediately.

### SOP-103: Account Access Recovery & Password Reset
- **Trigger:** User has locked their account due to multiple failed password attempts.
- **Steps:**
  1. Initiate out-of-band verification. The agent must place a phone call to the verified phone number or request an authenticated document upload.
  2. Once the identity is verified, the administrator goes to the admin dashboard, resets the user's password to a temporary string, and triggers an email containing the secure login credentials.
  3. Force a password change prompt upon the user's next login.
