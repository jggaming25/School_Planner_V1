let activeAnnouncements = [];

async function checkAnnouncements() {
  if (!profile) return;
  const announcements = await dbGet('announcements', { is_active: true });
  activeAnnouncements = (announcements || []).filter(a => {
    if (!a.target_roles || a.target_roles.length === 0) return true;
    return a.target_roles.includes(profile.role);
  });
  renderAnnouncementBanner();
}

function renderAnnouncementBanner() {
  document.querySelectorAll('.announcement-banner').forEach(el => el.remove());
  if (activeAnnouncements.length === 0) return;
  const main = document.querySelector('.main-content');
  if (!main) return;
  activeAnnouncements.forEach(a => {
    const banner = document.createElement('div');
    banner.className = 'announcement-banner';
    banner.style.cssText = 'background:var(--warning);color:#000;padding:12px 20px;border-radius:8px;margin:12px 16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:0.875rem';
    banner.innerHTML = `
      <div>
        <strong>${escapeHtml(a.title)}</strong>
        <span style="margin-left:8px">${escapeHtml(a.message)}</span>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="dismissBanner(this)" style="color:#000;flex-shrink:0">Schließen</button>`;
    main.prepend(banner);
  });
}

function dismissBanner(btn) {
  btn.closest('.announcement-banner').remove();
}
