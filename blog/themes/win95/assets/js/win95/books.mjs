// Scoped to a single Explorer instance, including contents hydrated during navigation.
export function showBookPreview(context, item) {
  if (!context.list?.hasAttribute("data-book-list") || !item) return;
  const contents = context.list.closest(".explorer-contents");
  const preview = contents.querySelector("[data-book-preview]");
  const template = Array.from(contents.querySelectorAll("[data-book-preview-for]"))
    .find((candidate) => candidate.dataset.bookPreviewFor === item.dataset.fileId);
  if (!preview || !template) return;
  preview.replaceChildren(template.content.cloneNode(true));
  preview.scrollTop = 0;
  contents.querySelector("[data-book-selection-status]").textContent = `${item.dataset.name} selected`;
}

export function bindBookViews(context, setView, openReview) {
  const contents = context.list?.closest(".explorer-contents");
  if (contents?.querySelector("[data-book-preview]") && !contents.dataset.bookPreviewBound) {
    contents.dataset.bookPreviewBound = "true";
    contents.addEventListener("click", (event) => {
      const link = event.target.closest(".book-open-review");
      if (link) openReview(event, link);
    });
  }
  contents?.querySelectorAll("[data-book-view]").forEach((button) => {
    if (button.dataset.bookViewBound) return;
    button.dataset.bookViewBound = "true";
    button.addEventListener("click", () => setView(button.dataset.bookView));
  });
}

export function syncBookViews(context, view) {
  context.list?.closest(".explorer-contents")?.querySelectorAll("[data-book-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.bookView === view));
  });
}
