const contactInput = document.querySelector('#login-contact');
const passwordInput = document.querySelector('#password');
const togglePassword = document.querySelector('#toggle-password');
const loginForm = document.querySelector('#login-form');
const formMessage = document.querySelector('#form-message');

togglePassword.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const contact = contactInput.value.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const normalizedMobile = contact.replace(/[()+\s-]/g, '');
  const isMobile = /^(?:91)?[6-9]\d{9}$/.test(normalizedMobile);

  if (!isEmail && !isMobile) {
    formMessage.textContent = 'Please enter a valid email address or mobile number.';
    contactInput.focus();
    return;
  }

  try {
    await window.RVPayAPI.login(contact, passwordInput.value);
  } catch (error) {
    formMessage.textContent = error.message;
    return;
  }
  formMessage.textContent = 'Login successful. Opening your dashboard...';
  window.setTimeout(() => { window.location.href = 'dashboard.html'; }, 450);
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = link.getAttribute('href');
    if (target === '#') event.preventDefault();
    if (target === '#forgot' || target === '#register') {
      event.preventDefault();
      formMessage.textContent = target === '#forgot' ? 'Password recovery will be available here.' : 'Account registration will be available here.';
    }
  });
});
