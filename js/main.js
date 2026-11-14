const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
root.classList.add("js", reduced ? "static" : "scrub");

let film = null;
try {
  const { initFilm } = await import("./scene/film.js");
  film = await initFilm({ reduced });
} catch (err) {
  root.classList.remove("scrub", "static");
  root.classList.add("nogl");
}
if (!film) {
  root.classList.remove("scrub", "static");
  root.classList.add("nogl");
}

window.__hallway = { film, reduced };
