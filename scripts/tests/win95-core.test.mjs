import assert from "node:assert/strict";
import test from "node:test";

import { constrainWindowBounds } from "../../blog/themes/win95/assets/js/win95/core/geometry.mjs";
import {
  createExplorerSession,
  createExplorerTreeState,
  isWindowContractCompatible,
  navigateExplorerSession,
  navigateExplorerWindow
} from "../../blog/themes/win95/assets/js/win95/core/explorer.mjs";
import { normalizePath, readExplorerRouteIndex, resolveExplorerWindowId } from "../../blog/themes/win95/assets/js/win95/core/routing.mjs";
import {
  isVisibleNonModalWindow,
  migrateOsState
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

  assert.equal(state.version, 4);
  assert.equal(state.windows["explorer-blog"], undefined);
  assert.deepEqual(state.windows["explorer-notes"], {
    id: "explorer-notes",
    url: "/notes/",
    state: "normal",
    contentWindowId: "explorer-notes"
  });
  assert.deepEqual(state.explorers["explorer-notes"], {
    view: "icons",
    sort: "date",
    icons: {},
    location: "/notes/",
    history: ["/notes/"],
    historyIndex: 0
  });
  assert.deepEqual(state.taskbarOrder, ["explorer-notes"]);
  assert.equal(state.activeWindowId, "explorer-notes");
});

test("leaves current state versions unchanged", () => {
  const state = { version: 4, windows: {}, explorers: {}, taskbarOrder: [] };
  assert.equal(migrateOsState(state), state);
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
