/**
 * ship-detail-delete-all.js
 * Handles "Delete All" functionality for Certificates and Crew tabs.
 * Uses the same db-query IPC channel as the rest of the app (main.js pool).
 *
 * Schema (from Supabase screenshot):
 *   ships        : id (int4), ship_name, imo_number, vessel_type, flag, company_id, region
 *   companies    : id (int4), company_name
 *   certificates : id (int4), ship_id (int4), cert_name, cert_no, status, ...
 *   crew         : id (int4), ship_id (int4), full_name, rank_position, status, ...
 *
 * Must be loaded AFTER ship-detail.js.
 */

(function () {
  'use strict';

  const { ipcRenderer } = require('electron');

  // ─── DB Helper ──────────────────────────────────────────────────────────────
  async function dbQuery(sql, params = []) {
    return ipcRenderer.invoke('db-query', { sql, params });
  }

  // ─── Resolve Ship ID ────────────────────────────────────────────────────────
  /**
   * Synchronous: checks every place ship-detail.js might have stored the ID.
   */
  function getShipIdSync() {
    // 1. Global window variables (ship-detail.js commonly sets these)
    const windowKeys = [
      'currentShipId', 'shipId', 'SHIP_ID', 'selectedShipId',
      'ship_id', 'shipID', 'currentShip',
    ];
    for (const k of windowKeys) {
      const v = window[k];
      if (v !== undefined && v !== null && v !== '') {
        // If it's an object (e.g. ship record), grab .id
        if (typeof v === 'object') return v.id || v.ship_id || null;
        return v;
      }
    }

    // 2. URL search params
    try {
      const p = new URLSearchParams(window.location.search);
      for (const k of ['shipId', 'ship_id', 'id', 'shipID']) {
        const v = p.get(k);
        if (v) return v;
      }
    } catch (_) {}

    // 3. sessionStorage
    try {
      const ssKeys = [
        'currentShipId', 'shipId', 'ship_id', 'selectedShipId', 'SHIP_ID',
      ];
      for (const k of ssKeys) {
        const raw = sessionStorage.getItem(k);
        if (raw) {
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object') {
              return obj.id || obj.ship_id || obj.shipId || null;
            }
          } catch (_) {}
          return raw;
        }
      }
    } catch (_) {}

    // 4. localStorage
    try {
      const lsKeys = [
        'currentShipId', 'shipId', 'ship_id', 'selectedShipId', 'SHIP_ID',
      ];
      for (const k of lsKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object') {
              return obj.id || obj.ship_id || obj.shipId || null;
            }
          } catch (_) {}
          return raw;
        }
      }
    } catch (_) {}

    // 5. DOM data attributes / hidden inputs
    try {
      const selectors = [
        '#shipId', '#ship_id', '#currentShipId',
        '[data-ship-id]', '[data-id]',
        'input[name="shipId"]', 'input[name="ship_id"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const v = el.value
          || el.dataset.shipId
          || el.dataset.id
          || el.getAttribute('data-ship-id')
          || el.getAttribute('data-id');
        if (v) return v;
      }
    } catch (_) {}

    return null;
  }

  /**
   * Async: falls back to the Electron session file written by main.js
   * (session-set / session-get handlers).
   */
  async function resolveShipId() {
    const sync = getShipIdSync();
    if (sync !== null && sync !== undefined && String(sync).trim() !== '') {
      return sync;
    }

    // Electron persistent session
    try {
      const session = await ipcRenderer.invoke('session-get');
      if (session && typeof session === 'object') {
        const v =
          session.currentShipId  ||
          session.shipId         ||
          session.ship_id        ||
          session.selectedShipId ||
          (session.ship  && (session.ship.id  || session.ship.ship_id))  ||
          (session.currentShip && (session.currentShip.id || session.currentShip.ship_id)) ||
          null;
        if (v) return v;
      }
    } catch (_) {}

    return null;
  }

  // ─── Fetch ship + company info from DB ─────────────────────────────────────
  async function fetchShipInfo(shipId) {
    try {
      const res = await dbQuery(
        `SELECT s.ship_name,
                s.imo_number,
                s.vessel_type,
                s.flag,
                s.region,
                c.company_name
         FROM ships s
         LEFT JOIN companies c ON c.id = s.company_id
         WHERE s.id = $1
         LIMIT 1`,
        [shipId]
      );
      if (res.rows && res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn('[DeleteAll] fetchShipInfo error:', err.message);
    }
    return null;
  }

  /** Count records in the target table for this ship. */
  async function countRows(table, shipId) {
    try {
      const res = await dbQuery(
        `SELECT COUNT(*) AS cnt FROM ${table} WHERE ship_id = $1`,
        [shipId]
      );
      if (res.rows && res.rows.length > 0) return parseInt(res.rows[0].cnt, 10);
    } catch (_) {}
    return 0;
  }

  // ─── Build ship info card HTML for dialog ──────────────────────────────────
  function buildShipCard(info, shipId) {
    const name    = info ? (info.ship_name    || `Ship #${shipId}`) : `Ship #${shipId}`;
    const company = info ? (info.company_name || '—')               : '—';
    const imo     = info ? (info.imo_number   || '—')               : '—';
    const type    = info ? (info.vessel_type  || '—')               : '—';
    const flag    = info ? (info.flag         || '—')               : '—';

    return {
      name,
      company,
      html: `
        <div style="
          background:#F8F9FC;
          border:1.5px solid #E5E7EB;
          border-radius:10px;
          padding:12px 16px;
          margin-bottom:14px;
          text-align:left;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.6px;">Ship</span>
            <span style="font-size:13px;font-weight:800;color:#0A2463;">${name}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.6px;">Company</span>
            <span style="font-size:13px;font-weight:600;color:#374151;">${company}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.6px;">IMO No.</span>
            <span style="font-size:13px;font-weight:600;color:#374151;">${imo}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.6px;">Type</span>
            <span style="font-size:13px;font-weight:600;color:#374151;">${type}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.6px;">Flag</span>
            <span style="font-size:13px;font-weight:600;color:#374151;">${flag}</span>
          </div>
        </div>
      `,
    };
  }

  // ─── No-ship error ──────────────────────────────────────────────────────────
  function showNoShipError() {
    Swal.fire({
      icon: 'error',
      title: 'Ship Not Found',
      html: `
        <div style="font-size:13px;color:#374151;line-height:1.7;">
          Could not determine which ship is currently open.<br>
          Please go back and re-open the ship detail page, then try again.
        </div>
      `,
      confirmButtonColor: '#0A2463',
    });
  }

  // ─── Refresh helpers ────────────────────────────────────────────────────────
  function refreshCertificates() {
    if (typeof window.loadCertificates     === 'function') return window.loadCertificates();
    if (typeof window.loadShipCertificates === 'function') return window.loadShipCertificates();
    if (typeof window.refreshShipDetail    === 'function') return window.refreshShipDetail();
    window.location.reload();
  }

  function refreshCrew() {
    if (typeof window.loadCrew          === 'function') return window.loadCrew();
    if (typeof window.loadShipCrew      === 'function') return window.loadShipCrew();
    if (typeof window.refreshShipDetail === 'function') return window.refreshShipDetail();
    window.location.reload();
  }

  // ─── Delete All Certificates ────────────────────────────────────────────────
  async function handleDeleteAllCertificates() {
    const shipId = await resolveShipId();
    if (!shipId) { showNoShipError(); return; }

    // Show loading briefly while we fetch info
    Swal.fire({
      title: 'Loading ship info...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    const [info, count] = await Promise.all([
      fetchShipInfo(shipId),
      countRows('certificates', shipId),
    ]);

    Swal.close();

    const { name, company, html: cardHtml } = buildShipCard(info, shipId);

    if (count === 0) {
      return Swal.fire({
        icon: 'info',
        title: 'No Certificates',
        html: `${cardHtml}<div style="font-size:13px;color:#374151;">There are no certificates to delete for <strong>${name}</strong>.</div>`,
        confirmButtonColor: '#0A2463',
      });
    }

    // Step 1 – first warning
    const step1 = await Swal.fire({
      icon: 'warning',
      title: 'Delete All Certificates?',
      html: `
        ${cardHtml}
        <div style="font-size:14px;color:#374151;line-height:1.7;">
          You are about to permanently delete
          <strong style="color:#DC2626;">${count} certificate${count !== 1 ? 's' : ''}</strong>
          for this ship.<br>
          <span style="color:#DC2626;font-weight:600;">This action cannot be undone.</span>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Yes, proceed',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#C0392B',
      cancelButtonColor: '#6B7280',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!step1.isConfirmed) return;

    // Step 2 – type DELETE ALL
    const step2 = await Swal.fire({
      icon: 'error',
      title: 'Final Confirmation',
      html: `
        <div style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:12px;">
          Permanently deleting <strong style="color:#DC2626;">${count} certificate${count !== 1 ? 's' : ''}</strong>
          from <strong>${name}</strong> (${company}).<br>
          Type <strong style="color:#DC2626;font-size:14px;letter-spacing:.5px;">DELETE ALL</strong> to confirm.
        </div>
        <input
          id="swal-confirm-input"
          class="swal2-input"
          placeholder='Type "DELETE ALL" to confirm'
          style="font-size:13px;font-weight:600;border:2px solid #FCA5A5;border-radius:8px;margin-top:0;"
          autocomplete="off"
          spellcheck="false"
        >
      `,
      showCancelButton: true,
      confirmButtonText: 'Delete All Certificates',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#C0392B',
      cancelButtonColor: '#6B7280',
      reverseButtons: true,
      focusCancel: true,
      didOpen: () => setTimeout(() => {
        const el = document.getElementById('swal-confirm-input');
        if (el) el.focus();
      }, 80),
      preConfirm: () => {
        const val = (document.getElementById('swal-confirm-input').value || '').trim();
        if (val !== 'DELETE ALL') {
          Swal.showValidationMessage('Type exactly: DELETE ALL');
          return false;
        }
        return true;
      },
    });
    if (!step2.isConfirmed) return;

    // Execute
    try {
      Swal.fire({
        title: 'Deleting Certificates...',
        text: `Removing ${count} certificate${count !== 1 ? 's' : ''} for ${name}.`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await dbQuery('DELETE FROM certificates WHERE ship_id = $1', [shipId]);

      await Swal.fire({
        icon: 'success',
        title: 'Certificates Deleted',
        html: `<div style="font-size:13px;color:#374151;">
                 All <strong>${count}</strong> certificate${count !== 1 ? 's' : ''} for
                 <strong>${name}</strong> have been permanently removed.
               </div>`,
        confirmButtonColor: '#0A2463',
        timer: 3000,
        timerProgressBar: true,
      });

      refreshCertificates();
    } catch (err) {
      console.error('[DeleteAll] certificates error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Deletion Failed',
        text: err.message || 'Unexpected error. Please try again.',
        confirmButtonColor: '#0A2463',
      });
    }
  }

  // ─── Delete All Crew ────────────────────────────────────────────────────────
  async function handleDeleteAllCrew() {
    const shipId = await resolveShipId();
    if (!shipId) { showNoShipError(); return; }

    Swal.fire({
      title: 'Loading ship info...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    const [info, count] = await Promise.all([
      fetchShipInfo(shipId),
      countRows('crew', shipId),
    ]);

    Swal.close();

    const { name, company, html: cardHtml } = buildShipCard(info, shipId);

    if (count === 0) {
      return Swal.fire({
        icon: 'info',
        title: 'No Crew Found',
        html: `${cardHtml}<div style="font-size:13px;color:#374151;">There are no crew members to delete for <strong>${name}</strong>.</div>`,
        confirmButtonColor: '#0A2463',
      });
    }

    // Step 1 – first warning
    const step1 = await Swal.fire({
      icon: 'warning',
      title: 'Delete All Crew Members?',
      html: `
        ${cardHtml}
        <div style="font-size:14px;color:#374151;line-height:1.7;">
          You are about to permanently delete
          <strong style="color:#DC2626;">${count} crew member${count !== 1 ? 's' : ''}</strong>
          from this ship.<br>
          <span style="color:#DC2626;font-weight:600;">This action cannot be undone.</span>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Yes, proceed',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#C0392B',
      cancelButtonColor: '#6B7280',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!step1.isConfirmed) return;

    // Step 2 – type DELETE ALL
    const step2 = await Swal.fire({
      icon: 'error',
      title: 'Final Confirmation',
      html: `
        <div style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:12px;">
          Permanently deleting <strong style="color:#DC2626;">${count} crew member${count !== 1 ? 's' : ''}</strong>
          from <strong>${name}</strong> (${company}).<br>
          Type <strong style="color:#DC2626;font-size:14px;letter-spacing:.5px;">DELETE ALL</strong> to confirm.
        </div>
        <input
          id="swal-confirm-input"
          class="swal2-input"
          placeholder='Type "DELETE ALL" to confirm'
          style="font-size:13px;font-weight:600;border:2px solid #FCA5A5;border-radius:8px;margin-top:0;"
          autocomplete="off"
          spellcheck="false"
        >
      `,
      showCancelButton: true,
      confirmButtonText: 'Delete All Crew',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#C0392B',
      cancelButtonColor: '#6B7280',
      reverseButtons: true,
      focusCancel: true,
      didOpen: () => setTimeout(() => {
        const el = document.getElementById('swal-confirm-input');
        if (el) el.focus();
      }, 80),
      preConfirm: () => {
        const val = (document.getElementById('swal-confirm-input').value || '').trim();
        if (val !== 'DELETE ALL') {
          Swal.showValidationMessage('Type exactly: DELETE ALL');
          return false;
        }
        return true;
      },
    });
    if (!step2.isConfirmed) return;

    // Execute
    try {
      Swal.fire({
        title: 'Deleting Crew...',
        text: `Removing ${count} crew member${count !== 1 ? 's' : ''} from ${name}.`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await dbQuery('DELETE FROM crew WHERE ship_id = $1', [shipId]);

      await Swal.fire({
        icon: 'success',
        title: 'Crew Deleted',
        html: `<div style="font-size:13px;color:#374151;">
                 All <strong>${count}</strong> crew member${count !== 1 ? 's' : ''} from
                 <strong>${name}</strong> have been permanently removed.
               </div>`,
        confirmButtonColor: '#0A2463',
        timer: 3000,
        timerProgressBar: true,
      });

      refreshCrew();
    } catch (err) {
      console.error('[DeleteAll] crew error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Deletion Failed',
        text: err.message || 'Unexpected error. Please try again.',
        confirmButtonColor: '#0A2463',
      });
    }
  }

  // ─── Bind Buttons ───────────────────────────────────────────────────────────
  function bindButtons() {
    const certBtn = document.getElementById('deleteAllCertBtn');
    const crewBtn = document.getElementById('deleteAllCrewBtn');

    if (certBtn) {
      certBtn.addEventListener('click', handleDeleteAllCertificates);
    } else {
      console.warn('[ship-detail-delete-all] #deleteAllCertBtn not found in DOM.');
    }

    if (crewBtn) {
      crewBtn.addEventListener('click', handleDeleteAllCrew);
    } else {
      console.warn('[ship-detail-delete-all] #deleteAllCrewBtn not found in DOM.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }

})();