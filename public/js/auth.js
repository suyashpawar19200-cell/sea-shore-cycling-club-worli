const role = window.location.pathname.includes('manager') ? 'manager' : 'admin';
const loginForm = document.getElementById('login-form');
const resetForm = document.getElementById('reset-form');
const toggleLinks = document.querySelectorAll('.toggle-reset, #toggle-reset');
const message = document.getElementById('message');
const resetSection = document.getElementById('reset-section');
const loginSection = document.getElementById('login-section');
const heading = document.getElementById('page-heading');

heading.textContent = `${role === 'manager' ? 'Manager' : 'Admin'} login`;

function showMessage(text, type = 'info') {
  message.textContent = text;
  message.className = `message ${type}`;
}

function setLoading(form, isLoading) {
  const button = form.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Please wait...' : button.dataset.defaultText;
  }
}

function showResetForm(show) {
  resetSection.classList.toggle('hidden', !show);
  loginSection.classList.toggle('hidden', show);
  resetForm.dataset.step = 'send';
  resetForm.otp.value = '';
  resetForm.password.value = '';
  resetForm.otp.disabled = !show;
  resetForm.password.disabled = !show;
  const submitButton = resetForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.textContent = 'Send OTP';
    submitButton.dataset.defaultText = 'Send OTP';
  }
  if (show) {
    showMessage('Enter your phone number to receive an OTP for password reset.', 'info');
  } else {
    showMessage('Use your phone and password to sign in.', 'info');
  }
}

loginForm.querySelector('button[type="submit"]').dataset.defaultText = 'Sign in';
resetForm.querySelector('button[type="submit"]').dataset.defaultText = 'Send OTP';

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('Signing in...', 'info');
  setLoading(loginForm, true);

  const payload = {
    phone: loginForm.phone.value.trim(),
    password: loginForm.password.value,
    role
  };

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  setLoading(loginForm, false);

  if (result.success) {
    localStorage.setItem('cycleride-token', result.token);
    window.location.href = role === 'manager' ? '/manager' : '/admin';
  } else {
    showMessage(result.error || 'Login failed', 'error');
  }
});

toggleLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    showResetForm(!loginSection.classList.contains('hidden'));
  });
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const currentStep = resetForm.dataset.step || 'send';

  if (currentStep === 'send') {
    showMessage('Requesting OTP...', 'info');
    setLoading(resetForm, true);
    const phone = resetForm.phone.value.trim();

    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, role })
    });
    const result = await response.json();
    setLoading(resetForm, false);

    if (result.success) {
      showMessage(result.message || 'OTP sent. Check your phone.', 'success');
      resetForm.dataset.step = 'verify';
      resetForm.otp.disabled = false;
      resetForm.password.disabled = false;
      resetForm.querySelector('button[type="submit"]').textContent = 'Reset password';
      resetForm.querySelector('button[type="submit"]').dataset.defaultText = 'Reset password';
    } else {
      showMessage(result.error || 'Unable to send OTP', 'error');
    }
  } else {
    showMessage('Verifying OTP...', 'info');
    setLoading(resetForm, true);
    const payload = {
      phone: resetForm.phone.value.trim(),
      otp: resetForm.otp.value.trim(),
      role,
      password: resetForm.password.value
    };
    const response = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setLoading(resetForm, false);

    if (result.success) {
      localStorage.setItem('cycleride-token', result.token);
      window.location.href = role === 'manager' ? '/manager' : '/admin';
    } else {
      showMessage(result.error || 'Unable to reset password', 'error');
    }
  }
});

showResetForm(false);
