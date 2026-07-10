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

