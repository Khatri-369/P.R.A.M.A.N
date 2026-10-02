import { shell } from "./auth.js";
import { api, task, message } from "./api.js";
import { icon } from "./ui.js";
if (await shell("upload")) {
  const form = document.querySelector("#upload-form"),
    input = form.elements.file,
    zone = document.querySelector(".upload-zone");
  zone.insertAdjacentHTML("afterbegin", icon("upload"));
  zone.querySelector("strong").textContent =
    "Drop your evidence file here, or browse";
  zone.insertAdjacentHTML(
    "beforeend",
    '<span class="selected-file" id="selected-file" role="status">No file selected</span>',
  );
  form.insertAdjacentHTML(
    "beforeend",
    '<div class="upload-status" id="upload-status" hidden role="status"><progress aria-label="Uploading evidence"></progress><span>Uploading evidence and recording its fingerprint…</span></div>',
  );
  function describeFile() {
    const file = input.files[0];
    document.querySelector("#selected-file").textContent = file
      ? file.name + " · " + (file.size / 1024).toFixed(1) + " KB"
      : "No file selected";
  }
  input.addEventListener("change", describeFile);
  for (const name of ["dragenter", "dragover"])
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      if (!input.disabled) zone.classList.add("drag-over");
    });
  for (const name of ["dragleave", "drop"])
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.remove("drag-over");
    });
  zone.addEventListener("drop", (event) => {
    if (input.disabled) return;
    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      message("Select one evidence file at a time.", true);
      return;
    }
    input.files = files;
    describeFile();
  });
  form.onsubmit = (event) => {
    event.preventDefault();
    task(event.submitter, async () => {
      const body = new FormData(form),
        file = body.get("file");
      if (!file?.size) throw new Error("Choose a non-empty evidence file.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Maximum file size is 10 MB.");
      const controls = [...form.querySelectorAll("input,textarea,select")];
      controls.forEach((el) => (el.disabled = true));
      form.setAttribute("aria-busy", "true");
      document.querySelector("#upload-status").hidden = false;
      try {
        const evidence = await api("/evidence", { method: "POST", body });
        location.href =
          "/evidence-details.html?id=" + evidence._id + "&uploaded=1";
      } finally {
        controls.forEach((el) => (el.disabled = false));
        form.removeAttribute("aria-busy");
        document.querySelector("#upload-status").hidden = true;
      }
    });
  };
}
