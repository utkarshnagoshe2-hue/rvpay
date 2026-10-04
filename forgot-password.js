const recoveryForm = document.querySelector('#recovery-form');
const recoveryContact = document.querySelector('#recovery-contact');
const resetButton = recoveryForm.querySelector('.submit-button');
const recoveryMessage = document.querySelector('#recovery-message');

recoveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const contact = recoveryContact.value.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const normalizedMobile = contact.replace(/[()+\s-]/g, '');
  const isMobile = /^(?:91)?[6-9]\d{9}$/.test(normalizedMobile);

  if (!isEmail && !isMobile) {
    recoveryMessage.textContent = 'Please enter a valid registered mobile number or email.';
    return;
  }

  resetButton.disabled = true;
  resetButton.querySelector('span').textContent = '...';
  recoveryMessage.classList.remove('form-message--error');
  recoveryMessage.textContent = 'Sending reset instructions...';
  try {
    const result = await window.RVPayAPI.requestPasswordReset(contact);
    recoveryMessage.textContent = result.message || 'If an account matches, reset instructions will be sent shortly.';
    recoveryForm.reset();
  } catch (error) {
    recoveryMessage.classList.add('form-message--error');
    recoveryMessage.textContent = error.message || 'Unable to send reset instructions. Try again.';
  } finally {
    resetButton.disabled = false;
    resetButton.querySelector('span').textContent = '\u2192';
  }
});
