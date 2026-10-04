const resetForm = document.querySelector('#reset-password-form');
const newPassword = document.querySelector('#new-password');
const confirmPassword = document.querySelector('#confirm-password');
const resetButton = resetForm.querySelector('.submit-button');
const resetMessage = document.querySelector('#reset-message');
const resetToken = new URLSearchParams(window.location.search).get('token') || '';

if (resetToken) {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('token');
  window.history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
}

if (!/^[a-f\d]{64}$/i.test(resetToken)) {
  resetForm.hidden = true;
  resetMessage.classList.add('form-message--error');
  resetMessage.textContent = 'This reset link is missing or invalid. Request a new one to continue.';
}

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = newPassword.value;

  if (password !== confirmPassword.value) {
    resetMessage.classList.add('form-message--error');
    resetMessage.textContent = 'The passwords do not match.';
    confirmPassword.focus();
    return;
  }
  if (new TextEncoder().encode(password).length > 72) {
    resetMessage.classList.add('form-message--error');
    resetMessage.textContent = 'Password must not exceed 72 UTF-8 bytes.';
    newPassword.focus();
    return;
  }

  resetButton.disabled = true;
  resetButton.querySelector('span').textContent = '...';
  resetMessage.classList.remove('form-message--error');
  resetMessage.textContent = 'Updating password...';
  try {
    const result = await window.RVPayAPI.resetPassword(resetToken, password);
    resetMessage.textContent = result.message || 'Password has been reset.';
    resetForm.hidden = true;
  } catch (error) {
    resetMessage.classList.add('form-message--error');
    resetMessage.textContent = error.status === 400
      ? 'This reset link is invalid or has expired. Request a new one to continue.'
      : error.message || 'Unable to reset your password. Try again.';
  } finally {
    resetButton.disabled = false;
    resetButton.querySelector('span').textContent = '\u2192';
  }
});