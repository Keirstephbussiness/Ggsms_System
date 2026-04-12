// ── ELECTRON ──────────────────────────────────────────────────────────────────
const { ipcRenderer } = require('electron');
try {
    document.getElementById('minimizeBtn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
    document.getElementById('maximizeBtn').addEventListener('click', () => ipcRenderer.send('window-maximize'));
    document.getElementById('closeBtn').addEventListener('click',   () => ipcRenderer.send('window-close'));
} catch(e) {}

async function dbQuery(sql, params = []) {
    return await ipcRenderer.invoke('db-query', { sql, params });
}

// ── STATE ─────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const SHIP_ID   = urlParams.get('ship_id');
const INIT_TAB  = urlParams.get('tab') || 'certificates';
const EXPIRING_THRESHOLD_DAYS = 90;

let shipData   = null;
let certData   = [], filteredCerts = [];
let crewData   = [], filteredCrew  = [];
let certFilter = 'all', crewFilter = 'all';
let certPage   = 1,    crewPage    = 1;

// Lookup Maps — keyed by record id as string for O(1) retrieval from data-id attribute
const certMap = new Map();
const crewMap = new Map();

// ── PAGE SIZE ─────────────────────────────────────────────────────────────────
function getCertPageSize() { return parseInt(document.getElementById('certPageSize').value, 10); }
function getCrewPageSize() { return parseInt(document.getElementById('crewPageSize').value, 10); }

// ── EXPIRY HELPERS ────────────────────────────────────────────────────────────
function getDaysRemaining(expiryStr) {
    if (!expiryStr) return null;
    const today  = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryStr); expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry - today) / 86400000);
}
function computeAutoStatus(expiryStr) {
    const days = getDaysRemaining(expiryStr);
    if (days === null) return null;
    if (days < 0)  return 'Expired';
    if (days <= EXPIRING_THRESHOLD_DAYS) return 'Expiring';
    return 'Active';
}
function resolveStatus(cert) {
    const stored = cert.status || 'Active';
    if (stored === 'For Renewal') return 'For Renewal';
    const auto = computeAutoStatus(cert.expiry_date);
    return auto ?? stored;
}

// ── MODAL HELPERS ─────────────────────────────────────────────────────────────
function fillCertModal(cert) {
    document.getElementById('certEditId').value      = cert ? String(cert.id) : '';
    document.getElementById('certName').value        = cert ? (cert.cert_name     || '') : '';
    document.getElementById('certIssuer').value      = cert ? (cert.issuer_agency || '') : '';
    document.getElementById('certNo').value          = cert ? (cert.cert_no       || '') : '';
    document.getElementById('certIssueDate').value   = cert && cert.date_of_issue ? new Date(cert.date_of_issue).toISOString().split('T')[0] : '';
    document.getElementById('certExpiryDate').value  = cert && cert.expiry_date   ? new Date(cert.expiry_date).toISOString().split('T')[0]   : '';
    document.getElementById('certRemarks').value     = cert ? (cert.remarks       || '') : '';
    const sel = document.getElementById('certStatus');
    const sv  = cert ? resolveStatus(cert) : 'Active';
    // Find option by value — handles 'Expiring' mapping to option value='Expiring'
    let matched = false;
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === sv) { sel.selectedIndex = i; matched = true; break; }
    }
    if (!matched) sel.selectedIndex = 0;
    document.getElementById('certModalTitle').textContent = cert ? 'Edit Certificate' : 'Add Certificate';
    document.getElementById('certModalOverlay').classList.add('active');
}
function fillCrewModal(crew) {
    document.getElementById('crewEditId').value      = crew ? String(crew.id) : '';
    document.getElementById('crewId').value          = crew ? (crew.crew_id       || '') : '';
    document.getElementById('crewFullName').value    = crew ? (crew.full_name      || '') : '';
    document.getElementById('crewRank').value        = crew ? (crew.rank_position  || '') : '';
    document.getElementById('crewDateJoined').value  = crew && crew.date_joined ? new Date(crew.date_joined).toISOString().split('T')[0] : '';
    document.getElementById('crewContact').value     = crew ? (crew.contact_info   || '') : '';
    const validStatuses = ['On Board', 'On Leave', 'Suspended'];
    const sv = crew ? (crew.status || 'On Board') : 'On Board';
    document.getElementById('crewStatus').value = validStatuses.includes(sv) ? sv : 'On Board';
    document.getElementById('crewModalTitle').textContent = crew ? 'Edit Crew Member' : 'Add Crew Member';
    document.getElementById('crewModalOverlay').classList.add('active');
}
function closeCertModal() { document.getElementById('certModalOverlay').classList.remove('active'); }
function closeCrewModal() { document.getElementById('crewModalOverlay').classList.remove('active'); }

// Modal close wiring
document.getElementById('certModalCloseBtn').addEventListener('click', closeCertModal);
document.getElementById('certCancelBtn').addEventListener('click',     closeCertModal);
document.getElementById('crewModalCloseBtn').addEventListener('click', closeCrewModal);
document.getElementById('crewCancelBtn').addEventListener('click',     closeCrewModal);
document.getElementById('certModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCertModal(); });
document.getElementById('crewModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCrewModal(); });

// Live auto-status when expiry changes
document.getElementById('certExpiryDate').addEventListener('change', function() {
    const sel = document.getElementById('certStatus');
    if (sel.value === 'For Renewal') return;
    const auto = computeAutoStatus(this.value);
    if (auto) sel.value = auto;
});

// Add buttons
document.getElementById('addCertBtn').addEventListener('click', () => fillCertModal(null));
document.getElementById('addCrewBtn').addEventListener('click', () => fillCrewModal(null));

// ── SINGLE DELEGATED LISTENER ON DOCUMENT ─────────────────────────────────────
// Uses data-action + data-id on each button. Registered on document so it fires
// regardless of stacking context, overlay, or sidebar CSS from admin-navigation.css.
document.addEventListener('click', function(e) {
    // Walk up from the actual click target to find a button with data-action
    let btn = e.target;
    while (btn && btn !== document) {
        if (btn.dataset && btn.dataset.action) break;
        btn = btn.parentElement;
    }
    if (!btn || !btn.dataset || !btn.dataset.action) return;

    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'cert-edit') {
        const cert = certMap.get(id);
        if (cert) fillCertModal(cert);
    } else if (action === 'cert-del') {
        const cert = certMap.get(id);
        if (cert) deleteCert(cert.id);
    } else if (action === 'crew-edit') {
        const crew = crewMap.get(id);
        if (crew) fillCrewModal(crew);
    } else if (action === 'crew-del') {
        const crew = crewMap.get(id);
        if (crew) deleteCrewMember(crew.id);
    }
}, true); // <<< useCapture=true: fires BEFORE any other handler, ignores stopPropagation

// ── LOADING ───────────────────────────────────────────────────────────────────
function showLoading() {
    if (document.querySelector('.loading-overlay')) return;
    const el = document.createElement('div');
    el.className = 'loading-overlay';
    el.innerHTML = '<div class="loading-spinner"></div>';
    document.getElementById('contentWrapper').appendChild(el);
}
function hideLoading() { document.querySelector('.loading-overlay')?.remove(); }

// ── TABS ──────────────────────────────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}
document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.getElementById('backBtn').addEventListener('click', () => history.back());

// ── SHIP HEADER ───────────────────────────────────────────────────────────────
async function loadShip() {
    if (!SHIP_ID) { document.getElementById('shipHeaderName').textContent = 'Ship Not Found'; return; }
    const res = await dbQuery('SELECT * FROM ships WHERE id::text = $1', [String(SHIP_ID)]);
    const d = res.rows[0];
    if (!d) { document.getElementById('shipHeaderName').textContent = 'Ship Not Found'; return; }
    shipData = d;
    document.getElementById('shipHeaderName').textContent = d.ship_name;
    document.getElementById('shipHeaderRegion').textContent = d.region || '—';
    const typeEl = document.getElementById('shipHeaderType');
    typeEl.textContent = d.vessel_type || ''; typeEl.style.display = d.vessel_type ? '' : 'none';
    const flagEl = document.getElementById('shipHeaderFlag');
    flagEl.textContent = d.flag ? '🏳 ' + d.flag : ''; flagEl.style.display = d.flag ? '' : 'none';
    const imoEl = document.getElementById('shipHeaderImo');
    if (d.imo_number) {
        imoEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 5h7M3.5 7h7M3.5 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> ${d.imo_number}`;
        imoEl.style.display = 'flex';
    } else imoEl.style.display = 'none';
    document.title = `GGSMS - ${d.ship_name}`;
}

// ── CERTIFICATES ──────────────────────────────────────────────────────────────
async function loadCerts() {
    const res = await dbQuery('SELECT * FROM certificates WHERE ship_id::text = $1 ORDER BY cert_name ASC', [String(SHIP_ID)]);
    certData = res.rows || [];
    certMap.clear();
    certData.forEach(c => certMap.set(String(c.id), c));
    updateCertStats();
    applyFilter('cert');
}
function updateCertStats() {
    let total = certData.length, active = 0, expiring = 0, expired = 0, renewal = 0;
    certData.forEach(c => {
        switch (resolveStatus(c)) {
            case 'Active':      active++;   break;
            case 'Expiring':    expiring++; break;
            case 'Expired':     expired++;  break;
            case 'For Renewal': renewal++;  break;
        }
    });
    document.getElementById('certTotal').textContent    = total;
    document.getElementById('certActive').textContent   = active;
    document.getElementById('certExpiring').textContent = expiring;
    document.getElementById('certExpired').textContent  = expired;
    document.getElementById('certRenewal').textContent  = renewal;
    document.getElementById('certTabCount').textContent = total;
    document.getElementById('certExpiringCard').classList.toggle('has-expiring', expiring > 0);
}
function applyFilter(type) {
    const q = document.getElementById(type === 'cert' ? 'certSearch' : 'crewSearch').value.toLowerCase();
    if (type === 'cert') {
        filteredCerts = certData.filter(c => {
            const rs = resolveStatus(c).toLowerCase();
            const mf = certFilter === 'all' ||
                (certFilter === 'active'   && rs === 'active')   ||
                (certFilter === 'expiring' && rs === 'expiring') ||
                (certFilter === 'expired'  && rs === 'expired')  ||
                (certFilter === 'renewal'  && rs === 'for renewal');
            const ms = !q || [c.cert_name, c.issuer_agency, c.cert_no, c.remarks].some(f => f?.toLowerCase().includes(q));
            return mf && ms;
        });
        certPage = 1; renderCertTable();
    } else {
        filteredCrew = crewData.filter(c => {
            const mf = crewFilter === 'all' || (c.status || '').toLowerCase() === crewFilter;
            const ms = !q || [c.crew_id, c.full_name, c.rank_position, c.contact_info].some(f => f?.toLowerCase().includes(q));
            return mf && ms;
        });
        crewPage = 1; renderCrewTable();
    }
}
function certStatusBadgeClass(s) {
    return s === 'Active' ? 'active-b' : s === 'Expiring' ? 'expiring-b' : s === 'Expired' ? 'expired-b' : s === 'For Renewal' ? 'renewal-b' : '';
}
function buildDaysCell(expiryStr) {
    const days = getDaysRemaining(expiryStr);
    if (days === null) return '<span style="color:var(--text-light);font-size:12px">—</span>';
    if (days < 0)   return `<div class="days-pill past">⚠ ${Math.abs(days)}d ago</div>`;
    if (days === 0) return `<div class="days-pill past">Expires today</div>`;
    if (days <= 30) return `<div class="days-num critical">${days}d</div><div class="days-pill critical">⚠ Critical</div>`;
    if (days <= EXPIRING_THRESHOLD_DAYS) return `<div class="days-num warning">${days}d</div><div class="days-pill warning">Expiring soon</div>`;
    return `<div class="days-num ok">${days}d</div>`;
}
function renderCertTable() {
    const tbody = document.getElementById('certTbody');
    const ps    = getCertPageSize();
    const total = filteredCerts.length;
    const pages = Math.max(1, Math.ceil(total / ps));
    if (certPage > pages) certPage = pages;
    const start = (certPage - 1) * ps;
    const slice = filteredCerts.slice(start, start + ps);
    tbody.innerHTML = '';
    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📄</div><h3>No Certificates</h3><p>No records match your current filter.</p></div></td></tr>`;
    } else {
        slice.forEach((c, i) => {
            const rs  = resolveStatus(c);
            const cls = certStatusBadgeClass(rs);
            const sid = String(c.id);
            const tr  = document.createElement('tr');
            if (rs === 'Expiring') tr.classList.add('row-expiring');
            tr.innerHTML = `
                <td class="td-mono">${start + i + 1}</td>
                <td><div style="font-weight:700;color:var(--text-dark)">${c.cert_name || '—'}</div></td>
                <td>${c.issuer_agency || '—'}</td>
                <td class="td-mono">${c.cert_no || '—'}</td>
                <td>${formatDate(c.date_of_issue)}</td>
                <td>${formatDate(c.expiry_date)}</td>
                <td>${buildDaysCell(c.expiry_date)}</td>
                <td><span class="badge ${cls}">${rs}</span></td>
                <td style="max-width:140px;font-size:12px;color:var(--text-light)">${c.remarks || '—'}</td>
                <td>
                    <div class="action-btns">
                        <button class="act-btn edit" data-action="cert-edit" data-id="${sid}" title="Edit">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="pointer-events:none"><path d="M11 2.5L13.5 5M2 14l3.5-1L13.5 5l-2.5-2.5L3.5 10.5 2 14z" stroke="currentColor" stroke-width="1.5"/></svg>
                        </button>
                        <button class="act-btn del" data-action="cert-del" data-id="${sid}" title="Delete">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="pointer-events:none"><path d="M2.5 4h11M6 4V2.5h4V4M5 4l.7 9.5h4.6L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
    }
    document.getElementById('certPaginationInfo').textContent = total
        ? `Showing ${start + 1}–${Math.min(start + ps, total)} of ${total}` : 'No records';
    renderPagination('cert', pages);
}

// ── CREW ──────────────────────────────────────────────────────────────────────
async function loadCrew() {
    const res = await dbQuery('SELECT * FROM crew WHERE ship_id::text = $1 ORDER BY full_name ASC', [String(SHIP_ID)]);
    crewData = res.rows || [];
    crewMap.clear();
    crewData.forEach(c => crewMap.set(String(c.id), c));
    updateCrewStats();
    applyFilter('crew');
}
function updateCrewStats() {
    const t  = crewData.length;
    const ob = crewData.filter(c => (c.status || '').toLowerCase() === 'on board').length;
    const ol = crewData.filter(c => (c.status || '').toLowerCase() === 'on leave').length;
    const su = crewData.filter(c => (c.status || '').toLowerCase() === 'suspended').length;
    document.getElementById('crewTotal').textContent     = t;
    document.getElementById('crewOnboard').textContent   = ob;
    document.getElementById('crewOnLeave').textContent   = ol;
    document.getElementById('crewSuspended').textContent = su;
    document.getElementById('crewTabCount').textContent  = t;
}
function renderCrewTable() {
    const tbody = document.getElementById('crewTbody');
    const ps    = getCrewPageSize();
    const total = filteredCrew.length;
    const pages = Math.max(1, Math.ceil(total / ps));
    if (crewPage > pages) crewPage = pages;
    const start = (crewPage - 1) * ps;
    const slice = filteredCrew.slice(start, start + ps);
    tbody.innerHTML = '';
    if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👤</div><h3>No Crew</h3><p>No records match your current filter.</p></div></td></tr>`;
    } else {
        slice.forEach((c, i) => {
            const s   = (c.status || '').toLowerCase();
            const cls = s === 'on board' ? 'onboard-b' : s === 'on leave' ? 'onleave-b' : s === 'suspended' ? 'suspended-b' : '';
            const sid = String(c.id);
            const tr  = document.createElement('tr');
            tr.innerHTML = `
                <td class="td-mono">${start + i + 1}</td>
                <td class="td-mono">${c.crew_id || '—'}</td>
                <td><div style="font-weight:700;color:var(--text-dark)">${c.full_name || '—'}</div></td>
                <td>${c.rank_position || '—'}</td>
                <td><span class="badge ${cls}">${c.status || 'Unknown'}</span></td>
                <td>${formatDate(c.date_joined)}</td>
                <td style="font-size:12px">${c.contact_info || '—'}</td>
                <td>
                    <div class="action-btns">
                        <button class="act-btn edit" data-action="crew-edit" data-id="${sid}" title="Edit">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="pointer-events:none"><path d="M11 2.5L13.5 5M2 14l3.5-1L13.5 5l-2.5-2.5L3.5 10.5 2 14z" stroke="currentColor" stroke-width="1.5"/></svg>
                        </button>
                        <button class="act-btn del" data-action="crew-del" data-id="${sid}" title="Delete">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="pointer-events:none"><path d="M2.5 4h11M6 4V2.5h4V4M5 4l.7 9.5h4.6L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
    }
    document.getElementById('crewPaginationInfo').textContent = total
        ? `Showing ${start + 1}–${Math.min(start + ps, total)} of ${total}` : 'No records';
    renderPagination('crew', pages);
}

// ── PAGINATION ────────────────────────────────────────────────────────────────
function renderPagination(type, totalPages) {
    const container   = document.getElementById(type + 'PaginationBtns');
    const currentPage = type === 'cert' ? certPage : crewPage;
    container.innerHTML = '';
    const prev = document.createElement('button');
    prev.className = 'page-btn'; prev.innerHTML = '‹'; prev.disabled = currentPage === 1;
    prev.addEventListener('click', () => { if (type === 'cert') { certPage--; renderCertTable(); } else { crewPage--; renderCrewTable(); } });
    container.appendChild(prev);
    const s = Math.max(1, currentPage - 2), e = Math.min(totalPages, currentPage + 2);
    for (let p = s; p <= e; p++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        const pp = p;
        btn.addEventListener('click', () => { if (type === 'cert') { certPage = pp; renderCertTable(); } else { crewPage = pp; renderCrewTable(); } });
        container.appendChild(btn);
    }
    const next = document.createElement('button');
    next.className = 'page-btn'; next.innerHTML = '›'; next.disabled = currentPage === totalPages || totalPages === 0;
    next.addEventListener('click', () => { if (type === 'cert') { certPage++; renderCertTable(); } else { crewPage++; renderCrewTable(); } });
    container.appendChild(next);
}

// ── ROWS PER PAGE ─────────────────────────────────────────────────────────────
document.getElementById('certPageSize').addEventListener('change', () => { certPage = 1; renderCertTable(); });
document.getElementById('crewPageSize').addEventListener('change', () => { crewPage = 1; renderCrewTable(); });

// ── CERT SUBMIT ───────────────────────────────────────────────────────────────
document.getElementById('certForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id          = document.getElementById('certEditId').value.trim();
    const expiryDate  = document.getElementById('certExpiryDate').value || null;
    const mStatus     = document.getElementById('certStatus').value;
    const finalStatus = mStatus === 'For Renewal' ? 'For Renewal' : (computeAutoStatus(expiryDate) ?? mStatus);
    const p = {
        ship_id: SHIP_ID,
        cert_name:     document.getElementById('certName').value.trim(),
        issuer_agency: document.getElementById('certIssuer').value.trim()  || null,
        cert_no:       document.getElementById('certNo').value.trim()      || null,
        date_of_issue: document.getElementById('certIssueDate').value      || null,
        expiry_date:   expiryDate,
        status:        finalStatus,
        remarks:       document.getElementById('certRemarks').value.trim() || null
    };
    showLoading();
    try {
        if (id) {
            await dbQuery(
                `UPDATE certificates SET ship_id=$1,cert_name=$2,issuer_agency=$3,cert_no=$4,date_of_issue=$5,expiry_date=$6,status=$7,remarks=$8 WHERE id::text=$9`,
                [p.ship_id,p.cert_name,p.issuer_agency,p.cert_no,p.date_of_issue,p.expiry_date,p.status,p.remarks,id]);
        } else {
            await dbQuery(
                `INSERT INTO certificates(ship_id,cert_name,issuer_agency,cert_no,date_of_issue,expiry_date,status,remarks) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
                [p.ship_id,p.cert_name,p.issuer_agency,p.cert_no,p.date_of_issue,p.expiry_date,p.status,p.remarks]);
        }
        closeCertModal(); await loadCerts();
    } catch(err) { alert('Save failed: ' + err.message); }
    finally { hideLoading(); }
});

async function deleteCert(id) {
    const r = await Swal.fire({ title:'Delete Certificate?', html:'This action <strong>cannot be undone</strong>.', icon:'warning', showCancelButton:true, confirmButtonText:'Yes, Delete', cancelButtonText:'Cancel', confirmButtonColor:'#EF4444', cancelButtonColor:'#6B7280', reverseButtons:true, focusCancel:true });
    if (!r.isConfirmed) return;
    showLoading();
    try { await dbQuery('DELETE FROM certificates WHERE id::text=$1',[String(id)]); await loadCerts(); }
    catch(err) { alert('Delete failed: '+err.message); }
    finally { hideLoading(); }
}

// ── CREW SUBMIT ───────────────────────────────────────────────────────────────
document.getElementById('crewForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('crewEditId').value.trim();
    const p  = {
        ship_id:       SHIP_ID,
        crew_id:       document.getElementById('crewId').value.trim()       || null,
        full_name:     document.getElementById('crewFullName').value.trim(),
        rank_position: document.getElementById('crewRank').value.trim(),
        status:        document.getElementById('crewStatus').value,
        date_joined:   document.getElementById('crewDateJoined').value      || null,
        contact_info:  document.getElementById('crewContact').value.trim()  || null
    };
    if (!p.full_name || !p.rank_position) { alert('Full Name and Rank are required!'); return; }
    showLoading();
    try {
        if (id) {
            await dbQuery(
                `UPDATE crew SET ship_id=$1,crew_id=$2,full_name=$3,rank_position=$4,status=$5,date_joined=$6,contact_info=$7 WHERE id::text=$8`,
                [p.ship_id,p.crew_id,p.full_name,p.rank_position,p.status,p.date_joined,p.contact_info,id]);
        } else {
            await dbQuery(
                `INSERT INTO crew(ship_id,crew_id,full_name,rank_position,status,date_joined,contact_info) VALUES($1,$2,$3,$4,$5,$6,$7)`,
                [p.ship_id,p.crew_id,p.full_name,p.rank_position,p.status,p.date_joined,p.contact_info]);
        }
        closeCrewModal(); await loadCrew();
    } catch(err) { alert('Save failed: ' + err.message); }
    finally { hideLoading(); }
});

async function deleteCrewMember(id) {
    const r = await Swal.fire({ title:'Delete Crew Member?', html:'This action <strong>cannot be undone</strong>.', icon:'warning', showCancelButton:true, confirmButtonText:'Yes, Delete', cancelButtonText:'Cancel', confirmButtonColor:'#EF4444', cancelButtonColor:'#6B7280', reverseButtons:true, focusCancel:true });
    if (!r.isConfirmed) return;
    showLoading();
    try { await dbQuery('DELETE FROM crew WHERE id::text=$1',[String(id)]); await loadCrew(); }
    catch(err) { alert('Delete failed: '+err.message); }
    finally { hideLoading(); }
}

// ── FILTER BUTTONS ────────────────────────────────────────────────────────────
function setupFilterBtns(btns, type) {
    btns.forEach(({ id, filter }) => {
        document.getElementById(id).addEventListener('click', function() {
            btns.forEach(b => document.getElementById(b.id).classList.remove('active'));
            this.classList.add('active');
            if (type === 'cert') certFilter = filter; else crewFilter = filter;
            applyFilter(type);
        });
    });
}
setupFilterBtns([
    { id:'certFilterAll', filter:'all' }, { id:'certFilterActive', filter:'active' },
    { id:'certFilterExpiring', filter:'expiring' }, { id:'certFilterExpired', filter:'expired' },
    { id:'certFilterRenewal', filter:'renewal' }
], 'cert');
setupFilterBtns([
    { id:'crewFilterAll', filter:'all' }, { id:'crewFilterOnboard', filter:'on board' },
    { id:'crewFilterOnLeave', filter:'on leave' }, { id:'crewFilterSuspended', filter:'suspended' }
], 'crew');

// ── SEARCH ────────────────────────────────────────────────────────────────────
function setupSearch(inputId, clearId, type) {
    const input = document.getElementById(inputId);
    const clear = document.getElementById(clearId);
    const dots  = document.createElement('div');
    dots.className = 'search-loading-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    input.closest('.search-bar-container').appendChild(dots);
    let timer = null;
    input.addEventListener('input', function() {
        clear.classList.toggle('visible', this.value.length > 0);
        if (this.value) dots.classList.add('visible');
        clearTimeout(timer);
        timer = setTimeout(() => { dots.classList.remove('visible'); applyFilter(type); }, 350);
    });
    clear.addEventListener('click', () => {
        input.value = ''; clear.classList.remove('visible'); dots.classList.remove('visible');
        clearTimeout(timer); applyFilter(type);
    });
}
setupSearch('certSearch', 'certSearchClear', 'cert');
setupSearch('crewSearch', 'crewSearchClear', 'crew');

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
    catch(e) { return d; }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
    showLoading();
    try { await loadShip(); await Promise.all([loadCerts(), loadCrew()]); }
    finally { hideLoading(); }
    switchTab(INIT_TAB);
}
document.addEventListener('DOMContentLoaded', init);