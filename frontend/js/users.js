import { shell } from "./auth.js";
import { api, escape, date, badge, user, task, message } from "./api.js";
async function load() {
  const users = await api("/users");
  document.querySelector("#records").innerHTML =
    `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>${users.map((u) => `<tr><td><strong>${escape(u.name)}</strong></td><td>${escape(u.email)}</td><td>${escape(u.role)}</td><td>${badge(u.isActive ? "Active" : "Inactive")}</td><td><small>${date(u.createdAt)}</small></td><td>${u._id !== user().id ? `<button class="${u.isActive ? "danger" : "secondary"}" data-id="${u._id}" data-active="${!u.isActive}">${u.isActive ? "Deactivate" : "Reactivate"}</button>` : "<small>Current account</small>"}</td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll("[data-id]").forEach(
    (button) =>
      (button.onclick = () =>
        task(button, async () => {
          await api(`/users/${button.dataset.id}/status`, {
            method: "PATCH",
            body: { isActive: button.dataset.active === "true" },
          });
          await load();
          message("User status updated.");
        })),
  );
}
if (await shell("users")) {
  document.querySelector("#user-form").onsubmit = (event) => {
    event.preventDefault();
    task(event.submitter, async () => {
      await api("/users", {
        method: "POST",
        body: Object.fromEntries(new FormData(event.target)),
      });
      event.target.reset();
      await load();
      message("User created successfully.");
    });
  };
  await task(null, load);
}
