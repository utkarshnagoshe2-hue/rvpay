const registerForm = document.querySelector('#register-form');
const registerPassword = document.querySelector('#register-password');
const confirmPassword = document.querySelector('#confirm-password');
const toggleRegisterPassword = document.querySelector('#toggle-register-password');
const registerMessage = document.querySelector('#register-message');
const phoneInput = document.querySelector('#phone');
const submitButton = registerForm.querySelector('.submit-button');

toggleRegisterPassword.addEventListener('click', () => {
  const isPassword = registerPassword.type === 'password';
  registerPassword.type = isPassword ? 'text' : 'password';
  confirmPassword.type = isPassword ? 'text' : 'password';
  toggleRegisterPassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  confirmPassword.setCustomValidity('');

  const phone = phoneInput.value.trim();
  const normalizedPhone = phone.replace(/[()+\s-]/g, '');
  const validPhone = /^(?:91)?[6-9]\d{9}$/.test(normalizedPhone);
  if (!validPhone) {
    phoneInput.setCustomValidity('Enter a valid 10-digit mobile number.');
    phoneInput.reportValidity();
    registerMessage.textContent = 'Please enter a valid mobile number.';
    return;
  }

  if (registerPassword.value !== confirmPassword.value) {
    confirmPassword.setCustomValidity('Passwords do not match.');
    confirmPassword.reportValidity();
    registerMessage.textContent = 'Please make sure both passwords match.';
    return;
  }
  const account = {
    name: document.querySelector('#full-name').value.trim(),
    email: document.querySelector('#register-email').value.trim(),
    phone: normalizedPhone,
  };
  try {
    await window.RVPayAPI.register(account, registerPassword.value);
  } catch (error) {
    registerMessage.textContent = error.message;
    return;
  }
  submitButton.disabled = true;
  registerMessage.textContent = 'Account created. Opening your dashboard...';
  window.setTimeout(() => { window.location.href = 'dashboard.html'; }, 650);
});

confirmPassword.addEventListener('input', () => {
  confirmPassword.setCustomValidity(registerPassword.value === confirmPassword.value ? '' : 'Passwords do not match.');
});

phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));
