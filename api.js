window.RVPayAPI = (() => {
  const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const baseUrl = isLocalFrontend
    ? 'http://localhost:3000/api'
    : 'https://rvpay.onrender.com/api';
  const tokenKey = 'rvpay-api-token';

  const request = async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = sessionStorage.getItem(tokenKey);
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    if (!response.ok) {
      const error = new Error((await response.json().catch(() => ({}))).error || 'Backend request failed.');
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };

  const saveSession = (payload) => {
    if (payload.token) sessionStorage.setItem(tokenKey, payload.token);
  };

  return {
    request,
    saveSession,
    login: async (contact, password) => { const payload = await request('/auth/login', { method: 'POST', body: JSON.stringify({ contact, password }) }); saveSession(payload); return payload; },
    register: async (account, password) => { const payload = await request('/auth/register', { method: 'POST', body: JSON.stringify({ ...account, password }) }); saveSession(payload); return payload; },
    requestPasswordReset: async (contact) => request('/password-reset/request', { method: 'POST', body: JSON.stringify({ contact }) }),
    resetPassword: async (token, password) => request('/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }),
    getProfile: async () => request('/profile'),
    updateProfile: async (profile) => request('/profile', { method: 'PUT', body: JSON.stringify(profile) }),
    getAccounts: async () => request('/accounts'),
    addAccount: async (account) => request('/accounts', { method: 'POST', body: JSON.stringify(account) }),
    deleteAccount: async (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
    getBeneficiaries: async () => request('/beneficiaries'),
    addBeneficiary: async (beneficiary) => request('/beneficiaries', { method: 'POST', body: JSON.stringify(beneficiary) }),
    updateBeneficiary: async (id, beneficiary) => request(`/beneficiaries/${id}`, { method: 'PUT', body: JSON.stringify(beneficiary) }),
    deleteBeneficiary: async (id) => request(`/beneficiaries/${id}`, { method: 'DELETE' }),
    getTransactions: async () => request('/transactions'),
    createTransaction: async (transaction) => request('/transactions', { method: 'POST', body: JSON.stringify(transaction) }),
    createPayout: async (payout) => request('/payments/payout', { method: 'POST', body: JSON.stringify(payout) }),
    getAdminOverview: async () => request('/admin/overview'),
    getAdminActivity: async () => request('/admin/activity'),
    getAdminUsers: async () => request('/admin/users'),
    getAdminUserDetails: async (id) => request(`/admin/users/${id}`),
    getAdminAccounts: async () => request('/admin/accounts'),
    getAdminTransactions: async () => request('/admin/transactions'),
    setAdminTransactionStatus: async (id, status, note = '') => request(`/admin/transactions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
    setAdminUserBlocked: async (id, blocked) => request(`/admin/users/${id}/block`, { method: 'PATCH', body: JSON.stringify({ blocked }) }),
    deleteAdminUser: async (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    logout: async () => { sessionStorage.removeItem(tokenKey); },
  };
})();
