// Effects are presentation-only; records and controls remain in the normal DOM.
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(pointer: fine)");
const registered = new WeakSet();
const lazy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        lazy.unobserve(entry.target);
        import("./core-scene.js")
          .then(({ mountCore }) => mountCore(entry.target))
          .catch(() => {});
      }
  },
  { rootMargin: "80px" },
);
function enhance() {
  const banner = document.querySelector("#overview-banner");
  if (banner?.children.length && !banner.querySelector(".core-visual")) {
    const host = document.createElement("div");
    host.className = "core-visual";
    banner.append(host);
  }
  document.querySelectorAll(".evidence-orbit,.core-visual").forEach((host) => {
    if (registered.has(host)) return;
    registered.add(host);
    lazy.observe(host);
  });
  document.querySelectorAll(".stat").forEach((card) => {
    if (registered.has(card)) return;
    registered.add(card);
    let frame = 0;
    card.addEventListener("pointermove", (event) => {
      if (reduced.matches || !fine.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect(),
          x = (event.clientX - box.left) / box.width,
          y = (event.clientY - box.top) / box.height;
        card.style.setProperty("--tilt-x", `${(y - 0.5) * -3}deg`);
        card.style.setProperty("--tilt-y", `${(x - 0.5) * 3}deg`);
        card.style.setProperty("--light-x", `${x * 100}%`);
        card.style.setProperty("--light-y", `${y * 100}%`);
      });
    });
    card.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  });
}
enhance();
const changes = new MutationObserver(enhance);
changes.observe(document.body, { childList: true, subtree: true });
let scrollFrame = 0;
window.addEventListener(
  "scroll",
  () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      document
        .querySelector(".topbar")
        ?.classList.toggle("is-scrolled", scrollY > 12);
      scrollFrame = 0;
    });
  },
  { passive: true },
);
