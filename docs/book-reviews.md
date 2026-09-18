# Book reviews

`/books/` is a Windows 95 Explorer folder with cover thumbnails, a Details view, and a reading pane. Click a cover to select it; double-click or press Enter to open the full review in a document window. Space selects a book without opening it. On phones, tapping opens the review directly. The toolbar and View menu reuse the existing Explorer view preferences. Narrow windows stack the reading pane below the shelf.

Create a draft page bundle from the repository root:

```sh
hugo new content --source blog --kind book-review books/my-book
```

Edit `blog/content/books/my-book/index.md` and replace its placeholder cover. Required fields are `type: book-review`, `book.title`, `book.author`, `book.cover`, and an integer `rating` from 1 to 5. The Markdown body contains your review. `title` names the review, while `book.title` names the book.

```yaml
---
title: "Example Book — review"
date: 2026-09-18T12:00:00+12:00
type: book-review
draft: true
rating: 4
book:
  title: "Example Book"
  author: "Example Author"
  url: "https://example.org/book"
  isbn: ""
  cover: "cover.jpg"
  cover_alt: "Cover of Example Book by Example Author"
date_read: 2026-09-17
---

Your review goes here.

<!--more-->

Optional longer discussion goes here.
```

`book.url`, `book.isbn`, `book.cover_alt`, and `date_read` are optional. Keep ISBNs quoted. `date` is the review's publication date; `date_read` is when you finished the book. `book.cover` can be a file in the page bundle, a root-relative static asset path, or an HTTPS image URL. Bundle covers locally for reliability. Cover images keep their original aspect ratio, and their alt text and the adjacent book title remain available if an image cannot load.

The reading pane uses Hugo's summary; add `<!--more-->` to choose where it ends. Set `draft: false` when the review and cover are ready. Preview drafts with `hugo server --source blog --buildDrafts`. The archetype is the only sample: no fictional reading history is published.

Full pages and their `window.html` fragments share the same `h-entry h-review` article. Book metadata is scoped to `p-item h-item h-cite`; the cover is `u-photo`, the book name is `p-name`, and the book author is its nested `p-author`. The outer review supplies its own name, reviewer (`p-author h-card`), canonical URL (`u-url`), publication time (`dt-published`), numeric `p-rating`, explicit `p-best`/`p-worst`, and `e-content` review body. The cover property belongs to `h-item`; it is an extension on `h-cite`.

Reviews appear in the Books RSS feed at `/books/rss.xml`, the default site feed, and the activity stream, and expose the existing Webmention endpoint. The Books feed includes cover, rating and full review. Browser microformats support does not add a book-review editor to LittlePublisher's Micropub backend; creation through that service requires a separate integration.

References: [IndieWeb reviews](https://indieweb.org/review), [h-review](https://microformats.org/wiki/h-review), [h-item](https://microformats.org/wiki/h-item), [h-cite](https://microformats.org/wiki/h-cite).
