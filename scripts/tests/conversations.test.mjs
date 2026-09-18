import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse, parseFragment, serialize } from 'parse5';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const descendants = node => (node.childNodes || []).flatMap(child => [child, ...descendants(child)]);
const text = node => [node.value || '', ...(node.childNodes || []).map(text)].join('');
const byClass = (node, name) => descendants(node).filter(n => (n.attrs || []).some(a => a.name === 'class' && a.value.split(/\s+/).includes(name)));
const message = (body, args = 'role="ai"') => `{{< message ${args} >}}\n${body}\n{{< /message >}}`;
const conversation = body => `{{< conversation >}}\n${body}\n{{< /conversation >}}`;

test('conversations preserve Markdown, ordering, metadata, and complete feed content', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const content = path.join(temp, 'content');
  fs.cpSync(path.join(repo, 'blog/content'), content, { recursive: true });
  const fixture = path.join(content, 'post/conversation-fixture.md');
  const dest = path.join(temp, 'public');
  const write = body => fs.writeFileSync(fixture, `---\ntitle: Conversation fixture\nslug: conversation-fixture\ndate: 2026-01-15\n---\nBefore transcript.\n\n<!--more-->\n\n${body}\n\nAfter transcript.\n`);
  const build = () => spawnSync('hugo', ['--source', path.join(repo, 'blog'), '--contentDir', content, '--destination', dest, '--cleanDestinationDir'], {
    encoding: 'utf8', env: { ...process.env, HUGO_CACHEDIR: path.join(temp, 'cache') }
  });
  const read = route => fs.readFileSync(path.join(dest, route), 'utf8');
  write(`{{< conversation title="Example <b>title</b>" note="Edited <em>note</em>" >}}
${message('Be concise.', 'role="system"')}
${message('A **bold** question with a [link](https://example.com).', 'role="human" name="Michael <i>name</i>"')}
${message('First paragraph.\n\nSecond paragraph.\n\n- One\n- Two\n\n> A quote.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst answer = "<safe>";\n```\n\n<script>alert("blocked")</script>', 'role="ai" name="Assistant" model="model <b>version</b>"')}
${message('Consecutive AI turn.')}
{{< /conversation >}}

${conversation(message('Final turn.', 'role="human"'))}`);
  let result = build();
  assert.equal(result.status, 0, result.stderr);
  const full = parse(read('blog/conversation-fixture/index.html'));
  const fragment = parse(read('blog/conversation-fixture/window.html'));
  const figures = byClass(full, 'conversation');
  assert.equal(figures.length, 2);
  assert.deepEqual(figures.map(serialize), byClass(fragment, 'conversation').map(serialize));
  assert.deepEqual(byClass(full, 'conversation-speaker').map(n => text(n).trim()), [
    'System 01', 'Michael <i>name</i> Human · 02', 'Assistant AI · model <b>version</b> · 03', 'AI 04', 'Human 01'
  ]);
  assert.match(text(byClass(full, 'conversation-caption')[0]), /Example <b>title<\/b>/);
  assert.equal(descendants(figures[0]).filter(n => ['b', 'i', 'em', 'script'].includes(n.tagName)).length, 0, 'metadata is escaped and raw HTML policy is retained');
  const body = byClass(full, 'conversation-body')[2];
  for (const tag of ['p', 'ul', 'blockquote', 'table', 'pre', 'code']) {
    assert.ok(descendants(body).some(n => n.tagName === tag), `${tag} is rendered as Markdown`);
  }
  assert.ok(byClass(body, 'highlight').length, 'code uses Hugo syntax highlighting');
  assert.match(text(body), /const answer = "<safe>";/);
  assert.ok(descendants(figures[0]).some(n => n.tagName === 'a'));
  for (const route of ['rss.xml', 'blog/rss.xml', 'activity/rss.xml']) {
    const xml = read(route);
    const item = xml.match(/<item>\s*<title>Conversation fixture<\/title>[\s\S]*?<\/item>/)?.[0];
    assert.ok(item, `fixture in ${route}`);
    const encoded = item.match(/<description>([\s\S]*?)<\/description>/)[1];
    const decoded = text(parseFragment(encoded));
    const feed = parseFragment(decoded);
    assert.deepEqual(byClass(feed, 'conversation').map(serialize), figures.map(serialize), `complete transcript in ${route} after summary break`);
    assert.match(text(feed), /After transcript/);
  }
  for (const [body, error] of [
    [message('Orphan'), /message must be directly inside a conversation/],
    [conversation(message('Unknown', 'role="robot"')), /message requires role/],
    [conversation(message('Missing role', 'name="Michael"')), /message requires role/],
    [conversation(message('  ')), /message requires Markdown content/],
    [conversation(''), /conversation requires at least one message/],
    [conversation('Loose prose'), /conversation may only contain message shortcodes/],
    [conversation(conversation(message('Nested'))), /conversation must not be nested/],
    [conversation(message(message('Nested turn'))), /message must be directly inside a conversation/]
  ]) {
    write(body);
    result = build();
    assert.notEqual(result.status, 0, body);
    assert.match(result.stdout + result.stderr, error);
    assert.match(result.stdout + result.stderr, /conversation-fixture.md/, 'error identifies source');
  }
});
