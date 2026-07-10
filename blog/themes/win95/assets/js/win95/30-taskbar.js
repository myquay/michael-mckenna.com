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

