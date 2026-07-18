import assert from "node:assert/strict";
import test from "node:test";

import { constrainWindowBounds } from "../../blog/themes/win95/assets/js/win95/core/geometry.mjs";
import {
  allocateExplorerInstanceId,
  createExplorerSession,
  createExplorerTreeState,
  isWindowContractCompatible,
  navigateExplorerSession,
  navigateExplorerWindow
} from "../../blog/themes/win95/assets/js/win95/core/explorer.mjs";
import { normalizePath, readExplorerRouteIndex, resolveExplorerWindowId } from "../../blog/themes/win95/assets/js/win95/core/routing.mjs";
import {
  isVisibleNonModalWindow,
  migrateOsState,
  resolveMaximizedRouteOwner
} from "../../blog/themes/win95/assets/js/win95/core/state.mjs";
import {
  buildMonthCalendar,
  formatDialogTime,
  formatNewZealandTaskbarTime,
  getClockHandAngles,
  getMonthName,
  getNewZealandDateTime
} from "../../blog/themes/win95/assets/js/win95/core/time.mjs";

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

  assert.equal(state.version, 5);
  assert.equal(state.windows["explorer-blog"], undefined);
  assert.equal(state.windows["explorer-notes"], undefined);
  assert.deepEqual(state.windows["explorer-window-1"], {
    id: "explorer-window-1",
    url: "/notes/",
    state: "normal",
    contentWindowId: "explorer-notes"
  });
  assert.deepEqual(state.explorers["explorer-window-1"], {
    view: "icons",
    sort: "date",
    icons: {},
    tree: { expanded: {} },
    location: "/notes/",
    history: ["/notes/"],
    historyIndex: 0
  });
  assert.deepEqual(state.taskbarOrder, ["explorer-window-1"]);
  assert.equal(state.activeWindowId, "explorer-window-1");
});

test("leaves current state versions unchanged", () => {
  const state = { version: 5, windows: {}, explorers: {}, taskbarOrder: [] };
  assert.equal(migrateOsState(state), state);
});

test("migrates each open folder window to an independent explorer instance", () => {
  const state = {
    version: 4,
    windows: {
      "explorer-post": { id: "explorer-post", url: "/blog/", state: "normal" },
      "explorer-photos": { id: "explorer-photos", url: "/photos/", state: "maximized" },
      "document-example": { id: "document-example", url: "/example/", state: "normal" }
    },
    explorers: {
      "explorer-post": { view: "details" },
      "explorer-photos": { view: "icons" }
    },
    explorerTree: { expanded: { "site-drive": true } },
    taskbarOrder: ["explorer-photos", "document-example", "explorer-post"],
    activeWindowId: "explorer-photos"
  };

  migrateOsState(state, {
    routeIndex: { "/blog/": "explorer-post", "/photos/": "explorer-photos" }
  });

  assert.deepEqual(Object.keys(state.windows).sort(), [
    "document-example",
    "explorer-window-1",
    "explorer-window-2"
  ]);
  assert.equal(state.windows["explorer-window-1"].url, "/photos/");
  assert.equal(state.windows["explorer-window-2"].url, "/blog/");
  assert.deepEqual(state.taskbarOrder, ["explorer-window-1", "document-example", "explorer-window-2"]);
  assert.equal(state.activeWindowId, "explorer-window-1");
  assert.deepEqual(state.explorers["explorer-window-1"].tree.expanded, { "site-drive": true });
  assert.deepEqual(state.explorers["explorer-window-2"].tree.expanded, { "site-drive": true });
  assert.equal(state.explorerTree, undefined);
});

test("normalizes the shared explorer tree state shape", () => {
  assert.deepEqual(createExplorerTreeState({ expanded: { desktop: true } }, 2), {
    expanded: { desktop: true },
    version: 2
  });
  assert.deepEqual(createExplorerTreeState({ expanded: null }, 2), {
    expanded: {},
    version: 2
  });
});

test("records folder history in one explorer session", () => {
  const initial = createExplorerSession({ view: "icons" }, "/posts/");
  const navigated = navigateExplorerSession(initial, "/photos/");

  assert.equal(navigated.view, "icons");
  assert.equal(navigated.location, "/photos/");
  assert.deepEqual(navigated.history, ["/posts/", "/photos/"]);
  assert.equal(navigated.historyIndex, 1);
  assert.deepEqual(navigated.tree, { expanded: {} });
});

test("allocates explorer window identities independently from folder routes", () => {
  assert.equal(allocateExplorerInstanceId([]), "explorer-window-1");
  assert.equal(
    allocateExplorerInstanceId(["explorer-window-1", "explorer-window-2", "explorer-photos"]),
    "explorer-window-3"
  );
});

test("folder navigation preserves the explorer window instance", () => {
  const source = {
    id: "explorer-posts",
    url: "/posts/",
    state: "normal",
    x: 118,
    y: 52,
    width: 760,
    height: 520,
    restoreBounds: { x: 118, y: 52, width: 760, height: 520 },
    z: 10
  };
  const target = { id: "explorer-photos", url: "/photos/", title: "Photos" };
  const navigated = navigateExplorerWindow(source, target, {
    instanceId: "explorer-posts",
    contentWindowId: "explorer-photos",
    z: 11
  });

  assert.equal(navigated.id, "explorer-posts");
  assert.equal(navigated.contentWindowId, "explorer-photos");
  assert.equal(navigated.url, "/photos/");
  assert.equal(navigated.title, "Photos");
  assert.equal(navigated.state, "normal");
  assert.deepEqual(navigated.restoreBounds, source.restoreBounds);
});

test("requires window fragments to match the active shell contract", () => {
  assert.equal(isWindowContractCompatible("2", "2"), true);
  assert.equal(isWindowContractCompatible(2, "2"), true);
  assert.equal(isWindowContractCompatible("2", "1"), false);
  assert.equal(isWindowContractCompatible("2", undefined), false);
});

test("does not treat a missing window as a visible route owner", () => {
  assert.equal(isVisibleNonModalWindow(undefined), false);
  assert.equal(isVisibleNonModalWindow(null), false);
  assert.equal(isVisibleNonModalWindow({ state: "minimized", windowKind: "normal" }), false);
  assert.equal(isVisibleNonModalWindow({ state: "normal", windowKind: "modal" }), false);
  assert.equal(isVisibleNonModalWindow({ state: "maximized", windowKind: "normal" }), true);
});

test("keeps URL ownership with an eligible maximized window", () => {
  const windows = {
    normal: { id: "normal", state: "normal", z: 30 },
    first: { id: "first", state: "maximized", z: 10 },
    second: { id: "second", state: "maximized", z: 20 },
    minimized: { id: "minimized", state: "minimized", z: 40 }
  };

  assert.equal(resolveMaximizedRouteOwner(windows, "first", "normal")?.id, "first");
  assert.equal(resolveMaximizedRouteOwner(windows, null, "first")?.id, "first");
  assert.equal(resolveMaximizedRouteOwner(windows, null, "normal")?.id, "second");
  assert.equal(resolveMaximizedRouteOwner({ normal: windows.normal }, null, "normal"), null);
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

test("New Zealand time is independent of the runtime timezone", () => {
  const winter = new Date("2026-07-14T12:05:09Z");
  const summer = new Date("2026-01-01T10:05:09Z");

  assert.deepEqual(getNewZealandDateTime(winter), {
    year: 2026,
    month: 7,
    day: 15,
    hour: 0,
    minute: 5,
    second: 9
  });
  assert.deepEqual(getNewZealandDateTime(summer), {
    year: 2026,
    month: 1,
    day: 1,
    hour: 23,
    minute: 5,
    second: 9
  });
  assert.equal(formatNewZealandTaskbarTime(winter), "12:05 AM");
  assert.equal(formatDialogTime(getNewZealandDateTime(winter)), "00:05:09");
});

test("calendar helpers build a Sunday-first month and clock angles", () => {
  const february = buildMonthCalendar(2024, 2);

  assert.equal(getMonthName(2), "February");
  assert.equal(february.indexOf(1), 4);
  assert.equal(february.filter(Boolean).length, 29);
  assert.deepEqual(getClockHandAngles({ hour: 3, minute: 30, second: 30 }), {
    hour: 105.25,
    minute: 183,
    second: 180
  });
});
