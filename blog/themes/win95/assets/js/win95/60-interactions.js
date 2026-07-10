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

