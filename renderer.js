const CURRENT_VERSION = "1.0.0";
const VERSION_URL = "https://yourserver.com/version.json";

let isChecking = false;

async function checkForUpdates() {
  if (isChecking) return;
  isChecking = true;

  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");

    const data = await res.json();

    if (isNewerVersion(data.version, CURRENT_VERSION)) {
      showUpdateUI(data);
    }
  } catch (err) {
    console.error("Update check failed:", err.message);
  } finally {
    isChecking = false;
  }
}

function isNewerVersion(latest, current) {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);

  for (let i = 0; i < l.length; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function showUpdateUI(data) {
  const confirmUpdate = confirm(`New version ${data.version} available. Update now?`);
  if (confirmUpdate) downloadUpdate(data.url);
}

function downloadUpdate(url) {
  window.location.href = url;
}

window.addEventListener("DOMContentLoaded", () => {
  checkForUpdates();
  setInterval(checkForUpdates, 1800000);
});