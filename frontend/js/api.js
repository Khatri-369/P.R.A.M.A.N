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
}
export async function task(button, callback) {
  if (button) button.disabled = true;
  try {
    await callback();
  } catch (error) {
    message(error.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}
export function badge(value) {
  return `<span class="badge ${value === "Failed" ? "bad" : value === "Verified" || value === "Active" ? "good" : value === "Not Checked" ? "warn" : value === "Assigned" || value === "Under Review" ? "blue" : ""}">${escape(value)}</span>`;
}
export function evidenceTable(items, compact = false) {
  if (!items.length)
    return '<div class="empty">No evidence found. New records will appear here.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Evidence ID / Title</th><th>Case number</th><th>Type</th>${compact ? "" : "<th>Current holder</th>"}<th>Status</th><th>Integrity</th><th>Uploaded</th><th></th></tr></thead><tbody>${items.map((e) => `<tr><td class="title-cell"><a href="/evidence-details.html?id=${e._id}"><strong class="mono">${escape(e.evidenceId)}</strong><br><span>${escape(e.title)}</span></a></td><td>${escape(e.caseNumber)}</td><td>${escape(e.evidenceType)}</td>${compact ? "" : `<td>${escape(e.currentHolder?.name)}</td>`}<td>${badge(e.status)}</td><td>${badge(e.integrityStatus)}</td><td><small>${date(e.uploadedAt)}</small></td><td><div class="actions"><a href="/evidence-details.html?id=${e._id}">View ↗</a>${compact ? "" : `<a href="/custody.html?id=${e._id}">Custody</a>${user()?.role !== "admin" ? `<button class="secondary" data-verify="${e._id}">Verify</button>` : ""}`}</div></td></tr>`).join("")}</tbody></table></div>`;
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
