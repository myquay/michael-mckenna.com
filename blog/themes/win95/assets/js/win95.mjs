import { clamp, constrainWindowBounds } from "./win95/core/geometry.mjs";
import { normalizePath, readExplorerRouteIndex, resolveExplorerWindowId } from "./win95/core/routing.mjs";
import { migrateOsState as migrateStoredOsState } from "./win95/core/state.mjs";

  const desktop = document.getElementById("desktop");
  let shortcuts = Array.from(document.querySelectorAll(".desktop-shortcut"));
  const startButton = document.getElementById("start-button");
  const startMenu = document.getElementById("start-menu");
  const trayTime = document.getElementById("tray-time");
  let rssSetupWindow = document.getElementById("rss-setup-window");
  let rssSetupClose = document.getElementById("rss-setup-close");
  let rssSetupBack = document.getElementById("rss-setup-back");
  let rssSetupNext = document.getElementById("rss-setup-next");
  let rssSetupCancel = document.getElementById("rss-setup-cancel");
  let feedUrlList = document.getElementById("feed-url-list");
  let feedChoices = Array.from(document.querySelectorAll("[data-feed-choice]"));
  let wizardSteps = Array.from(document.querySelectorAll("[data-wizard-step]"));
  const aboutWindow = document.getElementById("about-window");
  const startAboutButtons = Array.from(document.querySelectorAll("[data-start-action='about']"));
  const appWindows = Array.from(document.querySelectorAll("[data-window-id]"));
  const modalWindows = Array.from(document.querySelectorAll("[data-modal-window]"));
  const taskbarApps = document.getElementById("taskbar-apps");
  const createExplorerContext = (list) => {
    const windowEl = list.closest("[data-window-id]");
    const menu = windowEl?.querySelector("[data-view-menu]");

    return {
      list,
      windowEl,
      tree: windowEl?.querySelector("[data-explorer-tree]"),
      fileItems: Array.from(list.querySelectorAll("[data-file-item]")),
      viewMenuButton: windowEl?.querySelector("[data-view-menu-button]"),
      viewMenu: menu,
      viewOptionButtons: Array.from(menu?.querySelectorAll("[data-view-option]") || []),
      arrangeIconButtons: Array.from(menu?.querySelectorAll("[data-arrange-icons]") || []),
      lineUpIconsButton: menu?.querySelector("[data-line-up-icons]")
    };
  };
  const explorerContexts = Array.from(document.querySelectorAll("[data-explorer-list]")).map(createExplorerContext);
  const osStorageKey = "michael95.osState";
  const legacyShortcutStorageKey = "michael95.win95Theme.shortcutPositions";
  const compactModeQuery = window.matchMedia("(max-width: 700px), (max-height: 500px) and (max-width: 900px)");
  const isCompactMode = () => compactModeQuery.matches;
  const taskbarHeight = () => document.querySelector(".taskbar")?.offsetHeight || 30;
  const dragThreshold = 4;
  const desktopUrl = "/";
  const modalWindowKind = "modal";
  const defaultCapabilities = {
    move: true,
    minimize: true,
    maximize: true,
    close: true,
    fixedSize: false,
    taskbar: true
  };
  // Content applications register from the current DOM or fetched WINDOW
  // fragments, avoiding a second hand-maintained catalogue in JavaScript.
  const applications = {};
  let osState = {
    version: 3,
    shortcuts: {},
    windows: {},
    explorers: {},
    modals: {},
    taskbarOrder: [],
    activeWindowId: null
  };
  let activeDrag = null;
  let activeFileDrag = null;
  let activeWindowDrag = null;
  let activeWindowResize = null;
  let activeModalDrag = null;
  let directModalRouteId = document.body?.dataset.pageWindowKind === modalWindowKind
    ? document.body?.dataset.pageWindowId || null
    : null;
  let overlayRouteOwnerId = null;
  let latestWindowActivation = 0;
  let wizardStep = 0;

  const explorerWindowIdsByPath = readExplorerRouteIndex(document);
  const explorerWindowIdForUrl = (url) => resolveExplorerWindowId(
    url,
    explorerWindowIdsByPath,
    window.location.origin
  );

  const migrateOsState = () => {
    osState = migrateStoredOsState(osState, {
      routeIndex: explorerWindowIdsByPath,
      baseUrl: window.location.origin
    });
  };

  const isDesktopPath = () => normalizePath(window.location.pathname) === desktopUrl;
  const isModalApplication = (app) => app?.windowKind === modalWindowKind;

  const loadOsState = () => {
    try {
      osState = { ...osState, ...(JSON.parse(window.localStorage.getItem(osStorageKey) || "{}") || {}) };
    } catch {
      osState = { version: 3, shortcuts: {}, windows: {}, explorers: {}, modals: {}, taskbarOrder: [], activeWindowId: null };
    }

    if (!osState.shortcuts) {
      osState.shortcuts = {};
    }

    if (!osState.windows) {
      osState.windows = {};
    }

    if (!osState.explorers) {
      osState.explorers = {};
    }

    if (!osState.modals) {
      osState.modals = {};
    }

    if (!Array.isArray(osState.taskbarOrder)) {
      osState.taskbarOrder = Object.keys(osState.windows);
    }

    migrateOsState();

    try {
      const legacyShortcuts = JSON.parse(window.localStorage.getItem(legacyShortcutStorageKey) || "{}") || {};
      osState.shortcuts = { ...legacyShortcuts, ...osState.shortcuts };
    } catch {
      // Ignore legacy shortcut state if it was edited by hand.
    }

    Object.keys(osState.windows).forEach((appId) => {
      if (isModalApplication(applications[appId])) {
        delete osState.windows[appId];
      }
    });
    osState.taskbarOrder = osState.taskbarOrder.filter((appId) => !isModalApplication(applications[appId]));
  };

  const saveOsState = () => {
    const persistedWindows = Object.fromEntries(Object.entries(osState.windows)
      .filter(([, item]) => !isModalApplication(item)));
    const nextState = {
      ...osState,
      version: 3,
      windows: persistedWindows,
      activeWindowId: isModalApplication(osState.windows[osState.activeWindowId]) ? null : osState.activeWindowId
    };

    window.localStorage.setItem(osStorageKey, JSON.stringify(nextState));
  };

  const rememberTaskbarOrder = (appId) => {
    if (!appId || isModalApplication(applications[appId]) || osState.taskbarOrder.includes(appId)) {
      return false;
    }

    osState.taskbarOrder.push(appId);
    return true;
  };

  const taskbarSortIndex = (appId) => {
    const index = osState.taskbarOrder.indexOf(appId);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  const explorerId = (context) => context?.windowEl?.dataset.windowId || "explorer-blog";

  const ensureExplorerState = (context) => {
    const id = explorerId(context);
    osState.explorers[id] = {
      view: context?.list?.dataset.view || "details",
      sort: context?.list?.dataset.sort || "date",
      icons: {},
      tree: { expanded: {} },
      ...osState.explorers[id]
    };

    if (!osState.explorers[id].icons) {
      osState.explorers[id].icons = {};
    }

    if (!osState.explorers[id].tree) {
      osState.explorers[id].tree = { expanded: {} };
    }

    if (!osState.explorers[id].tree.expanded) {
      osState.explorers[id].tree.expanded = {};
    }

    return osState.explorers[id];
  };

  const readWindowMetadata = (appWindow) => {
    if (!appWindow?.dataset.windowId) {
      return null;
    }

    const appId = appWindow.dataset.windowId;
    const windowKind = appWindow.dataset.windowKind || applications[appId]?.windowKind || "normal";
    const modalCapabilities = windowKind === modalWindowKind
      ? { minimize: false, maximize: false, fixedSize: true, taskbar: false }
      : {};

    return {
      id: appId,
      title: appWindow.dataset.windowTitle || applications[appId]?.title || appId,
      url: normalizePath(appWindow.dataset.windowUrl || applications[appId]?.url || window.location.pathname),
      icon: appWindow.dataset.windowIcon || applications[appId]?.icon || "/images/win95-icons/w95_16.ico",
      defaultX: Number(appWindow.dataset.windowDefaultX || applications[appId]?.defaultX || 90),
      defaultY: Number(appWindow.dataset.windowDefaultY || applications[appId]?.defaultY || 52),
      defaultWidth: Number(appWindow.dataset.windowDefaultWidth || applications[appId]?.defaultWidth || 640),
      defaultHeight: Number(appWindow.dataset.windowDefaultHeight || applications[appId]?.defaultHeight || 420),
      minWidth: Number(appWindow.dataset.windowMinWidth || applications[appId]?.minWidth || 280),
      minHeight: Number(appWindow.dataset.windowMinHeight || applications[appId]?.minHeight || 180),
      windowKind,
      capabilities: {
        ...defaultCapabilities,
        ...(applications[appId]?.capabilities || {}),
        ...modalCapabilities,
        fixedSize: windowKind === modalWindowKind || appWindow.dataset.windowFixedSize === "true",
        taskbar: windowKind !== modalWindowKind && appWindow.dataset.windowTaskbar !== "false"
      }
    };
  };

  const registerDomWindows = () => {
    appWindows.forEach((appWindow) => {
      const app = readWindowMetadata(appWindow);

      if (app) {
        applications[app.id] = { ...applications[app.id], ...app };
      }
    });
  };

  const viewportBounds = () => ({
    width: Math.max(320, window.innerWidth),
    height: Math.max(240, window.innerHeight - taskbarHeight())
  });

  const defaultWindowBounds = (appId) => {
    const app = applications[appId];

    if (isCompactMode()) {
      return {
        x: Math.round(app?.defaultX || 90),
        y: Math.round(app?.defaultY || 52),
        width: Math.round(app?.defaultWidth || 640),
        height: Math.round(app?.defaultHeight || 420)
      };
    }

    return constrainWindowBounds({
      bounds: {
        x: app?.defaultX || 90,
        y: app?.defaultY || 52,
        width: app?.defaultWidth || 640,
        height: app?.defaultHeight || 420
      },
      minimums: { width: app?.minWidth || 280, height: app?.minHeight || 180 },
      viewport: viewportBounds(),
      sizeMargin: 16
    });
  };

  const clampWindowBounds = (appId, bounds) => {
    const app = applications[appId];

    if (isCompactMode()) {
      return {
        x: Math.round(bounds.x ?? app?.defaultX ?? 90),
        y: Math.round(bounds.y ?? app?.defaultY ?? 52),
        width: Math.round(bounds.width ?? app?.defaultWidth ?? 640),
        height: Math.round(bounds.height ?? app?.defaultHeight ?? 420)
      };
    }

    return constrainWindowBounds({
      bounds,
      defaults: {
        x: 0,
        y: 0,
        width: app?.defaultWidth || 640,
        height: app?.defaultHeight || 420
      },
      minimums: { width: app?.minWidth || 280, height: app?.minHeight || 180 },
      viewport: viewportBounds()
    });
  };

  const clampModalPosition = (modal, x, y) => {
    const viewport = viewportBounds();
    const width = modal.offsetWidth || 320;
    const height = modal.offsetHeight || 180;
    const nextX = Math.round(clamp(x, 0, Math.max(0, viewport.width - Math.min(80, width))));
    const nextY = Math.round(clamp(y, 0, Math.max(0, viewport.height - Math.min(24, height))));

    return { x: nextX, y: nextY };
  };

  const setModalPosition = (modal, position) => {
    if (!modal || !position) {
      return;
    }

    const next = clampModalPosition(modal, position.x, position.y);
    modal.classList.add("is-positioned");
    modal.style.left = `${next.x}px`;
    modal.style.top = `${next.y}px`;
    modal.style.transform = "none";
  };

  const focusModal = (modal) => {
    if (!modal?.dataset.modalWindow) {
      return;
    }

    const id = modal.dataset.modalWindow;
    osState.modals[id] = {
      ...osState.modals[id],
      z: Date.now()
    };

    modalWindows.forEach((item) => item.classList.toggle("is-active", item === modal));
    modal.style.zIndex = String(1000 + modalWindows
      .filter((item) => item.classList.contains("is-open"))
      .sort((a, b) => ((osState.modals[a.dataset.modalWindow]?.z || 0) - (osState.modals[b.dataset.modalWindow]?.z || 0)))
      .findIndex((item) => item === modal) + modalWindows.length);
    saveOsState();
  };

  const applyModalState = () => {
    modalWindows.forEach((modal) => {
      const id = modal.dataset.modalWindow;
      const item = osState.modals[id];

      if (item?.position) {
        setModalPosition(modal, item.position);
      }

      if (item?.z && modal.classList.contains("is-open")) {
        modal.style.zIndex = String(1000 + Math.min(99, item.z % 100));
      }
    });
  };

  const ensureWindowState = (appId, state = "maximized") => {
    const app = applications[appId];

    if (!app) {
      return null;
    }

    const existing = osState.windows[appId] || {};
    const defaults = defaultWindowBounds(appId);
    const bounds = clampWindowBounds(appId, {
      x: existing.x ?? defaults.x,
      y: existing.y ?? defaults.y,
      width: existing.width ?? defaults.width,
      height: existing.height ?? defaults.height
    });
    const nextState = isModalApplication(app) ? "normal" : state || existing.state || "normal";

    osState.windows[appId] = {
      ...existing,
      ...app,
      capabilities: { ...defaultCapabilities, ...(app.capabilities || {}) },
      ...bounds,
      state: nextState,
      previousState: existing.previousState || "normal",
      restoreBounds: existing.restoreBounds || bounds,
      z: existing.z || Date.now()
    };

    rememberTaskbarOrder(appId);

    if (nextState !== "minimized") {
      focusWindowState(appId, { save: false });
    }

    saveOsState();
    applyWindowState();
    return osState.windows[appId];
  };

  const nextWindowZ = () => Object.values(osState.windows)
    .reduce((highest, item) => Math.max(highest, Number(item.z) || 0), 0) + 1;

  const visibleNonModalWindows = () => Object.values(osState.windows)
    .filter((item) => item.state !== "minimized" && !isModalApplication(item))
    .sort((a, b) => (b.z || 0) - (a.z || 0));

  const resolveRouteOwner = () => {
    const active = osState.windows[osState.activeWindowId];

    if (active?.state !== "minimized" && !isModalApplication(active)) {
      return active;
    }

    const overlayOwner = osState.windows[overlayRouteOwnerId];

    if (overlayOwner?.state !== "minimized" && !isModalApplication(overlayOwner)) {
      return overlayOwner;
    }

    return visibleNonModalWindows()[0] || null;
  };

  const routeSnapshot = () => {
    const directModal = osState.windows[directModalRouteId];
    const directModalIsActive = Boolean(directModal && osState.activeWindowId === directModalRouteId);
    const owner = resolveRouteOwner();
    const target = directModalIsActive
      ? normalizePath(directModal.url)
      : owner?.state === "maximized" ? normalizePath(owner.url) : desktopUrl;

    return {
      owner,
      target,
      state: {
        michael95WindowRoute: true,
        windowId: owner?.id || null,
        presentation: owner?.state || null,
        modalWindowId: directModalIsActive ? directModal.id : null
      }
    };
  };

  const syncUrlToWindowStack = ({ mode = "push" } = {}) => {
    if (mode === "none") {
      return;
    }

    const { target, state } = routeSnapshot();
    const current = normalizePath(window.location.pathname);

    if (target === current) {
      window.history.replaceState(state, "", target);
      return;
    }

    if (mode === "replace") {
      window.history.replaceState(state, "", target);
    } else {
      window.history.pushState(state, "", target);
    }
  };

  const presentRouteWindow = (app) => {
    const existing = osState.windows[app.id] || null;
    const restoreSource = existing && existing.state !== "minimized" ? existing : null;
    const restoreBounds = restoreSource
      ? clampWindowBounds(app.id, restoreSource)
      : defaultWindowBounds(app.id);
    const bounds = clampWindowBounds(app.id, restoreSource || restoreBounds);

    osState.windows[app.id] = {
      ...existing,
      ...app,
      ...bounds,
      capabilities: { ...defaultCapabilities, ...(app.capabilities || {}) },
      state: isModalApplication(app) ? "normal" : "maximized",
      previousState: "normal",
      restoreBounds,
      z: nextWindowZ()
    };

    rememberTaskbarOrder(app.id);
    focusWindowState(app.id, { save: false });
    saveOsState();
    applyWindowState();
  };

  const focusWindowState = (appId, { save = true } = {}) => {
    const item = osState.windows[appId];

    if (!item || item.state === "minimized") {
      return;
    }

    const previousOwnerId = resolveRouteOwner()?.id || null;
    const lostDirectModalFocus = Boolean(directModalRouteId && directModalRouteId !== appId);

    if (isModalApplication(item) && !directModalRouteId) {
      overlayRouteOwnerId = previousOwnerId;
    } else if (!isModalApplication(item)) {
      overlayRouteOwnerId = null;
    }

    if (lostDirectModalFocus) {
      directModalRouteId = null;
    }

    item.z = nextWindowZ();
    osState.activeWindowId = appId;

    if (save) {
      saveOsState();
      applyWindowState();

      if (!isModalApplication(item) || lostDirectModalFocus) {
        syncUrlToWindowStack({ mode: lostDirectModalFocus ? "replace" : "push" });
      }
    }
  };

  const blurModalWindowState = (appId) => {
    const item = osState.windows[appId];

    if (!isModalApplication(item) || osState.activeWindowId !== appId) {
      return;
    }

    const preferredOwner = osState.windows[overlayRouteOwnerId];
    directModalRouteId = null;
    osState.activeWindowId = preferredOwner?.state !== "minimized" && !isModalApplication(preferredOwner)
      ? preferredOwner.id
      : visibleNonModalWindows()[0]?.id || null;
    overlayRouteOwnerId = null;
    saveOsState();
    applyWindowState();
    syncUrlToWindowStack({ mode: "replace" });
  };

  const blurActiveModalOutside = (target) => {
    const activeWindow = osState.windows[osState.activeWindowId];

    if (!isModalApplication(activeWindow)) {
      return;
    }

    if (target.closest?.("[data-taskbar-app], .desktop-shortcut, [data-window-id]")) {
      return;
    }

    const activeWindowElement = appWindows.find((appWindow) => appWindow.dataset.windowId === activeWindow.id);

    if (activeWindowElement && !activeWindowElement.contains(target)) {
      blurModalWindowState(activeWindow.id);
    }
  };

  const removeWindowState = (appId) => {
    const removedDirectModalRoute = directModalRouteId === appId;
    const removedModal = isModalApplication(osState.windows[appId]);
    const preferredOwner = osState.windows[overlayRouteOwnerId];

    if (removedDirectModalRoute) {
      directModalRouteId = null;
    }

    delete osState.windows[appId];

    if (osState.activeWindowId === appId) {
      osState.activeWindowId = removedModal
        && preferredOwner?.state !== "minimized"
        && !isModalApplication(preferredOwner)
        ? preferredOwner.id
        : visibleNonModalWindows()[0]?.id || null;
    }

    if (removedModal) {
      overlayRouteOwnerId = null;
    }

    saveOsState();
    applyWindowState();
    syncUrlToWindowStack({ mode: removedModal || removedDirectModalRoute ? "replace" : "push" });
  };

  const minimizeWindowState = (appId) => {
    const item = osState.windows[appId] || ensureWindowState(appId, "normal");

    if (!item || item.capabilities?.minimize === false) {
      return;
    }

    item.previousState = item.state === "minimized" ? item.previousState || "normal" : item.state;
    item.state = "minimized";

    if (osState.activeWindowId === appId) {
      osState.activeWindowId = visibleNonModalWindows()
        .find((windowState) => windowState.id !== appId)?.id || null;
    }

    saveOsState();
    applyWindowState();
    syncUrlToWindowStack();
  };

  const toggleMaximizeWindowState = (appId) => {
    const item = osState.windows[appId] || ensureWindowState(appId, "normal");

    if (!item || item.capabilities?.maximize === false) {
      return;
    }

    if (item.state === "maximized") {
      const restoreBounds = item.restoreBounds || defaultWindowBounds(appId);
      Object.assign(item, clampWindowBounds(appId, restoreBounds));
      item.state = "normal";
    } else {
      item.restoreBounds = clampWindowBounds(appId, {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
      });
      item.state = "maximized";
    }

    focusWindowState(appId, { save: false });
    saveOsState();
    applyWindowState();
    syncUrlToWindowStack();
  };

  const syncPageToOsState = () => {
    const pageUrl = normalizePath(document.body?.dataset.pageUrl);

    if (isDesktopPath()) {
      const historyWindow = osState.windows[window.history.state?.windowId];
      const persistedActive = osState.windows[osState.activeWindowId];
      const normalWindow = visibleNonModalWindows().find((item) => item.state === "normal");
      const owner = historyWindow && !isModalApplication(historyWindow)
        ? historyWindow
        : persistedActive?.state === "normal" && !isModalApplication(persistedActive)
          ? persistedActive
          : normalWindow || (persistedActive?.state !== "minimized" && !isModalApplication(persistedActive)
            ? persistedActive
            : visibleNonModalWindows()[0] || null);

      directModalRouteId = null;
      overlayRouteOwnerId = null;
      osState.activeWindowId = owner?.id || null;

      if (owner) {
        if (window.history.state?.presentation === "normal") {
          owner.state = "normal";
          owner.previousState = "normal";
        }

        owner.z = nextWindowZ();
      }

      saveOsState();
      syncUrlToWindowStack({ mode: "replace" });
      return;
    }

    const app = Object.values(applications).find((item) => normalizePath(item.url) === pageUrl);

    if (!app) {
      return;
    }

    if (isModalApplication(app)) {
      overlayRouteOwnerId = resolveRouteOwner()?.id || null;
      directModalRouteId = app.id;
    }

    presentRouteWindow(app);

    syncUrlToWindowStack({ mode: "replace" });
  };

  const windowFragmentCache = new Map();
  let osContextPromise = null;

  const fragmentUrlForRoute = (url) => {
    const routeUrl = normalizePath(url);

    return routeUrl === desktopUrl ? "/window.html" : `${routeUrl}window.html`;
  };

  const fetchWindowFragment = async (url) => {
    const routeUrl = normalizePath(url);

    if (!windowFragmentCache.has(routeUrl)) {
      const request = fetch(fragmentUrlForRoute(routeUrl), { credentials: "same-origin" }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load the window fragment for ${routeUrl}`);
        }

        return new DOMParser().parseFromString(await response.text(), "text/html");
      }).catch((error) => {
        windowFragmentCache.delete(routeUrl);
        throw error;
      });

      windowFragmentCache.set(routeUrl, request);
    }

    return windowFragmentCache.get(routeUrl);
  };

  const registerFragmentApplications = (fragmentDocument) => {
    Array.from(fragmentDocument?.querySelectorAll("[data-window-id]") || []).forEach((sourceWindow) => {
      const app = readWindowMetadata(sourceWindow);

      if (app) {
        applications[app.id] = { ...applications[app.id], ...app };
      }
    });
  };

  const mountDesktopShortcuts = (fragmentDocument) => {
    if (!desktop || shortcuts.length > 0) {
      return;
    }

    Array.from(fragmentDocument?.querySelectorAll(".desktop-shortcut") || []).forEach((sourceShortcut) => {
      desktop.append(document.importNode(sourceShortcut, true));
    });
    shortcuts = Array.from(document.querySelectorAll(".desktop-shortcut"));
    bindShortcuts();
  };

  const ensureOsContext = () => {
    if (!osContextPromise) {
      osContextPromise = fetchWindowFragment(desktopUrl).then((fragmentDocument) => {
        registerFragmentApplications(fragmentDocument);
        mountDesktopShortcuts(fragmentDocument);
        return fragmentDocument;
      }).catch((error) => {
        osContextPromise = null;
        throw error;
      });
    }

    return osContextPromise;
  };

  const hydrateWindowDom = async (item, { apply = true } = {}) => {
    if (!item?.id || !item.url || item.state === "minimized") {
      return null;
    }

    const existing = appWindows.find((windowEl) => windowEl.dataset.windowId === item.id);

    if (existing && normalizePath(existing.dataset.windowUrl) === normalizePath(item.url)) {
      return existing;
    }

    const fragmentDocument = await fetchWindowFragment(item.url);
    const sourceWindow = Array.from(fragmentDocument.querySelectorAll("[data-window-id]"))
      .find((windowEl) => windowEl.dataset.windowId === item.id);

    if (!sourceWindow) {
      throw new Error(`Window ${item.id} was not found at ${item.url}`);
    }

    const imported = document.importNode(sourceWindow, true);
    imported.hidden = !apply;

    if (existing) {
      unregisterDynamicWindow(existing);
      existing.replaceWith(imported);
    } else {
      desktop?.append(imported);
    }

    registerDynamicWindow(imported);

    if (apply) {
      applyWindowState();
    }

    return imported;
  };

  const proposedWindowState = (appId, requestedState) => {
    const existing = osState.windows[appId] || null;
    const app = applications[appId] || existing;

    if (!app) {
      return null;
    }

    applications[appId] = { ...applications[appId], ...app, id: appId };
    const defaults = defaultWindowBounds(appId);
    const bounds = clampWindowBounds(appId, {
      x: existing?.x ?? defaults.x,
      y: existing?.y ?? defaults.y,
      width: existing?.width ?? defaults.width,
      height: existing?.height ?? defaults.height
    });
    const state = isModalApplication(app)
      ? "normal"
      : requestedState || (existing?.state === "minimized"
        ? existing.previousState === "maximized" ? "maximized" : "normal"
        : existing?.state || "normal");

    return {
      ...existing,
      ...applications[appId],
      ...bounds,
      capabilities: { ...defaultCapabilities, ...(app.capabilities || {}) },
      state,
      previousState: "normal",
      restoreBounds: existing?.restoreBounds || bounds,
      z: existing?.z || Date.now()
    };
  };

  const fallbackWindowNavigation = (item) => {
    if (!item) {
      return;
    }

    osState.windows[item.id] = { ...item, z: nextWindowZ() };
    osState.activeWindowId = item.id;
    directModalRouteId = isModalApplication(item) ? item.id : null;
    saveOsState();
    window.location.assign(isModalApplication(item) || item.state === "maximized"
      ? item.url
      : desktopUrl);
  };

  const activateWindow = (appId, { requestedState, historyMode = "push", directModal = false } = {}) => {
    const activationId = ++latestWindowActivation;
    const activation = (async () => {
      const proposed = proposedWindowState(appId, requestedState);

      if (!proposed) {
        return null;
      }

      const priorOwnerId = resolveRouteOwner()?.id || null;
      const replacingDirectModalRoute = Boolean(directModalRouteId && directModalRouteId !== appId);
      let root;

      try {
        root = await hydrateWindowDom(proposed, { apply: false });
      } catch (error) {
        if (activationId !== latestWindowActivation) {
          return null;
        }

        throw error;
      }

      if (activationId !== latestWindowActivation) {
        return root;
      }

      osState.windows[appId] = { ...proposed, z: nextWindowZ() };
      osState.activeWindowId = appId;

      if (isModalApplication(proposed)) {
        overlayRouteOwnerId = priorOwnerId;
        directModalRouteId = directModal ? appId : null;
      } else {
        overlayRouteOwnerId = null;
        directModalRouteId = null;
      }

      saveOsState();
      applyWindowState();

      if (!isModalApplication(proposed) || directModal) {
        syncUrlToWindowStack({ mode: replacingDirectModalRoute ? "replace" : historyMode });
      }

      return root;
    })();

    return activation;
  };

  const activateTaskbarWindow = async (appId) => {
    const current = osState.windows[appId];

    if (!current || isModalApplication(current)) {
      return;
    }

    if (current.state !== "minimized" && osState.activeWindowId === appId) {
      minimizeWindowState(appId);
      return;
    }

    const requestedState = current.state === "minimized"
      ? current.previousState === "maximized" ? "maximized" : "normal"
      : current.state;
    const proposed = proposedWindowState(appId, requestedState);

    try {
      await activateWindow(appId, { requestedState });
    } catch {
      fallbackWindowNavigation(proposed);
    }
  };

  const hydratePersistedWindows = async () => {
    const missingVisibleWindows = Object.values(osState.windows)
      .filter((item) => item.state !== "minimized")
      .filter((item) => !appWindows.some((windowEl) => windowEl.dataset.windowId === item.id
        && normalizePath(windowEl.dataset.windowUrl) === normalizePath(item.url)));

    if (isDesktopPath()) {
      await Promise.allSettled(missingVisibleWindows.map((item) => hydrateWindowDom(item)));
      applyWindowState();
      return;
    }

    await Promise.allSettled(missingVisibleWindows.map(async (item) => {
      const fragmentDocument = await fetchWindowFragment(item.url);
      registerFragmentApplications(fragmentDocument);
    }));
  };

  const activateRouteUrl = async (url, historyState = window.history.state) => {
    const routeUrl = normalizePath(url);

    if (routeUrl === desktopUrl) {
      const departingModalId = directModalRouteId;

      if (departingModalId) {
        delete osState.windows[departingModalId];
      }

      directModalRouteId = null;
      overlayRouteOwnerId = null;
      const historyWindow = osState.windows[historyState?.windowId];
      const persistedActive = osState.windows[osState.activeWindowId];
      const normalWindow = visibleNonModalWindows().find((item) => item.state === "normal");
      const owner = historyWindow && !isModalApplication(historyWindow)
        ? historyWindow
        : persistedActive?.state === "normal" && !isModalApplication(persistedActive)
          ? persistedActive
          : normalWindow || (persistedActive?.state !== "minimized" && !isModalApplication(persistedActive)
            ? persistedActive
            : visibleNonModalWindows()[0] || null);

      if (owner && historyState?.presentation === "normal") {
        owner.state = "normal";
        owner.previousState = "normal";
      }

      osState.activeWindowId = owner?.id || null;

      if (owner) {
        owner.z = nextWindowZ();
      }

      saveOsState();
      await hydratePersistedWindows();
      applyWindowState();
      return;
    }

    const fragmentDocument = await fetchWindowFragment(routeUrl);
    const sourceWindow = fragmentDocument.querySelector("[data-window-id]");
    const routeWindowId = sourceWindow?.dataset.windowId;

    if (!routeWindowId || !sourceWindow) {
      throw new Error(`No route window was found at ${routeUrl}`);
    }

    const app = readWindowMetadata(sourceWindow);
    applications[routeWindowId] = { ...applications[routeWindowId], ...app, url: routeUrl };
    const existing = osState.windows[routeWindowId];
    const restoreBounds = existing?.state === "normal"
      ? clampWindowBounds(routeWindowId, existing)
      : existing?.restoreBounds || defaultWindowBounds(routeWindowId);

    osState.windows[routeWindowId] = {
      ...existing,
      ...applications[routeWindowId],
      state: isModalApplication(applications[routeWindowId]) ? "normal" : "maximized",
      previousState: "normal",
      restoreBounds,
      z: nextWindowZ()
    };

    if (isModalApplication(applications[routeWindowId])) {
      overlayRouteOwnerId = resolveRouteOwner()?.id || null;
      directModalRouteId = routeWindowId;
    } else {
      overlayRouteOwnerId = null;
      directModalRouteId = null;
    }

    osState.activeWindowId = routeWindowId;
    rememberTaskbarOrder(routeWindowId);
    saveOsState();
    await hydrateWindowDom(osState.windows[routeWindowId]);
    applyWindowState();
  };

  function renderTaskbar() {
    if (!taskbarApps) {
      return;
    }

    taskbarApps.replaceChildren();

    Object.values(osState.windows)
      .filter((item) => item.capabilities?.taskbar !== false)
      .sort((a, b) => taskbarSortIndex(a.id) - taskbarSortIndex(b.id) || (a.title || a.id).localeCompare(b.title || b.id))
      .forEach((item) => {
        const button = document.createElement("button");
        const icon = document.createElement("img");
        const label = document.createElement("span");

        button.className = "taskbar-button";
        button.type = "button";
        button.dataset.taskbarApp = item.id;
        button.classList.toggle("is-active", osState.activeWindowId === item.id && item.state !== "minimized");
        button.classList.toggle("is-minimized", item.state === "minimized");
        button.setAttribute("aria-pressed", String(osState.activeWindowId === item.id && item.state !== "minimized"));
        icon.src = item.icon || applications[item.id]?.icon || "/images/win95-icons/w95_16.ico";
        icon.alt = "";
        label.textContent = item.title || applications[item.id]?.title || item.id;

        button.append(icon, label);
        button.addEventListener("click", () => {
          activateTaskbarWindow(item.id);
        });

        taskbarApps.append(button);
      });
  }

  const closeViewMenu = (context) => {
    const contexts = context ? [context] : explorerContexts;

    contexts.forEach((item) => {
      item.viewMenu?.classList.remove("is-open");
      item.viewMenuButton?.setAttribute("aria-expanded", "false");
    });
  };

  const toggleViewMenu = (context) => {
    if (!context?.viewMenu || !context.viewMenuButton) {
      return;
    }

    const isOpen = context.viewMenu.classList.toggle("is-open");
    context.viewMenuButton.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
      closeStartMenu();
      explorerContexts.forEach((item) => {
        if (item !== context) {
          closeViewMenu(item);
        }
      });
    }
  };

  const fileName = (item) => (item.dataset.name || "").toLocaleLowerCase();
  const fileType = (item) => (item.dataset.type || "").toLocaleLowerCase();
  const fileDate = (item) => item.dataset.date || "";

  const setFileIconPosition = (context, item, x, y) => {
    if (!context?.list) {
      return { x: 0, y: 0 };
    }

    const maxX = Math.max(8, context.list.scrollWidth - item.offsetWidth - 10, x);
    const maxY = Math.max(8, context.list.scrollHeight - item.offsetHeight - 10, y);
    const nextX = Math.round(clamp(x, 8, maxX));
    const nextY = Math.round(clamp(y, 8, maxY));
    item.style.setProperty("--x", `${nextX}px`);
    item.style.setProperty("--y", `${nextY}px`);
    return { x: nextX, y: nextY };
  };

  function lineUpExplorerIcons(context, { save = false } = {}) {
    if (!context?.list || context.fileItems.length === 0) {
      return;
    }

    const state = ensureExplorerState(context);
    const iconWidth = 108;
    const iconHeight = 82;
    const gapX = 16;
    const gapY = 10;
    const startX = 8;
    const startY = 8;
    const availableWidth = Math.max(iconWidth, context.list.clientWidth - startX * 2);
    const columns = Math.max(1, Math.floor((availableWidth + gapX) / (iconWidth + gapX)));

    Array.from(context.list.querySelectorAll("[data-file-item]")).forEach((item, index) => {
      const x = startX + (index % columns) * (iconWidth + gapX);
      const y = startY + Math.floor(index / columns) * (iconHeight + gapY);
      const next = setFileIconPosition(context, item, x, y);

      if (save) {
        state.icons[item.dataset.fileId] = next;
      }
    });

    const rows = Math.ceil(context.fileItems.length / columns);
    context.list.style.setProperty("--icons-flow-height", `${startY + rows * (iconHeight + gapY) + 12}px`);

    if (save) {
      saveOsState();
    }
  }

  const applySavedExplorerIconPositions = (context) => {
    if (!context?.list) {
      return;
    }

    const state = ensureExplorerState(context);
    let hasSavedPosition = false;

    context.fileItems.forEach((item) => {
      const saved = state.icons[item.dataset.fileId];

      if (saved) {
        hasSavedPosition = true;
        setFileIconPosition(context, item, saved.x, saved.y);
      }
    });

    if (!hasSavedPosition) {
      lineUpExplorerIcons(context, { save: true });
      return;
    }

    const maxBottom = context.fileItems.reduce((bottom, item) => Math.max(bottom, item.offsetTop + item.offsetHeight), 0);
    context.list.style.setProperty("--icons-flow-height", `${maxBottom + 18}px`);
  };

  const sortExplorerItems = (context, sort, { save = false, lineUp = false } = {}) => {
    if (!context?.list) {
      return;
    }

    const sorted = [...context.fileItems].sort((a, b) => {
      if (sort === "type") {
        return fileType(a).localeCompare(fileType(b)) || fileName(a).localeCompare(fileName(b));
      }

      if (sort === "date") {
        return fileDate(b).localeCompare(fileDate(a)) || fileName(a).localeCompare(fileName(b));
      }

      return fileName(a).localeCompare(fileName(b));
    });

    sorted.forEach((item) => context.list.append(item));
    ensureExplorerState(context).sort = sort;

    if (lineUp) {
      lineUpExplorerIcons(context, { save: ensureExplorerState(context).view === "icons" });
    }

    if (save) {
      saveOsState();
    }
  };

  const setExplorerView = (context, view, { save = false, persist = true } = {}) => {
    if (!context?.list) {
      return;
    }

    const state = ensureExplorerState(context);
    if (persist) {
      state.view = view;
    }
    context.list.dataset.view = view;

    context.viewOptionButtons.forEach((button) => {
      button.setAttribute("aria-checked", String(button.dataset.viewOption === view));
    });

    if (context.lineUpIconsButton) {
      context.lineUpIconsButton.disabled = view !== "icons";
    }

    if (view === "icons") {
      applySavedExplorerIconPositions(context);
    }

    if (save) {
      saveOsState();
    }
  };

  const setTreeNodeExpanded = (toggle, expanded, { save = false } = {}) => {
    const context = explorerContexts.find((item) => item.tree?.contains(toggle));
    const node = toggle.closest("[data-tree-node-id]");
    const childList = document.getElementById(toggle.getAttribute("aria-controls"));

    if (!node || !childList) {
      return;
    }

    toggle.textContent = expanded ? "-" : "+";
    toggle.setAttribute("aria-expanded", String(expanded));
    childList.hidden = !expanded;
    node.classList.toggle("is-collapsed", !expanded);

    if (save) {
      ensureExplorerState(context).tree.expanded[node.dataset.treeNodeId] = expanded;
      saveOsState();
    }
  };

  const openExplorerItemInWindow = (event, trigger, context) => {
    if (trigger?.dataset.openKind === "folder") {
      return false;
    }

    const targetWindowId = trigger?.dataset.openWindowId;

    if (!targetWindowId || !context?.windowEl || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }

    const sourceWindowId = explorerId(context);
    const sourceWindow = osState.windows[sourceWindowId];
    const destination = new URL(trigger.href || trigger.dataset.openUrl || desktopUrl, window.location.href);

    if (!sourceWindow || destination.origin !== window.location.origin) {
      return false;
    }

    const windowKind = trigger.dataset.openWindowKind || applications[targetWindowId]?.windowKind || "normal";

    if (!applications[targetWindowId]) {
      applications[targetWindowId] = {
        id: targetWindowId,
        title: trigger.dataset.name || trigger.textContent.trim() || targetWindowId,
        url: normalizePath(destination.pathname),
        icon: trigger.querySelector("img")?.getAttribute("src") || "/images/win95-icons/w95_16.ico",
        kind: "document",
        windowKind,
        defaultX: 124,
        defaultY: 46,
        defaultWidth: 820,
        defaultHeight: 560,
        minWidth: 360,
        minHeight: 260,
        capabilities: windowKind === modalWindowKind
          ? { ...defaultCapabilities, minimize: false, maximize: false, fixedSize: true, taskbar: false }
          : { ...defaultCapabilities }
      };
    }

    applications[targetWindowId] = {
      ...applications[targetWindowId],
      url: normalizePath(destination.pathname),
      windowKind
    };

    event.preventDefault();
    event.stopPropagation();
    closeStartMenu();
    closeViewMenu();

    const existingTarget = osState.windows[targetWindowId];
    const targetState = isModalApplication(applications[targetWindowId])
      ? "normal"
      : existingTarget?.state && existingTarget.state !== "minimized"
      ? existingTarget.state
      : existingTarget?.previousState === "maximized" || sourceWindow.state === "maximized" ? "maximized" : "normal";
    const proposed = proposedWindowState(targetWindowId, targetState);

    if (!proposed) {
      return true;
    }

    activateWindow(targetWindowId, { requestedState: targetState })
      .catch(() => fallbackWindowNavigation(proposed));
    return true;
  };

  const navigateExplorerToFolder = (event, trigger, context) => {
    if (trigger?.dataset.openKind !== "folder" || !context?.windowEl) {
      return false;
    }

    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }

    const destination = new URL(trigger.href || trigger.dataset.openUrl || desktopUrl, window.location.href);

    if (destination.origin !== window.location.origin || normalizePath(destination.pathname) === desktopUrl) {
      return false;
    }

    const sourceWindowId = explorerId(context);
    const sourceWindow = osState.windows[sourceWindowId];
    const targetWindowId = trigger.dataset.openWindowId || explorerWindowIdForUrl(destination.pathname);

    if (!sourceWindow || !targetWindowId) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    closeStartMenu();
    closeViewMenu();

    const existingTarget = osState.windows[targetWindowId];

    if (existingTarget) {
      if (sourceWindowId === targetWindowId && normalizePath(existingTarget.url) === normalizePath(destination.pathname)) {
        focusWindowState(targetWindowId);
        return true;
      }

      const requestedState = existingTarget.state === "minimized"
        ? existingTarget.previousState === "maximized" ? "maximized" : "normal"
        : existingTarget.state;
      const proposed = proposedWindowState(targetWindowId, requestedState);

      activateWindow(targetWindowId, { requestedState })
        .catch(() => fallbackWindowNavigation(proposed));
      return true;
    }

    fetchWindowFragment(destination.pathname).then((fragmentDocument) => {
      const sourceTargetWindow = Array.from(fragmentDocument.querySelectorAll("[data-window-id]"))
        .find((windowEl) => windowEl.dataset.windowId === targetWindowId);
      const targetApp = readWindowMetadata(sourceTargetWindow);

      if (!targetApp) {
        throw new Error(`Explorer window ${targetWindowId} was not found at ${destination.pathname}`);
      }

      applications[targetWindowId] = { ...applications[targetWindowId], ...targetApp };
      delete osState.windows[sourceWindowId];
      osState.windows[targetWindowId] = {
        ...sourceWindow,
        ...applications[targetWindowId],
        id: targetWindowId,
        state: sourceWindow.state,
        previousState: sourceWindow.previousState || "normal",
        restoreBounds: sourceWindow.restoreBounds || {
          x: sourceWindow.x,
          y: sourceWindow.y,
          width: sourceWindow.width,
          height: sourceWindow.height
        },
        z: nextWindowZ()
      };
      osState.activeWindowId = targetWindowId;
      rememberTaskbarOrder(targetWindowId);
      saveOsState();
      applyWindowState();
      syncUrlToWindowStack();
      return hydrateWindowDom(osState.windows[targetWindowId]);
    }).catch(() => window.location.assign(destination.href));
    return true;
  };

  const bindExplorerTree = (context) => {
    if (!context?.tree) {
      return;
    }

    const state = ensureExplorerState(context);
    const toggles = Array.from(context.tree.querySelectorAll("[data-tree-toggle]"));

    toggles.forEach((toggle) => {
      const node = toggle.closest("[data-tree-node-id]");
      const id = node?.dataset.treeNodeId;
      const saved = id ? state.tree.expanded[id] : undefined;
      const containsSelected = Boolean(node?.querySelector(".tree-row.is-selected, .tree-link[aria-current='page']"));
      const defaultExpanded = toggle.dataset.treeDefaultExpanded === "true";
      const expanded = containsSelected || (typeof saved === "boolean" ? saved : defaultExpanded);

      setTreeNodeExpanded(toggle, expanded);

      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTreeNodeExpanded(toggle, toggle.getAttribute("aria-expanded") !== "true", { save: true });
      });
    });

    context.tree.querySelectorAll("[data-open-kind='folder']").forEach((link) => {
      link.addEventListener("click", (event) => {
        navigateExplorerToFolder(event, link, context);
      });
    });

    context.tree.querySelectorAll("[data-open-window-id]").forEach((link) => {
      link.addEventListener("click", (event) => {
        openExplorerItemInWindow(event, link, context);
      });
    });
  };

  const bindExplorerView = (context) => {
    if (!context?.list) {
      return;
    }

    const state = ensureExplorerState(context);
    sortExplorerItems(context, state.sort || "date");
    setExplorerView(context, isCompactMode() ? "list" : state.view || context.list.dataset.view || "details", { persist: false });

    context.viewMenuButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleViewMenu(context);
    });

    context.viewOptionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setExplorerView(context, button.dataset.viewOption, { save: true });
        closeViewMenu(context);
      });
    });

    context.arrangeIconButtons.forEach((button) => {
      button.addEventListener("click", () => {
        sortExplorerItems(context, button.dataset.arrangeIcons, { save: true, lineUp: context.list.dataset.view === "icons" });
        closeViewMenu(context);
      });
    });

    context.lineUpIconsButton?.addEventListener("click", () => {
      if (context.list.dataset.view === "icons") {
        lineUpExplorerIcons(context, { save: true });
      }

      closeViewMenu(context);
    });

    context.fileItems.forEach((item) => {
      item.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || isCompactMode() || context.list.dataset.view !== "icons") {
          return;
        }

        event.preventDefault();
        closeViewMenu(context);
        item.setPointerCapture(event.pointerId);
        activeFileDrag = {
          context,
          item,
          id: item.dataset.fileId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: item.offsetLeft,
          startY: item.offsetTop,
          moved: false
        };
      });

      item.addEventListener("pointermove", (event) => {
        if (!activeFileDrag || activeFileDrag.item !== item) {
          return;
        }

        moveActiveFileDrag(event.clientX, event.clientY);
      });

      item.addEventListener("pointerup", () => {
        if (!activeFileDrag || activeFileDrag.item !== item) {
          return;
        }

        finishActiveFileDrag();
      });

      item.addEventListener("click", (event) => {
        if (item.dataset.wasDragged === "true") {
          event.preventDefault();
          event.stopImmediatePropagation();
          item.dataset.wasDragged = "false";
          return;
        }

        if (navigateExplorerToFolder(event, item, context) || openExplorerItemInWindow(event, item, context)) {
          event.stopImmediatePropagation();
        }
      });
    });
  };

  function applyWindowState() {
    let hasMaximizedWindow = false;
    const compact = isCompactMode();
    const zIndexes = Object.values(osState.windows)
      .filter((item) => item.state !== "minimized")
      .sort((a, b) => (a.z || 0) - (b.z || 0))
      .reduce((lookup, item, index) => {
        lookup[item.id] = 10 + index;
        return lookup;
      }, {});

    appWindows.forEach((appWindow) => {
      const appId = appWindow.dataset.windowId;
      const item = osState.windows[appId];
      const controls = Array.from(appWindow.querySelectorAll("[data-window-action]"));

      if (!item) {
        appWindow.classList.remove("is-normal", "is-maximized", "is-minimized", "is-modal", "is-active");
        appWindow.hidden = true;
        return;
      }

      const bounds = clampWindowBounds(appId, item);
      Object.assign(item, bounds);
      const isCompactBackground = compact && osState.activeWindowId !== appId;
      appWindow.hidden = item.state === "minimized" || isCompactBackground;
      appWindow.classList.toggle("is-normal", item.state === "normal");
      appWindow.classList.toggle("is-maximized", item.state === "maximized");
      appWindow.classList.toggle("is-minimized", item.state === "minimized");
      appWindow.classList.toggle("is-modal", isModalApplication(item));
      appWindow.classList.toggle("is-active", osState.activeWindowId === appId && item.state !== "minimized");
      appWindow.classList.toggle("is-inactive", !compact && osState.activeWindowId !== appId && item.state !== "minimized");
      appWindow.style.setProperty("--window-x", `${bounds.x}px`);
      appWindow.style.setProperty("--window-y", `${bounds.y}px`);
      appWindow.style.setProperty("--window-width", `${bounds.width}px`);
      appWindow.style.setProperty("--window-height", `${bounds.height}px`);
      appWindow.style.zIndex = String(zIndexes[appId] || 10);

      if (item.state === "maximized") {
        hasMaximizedWindow = true;
      }

      controls.forEach((control) => {
        const action = control.dataset.windowAction;
        const allowed = item.capabilities?.[action] !== false;

        const compactlyUnavailable = compact && action === "maximize";
        control.hidden = !allowed || compactlyUnavailable;
        control.disabled = !allowed || compactlyUnavailable;

        if (action === "maximize") {
          const isMaximized = item.state === "maximized";
          control.textContent = isMaximized ? "❐" : "□";
          control.setAttribute("aria-label", isMaximized ? "Restore" : "Maximize");
          control.title = isMaximized ? "Restore" : "Maximize";
        }
      });
    });

    desktop?.classList.toggle("has-maximized-window", hasMaximizedWindow || (compact && Boolean(osState.activeWindowId)));
    desktop?.classList.toggle("is-compact", compact);
    renderTaskbar();
  }

  const setShortcutPosition = (shortcut, x, y) => {
    const maxX = Math.max(0, window.innerWidth - shortcut.offsetWidth - 6);
    const maxY = Math.max(0, window.innerHeight - taskbarHeight() - shortcut.offsetHeight - 6);
    const nextX = Math.round(clamp(x, 0, maxX));
    const nextY = Math.round(clamp(y, 0, maxY));
    shortcut.style.setProperty("--x", `${nextX}px`);
    shortcut.style.setProperty("--y", `${nextY}px`);
    return { x: nextX, y: nextY };
  };

  const saveShortcutPositions = () => {
    saveOsState();
  };

  const selectShortcut = (shortcut) => {
    shortcuts.forEach((item) => item.classList.toggle("is-selected", item === shortcut));
  };

  const closeStartMenu = () => {
    startMenu?.classList.remove("is-open");
    startButton?.setAttribute("aria-expanded", "false");
    document.querySelectorAll("[data-menu-parent]").forEach((item) => item.classList.remove("is-active"));
  };

  const toggleStartMenu = () => {
    if (!startMenu || !startButton) {
      return;
    }

    const isOpen = startMenu.classList.toggle("is-open");
    startButton.setAttribute("aria-expanded", String(isOpen));
  };

  const selectedFeeds = () => feedChoices
    .filter((choice) => choice.checked)
    .map((choice) => ({
      label: choice.dataset.feedLabel,
      url: choice.dataset.feedUrl
    }))
    .filter((feed) => feed.label && feed.url);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = text;
      fallback.setAttribute("readonly", "");
      fallback.style.left = "-9999px";
      fallback.style.position = "fixed";
      document.body.append(fallback);
      fallback.focus();
      fallback.select();
      const copied = document.execCommand("copy");
      fallback.remove();
      return copied;
    }
  };

  const renderFeedUrls = () => {
    if (!feedUrlList) {
      return;
    }

    const selected = selectedFeeds();
    feedUrlList.replaceChildren();

    if (selected.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No feeds selected. Click Back to choose at least one feed.";
      feedUrlList.append(empty);
      return;
    }

    selected.forEach((feed) => {
      const row = document.createElement("div");
      const label = document.createElement("label");
      const input = document.createElement("input");
      const copy = document.createElement("button");
      const id = `feed-url-${feed.label.toLowerCase()}`;

      row.className = "feed-url-row";
      label.setAttribute("for", id);
      label.textContent = feed.label;
      input.id = id;
      input.type = "text";
      input.value = feed.url;
      input.disabled = true;
      copy.className = "setup-button";
      copy.type = "button";
      copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        if (await copyText(feed.url)) {
          copy.textContent = "Copied";
          window.setTimeout(() => {
            copy.textContent = "Copy";
          }, 1100);
        }
      });

      row.append(label, input, copy);
      feedUrlList.append(row);
    });
  };

  const setWizardStep = (step) => {
    if (wizardSteps.length === 0) {
      return;
    }

    wizardStep = clamp(step, 0, wizardSteps.length - 1);
    wizardSteps.forEach((item, index) => {
      item.classList.toggle("is-active", index === wizardStep);
    });

    if (rssSetupBack) {
      rssSetupBack.disabled = wizardStep === 0;
    }

    if (rssSetupNext) {
      rssSetupNext.textContent = wizardStep === wizardSteps.length - 1 ? "Finish" : "Next >";
    }

    if (wizardStep === 2) {
      renderFeedUrls();
    }
  };

  const bindRssSetup = (root = document) => {
    rssSetupWindow = root.querySelector?.("#rss-setup-window") || document.getElementById("rss-setup-window");

    if (!rssSetupWindow) {
      return;
    }

    rssSetupClose = rssSetupWindow.querySelector("#rss-setup-close");
    rssSetupBack = rssSetupWindow.querySelector("#rss-setup-back");
    rssSetupNext = rssSetupWindow.querySelector("#rss-setup-next");
    rssSetupCancel = rssSetupWindow.querySelector("#rss-setup-cancel");
    feedUrlList = rssSetupWindow.querySelector("#feed-url-list");
    feedChoices = Array.from(rssSetupWindow.querySelectorAll("[data-feed-choice]"));
    wizardSteps = Array.from(rssSetupWindow.querySelectorAll("[data-wizard-step]"));

    if (rssSetupWindow.dataset.rssSetupBound === "true") {
      return;
    }

    rssSetupWindow.dataset.rssSetupBound = "true";
    rssSetupBack?.addEventListener("click", () => {
      setWizardStep(wizardStep - 1);
      rssSetupNext?.focus();
    });
    rssSetupNext?.addEventListener("click", () => {
      if (wizardStep === wizardSteps.length - 1) {
        closeRssSetup();
        return;
      }

      setWizardStep(wizardStep + 1);
      rssSetupNext?.focus();
    });
    rssSetupCancel?.addEventListener("click", closeRssSetup);
    rssSetupClose?.addEventListener("click", closeRssSetup);
    feedChoices.forEach((choice) => choice.addEventListener("change", renderFeedUrls));
  };

  const ensureRssSetupDom = async () => {
    if (rssSetupWindow?.isConnected) {
      return rssSetupWindow;
    }

    const fragmentDocument = await ensureOsContext();
    const sourceWindow = fragmentDocument.querySelector("[data-modal-window='rss-setup']");

    if (!sourceWindow) {
      throw new Error("The RSS Setup fragment was not found");
    }

    const imported = document.importNode(sourceWindow, true);
    document.body.append(imported);
    modalWindows.push(imported);
    bindRssSetup(document);
    bindModalWindows();
    applyModalState();
    return imported;
  };

  const openRssSetup = async () => {
    try {
      await ensureRssSetupDom();
    } catch {
      window.location.assign(desktopUrl);
      return;
    }

    if (!rssSetupWindow) {
      return;
    }

    finishActiveDrag();
    closeStartMenu();
    rssSetupWindow.classList.add("is-open");
    applyModalState();
    focusModal(rssSetupWindow);
    setWizardStep(0);
    rssSetupNext?.focus();
  };

  const closeRssSetup = () => {
    rssSetupWindow?.classList.remove("is-open");
    rssSetupWindow?.classList.remove("is-active");
  };

  const setAboutTab = (tabId, root = aboutWindow) => {
    const tabs = Array.from(root?.querySelectorAll("[data-about-tab]") || []);
    const panels = Array.from(root?.querySelectorAll("[data-about-panel]") || []);

    tabs.forEach((tab) => {
      const isActive = tab.dataset.aboutTab === tabId;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.aboutPanel === tabId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  };

  const openAboutWindow = async () => {
    finishActiveDrag();
    closeStartMenu();

    try {
      await ensureOsContext();
      const root = await activateWindow("about", { requestedState: "normal", historyMode: "none" });
      setAboutTab("about", root);
      root?.querySelector("[data-about-tab]")?.focus();
    } catch {
      fallbackWindowNavigation(proposedWindowState("about", "normal"));
    }
  };

  const closeAboutWindow = () => {
    removeWindowState("about");
  };

  const syncClock = () => {
    if (!trayTime) {
      return;
    }

    const now = new Date();
    trayTime.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  };

  const moveActiveDrag = (clientX, clientY) => {
    if (!activeDrag) {
      return;
    }

    const deltaX = clientX - activeDrag.startPointerX;
    const deltaY = clientY - activeDrag.startPointerY;

    if (!activeDrag.moved && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return;
    }

    activeDrag.moved = true;
    activeDrag.shortcut.classList.add("is-dragging");
    setShortcutPosition(activeDrag.shortcut, activeDrag.startX + deltaX, activeDrag.startY + deltaY);
  };

  function finishActiveDrag() {
    if (!activeDrag) {
      return;
    }

    const { shortcut, id } = activeDrag;
    shortcut.classList.remove("is-dragging");
    const next = setShortcutPosition(shortcut, shortcut.offsetLeft, shortcut.offsetTop);

    if (activeDrag.moved) {
      osState.shortcuts[id] = next;
      saveShortcutPositions();
    }

    activeDrag = null;
  }

  const moveActiveFileDrag = (clientX, clientY) => {
    if (!activeFileDrag) {
      return;
    }

    const deltaX = clientX - activeFileDrag.startPointerX;
    const deltaY = clientY - activeFileDrag.startPointerY;

    if (!activeFileDrag.moved && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return;
    }

    activeFileDrag.moved = true;
    activeFileDrag.item.classList.add("is-dragging");
    setFileIconPosition(activeFileDrag.context, activeFileDrag.item, activeFileDrag.startX + deltaX, activeFileDrag.startY + deltaY);
  };

  function finishActiveFileDrag() {
    if (!activeFileDrag) {
      return;
    }

    const { item, id } = activeFileDrag;
    item.classList.remove("is-dragging");
    const next = setFileIconPosition(activeFileDrag.context, item, item.offsetLeft, item.offsetTop);

    if (activeFileDrag.moved) {
      const state = ensureExplorerState(activeFileDrag.context);
      state.icons[id] = next;
      item.dataset.wasDragged = "true";
      saveOsState();
    }

    activeFileDrag = null;
  }

  const moveActiveWindowDrag = (clientX, clientY) => {
    if (!activeWindowDrag) {
      return;
    }

    const deltaX = clientX - activeWindowDrag.startPointerX;
    const deltaY = clientY - activeWindowDrag.startPointerY;

    if (!activeWindowDrag.moved && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return;
    }

    activeWindowDrag.moved = true;
    const item = osState.windows[activeWindowDrag.appId];

    if (!item) {
      return;
    }

    const next = clampWindowBounds(activeWindowDrag.appId, {
      x: activeWindowDrag.startX + deltaX,
      y: activeWindowDrag.startY + deltaY,
      width: activeWindowDrag.width,
      height: activeWindowDrag.height
    });

    Object.assign(item, next);
    applyWindowState();
  };

  function finishActiveWindowDrag() {
    if (!activeWindowDrag) {
      return;
    }

    const item = osState.windows[activeWindowDrag.appId];

    if (item && activeWindowDrag.moved) {
      Object.assign(item, clampWindowBounds(activeWindowDrag.appId, item));
      item.restoreBounds = {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
      };
      saveOsState();
    }

    activeWindowDrag = null;
    applyWindowState();
  }

  const resizeDirections = ["n", "e", "s", "w", "ne", "se", "sw", "nw"];

  const addWindowResizeHandles = (appWindow, appId) => {
    if (appWindow.dataset.resizeHandles === "true") {
      return;
    }

    resizeDirections.forEach((direction) => {
      const handle = document.createElement("span");
      handle.className = `window-resize-handle window-resize-${direction}`;
      handle.dataset.windowResize = direction;
      handle.setAttribute("aria-hidden", "true");
      appWindow.append(handle);

      handle.addEventListener("pointerdown", (event) => {
        const item = osState.windows[appId];

        if (event.button !== 0 || isCompactMode() || !item || item.state !== "normal" || item.capabilities?.fixedSize) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        closeStartMenu();
        focusWindowState(appId);
        handle.setPointerCapture(event.pointerId);
        activeWindowResize = {
          appId,
          direction,
          pointerId: event.pointerId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: item.x,
          startY: item.y,
          startWidth: item.width,
          startHeight: item.height,
          moved: false
        };
      });

      handle.addEventListener("pointermove", (event) => {
        if (!activeWindowResize || activeWindowResize.appId !== appId) {
          return;
        }

        moveActiveWindowResize(event.clientX, event.clientY);
      });

      handle.addEventListener("pointerup", () => {
        if (!activeWindowResize || activeWindowResize.appId !== appId) {
          return;
        }

        finishActiveWindowResize();
      });
    });

    appWindow.dataset.resizeHandles = "true";
  };

  const resizedWindowBounds = (resize, clientX, clientY) => {
    const app = applications[resize.appId];
    const viewport = viewportBounds();
    const minWidth = app?.minWidth || 280;
    const minHeight = app?.minHeight || 180;
    const deltaX = clientX - resize.startPointerX;
    const deltaY = clientY - resize.startPointerY;
    const bounds = {
      x: resize.startX,
      y: resize.startY,
      width: resize.startWidth,
      height: resize.startHeight
    };

    if (resize.direction.includes("e")) {
      bounds.width = clamp(resize.startWidth + deltaX, minWidth, viewport.width - resize.startX);
    }

    if (resize.direction.includes("s")) {
      bounds.height = clamp(resize.startHeight + deltaY, minHeight, viewport.height - resize.startY);
    }

    if (resize.direction.includes("w")) {
      const maxX = resize.startX + resize.startWidth - minWidth;
      bounds.x = clamp(resize.startX + deltaX, 0, Math.max(0, maxX));
      bounds.width = resize.startWidth + resize.startX - bounds.x;
    }

    if (resize.direction.includes("n")) {
      const maxY = resize.startY + resize.startHeight - minHeight;
      bounds.y = clamp(resize.startY + deltaY, 0, Math.max(0, maxY));
      bounds.height = resize.startHeight + resize.startY - bounds.y;
    }

    return clampWindowBounds(resize.appId, bounds);
  };

  const moveActiveWindowResize = (clientX, clientY) => {
    if (!activeWindowResize) {
      return;
    }

    const deltaX = clientX - activeWindowResize.startPointerX;
    const deltaY = clientY - activeWindowResize.startPointerY;

    if (!activeWindowResize.moved && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return;
    }

    activeWindowResize.moved = true;
    const item = osState.windows[activeWindowResize.appId];

    if (!item) {
      return;
    }

    Object.assign(item, resizedWindowBounds(activeWindowResize, clientX, clientY));
    applyWindowState();
  };

  function finishActiveWindowResize() {
    if (!activeWindowResize) {
      return;
    }

    const item = osState.windows[activeWindowResize.appId];

    if (item && activeWindowResize.moved) {
      Object.assign(item, clampWindowBounds(activeWindowResize.appId, item));
      item.restoreBounds = {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
      };
      saveOsState();
    }

    activeWindowResize = null;
    applyWindowState();
  }

  const moveActiveModalDrag = (clientX, clientY) => {
    if (!activeModalDrag) {
      return;
    }

    const deltaX = clientX - activeModalDrag.startPointerX;
    const deltaY = clientY - activeModalDrag.startPointerY;

    if (!activeModalDrag.moved && Math.hypot(deltaX, deltaY) < dragThreshold) {
      return;
    }

    activeModalDrag.moved = true;
    setModalPosition(activeModalDrag.modal, {
      x: activeModalDrag.startX + deltaX,
      y: activeModalDrag.startY + deltaY
    });
  };

  function finishActiveModalDrag() {
    if (!activeModalDrag) {
      return;
    }

    const { modal, id } = activeModalDrag;
    const rect = modal.getBoundingClientRect();
    const position = clampModalPosition(modal, rect.left, rect.top);

    if (activeModalDrag.moved) {
      osState.modals[id] = {
        ...osState.modals[id],
        position
      };
      saveOsState();
    }

    activeModalDrag = null;
  }

  const registerShortcutApplication = async (shortcut) => {
    const windowId = shortcut?.dataset.shortcutWindowId;
    const url = shortcut?.dataset.shortcutUrl;

    if (!windowId || !url || applications[windowId]) {
      return;
    }

    if (normalizePath(url) === desktopUrl) {
      await ensureOsContext();
      return;
    }

    registerFragmentApplications(await fetchWindowFragment(url));
  };

  const openApplicationShortcut = async (shortcut) => {
    const windowId = shortcut?.dataset.shortcutWindowId;
    const url = shortcut?.dataset.shortcutUrl || desktopUrl;

    if (!windowId) {
      return;
    }

    try {
      await registerShortcutApplication(shortcut);
      const current = osState.windows[windowId];
      const restorePrevious = shortcut.dataset.shortcutRestore === "previous";
      const requestedState = current?.state === "minimized"
        ? restorePrevious && current.previousState === "maximized" ? "maximized" : "normal"
        : current?.state || "normal";

      await activateWindow(windowId, { requestedState });
    } catch {
      window.location.assign(url);
    }
  };

  const openShortcut = async (id) => {
    if (id === "rss-feed") {
      try {
        await ensureOsContext();
      } catch {
        window.location.assign(desktopUrl);
        return;
      }
    }

    if (id === "rss-feed") {
      openRssSetup();
      return;
    }

    if (id === "about-me") {
      openAboutWindow();
      return;
    }

    const shortcut = shortcuts.find((item) => item.dataset.shortcutId === id);
    await openApplicationShortcut(shortcut);
  };

  const bindShortcuts = () => {
    shortcuts.forEach((shortcut) => {
      if (shortcut.dataset.shortcutBound === "true") {
        return;
      }

      shortcut.dataset.shortcutBound = "true";
      const id = shortcut.dataset.shortcutId;
      const saved = osState.shortcuts[id];
      const defaultX = Number(shortcut.dataset.defaultX || 0);
      const defaultY = Number(shortcut.dataset.defaultY || 0);

      setShortcutPosition(shortcut, saved?.x ?? defaultX, saved?.y ?? defaultY);

      shortcut.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }

        closeStartMenu();
        selectShortcut(shortcut);

        if (isCompactMode()) {
          return;
        }

        shortcut.setPointerCapture(event.pointerId);
        activeDrag = {
          shortcut,
          id,
          pointerId: event.pointerId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: shortcut.offsetLeft,
          startY: shortcut.offsetTop,
          moved: false
        };
      });

      shortcut.addEventListener("pointermove", (event) => {
        if (!activeDrag || activeDrag.shortcut !== shortcut) {
          return;
        }

        moveActiveDrag(event.clientX, event.clientY);
      });

      shortcut.addEventListener("pointerup", () => {
        if (!activeDrag || activeDrag.shortcut !== shortcut) {
          return;
        }

        finishActiveDrag();
      });

      shortcut.addEventListener("dblclick", () => {
        if (!isCompactMode()) {
          openShortcut(id);
        }
      });

      shortcut.addEventListener("click", () => {
        if (isCompactMode()) {
          openShortcut(id);
        }
      });

      shortcut.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectShortcut(shortcut);
          openShortcut(id);
        }
      });
    });
  };

  const bindWindowControls = () => {
    appWindows.forEach((appWindow) => {
      if (appWindow.dataset.windowControlsBound === "true") {
        return;
      }

      appWindow.dataset.windowControlsBound = "true";
      const appId = appWindow.dataset.windowId;
      const titlebar = appWindow.querySelector(".window-titlebar");

      addWindowResizeHandles(appWindow, appId);

      appWindow.addEventListener("pointerdown", () => {
        if (osState.windows[appId]?.state !== "minimized") {
          focusWindowState(appId);
        }
      });

      titlebar?.addEventListener("pointerdown", (event) => {
        const item = osState.windows[appId];

        if (event.button !== 0 || isCompactMode() || event.target.closest("[data-window-action]") || !item?.capabilities?.move || item.state !== "normal") {
          return;
        }

        closeStartMenu();
        focusWindowState(appId);
        titlebar.setPointerCapture(event.pointerId);
        activeWindowDrag = {
          appId,
          pointerId: event.pointerId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: item.x,
          startY: item.y,
          width: item.width,
          height: item.height,
          moved: false
        };
      });

      titlebar?.addEventListener("pointermove", (event) => {
        if (!activeWindowDrag || activeWindowDrag.appId !== appId) {
          return;
        }

        moveActiveWindowDrag(event.clientX, event.clientY);
      });

      titlebar?.addEventListener("pointerup", () => {
        if (!activeWindowDrag || activeWindowDrag.appId !== appId) {
          return;
        }

        finishActiveWindowDrag();
      });

      titlebar?.addEventListener("dblclick", (event) => {
        if (isCompactMode() || event.target.closest("[data-window-action]") || osState.windows[appId]?.capabilities?.maximize === false) {
          return;
        }

        toggleMaximizeWindowState(appId);
      });

      appWindow.querySelectorAll("[data-window-action]").forEach((control) => {
        control.addEventListener("click", (event) => {
          const action = control.dataset.windowAction;

          if (action === "minimize") {
            minimizeWindowState(appId);
            return;
          }

          if (action === "close") {
            event.preventDefault();
            removeWindowState(appId);
            return;
          }

          if (action === "maximize") {
            toggleMaximizeWindowState(appId);
          }
        });
      });
    });
  };

  const unregisterDynamicWindow = (appWindow) => {
    const windowIndex = appWindows.indexOf(appWindow);

    if (windowIndex !== -1) {
      appWindows.splice(windowIndex, 1);
    }

    for (let index = explorerContexts.length - 1; index >= 0; index -= 1) {
      if (explorerContexts[index].windowEl === appWindow) {
        explorerContexts.splice(index, 1);
      }
    }
  };

  const registerDynamicWindow = (appWindow) => {
    if (!appWindow || appWindows.includes(appWindow)) {
      return;
    }

    appWindows.push(appWindow);
    const app = readWindowMetadata(appWindow);

    if (app) {
      applications[app.id] = { ...applications[app.id], ...app };
      osState.windows[app.id] = { ...osState.windows[app.id], ...app };
    }

    appWindow.querySelectorAll("[data-explorer-list]").forEach((list) => {
      const context = createExplorerContext(list);
      explorerContexts.push(context);
      bindExplorerTree(context);
      bindExplorerView(context);
    });

    bindWindowControls();

    if (app?.id === "about") {
      bindAboutWindow(appWindow);
    }
  };

  const bindTaskbar = () => {
    renderTaskbar();
  };

  const bindModalWindows = () => {
    modalWindows.forEach((modal) => {
      if (modal.dataset.modalBound === "true") {
        return;
      }

      modal.dataset.modalBound = "true";
      const titlebar = modal.querySelector("[data-modal-titlebar], .window-titlebar, .setup-titlebar");
      const id = modal.dataset.modalWindow;

      modal.addEventListener("pointerdown", () => {
        if (modal.classList.contains("is-open")) {
          focusModal(modal);
        }
      });

      titlebar?.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || isCompactMode() || event.target.closest("button, a, input, textarea, select")) {
          return;
        }

        if (!modal.classList.contains("is-open")) {
          return;
        }

        const rect = modal.getBoundingClientRect();
        focusModal(modal);
        titlebar.setPointerCapture(event.pointerId);
        activeModalDrag = {
          modal,
          id,
          pointerId: event.pointerId,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          startX: rect.left,
          startY: rect.top,
          moved: false
        };
      });

      titlebar?.addEventListener("pointermove", (event) => {
        if (!activeModalDrag || activeModalDrag.modal !== modal) {
          return;
        }

        moveActiveModalDrag(event.clientX, event.clientY);
      });

      titlebar?.addEventListener("pointerup", () => {
        if (!activeModalDrag || activeModalDrag.modal !== modal) {
          return;
        }

        finishActiveModalDrag();
      });
    });
  };

  const bindAboutWindow = (root = aboutWindow) => {
    if (root && root.dataset.aboutBound !== "true") {
      root.dataset.aboutBound = "true";
      const tabs = Array.from(root.querySelectorAll("[data-about-tab]"));
      const closeButtons = Array.from(root.querySelectorAll("[data-about-close]"));
      const copyButtons = Array.from(root.querySelectorAll("[data-copy-target]"));

      if (!root.hidden) {
        setAboutTab("about", root);
      }

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          setAboutTab(tab.dataset.aboutTab, root);
        });
      });

      closeButtons.forEach((button) => {
        button.addEventListener("click", closeAboutWindow);
      });

      copyButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const target = root.querySelector(`#${button.dataset.copyTarget}`);

          if (!target || !("value" in target)) {
            return;
          }

          if (await copyText(target.value)) {
            button.textContent = "Copied";
            window.setTimeout(() => {
              button.textContent = "Copy";
            }, 1100);
          }
        });
      });
    }

    startAboutButtons.forEach((button) => {
      if (button.dataset.aboutBound === "true") {
        return;
      }

      button.dataset.aboutBound = "true";
      button.addEventListener("click", () => {
        openAboutWindow();
      });
    });
  };

  loadOsState();
  registerDomWindows();
  syncPageToOsState();
  applyWindowState();
  applyModalState();
  bindShortcuts();
  bindWindowControls();
  bindTaskbar();
  bindModalWindows();
  bindRssSetup();
  explorerContexts.forEach((context) => {
    bindExplorerTree(context);
    bindExplorerView(context);
  });
  bindAboutWindow();
  hydratePersistedWindows();
  ensureOsContext().catch(() => {
    // The normal route remains usable; individual actions retain hard-navigation fallbacks.
  });

  document.addEventListener("mousemove", (event) => {
    moveActiveDrag(event.clientX, event.clientY);
    moveActiveFileDrag(event.clientX, event.clientY);
    moveActiveWindowDrag(event.clientX, event.clientY);
    moveActiveWindowResize(event.clientX, event.clientY);
    moveActiveModalDrag(event.clientX, event.clientY);
  });

  document.addEventListener("mouseup", () => {
    finishActiveDrag();
    finishActiveFileDrag();
    finishActiveWindowDrag();
    finishActiveWindowResize();
    finishActiveModalDrag();
  });

  startButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleStartMenu();
  });

  document.querySelectorAll("[data-menu-parent]").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll("[data-menu-parent]").forEach((other) => {
        other.classList.toggle("is-active", other === item);
      });
    });
  });

  document.addEventListener("pointerdown", (event) => {
    blurActiveModalOutside(event.target);

    if (startMenu && startButton && !startMenu.contains(event.target) && !startButton.contains(event.target)) {
      closeStartMenu();
    }

    explorerContexts.forEach((context) => {
      if (context.viewMenu && context.viewMenuButton && !context.viewMenu.contains(event.target) && !context.viewMenuButton.contains(event.target)) {
        closeViewMenu(context);
      }
    });

    if (!event.target.closest(".desktop-shortcut")) {
      shortcuts.forEach((item) => item.classList.remove("is-selected"));
    }
  });

  document.addEventListener("focusin", (event) => {
    blurActiveModalOutside(event.target);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeStartMenu();
      closeViewMenu();
      closeRssSetup();
      closeAboutWindow();
    }
  });

  window.addEventListener("popstate", (event) => {
    activateRouteUrl(window.location.pathname, event.state).catch(() => {
      window.location.reload();
    });
  });

  window.addEventListener("resize", () => {
    if (isCompactMode()) {
      finishActiveDrag();
      finishActiveFileDrag();
      finishActiveWindowDrag();
      finishActiveWindowResize();
      finishActiveModalDrag();
      applyWindowState();
      applyModalState();
      return;
    }

    shortcuts.forEach((shortcut) => {
      const id = shortcut.dataset.shortcutId;
      const next = setShortcutPosition(shortcut, shortcut.offsetLeft, shortcut.offsetTop);

      if (osState.shortcuts[id]) {
        osState.shortcuts[id] = next;
      }
    });
    Object.keys(osState.windows).forEach((appId) => {
      osState.windows[appId] = {
        ...osState.windows[appId],
        ...clampWindowBounds(appId, osState.windows[appId])
      };
    });
    modalWindows.forEach((modal) => {
      const id = modal.dataset.modalWindow;
      const item = osState.modals[id];

      if (item?.position) {
        item.position = clampModalPosition(modal, item.position.x, item.position.y);
      }
    });
    saveShortcutPositions();
    applyWindowState();
    applyModalState();

    explorerContexts.forEach((context) => {
      if (context.list.dataset.view === "icons") {
        lineUpExplorerIcons(context, { save: false });
        applySavedExplorerIconPositions(context);
      }
    });
  }, { passive: true });

  compactModeQuery.addEventListener("change", () => {
    explorerContexts.forEach((context) => {
      const state = ensureExplorerState(context);
      setExplorerView(context, isCompactMode() ? "list" : state.view || "details", { persist: false });
    });
    applyWindowState();
    applyModalState();
  });

  syncClock();
  window.setInterval(syncClock, 30000);
