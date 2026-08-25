let deferredPrompt = null;

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/School_Planner_V1/sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBanner();
    showToast('App installiert!', 'success');
  });
}

function showInstallBanner() {
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--accent);border-radius:var(--radius-lg);padding:16px 24px;display:flex;align-items:center;gap:16px;box-shadow:var(--shadow-lg);z-index:999;max-width:90vw;width:400px;';
  banner.innerHTML = `
    <div style="flex:1">
      <strong style="font-size:0.875rem;display:block">App installieren</strong>
      <span style="font-size:0.75rem;color:var(--text-secondary)">Zugriff auch offline verfügbar</span>
    </div>
    <button class="btn btn-primary btn-sm" onclick="installPWA()">Installieren</button>
    <button class="btn btn-ghost btn-sm" onclick="hideInstallBanner()">Ignorieren</button>
  `;
  document.body.appendChild(banner);
}

function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
}

async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  hideInstallBanner();
  if (outcome === 'accepted') {
    showToast('App wird installiert...', 'info');
  }
}

initPWA();
