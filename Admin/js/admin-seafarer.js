/**
 * admin-seafarer.js
 * GGSMS — Seafarer Application Management
 * ─────────────────────────────────────────
 * View-only admin system. Applications come from the public form.
 * Features:
 *   • Full applicant data matching the 4-step public form
 *   • Hybrid search (exact → prefix → fuzzy, 300ms debounce)
 *   • Status + Position filters, sort
 *   • Paginated table (10 per page)
 *   • Stat pills: Total, New (7d), Pending, Review, Approved, Missing
 *   • Detail view modal — ALL form fields displayed cleanly
 *   • Status update modal (no edit of personal data)
 *   • Submitted files viewer modal
 *   • Download PDF (jsPDF) — full application in document style
 *   • Soft delete only
 */

'use strict';

/* ════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════ */
const PAGE_SIZE = 10;

const STATUS_MAP = {
    pending:  { label: '⏳ Pending Review',        cls: 'pending'  },
    missing:  { label: '⚠️ Missing Requirements', cls: 'missing'  },
    review:   { label: '🔍 Under Review',          cls: 'review'   },
    approved: { label: '✔️ Approved',              cls: 'approved' },
    rejected: { label: '❌ Rejected',              cls: 'rejected' },
};

const ALL_DOCS = [
    'Seaman Book (SIRB)',
    'COC – Certificate of Competency (PRC)',
    'D-COC MARINA Certificate',
    'Endorsement Certificate (PRC)',
    'PRC License',
    'Sea Service Record',
    'MARINA License (MDM2)',
    'Yellow Card',
];

const ALL_TRAINING = [
    'Basic Training Certificate',
    'PSSR Certificate',
    'PSCRB',
    'Ship Security Officer (SSO)',
    'Ship Security Awareness (SSA)',
    'GMDSS Certificate',
    'Radar Simulator Course (RSC)',
    'SRROC',
    'Medical Care',
    'PADAMS',
    'ISM Certificate',
    'Deck Watch Keeping',
    'Engine Watch Keeping',
    'Radar Observation Plotting (R.O.P)',
    'Marpol I–VI',
    'Culinary Certificate',
];

/* ════════════════════════════════════════════════
   MOCK DATA — matches the 4-step public form fields
   In production: replace with real API / Supabase fetch
════════════════════════════════════════════════ */
let applicants = [
    {
        id: 1,
        /* Step 1 — Position */
        position: 'Master',
        availDate: '2025-05-01',
        contract: '9 months',
        experience: 'More than 10 years',
        notes1: 'VLCC and bulk carrier experience. Available for immediate deployment.',
        /* Step 2 — Personal */
        fname: 'Juan', mname: 'Santos', lname: 'Dela Cruz', suffix: 'Jr.',
        dob: '1980-03-15', age: '45', civil: 'Married',
        address: 'Blk 12 Lot 5, Sampaguita St., Barangay Uno, Cavite City, Cavite, 4100',
        contact: '+639171234567', email: 'juan.dc@seafarer.ph',
        emname: 'Maria Dela Cruz', emnum: '+639281234567',
        nationality: 'Filipino',
        /* Step 3 — Documents */
        docs: ['Seaman Book (SIRB)', 'COC – Certificate of Competency (PRC)', 'D-COC MARINA Certificate',
               'Endorsement Certificate (PRC)', 'PRC License', 'Sea Service Record', 'MARINA License (MDM2)', 'Yellow Card'],
        training: ['Basic Training Certificate', 'PSSR Certificate', 'PSCRB', 'Ship Security Officer (SSO)',
                   'GMDSS Certificate', 'Radar Simulator Course (RSC)', 'Engine Watch Keeping', 'Marpol I–VI'],
        uploadedFiles: [
            { name: 'Resume_JuanDelaCruz.pdf', size: '1.2 MB', type: 'pdf' },
            { name: 'SeamanBook.pdf', size: '3.4 MB', type: 'pdf' },
            { name: 'COC_Certificate.pdf', size: '870 KB', type: 'pdf' },
        ],
        /* Admin */
        status: 'approved',
        remarks: 'All documents verified. Scheduled for interview April 20, 2025.',
        appliedDate: '2025-03-10',
    },
    {
        id: 2,
        position: 'Chief Officer',
        availDate: '2025-06-15',
        contract: '6 months',
        experience: '6–10 years',
        notes1: 'Experienced on container vessels.',
        fname: 'Maria', mname: '', lname: 'Santos', suffix: '',
        dob: '1985-07-22', age: '39', civil: 'Single',
        address: '45 Rizal Ave., Barangay Bagong Ilog, Pasig City, Metro Manila, 1600',
        contact: '+639281234567', email: 'maria.santos@oceancrew.com',
        emname: 'Rosa Santos', emnum: '+639391234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'COC – Certificate of Competency (PRC)', 'PRC License', 'Yellow Card'],
        training: ['Basic Training Certificate', 'PSSR Certificate', 'Ship Security Awareness (SSA)', 'Deck Watch Keeping'],
        uploadedFiles: [
            { name: 'CV_MariaSantos.pdf', size: '950 KB', type: 'pdf' },
            { name: 'Passport_scan.jpg', size: '2.1 MB', type: 'img' },
        ],
        status: 'review',
        remarks: 'Missing endorsement and sea service record.',
        appliedDate: '2025-03-22',
    },
    {
        id: 3,
        position: 'Chief Engineer',
        availDate: '2025-07-01',
        contract: '12 months',
        experience: '6–10 years',
        notes1: '',
        fname: 'Pedro', mname: 'R.', lname: 'Reyes', suffix: '',
        dob: '1982-11-10', age: '42', civil: 'Married',
        address: '78 Mabini St., Tondo, Manila, Metro Manila, 1013',
        contact: '+639351234567', email: 'pedro.reyes@maritime.net',
        emname: 'Carla Reyes', emnum: '+639461234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'PRC License'],
        training: ['Basic Training Certificate', 'Engine Watch Keeping'],
        uploadedFiles: [
            { name: 'Resume.docx', size: '620 KB', type: 'doc' },
        ],
        status: 'missing',
        remarks: 'Missing COC, DCOC, Endorsement, Sea Service Record, MARINA License, Yellow Card.',
        appliedDate: '2025-04-01',
    },
    {
        id: 4,
        position: 'Second Officer',
        availDate: '2025-05-20',
        contract: '6 months',
        experience: '3–5 years',
        notes1: 'Prefer RoRo or bulk carrier.',
        fname: 'Ana', mname: 'B.', lname: 'Mendoza', suffix: '',
        dob: '1993-02-28', age: '32', civil: 'Single',
        address: '22 Sampaguita Lane, Taytay, Rizal, 1920',
        contact: '+639451234567', email: 'ana.mendoza@shipjobs.ph',
        emname: 'Ben Mendoza', emnum: '+639561234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'COC – Certificate of Competency (PRC)', 'PRC License'],
        training: ['Basic Training Certificate', 'PSSR Certificate', 'Deck Watch Keeping', 'Radar Observation Plotting (R.O.P)'],
        uploadedFiles: [
            { name: 'CV_AnaMendoza.pdf', size: '780 KB', type: 'pdf' },
            { name: 'Seaman_Book_scan.jpg', size: '1.8 MB', type: 'img' },
        ],
        status: 'pending',
        remarks: '',
        appliedDate: '2025-04-05',
    },
    {
        id: 5,
        position: 'Second Engineer',
        availDate: '2025-05-10',
        contract: '9 months',
        experience: '3–5 years',
        notes1: '',
        fname: 'Carlo', mname: '', lname: 'Bautista', suffix: '',
        dob: '1990-09-14', age: '34', civil: 'Married',
        address: '90 Mango St., Zamboanga City, Zamboanga del Sur, 7000',
        contact: '+639561234567', email: 'carlo.bautista@crew.com',
        emname: 'Lena Bautista', emnum: '+639671234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'COC – Certificate of Competency (PRC)', 'PRC License', 'Sea Service Record'],
        training: ['Basic Training Certificate', 'PSCRB', 'Engine Watch Keeping', 'Marpol I–VI'],
        uploadedFiles: [
            { name: 'Resume_Bautista.pdf', size: '1.0 MB', type: 'pdf' },
            { name: 'COC.pdf', size: '540 KB', type: 'pdf' },
        ],
        status: 'pending',
        remarks: '',
        appliedDate: '2025-04-08',
    },
    {
        id: 6,
        position: 'Able Bodied Seaman (ABS)',
        availDate: '2025-04-25',
        contract: '6 months',
        experience: '1–2 years',
        notes1: 'Experience on LCT vessels.',
        fname: 'Jose', mname: 'M.', lname: 'Ramos', suffix: '',
        dob: '1995-06-03', age: '29', civil: 'Single',
        address: '15 Jasmine St., Barangay Holy Spirit, Quezon City, Metro Manila, 1127',
        contact: '+639671234567', email: 'jose.ramos@maritime.com',
        emname: 'Lito Ramos', emnum: '+639781234567',
        nationality: 'Filipino',
        docs: ALL_DOCS,
        training: ['Basic Training Certificate', 'PSSR Certificate', 'PSCRB', 'Ship Security Awareness (SSA)', 'Marpol I–VI', 'Culinary Certificate'],
        uploadedFiles: [
            { name: 'Resume_JoseRamos.pdf', size: '890 KB', type: 'pdf' },
            { name: 'SeamanBook.pdf', size: '2.3 MB', type: 'pdf' },
            { name: 'TrainingCerts.zip', size: '5.1 MB', type: 'other' },
        ],
        status: 'approved',
        remarks: 'All documents complete. Ready for vessel assignment.',
        appliedDate: '2025-03-15',
    },
    {
        id: 7,
        position: 'Third Officer',
        availDate: '2025-08-01',
        contract: 'Open / Negotiable',
        experience: '1–2 years',
        notes1: '',
        fname: 'Elena', mname: 'C.', lname: 'Cruz', suffix: '',
        dob: '1998-12-19', age: '26', civil: 'Single',
        address: '34 Magsaysay Blvd., Naga City, Camarines Sur, 4400',
        contact: '+639781234567', email: 'elena.cruz@shipping.net',
        emname: 'Tony Cruz', emnum: '+639891234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'PRC License', 'Yellow Card'],
        training: ['Basic Training Certificate', 'PSSR Certificate', 'Deck Watch Keeping'],
        uploadedFiles: [
            { name: 'CV_ElenaCruz.pdf', size: '700 KB', type: 'pdf' },
        ],
        status: 'rejected',
        remarks: 'Does not meet minimum 2-year sea service requirement for this position.',
        appliedDate: '2025-02-20',
    },
    {
        id: 8,
        position: 'Deck Cadet',
        availDate: '2025-05-15',
        contract: '6 months',
        experience: 'Fresh Graduate / No Experience',
        notes1: 'Fresh BSMT graduate, ready for OJT.',
        fname: 'Roberto', mname: 'L.', lname: 'Garcia', suffix: '',
        dob: '2001-04-10', age: '23', civil: 'Single',
        address: '56 Commonwealth Ave., Quezon City, Metro Manila, 1100',
        contact: '+639891234567', email: 'roberto.garcia@ocean.ph',
        emname: 'Fe Garcia', emnum: '+639901234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'COC – Certificate of Competency (PRC)', 'PRC License', 'Sea Service Record', 'Yellow Card'],
        training: ['Basic Training Certificate', 'PSSR Certificate', 'PSCRB', 'Ship Security Awareness (SSA)', 'Radar Observation Plotting (R.O.P)'],
        uploadedFiles: [
            { name: 'Resume_Roberto.pdf', size: '550 KB', type: 'pdf' },
            { name: 'Transcript.pdf', size: '1.2 MB', type: 'pdf' },
        ],
        status: 'review',
        remarks: '',
        appliedDate: '2025-04-09',
    },
    {
        id: 9,
        position: 'Cook',
        availDate: '2025-05-05',
        contract: '3 months',
        experience: 'Less than 1 year',
        notes1: 'Culinary Arts graduate.',
        fname: 'Liza', mname: '', lname: 'Fernandez', suffix: '',
        dob: '1997-08-22', age: '27', civil: 'Single',
        address: '102 P. Burgos St., Batangas City, Batangas, 4200',
        contact: '+639901234567', email: 'liza.fernandez@crew.net',
        emname: 'Mila Fernandez', emnum: '+639011234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)'],
        training: ['Basic Training Certificate', 'Culinary Certificate'],
        uploadedFiles: [
            { name: 'CV_Liza.pdf', size: '430 KB', type: 'pdf' },
        ],
        status: 'pending',
        remarks: '',
        appliedDate: '2025-04-10',
    },
    {
        id: 10,
        position: 'Oiler',
        availDate: '2025-04-20',
        contract: '6 months',
        experience: '1–2 years',
        notes1: '',
        fname: 'Marco', mname: 'V.', lname: 'Villanueva', suffix: '',
        dob: '1994-01-30', age: '31', civil: 'Married',
        address: '77 Aurora Blvd., Cubao, Quezon City, Metro Manila, 1109',
        contact: '+639021234567', email: 'marco.villanueva@maritime.ph',
        emname: 'Josie Villanueva', emnum: '+639131234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'COC – Certificate of Competency (PRC)', 'PRC License'],
        training: ['Basic Training Certificate', 'Engine Watch Keeping', 'Marpol I–VI'],
        uploadedFiles: [
            { name: 'Resume_Marco.pdf', size: '670 KB', type: 'pdf' },
            { name: 'MedCert_expired.jpg', size: '900 KB', type: 'img' },
        ],
        status: 'missing',
        remarks: 'Medical certificate has expired. Please submit updated copy.',
        appliedDate: '2025-04-02',
    },
    {
        id: 11,
        position: 'Third Engineer',
        availDate: '2025-06-01',
        contract: '9 months',
        experience: 'Less than 1 year',
        notes1: '',
        fname: 'Diego', mname: '', lname: 'Torres', suffix: '',
        dob: '1999-03-25', age: '26', civil: 'Single',
        address: '4 Mayon St., Legazpi City, Albay, 4500',
        contact: '+639131234567', email: 'diego.torres@seafarer.com',
        emname: 'Carmen Torres', emnum: '+639241234567',
        nationality: 'Filipino',
        docs: ['Seaman Book (SIRB)', 'PRC License'],
        training: ['Basic Training Certificate', 'PSSR Certificate', 'Engine Watch Keeping'],
        uploadedFiles: [
            { name: 'CV_Diego.pdf', size: '480 KB', type: 'pdf' },
        ],
        status: 'pending',
        remarks: '',
        appliedDate: '2025-04-11',
    },
    {
        id: 12,
        position: 'Chief Officer',
        availDate: '2025-05-01',
        contract: '9 months',
        experience: '6–10 years',
        notes1: 'Tanker and bulk carrier experience.',
        fname: 'Sophia', mname: 'A.', lname: 'Aquino', suffix: '',
        dob: '1986-05-18', age: '38', civil: 'Married',
        address: '8 Coral St., Puerto Princesa, Palawan, 5300',
        contact: '+639241234567', email: 'sophia.aquino@mariners.ph',
        emname: 'Raul Aquino', emnum: '+639351234567',
        nationality: 'Filipino',
        docs: ALL_DOCS,
        training: ALL_TRAINING,
        uploadedFiles: [
            { name: 'Resume_Sophia.pdf', size: '1.4 MB', type: 'pdf' },
            { name: 'SeamanBook.pdf', size: '2.8 MB', type: 'pdf' },
            { name: 'AllCerts.pdf', size: '6.2 MB', type: 'pdf' },
            { name: 'MedicalCert.jpg', size: '1.1 MB', type: 'img' },
        ],
        status: 'approved',
        remarks: 'All docs verified. Awaiting vessel assignment from operations.',
        appliedDate: '2025-03-28',
    },
];

/* ════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════ */
let state = {
    searchQuery: '',
    statusFilter: '',
    positionFilter: '',
    sort: 'newest',
    page: 1,
    filtered: [],
    activeDetailId: null,
    selectedStatus: null,
};

/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function fullName(a) {
    return [a.fname, a.mname, a.lname, a.suffix].filter(Boolean).join(' ');
}
function initials(a) {
    return ((a.fname?.[0]||'') + (a.lname?.[0]||'')).toUpperCase() || '??';
}
function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
}
function relDate(iso) {
    if (!iso) return '';
    const d = (Date.now() - new Date(iso)) / 86400000;
    if (d < 1)   return 'Today';
    if (d < 2)   return 'Yesterday';
    if (d < 7)   return `${Math.floor(d)}d ago`;
    if (d < 30)  return `${Math.floor(d/7)}w ago`;
    if (d < 365) return `${Math.floor(d/30)}mo ago`;
    return `${Math.floor(d/365)}y ago`;
}
function isNewThisWeek(iso) {
    if (!iso) return false;
    return (Date.now() - new Date(iso)) / 86400000 <= 7;
}
function swalCfg() {
    return { customClass:{ popup:'swal-custom-popup', title:'swal-custom-title', htmlContainer:'swal-custom-html' } };
}
function openModal(id)  { $(id).classList.add('active');    }
function closeModal(id) { $(id).classList.remove('active'); }

/* ════════════════════════════════════════════════
   SEARCH — Hybrid
════════════════════════════════════════════════ */
function fuzzyScore(str, q) {
    str = str.toLowerCase(); q = q.toLowerCase();
    if (str === q)           return 100;
    if (str.startsWith(q))  return 80;
    if (str.includes(q))    return 60;
    let si=0, qi=0, sc=0;
    while(si<str.length && qi<q.length){ if(str[si]===q[qi]){sc++;qi++;} si++; }
    return qi===q.length ? sc*10 : 0;
}
function searchList(list, q) {
    if (!q.trim()) return list;
    q = q.trim();
    return list.map(a => {
        const fields = [fullName(a), a.email, a.position, a.contact, a.nationality, a.address];
        const score  = Math.max(...fields.map(f => fuzzyScore(f||'', q)));
        return { a, score };
    }).filter(x=>x.score>0).sort((x,y)=>y.score-x.score).map(x=>x.a);
}

/* ════════════════════════════════════════════════
   FILTER + SORT
════════════════════════════════════════════════ */
function applyFilters() {
    let list = [...applicants];
    list = searchList(list, state.searchQuery);
    if (state.statusFilter)   list = list.filter(a=>a.status===state.statusFilter);
    if (state.positionFilter) list = list.filter(a=>a.position===state.positionFilter);
    switch(state.sort) {
        case 'oldest':  list.sort((a,b)=>a.appliedDate.localeCompare(b.appliedDate)); break;
        case 'name_az': list.sort((a,b)=>fullName(a).localeCompare(fullName(b)));     break;
        case 'name_za': list.sort((a,b)=>fullName(b).localeCompare(fullName(a)));     break;
        default:        list.sort((a,b)=>b.appliedDate.localeCompare(a.appliedDate)); break;
    }
    state.filtered = list;
    state.page = 1;
}

/* ════════════════════════════════════════════════
   STATS
════════════════════════════════════════════════ */
function updateStats() {
    $('statTotal').textContent   = applicants.length;
    $('statNew').textContent     = applicants.filter(a=>isNewThisWeek(a.appliedDate)).length;
    $('statPending').textContent = applicants.filter(a=>a.status==='pending').length;
    $('statReview').textContent  = applicants.filter(a=>a.status==='review').length;
    $('statApproved').textContent= applicants.filter(a=>a.status==='approved').length;
    $('statMissing').textContent = applicants.filter(a=>a.status==='missing').length;
}

/* ════════════════════════════════════════════════
   RENDER TABLE ROW
════════════════════════════════════════════════ */
function renderDocsBar(a) {
    const total = ALL_DOCS.length + ALL_TRAINING.length;
    const count = a.docs.length + a.training.length;
    const pct   = Math.round(count/total*100);
    let cls = pct===100 ? 'complete' : pct<40 ? 'low' : '';
    return `<div class="docs-progress">
        <div class="docs-bar-track"><div class="docs-bar-fill ${cls}" style="width:${pct}%"></div></div>
        <span class="docs-label">${count}/${total}</span>
    </div>`;
}

function renderRow(a, delay) {
    const st   = STATUS_MAP[a.status] || STATUS_MAP.pending;
    const name = fullName(a);
    const init = initials(a);
    return `<tr data-id="${a.id}" style="animation-delay:${delay}ms">
        <td>
            <div class="applicant-name-cell">
                <div class="applicant-avatar">${init}</div>
                <div>
                    <div class="a-name">${esc(name)}</div>
                    <div class="a-email">${esc(a.email||'—')}</div>
                    <div class="a-phone">${esc(a.contact||'')}</div>
                </div>
            </div>
        </td>
        <td><span class="position-badge">${esc(a.position)}</span></td>
        <td><div class="date-cell">${formatDate(a.availDate)}</div></td>
        <td><span class="status-badge ${st.cls}"><span class="s-dot"></span>${st.label}</span></td>
        <td><div class="date-cell">${formatDate(a.appliedDate)}<div class="date-rel">${relDate(a.appliedDate)}</div></div></td>
        <td>${renderDocsBar(a)}</td>
        <td>
            <div class="row-actions">
                <button class="row-btn row-btn-view"   title="View Full Details"   onclick="viewApplicant(${a.id})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2"/><path d="M10 9v5M10 7v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
                <button class="row-btn row-btn-files"  title="View Submitted Files" onclick="viewFiles(${a.id})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 4h8l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.8"/><path d="M12 4v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </button>
                <button class="row-btn row-btn-status" title="Update Status"        onclick="openStatusModal(${a.id})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 2l2 5.5 5.5.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.5-.8z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button class="row-btn row-btn-delete" title="Delete (soft)"        onclick="deleteApplicant(${a.id})">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M7 5V3h6v2M8 9v6M12 9v6M5 5l1 12h8l1-12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </button>
            </div>
        </td>
    </tr>`;
}

/* ════════════════════════════════════════════════
   RENDER TABLE
════════════════════════════════════════════════ */
function renderTable() {
    const total = state.filtered.length;
    const pages = Math.max(1, Math.ceil(total/PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const start = (state.page-1)*PAGE_SIZE;
    const slice = state.filtered.slice(start, start+PAGE_SIZE);

    $('tableLoading').style.display = 'none';

    if (!slice.length) {
        $('applicantsTableBody').innerHTML = '';
        $('tableEmpty').style.display = 'block';
    } else {
        $('tableEmpty').style.display = 'none';
        $('applicantsTableBody').innerHTML = slice.map((a,i)=>renderRow(a,i*35)).join('');
    }

    const from = total ? start+1 : 0;
    const to   = Math.min(start+PAGE_SIZE, total);
    $('paginationInfo').textContent = total ? `Showing ${from}–${to} of ${total} applicant${total!==1?'s':''}` : 'No results';

    renderPagination(pages);
    updateStats();
}

/* ════════════════════════════════════════════════
   PAGINATION
════════════════════════════════════════════════ */
function renderPagination(pages) {
    const cur = state.page;
    const arrow = (dir, p) => `<button class="page-btn" ${p<1||p>pages?'disabled':''} onclick="goPage(${p})">
        <svg width="11" height="11" viewBox="0 0 12 12"><path d="${dir==='l'?'M8 2L4 6L8 10':'M4 2L8 6L4 10'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>`;
    let html = arrow('l', cur-1);
    buildPageRange(cur, pages).forEach(p => {
        html += p==='...'
            ? `<button class="page-btn" disabled>…</button>`
            : `<button class="page-btn ${p===cur?'active':''}" onclick="goPage(${p})">${p}</button>`;
    });
    html += arrow('r', cur+1);
    $('paginationBtns').innerHTML = html;
}
function buildPageRange(cur, pages) {
    if (pages<=7) return Array.from({length:pages},(_,i)=>i+1);
    const r=[1];
    if (cur>3) r.push('...');
    for(let p=Math.max(2,cur-1);p<=Math.min(pages-1,cur+1);p++) r.push(p);
    if (cur<pages-2) r.push('...');
    r.push(pages);
    return r;
}
window.goPage = p => { state.page=p; renderTable(); };

/* ════════════════════════════════════════════════
   REFRESH
════════════════════════════════════════════════ */
function refresh() { applyFilters(); renderTable(); }

/* ════════════════════════════════════════════════
   VIEW APPLICANT DETAIL
════════════════════════════════════════════════ */
window.viewApplicant = function(id) {
    const a = applicants.find(x=>x.id===id);
    if (!a) return;
    state.activeDetailId = id;

    const st   = STATUS_MAP[a.status] || STATUS_MAP.pending;
    const name = fullName(a);
    const init = initials(a);

    // Update header badge
    $('detailModalTitle').textContent = name;
    const badge = $('detailModalBadge');
    badge.textContent   = st.label;
    badge.className     = `modal-badge status-badge ${st.cls}`;

    // Render docs tags
    const docsTagsHtml = ALL_DOCS.map(d => {
        const has = a.docs.includes(d);
        return `<span class="dv-tag ${has?'has':'missing'}">${has?'✓':'✗'} ${esc(d)}</span>`;
    }).join('');

    const trainTagsHtml = ALL_TRAINING.map(t => {
        const has = a.training.includes(t);
        return `<span class="dv-tag ${has?'has':'missing'}">${has?'✓':'✗'} ${esc(t)}</span>`;
    }).join('');

    $('detailModalBody').innerHTML = `
        <!-- Hero -->
        <div class="dv-hero">
            <div class="dv-avatar">${init}</div>
            <div class="dv-hero-info">
                <div class="dv-hero-name">${esc(name)}</div>
                <div class="dv-hero-sub">
                    <span class="status-badge ${st.cls}" style="font-size:10px;padding:2px 8px;"><span class="s-dot"></span>${st.label}</span>
                    &nbsp;${esc(a.position)}
                    &nbsp;&bull;&nbsp;${esc(a.experience||'—')}
                </div>
                <div class="dv-hero-date">Applied: ${formatDate(a.appliedDate)} &nbsp;(${relDate(a.appliedDate)})</div>
            </div>
        </div>

        <!-- STEP 1: Position -->
        <div class="dv-section">
            <div class="dv-section-title">Position &amp; Availability</div>
            <div class="dv-grid">
                <div class="dv-item"><div class="dv-lbl">Position Applied</div><div class="dv-val">${esc(a.position)}</div></div>
                <div class="dv-item"><div class="dv-lbl">Availability Date</div><div class="dv-val">${formatDate(a.availDate)}</div></div>
                <div class="dv-item"><div class="dv-lbl">Contract Duration</div><div class="dv-val ${!a.contract?'na':''}">${esc(a.contract||'Not specified')}</div></div>
                <div class="dv-item"><div class="dv-lbl">Sea Experience</div><div class="dv-val ${!a.experience?'na':''}">${esc(a.experience||'Not specified')}</div></div>
                ${a.notes1 ? `<div class="dv-item full"><div class="dv-lbl">Remarks / Notes</div><div class="dv-val">${esc(a.notes1)}</div></div>` : ''}
            </div>
        </div>

        <!-- STEP 2: Personal -->
        <div class="dv-section">
            <div class="dv-section-title">Personal Information</div>
            <div class="dv-grid">
                <div class="dv-item full"><div class="dv-lbl">Full Name</div><div class="dv-val">${esc(name)}</div></div>
                <div class="dv-item"><div class="dv-lbl">Date of Birth</div><div class="dv-val">${formatDate(a.dob)}</div></div>
                <div class="dv-item"><div class="dv-lbl">Age &nbsp;/&nbsp; Civil Status</div><div class="dv-val">${esc(a.age||'—')} yrs &nbsp;/&nbsp; ${esc(a.civil||'—')}</div></div>
                <div class="dv-item full"><div class="dv-lbl">Complete Address</div><div class="dv-val ${!a.address?'na':''}">${esc(a.address||'Not provided')}</div></div>
                <div class="dv-item"><div class="dv-lbl">Contact Number</div><div class="dv-val ${!a.contact?'na':''}">${esc(a.contact||'Not provided')}</div></div>
                <div class="dv-item"><div class="dv-lbl">Email Address</div><div class="dv-val ${!a.email?'na':''}">${esc(a.email||'Not provided')}</div></div>
                <div class="dv-item"><div class="dv-lbl">Emergency Contact</div><div class="dv-val ${!a.emname?'na':''}">${esc(a.emname||'Not provided')}</div></div>
                <div class="dv-item"><div class="dv-lbl">Emergency Number</div><div class="dv-val ${!a.emnum?'na':''}">${esc(a.emnum||'Not provided')}</div></div>
            </div>
        </div>

        <!-- STEP 3: Documents -->
        <div class="dv-section">
            <div class="dv-section-title">Documents Held (${a.docs.length}/${ALL_DOCS.length})</div>
            <div class="dv-tags">${docsTagsHtml}</div>
        </div>
        <div class="dv-section">
            <div class="dv-section-title">Training Certificates (${a.training.length}/${ALL_TRAINING.length})</div>
            <div class="dv-tags">${trainTagsHtml}</div>
        </div>

        <!-- Uploaded files summary -->
        <div class="dv-section">
            <div class="dv-section-title">Uploaded Files (${a.uploadedFiles.length})</div>
            <div class="dv-grid">
                ${a.uploadedFiles.map(f=>`<div class="dv-item"><div class="dv-lbl">📎 ${esc(f.type.toUpperCase())}</div><div class="dv-val">${esc(f.name)}<br><small style="color:var(--text-light);font-weight:500;">${esc(f.size)}</small></div></div>`).join('')}
            </div>
        </div>

        <!-- Admin -->
        <div class="dv-section">
            <div class="dv-section-title">Admin Remarks</div>
            <div class="dv-remarks ${!a.remarks?'empty':''}">${esc(a.remarks||'No remarks added.')}</div>
        </div>

        <!-- Footer actions -->
        <div class="form-actions" style="margin-top:16px;">
            <button class="btn-cancel" onclick="closeModal('detailModalOverlay')">Close</button>
            <button class="btn-submit" style="background:linear-gradient(135deg,var(--s-review-c),#FB923C);" onclick="closeModal('detailModalOverlay');viewFiles(${a.id})">
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4 4h8l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.8"/><path d="M12 4v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                View Files
            </button>
            <button class="btn-submit" onclick="closeModal('detailModalOverlay');openStatusModal(${a.id})">
                Update Status
            </button>
        </div>
    `;

    // Wire header buttons
    $('downloadPdfBtn').onclick = () => downloadPDF(id);
    $('updateStatusBtn').onclick = () => { closeModal('detailModalOverlay'); openStatusModal(id); };

    openModal('detailModalOverlay');
};

$('detailModalCloseBtn').addEventListener('click', () => closeModal('detailModalOverlay'));
$('detailModalOverlay').addEventListener('click', e => { if(e.target===$('detailModalOverlay')) closeModal('detailModalOverlay'); });

/* ════════════════════════════════════════════════
   VIEW SUBMITTED FILES
════════════════════════════════════════════════ */
const FILE_ICONS = { pdf:'📄', img:'🖼️', doc:'📝', other:'📦' };

window.viewFiles = function(id) {
    const a = applicants.find(x=>x.id===id);
    if (!a) return;
    $('filesModalTitle').textContent = `Files — ${fullName(a)}`;

    if (!a.uploadedFiles.length) {
        $('filesGrid').innerHTML = '<p style="color:var(--text-light);font-size:13px;text-align:center;padding:20px;">No files submitted.</p>';
    } else {
        $('filesGrid').innerHTML = a.uploadedFiles.map(f => `
            <div class="file-card" onclick="alert('In production, this opens: ${esc(f.name)}')">
                <div class="file-icon ${f.type}">${FILE_ICONS[f.type]||'📦'}</div>
                <div class="file-name">${esc(f.name)}</div>
                <div class="file-size">${esc(f.size)}</div>
            </div>
        `).join('');
    }
    openModal('filesModalOverlay');
};

$('filesModalCloseBtn').addEventListener('click', () => closeModal('filesModalOverlay'));
$('filesModalOverlay').addEventListener('click', e => { if(e.target===$('filesModalOverlay')) closeModal('filesModalOverlay'); });

/* ════════════════════════════════════════════════
   STATUS UPDATE MODAL
════════════════════════════════════════════════ */
window.openStatusModal = function(id) {
    const a = applicants.find(x=>x.id===id);
    if (!a) return;
    $('statusApplicantId').value = id;
    $('statusRemarks').value     = a.remarks || '';
    state.selectedStatus         = a.status;

    document.querySelectorAll('.status-opt-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.val === a.status);
    });
    openModal('statusModalOverlay');
};

document.querySelectorAll('.status-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        state.selectedStatus = btn.dataset.val;
        document.querySelectorAll('.status-opt-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

$('statusSaveBtn').addEventListener('click', () => {
    const id = parseInt($('statusApplicantId').value);
    const a  = applicants.find(x=>x.id===id);
    if (!a || !state.selectedStatus) return;
    a.status  = state.selectedStatus;
    a.remarks = $('statusRemarks').value.trim();
    closeModal('statusModalOverlay');
    refresh();
    Swal.fire({ icon:'success', title:'Status Updated', text:`${fullName(a)}'s status has been updated.`, timer:2000, showConfirmButton:false, ...swalCfg() });
});

$('statusModalCloseBtn').addEventListener('click', () => closeModal('statusModalOverlay'));
$('statusCancelBtn').addEventListener('click',     () => closeModal('statusModalOverlay'));
$('statusModalOverlay').addEventListener('click', e => { if(e.target===$('statusModalOverlay')) closeModal('statusModalOverlay'); });

/* ════════════════════════════════════════════════
   DELETE (soft)
════════════════════════════════════════════════ */
window.deleteApplicant = function(id) {
    const a = applicants.find(x=>x.id===id);
    if (!a) return;
    Swal.fire({
        icon:'warning', title:'Delete Applicant?',
        html:`Are you sure you want to remove <strong>${esc(fullName(a))}</strong>? This cannot be undone.`,
        showCancelButton:true, confirmButtonText:'Yes, Delete', confirmButtonColor:'#EF4444', cancelButtonText:'Cancel',
        ...swalCfg()
    }).then(r => {
        if (r.isConfirmed) {
            applicants = applicants.filter(x=>x.id!==id);
            refresh();
            Swal.fire({ icon:'success', title:'Deleted', text:`${fullName(a)} has been removed.`, timer:1800, showConfirmButton:false, ...swalCfg() });
        }
    });
};

/* ════════════════════════════════════════════════
   DOWNLOAD PDF  — full application in document style
════════════════════════════════════════════════ */
window.downloadPDF = function(id) {
    const a = applicants.find(x=>x.id===id);
    if (!a || !window.jspdf) { alert('PDF library not loaded.'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    const W=210, L=15, R=195, lineH=6, blue=[10,36,99], gold=[180,148,46], gray=[107,114,128];

    let y = 0;
    const nl = (n=lineH) => { y+=n; if(y>270){ doc.addPage(); y=20; } };
    const hline = (color=gold) => { doc.setDrawColor(...color); doc.setLineWidth(.4); doc.line(L,y,R,y); nl(3); };
    const text  = (t,x,size=10,style='normal',color=blue) => {
        doc.setFontSize(size); doc.setFont('helvetica',style); doc.setTextColor(...color);
        doc.text(String(t),x,y);
    };
    const labelVal = (lbl,val,xL=L,xV=80) => {
        text(lbl+':',xL,9,'bold',gray);
        text(val||'—',xV,9,'normal',[26,31,54]);
        nl();
    };

    // ── HEADER ──
    y=20;
    doc.setFillColor(...blue); doc.rect(0,0,W,18,'F');
    doc.setFillColor(...gold); doc.rect(0,18,W,1.5,'F');
    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text('GOLDEN GALLEON SHIP MANAGEMENT SERVICES, INC.',W/2,10,{align:'center'});
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Room 312–313, Intramuros Corporate Plaza, Manila  |  +63 (2) 8533-2791',W/2,15,{align:'center'});
    y=25;
    text('SEAFARER APPLICATION FORM',W/2,13,'bold',blue); doc.text('',W/2,y,{align:'center'});
    doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...blue);
    doc.text('SEAFARER APPLICATION FORM',W/2,y,{align:'center'});
    nl(5); hline();

    // Status + Date
    const st = STATUS_MAP[a.status]||STATUS_MAP.pending;
    text(`Application Date: ${formatDate(a.appliedDate)}`,L,9,'normal',gray);
    text(`Status: ${st.label}`,R,9,'normal',gray); doc.text('',R,y,{align:'right'});
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(...gray);
    doc.text(`Status: ${st.label}`,R,y,{align:'right'});
    nl(8);

    // ── SECTION HEADER fn ──
    const secHead = (title) => {
        doc.setFillColor(248,249,252); doc.rect(L,y-4,R-L,7,'F');
        doc.setFillColor(...gold); doc.rect(L,y-4,3,7,'F');
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...blue);
        doc.text(title.toUpperCase(),L+5,y); nl(5);
    };

    // ── STEP 1 ──
    secHead('Position & Availability');
    labelVal('Position Applied',  a.position);
    labelVal('Availability Date', formatDate(a.availDate));
    labelVal('Contract Duration', a.contract||'Not specified');
    labelVal('Sea Experience',    a.experience||'Not specified');
    if(a.notes1){ labelVal('Remarks / Notes', a.notes1); }
    nl(3);

    // ── STEP 2 ──
    secHead('Personal Information');
    labelVal('Full Name',      fullName(a));
    labelVal('Date of Birth',  formatDate(a.dob));
    labelVal('Age',            a.age ? a.age+' years old' : '—');
    labelVal('Civil Status',   a.civil||'—');
    labelVal('Nationality',    a.nationality||'Filipino');
    // wrap address
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...gray);
    doc.text('Address:',L,y);
    doc.setFont('helvetica','normal'); doc.setTextColor(26,31,54);
    const addrLines = doc.splitTextToSize(a.address||'—', R-80);
    addrLines.forEach(line=>{ doc.text(line,80,y); nl(); });
    labelVal('Contact Number', a.contact||'—');
    labelVal('Email Address',  a.email||'—');
    labelVal('Emergency Contact', a.emname||'—');
    labelVal('Emergency Number',  a.emnum||'—');
    nl(3);

    // ── STEP 3a: Documents ──
    secHead(`Documents Held (${a.docs.length}/${ALL_DOCS.length})`);
    ALL_DOCS.forEach(d => {
        const has = a.docs.includes(d);
        doc.setFontSize(9); doc.setFont('helvetica','normal');
        doc.setTextColor(has ? 5:220, has?150:38, has?130:38);
        doc.text(`${has?'✓':'✗'}  ${d}`, L+4, y); nl();
    });
    nl(3);

    // ── STEP 3b: Training ──
    secHead(`Training Certificates (${a.training.length}/${ALL_TRAINING.length})`);
    // 2 columns
    const trnLeft  = ALL_TRAINING.slice(0,8);
    const trnRight = ALL_TRAINING.slice(8);
    const trnStart = y;
    trnLeft.forEach(t => {
        const has = a.training.includes(t);
        doc.setFontSize(9); doc.setFont('helvetica','normal');
        doc.setTextColor(has?5:220, has?150:38, has?130:38);
        doc.text(`${has?'✓':'✗'}  ${t}`, L+4, y); nl();
    });
    const afterLeft = y;
    y = trnStart;
    trnRight.forEach(t => {
        const has = a.training.includes(t);
        doc.setFontSize(9); doc.setFont('helvetica','normal');
        doc.setTextColor(has?5:220, has?150:38, has?130:38);
        doc.text(`${has?'✓':'✗'}  ${t}`, L+100, y); nl();
    });
    y = Math.max(y, afterLeft); nl(3);

    // ── STEP 3c: Uploaded files ──
    secHead(`Submitted Files (${a.uploadedFiles.length})`);
    a.uploadedFiles.forEach(f => {
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(...[26,31,54]);
        doc.text(`•  ${f.name}  (${f.size})`, L+4, y); nl();
    });
    nl(3);

    // ── ADMIN ──
    secHead('Admin Remarks');
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(26,31,54);
    const rem = doc.splitTextToSize(a.remarks||'No remarks.', R-L-8);
    rem.forEach(line=>{ doc.text(line,L+4,y); nl(); });
    nl(5);

    // ── FOOTER ──
    hline();
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...gray);
    doc.text('© Golden Galleon Ship Management Services, Inc. — Intramuros, Manila', W/2, y, {align:'center'}); nl();
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, W/2, y, {align:'center'});

    doc.save(`Application_${a.lname}_${a.fname}_${a.appliedDate}.pdf`);
};

/* ════════════════════════════════════════════════
   SEARCH + FILTER EVENTS
════════════════════════════════════════════════ */
const searchInput = $('seafarerSearchInput');
const clearBtn    = $('clearSearchBtn');
let searchDebounce;

searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    clearBtn.classList.toggle('visible', !!state.searchQuery);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(refresh, 300);
});
clearBtn.addEventListener('click', () => {
    searchInput.value=''; state.searchQuery='';
    clearBtn.classList.remove('visible');
    refresh(); searchInput.focus();
});
$('statusFilter').addEventListener('change',   e => { state.statusFilter=e.target.value;   refresh(); });
$('positionFilter').addEventListener('change', e => { state.positionFilter=e.target.value; refresh(); });
$('sortFilter').addEventListener('change',     e => { state.sort=e.target.value;           refresh(); });

/* ════════════════════════════════════════════════
   WINDOW CONTROLS (Electron stubs)
════════════════════════════════════════════════ */
document.getElementById('minimizeBtn')?.addEventListener('click', () => window.electronAPI?.minimize?.());
document.getElementById('maximizeBtn')?.addEventListener('click', () => window.electronAPI?.maximize?.());
document.getElementById('closeBtn')?.addEventListener('click',    () => window.electronAPI?.close?.());

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
refresh();