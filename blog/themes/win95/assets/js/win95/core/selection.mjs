// One selection per surface; selecting a file must not clear another window's selection.
export function selectExclusive(items, selected) {
  items.forEach((item) => item.classList.toggle("is-selected", item === selected));
}

export function bindSelectableItem(item, { select, open, isCompact }) {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    if (item.dataset.wasDragged === "true") {
      item.dataset.wasDragged = "false";
      event.stopImmediatePropagation();
      return;
    }
    select();
    // detail=0 also supports assistive technology's synthetic activation.
    if (isCompact() || event.detail === 0) open(event);
  });

  item.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (!isCompact()) open(event);
  });

  item.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    // Suppress the native button/link click so Enter opens once and Space only selects.
    event.preventDefault();
    if (event.repeat) return;
    select();
    if (event.key === "Enter") open(event);
  });
}
