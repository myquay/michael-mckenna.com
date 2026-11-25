import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse, serialize } from 'parse5';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const attrs = node => Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
const hasClass = (node, name) => (attrs(node).class || '').split(/\s+/).includes(name);
const descendants = node => (node.childNodes || []).flatMap(child => [child, ...descendants(child)]);
const find = (node, name) => descendants(node).find(child => hasClass(child, name));
const text = node => [node.value || '', ...(node.childNodes || []).map(text)].join('');

test('book review content, window fragments, feeds, drafts and validation', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'book-review-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const content = path.join(temp, 'content');
  for (const section of ['books', 'activity']) {
    const index = path.join(section, '_index.md');
    fs.cpSync(path.join(repo, 'blog/content', index), path.join(content, index));
  }
  const bundle = path.join(content, 'books/fixture');
  fs.mkdirSync(bundle, { recursive: true });
  fs.copyFileSync(path.join(repo, 'blog/archetypes/book-review/cover.svg'), path.join(bundle, 'cover.svg'));
  const writeReview = (rating = 4, author = 'A. Writer', draft = false) => fs.writeFileSync(path.join(bundle, 'index.md'), `---
title: A sample review
date: 2025-01-15T12:00:00Z
type: book-review
draft: ${draft}
rating: ${JSON.stringify(rating)}
book:
  title: The Sample Book
  author: ${JSON.stringify(author)}
  cover: cover.svg
  url: https://example.org/book
---
A considered review with **formatted text**.
`);
  const dest = path.join(temp, 'public');
  const build = () => spawnSync('hugo', ['--source', path.join(repo, 'blog'), '--contentDir', content, '--destination', dest, '--cleanDestinationDir'], {
    encoding: 'utf8', env: { ...process.env, HUGO_CACHEDIR: path.join(temp, 'cache') }
  });
  writeReview();
  let result = build();
  assert.equal(result.status, 0, result.stderr);
  const read = route => fs.readFileSync(path.join(dest, route), 'utf8');
  const full = parse(read('books/fixture/index.html'));
  const fragment = parse(read('books/fixture/window.html'));
  const review = find(full, 'h-review');
  assert.ok(review && hasClass(review, 'h-entry'));
  assert.equal(serialize(review), serialize(find(fragment, 'h-review')), 'both outputs share review markup');
  assert.equal(attrs(find(review, 'p-rating')).value, '4');
  assert.equal(attrs(find(review, 'p-best')).value, '5');
  assert.equal(attrs(find(review, 'p-worst')).value, '1');
  const book = find(review, 'p-item');
  assert.ok(hasClass(book, 'h-cite') && hasClass(book, 'h-item'));
  assert.equal(text(find(book, 'p-name')), 'The Sample Book');
  assert.equal(text(find(book, 'p-author')), 'A. Writer');
  assert.equal(attrs(find(book, 'u-photo')).src, 'https://michael-mckenna.com/books/fixture/cover.svg');
  assert.ok(fs.existsSync(path.join(dest, 'books/fixture/cover.svg')));
  assert.ok(hasClass(find(review, 'p-author'), 'h-card'), 'review author is distinct from book author');
  assert.match(text(find(review, 'e-content')), /A considered review/);
  assert.match(read('books/index.html'), /data-book-preview-for=/);
  assert.match(read('books/window.html'), /data-book-list/);
  assert.match(read('books/rss.xml'), /A considered review/);
  assert.match(read('books/rss.xml'), /p-rating/);
  assert.match(read('books/fixture/index.html'), /rel="webmention"/);
  assert.match(read('index.html'), /data-shortcut-id="books"/);
  assert.match(read('rss.xml'), /A sample review/);
  assert.match(read('activity/rss.xml'), /A sample review/);

  writeReview(4, 'A. Writer', true);
  result = build();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!fs.existsSync(path.join(dest, 'books/fixture/index.html')));
  assert.doesNotMatch(read('books/rss.xml'), /A sample review/);
  assert.match(read('books/index.html'), /No book reviews yet/);

  for (const rating of [0, 6, 2.5, '5']) {
    writeReview(rating);
    result = build();
    assert.notEqual(result.status, 0, `rating ${JSON.stringify(rating)} must fail`);
    assert.match(result.stderr + result.stdout, /rating from 1 to 5/);
  }
  writeReview(4, '');
  result = build();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /requires book.title, book.author, book.cover and review text/);
});
