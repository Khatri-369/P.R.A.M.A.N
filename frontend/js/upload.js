import { shell } from "./auth.js";
import { api, task } from "./api.js";
if (await shell("upload"))
  document.querySelector("#upload-form").onsubmit = (event) => {
    event.preventDefault();
    task(event.submitter, async () => {
      const form = new FormData(event.target),
        file = form.get("file");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Maximum file size is 10 MB.");
      const evidence = await api("/evidence", { method: "POST", body: form });
      location.href = `/evidence-details.html?id=${evidence._id}&uploaded=1`;
    });
  };
