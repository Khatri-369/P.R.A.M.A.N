import { shell } from "./auth.js";
import { api, escape, date, evidenceTable, task, user } from "./api.js";
import { icon, emptyState, skeleton } from "./ui.js";
if (await shell("dashboard")) {
  document.querySelector("#stats").innerHTML = Array.from(
    { length: 4 },
    () => '<div class="card stat">' + skeleton("Loading statistics") + "</div>",
  ).join("");
  await task(null, async () => {
    const data = await api("/dashboard/stats");
    document.querySelector("#heading-action").innerHTML =
      user().role === "investigator"
        ? '<a class="button" href="/upload.html">' +
          icon("plus") +
          " Upload evidence</a>"
        : '<a class="button" href="/evidence.html">Open evidence registry ' +
          icon("arrow") +
          "</a>";
    document.querySelector("#overview-banner").innerHTML =
      `<div><div class="eyebrow">THE COMPLETE EVIDENCE JOURNEY</div><h2>Every record. Every handover. In view.</h2><p>${user().role === "forensic" ? "Your assigned evidence and its recorded history." : "A connected view of your evidence and its recorded history."}</p></div><div class="workflow">${[
        ["upload", "Record"],
        ["shield", "Verify"],
        ["custody", "Transfer"],
        ["audit", "Audit"],
      ]
        .map(
          ([symbol, label], index) =>
            (index ? icon("arrow") : "") +
            '<div class="workflow-step">' +
            icon(symbol) +
            "<span>" +
            label +
            "</span></div>",
        )
        .join("")}</div>`;
    document.querySelector("#stats").innerHTML = [
      [
        "Total evidence",
        data.totalEvidence,
        "Records in your workspace",
        "evidence",
        "",
      ],
      [
        "Verified integrity",
        data.verifiedEvidence,
        "Matched original fingerprint",
        "shield",
        "good",
      ],
      [
        "Awaiting verification",
        data.pendingEvidence,
        "No integrity check recorded",
        "clock",
        "warn",
      ],
      [
        "Integrity alerts",
        data.failedIntegrity,
        "Failed checks · review required",
        "alert",
        "bad",
      ],
    ]
      .map(
        ([label, count, hint, symbol, tone]) =>
          `<div class="card stat ${tone}"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-dot">${icon(symbol)}</span></div><div class="stat-value">${count}</div><small>${hint}</small></div>`,
      )
      .join("");
    document.querySelector("#recent").innerHTML = evidenceTable(
      data.recentEvidence,
      true,
    );
    document.querySelector("#activity").innerHTML =
      data.recentActivity
        .map(
          (log) =>
            `<div class="activity"><span class="activity-icon">${icon(log.action === "VERIFIED" ? "shield" : log.action === "TRANSFERRED" ? "custody" : "file")}</span><div><p><strong>${escape(log.action.replaceAll("_", " ").toLowerCase())}</strong> <a class="mono" href="/custody.html?id=${log.evidence?._id}">${escape(log.evidence?.evidenceId || "")}</a></p><small>${escape(log.performedBy?.name || "System")} · ${date(log.timestamp)}</small></div></div>`,
        )
        .join("") ||
      emptyState(
        "Your history starts here",
        "Recorded evidence activity will appear in this feed.",
        "clock",
      );
    document.querySelector("#types").innerHTML = data.evidenceByType.length
      ? `<div class="distribution-total"><span>Evidence composition</span><strong>${data.totalEvidence}</strong></div>${data.evidenceByType.map((type) => `<div class="type-row">${icon(type._id === "Image" ? "image" : "file")}<div class="type-name">${escape(type._id)}<meter min="0" max="${data.totalEvidence || 1}" value="${type.count}" aria-label="${escape(type._id)}: ${type.count} of ${data.totalEvidence} records"></meter></div><strong>${type.count}</strong></div>`).join("")}`
      : emptyState(
          "No evidence yet",
          "Evidence types will appear once a record is uploaded.",
          "evidence",
        );
  });
}
