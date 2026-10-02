import { shell } from "./auth.js";
import { icon, skeleton } from "./ui.js";
import {
  api,
  evidenceTable,
  pager,
  task,
  message,
  verificationText,
} from "./api.js";
let page = 1,
  revision = 0;
async function load() {
  const current = ++revision,
    params = new URLSearchParams(
      new FormData(document.querySelector("#filters")),
    );
  params.set("page", page);
  document.querySelector("#records").innerHTML = skeleton("Loading evidence");
  const data = await api(`/evidence?${params}`);
  if (current !== revision) return;
  document.querySelector("#records").innerHTML = evidenceTable(data.items);
  pager(data, (n) => {
    page = n;
    task(null, load);
  });
  document.querySelectorAll("[data-verify]").forEach(
    (button) =>
      (button.onclick = () =>
        task(button, async () => {
          const result = await api(
            `/evidence/${button.dataset.verify}/verify`,
            { method: "POST" },
          );
          await load();
          message(verificationText(result), result.status === "Failed");
        })),
  );
}
if (await shell("evidence")) {
  document.querySelector("#heading-action").innerHTML =
    '<span class="badge role">' + icon("shield") + " Role-scoped access</span>";
  document
    .querySelector("#filters")
    .insertAdjacentHTML(
      "beforeend",
      '<button type="reset" class="filter-reset">Reset</button>',
    );
  document.querySelector("#filters").onreset = () =>
    setTimeout(() => {
      page = 1;
      task(null, load);
    });
  document.querySelector("#filters").onsubmit = (event) => {
    event.preventDefault();
    page = 1;
    task(event.submitter, load);
  };
  await task(null, load);
}
