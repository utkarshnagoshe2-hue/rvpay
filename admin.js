let users = [];
let accounts = [];
let transactions = [];
let userDetailsRequestId = 0;
const nextTransactionStatuses = {
  Pending: ['Approved', 'Failed', 'Cancelled'],
  Approved: ['Processing', 'Failed', 'Cancelled'],
  Processing: ['Success', 'Failed'],
  Success: [],
  Failed: [],
  Cancelled: [],
};

const createCell = (value) => {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
  return cell;
};

const setAdminError = (error) => {
  const message = document.querySelector('#admin-message');
  if (message) message.textContent = error.message;
};

const formatAdminDate = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('en-IN') : 'Date unavailable';
};

const renderActivity = (activity) => {
  const body = document.querySelector('#admin-activity-body');
  const empty = document.querySelector('#admin-activity-empty');
  if (!body || !empty) return;
  body.replaceChildren();
  empty.hidden = activity.length > 0;
  activity.forEach((entry) => {
    const row = document.createElement('tr');
    row.append(
      createCell(entry.actor?.name || entry.actor?.email || 'System'),
      createCell(String(entry.action || '').replace(/[._]/g, ' ')),
      createCell(`${entry.entityType || 'Record'}${entry.entityId ? ` · ${entry.entityId}` : ''}`),
      createCell(formatAdminDate(entry.createdAt)),
    );
    body.append(row);
  });
};

const renderDashboard = async (overview) => {
  try {
    const [accountResponse, activityResponse] = await Promise.all([
      window.RVPayAPI.getAdminAccounts(),
      window.RVPayAPI.getAdminActivity(),
    ]);
    document.querySelector('#total-users').textContent = overview.users;
    document.querySelector('#total-accounts').textContent = overview.accounts;
    document.querySelector('#total-transactions').textContent = overview.transactions;
    document.querySelector('#total-volume').textContent = `₹${Number(overview.transactionVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    document.querySelector('#pending-transactions').textContent = overview.pendingTransactions || 0;
    renderActivity(activityResponse.activity || []);

    const body = document.querySelector('#admin-accounts-body');
    const empty = document.querySelector('#admin-accounts-empty');
    if (!body || !empty) return;
    body.replaceChildren();
    empty.hidden = accountResponse.accounts.length > 0;
    accountResponse.accounts.forEach((account) => {
      const row = document.createElement('tr');
      row.append(
        createCell(account.user?.name || 'Unknown user'),
        createCell(account.user?.email || ''),
        createCell(account.bankName),
        createCell(account.accountHolder),
        createCell(account.accountNumberMasked),
        createCell(account.ifsc),
      );
      body.append(row);
    });
  } catch (error) {
    setAdminError(error);
  }
};

const openUserDetails = async (userId) => {
  const dialog = document.querySelector('#user-details-dialog');
  if (!dialog) return;
  const requestId = ++userDetailsRequestId;
  const fields = ['name', 'email', 'phone', 'role', 'status', 'created', 'accounts', 'transactions', 'beneficiaries'];
  fields.forEach((field) => {
    document.querySelector(`#user-detail-${field}`).textContent = 'Loading...';
  });
  if (!dialog.open) dialog.showModal();

  try {
    const response = await window.RVPayAPI.getAdminUserDetails(userId);
    if (requestId !== userDetailsRequestId) return;
    const { user, summary } = response;
    document.querySelector('#user-detail-name').textContent = user.name || 'Not available';
    document.querySelector('#user-detail-email').textContent = user.email || 'Not available';
    document.querySelector('#user-detail-phone').textContent = user.phone || 'Not available';
    document.querySelector('#user-detail-role').textContent = user.role || 'User';
    document.querySelector('#user-detail-status').textContent = user.isBlocked ? 'Blocked' : 'Active';
    document.querySelector('#user-detail-created').textContent = formatAdminDate(user.createdAt);
    document.querySelector('#user-detail-accounts').textContent = summary.accounts;
    document.querySelector('#user-detail-transactions').textContent = summary.transactions;
    document.querySelector('#user-detail-beneficiaries').textContent = summary.beneficiaries;
  } catch (error) {
    if (requestId !== userDetailsRequestId) return;
    document.querySelector('#user-detail-name').textContent = error.message;
  }
};

const renderUsers = () => {
  const body = document.querySelector('#users-body');
  const empty = document.querySelector('#users-empty');
  const query = document.querySelector('#user-search').value.trim().toLowerCase();
  body.replaceChildren();
  const filteredUsers = users.filter((user) => `${user.name || ''} ${user.email || ''} ${user.phone || ''}`.toLowerCase().includes(query));
  empty.hidden = filteredUsers.length > 0;
  if (!filteredUsers.length && !users.length) empty.textContent = 'No users found.';

  filteredUsers.forEach((user) => {
    const row = document.createElement('tr');
    const status = document.createElement('span');
    status.className = `admin-badge${user.isBlocked ? ' blocked' : ''}`;
    status.textContent = user.isBlocked ? 'Blocked' : 'Active';
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    const detailsButton = document.createElement('button');
    detailsButton.className = 'admin-detail-link';
    detailsButton.type = 'button';
    detailsButton.textContent = 'Details';
    detailsButton.addEventListener('click', () => openUserDetails(user._id));
    const blockButton = document.createElement('button');
    blockButton.className = 'admin-button admin-button--muted';
    blockButton.type = 'button';
    blockButton.textContent = user.isBlocked ? 'Unblock' : 'Block';
    blockButton.addEventListener('click', async () => {
      blockButton.disabled = true;
      try {
        const result = await window.RVPayAPI.setAdminUserBlocked(user._id, !user.isBlocked);
        users = users.map((item) => item._id === user._id ? result.user : item);
        renderUsers();
      } catch (error) {
        setAdminError(error);
        blockButton.disabled = false;
      }
    });
    const deleteButton = document.createElement('button');
    deleteButton.className = 'admin-button admin-button--danger';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${user.name || user.email} and their linked data?`)) return;
      deleteButton.disabled = true;
      try {
        await window.RVPayAPI.deleteAdminUser(user._id);
        users = users.filter((item) => item._id !== user._id);
        renderUsers();
      } catch (error) {
        setAdminError(error);
        deleteButton.disabled = false;
      }
    });
    actions.append(detailsButton, blockButton, deleteButton);
    row.append(createCell(user.name), createCell(user.email), createCell(user.phone));
    const statusCell = document.createElement('td');
    statusCell.append(status);
    row.append(statusCell);
    const actionCell = document.createElement('td');
    actionCell.append(actions);
    row.append(actionCell);
    body.append(row);
  });
};

const renderAccounts = () => {
  const body = document.querySelector('#accounts-body');
  const empty = document.querySelector('#accounts-empty');
  const query = document.querySelector('#account-search').value.trim().toLowerCase();
  const filteredAccounts = accounts.filter((account) => (
    `${account.user?.name || ''} ${account.user?.email || ''} ${account.bankName || ''} ${account.accountHolder || ''} ${account.accountNumberMasked || ''} ${account.ifsc || ''}`
      .toLowerCase()
      .includes(query)
  ));
  body.replaceChildren();
  empty.hidden = filteredAccounts.length > 0;
  empty.textContent = accounts.length && query ? 'No linked accounts match your search.' : 'No linked accounts found.';
  filteredAccounts.forEach((account) => {
    const row = document.createElement('tr');
    const ownerCell = document.createElement('td');
    if (account.user?.id) {
      const ownerLink = document.createElement('a');
      ownerLink.className = 'admin-detail-link';
      ownerLink.href = `admin-users.html?userId=${encodeURIComponent(account.user.id)}`;
      ownerLink.textContent = 'View owner';
      ownerCell.append(ownerLink);
    } else {
      ownerCell.textContent = 'Owner unavailable';
    }
    row.append(
      createCell(account.user?.name || 'Unknown user'),
      createCell(account.user?.email || ''),
      createCell(account.bankName),
      createCell(account.accountHolder),
      createCell(account.accountNumberMasked),
      createCell(account.ifsc),
      ownerCell,
    );
    body.append(row);
  });
};

const loadAdminAccounts = async () => {
  const empty = document.querySelector('#accounts-empty');
  empty.textContent = 'Loading linked accounts...';
  empty.hidden = false;
  try {
    const response = await window.RVPayAPI.getAdminAccounts();
    accounts = response.accounts || [];
    renderAccounts();
  } catch (error) {
    empty.textContent = error.message;
    setAdminError(error);
  }
};

const showTransactionDetails = (transaction) => {
  const dialog = document.querySelector('#transaction-details');
  const details = {
    'detail-transaction-id': transaction.transactionId,
    'detail-user': transaction.user?.name || 'Unknown user',
    'detail-email': transaction.user?.email || 'Not available',
    'detail-recipient': transaction.recipient || transaction.recipientName || 'Not available',
    'detail-amount': `₹${Number(transaction.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    'detail-status': transaction.status || 'Not available',
    'detail-date': formatAdminDate(transaction.date),
    'detail-created': formatAdminDate(transaction.createdAt),
  };
  Object.entries(details).forEach(([id, value]) => {
    document.querySelector(`#${id}`).textContent = value;
  });
  const historyList = document.querySelector('#status-history-list');
  const historyEmpty = document.querySelector('#status-history-empty');
  const history = transaction.statusHistory?.length
    ? transaction.statusHistory
    : [{ status: transaction.status, changedAt: transaction.createdAt || transaction.date, note: 'Initial status' }];
  historyList.replaceChildren();
  historyEmpty.hidden = history.length > 0;
  history.forEach((entry) => {
    const item = document.createElement('li');
    const status = document.createElement('strong');
    status.textContent = entry.status;
    const metadata = document.createElement('span');
    const actor = entry.changedBy?.name || entry.changedBy?.email || (entry.note === 'Initial status' ? 'Original record' : 'Administrator');
    metadata.textContent = `${actor} · ${formatAdminDate(entry.changedAt)}`;
    item.append(status, metadata);
    if (entry.note) {
      const note = document.createElement('p');
      note.textContent = entry.note;
      item.append(note);
    }
    historyList.append(item);
  });
  dialog.showModal();
};

const loadUsers = async () => {
  const empty = document.querySelector('#users-empty');
  empty.textContent = 'Loading users...';
  empty.hidden = false;
  try {
    const response = await window.RVPayAPI.getAdminUsers();
    users = response.users || [];
    renderUsers();
  } catch (error) {
    empty.textContent = error.message;
    setAdminError(error);
  }
};

const renderTransactions = () => {
  const body = document.querySelector('#transactions-body');
  const empty = document.querySelector('#transactions-empty');
  const query = document.querySelector('#transaction-search').value.trim().toLowerCase();
  const dateFilter = document.querySelector('#transaction-date').value;
  const statusFilter = document.querySelector('#transaction-status').value;
  body.replaceChildren();

  const filteredTransactions = transactions.filter((transaction) => {
    const recipient = transaction.recipient || transaction.recipientName || '';
    const userName = transaction.user?.name || '';
    const text = `${transaction.transactionId || ''} ${recipient} ${userName} ${transaction.amount || ''} ${transaction.status || ''}`.toLowerCase();
    if (!text.includes(query)) return false;
    if (statusFilter && transaction.status !== statusFilter) return false;
    if (!dateFilter) return true;
    const date = new Date(transaction.date || transaction.createdAt);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateFilter;
  }).sort((first, second) => new Date(second.date || second.createdAt) - new Date(first.date || first.createdAt));

  empty.hidden = filteredTransactions.length > 0;
  filteredTransactions.forEach((transaction) => {
    const row = document.createElement('tr');
    const date = new Date(transaction.date || transaction.createdAt);
    const idCell = document.createElement('td');
    const detailsButton = document.createElement('button');
    detailsButton.className = 'admin-detail-link';
    detailsButton.type = 'button';
    detailsButton.textContent = transaction.transactionId || 'View details';
    detailsButton.setAttribute('aria-label', `View details for transaction ${transaction.transactionId || ''}`);
    detailsButton.addEventListener('click', () => showTransactionDetails(transaction));
    idCell.append(detailsButton);
    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `admin-badge admin-badge--status ${String(transaction.status || '').toLowerCase()}`;
    statusBadge.textContent = transaction.status || 'Unknown';
    statusCell.append(statusBadge);
    const availableStatuses = nextTransactionStatuses[transaction.status] || [];
    if (availableStatuses.length) {
      const controls = document.createElement('div');
      controls.className = 'admin-status-control';
      const statusSelect = document.createElement('select');
      statusSelect.setAttribute('aria-label', `Next status for ${transaction.transactionId}`);
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Set status';
      statusSelect.append(placeholder);
      availableStatuses.forEach((nextStatus) => {
        const option = document.createElement('option');
        option.value = nextStatus;
        option.textContent = nextStatus;
        statusSelect.append(option);
      });
      const updateButton = document.createElement('button');
      updateButton.className = 'admin-button admin-button--muted';
      updateButton.type = 'button';
      updateButton.textContent = 'Update';
      updateButton.disabled = true;
      statusSelect.addEventListener('change', () => { updateButton.disabled = !statusSelect.value; });
      updateButton.addEventListener('click', async () => {
        updateButton.disabled = true;
        try {
          const transactionId = String(transaction._id || transaction.id || transaction.transactionId);
          const response = await window.RVPayAPI.setAdminTransactionStatus(transactionId, statusSelect.value);
          transactions = transactions.map((item) => (
            String(item._id || item.id || item.transactionId) === transactionId
              ? { ...item, status: response.transaction.status, statusHistory: response.transaction.statusHistory }
              : item
          ));
          renderTransactions();
        } catch (error) {
          setAdminError(error);
          updateButton.disabled = false;
        }
      });
      controls.append(statusSelect, updateButton);
      statusCell.append(controls);
    }
    row.append(
      idCell,
      createCell(transaction.user?.name || transaction.recipient || transaction.recipientName),
      createCell(`₹${Number(transaction.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`),
      createCell(Number.isFinite(date.getTime()) ? date.toLocaleString('en-IN') : 'Date unavailable'),
      statusCell,
    );
    body.append(row);
  });
};

const loadTransactions = async () => {
  const empty = document.querySelector('#transactions-empty');
  empty.textContent = 'Loading transactions...';
  empty.hidden = false;
  try {
    const response = await window.RVPayAPI.getAdminTransactions();
    transactions = response.transactions || [];
    renderTransactions();
  } catch (error) {
    empty.textContent = error.message;
    setAdminError(error);
  }
};

const handleAdminLogin = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = document.querySelector('#admin-login-message');
  const contact = form.elements.contact.value.trim();
  const password = form.elements.password.value;
  button.disabled = true;
  button.textContent = 'Checking access...';
  message.textContent = '';
  let authenticated = false;

  try {
    await window.RVPayAPI.logout();
    await window.RVPayAPI.login(contact, password);
    authenticated = true;
    await window.RVPayAPI.getAdminOverview();
    window.location.assign('admin-dashboard.html');
  } catch (error) {
    await window.RVPayAPI.logout();
    message.textContent = authenticated && error.status === 403
      ? 'This account does not have administrator access.'
      : error.message;
    button.disabled = false;
    button.textContent = 'Sign in';
  }
};

const setupAdminPage = async () => {
  const loginForm = document.querySelector('#admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleAdminLogin);
    return;
  }

  document.querySelectorAll('[data-admin-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.RVPayAPI.logout();
      window.location.assign('admin-login.html');
    });
  });

  let overview;
  try {
    overview = await window.RVPayAPI.getAdminOverview();
  } catch (error) {
    if (error.status === 401) {
      await window.RVPayAPI.logout();
      window.location.assign('admin-login.html');
    } else if (error.status === 403) {
      window.location.assign('dashboard.html');
    } else {
      setAdminError(error);
    }
    return;
  }

  if (document.querySelector('#total-users')) renderDashboard(overview);
  if (document.querySelector('#users-body')) {
    document.querySelector('#user-search').addEventListener('input', renderUsers);
    document.querySelector('[data-close-user-details]').addEventListener('click', () => {
      document.querySelector('#user-details-dialog').close();
    });
    loadUsers();
    const requestedUserId = new URLSearchParams(window.location.search).get('userId');
    if (requestedUserId) openUserDetails(requestedUserId);
  }
  if (document.querySelector('#accounts-body')) {
    document.querySelector('#account-search').addEventListener('input', renderAccounts);
    loadAdminAccounts();
  }
  if (document.querySelector('#transactions-body')) {
    ['Approved', 'Processing'].forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      document.querySelector('#transaction-status').append(option);
    });
    document.querySelector('#transaction-search').addEventListener('input', renderTransactions);
    document.querySelector('#transaction-date').addEventListener('change', renderTransactions);
    document.querySelector('#transaction-status').addEventListener('change', renderTransactions);
    document.querySelector('[data-close-details]').addEventListener('click', () => {
      document.querySelector('#transaction-details').close();
    });
    loadTransactions();
  }
};

document.addEventListener('DOMContentLoaded', setupAdminPage);
