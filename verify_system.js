// Automatic verification script for Meridian Trust Bank Core APIs
const base = 'http://localhost:3000';

async function test() {
  console.log('--- STARTING SYSTEM INTEGRATION VERIFICATION ---');

  // 1. Generate unique details
  const randNum = Math.floor(Math.random() * 900000) + 100000;
  const username = `testuser_${randNum}`;
  const email = `testuser_${randNum}@example.com`;

  console.log(`[1] Submitting application for: ${username}...`);
  
  const applyPayload = {
    name: 'Auto Verifier User',
    email: email,
    phone: '+1 (555) 019-2831',
    address: '100 Core Ledger Blvd',
    state: 'NY',
    zip: '10001',
    ssn: `999-00-${randNum.toString().slice(-4)}`,
    accountType: 'personal',
    selectedAccounts: ['checking', 'savings']
  };

  const applyRes = await fetch(`${base}/api/auth/register-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(applyPayload)
  });

  const applyData = await applyRes.json();
  if (!applyRes.ok) {
    throw new Error(`Application submission failed: ${applyData.error || applyRes.statusText}`);
  }
  console.log('    -> Application Submitted Successfully:', applyData);

  // 2. Fetch pending applications to find the ID
  console.log('[2] Retrieving pending applications queue...');
  const appsRes = await fetch(`${base}/api/admin/applications`);
  const appsData = await appsRes.json();
  if (!appsRes.ok) {
    throw new Error(`Failed to retrieve applications: ${appsData.error}`);
  }
  
  const myApp = appsData.find(a => a.email === email);
  if (!myApp) {
    throw new Error(`Could not find the submitted application for email: ${email}`);
  }
  console.log(`    -> Application found. ID: ${myApp.id}`);

  // 3. Approve the application to generate user and account records
  console.log('[3] Approving pending application via admin console...');
  const approveRes = await fetch(`${base}/api/admin/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId: myApp.id })
  });
  const approveData = await approveRes.json();
  if (!approveRes.ok) {
    throw new Error(`Failed to approve application: ${approveData.error}`);
  }
  const userId = approveData.userId;
  console.log(`    -> Approval Successful! New User ID: ${userId}`);

  // 4. Retrieve users database from admin panel to find checking/savings seed info
  console.log('[4] Querying active client profiles explorer...');
  const usersRes = await fetch(`${base}/api/admin/users`);
  const usersData = await usersRes.json();
  if (!usersRes.ok) {
    throw new Error(`Failed to fetch admin users: ${usersData.error}`);
  }

  const userRecord = usersData.find(u => u.id === userId);
  if (!userRecord) {
    throw new Error(`Registered user ${userId} not found in admin database.`);
  }

  console.log(`    -> User found. wireStatus: ${userRecord.wireStatus}, wireBlockMessage: "${userRecord.wireBlockMessage}"`);
  if (userRecord.wireStatus !== 'ENABLED') {
    throw new Error(`Expected default wireStatus to be ENABLED, got: ${userRecord.wireStatus}`);
  }

  // Find checking account ID
  const checkingAccount = userRecord.accounts.find(a => a.type === 'checking');
  if (!checkingAccount) {
    throw new Error('Checking account was not seeded/created.');
  }
  const checkingAccId = checkingAccount.id;

  // 5. Test wire validation when ENABLED
  console.log('[5] Verifying wire transfers are allowed under default state...');
  const wirePayload = {
    userId: userId,
    accountId: checkingAccId,
    amount: 100.00,
    currency: 'USD',
    recipientName: 'Test Recipient',
    recipientAddress: '456 Receiver St',
    recipientBank: 'Chase Bank',
    swiftCode: 'CHASUS33XXX',
    routingNumber: '021000021',
    accountNumber: '987654321',
    description: 'Test Wire'
  };

  const wireRes = await fetch(`${base}/api/transactions/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wirePayload)
  });
  const wireData = await wireRes.json();
  console.log(`    -> Transaction response: status=${wireRes.status}, error="${wireData.error}"`);
  
  if (wireData.error && wireData.error.includes('restricted')) {
    throw new Error('Expected wire to not be restricted.');
  }

  // 6. Disable wire transfer permissions with a custom block message
  console.log('[6] Disabling wire permissions via Admin Control with a custom downtime message...');
  const blockMsg = 'Outbound wire transfers are temporarily unavailable due to scheduled system downtime. Please try again later.';
  const toggleRes = await fetch(`${base}/api/admin/user/toggle-wires`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      status: 'DISABLED',
      message: blockMsg
    })
  });
  const toggleData = await toggleRes.json();
  if (!toggleRes.ok) {
    throw new Error(`Failed to toggle wire status: ${toggleData.error}`);
  }
  console.log('    -> Admin API update successful:', toggleData);

  // 7. Verify the client dashboard intercept returns the exact message
  console.log('[7] Testing wire transaction send API with disabled status...');
  const blockedWireRes = await fetch(`${base}/api/transactions/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wirePayload)
  });
  const blockedWireData = await blockedWireRes.json();
  
  console.log(`    -> Blocked Response: status=${blockedWireRes.status}, error="${blockedWireData.error}"`);
  if (blockedWireRes.status !== 400) {
    throw new Error(`Expected HTTP 400, got ${blockedWireRes.status}`);
  }
  if (blockedWireData.error !== blockMsg) {
    throw new Error(`Expected block message: "${blockMsg}", got: "${blockedWireData.error}"`);
  }
  console.log('    -> Custom error message matching verified successfully.');

  // 8. Re-enable to clean up
  console.log('[8] Restoring wire permissions back to ENABLED...');
  const restoreRes = await fetch(`${base}/api/admin/user/toggle-wires`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      status: 'ENABLED',
      message: ''
    })
  });
  if (!restoreRes.ok) {
    throw new Error('Failed to restore wire transfers.');
  }
  console.log('    -> Wires re-enabled successfully.');

  console.log('--- ALL SYSTEMS VERIFICATION COMPLETED WITH 100% SUCCESS ---');
}

test().catch(err => {
  console.error('*** SYSTEM VERIFICATION FAILED ***');
  console.error(err);
  process.exit(1);
});
