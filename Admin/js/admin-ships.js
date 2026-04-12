// Electron window controls
const { ipcRenderer } = require('electron');
try {
    document.getElementById('minimizeBtn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
    document.getElementById('maximizeBtn').addEventListener('click', () => ipcRenderer.send('window-maximize'));
    document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('window-close'));
} catch(e) {}

// ── DB HELPER ────────────────────────────────────────────
async function dbQuery(sql, params = []) {
    return await ipcRenderer.invoke('db-query', { sql, params });
}

// URL params
const params = new URLSearchParams(window.location.search);
const COMPANY_ID = params.get('company_id');

let shipsData = [];
let filteredData = [];
let selectedShipId = null;
let currentPage = 1;
const PAGE_SIZE = 12;

// ── SWEETALERT2 THEME ────────────────────────────────────
const swalTheme = {
    customClass: {
        popup: 'swal-custom-popup',
        title: 'swal-custom-title',
        confirmButton: 'swal-confirm-btn',
        cancelButton: 'swal-cancel-btn',
    },
    buttonsStyling: false
};

// Inject SweetAlert custom styles once
(function injectSwalStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .swal-custom-popup {
            font-family: 'Inter', sans-serif !important;
            border-radius: 20px !important;
            border: 2px solid rgba(212,175,55,0.4) !important;
            box-shadow: 0 24px 80px rgba(10,36,99,0.28) !important;
            padding: 32px 28px 28px !important;
        }
        .swal-custom-title {
            font-family: 'Poppins', sans-serif !important;
            font-size: 20px !important;
            font-weight: 800 !important;
            color: #0A2463 !important;
        }
        .swal2-html-container {
            font-size: 13px !important;
            font-weight: 500 !important;
            color: #6B7280 !important;
            line-height: 1.6 !important;
        }
        .swal2-icon.swal2-warning {
            border-color: #F59E0B !important;
            color: #F59E0B !important;
        }
        .swal-confirm-btn {
            padding: 10px 22px !important;
            background: linear-gradient(135deg, #B8942E, #D4AF37) !important;
            color: white !important;
            border: none !important;
            border-radius: 9px !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 14px rgba(212,175,55,0.35) !important;
            transition: all 0.2s ease !important;
        }
        .swal-confirm-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(212,175,55,0.45) !important; }
        .swal-confirm-btn.swal2-styled.swal2-confirm.swal-danger {
            background: linear-gradient(135deg, #dc2626, #EF4444) !important;
            box-shadow: 0 4px 14px rgba(239,68,68,0.35) !important;
        }
        .swal-cancel-btn {
            padding: 10px 22px !important;
            background: #F8F9FC !important;
            color: #1A1F36 !important;
            border: 2px solid rgba(212,175,55,0.3) !important;
            border-radius: 9px !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        }
        .swal-cancel-btn:hover { background: rgba(10,36,99,0.07) !important; }
        .swal2-actions { gap: 10px !important; }
    `;
    document.head.appendChild(style);
})();

// ── LOADING ──────────────────────────────────────────────
function showLoading() {
    if (document.querySelector('.loading-overlay')) return;
    const el = document.createElement('div');
    el.className = 'loading-overlay';
    el.innerHTML = '<div class="loading-spinner"></div>';
    document.querySelector('.content-wrapper').appendChild(el);
}
function hideLoading() { document.querySelector('.loading-overlay')?.remove(); }

// ── SELECTION ────────────────────────────────────────────
function selectShip(id) {
    if (selectedShipId === id) { deselectShip(); return; }
    document.querySelectorAll('.ship-box').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.ship-box[data-id="${id}"]`)?.classList.add('selected');
    selectedShipId = id;
    ['viewCertBtn', 'viewCrewBtn'].forEach(bid => {
        const b = document.getElementById(bid);
        b.disabled = false; b.classList.remove('disabled');
    });
}
function deselectShip() {
    document.querySelectorAll('.ship-box').forEach(b => b.classList.remove('selected'));
    selectedShipId = null;
    ['viewCertBtn', 'viewCrewBtn'].forEach(bid => {
        const b = document.getElementById(bid);
        b.disabled = true; b.classList.add('disabled');
    });
}

// ── DB OPERATIONS ─────────────────────────────────────────
async function loadCompanyHeader() {
    if (!COMPANY_ID) { document.getElementById('companyNameHeader').textContent = 'Unknown Company'; return; }
    const result = await dbQuery('SELECT * FROM companies WHERE id=$1', [COMPANY_ID]);
    const data = result.rows[0];
    if (data) {
        document.getElementById('companyNameHeader').textContent = data.company_name;
        document.getElementById('companyCodeHeader').textContent = data.company_code ? `Code: ${data.company_code}` : 'No Code';
        document.title = `GGSMS — ${data.company_name}`;
    }
}

async function fetchShips() {
    if (!COMPANY_ID) return;
    const result = await dbQuery(
        'SELECT * FROM ships WHERE company_id=$1 ORDER BY ship_name ASC',
        [COMPANY_ID]
    );
    shipsData = result.rows || [];
}

async function fetchShipStats() {
    if (!shipsData.length) return;
    const [certRes, crewRes] = await Promise.all([
        dbQuery('SELECT ship_id FROM certificates'),
        dbQuery('SELECT ship_id FROM crew')
    ]);
    const certCounts = {}, crewCounts = {};
    (certRes.rows || []).forEach(r => { certCounts[r.ship_id] = (certCounts[r.ship_id] || 0) + 1; });
    (crewRes.rows || []).forEach(r => { crewCounts[r.ship_id] = (crewCounts[r.ship_id] || 0) + 1; });
    shipsData.forEach(s => {
        s._certCount = certCounts[s.id] || 0;
        s._crewCount = crewCounts[s.id] || 0;
    });
}

async function insertShip(p) {
    const result = await dbQuery(
        `INSERT INTO ships (company_id, ship_name, region, vessel_type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [p.company_id, p.ship_name, p.region, p.vessel_type]
    );
    return result.rows[0];
}

async function updateShip(id, p) {
    const result = await dbQuery(
        `UPDATE ships SET ship_name=$1, region=$2, imo_number=$3, vessel_type=$4, flag=$5
         WHERE id=$6 RETURNING *`,
        [p.ship_name, p.region, p.imo_number, p.vessel_type, p.flag, id]
    );
    return result.rows[0];
}

async function removeShip(id) {
    await dbQuery('DELETE FROM ships WHERE id=$1', [id]);
}

// ── RENDER ───────────────────────────────────────────────
function applySearchAndRender() {
    const q = document.getElementById('shipSearchInput').value.toLowerCase().trim();
    filteredData = q
        ? shipsData.filter(s =>
            s.ship_name.toLowerCase().includes(q) ||
            (s.region || '').toLowerCase().includes(q) ||
            (s.vessel_type || '').toLowerCase().includes(q)
          )
        : [...shipsData];

    const total = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = filteredData.slice(start, start + PAGE_SIZE);

    const grid = document.getElementById('shipsGrid');
    grid.innerHTML = '';

    if (!slice.length) {
        grid.innerHTML = `<div class="no-results-state">
            <div class="no-results-icon">⚓</div>
            <h3>${q ? 'No Results Found' : 'No Ships Yet'}</h3>
            <p>${q ? `Nothing matches <strong>"${q}"</strong>` : 'Click <strong>Add Ship</strong> to register a ship'}</p>
        </div>`;
    } else {
        slice.forEach(s => grid.appendChild(buildShipCard(s)));
    }

    const info = document.getElementById('shipPaginationInfo');
    const btns = document.getElementById('shipPaginationBtns');
    if (total > PAGE_SIZE) {
        info.textContent = `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`;
        renderPaginationBtns(btns, currentPage, totalPages);
    } else {
        info.textContent = total > 0 ? `${total} ship${total === 1 ? '' : 's'}` : '';
        btns.innerHTML = '';
    }
}

function renderPaginationBtns(container, current, total) {
    container.innerHTML = '';
    const prev = document.createElement('button');
    prev.className = 'page-btn'; prev.innerHTML = '‹'; prev.disabled = current === 1;
    prev.addEventListener('click', () => { currentPage--; applySearchAndRender(); });
    container.appendChild(prev);

    const s = Math.max(1, current - 2), e = Math.min(total, current + 2);
    for (let p = s; p <= e; p++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === current ? ' active' : '');
        btn.textContent = p;
        const pp = p;
        btn.addEventListener('click', () => { currentPage = pp; applySearchAndRender(); });
        container.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn'; next.innerHTML = '›'; next.disabled = current === total || total === 0;
    next.addEventListener('click', () => { currentPage++; applySearchAndRender(); });
    container.appendChild(next);
}

function buildShipCard(ship) {
    const box = document.createElement('div');
    box.className = 'ship-box'; box.dataset.id = ship.id;
    const tags = [ship.vessel_type, ship.flag, ship.imo_number].filter(Boolean);

    box.innerHTML = `
        <div class="ship-card-top">
            <div class="ship-icon-wrap">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                    <path d="M6 20L16 14L26 20L24.5 27H7.5L6 20Z" stroke="white" stroke-width="2" stroke-linejoin="round" fill="rgba(255,255,255,0.15)"/>
                    <path d="M11 14L16 10L21 14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M16 10V6" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <path d="M4 27H28" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <div class="ship-card-info">
                <p class="ship-box-name">${ship.ship_name}</p>
                <p class="ship-box-region">
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5.5" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 8C4.5 8 2.5 9.2 2.5 10.5h9C11.5 9.2 9.5 8 7 8z" stroke="currentColor" stroke-width="1.5"/></svg>
                    ${ship.region || 'No Region'}
                </p>
                ${tags.length ? `<div class="ship-meta-tags">${tags.map(t => `<span class="ship-tag">${t}</span>`).join('')}</div>` : ''}
            </div>
        </div>
        <div class="ship-stats-row">
            <div class="ship-stat-pill cert">
                <div class="stat-icon">
                    <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><rect x="2" y="1" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 6h8M5 9h8M5 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </div>
                <div class="stat-text">
                    <span class="stat-val">${ship._certCount || 0}</span>
                    <span class="stat-lbl">Certificates</span>
                </div>
            </div>
            <div class="ship-stat-pill crew">
                <div class="stat-icon">
                    <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </div>
                <div class="stat-text">
                    <span class="stat-val">${ship._crewCount || 0}</span>
                    <span class="stat-lbl">Crew Members</span>
                </div>
            </div>
        </div>
        <div class="ship-card-actions">
            <button class="ship-action-btn cert" data-action="cert">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M4 5h6M4 7.5h6M4 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                Certificates
            </button>
            <button class="ship-action-btn crew" data-action="crew">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="4.5" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 12c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Crew
            </button>
            <button class="ship-action-btn edit" data-action="edit">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9.5 2L12 4.5M2 12l3.5-.5L12 5L9.5 2.5L3 9.5 2 12Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Edit
            </button>
            <button class="ship-action-btn del" data-action="delete">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2h4v1.5M4 3.5L4.7 12H9.3L10 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
        </div>
        <div class="ship-check-badge">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-5.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>`;

    // Card click = select
    box.addEventListener('click', e => {
        if (e.target.closest('.ship-action-btn')) return;
        selectShip(ship.id);
    });

    // Certificates
    box.querySelector('[data-action="cert"]').addEventListener('click', e => {
        e.stopPropagation();
        window.location.href = `admin-ship-detail.html?ship_id=${ship.id}&tab=certificates`;
    });

    // Crew
    box.querySelector('[data-action="crew"]').addEventListener('click', e => {
        e.stopPropagation();
        window.location.href = `admin-ship-detail.html?ship_id=${ship.id}&tab=crew`;
    });

    // Edit
    box.querySelector('[data-action="edit"]').addEventListener('click', e => {
        e.stopPropagation();
        openEditModal(ship);
    });

    // Delete — SweetAlert2 confirmation
    box.querySelector('[data-action="delete"]').addEventListener('click', async e => {
        e.stopPropagation();
        const result = await Swal.fire({
            ...swalTheme,
            title: 'Delete Ship?',
            html: `<span>You are about to permanently delete <strong style="color:#0A2463">${ship.ship_name}</strong>.<br>All certificates and crew records will also be removed.<br><br>This action <strong style="color:#EF4444">cannot be undone</strong>.</span>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Delete',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            focusCancel: true,
        });

        if (!result.isConfirmed) return;

        showLoading();
        try {
            await removeShip(ship.id);
            deselectShip();
            await loadShips();
            Swal.fire({
                ...swalTheme,
                title: 'Deleted!',
                text: `"${ship.ship_name}" has been permanently deleted.`,
                icon: 'success',
                confirmButtonText: 'OK',
                timer: 2200,
                timerProgressBar: true,
            });
        } catch(err) {
            Swal.fire({
                ...swalTheme,
                title: 'Delete Failed',
                text: err.message,
                icon: 'error',
                confirmButtonText: 'OK',
            });
        } finally { hideLoading(); }
    });

    return box;
}

// ── EDIT MODAL ────────────────────────────────────────────
function openEditModal(ship) {
    document.getElementById('editShipId').value = ship.id;
    document.getElementById('editShipName').value = ship.ship_name || '';
    document.getElementById('editShipRegion').value = ship.region || '';
    document.getElementById('editImoNumber').value = ship.imo_number || '';
    document.getElementById('editVesselType').value = ship.vessel_type || '';
    document.getElementById('editFlag').value = ship.flag || '';
    document.getElementById('editShipModalOverlay').classList.add('active');
}

document.getElementById('editShipForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('editShipId').value;
    const payload = {
        ship_name: document.getElementById('editShipName').value.trim(),
        region: document.getElementById('editShipRegion').value.trim() || null,
        imo_number: document.getElementById('editImoNumber').value.trim() || null,
        vessel_type: document.getElementById('editVesselType').value.trim() || null,
        flag: document.getElementById('editFlag').value.trim() || null,
    };
    if (!payload.ship_name || !payload.region) { alert('Ship Name and Region are required!'); return; }
    showLoading();
    try {
        await updateShip(id, payload);
        document.getElementById('editShipModalOverlay').classList.remove('active');
        await loadShips();
    } catch(err) { alert('Save failed: ' + err.message); }
    finally { hideLoading(); }
});

// ── TOOLBAR NAVIGATION ───────────────────────────────────
document.getElementById('backBtn').addEventListener('click', () => history.back());

document.getElementById('viewCertBtn').addEventListener('click', () => {
    if (selectedShipId) window.location.href = `admin-ship-detail.html?ship_id=${selectedShipId}&tab=certificates`;
});
document.getElementById('viewCrewBtn').addEventListener('click', () => {
    if (selectedShipId) window.location.href = `admin-ship-detail.html?ship_id=${selectedShipId}&tab=crew`;
});

// ── SEARCH ───────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('shipSearchInput');
    const clear = document.getElementById('clearShipSearchBtn');
    const dots = document.createElement('div');
    dots.className = 'search-loading-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    input.closest('.search-bar-container').appendChild(dots);

    let timer = null;
    input.addEventListener('input', function() {
        clear.classList.toggle('visible', this.value.length > 0);
        if (this.value.length > 0) dots.classList.add('visible');
        clearTimeout(timer);
        timer = setTimeout(() => { dots.classList.remove('visible'); currentPage = 1; applySearchAndRender(); }, 350);
    });
    clear.addEventListener('click', () => {
        input.value = '';
        clear.classList.remove('visible');
        dots.classList.remove('visible');
        clearTimeout(timer);
        currentPage = 1;
        applySearchAndRender();
    });
}

// ── MODALS ───────────────────────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('active'); });
});
document.querySelectorAll('.modal-close, .btn-cancel').forEach(b => {
    b.addEventListener('click', () => b.closest('.modal-overlay')?.classList.remove('active'));
});

document.getElementById('addShipBtn').addEventListener('click', () => {
    document.getElementById('shipModalTitle').textContent = 'Add New Ship';
    document.getElementById('shipForm').reset();
    document.getElementById('shipEditId').value = '';
    document.getElementById('shipModalOverlay').classList.add('active');
});

document.getElementById('shipForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
        company_id: COMPANY_ID,
        ship_name: document.getElementById('shipName').value.trim(),
        region: document.getElementById('shipRegion').value.trim() || null,
        vessel_type: document.getElementById('vesselType').value.trim() || null,
    };
    if (!payload.ship_name || !payload.region) { alert('Ship Name and Region are required!'); return; }
    showLoading();
    try {
        await insertShip(payload);
        document.getElementById('shipModalOverlay').classList.remove('active');
        await loadShips();
    } catch(err) { alert('Save failed: ' + err.message); }
    finally { hideLoading(); }
});

// ── LOAD ─────────────────────────────────────────────────
async function loadShips() {
    showLoading();
    try {
        await fetchShips();
        await fetchShipStats();
        deselectShip();
        applySearchAndRender();
    } catch(e) { alert('Failed to load ships: ' + e.message); }
    finally { hideLoading(); }
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    loadCompanyHeader();
    loadShips();
});