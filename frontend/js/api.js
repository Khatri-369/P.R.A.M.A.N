import { icon, emptyState } from "./ui.js";
export const user = () => {
  try {
    return JSON.parse(sessionStorage.getItem("user"));
  } catch {
    return null;
  }
};
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const date = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not yet";
export async function api(url, options = {}) {
  const headers = {
    Authorization: `Bearer ${sessionStorage.getItem("token") || ""}`,
    ...options.headers,
  };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`/api${url}`, { ...options, headers });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.includes("/login")) {
      sessionStorage.clear();
      location.href = "/";
    }
    throw new Error(result.message || "Request failed.");
  }
  return result.data;
}
export async function download(url, filename) {
  const response = await fetch(`/api${url}`, {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem("token") || ""}`,
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  const blob = await response.blob(),
    href = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function message(text, isError = false) {
  const el = document.querySelector("#message");
  el.className = `message notice ${isError ? "error" : "success"}`;
  el.textContent = text;
  el.tabIndex = -1;
  if (isError) el.focus({ preventScroll: false });
  document.querySelector(".toast")?.remove();
  if (!isError) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = icon("check");
    const content = document.createElement("span");
    content.textContent = text.split("\n")[0];
    toast.append(content);
    document.body.append(toast);
    setTimeout(() => toast.remove(), 4500);
  }
}
export async function task(button, callback) {
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  }
  try {
    await callback();
  } catch (error) {
    document.querySelectorAll(".skeleton-group").forEach((el) => {
      el.className = "empty";
      el.textContent =
        "Unable to load these records. Reload the page to retry.";
    });
    message(error.message, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }
}
export function badge(value) {
  return `<span class="badge ${value === "Failed" ? "bad" : value === "Verified" || value === "Active" ? "good" : value === "Not Checked" ? "warn" : value === "Assigned" || value === "Under Review" ? "blue" : ""}">${escape(value)}</span>`;
}
export function evidenceTable(items, compact = false) {
  if (!items.length)
    return emptyState(
      "No evidence found",
      "New records will appear here. Try a different search or clear the filters.",
      "evidence",
    );
  return (
    '<div class="table-wrap"><table class="responsive-table" aria-label="Evidence records"><thead><tr><th scope="col">Evidence / Record</th><th scope="col">Case number</th><th scope="col">Type</th>' +
    (compact ? "" : '<th scope="col">Custodian</th>') +
    '<th scope="col">Status</th><th scope="col">Integrity</th><th scope="col">Uploaded</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
    items
      .map(
        (e) =>
          `<tr><td class="title-cell record-primary" data-label="Evidence"><div class="record-name"><span class="file-icon">${icon(e.evidenceType === "Image" ? "image" : "file")}</span><a href="/evidence-details.html?id=${e._id}"><strong class="mono">${escape(e.evidenceId)}</strong><span>${escape(e.title)}</span></a></div></td><td data-label="Case number"><span class="mono">${escape(e.caseNumber)}</span></td><td data-label="Type"><span class="type-label">${escape(e.evidenceType)}</span></td>${compact ? "" : `<td data-label="Custodian"><div class="person-cell"><span class="avatar">${escape(e.currentHolder?.name?.[0] || "?")}</span>${escape(e.currentHolder?.name || "Unassigned")}</div></td>`}<td data-label="Status">${badge(e.status)}</td><td data-label="Integrity">${badge(e.integrityStatus)}</td><td data-label="Uploaded"><small>${date(e.uploadedAt)}</small></td><td class="record-actions"><div class="row-actions"><a href="/evidence-details.html?id=${e._id}" aria-label="View ${escape(e.evidenceId)}">View ↗</a>${compact ? "" : `<a href="/custody.html?id=${e._id}" aria-label="Custody for ${escape(e.evidenceId)}">Custody</a>${user()?.role !== "admin" ? '<button class="secondary" data-verify="' + e._id + '" aria-label="Verify ' + escape(e.evidenceId) + '">Verify</button>' : ""}`}</div></td></tr>`,
      )
      .join("") +
    "</tbody></table></div>"
  );
}
export function pager(data, onPage) {
  const el = document.querySelector("#pagination");
  el.innerHTML = `<span>${data.total} records · Page ${data.page} of ${data.pages}</span><div class="actions"><button class="secondary" id="previous" ${data.page <= 1 ? "disabled" : ""}>← Previous</button><button class="secondary" id="next" ${data.page >= data.pages ? "disabled" : ""}>Next →</button></div>`;
  el.querySelector("#previous").onclick = () => onPage(data.page - 1);
  el.querySelector("#next").onclick = () => onPage(data.page + 1);
}
export function verificationText(result) {
  return `${result.status === "Verified" ? "VERIFIED — the stored file matches its original SHA-256." : "INTEGRITY CHECK FAILED" + (result.missing ? " — stored file is missing." : " — the stored file has changed.")}\nOriginal: ${result.originalHash}\nCurrent: ${result.currentHash || "Unavailable"}\nChecked: ${date(result.verificationDate)}`;
}
