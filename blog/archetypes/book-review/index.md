---
title: "{{ replace .Name "-" " " | title }} — review"
date: {{ .Date }}
type: book-review
draft: true
rating: 5
book:
  title: "{{ replace .Name "-" " " | title }}"
  author: "Book author"
  url: ""
  isbn: ""
  cover: "cover.svg"
  cover_alt: "Placeholder cover — replace with the book cover"
---

Replace this text with your review, update the book details and rating, and replace the placeholder cover before publishing.
