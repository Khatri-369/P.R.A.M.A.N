import "./motion.js";
// Shared presentation helpers; API and authorization remain in their existing modules.
const paths = {
  shield:
    '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  evidence: '<path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  custody:
    '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M6 9v9h9M13 6h5v5m-3-3 3 3 3-3"/>',
  audit: '<path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h3"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5m0 3v1"/>',
  file: '<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h5"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-5 4 4 4-6 4 5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  logout: '<path d="M9 3H4v18h5m5-5 5-4-5-4M8 12h12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
export function icon(name, className = "") {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}
export const roleName = (role) =>
  ({
    admin: "Administrator",
    investigator: "Investigator",
    forensic: "Forensic Officer",
  })[role] ||
  role ||
  "Team member";
export function emptyState(
  title,
  description = "Try a different search or clear your filters.",
  symbol = "search",
) {
  return `<div class="empty"><span class="empty-icon">${icon(symbol)}</span><strong>${title}</strong><p>${description}</p></div>`;
}
export function skeleton(label = "Loading records") {
  return `<div class="skeleton-group" role="status" aria-label="${label}"><span class="sr-only">${label}…</span>${[1, 2, 3].map(() => '<div class="skeleton-row"><span></span><span></span><span></span></div>').join("")}</div>`;
}
export function timelineMarkup(logs, esc, formatDate) {
  return `<ol class="timeline">${logs.map((log) => `<li class="timeline-item"><span class="timeline-node">${icon(log.action === "VERIFIED" ? "shield" : ["TRANSFERRED", "ASSIGNED"].includes(log.action) ? "custody" : log.action === "UPLOADED" ? "upload" : "file")}</span><div class="timeline-event"><div class="timeline-heading"><strong>${esc(log.action.replaceAll("_", " ").toLowerCase())}</strong><time datetime="${esc(log.timestamp)}">${formatDate(log.timestamp)}</time></div><div class="timeline-person">${esc(log.performedBy?.name || "System")} <span class="role-label">${esc(roleName(log.performedBy?.role))}</span></div>${log.fromUser || log.toUser ? `<div class="handover"><span><small>FROM</small>${esc(log.fromUser?.name || "Evidence source")}</span>${icon("arrow")}<span><small>TO</small>${esc(log.toUser?.name || "—")}</span></div>` : ""}${log.remarks ? `<p class="timeline-remarks">${esc(log.remarks)}</p>` : ""}</div></li>`).join("")}</ol>`;
}
export function confirmAction({
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
}) {
  return new Promise((resolve) => {
    const previous = document.activeElement,
      dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.innerHTML = `<form method="dialog"><span class="dialog-icon">${icon(danger ? "alert" : "custody")}</span><h2 id="confirm-title"></h2><p id="confirm-description"></p><div class="form-footer"><button value="cancel" class="secondary" autofocus>Cancel</button><button value="confirm" class="${danger ? "danger-solid" : ""}"></button></div></form>`;
    dialog.setAttribute("aria-labelledby", "confirm-title");
    dialog.setAttribute("aria-describedby", "confirm-description");
    dialog.querySelector("h2").textContent = title;
    dialog.querySelector("p").textContent = description;
    dialog.querySelector('[value="confirm"]').textContent = confirmLabel;
    document.body.append(dialog);
    dialog.addEventListener(
      "close",
      () => {
        const confirmed = dialog.returnValue === "confirm";
        dialog.remove();
        previous?.focus();
        resolve(confirmed);
      },
      { once: true },
    );
    dialog.showModal();
  });
}
