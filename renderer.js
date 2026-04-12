const CURRENT_VERSION = "1.0.0";

const VERSION_URL = "https://raw.githubusercontent.com/Keirstephbussiness/Ggsms_System/refs/heads/main/version.json";

let checking = false;

async function checkForUpdates() {
  if (checking) return;
  checking = true;

  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Network error");

    const data = await res.json();

    if (isNewerVersion(data.version, CURRENT_VERSION)) {
      promptUpdate(data);
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

function promptUpdate(data) {
  const message = `
New version available!

Current: ${CURRENT_VERSION}
Latest: ${data.version}

Update now?
  `;

  const ok = confirm(message);

  if (ok) {
    downloadUpdate(data.url);
  }
}

function downloadUpdate(url) {
  if (!url) return;

  // Windows + Mac both open browser download
  window.location.href = url;
}

window.addEventListener("DOMContentLoaded", () => {
  checkForUpdates();

  // check every 30 minutes
  setInterval(checkForUpdates, 30 * 60 * 1000);
});