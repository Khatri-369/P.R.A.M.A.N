import { shell } from "./auth.js";
import { api, escape, date, user, download, task } from "./api.js";
import { timelineMarkup, emptyState, skeleton } from "./ui.js";
let selected = new URLSearchParams(location.search).get("id");
async function load() {
  if (!selected) return;
  document.querySelector("#timeline").innerHTML = skeleton(
    "Loading custody timeline",
  );
  const data = await api(`/custody/${selected}`);
  document.querySelector("#record-title").textContent =
    `${data.evidenceId} · Custody timeline`;
  document.querySelector("#timeline").innerHTML = data.logs.length
    ? timelineMarkup(data.logs, escape, date)
    : emptyState(
        "No custody events",
        "Recorded activity will appear here.",
        "custody",
      );
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
              document.querySelectorAll("[data-id]").forEach((el) => {
                el.classList.toggle("selected-match", el === button);
                el.setAttribute("aria-pressed", String(el === button));
              });
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
