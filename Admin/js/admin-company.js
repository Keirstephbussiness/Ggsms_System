// Electron window controls + IPC
const { ipcRenderer } = require('electron');
document.getElementById('minimizeBtn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('maximizeBtn').addEventListener('click', () => ipcRenderer.send('window-maximize'));
document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('window-close'));

// ── DB HELPER (via Electron main process) ────────────────
async function dbQuery(sql, params = []) {
    return await ipcRenderer.invoke('db-query', { sql, params });
}

let companiesData = [];
let selectedCompanyId = null;
let currentPage = 1;
const PAGE_SIZE = 12;
let filteredData = [];

// ── LOGO (saved to CompanyImg folder on disk via IPC) ────
async function saveLogo(id, b64) {
    // Strip the data:image/...;base64, prefix to get raw base64
    const base64Data = b64.split(',')[1];
    await ipcRenderer.invoke('save-company-logo', { id, base64Data });
}
async function getLogo(id) {
    return await ipcRenderer.invoke('get-company-logo', { id });
}
async function deleteLogo(id) {
    await ipcRenderer.invoke('delete-company-logo', { id });
}

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
function selectCompany(id) {
    if (selectedCompanyId === id) { deselectCompany(); return; }
    document.querySelectorAll('.company-box').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.company-box[data-id="${id}"]`)?.classList.add('selected');
    selectedCompanyId = id;
    ['editCompanyBtn', 'deleteCompanyBtn', 'viewShipsBtn', 'viewDetailsBtn'].forEach(bid => {
        const b = document.getElementById(bid);
        b.disabled = false; b.classList.remove('disabled');
    });
}
function deselectCompany() {
    document.querySelectorAll('.company-box').forEach(b => b.classList.remove('selected'));
    selectedCompanyId = null;
    ['editCompanyBtn', 'deleteCompanyBtn', 'viewShipsBtn', 'viewDetailsBtn'].forEach(bid => {
        const b = document.getElementById(bid);
        b.disabled = true; b.classList.add('disabled');
    });
}

// ── DB OPERATIONS ─────────────────────────────────────────
async function fetchCompanies() {
    const result = await dbQuery('SELECT * FROM companies ORDER BY company_name ASC');
    companiesData = result.rows || [];
}

async function fetchShipCounts() {
    const result = await dbQuery('SELECT company_id FROM ships');
    const counts = {};
    (result.rows || []).forEach(s => {
        const cid = s.company_id;
        if (cid) counts[cid] = (counts[cid] || 0) + 1;
    });
    return counts;
}

async function insertCompany(p) {
    const result = await dbQuery(
        `INSERT INTO companies (company_name, company_code, contact_person, contact_email, contact_phone, address)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [p.company_name, p.company_code, p.contact_person, p.contact_email, p.contact_phone, p.address]
    );
    return result.rows[0];
}

async function updateCompany(id, p) {
    const result = await dbQuery(
        `UPDATE companies SET company_name=$1, company_code=$2, contact_person=$3, contact_email=$4, contact_phone=$5, address=$6
         WHERE id=$7 RETURNING *`,
        [p.company_name, p.company_code, p.contact_person, p.contact_email, p.contact_phone, p.address, id]
    );
    return result.rows[0];
}

async function removeCompany(id) {
    await dbQuery('DELETE FROM companies WHERE id=$1', [id]);
    await deleteLogo(id);
}

// ── RENDER ───────────────────────────────────────────────
async function loadAndRender() {
    showLoading();
    try {
        await fetchCompanies();
        const counts = await fetchShipCounts();
        filteredData = companiesData.map(c => ({ ...c, _shipCount: counts[c.id] || 0 }));
        applySearchAndRender();
    } catch(e) { alert('Failed to load: ' + e.message); }
    finally { hideLoading(); }
}

function applySearchAndRender() {
    const q = document.getElementById('companySearchInput').value.toLowerCase().trim();
    const searched = q
        ? filteredData.filter(c =>
            c.company_name.toLowerCase().includes(q) ||
            (c.company_code || '').toLowerCase().includes(q)
          )
        : filteredData;

    const total = searched.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = searched.slice(start, start + PAGE_SIZE);

    const grid = document.getElementById('companiesGrid');
    grid.innerHTML = '';

    if (!slice.length) {
        grid.innerHTML = `<div class="no-results-state">
            <div class="no-results-icon">🏢</div>
            <h3>${q ? 'No Results Found' : 'No Companies Yet'}</h3>
            <p>${q ? `Nothing matches <strong>"${q}"</strong>` : 'Click <strong>Add Company</strong> to get started'}</p>
        </div>`;
    } else {
        slice.forEach(c => buildCompanyCardAsync(c, c._shipCount, grid));
    }

    const info = document.getElementById('companyPaginationInfo');
    const btns = document.getElementById('companyPaginationBtns');
    if (total > PAGE_SIZE) {
        info.textContent = `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`;
        renderPaginationBtns(btns, currentPage, totalPages);
    } else {
        info.textContent = total > 0 ? `${total} compan${total === 1 ? 'y' : 'ies'}` : '';
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

// Async card builder — loads logo from disk then appends to grid
async function buildCompanyCardAsync(company, shipCount, grid) {
    const logo = await getLogo(company.id);
    const box = buildCompanyCard(company, shipCount, logo);
    grid.appendChild(box);
}

function buildCompanyCard(company, shipCount, logo) {
    const box = document.createElement('div');
    box.className = 'company-box'; box.dataset.id = company.id;
    const shipWord = shipCount === 1 ? 'Ship' : 'Ships';

    const logoContent = logo
        ? `<img class="company-logo-img" src="${logo}" alt="${company.company_name}">`
        : `<div class="company-logo-placeholder"><div class="company-placeholder-icon">🏢</div></div>`;

    box.innerHTML = `
        <div class="company-logo-zone">
            ${logoContent}
            <div class="logo-upload-overlay">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>${logo ? 'Change Logo' : 'Upload Logo'}</span>
            </div>
            <input type="file" class="logo-file-input" accept="image/*">
        </div>
        <div class="company-card-body">
            <div class="company-card-text">
                <h3 class="company-box-name">${company.company_name}</h3>
                <span class="company-box-code">${company.company_code || 'No Code'}</span>
            </div>
            <div class="ships-count-badge">
                <span class="badge-num">${shipCount}</span>
                <span class="badge-lbl">${shipWord}</span>
            </div>
        </div>
        <div class="company-card-footer">
            <div class="company-status-row">
                <div class="company-status-dot"></div>
                <span class="company-status-text">Active</span>
            </div>
        </div>
        <div class="company-check-badge">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-5.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>`;

    box.addEventListener('click', e => {
        if (e.target.closest('.logo-upload-overlay')) return;
        selectCompany(company.id);
    });

    const overlay = box.querySelector('.logo-upload-overlay');
    const fileInput = box.querySelector('.logo-file-input');
    overlay.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            const b64 = ev.target.result;
            await saveLogo(company.id, b64);
            const zone = box.querySelector('.company-logo-zone');
            zone.querySelector('.company-logo-placeholder')?.remove();
            let img = zone.querySelector('.company-logo-img');
            if (!img) { img = document.createElement('img'); img.className = 'company-logo-img'; img.alt = company.company_name; zone.insertBefore(img, overlay); }
            img.src = b64;
            overlay.querySelector('span').textContent = 'Change Logo';
        };
        reader.readAsDataURL(file);
    });

    return box;
}

// ── SEARCH ───────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('companySearchInput');
    const clear = document.getElementById('clearCompanySearchBtn');
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

document.getElementById('addCompanyBtn').addEventListener('click', () => {
    document.getElementById('companyModalTitle').textContent = 'Add New Company';
    document.getElementById('companyForm').reset();
    document.getElementById('companyEditId').value = '';
    document.getElementById('companyModalOverlay').classList.add('active');
});

document.getElementById('editCompanyBtn').addEventListener('click', () => {
    if (!selectedCompanyId) return;
    const c = companiesData.find(x => x.id === selectedCompanyId);
    if (!c) return;
    document.getElementById('companyModalTitle').textContent = 'Edit Company';
    document.getElementById('companyEditId').value = c.id;
    document.getElementById('companyName').value = c.company_name || '';
    document.getElementById('companyCode').value = c.company_code || '';
    document.getElementById('contactPerson').value = c.contact_person || '';
    document.getElementById('contactEmail').value = c.contact_email || '';
    document.getElementById('contactPhone').value = c.contact_phone || '';
    document.getElementById('companyAddress').value = c.address || '';
    document.getElementById('companyModalOverlay').classList.add('active');
});

// ── DELETE with SweetAlert2 ──────────────────────────────
document.getElementById('deleteCompanyBtn').addEventListener('click', async () => {
    if (!selectedCompanyId) return;
    const c = companiesData.find(x => x.id === selectedCompanyId);
    if (!c) return;

    const result = await Swal.fire({
        title: 'Delete Company?',
        html: `You are about to delete <strong>"${c.company_name}"</strong> and all its associated ships.<br><br>This action <strong>cannot be undone</strong>.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        reverseButtons: true,
        focusCancel: true,
        customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title',
            htmlContainer: 'swal-custom-html'
        }
    });

    if (!result.isConfirmed) return;

    showLoading();
    try {
        await removeCompany(selectedCompanyId);
        deselectCompany();
        await loadAndRender();
        Swal.fire({
            title: 'Deleted!',
            text: `"${c.company_name}" has been removed.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } catch(e) {
        Swal.fire({ title: 'Error', text: 'Delete failed: ' + e.message, icon: 'error', confirmButtonColor: '#D4AF37' });
    } finally {
        hideLoading();
    }
});

// ── VIEW DETAILS ─────────────────────────────────────────
document.getElementById('viewDetailsBtn').addEventListener('click', async () => {
    if (!selectedCompanyId) return;
    const c = filteredData.find(x => x.id === selectedCompanyId);
    if (!c) return;

    document.getElementById('companyDetailsModalTitle').textContent = c.company_name;

    const logoZone = document.getElementById('detailsLogoZone');
    const logo = await getLogo(c.id);
    if (logo) {
        logoZone.innerHTML = `
            <div class="details-logo-img-wrapper">
                <img src="${logo}" alt="${c.company_name}" class="details-logo-full">
                <div class="details-logo-bg" style="background-image: url('${logo}')"></div>
            </div>`;
    } else {
        logoZone.innerHTML = `
            <div class="details-logo-placeholder-large">
                <div class="details-placeholder-icon">🏢</div>
                <span class="details-placeholder-label">${c.company_name}</span>
            </div>`;
    }

    const val = (v) => (!v || v.toString().trim() === '') ? `<span class="na">N/A</span>` : v;

    document.getElementById('detailCompanyName').innerHTML = val(c.company_name);
    document.getElementById('detailCompanyCode').innerHTML = val(c.company_code);
    document.getElementById('detailContactPerson').innerHTML = val(c.contact_person);
    document.getElementById('detailContactEmail').innerHTML = val(c.contact_email);
    document.getElementById('detailContactPhone').innerHTML = val(c.contact_phone);
    document.getElementById('detailAddress').innerHTML = val(c.address);
    document.getElementById('detailShipCount').innerHTML = `${c._shipCount} ${c._shipCount === 1 ? 'Ship' : 'Ships'}`;

    document.getElementById('companyDetailsModalOverlay').classList.add('active');
});

document.getElementById('viewShipsBtn').addEventListener('click', () => {
    if (selectedCompanyId) window.location.href = `admin-ships.html?company_id=${selectedCompanyId}`;
});

document.getElementById('companyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('companyEditId').value;
    const payload = {
        company_name: document.getElementById('companyName').value.trim(),
        company_code: document.getElementById('companyCode').value.trim() || null,
        contact_person: document.getElementById('contactPerson').value.trim() || null,
        contact_email: document.getElementById('contactEmail').value.trim() || null,
        contact_phone: document.getElementById('contactPhone').value.trim() || null,
        address: document.getElementById('companyAddress').value.trim() || null
    };
    if (!payload.company_name) { alert('Company Name is required!'); return; }
    showLoading();
    try {
        id ? await updateCompany(id, payload) : await insertCompany(payload);
        document.getElementById('companyModalOverlay').classList.remove('active');
        await loadAndRender();
    } catch(e) { alert('Save failed: ' + e.message); }
    finally { hideLoading(); }
});

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    loadAndRender();
});