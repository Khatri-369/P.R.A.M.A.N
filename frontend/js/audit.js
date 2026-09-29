import { shell } from "./auth.js";
import { api, escape, date, pager, download, task } from "./api.js";
let page = 1;
const params = () =>
  new URLSearchParams(new FormData(document.querySelector("#filters")));
async function load() {
  const query = params();
  query.set("page", page);
  const data = await api(`/audit?${query}`);
  document.querySelector("#records").innerHTML = data.items.length
    ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>User</th><th>Evidence</th><th>Details</th><th>Timestamp</th></tr></thead><tbody>${data.items.map((log) => `<tr><td><strong class="mono">${escape(log.action)}</strong></td><td>${escape(log.user?.name || "Unauthenticated")}</td><td>${escape(log.evidence?.evidenceId || "—")}</td><td class="title-cell">${escape(log.details || "—")}</td><td><small>${date(log.timestamp)}</small></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty">No audit events match these filters.</div>';
  pager(data, (n) => {
    page = n;
    task(null, load);
  });
}
if (await shell("audit")) {
  document.querySelector("#filters").onsubmit = (event) => {
    event.preventDefault();
    page = 1;
    task(event.submitter, load);
  };
  document.querySelector("#export").onclick = (event) =>
    task(event.target, () =>
      download(`/audit/export/xml?${params()}`, "praman-audit.xml"),
    );
  await task(null, async () => {
    const users = await api("/users");
    document.querySelector("#user-filter").innerHTML += users
      .map((u) => `<option value="${u._id}">${escape(u.name)}</option>`)
      .join("");
    await load();
  });
}
