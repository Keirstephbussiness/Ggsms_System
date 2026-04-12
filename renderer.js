const CURRENT_VERSION = "1.1.0";

const VERSION_URL =
  "https://raw.githubusercontent.com/Keirstephbussiness/Ggsms_System/refs/heads/main/version.json";

let checking = false;

async function checkForUpdates() {
  if (checking) return;
  checking = true;

  try {
    const cacheBust = `?t=${Date.now()}`;
    const res = await fetch(VERSION_URL + cacheBust);
    if (!res.ok) throw new Error("Network error");

    const data = await res.json();
    console.log("Fetched version data:", data);
    console.log("Is newer:", isNewerVersion(data.version, CURRENT_VERSION));

    if (isNewerVersion(data.version, CURRENT_VERSION)) {
      showUpdateBanner(data);
    }
  } catch (err) {
    console.error("Update check failed:", err.message);
  } finally {
    checking = false;
  }
}

function isNewerVersion(latest, current) {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);

  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;

    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

function showUpdateBanner(data) {
  // Remove existing banner if any
  const existing = document.getElementById("update-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1e293b;
    color: #f1f5f9;
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    z-index: 99999;
    font-family: sans-serif;
    font-size: 14px;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-left: 4px solid #3b82f6;
  `;

  banner.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong style="font-size:15px;">🔄 Update Available</strong>
      <button id="close-update-banner" style="
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
      ">×</button>
    </div>
    <div style="color:#94a3b8; font-size:13px;">
      <span>Current: <strong style="color:#f1f5f9;">${CURRENT_VERSION}</strong></span><br/>
      <span>Latest: <strong style="color:#34d399;">${data.version}</strong></span>
    </div>
    <button id="install-update-btn" style="
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 9px 14px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
    ">⬇ Install Update</button>
  `;

  document.body.appendChild(banner);

  document.getElementById("install-update-btn").addEventListener("click", () => {
    downloadUpdate(data.url);
  });

  document.getElementById("close-update-banner").addEventListener("click", () => {
    banner.remove();
  });
}

function downloadUpdate(url) {
  if (!url) return;
  window.location.href = url;
}

window.addEventListener("DOMContentLoaded", () => {
  checkForUpdates();

  // Check every 30 minutes
  setInterval(checkForUpdates, 30 * 60 * 1000);
});