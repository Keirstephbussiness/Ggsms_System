// ── DB HELPER via Electron IPC ────────────────────────────────
const { ipcRenderer } = require('electron');

async function dbQuery(sql, params = []) {
    return await ipcRenderer.invoke('db-query', { sql, params });
}

// ── PERSISTENT SESSION HELPERS ───────────────────────────────
async function setSession(data) {
    await ipcRenderer.invoke('session-set', data);
}

async function getSession() {
    return await ipcRenderer.invoke('session-get');
}

async function clearSession() {
    await ipcRenderer.invoke('session-clear');
}

// Window controls
document.getElementById('minimizeBtn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('maximizeBtn').addEventListener('click', () => ipcRenderer.send('window-maximize'));
document.getElementById('closeBtn').addEventListener('click',    () => ipcRenderer.send('window-close'));

// ── DOM ELEMENTS ─────────────────────────────────────────────
const switchBtns         = document.querySelectorAll('.switch-btn');
const typeBtns           = document.querySelectorAll('.type-btn');
const loginView          = document.getElementById('loginView');
const registerView       = document.getElementById('registerView');
const employeeLoginForm  = document.getElementById('employeeLoginForm');
const adminLoginForm     = document.getElementById('adminLoginForm');
const registerForm       = document.getElementById('registerForm');

// ── ALERT ────────────────────────────────────────────────────
function showAlert(message, type = 'error', containerId = 'alertContainer', messageId = 'alertMessage') {
    const container = document.getElementById(containerId);
    const msgEl     = document.getElementById(messageId);
    if (!container || !msgEl) return;
    msgEl.textContent = message;
    container.classList.remove('success');
    if (type === 'success') container.classList.add('success');
    container.classList.add('show');
    setTimeout(() => hideAlert(containerId), 5000);
}

function hideAlert(containerId = 'alertContainer') {
    document.getElementById(containerId)?.classList.remove('show');
}

document.getElementById('alertClose')?.addEventListener('click', () => hideAlert('alertContainer'));
document.getElementById('alertCloseRegister')?.addEventListener('click', () => hideAlert('alertContainerRegister'));

// ── VIEW SWITCHER (Login ↔ Register) ─────────────────────────
switchBtns.forEach(btn => {
    btn.addEventListener('click', function () {
        const view = this.dataset.view;

        // Update active state on buttons
        switchBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Show correct view
        if (view === 'login') {
            loginView.classList.add('active');
            loginView.style.display = '';
            registerView.classList.remove('active');
            registerView.style.display = 'none';
        } else {
            registerView.classList.add('active');
            registerView.style.display = '';
            loginView.classList.remove('active');
            loginView.style.display = 'none';
        }

        hideAlert('alertContainer');
        hideAlert('alertContainerRegister');
    });
});

// ── TYPE SELECTOR (Employee ↔ Admin) ─────────────────────────
typeBtns.forEach(btn => {
    btn.addEventListener('click', function () {
        const type = this.dataset.type;

        // Toggle: clicking active btn deselects
        if (this.classList.contains('active')) {
            this.classList.remove('active');
            employeeLoginForm.classList.remove('active');
            adminLoginForm.classList.remove('active');
            employeeLoginForm.style.display = 'none';
            adminLoginForm.style.display    = 'none';
            return;
        }

        // Activate selected type
        typeBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        if (type === 'employee') {
            employeeLoginForm.classList.add('active');
            employeeLoginForm.style.display = 'block';
            adminLoginForm.classList.remove('active');
            adminLoginForm.style.display    = 'none';
        } else {
            adminLoginForm.classList.add('active');
            adminLoginForm.style.display    = 'block';
            employeeLoginForm.classList.remove('active');
            employeeLoginForm.style.display = 'none';
        }

        hideAlert('alertContainer');
    });
});

// ── PASSWORD TOGGLE WITH EYE ANIMATION ──────────────────────
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
        const targetId = this.getAttribute('data-target');
        const input    = document.getElementById(targetId);
        if (!input) return;

        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';

        // Blink then swap
        const eyeIcon = this.querySelector('.eye-icon');
        if (eyeIcon) {
            eyeIcon.classList.add('eye-blink');
            setTimeout(() => eyeIcon.classList.remove('eye-blink'), 300);
        }

        if (isHidden) {
            // Now showing → display closed/slashed eye
            this.innerHTML = `
                <svg class="eye-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2 2L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M6.5 6.6C4.5 7.6 2.5 9.5 1 10C1 10 4 16 10 16C11.8 16 13.4 15.4 14.7 14.6"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M8.5 4.2C9 4.1 9.5 4 10 4C16 4 19 10 19 10C18.5 10.7 17.8 11.6 16.9 12.4"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M7.5 10C7.5 9 7.9 8 8.7 7.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M12.5 10C12.5 11.4 11.4 12.5 10 12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>`;
        } else {
            // Now hidden → display open eye
            this.innerHTML = `
                <svg class="eye-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M1 10C1 10 4 4 10 4C16 4 19 10 19 10C19 10 16 16 10 16C4 16 1 10 1 10Z"
                          stroke="currentColor" stroke-width="2"/>
                    <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                </svg>`;
        }

        this.setAttribute('data-target', targetId);
    });
});

// ── LOADING STATE ────────────────────────────────────────────
function setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── EMPLOYEE LOGIN ───────────────────────────────────────────
employeeLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('employeeEmail').value.trim();
    const password = document.getElementById('employeePassword').value;
    const btn      = e.target.querySelector('.submit-btn');

    if (!email || !password)   return showAlert('Please fill in all fields');
    if (!validateEmail(email)) return showAlert('Please enter a valid email address');

    setButtonLoading(btn, true);
    try {
        const result = await dbQuery(
            'SELECT * FROM employees WHERE email=$1 AND password=$2 LIMIT 1',
            [email, password]
        );
        const data = result.rows[0];
        if (!data) throw new Error('Invalid email or password');

        await setSession({
            id: data.id, email: data.email, name: data.name, role: 'employee'
        });
        window.location.href = 'index.html';

    } catch (err) {
        showAlert(err.message || 'Login failed');
    } finally {
        setButtonLoading(btn, false);
    }
});

// ── ADMIN LOGIN ──────────────────────────────────────────────
adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const btn      = e.target.querySelector('.submit-btn');

    if (!username || !password) return showAlert('Please fill in all fields');

    setButtonLoading(btn, true);
    try {
        const result = await dbQuery(
            'SELECT * FROM admin_users WHERE username=$1 AND password=$2 LIMIT 1',
            [username, password]
        );
        const data = result.rows[0];
        if (!data) throw new Error('Invalid username or password');

        await setSession({
            id: data.id, username: data.username, full_name: data.full_name, role: 'admin'
        });
        window.location.href = 'Admin/html/admin-welcome.html';

    } catch (err) {
        showAlert(err.message || 'Login failed');
    } finally {
        setButtonLoading(btn, false);
    }
});

// ── REGISTRATION ─────────────────────────────────────────────
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('registerName').value.trim();
    const email    = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm  = document.getElementById('registerConfirmPassword').value;
    const btn      = e.target.querySelector('.submit-btn');

    const REG_CONTAINER = 'alertContainerRegister';
    const REG_MSG       = 'alertMessageRegister';

    if (!name || !email || !password || !confirm)
        return showAlert('Please fill in all fields', 'error', REG_CONTAINER, REG_MSG);
    if (!validateEmail(email))
        return showAlert('Please enter a valid email address', 'error', REG_CONTAINER, REG_MSG);
    if (password.length < 6)
        return showAlert('Password must be at least 6 characters', 'error', REG_CONTAINER, REG_MSG);
    if (password !== confirm)
        return showAlert('Passwords do not match', 'error', REG_CONTAINER, REG_MSG);

    setButtonLoading(btn, true);
    try {
        const check = await dbQuery('SELECT id FROM employees WHERE email=$1 LIMIT 1', [email]);
        if (check.rows.length > 0)
            throw new Error('An account with this email already exists');

        await dbQuery(
            'INSERT INTO employees (name, email, password) VALUES ($1, $2, $3)',
            [name, email, password]
        );

        showAlert('Account created! You can now login.', 'success', REG_CONTAINER, REG_MSG);
        registerForm.reset();

    } catch (err) {
        showAlert(err.message || 'Registration failed', 'error', REG_CONTAINER, REG_MSG);
    } finally {
        setButtonLoading(btn, false);
    }
});

// ── AUTO-REDIRECT IF ALREADY LOGGED IN ──────────────────────
(async function checkSession() {
    try {
        const user = await getSession();
        if (!user) return;
        if (user.role === 'admin') window.location.href = 'Admin/html/admin-welcome.html';
        else window.location.href = 'index.html';
    } catch (_) {}
})();