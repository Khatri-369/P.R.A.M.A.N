import { api, escape, task } from "./api.js";
import { icon, roleName, skeleton } from "./ui.js";
const pages = [
  ["dashboard", "Overview", "dashboard", ["admin", "investigator", "forensic"]],
  [
    "evidence",
    "Evidence registry",
    "evidence",
    ["admin", "investigator", "forensic"],
  ],
  ["upload", "Upload evidence", "upload", ["investigator"]],
  [
    "custody",
    "Chain of custody",
    "custody",
    ["admin", "investigator", "forensic"],
  ],
  ["audit", "Audit logs", "audit", ["admin"]],
  ["users", "Team & access", "users", ["admin"]],
];
export async function shell(page) {
  if (!sessionStorage.getItem("token")) {
    location.replace("/");
    return false;
  }
  let current;
  try {
    current = await api("/auth/me");
    sessionStorage.setItem("user", JSON.stringify(current));
  } catch {
    location.replace("/");
    return false;
  }
  const rule = pages.find((p) => p[0] === page);
  if (rule && !rule[3].includes(current.role)) {
    location.replace("/dashboard.html");
    return false;
  }
  document.body.dataset.page = page;
  const content = document.querySelector("main");
  content.id = "main-content";
  content.tabIndex = -1;
  const initials = current.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  document.querySelector("#shell").innerHTML =
    `<a class="skip-link" href="#main-content">Skip to content</a><button class="nav-backdrop" hidden aria-label="Close navigation"></button><aside class="sidebar" id="navigation"><div class="sidebar-brand"><a class="brand" href="/dashboard.html"><span class="brand-mark">${icon("shield")}</span><span>PRAMĀN<small>EVIDENCE INTELLIGENCE</small></span></a><button class="nav-close icon-button" aria-label="Close navigation">${icon("close")}</button></div><div class="workspace-label"><span class="workspace-symbol">P</span><div>Evidence workspace<small>Investigation & forensics</small></div>${icon("lock")}</div><div class="nav-label">WORKSPACE</div><nav aria-label="Main navigation">${pages
      .filter((p) => p[3].includes(current.role))
      .map(([key, label, symbol]) => {
        const active =
          key === page || (page === "details" && key === "evidence");
        return `<a class="nav-link ${active ? "active" : ""}" ${active ? 'aria-current="page"' : ""} href="/${key}.html">${icon(symbol)}<span>${label}</span>${active ? '<span class="nav-active-dot"></span>' : ""}</a>`;
      })
      .join(
        "",
      )}</nav><div class="sidebar-footer"><div class="sidebar-note">${icon("shield")}<div>Every action. Accounted for.<small>Record · Verify · Trace</small></div></div><div class="account"><span class="avatar">${escape(initials)}</span><div><strong>${escape(current.name)}</strong><small>${escape(roleName(current.role))}</small></div></div><button id="logout" class="logout">${icon("logout")}<span>Sign out</span>${icon("arrow")}</button></div></aside>`;
  document.querySelector("#topbar").innerHTML =
    `<div class="breadcrumb"><button class="mobile-menu icon-button" aria-label="Open navigation" aria-expanded="false" aria-controls="navigation">${icon("menu")}</button><span class="breadcrumb-root">Workspace</span><span class="breadcrumb-separator">/</span><strong>${escape(rule?.[1] || "Evidence record")}</strong></div><div class="topbar-account"><span class="role-badge">${icon("shield")}${escape(roleName(current.role))}</span><span class="avatar" title="${escape(current.name)}">${escape(initials)}</span></div>`;
  const sidebar = document.querySelector(".sidebar"),
    toggle = document.querySelector(".mobile-menu"),
    backdrop = document.querySelector(".nav-backdrop"),
    mobile = window.matchMedia("(max-width: 800px)");
  function setNavigation(open, returnFocus = true) {
    sidebar.classList.toggle("open", open);
    backdrop.hidden = !open;
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    sidebar.inert = mobile.matches && !open;
    if (open) sidebar.querySelector(".nav-close").focus();
    else if (returnFocus && mobile.matches) toggle.focus();
  }
  toggle.onclick = () => setNavigation(true);
  backdrop.onclick = () => setNavigation(false);
  document.querySelector(".nav-close").onclick = () => setNavigation(false);
  document.addEventListener("keydown", (event) => {
    if (!sidebar.classList.contains("open")) return;
    if (event.key === "Escape") setNavigation(false);
    if (event.key === "Tab") {
      const elements = [...sidebar.querySelectorAll("a,button")].filter(
          (el) => el.getClientRects().length,
        ),
        first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  mobile.addEventListener("change", () => setNavigation(false, false));
  setNavigation(false, false);
  document.querySelector("#logout").onclick = (event) =>
    task(event.currentTarget, async () => {
      await api("/auth/logout", { method: "POST" });
      sessionStorage.clear();
      location.href = "/";
    });
  document
    .querySelectorAll(
      "#records:empty,#detail:empty,#activity:empty,#types:empty",
    )
    .forEach((el) => (el.innerHTML = skeleton()));
  return true;
}
const login = document.querySelector("#login-form");
if (login) {
  document.querySelector("#password-toggle").onclick = (event) => {
    const password = login.elements.password,
      showing = password.type === "password";
    password.type = showing ? "text" : "password";
    event.currentTarget.textContent = showing ? "Hide" : "Show";
    event.currentTarget.setAttribute("aria-pressed", String(showing));
  };
  login.addEventListener("submit", (event) => {
    event.preventDefault();
    task(login.querySelector('[type="submit"]'), async () => {
      const data = await api("/auth/login", {
        method: "POST",
        body: Object.fromEntries(new FormData(login)),
      });
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      location.href = "/dashboard.html";
    });
  });
}
