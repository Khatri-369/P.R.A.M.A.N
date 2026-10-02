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
import {
  icon,
  roleName,
  timelineMarkup,
  confirmAction,
  emptyState,
} from "./ui.js";
const id = new URLSearchParams(location.search).get("id");
const statuses = [
  "Uploaded",
  "Under Review",
  "Assigned",
  "Verified",
  "Archived",
];
let lastVerification = null;
function metadata(entries) {
  return (
    '<dl class="detail-grid">' +
    Object.entries(entries)
      .map(
        ([key, value]) =>
          "<div><dt>" + key + "</dt><dd>" + escape(value) + "</dd></div>",
      )
      .join("") +
    "</dl>"
  );
}
async function load() {
  const e = await api("/evidence/" + id),
    role = user().role;
  document.querySelector("#title").textContent = e.title;
  document.querySelector("#subtitle").textContent =
    e.evidenceId + " / " + e.caseNumber;
  const tone =
    e.integrityStatus === "Verified"
      ? "good"
      : e.integrityStatus === "Failed"
        ? "bad"
        : "warn";
  const integrityTitle =
    e.integrityStatus === "Verified"
      ? "File integrity verified"
      : e.integrityStatus === "Failed"
        ? "Integrity check failed"
        : "Awaiting integrity verification";
  const integrityDescription =
    e.integrityStatus === "Verified"
      ? "The stored file matched its original SHA-256 fingerprint at the last check."
      : e.integrityStatus === "Failed"
        ? "The last check found changed content or an unavailable stored file."
        : "Run a verification to compare the stored file with its original fingerprint.";
  document.querySelector("#detail").innerHTML =
    '<div class="record-facts"><h3 class="record-section-title">' +
    icon("evidence") +
    " Evidence overview</h3>" +
    metadata({
      "Evidence ID": e.evidenceId,
      "Case number": e.caseNumber,
      "Evidence type": e.evidenceType,
      "Current custodian": e.currentHolder?.name,
      "Uploaded by": e.uploadedBy?.name,
      "Recorded at": date(e.uploadedAt),
    }) +
    '<h3 class="record-section-title">' +
    icon("file") +
    " File & case information</h3>" +
    metadata({
      "Original filename": e.originalFilename,
      "File size": (e.fileSize / 1024).toFixed(1) + " KB",
      "Content type": e.mimeType,
    }) +
    '<dl class="detail-grid record-description"><div class="full"><dt>Description</dt><dd>' +
    escape(e.description || "No description provided.") +
    "</dd></div><div><dt>Workflow status</dt><dd>" +
    badge(e.status) +
    '</dd></div></dl></div><section class="integrity-panel ' +
    tone +
    '" aria-label="Integrity verification"><div class="integrity-heading"><span class="integrity-emblem">' +
    icon(e.integrityStatus === "Failed" ? "alert" : "shield") +
    "</span><div><h3>" +
    integrityTitle +
    "</h3><p>" +
    integrityDescription +
    '</p></div></div><div class="hash-label"><span>ORIGINAL SHA-256 / REFERENCE FINGERPRINT</span><button id="copy-hash" class="copy-hash" type="button">' +
    icon("copy") +
    ' Copy</button></div><div class="hash" id="reference-hash">' +
    escape(e.sha256Hash) +
    '</div><p class="footer">Last check: ' +
    date(e.lastVerifiedAt) +
    ' · The original fingerprint is preserved.</p><div class="verification-result" id="verification-result" role="status"></div></section>';
  if (lastVerification)
    document.querySelector("#verification-result").innerHTML =
      '<div class="hash-label">CURRENT SHA-256 / LATEST CHECK</div><div class="hash">' +
      escape(
        lastVerification.currentHash || "Unavailable — stored file missing",
      ) +
      "</div>";
  document.querySelector("#copy-hash").onclick = (event) =>
    task(event.currentTarget, async () => {
      try {
        await navigator.clipboard.writeText(e.sha256Hash);
        message("SHA-256 fingerprint copied.");
      } catch {
        const selection = window.getSelection(),
          range = document.createRange();
        range.selectNodeContents(document.querySelector("#reference-hash"));
        selection.removeAllRanges();
        selection.addRange(range);
        message(
          "Fingerprint selected. Press Ctrl+C or use your device’s Copy action.",
        );
      }
    });
  document.querySelector("#evidence-actions").innerHTML =
    (role !== "admin"
      ? '<button id="verify">' + icon("shield") + " Verify integrity</button>"
      : "") +
    '<a class="button secondary" href="/custody.html?id=' +
    id +
    '">' +
    icon("custody") +
    ' View custody</a><button class="secondary" id="download">' +
    icon("download") +
    " Download</button>";
  document.querySelector("#download").onclick = (event) =>
    task(event.currentTarget, () =>
      download("/evidence/" + id + "/download", e.originalFilename),
    );
  if (role !== "admin")
    document.querySelector("#verify").onclick = (event) =>
      task(event.currentTarget, async () => {
        lastVerification = await api("/evidence/" + id + "/verify", {
          method: "POST",
        });
        await load();
        message(
          verificationText(lastVerification),
          lastVerification.status === "Failed",
        );
      });
  document.querySelector("#notes").innerHTML =
    e.notes
      .map(
        (n) =>
          '<article class="note"><p>' +
          escape(n.text) +
          '</p><div class="note-author"><span class="avatar">' +
          escape(n.author?.name?.[0] || "?") +
          "</span>" +
          escape(n.author?.name || "Team member") +
          " · " +
          escape(roleName(n.author?.role)) +
          " · " +
          date(n.timestamp) +
          "</div></article>",
      )
      .join("") ||
    emptyState(
      "No notes recorded",
      "Add investigation context or findings to this evidence record.",
      "file",
    );
  document.querySelector("#note-card").hidden = role === "admin";
  document.querySelector("#status-card").hidden = role !== "forensic";
  document.querySelector("#status").innerHTML = statuses
    .map(
      (s) =>
        "<option " + (s === e.status ? "selected" : "") + ">" + s + "</option>",
    )
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
            '<option value="' +
            u._id +
            '">' +
            escape(u.name) +
            " · " +
            escape(roleName(u.role)) +
            "</option>",
        )
        .join("");
  }
  document.querySelector("#full-custody").href = "/custody.html?id=" + id;
  // A preview uses the existing custody API, with the same server-side scope.
  try {
    const custody = await api("/custody/" + id);
    document.querySelector("#custody-preview").innerHTML = timelineMarkup(
      custody.logs.slice(-3),
      escape,
      date,
    );
  } catch (error) {
    document.querySelector("#custody-preview").textContent = error.message;
  }
}
if (await shell("details")) {
  await task(null, async () => {
    await load();
    if (new URLSearchParams(location.search).has("uploaded")) {
      message(
        "Evidence uploaded. Original fingerprint and custody event recorded.",
      );
      history.replaceState(null, "", "?id=" + id);
    }
  });
  for (const [selector, url, method] of [
    ["#note-form", "/evidence/" + id + "/notes", "POST"],
    ["#status-form", "/evidence/" + id + "/status", "PATCH"],
    ["#transfer-form", "/custody/transfer", "POST"],
  ]) {
    document.querySelector(selector).onsubmit = (event) => {
      event.preventDefault();
      task(event.submitter, async () => {
        const body = Object.fromEntries(new FormData(event.target));
        if (selector === "#transfer-form") {
          const recipient =
            document.querySelector("#toUserId").selectedOptions[0].textContent;
          if (
            !(await confirmAction({
              title: "Transfer custody?",
              description:
                "Hand this evidence to " +
                recipient +
                ". This action will be recorded in the custody timeline.",
              confirmLabel: "Transfer custody",
            }))
          )
            return;
          body.evidenceId = id;
        }
        await api(url, { method, body });
        event.target.reset();
        await load();
        message(
          selector === "#note-form"
            ? "Note added to the evidence history."
            : selector === "#status-form"
              ? "Review status updated."
              : "Custody transferred and handover recorded.",
        );
      });
    };
  }
}
