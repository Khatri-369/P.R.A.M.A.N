import { shell } from "./auth.js";
import {
  api,
  escape,
  date,
  badge,
  user,
  message,
  task,
  verificationText,
  download,
} from "./api.js";
const id = new URLSearchParams(location.search).get("id");
const statuses = [
  "Uploaded",
  "Under Review",
  "Assigned",
  "Verified",
  "Archived",
];
async function load() {
  const e = await api(`/evidence/${id}`),
    role = user().role;
  document.querySelector("#title").textContent = e.title;
  document.querySelector("#subtitle").textContent =
    `${e.evidenceId} · ${e.caseNumber}`;
  document.querySelector("#detail").innerHTML =
    `<dl class="detail-grid">${Object.entries({
      "Evidence ID": e.evidenceId,
      "Case number": e.caseNumber,
      "Evidence type": e.evidenceType,
      Filename: e.originalFilename,
      "File size": `${(e.fileSize / 1024).toFixed(1)} KB`,
      "Uploaded by": e.uploadedBy?.name,
      "Uploaded at": date(e.uploadedAt),
      "Current holder": e.currentHolder?.name,
      "Last verified": date(e.lastVerifiedAt),
    })
      .map(
        ([key, value]) => `<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`,
      )
      .join(
        "",
      )}<div><dt>Status / Integrity</dt><dd>${badge(e.status)} ${badge(e.integrityStatus)}</dd></div><div class="full"><dt>Description</dt><dd>${escape(e.description || "No description provided.")}</dd></div></dl><h3>Original SHA-256 fingerprint</h3><div class="hash">${escape(e.sha256Hash)}</div><p class="footer">This reference fingerprint is preserved during all verification checks.</p>`;
  document.querySelector("#evidence-actions").innerHTML =
    `${role !== "admin" ? '<button id="verify">✓ Verify integrity</button>' : ""}<a class="button secondary" href="/custody.html?id=${id}">View custody</a><button class="secondary" id="download">↓ Download file</button>`;
  document.querySelector("#download").onclick = (event) =>
    task(event.target, () =>
      download(`/evidence/${id}/download`, e.originalFilename),
    );
  if (role !== "admin")
    document.querySelector("#verify").onclick = (event) =>
      task(event.target, async () => {
        const result = await api(`/evidence/${id}/verify`, { method: "POST" });
        await load();
        message(verificationText(result), result.status === "Failed");
      });
  document.querySelector("#notes").innerHTML =
    e.notes
      .map(
        (n) =>
          `<div class="note"><p>${escape(n.text)}</p><small>${escape(n.author?.name)} · ${date(n.timestamp)}</small></div>`,
      )
      .join("") || '<p class="muted">No notes yet.</p>';
  document.querySelector("#note-card").hidden = role === "admin";
  document.querySelector("#status-card").hidden = role !== "forensic";
  document.querySelector("#status").innerHTML = statuses
    .map((s) => `<option ${s === e.status ? "selected" : ""}>${s}</option>`)
    .join("");
  const canTransfer =
    role === "admin" ||
    (role === "investigator" && e.currentHolder?._id === user().id);
  document.querySelector("#transfer-card").hidden = !canTransfer;
  if (canTransfer) {
    const recipients = await api("/users/recipients");
    document.querySelector("#toUserId").innerHTML =
      '<option value="">Choose recipient</option>' +
      recipients
        .filter((u) => u._id !== e.currentHolder?._id)
        .map(
          (u) =>
            `<option value="${u._id}">${escape(u.name)} · ${escape(u.role)}</option>`,
        )
        .join("");
  }
}
if (await shell("details")) {
  await task(null, load);
  if (new URLSearchParams(location.search).has("uploaded"))
    message("Evidence uploaded successfully. SHA-256 fingerprint recorded.");
  for (const [selector, url, method] of [
    ["#note-form", `/evidence/${id}/notes`, "POST"],
    ["#status-form", `/evidence/${id}/status`, "PATCH"],
    ["#transfer-form", "/custody/transfer", "POST"],
  ])
    document.querySelector(selector).onsubmit = (event) => {
      event.preventDefault();
      task(event.submitter, async () => {
        const body = Object.fromEntries(new FormData(event.target));
        if (selector === "#transfer-form") body.evidenceId = id;
        await api(url, { method, body });
        event.target.reset();
        await load();
        message("Record updated and custody event recorded.");
      });
    };
}
