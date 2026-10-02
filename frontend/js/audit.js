import { shell } from "./auth.js";
import { api, escape, date, pager, download, task, message } from "./api.js";
import { icon, emptyState, skeleton } from "./ui.js";
let page = 1,
  revision = 0;
const params = () =>
  new URLSearchParams(new FormData(document.querySelector("#filters")));
async function load() {
  const current = ++revision,
    query = params();
  query.set("page", page);
  document.querySelector("#records").innerHTML = skeleton(
    "Loading audit events",
  );
  const data = await api("/audit?" + query);
  if (current !== revision) return;
  document.querySelector("#records").innerHTML = data.items.length
    ? '<div class="table-wrap"><table class="responsive-table audit-table" aria-label="Audit events"><thead><tr><th scope="col">Event</th><th scope="col">Performed by</th><th scope="col">Evidence</th><th scope="col">Details</th><th scope="col">Timestamp</th></tr></thead><tbody>' +
      data.items
        .map(
          (log) =>
            '<tr><td class="record-primary" data-label="Event"><div class="audit-event">' +
            icon(
              log.action.includes("VERIFIED")
                ? "shield"
                : log.action.includes("LOGIN")
                  ? "lock"
                  : "audit",
            ) +
            '<strong class="mono">' +
            escape(log.action) +
            '</strong></div></td><td data-label="Performed by">' +
            escape(log.user?.name || "Unauthenticated") +
            '</td><td data-label="Evidence">' +
            (log.evidence
              ? '<a class="mono" href="/evidence-details.html?id=' +
                log.evidence._id +
                '">' +
                escape(log.evidence.evidenceId) +
                "</a>"
              : '<span class="muted">System event</span>') +
            '</td><td data-label="Details">' +
            (log.details
              ? '<details class="audit-details"><summary>View details</summary><p>' +
                escape(log.details) +
                "</p></details>"
              : '<span class="muted">—</span>') +
            '</td><td data-label="Timestamp"><small>' +
            date(log.timestamp) +
            "</small></td></tr>",
        )
        .join("") +
      "</tbody></table></div>"
    : emptyState(
        "No events match these filters",
        "Adjust your filters to explore recorded activity.",
        "audit",
      );
  pager(data, (n) => {
    page = n;
    task(null, load);
  });
}
if (await shell("audit")) {
  const form = document.querySelector("#filters");
  form.insertAdjacentHTML(
    "beforeend",
    '<button type="reset" class="filter-reset">Reset</button>',
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    page = 1;
    task(event.submitter, load);
  };
  form.onreset = () => {
    setTimeout(() => {
      page = 1;
      task(null, load);
    });
  };
  document.querySelector("#export").innerHTML =
    icon("download") + " Export XML";
  document.querySelector("#export").onclick = (event) =>
    task(event.currentTarget, async () => {
      await download("/audit/export/xml?" + params(), "praman-audit.xml");
      message("Audit XML generated. Check your browser downloads.");
    });
  await task(null, async () => {
    const users = await api("/users");
    document.querySelector("#user-filter").innerHTML += users
      .map(
        (u) => '<option value="' + u._id + '">' + escape(u.name) + "</option>",
      )
      .join("");
    await load();
  });
}
