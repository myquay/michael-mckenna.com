import assert from "node:assert/strict";
import test from "node:test";

import { constrainWindowBounds } from "../../blog/themes/win95/assets/js/win95/core/geometry.mjs";
import { normalizePath, readExplorerRouteIndex, resolveExplorerWindowId } from "../../blog/themes/win95/assets/js/win95/core/routing.mjs";
import {
  isVisibleNonModalWindow,
  migrateOsState
} from "../../blog/themes/win95/assets/js/win95/core/state.mjs";

test("normalizes route paths consistently", () => {
  assert.equal(normalizePath(""), "/");
  assert.equal(normalizePath("/notes"), "/notes/");
  assert.equal(normalizePath("/notes/"), "/notes/");
});

test("resolves explorer window ids from Hugo-provided routes", () => {
  const routes = { "/notes/": "explorer-notes" };

  assert.equal(resolveExplorerWindowId("/notes", routes), "explorer-notes");
  assert.equal(resolveExplorerWindowId("/missing", routes), null);
  assert.equal(resolveExplorerWindowId("not a valid url", routes, "not a valid base"), null);
});

test("reads the rendered Hugo route index", () => {
  const root = {
    querySelectorAll: () => [
      { dataset: { explorerRoute: "/blog", explorerWindowId: "explorer-blog" } },
      { dataset: { explorerRoute: "/notes/", explorerWindowId: "explorer-notes" } }
    ]
  };

  assert.deepEqual(readExplorerRouteIndex(root), {
    "/blog/": "explorer-blog",
    "/notes/": "explorer-notes"
  });
});

test("migrates the legacy shared explorer window without losing state", () => {
  const state = {
    version: 2,
    windows: {
      "explorer-blog": { id: "explorer-blog", url: "/notes/", state: "normal" }
    },
    explorers: {
      "explorer-blog": { view: "icons" }
    },
    taskbarOrder: ["explorer-blog", "explorer-blog"],
    activeWindowId: "explorer-blog"
  };

  migrateOsState(state, { routeIndex: { "/notes/": "explorer-notes" } });

  assert.equal(state.version, 3);
  assert.equal(state.windows["explorer-blog"], undefined);
  assert.deepEqual(state.windows["explorer-notes"], {
    id: "explorer-notes",
    url: "/notes/",
    state: "normal"
  });
  assert.deepEqual(state.explorers["explorer-notes"], { view: "icons" });
  assert.deepEqual(state.taskbarOrder, ["explorer-notes"]);
  assert.equal(state.activeWindowId, "explorer-notes");
});

test("leaves current state versions unchanged", () => {
  const state = { version: 3, windows: {}, explorers: {}, taskbarOrder: [] };
  assert.equal(migrateOsState(state), state);
});

test("does not treat a missing window as a visible route owner", () => {
  assert.equal(isVisibleNonModalWindow(undefined), false);
  assert.equal(isVisibleNonModalWindow(null), false);
  assert.equal(isVisibleNonModalWindow({ state: "minimized", windowKind: "normal" }), false);
  assert.equal(isVisibleNonModalWindow({ state: "normal", windowKind: "modal" }), false);
  assert.equal(isVisibleNonModalWindow({ state: "maximized", windowKind: "normal" }), true);
});

test("constrains window size and position to the viewport", () => {
  assert.deepEqual(constrainWindowBounds({
    bounds: { x: 900, y: -20, width: 900, height: 700 },
    minimums: { width: 280, height: 180 },
    viewport: { width: 800, height: 600 },
    sizeMargin: 16
  }), {
    x: 16,
    y: 0,
    width: 784,
    height: 584
  });
});
