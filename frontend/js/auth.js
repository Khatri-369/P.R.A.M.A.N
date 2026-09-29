import { api, user, escape, task } from "./api.js";
const pages = [
  ["dashboard", "Dashboard", "◫", ["admin", "investigator", "forensic"]],
  ["evidence", "Evidence", "▤", ["admin", "investigator", "forensic"]],
  ["upload", "Upload Evidence", "↑", ["investigator"]],
  ["custody", "Chain of Custody", "◇", ["admin", "investigator", "forensic"]],
  ["audit", "Audit Logs", "≡", ["admin"]],
  ["users", "Users", "♙", ["admin"]],
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
  document.querySelector("#shell").innerHTML =
    `<aside class="sidebar"><a class="brand" href="/dashboard.html"><span class="brand-mark">◈</span>P.R.A.M.A.N</a><div class="brand-sub">Digital evidence<br>Management portal</div><div class="nav-label">WORKSPACE</div><nav>${pages
      .filter((p) => p[3].includes(current.role))
      .map(
        ([key, label, icon]) =>
          `<a class="nav-link ${key === page || (page === "details" && key === "evidence") ? "active" : ""}" href="/${key}.html"><span>${icon}</span>${label}</a>`,
      )
      .join(
        "",
      )}</nav><div class="sidebar-footer">INTEGRITY. ACCOUNTABILITY. TRUST.<br>Educational prototype · v1.0<button id="logout" class="logout">↪ &nbsp; Log out</button></div></aside>`;
  document.querySelector("#topbar").innerHTML =
    `<div class="actions"><button class="mobile-menu" aria-label="Toggle navigation">☰</button><span class="muted">Workspace &nbsp; / &nbsp; <strong>${escape(rule?.[1] || "Evidence details")}</strong></span></div><div class="identity"><span class="avatar">${escape(current.name[0].toUpperCase())}</span><div><strong>${escape(current.name)}</strong><br><small>${current.role === "forensic" ? "Forensic Officer" : current.role[0].toUpperCase() + current.role.slice(1)}</small></div></div>`;
  document.querySelector(".mobile-menu").onclick = () =>
    document.querySelector(".sidebar").classList.toggle("open");
  document.querySelector("#logout").onclick = (event) =>
    task(event.target, async () => {
      await api("/auth/logout", { method: "POST" });
      sessionStorage.clear();
      location.href = "/";
    });
  return true;
}
const login = document.querySelector("#login-form");
if (login)
  login.addEventListener("submit", (event) => {
    event.preventDefault();
    task(login.querySelector("button"), async () => {
      const data = await api("/auth/login", {
        method: "POST",
        body: Object.fromEntries(new FormData(login)),
      });
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      location.href = "/dashboard.html";
    });
  });
