/**
 * admin-ships-import.js
 * ──────────────────────────────────────────────────────────────
 * Excel Import functionality for Certificates & Crew
 * • In-memory processing only — no file is ever stored/written
 * • Uses SheetJS (XLSX) via npm require (not CDN)
 * • Communicates with PostgreSQL via ipcRenderer ('db-query')
 * ──────────────────────────────────────────────────────────────
 */

(function () {
    'use strict';

    // ── SheetJS ───────────────────────────────────────────────
    const XLSX = require('xlsx');

    // ── Electron IPC ──────────────────────────────────────────
    const { ipcRenderer } = require('electron');

    async function dbQuery(sql, params = []) {
        return await ipcRenderer.invoke('db-query', { sql, params });
    }

    // ── Column Definitions ────────────────────────────────────
    const COLUMN_MAPS = {
        certificates: [
            { excel: 'cert_name',     db: 'cert_name',     required: true,  label: 'cert_name' },
            { excel: 'cert_no',       db: 'cert_no',       required: false, label: 'cert_no' },
            { excel: 'status',        db: 'status',        required: false, label: 'status' },
            { excel: 'remarks',       db: 'remarks',       required: false, label: 'remarks' },
            { excel: 'expiry_date',   db: 'expiry_date',   required: false, label: 'expiry_date' },
            { excel: 'date_of_issue', db: 'date_of_issue', required: false, label: 'date_of_issue' },
            { excel: 'issuer_agency', db: 'issuer_agency', required: false, label: 'issuer_agency' },
        ],
        crew: [
            { excel: 'full_name',     db: 'full_name',     required: true,  label: 'full_name' },
            { excel: 'crew_id',       db: 'crew_id',       required: false, label: 'crew_id' },
            { excel: 'rank_position', db: 'rank_position', required: false, label: 'rank_position' },
            { excel: 'status',        db: 'status',        required: false, label: 'status' },
            { excel: 'contact_info',  db: 'contact_info',  required: false, label: 'contact_info' },
            { excel: 'date_joined',   db: 'date_joined',   required: false, label: 'date_joined' },
        ],
    };

    // ── State ─────────────────────────────────────────────────
    let importState = {
        importType: 'certificates',
        parsedRows: [],
        mappedRows: [],
        selectedCompany: null,
        selectedShip: null,
        allCompanies: [],
        allShips: [],
    };

    // ── SweetAlert2 Theme ─────────────────────────────────────
    const swalTheme = {
        customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title',
            confirmButton: 'swal-confirm-btn',
            cancelButton: 'swal-cancel-btn',
        },
        buttonsStyling: false,
    };

    const CONFIRM_BTN_HTML = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M15 5L7 13L3 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Confirm Import`;

    // ══════════════════════════════════════════════════════════
    // DOM REFS
    // ══════════════════════════════════════════════════════════
    const overlay     = document.getElementById('importModalOverlay');
    const closeBtn    = document.getElementById('importModalCloseBtn');

    const stepDots    = [1, 2, 3].map(n => document.getElementById(`stepDot${n}`));
    const panels      = [1, 2, 3].map(n => document.getElementById(`importStep${n}`));

    // Step 1
    const typeCertBtn     = document.getElementById('typeCertBtn');
    const typeCrewBtn     = document.getElementById('typeCrewBtn');
    const hintColsList    = document.getElementById('hintColsList');
    const dropZone        = document.getElementById('importDropZone');
    const fileInput       = document.getElementById('importFileInput');
    const dropBrowseBtn   = document.getElementById('dropBrowseBtn');
    const fileStrip       = document.getElementById('importFileStrip');
    const fileStripName   = document.getElementById('fileStripName');
    const fileStripMeta   = document.getElementById('fileStripMeta');
    const fileStripRemove = document.getElementById('fileStripRemove');
    const nextStep1Btn    = document.getElementById('importNextStep1');
    const cancelStep1Btn  = document.getElementById('importCancelStep1');

    // Step 2
    const companySearchInput   = document.getElementById('importCompanySearch');
    const companyList          = document.getElementById('importCompanyList');
    const shipSection          = document.getElementById('importShipSection');
    const selectedCompanyBadge = document.getElementById('selectedCompanyBadge');
    const shipSearchInput      = document.getElementById('importShipSearch');
    const shipList             = document.getElementById('importShipList');
    const backStep2Btn         = document.getElementById('importBackStep2');
    const nextStep2Btn         = document.getElementById('importNextStep2');

    // Step 3
    const previewSubtitle = document.getElementById('importPreviewSubtitle');
    const summaryRow      = document.getElementById('importSummaryRow');
    const previewRowCount = document.getElementById('previewRowCount');
    const previewWarning  = document.getElementById('previewWarning');
    const previewHead     = document.getElementById('importPreviewHead');
    const previewBody     = document.getElementById('importPreviewBody');
    const backStep3Btn    = document.getElementById('importBackStep3');
    const cancelStep3Btn  = document.getElementById('importCancelStep3');
    const confirmBtn      = document.getElementById('importConfirmBtn');

    document.getElementById('importExcelBtn').addEventListener('click', openImportModal);

    // ══════════════════════════════════════════════════════════
    // MODAL OPEN / CLOSE / STEP NAV
    // ══════════════════════════════════════════════════════════
    function openImportModal() {
        resetImportState();
        goToStep(1);
        overlay.classList.add('active');
        loadAllCompanies();
    }

    function closeImportModal() {
        overlay.classList.remove('active');
        resetImportState();
    }

    function resetImportState() {
        importState.parsedRows      = [];
        importState.mappedRows      = [];
        importState.selectedCompany = null;
        importState.selectedShip    = null;
        importState.allShips        = [];

        fileInput.value = '';
        fileStrip.classList.add('hidden');
        dropZone.style.display = '';
        nextStep1Btn.disabled = true;

        setImportType('certificates');

        companySearchInput.value = '';
        shipSection.classList.add('hidden');
        nextStep2Btn.disabled = true;
        renderCompanyList('');

        summaryRow.innerHTML        = '';
        previewHead.innerHTML       = '';
        previewBody.innerHTML       = '';
        previewRowCount.textContent = '0 rows';
        previewWarning.classList.add('hidden');

        confirmBtn.disabled  = false;
        confirmBtn.innerHTML = CONFIRM_BTN_HTML;
    }

    function goToStep(n) {
        panels.forEach((p, i) => p.classList.toggle('active', i === n - 1));
        stepDots.forEach((d, i) => {
            d.classList.remove('active', 'done');
            if (i < n - 1) d.classList.add('done');
            if (i === n - 1) d.classList.add('active');
        });
    }

    closeBtn.addEventListener('click', closeImportModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeImportModal(); });

    cancelStep1Btn.addEventListener('click', closeImportModal);
    cancelStep3Btn.addEventListener('click', closeImportModal);
    backStep2Btn.addEventListener('click', () => goToStep(1));
    backStep3Btn.addEventListener('click', () => goToStep(2));
    nextStep1Btn.addEventListener('click', () => goToStep(2));

    nextStep2Btn.addEventListener('click', () => {
        if (!importState.selectedShip) return;
        buildPreview();
        goToStep(3);
    });

    // ══════════════════════════════════════════════════════════
    // STEP 1 — Type Toggle & Column Hints
    // ══════════════════════════════════════════════════════════
    typeCertBtn.addEventListener('click', () => setImportType('certificates'));
    typeCrewBtn.addEventListener('click', () => setImportType('crew'));

    function setImportType(type) {
        importState.importType = type;
        typeCertBtn.classList.toggle('active', type === 'certificates');
        typeCrewBtn.classList.toggle('active', type === 'crew');
        renderColumnHint(type);
        if (importState.parsedRows.length) mapRows();
    }

    function renderColumnHint(type) {
        const cols = COLUMN_MAPS[type];
        hintColsList.innerHTML = cols.map(c =>
            `<span class="hint-col-tag${c.required ? ' required' : ''}">${c.label}${c.required ? ' *' : ''}</span>`
        ).join('');
    }

    renderColumnHint('certificates');

    // ══════════════════════════════════════════════════════════
    // STEP 1 — File Handling
    // ══════════════════════════════════════════════════════════
    dropBrowseBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', e => {
        if (e.target === dropBrowseBtn) return;
        fileInput.click();
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) processFile(fileInput.files[0]);
    });

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const f = e.dataTransfer.files[0];
        if (f) processFile(f);
    });

    fileStripRemove.addEventListener('click', () => {
        fileInput.value        = '';
        importState.parsedRows = [];
        importState.mappedRows = [];
        fileStrip.classList.add('hidden');
        dropZone.style.display = '';
        nextStep1Btn.disabled  = true;
    });

    function processFile(file) {
        const allowed = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
        ];
        const extOk = /\.(xlsx|xls)$/i.test(file.name);
        if (!allowed.includes(file.type) && !extOk) {
            Swal.fire({ ...swalTheme, title: 'Invalid File', text: 'Please select an Excel file (.xlsx or .xls).', icon: 'error', confirmButtonText: 'OK' });
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data      = new Uint8Array(e.target.result);
                const workbook  = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const ws        = workbook.Sheets[sheetName];
                const rows      = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

                importState.parsedRows = rows;
                mapRows();

                const sizeKb = (file.size / 1024).toFixed(1);
                fileStripName.textContent = file.name;
                fileStripMeta.textContent = `${rows.length} rows · ${sizeKb} KB · Sheet: "${sheetName}"`;
                fileStrip.classList.remove('hidden');
                dropZone.style.display = 'none';
                nextStep1Btn.disabled  = rows.length === 0;
            } catch (err) {
                Swal.fire({ ...swalTheme, title: 'Parse Error', text: 'Could not read the Excel file. ' + err.message, icon: 'error', confirmButtonText: 'OK' });
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function mapRows() {
        const cols = COLUMN_MAPS[importState.importType];
        importState.mappedRows = importState.parsedRows.map(row => {
            const mapped  = {};
            const normRow = {};
            Object.keys(row).forEach(k => { normRow[k.trim().toLowerCase()] = row[k]; });
            cols.forEach(col => {
                const val = normRow[col.excel.toLowerCase()];
                mapped[col.db] = val !== undefined ? String(val).trim() : '';
            });
            return mapped;
        }).filter(row => {
            const reqCol = cols.find(c => c.required);
            return reqCol ? row[reqCol.db] !== '' : true;
        });
    }

    // ══════════════════════════════════════════════════════════
    // STEP 2 — Company & Ship Selection
    // ══════════════════════════════════════════════════════════
    async function loadAllCompanies() {
        try {
            const res = await dbQuery('SELECT id, company_name, company_code FROM companies ORDER BY company_name ASC');
            importState.allCompanies = res.rows || [];
        } catch (e) {
            importState.allCompanies = [];
        }
        renderCompanyList(companySearchInput.value);
    }

    companySearchInput.addEventListener('input', () => renderCompanyList(companySearchInput.value));

    function renderCompanyList(query) {
        const q = query.toLowerCase().trim();
        const filtered = q
            ? importState.allCompanies.filter(c =>
                c.company_name.toLowerCase().includes(q) ||
                (c.company_code || '').toLowerCase().includes(q))
            : importState.allCompanies;

        companyList.innerHTML = '';
        if (!filtered.length) {
            companyList.innerHTML = `<div class="target-list-empty">${q ? 'No companies match your search.' : 'Loading companies…'}</div>`;
            return;
        }
        filtered.forEach(c => {
            const item = document.createElement('div');
            item.className = 'target-list-item' + (importState.selectedCompany?.id === c.id ? ' selected' : '');
            item.innerHTML = `
                <div class="target-item-icon">
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M2 17H16M4 17V7a2 2 0 012-2h6a2 2 0 012 2v10M7 13v4M11 13v4M7 8h.01M11 8h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </div>
                <div class="target-item-info">
                    <div class="target-item-name">${escHtml(c.company_name)}</div>
                    <div class="target-item-sub">${c.company_code ? 'Code: ' + escHtml(c.company_code) : 'No code'}</div>
                </div>
                <div class="target-item-check">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>`;
            item.addEventListener('click', () => selectCompany(c));
            companyList.appendChild(item);
        });
    }

    async function selectCompany(company) {
        importState.selectedCompany = company;
        importState.selectedShip    = null;
        nextStep2Btn.disabled       = true;
        renderCompanyList(companySearchInput.value);

        selectedCompanyBadge.textContent = company.company_name;
        shipSection.classList.remove('hidden');
        shipSearchInput.value = '';
        shipList.innerHTML = '<div class="target-list-empty">Loading ships…</div>';

        try {
            const res = await dbQuery(
                'SELECT id, ship_name, region, vessel_type FROM ships WHERE company_id=$1 ORDER BY ship_name ASC',
                [company.id]
            );
            importState.allShips = res.rows || [];
        } catch (e) {
            importState.allShips = [];
        }
        renderShipList('');
    }

    shipSearchInput.addEventListener('input', () => renderShipList(shipSearchInput.value));

    function renderShipList(query) {
        const q = query.toLowerCase().trim();
        const filtered = q
            ? importState.allShips.filter(s =>
                s.ship_name.toLowerCase().includes(q) ||
                (s.region || '').toLowerCase().includes(q) ||
                (s.vessel_type || '').toLowerCase().includes(q))
            : importState.allShips;

        shipList.innerHTML = '';
        if (!filtered.length) {
            shipList.innerHTML = `<div class="target-list-empty">${importState.allShips.length === 0 ? 'No ships in this company.' : 'No ships match your search.'}</div>`;
            return;
        }
        filtered.forEach(s => {
            const item = document.createElement('div');
            item.className = 'target-list-item' + (importState.selectedShip?.id === s.id ? ' selected' : '');
            item.innerHTML = `
                <div class="target-item-icon">
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M3 13L9 9L15 13L14 17H4L3 13Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 9L9 7L12 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 7V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </div>
                <div class="target-item-info">
                    <div class="target-item-name">${escHtml(s.ship_name)}</div>
                    <div class="target-item-sub">${escHtml(s.region || 'No region')}${s.vessel_type ? ' · ' + escHtml(s.vessel_type) : ''}</div>
                </div>
                <div class="target-item-check">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>`;
            item.addEventListener('click', () => selectShipTarget(s));
            shipList.appendChild(item);
        });
    }

    function selectShipTarget(ship) {
        importState.selectedShip = ship;
        nextStep2Btn.disabled    = false;
        renderShipList(shipSearchInput.value);
    }

    // ══════════════════════════════════════════════════════════
    // STEP 3 — Preview Builder
    // ══════════════════════════════════════════════════════════
    function buildPreview() {
        const type = importState.importType;
        const ship = importState.selectedShip;
        const comp = importState.selectedCompany;
        const rows = importState.mappedRows;
        const cols = COLUMN_MAPS[type];

        previewSubtitle.innerHTML = `Importing <strong>${rows.length}</strong> ${type} record${rows.length !== 1 ? 's' : ''} into <strong>${escHtml(ship.ship_name)}</strong> (${escHtml(comp.company_name)}).`;

        summaryRow.innerHTML = `
            <div class="import-summary-card">
                <div class="sc-label">Company</div>
                <div class="sc-value">${escHtml(comp.company_name)}</div>
            </div>
            <div class="import-summary-card">
                <div class="sc-label">Ship</div>
                <div class="sc-value">${escHtml(ship.ship_name)}</div>
            </div>
            <div class="import-summary-card">
                <div class="sc-label">Type</div>
                <div class="sc-value">${type === 'certificates' ? '📋 Certificates' : '👤 Crew'}</div>
            </div>
            <div class="import-summary-card green">
                <div class="sc-label">Rows to Import</div>
                <div class="sc-value">${rows.length}</div>
            </div>`;

        previewRowCount.textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''}`;

        if (rows.length > 500) {
            previewWarning.textContent = `⚠ Large import (${rows.length} rows) — this may take a moment.`;
            previewWarning.classList.remove('hidden');
        } else {
            previewWarning.classList.add('hidden');
        }

        previewHead.innerHTML = `<tr>${cols.map(c =>
            `<th>${escHtml(c.label)}${c.required ? ' <span style="color:#D4AF37">*</span>' : ''}</th>`
        ).join('')}</tr>`;

        const previewSlice = rows.slice(0, 100);
        previewBody.innerHTML = previewSlice.map(row =>
            `<tr>${cols.map(c => {
                const val = row[c.db];
                if (!val) return `<td class="td-empty">—</td>`;
                if (c.required) return `<td class="td-valid">${escHtml(val)}</td>`;
                return `<td>${escHtml(val)}</td>`;
            }).join('')}</tr>`
        ).join('');

        if (rows.length > 100) {
            const remaining = rows.length - 100;
            previewBody.innerHTML += `<tr><td colspan="${cols.length}" style="text-align:center;padding:12px;color:#9CA3AF;font-style:italic;font-size:12px">… and ${remaining} more row${remaining !== 1 ? 's' : ''} (not shown)</td></tr>`;
        }

        if (rows.length === 0) {
            previewBody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;padding:20px;color:#9CA3AF">No valid rows found in this file for the selected type.</td></tr>`;
            confirmBtn.disabled = true;
        } else {
            confirmBtn.disabled  = false;
            confirmBtn.innerHTML = CONFIRM_BTN_HTML;
        }
    }

    // ══════════════════════════════════════════════════════════
    // STEP 3 — Confirm & Insert
    // ── FIX: close the import modal FIRST, then show the
    //         SweetAlert confirmation so it isn't hidden behind
    //         the overlay. If user cancels, reopen the modal.
    // ══════════════════════════════════════════════════════════
    confirmBtn.addEventListener('click', async () => {
        const type = importState.importType;
        const ship = importState.selectedShip;
        const rows = importState.mappedRows;

        if (!rows.length || !ship) return;

        // Snapshot what we need before closing the modal
        const rowsSnapshot = [...rows];
        const shipSnapshot = { ...ship };
        const compSnapshot = { ...importState.selectedCompany };

        // ── 1. Close the import modal so Swal is visible ──────
        overlay.classList.remove('active');

        // ── 2. Show SweetAlert confirmation ───────────────────
        const confirmResult = await Swal.fire({
            ...swalTheme,
            title: `Import ${rowsSnapshot.length} ${type === 'certificates' ? 'Certificate' : 'Crew'} Record${rowsSnapshot.length !== 1 ? 's' : ''}?`,
            html: `<span>This will insert <strong style="color:#0A2463">${rowsSnapshot.length}</strong> records into <strong style="color:#0A2463">${escHtml(shipSnapshot.ship_name)}</strong>.<br>This action cannot be undone.</span>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Import',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
            focusCancel: true,
        });

        // ── 3a. User cancelled — reopen modal at step 3 ───────
        if (!confirmResult.isConfirmed) {
            overlay.classList.add('active');
            return;
        }

        // ── 3b. User confirmed — run the import ───────────────
        try {
            if (type === 'certificates') {
                await importCertificates(rowsSnapshot, shipSnapshot.id);
            } else {
                await importCrew(rowsSnapshot, shipSnapshot.id);
            }

            // Full reset now that import succeeded
            resetImportState();

            await Swal.fire({
                ...swalTheme,
                title: 'Import Successful!',
                html: `<span><strong style="color:#0A2463">${rowsSnapshot.length}</strong> ${type} record${rowsSnapshot.length !== 1 ? 's' : ''} imported into <strong style="color:#0A2463">${escHtml(shipSnapshot.ship_name)}</strong>.</span>`,
                icon: 'success',
                confirmButtonText: 'OK',
                timer: 3000,
                timerProgressBar: true,
            });

        } catch (err) {
            // Reopen the modal so user can retry
            overlay.classList.add('active');
            confirmBtn.disabled  = false;
            confirmBtn.innerHTML = CONFIRM_BTN_HTML;

            await Swal.fire({
                ...swalTheme,
                title: 'Import Failed',
                text: err.message || 'An unexpected error occurred.',
                icon: 'error',
                confirmButtonText: 'OK',
            });
        }
    });

    // ══════════════════════════════════════════════════════════
    // DB INSERTIONS — single multi-row INSERT per chunk
    // Fixes missing rows caused by per-row IPC round-trips
    // dropping under connection pool pressure.
    // ══════════════════════════════════════════════════════════
    function buildMultiInsert(rows, colsPerRow, rowMapper) {
        const params  = [];
        const clauses = rows.map((row, ri) => {
            const vals = rowMapper(row);
            vals.forEach(v => params.push(v));
            const placeholders = vals.map((_, ci) => `$${ri * colsPerRow + ci + 1}`).join(',');
            return `(${placeholders})`;
        });
        return { valueClause: clauses.join(','), params };
    }

    async function importCertificates(rows, shipId) {
        const CHUNK = 100;
        for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const { valueClause, params } = buildMultiInsert(chunk, 8, row => [
                shipId,
                row.cert_name                || null,
                row.cert_no                  || null,
                row.status                   || null,
                row.remarks                  || null,
                parseDate(row.expiry_date)   || null,
                parseDate(row.date_of_issue) || null,
                row.issuer_agency            || null,
            ]);
            await dbQuery(
                `INSERT INTO certificates
                    (ship_id, cert_name, cert_no, status, remarks,
                     expiry_date, date_of_issue, issuer_agency)
                 VALUES ${valueClause}`,
                params
            );
        }
    }

    async function importCrew(rows, shipId) {
        const CHUNK = 100;
        for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const { valueClause, params } = buildMultiInsert(chunk, 7, row => [
                shipId,
                row.full_name                || null,
                row.crew_id                  || null,
                row.rank_position            || null,
                row.status                   || null,
                row.contact_info             || null,
                parseDate(row.date_joined)   || null,
            ]);
            await dbQuery(
                `INSERT INTO crew
                    (ship_id, full_name, crew_id, rank_position,
                     status, contact_info, date_joined)
                 VALUES ${valueClause}`,
                params
            );
        }
    }

    // ── Utility ───────────────────────────────────────────────
    function escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function parseDate(val) {
        if (!val) return null;
        const s = String(val).trim();
        if (!s) return null;

        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const d = new Date(s);
            return isNaN(d) ? null : d.toISOString().slice(0, 10);
        }

        const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (slash) {
            const [, a, b, y] = slash;
            const year = y.length === 2 ? '20' + y : y;
            const d1 = new Date(`${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`);
            if (!isNaN(d1)) return d1.toISOString().slice(0, 10);
        }

        const d = new Date(s);
        if (!isNaN(d)) return d.toISOString().slice(0, 10);

        return null;
    }

    // Spinner CSS
    (function injectSpinnerStyle() {
        if (document.getElementById('import-spinner-style')) return;
        const style = document.createElement('style');
        style.id = 'import-spinner-style';
        style.textContent = `
            @keyframes importSpin { to { transform: rotate(360deg); } }
            .spin-icon { animation: importSpin 0.8s linear infinite; }
        `;
        document.head.appendChild(style);
    })();

})();