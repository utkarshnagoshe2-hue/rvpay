const sidebar = document.querySelector('#sidebar');
const sidebarScrim = document.querySelector('#sidebar-scrim');
const toast = document.querySelector('#toast');
const breadcrumbTitle = document.querySelector('#breadcrumb-title');
const pageTitle = document.querySelector('#page-title');
const pageSubtitle = document.querySelector('#page-subtitle');
const topbarProfile = document.querySelector('#topbar-profile');
const profileDropdown = document.querySelector('#profile-dropdown');
let balanceVisibilityButton = document.querySelector('#balance-visibility-button');
const balanceModal = document.querySelector('#balance-modal');
const balanceForm = document.querySelector('#balance-form');
const balancePassword = document.querySelector('#balance-password');
const balanceMessage = document.querySelector('#balance-message');
const balanceValue = document.querySelector('#balance-value');
let toastTimer;

document.querySelector('.breadcrumb')?.remove();
document.querySelector('.nav-label')?.remove();
document.querySelector('.nav-item[data-view="overview"]')?.remove();

if (balanceVisibilityButton) balanceVisibilityButton.remove();
balanceVisibilityButton = document.createElement('button');
balanceVisibilityButton.className = 'balance-eye-button top-center-balance-eye';
balanceVisibilityButton.type = 'button';
balanceVisibilityButton.setAttribute('aria-label', 'Unlock balance');
balanceVisibilityButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z"/><circle cx="12" cy="12" r="2.2"/></svg>';
const topbarBalance = document.createElement('div');
topbarBalance.className = 'topbar-balance';
topbarBalance.innerHTML = '<span>Available balance</span>';
topbarBalance.append(balanceValue, balanceVisibilityButton);
document.querySelector('.metric-grid')?.remove();
document.querySelector('.topbar').append(topbarBalance);

const mobileRechargeTile = document.querySelector('.service-tile[data-service="FASTag"]');
if (mobileRechargeTile) {
  mobileRechargeTile.dataset.service = 'Mobile Recharge';
  mobileRechargeTile.innerHTML = '<span class="service-symbol service-symbol--mobile"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="7" width="20" height="34" rx="4"/><path d="M20 12h8M22 35h4"/></svg></span><strong>Mobile Recharge</strong><small>Recharge instantly</small>';
}

const renderProfile = (profile) => {
  const profileName = profile?.name || 'No profile data';
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  document.querySelectorAll('.avatar, .topbar-avatar').forEach((avatar) => {
    avatar.textContent = profileInitials;
  });
  document.querySelector('#profile-button')?.setAttribute('aria-label', `Open ${profileName} profile`);

  if (profile?.name) {
    document.querySelectorAll('.profile-card strong, .profile-dropdown strong').forEach((element) => {
      element.textContent = profile.name;
    });
    const sectionKicker = document.querySelector('.section-kicker');
    if (sectionKicker) sectionKicker.textContent = `Good morning, ${profile.name.split(' ')[0]}`;
  }
};

window.RVPayAPI?.getProfile().then(({ user }) => renderProfile(user)).catch(() => renderProfile(null));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarScrim.classList.remove('open');
}

document.querySelector('#menu-button').addEventListener('click', () => {
  sidebar.classList.add('open');
  sidebarScrim.classList.add('open');
});
document.querySelector('#sidebar-close').addEventListener('click', closeSidebar);
sidebarScrim.addEventListener('click', closeSidebar);
topbarProfile.addEventListener('click', () => {
  const isOpen = !profileDropdown.hidden;
  profileDropdown.hidden = isOpen;
  topbarProfile.setAttribute('aria-expanded', String(!isOpen));
});
document.querySelector('#topbar-logout').addEventListener('click', () => {
  sessionStorage.clear();
  window.RVPayAPI?.logout();
  window.location.href = 'index.html';
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.profile-menu')) {
    profileDropdown.hidden = true;
    topbarProfile.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    profileDropdown.hidden = true;
    topbarProfile.setAttribute('aria-expanded', 'false');
  }
});

function closeBalanceModal() {
  balanceModal.hidden = true;
  balancePassword.value = '';
  balanceMessage.textContent = '';
}

balanceVisibilityButton.addEventListener('click', () => {
  if (balanceValue.dataset.visible === 'true') {
    balanceValue.textContent = '••••••';
    balanceValue.dataset.visible = 'false';
    balanceVisibilityButton.setAttribute('aria-label', 'Unlock balance');
    balanceVisibilityButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z"/><circle cx="12" cy="12" r="2.2"/></svg>';
    return;
  }
  balanceModal.hidden = false;
  balanceMessage.textContent = sessionStorage.getItem('rvpay-api-token')
    ? ''
    : 'Please log in first, then open this popup again.';
  balancePassword.focus();
});
document.querySelector('#close-balance-modal').addEventListener('click', closeBalanceModal);
balanceModal.addEventListener('click', (event) => {
  if (event.target === balanceModal) closeBalanceModal();
});
balanceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const authToken = sessionStorage.getItem('rvpay-api-token');
  if (!authToken) {
    balanceMessage.textContent = 'Please log in first to unlock your balance.';
    return;
  }
  balanceValue.textContent = '₹24,680.00';
  balanceValue.dataset.visible = 'true';
  balanceVisibilityButton.setAttribute('aria-label', 'Hide balance');
  balanceVisibilityButton.querySelector('span').textContent = 'Balance visible';
  closeBalanceModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !balanceModal.hidden) closeBalanceModal();
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');
    const title = item.textContent.trim();
    if (breadcrumbTitle) breadcrumbTitle.textContent = title;
    if (item.dataset.service) {
      showToast(`${item.dataset.service} is ready to use.`);
    } else {
      pageTitle.textContent = title === 'Overview' ? 'Your business at a glance' : title;
      pageSubtitle.textContent = title === 'Overview' ? 'Monitor your balance, services, and daily activity.' : `${title} will appear here as your account grows.`;
    }
    closeSidebar();
  });
});

document.querySelectorAll('.service-tile').forEach((tile) => {
  tile.addEventListener('click', () => showToast(`${tile.dataset.service} selected.`));
});

document.querySelector('#export-button').addEventListener('click', () => showToast('Report export is being prepared.'));
document.querySelector('.notice-bar button').addEventListener('click', (event) => event.currentTarget.closest('.notice-bar').remove());
