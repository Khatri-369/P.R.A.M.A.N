import { shell } from "./auth.js";
import { api, escape, date, user, download, task } from "./api.js";
let selected = new URLSearchParams(location.search).get("id");
async function load() {
  if (!selected) return;
  const data = await api(`/custody/${selected}`);
  document.querySelector("#record-title").textContent =
    `${data.evidenceId} · Custody timeline`;
  document.querySelector("#timeline").innerHTML =
    `<ol class="timeline">${data.logs.map((log) => `<li><strong>${escape(log.action.replaceAll("_", " "))}</strong><p>${escape(log.performedBy?.name || "System")}<br>${log.fromUser || log.toUser ? `From: ${escape(log.fromUser?.name || "—")} → To: ${escape(log.toUser?.name || "—")}<br>` : ""}${escape(log.remarks)}</p><small>${date(log.timestamp)}</small></li>`).join("")}</ol>`;
  document.querySelector("#export").hidden = user().role !== "admin";
}
if (await shell("custody")) {
  document.querySelector("#lookup").onsubmit = (event) => {
    event.preventDefault();
    task(event.submitter, async () => {
      const query = document.querySelector("#query").value;
      const data = await api(
        `/evidence?search=${encodeURIComponent(query)}&limit=100`,
      );
      document.querySelector("#matches").innerHTML =
        data.items
          .map(
            (e) =>
              `<button class="secondary" data-id="${e._id}">${escape(e.evidenceId)} · ${escape(e.title)}</button>`,
          )
          .join("") || '<p class="muted">No matching evidence.</p>';
      document.querySelectorAll("[data-id]").forEach(
        (button) =>
          (button.onclick = () =>
            task(button, async () => {
              selected = button.dataset.id;
              history.replaceState(null, "", `?id=${selected}`);
              await load();
            })),
      );
    });
  };
  document.querySelector("#export").onclick = (event) =>
    task(event.target, () =>
      download(`/custody/${selected}/export/xml`, "custody.xml"),
    );
  await task(null, load);
}
