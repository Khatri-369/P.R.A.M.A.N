import { shell } from "./auth.js";
import { api, escape, date, badge, user, task, message } from "./api.js";
import { roleName, confirmAction, icon } from "./ui.js";
async function load() {
  const users = await api("/users");
  document.querySelector("#records").innerHTML =
    '<div class="team-intro"><span><strong>' +
    users.length +
    "</strong> team members</span><span><strong>" +
    users.filter((u) => u.isActive).length +
    '</strong> active accounts</span><span>Access is enforced by role</span></div><div class="table-wrap"><table class="responsive-table" aria-label="Workspace users"><thead><tr><th scope="col">Team member</th><th scope="col">Email address</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Manage</th></tr></thead><tbody>' +
    users
      .map(
        (u) =>
          '<tr><td class="record-primary" data-label="Name"><div class="user-summary"><span class="avatar">' +
          escape(u.name[0]) +
          "</span><strong>" +
          escape(u.name) +
          '</strong></div></td><td data-label="Email">' +
          escape(u.email) +
          '</td><td data-label="Role"><span class="badge role">' +
          escape(roleName(u.role)) +
          '</span></td><td data-label="Account">' +
          badge(u.isActive ? "Active" : "Inactive") +
          '</td><td data-label="Created"><small>' +
          date(u.createdAt) +
          '</small></td><td class="record-actions">' +
          (u._id !== user().id
            ? '<button class="' +
              (u.isActive ? "danger" : "secondary") +
              '" data-id="' +
              u._id +
              '" data-active="' +
              !u.isActive +
              '">' +
              (u.isActive ? "Deactivate" : "Reactivate") +
              "</button>"
            : '<span class="badge">Your account</span>') +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div>";
  document.querySelectorAll("[data-id]").forEach(
    (button) =>
      (button.onclick = () =>
        task(button, async () => {
          const active = button.dataset.active === "true",
            person = users.find((u) => u._id === button.dataset.id);
          if (
            !(await confirmAction({
              title: active ? "Reactivate account?" : "Deactivate account?",
              description: active
                ? "Restore access for " + person.name + "?"
                : "Remove workspace access for " +
                  person.name +
                  "? Their recorded history will be preserved.",
              confirmLabel: active ? "Reactivate" : "Deactivate",
              danger: !active,
            }))
          )
            return;
          await api("/users/" + button.dataset.id + "/status", {
            method: "PATCH",
            body: { isActive: active },
          });
          await load();
          message("User account " + (active ? "reactivated." : "deactivated."));
        })),
  );
}
if (await shell("users")) {
  document.querySelector("#heading-action").innerHTML =
    '<a class="button" href="#user-form">' +
    icon("plus") +
    " Add team member</a>";
  document.querySelector("#user-form").onsubmit = (event) => {
    event.preventDefault();
    task(event.submitter, async () => {
      await api("/users", {
        method: "POST",
        body: Object.fromEntries(new FormData(event.target)),
      });
      event.target.reset();
      await load();
      message("Team member created. Their account is ready to use.");
    });
  };
  await task(null, load);
}
