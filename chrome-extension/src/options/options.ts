import { fetchCurrentUser, getConfig, login, saveConfig } from '../api/client';
import type { AccountStatus } from '../types';

const loginForm = document.getElementById('loginForm') as HTMLFormElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
const statusMessage = document.getElementById('statusMessage') as HTMLParagraphElement;
const loggedInSection = document.getElementById('loggedInSection') as HTMLElement;
const loginSection = document.getElementById('loginSection') as HTMLElement;
const loggedInEmail = document.getElementById('loggedInEmail') as HTMLElement;
const accountStatusNotice = document.getElementById('accountStatusNotice') as HTMLParagraphElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;

function showStatus(message: string, variant: 'success' | 'error'): void {
  statusMessage.textContent = message;
  statusMessage.className = `status ${variant}`;
  statusMessage.classList.remove('hidden');
}

function renderAccountStatus(accountStatus: AccountStatus | null): void {
  if (accountStatus === 'PENDING_APPROVAL') {
    accountStatusNotice.textContent =
      "Your account is awaiting manager approval. You can log in, but can't track applications yet.";
    accountStatusNotice.className = 'notice warning';
  } else if (accountStatus === 'REJECTED') {
    accountStatusNotice.textContent = 'Your account was rejected. Contact your manager for details.';
    accountStatusNotice.className = 'notice error';
  } else {
    accountStatusNotice.classList.add('hidden');
    return;
  }
  accountStatusNotice.classList.remove('hidden');
}

async function refreshView(): Promise<void> {
  const config = await getConfig();

  if (config.token && config.userEmail) {
    loggedInSection.classList.remove('hidden');
    loginSection.classList.add('hidden');
    loggedInEmail.textContent = config.userEmail;
    renderAccountStatus(config.accountStatus);

    // Best-effort refresh in case a manager approved/rejected the account since last login.
    fetchCurrentUser(config.token)
      .then((user) => {
        renderAccountStatus(user.status);
        return saveConfig({ ...config, accountStatus: user.status });
      })
      .catch(() => {
        // Offline or token expired — keep showing the last known status.
      });
  } else {
    loggedInSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginBtn.disabled = true;

  try {
    const { token, email, status } = await login(emailInput.value.trim(), passwordInput.value);
    await saveConfig({ token, userEmail: email, accountStatus: status });
    showStatus('Logged in successfully.', 'success');
    passwordInput.value = '';
    await refreshView();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Login failed', 'error');
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  const config = await getConfig();
  await saveConfig({ ...config, token: null, userEmail: null, accountStatus: null });
  await refreshView();
});

void refreshView();
