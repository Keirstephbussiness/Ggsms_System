// ── Sidebar toggle — persistent state management ──────────
const sidebar     = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const toggleBtn   = document.getElementById('sidebarToggle');

// Load persisted state (defaults to expanded)
const STORAGE_KEY = 'sidebar_state';
let isCollapsed = localStorage.getItem(STORAGE_KEY) === 'collapsed';

function syncMargin() {
    const style = getComputedStyle(document.documentElement);
    const w = isCollapsed
        ? style.getPropertyValue('--sidebar-collapsed').trim()
        : style.getPropertyValue('--sidebar-w').trim();
    mainContent.style.marginLeft = w;
}

function setSidebarState(collapsed) {
    isCollapsed = collapsed;

    // Sync class
    sidebar.classList.toggle('collapsed', isCollapsed);

    // Persist state
    localStorage.setItem(STORAGE_KEY, isCollapsed ? 'collapsed' : 'expanded');

    // Update toggle button aria for accessibility
    toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));

    syncMargin();
}

// Toggle only on explicit button click — state stays until next click
toggleBtn.addEventListener('click', () => {
    setSidebarState(!isCollapsed);
});

// Optional: collapse sidebar on small screens automatically
const mql = window.matchMedia('(max-width: 768px)');

function handleBreakpoint(e) {
    if (e.matches && !isCollapsed) {
        setSidebarState(true);   // auto-collapse on mobile
    } else if (!e.matches && isCollapsed) {
        setSidebarState(false);  // auto-expand when returning to desktop
    }
}

mql.addEventListener('change', handleBreakpoint);

// ── Init ──────────────────────────────────────────────────
// Restore persisted state (or respect breakpoint on first load)
if (mql.matches) {
    setSidebarState(true);      // always collapsed on mobile at init
} else {
    setSidebarState(isCollapsed); // restore last known state on desktop
}