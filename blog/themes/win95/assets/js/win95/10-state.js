  const migrateOsState = () => {
    if (Number(osState.version) >= 3) {
      return;
    }

    const legacyId = "explorer-blog";
    const legacyWindow = osState.windows[legacyId];

    if (legacyWindow) {
      const targetId = explorerWindowIdForUrl(legacyWindow.url) || legacyId;
      const targetApp = applications[targetId] || applications[legacyId];

      if (targetId === legacyId) {
        osState.windows[legacyId] = { ...legacyWindow, ...targetApp, id: legacyId };
      } else {
        if (!osState.windows[targetId]) {
          osState.windows[targetId] = { ...legacyWindow, ...targetApp, id: targetId };
        }

        delete osState.windows[legacyId];

        if (osState.activeWindowId === legacyId) {
          osState.activeWindowId = targetId;
        }

        if (osState.explorers[legacyId] && !osState.explorers[targetId]) {
          osState.explorers[targetId] = osState.explorers[legacyId];
        }

        delete osState.explorers[legacyId];
        osState.taskbarOrder = osState.taskbarOrder.map((appId) => appId === legacyId ? targetId : appId);
      }
    }

    osState.taskbarOrder = Array.from(new Set(osState.taskbarOrder));
    osState.version = 3;
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

    const viewport = viewportBounds();
    const width = Math.round(clamp(app?.defaultWidth || 640, app?.minWidth || 280, Math.max(app?.minWidth || 280, viewport.width - 16)));
    const height = Math.round(clamp(app?.defaultHeight || 420, app?.minHeight || 180, Math.max(app?.minHeight || 180, viewport.height - 16)));
    const x = Math.round(clamp(app?.defaultX || 90, 0, Math.max(0, viewport.width - width)));
    const y = Math.round(clamp(app?.defaultY || 52, 0, Math.max(0, viewport.height - height)));

    return { x, y, width, height };
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

    const viewport = viewportBounds();
    const minWidth = app?.minWidth || 280;
    const minHeight = app?.minHeight || 180;
    const width = Math.round(clamp(bounds.width || app?.defaultWidth || 640, minWidth, Math.max(minWidth, viewport.width)));
    const height = Math.round(clamp(bounds.height || app?.defaultHeight || 420, minHeight, Math.max(minHeight, viewport.height)));
    const x = Math.round(clamp(bounds.x || 0, 0, Math.max(0, viewport.width - width)));
    const y = Math.round(clamp(bounds.y || 0, 0, Math.max(0, viewport.height - height)));

    return { x, y, width, height };
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

