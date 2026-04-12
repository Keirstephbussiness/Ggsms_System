/**
 * admin-seafarer.js
 * GGSMS Seafarer Application Management
 * ─────────────────────────────────────
 * Features:
 *  - CRUD (Add / Edit / Delete applicants)
 *  - Hybrid search: exact → prefix → fuzzy (debounced 300ms)
 *  - Status + Position filters
 *  - Sort options
 *  - Pagination (10 per page)
 *  - Document checklist with auto-status detection
 *  - Admin remarks
 *  - Detail view modal
 *  - Stat pills (live counts)
 */

'use strict';

/* ══════════════════════════════════════════════════
   MOCK DATA  (replace with real API/Supabase calls)
══════════════════════════════════════════════════ */
const ALL_DOCS = [
    { key: 'resume',      label: 'Resume / CV' },
    { key: 'seaman_book', label: 'Seaman Book' },
    { key: 'passport',    label: 'Passport' },
    { key: 'stcw',        label: 'STCW Certificate' },
    { key: 'medical',     label: 'Medical Certificate' },
    { key: 'flag_state',  label: 'Flag State License' },
    { key: 'endorsement', label: 'Endorsement' },
    { key: 'sire',        label: 'SIRE / OCIMF' },
];

const STATUS_MAP = {
    pending:  { label: '⏳ Pending Review',        cls: 'pending' },
    missing:  { label: '⚠️ Missing Requirements', cls: 'missing' },
    review:   { label: '🔍 Under Review',          cls: 'review' },
    approved: { label: '✔️ Approved',              cls: 'approved' },
    rejected: { label: '❌ Rejected',              cls: 'rejected' },
};

let applicants = [
    {
        id: 1, name: 'Juan Dela Cruz', email: 'juan@seafarer.ph',
        phone: '+639171234567', nationality: 'Filipino',
        position: 'Captain', status: 'approved',
        appliedDate: '2025-03-10',
        docs: ['resume','seaman_book','passport','stcw','medical','flag_state','endorsement','sire'],
        remarks: 'Experienced captain with 15 years. Ready for interview.',
    },
    {
        id: 2, name: 'Maria Santos', email: 'maria@oceancrew.com',
        phone: '+639281234567', nationality: 'Filipino',
        position: 'Chief Officer', status: 'review',
        appliedDate: '2025-03-22',
        docs: ['resume','passport','stcw','medical'],
        remarks: 'Missing seaman book and endorsement. Follow up needed.',
    },
    {
        id: 3, name: 'Pedro Reyes', email: 'pedro.r@maritime.net',
        phone: '+639351234567', nationality: 'Filipino',
        position: 'Chief Engineer', status: 'missing',
        appliedDate: '2025-04-01',
        docs: ['resume','seaman_book'],
        remarks: 'Missing passport, STCW, medical, flag state license.',
    },
    {
        id: 4, name: 'Ana Mendoza', email: 'ana.m@shipjobs.ph',
        phone: '+639451234567', nationality: 'Filipino',
        position: '2nd Officer', status: 'pending',
        appliedDate: '2025-04-05',
        docs: ['resume','passport'],
        remarks: '',
    },
    {
        id: 5, name: 'Carlo Bautista', email: 'carlo.b@crew.com',
        phone: '+639561234567', nationality: 'Filipino',
        position: '2nd Engineer', status: 'pending',
        appliedDate: '2025-04-08',
        docs: ['resume','seaman_book','passport','stcw'],
        remarks: '',
    },
    {
        id: 6, name: 'Jose Ramos', email: 'jose.r@maritime.com',
        phone: '+639671234567', nationality: 'Filipino',
        position: 'AB Seaman', status: 'approved',
        appliedDate: '2025-03-15',
        docs: ['resume','seaman_book','passport','stcw','medical','flag_state','endorsement','sire'],
        remarks: 'Cleared all requirements. Scheduled for interview Apr 20.',
    },
    {
        id: 7, name: 'Elena Cruz', email: 'elena.c@shipping.net',
        phone: '+639781234567', nationality: 'Filipino',
        position: '3rd Officer', status: 'rejected',
        appliedDate: '2025-02-20',
        docs: ['resume','passport','stcw'],
        remarks: 'Does not meet minimum sea service requirement.',
    },
    {
        id: 8, name: 'Roberto Garcia', email: 'roberto.g@ocean.ph',
        phone: '+639891234567', nationality: 'Filipino',
        position: 'Bosun', status: 'review',
        appliedDate: '2025-04-09',
        docs: ['resume','seaman_book','passport','stcw','medical'],
        remarks: '',
    },
    {
        id: 9, name: 'Liza Fernandez', email: 'liza.f@crew.net',
        phone: '+639912345678', nationality: 'Filipino',
        position: 'Cook', status: 'pending',
        appliedDate: '2025-04-10',
        docs: ['resume'],
        remarks: '',
    },
    {
        id: 10, name: 'Marco Villanueva', email: 'marco.v@maritime.ph',
        phone: '+639023456789', nationality: 'Filipino',
        position: 'Oiler', status: 'missing',
        appliedDate: '2025-04-02',
        docs: ['resume','seaman_book','passport'],
        remarks: 'Awaiting updated medical certificate.',
    },
    {
        id: 11, name: 'Diego Torres', email: 'diego.t@seafarer.com',
        phone: '+639134567890', nationality: 'Filipino',
        position: '3rd Engineer', status: 'pending',
        appliedDate: '2025-04-11',
        docs: ['resume','passport'],
        remarks: '',
    },
    {
        id: 12, name: 'Sophia Aquino', email: 'sophia.a@mariners.ph',
        phone: '+639245678901', nationality: 'Filipino',
        position: 'Chief Officer', status: 'approved',
        appliedDate: '2025-03-28',
        docs: ['resume','seaman_book','passport','stcw','medical','flag_state','endorsement','sire'],
        remarks: 'All docs verified. Awaiting vessel assignment.',
    },
];

let nextId = 13;

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
const PAGE_SIZE = 10;
let state = {
    searchQuery: '',
    statusFilter: '',
    positionFilter: '',
    sort: 'newest',
    page: 1,
    filtered: [...applicants],
};

/* ══════════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const searchInput    = $('seafarerSearchInput');
const clearBtn       = $('clearSearchBtn');
const statusFilter   = $('statusFilter');
const positionFilter = $('positionFilter');
const sortFilter     = $('sortFilter');
const tableBody      = $('applicantsTableBody');
const tableEmpty     = $('tableEmpty');
const tableLoading   = $('tableLoading');
const paginationInfo = $('paginationInfo');
const paginationBtns = $('paginationBtns');

/* ══════════════════════════════════════════════════
   SEARCH — Hybrid: exact → prefix → fuzzy
══════════════════════════════════════════════════ */
function fuzzyScore(str, q) {
    str = str.toLowerCase(); q = q.toLowerCase();
    if (str === q) return 100;
    if (str.startsWith(q)) return 80;
    if (str.includes(q)) return 60;
    // Simple character-match fuzzy
    let si = 0, qi = 0, score = 0;
    while (si < str.length && qi < q.length) {
        if (str[si] === q[qi]) { score++; qi++; }
        si++;
    }
    return qi === q.length ? score * 10 : 0;
}

function searchApplicants(list, q) {
    if (!q.trim()) return list;
    q = q.trim().toLowerCase();
    return list
        .map(a => {
            const fields = [a.name, a.email || '', a.position, a.phone || '', a.nationality || ''];
            const score  = Math.max(...fields.map(f => fuzzyScore(f, q)));
            return { a, score };
        })
        .filter(({ score }) => score > 0)
        .sort((x, y) => y.score - x.score)
        .map(({ a }) => a);
}

/* ══════════════════════════════════════════════════
   FILTER + SORT
══════════════════════════════════════════════════ */
function applyFilters() {
    let list = [...applicants];

    // Search
    list = searchApplicants(list, state.searchQuery);

    // Status
    if (state.statusFilter) list = list.filter(a => a.status === state.statusFilter);

    // Position
    if (state.positionFilter) list = list.filter(a => a.position === state.positionFilter);

    // Sort
    switch (state.sort) {
        case 'oldest':  list.sort((a,b) => a.appliedDate.localeCompare(b.appliedDate)); break;
        case 'name_az': list.sort((a,b) => a.name.localeCompare(b.name));               break;
        case 'name_za': list.sort((a,b) => b.name.localeCompare(a.name));               break;
        default:        list.sort((a,b) => b.appliedDate.localeCompare(a.appliedDate)); break; // newest
    }

    state.filtered = list;
    state.page = 1; // reset to first page on filter change
}

/* ══════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════ */
function updateStats() {
    $('statPending').textContent  = applicants.filter(a => a.status === 'pending').length;
    $('statReview').textContent   = applicants.filter(a => a.status === 'review').length;
    $('statApproved').textContent = applicants.filter(a => a.status === 'approved').length;
    $('statMissing').textContent  = applicants.filter(a => a.status === 'missing').length;
}

/* ══════════════════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════════════════ */
function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function relativeDate(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso)) / 86400000;
    if (diff < 1)   return 'Today';
    if (diff < 2)   return 'Yesterday';
    if (diff < 7)   return `${Math.floor(diff)}d ago`;
    if (diff < 30)  return `${Math.floor(diff/7)}w ago`;
    if (diff < 365) return `${Math.floor(diff/30)}mo ago`;
    return `${Math.floor(diff/365)}y ago`;
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function renderDocsProgress(docs) {
    const count = docs.length;
    const total = ALL_DOCS.length;
    const pct   = Math.round((count / total) * 100);
    let cls = '';
    if (pct === 100) cls = 'complete';
    else if (pct < 40) cls = 'low';
    return `
        <div class="docs-progress">
            <div class="docs-bar-track">
                <div class="docs-bar-fill ${cls}" style="width:${pct}%"></div>
            </div>
            <span class="docs-label">${count}/${total} docs</span>
        </div>`;
}

function renderRow(a, delay) {
    const st   = STATUS_MAP[a.status] || STATUS_MAP.pending;
    const init = getInitials(a.name);
    return `
    <tr data-id="${a.id}" style="animation-delay:${delay}ms">
        <td>
            <div class="applicant-name-cell">
                <div class="applicant-avatar">${init}</div>
                <div class="applicant-info">
                    <div class="a-name">${escHtml(a.name)}</div>
                    <div class="a-email">${escHtml(a.email || '—')}</div>
                </div>
            </div>
        </td>
        <td><span class="position-badge">${escHtml(a.position)}</span></td>
        <td>
            <span class="status-badge ${st.cls}">
                <span class="s-dot"></span>${st.label}
            </span>
        </td>
        <td>
            <div class="date-cell">
                ${formatDate(a.appliedDate)}
                <div class="date-rel">${relativeDate(a.appliedDate)}</div>
            </div>
        </td>
        <td>${renderDocsProgress(a.docs)}</td>
        <td>
            <div class="row-actions">
                <button class="row-btn row-btn-view" title="View Details" onclick="viewApplicant(${a.id})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2"/>
                        <path d="M10 9v5M10 7v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
                <button class="row-btn row-btn-edit" title="Edit" onclick="editApplicant(${a.id})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <path d="M14 3L17 6M2 18L6 17.5L17 6.5L14 3.5L3 14.5L2 18Z" stroke="currentColor" stroke-width="1.8"/>
                    </svg>
                </button>
                <button class="row-btn row-btn-delete" title="Delete" onclick="deleteApplicant(${a.id})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <path d="M3 5H17M7 5V3H13V5M8 9V15M12 9V15M5 5L6 17H14L15 5" stroke="currentColor" stroke-width="1.8"/>
                    </svg>
                </button>
            </div>
        </td>
    </tr>`;
}

function renderTable() {
    const total = state.filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;

    const start = (state.page - 1) * PAGE_SIZE;
    const slice = state.filtered.slice(start, start + PAGE_SIZE);

    tableLoading.style.display = 'none';

    if (!slice.length) {
        tableBody.innerHTML = '';
        tableEmpty.style.display = 'block';
    } else {
        tableEmpty.style.display = 'none';
        tableBody.innerHTML = slice.map((a, i) => renderRow(a, i * 40)).join('');
    }

    // Pagination info
    if (total === 0) {
        paginationInfo.textContent = 'No results';
    } else {
        const from = start + 1;
        const to   = Math.min(start + PAGE_SIZE, total);
        paginationInfo.textContent = `Showing ${from}–${to} of ${total} applicant${total !== 1 ? 's' : ''}`;
    }

    renderPagination(pages);
    updateStats();
}

/* ══════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════ */
function renderPagination(pages) {
    const cur = state.page;
    let html = '';

    html += `<button class="page-btn" ${cur===1?'disabled':''} onclick="goPage(${cur-1})">
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M8 2L4 6L8 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
             </button>`;

    const range = buildPageRange(cur, pages);
    range.forEach(p => {
        if (p === '...') {
            html += `<button class="page-btn" disabled>…</button>`;
        } else {
            html += `<button class="page-btn ${p===cur?'active':''}" onclick="goPage(${p})">${p}</button>`;
        }
    });

    html += `<button class="page-btn" ${cur===pages?'disabled':''} onclick="goPage(${cur+1})">
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
             </button>`;

    paginationBtns.innerHTML = html;
}

function buildPageRange(cur, pages) {
    if (pages <= 7) return Array.from({length: pages}, (_, i) => i + 1);
    const r = [];
    r.push(1);
    if (cur > 3)  r.push('...');
    for (let p = Math.max(2, cur-1); p <= Math.min(pages-1, cur+1); p++) r.push(p);
    if (cur < pages - 2) r.push('...');
    r.push(pages);
    return r;
}

window.goPage = function(p) {
    state.page = p;
    renderTable();
};

/* ══════════════════════════════════════════════════
   REFRESH
══════════════════════════════════════════════════ */
function refresh() {
    applyFilters();
    renderTable();
}

/* ══════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════ */
function openModal(overlayId) { $(overlayId).classList.add('active'); }
function closeModal(overlayId) { $(overlayId).classList.remove('active'); }

function escHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ══════════════════════════════════════════════════
   ADD / EDIT MODAL
══════════════════════════════════════════════════ */
function clearForm() {
    $('applicantEditId').value    = '';
    $('applicantName').value      = '';
    $('applicantEmail').value     = '';
    $('applicantPhone').value     = '';
    $('applicantNationality').value = '';
    $('applicantPosition').value  = '';
    $('applicantStatus').value    = 'pending';
    $('applicantRemarks').value   = '';
    document.querySelectorAll('#docsChecklist input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function populateForm(a) {
    $('applicantEditId').value    = a.id;
    $('applicantName').value      = a.name;
    $('applicantEmail').value     = a.email     || '';
    $('applicantPhone').value     = a.phone     || '';
    $('applicantNationality').value = a.nationality || '';
    $('applicantPosition').value  = a.position;
    $('applicantStatus').value    = a.status;
    $('applicantRemarks').value   = a.remarks   || '';
    document.querySelectorAll('#docsChecklist input[type="checkbox"]').forEach(cb => {
        cb.checked = a.docs.includes(cb.value);
    });
}

$('addApplicantBtn').addEventListener('click', () => {
    clearForm();
    $('applicantModalTitle').textContent = 'Add New Applicant';
    openModal('applicantModalOverlay');
});

$('applicantModalCloseBtn').addEventListener('click', () => closeModal('applicantModalOverlay'));
$('applicantCancelBtn').addEventListener('click', () => closeModal('applicantModalOverlay'));

$('applicantModalOverlay').addEventListener('click', e => {
    if (e.target === $('applicantModalOverlay')) closeModal('applicantModalOverlay');
});

$('applicantForm').addEventListener('submit', e => {
    e.preventDefault();

    const name = $('applicantName').value.trim();
    const pos  = $('applicantPosition').value;
    if (!name || !pos) {
        Swal.fire({
            icon: 'warning', title: 'Missing Fields',
            text: 'Please fill in Full Name and Position.',
            customClass: { popup: 'swal-custom-popup', title: 'swal-custom-title', htmlContainer: 'swal-custom-html' },
        });
        return;
    }

    const checkedDocs = [...document.querySelectorAll('#docsChecklist input:checked')].map(cb => cb.value);
    const editId = $('applicantEditId').value;

    const data = {
        name,
        email:       $('applicantEmail').value.trim(),
        phone:       $('applicantPhone').value.trim(),
        nationality: $('applicantNationality').value.trim(),
        position:    pos,
        status:      $('applicantStatus').value,
        remarks:     $('applicantRemarks').value.trim(),
        docs:        checkedDocs,
    };

    if (editId) {
        const idx = applicants.findIndex(a => a.id == editId);
        if (idx !== -1) applicants[idx] = { ...applicants[idx], ...data };
    } else {
        data.id          = nextId++;
        data.appliedDate = new Date().toISOString().slice(0, 10);
        applicants.unshift(data);
    }

    closeModal('applicantModalOverlay');
    refresh();

    Swal.fire({
        icon: 'success',
        title: editId ? 'Applicant Updated' : 'Applicant Added',
        text: `${name} has been ${editId ? 'updated' : 'added'} successfully.`,
        timer: 2200, showConfirmButton: false,
        customClass: { popup: 'swal-custom-popup', title: 'swal-custom-title', htmlContainer: 'swal-custom-html' },
    });
});

window.editApplicant = function(id) {
    const a = applicants.find(x => x.id === id);
    if (!a) return;
    populateForm(a);
    $('applicantModalTitle').textContent = 'Edit Applicant';
    openModal('applicantModalOverlay');
};

/* ══════════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════════ */
window.deleteApplicant = function(id) {
    const a = applicants.find(x => x.id === id);
    if (!a) return;
    Swal.fire({
        icon: 'warning', title: 'Delete Applicant?',
        html: `Are you sure you want to delete <strong>${escHtml(a.name)}</strong>? This action cannot be undone.`,
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        confirmButtonColor: '#EF4444',
        cancelButtonText: 'Cancel',
        customClass: { popup: 'swal-custom-popup', title: 'swal-custom-title', htmlContainer: 'swal-custom-html' },
    }).then(result => {
        if (result.isConfirmed) {
            applicants = applicants.filter(x => x.id !== id);
            refresh();
            Swal.fire({
                icon: 'success', title: 'Deleted',
                text: `${a.name} has been removed.`,
                timer: 1800, showConfirmButton: false,
                customClass: { popup: 'swal-custom-popup', title: 'swal-custom-title', htmlContainer: 'swal-custom-html' },
            });
        }
    });
};

/* ══════════════════════════════════════════════════
   VIEW DETAIL
══════════════════════════════════════════════════ */
window.viewApplicant = function(id) {
    const a = applicants.find(x => x.id === id);
    if (!a) return;

    const st   = STATUS_MAP[a.status] || STATUS_MAP.pending;
    const init = getInitials(a.name);

    const docsHtml = ALL_DOCS.map(d => {
        const has = a.docs.includes(d.key);
        return `<div class="detail-doc-row ${has ? 'has' : 'missing'}">
            ${has
                ? '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7L6 11L12 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
                : '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
            }
            ${d.label}
        </div>`;
    }).join('');

    $('detailModalTitle').textContent = 'Applicant Details';
    $('detailModalBody').innerHTML = `
        <div class="detail-header-card">
            <div class="detail-avatar">${init}</div>
            <div class="detail-header-info">
                <div class="detail-h-name">${escHtml(a.name)}</div>
                <div class="detail-h-sub">
                    <span class="status-badge ${st.cls}" style="font-size:10px;padding:2px 8px;">
                        <span class="s-dot"></span>${st.label}
                    </span>
                    &nbsp;&nbsp;${escHtml(a.position)}
                </div>
                <div class="detail-h-date">Applied: ${formatDate(a.appliedDate)} (${relativeDate(a.appliedDate)})</div>
            </div>
        </div>

        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-item-label">Email</div>
                <div class="detail-item-value ${!a.email?'na':''}">${escHtml(a.email || 'Not provided')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Phone</div>
                <div class="detail-item-value ${!a.phone?'na':''}">${escHtml(a.phone || 'Not provided')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Nationality</div>
                <div class="detail-item-value ${!a.nationality?'na':''}">${escHtml(a.nationality || 'Not provided')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-item-label">Position</div>
                <div class="detail-item-value">${escHtml(a.position)}</div>
            </div>
        </div>

        <div class="form-section-title" style="margin-top:14px;">Documents (${a.docs.length}/${ALL_DOCS.length})</div>
        <div class="detail-docs-list">${docsHtml}</div>

        <div class="form-section-title" style="margin-top:14px;">Admin Remarks</div>
        <div class="detail-remarks ${!a.remarks?'empty':''}">${escHtml(a.remarks || 'No remarks added.')}</div>

        <div class="form-actions" style="margin-top:14px;">
            <button class="btn-cancel" onclick="closeModal('detailModalOverlay')">Close</button>
            <button class="btn-submit" onclick="closeModal('detailModalOverlay'); editApplicant(${a.id})">
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                    <path d="M14 3L17 6M2 18L6 17.5L17 6.5L14 3.5L3 14.5L2 18Z" stroke="currentColor" stroke-width="2"/>
                </svg>
                Edit Applicant
            </button>
        </div>
    `;

    openModal('detailModalOverlay');
};

$('detailModalCloseBtn').addEventListener('click', () => closeModal('detailModalOverlay'));
$('detailModalOverlay').addEventListener('click', e => {
    if (e.target === $('detailModalOverlay')) closeModal('detailModalOverlay');
});

/* ══════════════════════════════════════════════════
   SEARCH & FILTER EVENTS
══════════════════════════════════════════════════ */
let searchDebounce;
searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    clearBtn.classList.toggle('visible', !!state.searchQuery);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(refresh, 300);
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.classList.remove('visible');
    refresh();
    searchInput.focus();
});

statusFilter.addEventListener('change', () => {
    state.statusFilter = statusFilter.value;
    refresh();
});

positionFilter.addEventListener('change', () => {
    state.positionFilter = positionFilter.value;
    refresh();
});

sortFilter.addEventListener('change', () => {
    state.sort = sortFilter.value;
    refresh();
});

/* ══════════════════════════════════════════════════
   WINDOW CONTROLS (Electron-style stubs)
══════════════════════════════════════════════════ */
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn    = document.getElementById('closeBtn');
if (minimizeBtn) minimizeBtn.addEventListener('click', () => window.electronAPI?.minimize?.());
if (maximizeBtn) maximizeBtn.addEventListener('click', () => window.electronAPI?.maximize?.());
if (closeBtn)    closeBtn.addEventListener('click',    () => window.electronAPI?.close?.());

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
refresh();