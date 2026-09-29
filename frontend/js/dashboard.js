import { shell } from "./auth.js";
import { api, escape, date, evidenceTable, task, user } from "./api.js";
if (await shell("dashboard"))
  await task(null, async () => {
    const data = await api("/dashboard/stats");
    document.querySelector("#heading-action").innerHTML =
      user().role === "investigator"
        ? '<a class="button" href="/upload.html">＋ Upload evidence</a>'
        : '<a class="button" href="/evidence.html">Browse evidence →</a>';
    document.querySelector("#stats").innerHTML = [
      ["Total evidence", data.totalEvidence, "All accessible records", "▤"],
      ["Verified", data.verifiedEvidence, "File integrity confirmed", "✓"],
      [
        "Pending verification",
        data.pendingEvidence,
        "Awaiting an integrity check",
        "◷",
      ],
      ["Integrity failed", data.failedIntegrity, "Requires attention", "!"],
    ]
      .map(
        ([label, count, hint, icon]) =>
          `<div class="card stat"><span class="stat-dot">${icon}</span><span class="stat-label">${label}</span><div class="stat-value">${count}</div><small>${hint}</small></div>`,
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
            `<div class="activity"><span class="activity-icon">◇</span><div><p><strong>${escape(log.action.replaceAll("_", " "))}</strong> · ${escape(log.evidence?.evidenceId)}</p><small>${escape(log.performedBy?.name)} · ${date(log.timestamp)}</small></div></div>`,
        )
        .join("") ||
      '<div class="empty">Your evidence activity will appear here.</div>';
    document.querySelector("#types").innerHTML =
      data.evidenceByType
        .map(
          (t) =>
            `<div class="type-row"><span>${escape(t._id)}</span><strong>${t.count} records</strong></div>`,
        )
        .join("") || '<div class="empty">No evidence recorded yet.</div>';
  });
