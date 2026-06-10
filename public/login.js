let mode = 'login';

function switchTab(tab) {
  mode = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('submit-btn').textContent = tab === 'login' ? 'LOG IN' : 'SIGN UP';
  document.getElementById('password').autocomplete = tab === 'login' ? 'current-password' : 'new-password';
  document.getElementById('confirm-wrap').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('invite-wrap').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('hint').style.display = tab === 'signup' ? '' : 'none';
  if (tab === 'login') document.getElementById('confirm').value = '';
  document.getElementById('error').textContent = '';
}

function togglePwd(id) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function handleSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  const btn = document.getElementById('submit-btn');
  errorEl.textContent = '';
  btn.disabled = true;

  if (mode === 'signup') {
    const confirm = document.getElementById('confirm').value;
    if (password !== confirm) {
      errorEl.textContent = "Passwords don't match";
      btn.disabled = false;
      return;
    }
  }

  try {
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const body = { email, password };
    if (mode === 'signup') body.inviteCode = (document.getElementById('invite').value || '').trim();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Something went wrong';
      return;
    }
    localStorage.setItem('forge_token', data.token);
    window.location.href = '/index.html';
  } catch {
    errorEl.textContent = 'Network error. Try again.';
  } finally {
    btn.disabled = false;
  }
}

// If already logged in, redirect
if (localStorage.getItem('forge_token')) {
  window.location.href = '/index.html';
}
