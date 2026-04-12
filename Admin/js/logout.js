document.addEventListener('DOMContentLoaded', () => {

    // ── INJECT CSS ───────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        .logout-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 8px;
            text-decoration: none;
            color: #ef4444;
            font-weight: 500;
            transition: all 0.25s ease;
            cursor: pointer;
        }
        .logout-btn:hover {
            background: rgba(239, 68, 68, 0.12);
            color: #dc2626;
            transform: translateX(3px);
        }

        /* ── SWAL LOGOUT THEME ── */
        .swal-logout-popup {
            font-family: 'Inter', sans-serif !important;
            border-radius: 20px !important;
            border: 2px solid rgba(212, 175, 55, 0.35) !important;
            box-shadow: 0 24px 80px rgba(10, 36, 99, 0.25) !important;
            padding: 10px 6px 24px !important;
        }
        .swal-logout-title {
            font-family: 'Poppins', 'Inter', sans-serif !important;
            font-size: 19px !important;
            font-weight: 800 !important;
            color: #0A2463 !important;
        }
        .swal-logout-html {
            font-size: 13px !important;
            color: #6B7280 !important;
            line-height: 1.65 !important;
        }
        .swal-logout-html strong {
            color: #0A2463;
        }
        .swal2-icon.swal2-question {
            border-color: #D4AF37 !important;
            color: #B8942E !important;
        }
        /* Actions row */
        .swal-logout-popup .swal2-actions {
            gap: 10px !important;
            margin-top: 6px !important;
        }
        /* Confirm = red logout */
        .swal-logout-popup .swal2-confirm {
            background: linear-gradient(135deg, #dc2626, #ef4444) !important;
            color: #fff !important;
            border: none !important;
            border-radius: 10px !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            padding: 11px 24px !important;
            box-shadow: 0 4px 16px rgba(239,68,68,0.35) !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease !important;
        }
        .swal-logout-popup .swal2-confirm:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 24px rgba(239,68,68,0.45) !important;
        }
        /* Cancel = subtle */
        .swal-logout-popup .swal2-cancel {
            background: #F1F5F9 !important;
            color: #374151 !important;
            border: 1.5px solid rgba(212,175,55,0.3) !important;
            border-radius: 10px !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            padding: 11px 24px !important;
            transition: background 0.2s ease, border-color 0.2s ease !important;
            box-shadow: none !important;
        }
        .swal-logout-popup .swal2-cancel:hover {
            background: #E2E8F0 !important;
            border-color: rgba(212,175,55,0.5) !important;
        }

        /* ── LOGOUT OVERLAY ── */
        .logout-overlay {
            position: fixed;
            inset: 0;
            background: rgba(10, 36, 99, 0.5);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            z-index: 9998;
            opacity: 0;
            transition: opacity 0.5s ease;
            pointer-events: none;
        }
        .logout-overlay.visible { opacity: 1; }

        /* ── GOODBYE TOAST ── */
        .logout-toast {
            position: fixed;
            top: 50%;
            left: 50%;
            z-index: 9999;
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0;
            background: #ffffff;
            border-radius: 20px;
            border: 2px solid rgba(212, 175, 55, 0.45);
            box-shadow: 0 32px 80px rgba(10, 36, 99, 0.28);
            padding: 32px 44px;
            text-align: center;
            pointer-events: none;
            transition: opacity 0.45s cubic-bezier(0.34, 1.4, 0.64, 1),
                        transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1);
            min-width: 240px;
        }
        .logout-toast.visible {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        .logout-toast-icon {
            display: block;
            font-size: 42px;
            margin-bottom: 12px;
            transform-origin: 70% 80%;
            animation: waveHand 0.7s ease-in-out infinite alternate;
        }
        @keyframes waveHand {
            0%   { transform: rotate(-14deg); }
            100% { transform: rotate(14deg); }
        }
        .logout-toast-title {
            font-family: 'Poppins', 'Inter', sans-serif;
            font-size: 16px;
            font-weight: 800;
            color: #0A2463;
            margin: 0 0 4px 0;
        }
        .logout-toast-sub {
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            font-weight: 500;
            color: #9CA3AF;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .logout-dots span {
            display: inline-block;
            width: 4px; height: 4px;
            border-radius: 50%;
            background: #D4AF37;
            animation: dotBounce 1.1s ease-in-out infinite;
        }
        .logout-dots span:nth-child(2) { animation-delay: 0.18s; }
        .logout-dots span:nth-child(3) { animation-delay: 0.36s; }
        @keyframes dotBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40%           { transform: translateY(-5px); opacity: 1; }
        }

        /* ── PAGE EXIT ANIMATION ── */
        @keyframes pageExit {
            0%   { opacity: 1;   transform: scale(1)    translateY(0);   filter: blur(0);    }
            100% { opacity: 0;   transform: scale(0.94) translateY(30px); filter: blur(6px);  }
        }
        body.logout-is-happening {
            animation: pageExit 0.7s ease forwards;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    // ── LOGOUT BUTTON ────────────────────────────────────
    const logoutBtn = document.querySelector('.logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        // ── SWEETALERT2 CONFIRMATION ─────────────────────
        const result = await Swal.fire({
            title: 'Log Out?',
            html: 'Are you sure you want to log out of <strong>GGSMS</strong>?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '  Log Out',
            cancelButtonText: 'Stay',
            reverseButtons: true,
            focusCancel: true,
            customClass: { popup: 'swal-logout-popup', title: 'swal-logout-title', htmlContainer: 'swal-logout-html' },
            buttonsStyling: true,
        });

        if (!result.isConfirmed) return;

        // ── CLEAR AUTH ────────────────────────────────────
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('session-clear');

        // ── BUILD OVERLAY ─────────────────────────────────
        const overlay = document.createElement('div');
        overlay.className = 'logout-overlay';
        document.body.appendChild(overlay);

        // ── BUILD TOAST ───────────────────────────────────
        const toast = document.createElement('div');
        toast.className = 'logout-toast';
        toast.innerHTML = `
            <span class="logout-toast-icon">👋</span>
            <p class="logout-toast-title">See you soon!</p>
            <p class="logout-toast-sub">
                Logging you out
                <span class="logout-dots">
                    <span></span><span></span><span></span>
                </span>
            </p>`;
        document.body.appendChild(toast);

        // Trigger CSS transitions (double rAF ensures paint before class add)
        requestAnimationFrame(() => requestAnimationFrame(() => {
            overlay.classList.add('visible');
            toast.classList.add('visible');
        }));

        // Page fade starts slightly after overlay appears
        setTimeout(() => document.body.classList.add('logout-is-happening'), 350);

        // Redirect after animations finish
        setTimeout(() => { window.location.href = '../../index.html'; }, 1200);
    });
});