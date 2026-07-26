const sessionKey = "michael95.micropub.session";
const pendingKey = "michael95.micropub.pending";

const encodeBase64Url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-")
  .replaceAll("/", "_")
  .replaceAll("=", "");

const randomValue = (length = 32) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

const challengeFor = async (verifier) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return encodeBase64Url(new Uint8Array(digest));
};

const readJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "invalid_response", error_description: text };
  }
};

const titleFor = (item) => {
  const properties = item.properties || {};
  return properties.name?.[0] || properties.content?.[0]?.slice?.(0, 58) || `Untitled ${item.postType || "entry"}`;
};

export const toLocalDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.valueOf() - offset).toISOString().slice(0, 16);
};

export const relationshipFor = (type) => ({
  reply: "in-reply-to",
  like: "like-of",
  repost: "repost-of",
  bookmark: "bookmark-of"
})[type];

class MicropubClient {
  constructor(root) {
    this.root = root;
    this.form = root.querySelector("[data-mp-form]");
    this.list = root.querySelector("[data-mp-list]");
    this.status = root.querySelector("[data-mp-status]");
    this.connection = root.querySelector("[data-mp-connection]");
    this.authView = root.querySelector("[data-mp-auth]");
    this.workspace = root.querySelector("[data-mp-workspace]");
    this.current = null;
    this.items = [];
    this.config = null;
    this.session = this.readSession();
  }

  readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(sessionKey) || "null");
    } catch {
      return null;
    }
  }

  saveSession(session) {
    this.session = session;
    if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
    else sessionStorage.removeItem(sessionKey);
  }

  setStatus(message, error = false) {
    this.status.textContent = message;
    this.status.style.color = error ? "#800000" : "";
  }

  async init() {
    if (this.root.dataset.micropubBound === "true") return;
    this.root.dataset.micropubBound = "true";
    this.bind();
    await this.handleCallback();
    this.renderAuth();
    if (this.session) await this.connect();
  }

  bind() {
    this.root.querySelectorAll("[data-mp-sign-in]").forEach((button) =>
      button.addEventListener("click", () => this.signIn()));
    this.root.querySelectorAll("[data-mp-sign-out]").forEach((button) =>
      button.addEventListener("click", () => this.signOut()));
    this.root.querySelectorAll("[data-mp-new]").forEach((button) =>
      button.addEventListener("click", () => this.newPost()));
    this.root.querySelectorAll("[data-mp-refresh]").forEach((button) =>
      button.addEventListener("click", () => this.loadPosts()));
    this.root.querySelectorAll("[data-mp-about]").forEach((button) =>
      button.addEventListener("click", () => alert("Micropub for Windows 95\nA first-party IndieWeb publishing client.")));
    this.root.querySelector("[data-mp-save-draft]")?.addEventListener("click", () => this.save("draft"));
    this.root.querySelector("[data-mp-publish]")?.addEventListener("click", () => this.save("published"));
    this.root.querySelector("[data-mp-delete]")?.addEventListener("click", () => this.deleteOrRestore());
    this.root.querySelector("[data-mp-upload]")?.addEventListener("click", () => this.upload());
    this.root.querySelector("[data-mp-type]")?.addEventListener("change", () => this.showFields());
    this.root.querySelector("[data-mp-filter]")?.addEventListener("change", () => this.renderList());
    this.form?.addEventListener("input", () => this.setStatus("Modified"));
  }

  async discoverAuth() {
    const response = await fetch(this.root.dataset.authMetadata, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not discover the IndieAuth server.");
    return readJson(response);
  }

  async signIn() {
    try {
      this.setStatus("Contacting IndieAuth...");
      const metadata = await this.discoverAuth();
      const verifier = randomValue(48);
      const state = randomValue(24);
      const redirectUri = `${window.location.origin}/micropub/`;
      const pending = {
        verifier,
        state,
        issuer: metadata.issuer,
        tokenEndpoint: metadata.token_endpoint || this.root.dataset.tokenEndpoint,
        redirectUri,
        clientId: redirectUri
      };
      sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      const query = new URLSearchParams({
        response_type: "code",
        client_id: pending.clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: await challengeFor(verifier),
        code_challenge_method: "S256",
        scope: "profile create update delete media",
        me: this.root.dataset.me
      });
      window.location.assign(`${metadata.authorization_endpoint || this.root.dataset.authorizationEndpoint}?${query}`);
    } catch (error) {
      this.setStatus(error.message || "Sign in failed.", true);
    }
  }

  async handleCallback() {
    const query = new URLSearchParams(window.location.search);
    if (!query.has("code") && !query.has("error")) return;
    const pending = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
    history.replaceState(history.state, "", "/micropub/");
    if (query.has("error")) {
      this.setStatus(query.get("error_description") || query.get("error"), true);
      sessionStorage.removeItem(pendingKey);
      return;
    }
    if (!pending || query.get("state") !== pending.state) {
      this.setStatus("The IndieAuth response could not be verified.", true);
      return;
    }
    if (query.get("iss") && pending.issuer && query.get("iss").replace(/\/$/, "") !== pending.issuer.replace(/\/$/, "")) {
      this.setStatus("The IndieAuth issuer did not match.", true);
      return;
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: query.get("code"),
      client_id: pending.clientId,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier
    });
    const response = await fetch(pending.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const token = await readJson(response);
    sessionStorage.removeItem(pendingKey);
    if (!response.ok || !token.access_token) {
      this.setStatus(token.error_description || "Token exchange failed.", true);
      return;
    }
    this.saveSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + Number(token.expires_in || 900) * 1000,
      scope: token.scope,
      me: token.me,
      tokenEndpoint: pending.tokenEndpoint,
      clientId: pending.clientId
    });
  }

  async accessToken() {
    if (!this.session) throw new Error("Sign in is required.");
    if (this.session.expiresAt > Date.now() + 30_000) return this.session.accessToken;
    if (!this.session.refreshToken) throw new Error("Your session has expired.");
    const response = await fetch(this.session.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.session.refreshToken,
        client_id: this.session.clientId
      })
    });
    const token = await readJson(response);
    if (!response.ok || !token.access_token) {
      this.saveSession(null);
      this.renderAuth();
      throw new Error(token.error_description || "Your session has expired.");
    }
    this.saveSession({
      ...this.session,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || this.session.refreshToken,
      expiresAt: Date.now() + Number(token.expires_in || 900) * 1000,
      scope: token.scope || this.session.scope
    });
    return this.session.accessToken;
  }

  async api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${await this.accessToken()}`,
        ...(options.headers || {})
      }
    });
    const body = await readJson(response);
    if (!response.ok) throw new Error(body.error_description || body.title || `Request failed (${response.status}).`);
    return { response, body };
  }

  renderAuth() {
    const signedIn = Boolean(this.session);
    this.authView.hidden = signedIn;
    this.workspace.hidden = !signedIn;
    this.connection.textContent = signedIn ? "Connected to LittlePublisher" : "Not signed in";
    const account = this.root.querySelector("[data-mp-account]");
    if (account) account.textContent = this.session?.me || "";
  }

  async connect() {
    try {
      this.setStatus("Loading Micropub configuration...");
      const endpoint = this.root.dataset.micropubEndpoint;
      this.config = (await this.api(`${endpoint}?q=config`)).body;
      await this.loadPosts();
      this.newPost();
      this.setStatus("Ready");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async loadPosts() {
    if (!this.session) return;
    try {
      this.setStatus("Loading content...");
      const endpoint = this.root.dataset.micropubEndpoint;
      const result = await this.api(`${endpoint}?q=posts&take=50`);
      this.items = result.body.items || [];
      this.renderList();
      this.setStatus(`${this.items.length} item${this.items.length === 1 ? "" : "s"}`);
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  renderList() {
    const filter = this.root.querySelector("[data-mp-filter]")?.value;
    const visible = this.items.filter((item) => {
      if (!filter) return true;
      if (filter === "published") return Boolean(item.publishedUrl);
      return item.state === filter;
    });
    this.list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "micropub-empty";
      empty.textContent = "No content in this view.";
      this.list.append(empty);
      return;
    }
    visible.forEach((item) => {
      const button = document.createElement("button");
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      button.type = "button";
      button.className = "micropub-post-item";
      button.classList.toggle("is-selected", this.current?.managementUrl === item.managementUrl);
      button.setAttribute("role", "option");
      title.textContent = titleFor(item);
      detail.textContent = `${item.postType || "entry"} · ${item.state}`;
      button.append(title, detail);
      button.addEventListener("click", () => this.open(item));
      this.list.append(button);
    });
  }

  newPost() {
    this.current = null;
    this.form?.reset();
    if (this.form?.elements.published) this.form.elements.published.value = toLocalDate(new Date());
    this.showFields();
    const deleteButton = this.root.querySelector("[data-mp-delete]");
    if (deleteButton) {
      deleteButton.textContent = "Delete";
      deleteButton.disabled = true;
    }
    this.renderList();
    this.setStatus("New note");
    this.form?.elements.content?.focus();
  }

  open(item) {
    this.current = item;
    const properties = item.properties || {};
    const type = item.postType || properties["post-type"]?.[0] || "note";
    this.form.elements["post-type"].value = type;
    this.form.elements.name.value = properties.name?.[0] || "";
    this.form.elements.summary.value = properties.summary?.[0] || "";
    this.form.elements.content.value = typeof properties.content?.[0] === "string" ? properties.content[0] : "";
    this.form.elements.category.value = (properties.category || []).join(", ");
    this.form.elements.published.value = toLocalDate(properties.published?.[0]);
    const relationship = relationshipFor(type);
    this.form.elements.target.value = relationship ? properties[relationship]?.[0] || "" : "";
    this.form.elements["site-url"].value = properties.url?.[0] || properties["bookmark-of"]?.[0] || "";
    this.form.elements.feed.value = properties.feed?.[0] || "";
    this.form.elements.start.value = toLocalDate(properties.start?.[0]);
    this.form.elements.end.value = toLocalDate(properties.end?.[0]);
    this.form.elements.location.value = properties.location?.[0] || "";
    this.form.elements.media.value = properties.photo?.[0] || properties.audio?.[0] || properties.video?.[0] || "";
    this.form.elements.alt.value = properties.alt?.[0] || "";
    this.showFields();
    const deleteButton = this.root.querySelector("[data-mp-delete]");
    if (deleteButton) {
      deleteButton.textContent = item.state === "deleted" ? "Restore" : "Delete";
      deleteButton.disabled = false;
    }
    this.renderList();
    this.setStatus(`Editing ${type}`);
  }

  showFields() {
    const type = this.form?.elements["post-type"]?.value || "note";
    const show = (name, visible) => {
      const field = this.root.querySelector(`[data-mp-field="${name}"]`);
      if (field) field.hidden = !visible;
    };
    show("name", type !== "note" && !["like", "repost"].includes(type));
    show("summary", type === "article");
    show("target", ["reply", "like", "repost", "bookmark"].includes(type));
    show("site-url", type === "blogroll");
    show("feed", type === "blogroll");
    show("start", type === "event");
    show("end", type === "event");
    show("location", ["photo", "event"].includes(type));
    show("media", ["photo", "audio", "video"].includes(type));
    show("alt", type === "photo");
  }

  properties(status) {
    const fields = this.form.elements;
    const type = fields["post-type"].value;
    const properties = {
      "post-type": [type],
      content: [fields.content.value],
      "post-status": [status]
    };
    const add = (key, value) => {
      if (value?.trim?.()) properties[key] = [value.trim()];
    };
    add("name", fields.name.value);
    add("summary", fields.summary.value);
    add("published", fields.published.value ? new Date(fields.published.value).toISOString() : "");
    const categories = fields.category.value.split(",").map((value) => value.trim()).filter(Boolean);
    if (categories.length) properties.category = categories;
    const relationship = relationshipFor(type);
    if (relationship) add(relationship, fields.target.value);
    if (type === "blogroll") {
      add("url", fields["site-url"].value);
      add("feed", fields.feed.value);
    }
    add("start", fields.start.value ? new Date(fields.start.value).toISOString() : "");
    add("end", fields.end.value ? new Date(fields.end.value).toISOString() : "");
    add("location", fields.location.value);
    if (["photo", "audio", "video"].includes(type)) add(type, fields.media.value);
    if (type === "photo") add("alt", fields.alt.value);
    return properties;
  }

  async save(status) {
    try {
      const endpoint = this.root.dataset.micropubEndpoint;
      const payload = this.current
        ? { action: "update", url: this.current.managementUrl, replace: this.properties(status) }
        : { type: ["h-entry"], properties: this.properties(status) };
      this.setStatus(status === "draft" ? "Saving draft..." : "Publishing...");
      const result = await this.api(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!this.current) {
        const location = result.response.headers.get("Location") || result.body.url;
        this.current = { managementUrl: location };
      }
      await this.loadPosts();
      const updated = this.items.find((item) =>
        item.managementUrl === this.current?.managementUrl || item.publishedUrl === this.current?.managementUrl);
      if (updated) this.open(updated);
      this.setStatus(status === "draft" ? "Draft saved" : "Published");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async deleteOrRestore() {
    if (!this.current) return;
    const deleted = this.current.state === "deleted";
    if (!deleted && !window.confirm("Delete this item?")) return;
    try {
      await this.api(this.root.dataset.micropubEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: deleted ? "undelete" : "delete",
          url: this.current.managementUrl
        })
      });
      await this.loadPosts();
      this.newPost();
      this.setStatus(deleted ? "Item restored" : "Item deleted");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async upload() {
    const file = this.form.elements["media-file"].files?.[0];
    if (!file) {
      this.setStatus("Choose a media file first.", true);
      return;
    }
    try {
      this.setStatus(`Uploading ${file.name}...`);
      const data = new FormData();
      data.append("file", file);
      const endpoint = this.config?.["media-endpoint"];
      if (!endpoint) throw new Error("This Micropub server does not advertise a media endpoint.");
      const result = await this.api(endpoint, { method: "POST", body: data });
      this.form.elements.media.value = result.response.headers.get("Location") || result.body.url;
      this.setStatus("Upload complete");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async signOut() {
    const session = this.session;
    this.saveSession(null);
    this.current = null;
    this.items = [];
    this.renderAuth();
    this.renderList();
    this.setStatus("Signed out");
    if (session?.refreshToken && session?.tokenEndpoint) {
      fetch(`${session.tokenEndpoint}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: session.refreshToken, client_id: session.clientId })
      }).catch(() => {});
    }
  }
}

export const bindMicropubClients = (root = document) => {
  root.querySelectorAll("[data-micropub-app]").forEach((element) => {
    if (element.dataset.micropubBound !== "true") {
      new MicropubClient(element).init();
    }
  });
};

export const observeMicropubClients = () => {
  bindMicropubClients();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) bindMicropubClients();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};
