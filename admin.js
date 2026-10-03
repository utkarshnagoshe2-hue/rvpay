let users = [];
let transactions = [];

const createCell = (value) => {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
  return cell;
};

const setAdminError = (error) => {
  const message = document.querySelector('#admin-message');
  if (message) message.textContent = error.message;
};

const renderDashboard = async () => {
  try {
    const [overview, accountResponse] = await Promise.all([
      window.RVPayAPI.getAdminOverview(),
      window.RVPayAPI.getAdminAccounts(),
    ]);
    document.querySelector('#total-users').textContent = overview.users;
    document.querySelector('#total-accounts').textContent = overview.accounts;
    document.querySelector('#total-transactions').textContent = overview.transactions;

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
    actions.append(blockButton, deleteButton);
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
  body.replaceChildren();

  const filteredTransactions = transactions.filter((transaction) => {
    const recipient = transaction.recipient || transaction.recipientName || '';
    const userName = transaction.user?.name || '';
    const text = `${transaction.transactionId || ''} ${recipient} ${userName} ${transaction.amount || ''} ${transaction.status || ''}`.toLowerCase();
    if (!text.includes(query)) return false;
    if (!dateFilter) return true;
    const date = new Date(transaction.date || transaction.createdAt);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateFilter;
  }).sort((first, second) => new Date(second.date || second.createdAt) - new Date(first.date || first.createdAt));

  empty.hidden = filteredTransactions.length > 0;
  filteredTransactions.forEach((transaction) => {
    const row = document.createElement('tr');
    const date = new Date(transaction.date || transaction.createdAt);
    row.append(
      createCell(transaction.transactionId),
      createCell(transaction.user?.name || transaction.recipient || transaction.recipientName),
      createCell(`₹${Number(transaction.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`),
      createCell(Number.isFinite(date.getTime()) ? date.toLocaleString('en-IN') : 'Date unavailable'),
      createCell(transaction.status),
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

const setupAdminPage = () => {
  if (document.querySelector('#total-users')) renderDashboard();
  if (document.querySelector('#users-body')) {
    document.querySelector('#user-search').addEventListener('input', renderUsers);
    loadUsers();
  }
  if (document.querySelector('#transactions-body')) {
    document.querySelector('#transaction-search').addEventListener('input', renderTransactions);
    document.querySelector('#transaction-date').addEventListener('change', renderTransactions);
    loadTransactions();
  }
};

document.addEventListener('DOMContentLoaded', setupAdminPage);
