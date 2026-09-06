import assert from "node:assert/strict";
import test from "node:test";
import { bindSelectableItem, selectExclusive } from "../../blog/themes/win95/assets/js/win95/core/selection.mjs";

class Item extends EventTarget {
  dataset = {};
  selected = false;
  classList = { toggle: (name, value) => { if (name === "is-selected") this.selected = value; } };
  send(type, properties = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { detail: 1, ...properties });
    this.dispatchEvent(event);
    return event;
  }
}

function surface(compact = false) {
  const items = [new Item(), new Item()];
  const opened = [];
  items.forEach((item) => bindSelectableItem(item, {
    select: () => selectExclusive(items, item),
    open: () => opened.push(item),
    isCompact: () => compact
  }));
  return { items, opened };
}

test("desktop click selects; pointer movement cannot move or erase selection", () => {
  const { items: [first, second], opened } = surface();
  assert.equal(first.send("click").defaultPrevented, true);
  first.send("pointerleave");
  second.send("pointermove");
  assert.equal(first.selected, true);
  assert.equal(second.selected, false);
  assert.equal(opened.length, 0);
  second.send("click");
  assert.equal(first.selected, false);
  assert.equal(second.selected, true);
});

test("double-click opens once after the two selecting clicks", () => {
  const { items: [item], opened } = surface();
  item.send("click");
  item.send("click", { detail: 2 });
  item.send("dblclick", { detail: 2 });
  assert.deepEqual(opened, [item]);
});

test("Space selects without opening; Enter opens without a duplicate native click", () => {
  const { items: [item], opened } = surface();
  assert.equal(item.send("keydown", { key: " " }).defaultPrevented, true);
  assert.equal(item.selected, true);
  assert.equal(opened.length, 0);
  assert.equal(item.send("keydown", { key: "Enter" }).defaultPrevented, true);
  item.send("keydown", { key: "Enter", repeat: true });
  assert.deepEqual(opened, [item]);
});

test("selection and clearing are scoped to their own Explorer window", () => {
  const a = surface(), b = surface();
  a.items[0].send("click");
  b.items[1].send("click");
  selectExclusive(b.items, null);
  assert.equal(a.items[0].selected, true);
  assert.equal(b.items.some((item) => item.selected), false);
});

test("a drag's trailing click does not open or replace selection", () => {
  const { items: [first, second], opened } = surface(true);
  first.selected = true;
  second.dataset.wasDragged = "true";
  second.send("click");
  assert.equal(first.selected, true);
  assert.equal(second.selected, false);
  assert.equal(opened.length, 0);
  second.send("click");
  assert.deepEqual(opened, [second]);
});

test("compact mode opens on a single tap and ignores the extra dblclick event", () => {
  const { items: [item], opened } = surface(true);
  item.send("click");
  item.send("dblclick");
  assert.equal(item.selected, true);
  assert.deepEqual(opened, [item]);
});

test("assistive activation opens without requiring a pointer double-click", () => {
  const { items: [item], opened } = surface();
  item.send("click", { detail: 0 });
  assert.deepEqual(opened, [item]);
});
