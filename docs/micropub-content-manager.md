# Micropub content manager

The editor now includes content folders, a searchable and sortable details list, focused forms, Content / Properties / Preview tabs, image previews, File / Edit / View / Help menus, application dialogs, and keyboard shortcuts. Ctrl/Cmd+S saves a draft and Ctrl/Cmd+N opens the type chooser. Arrow keys navigate the list and tabs. Closing or switching items prompts for unsaved edits.

The preview intentionally displays Markdown source instead of claiming to reproduce Hugo's renderer. No new rendering library or authentication mechanism is introduced.

## Supported authoring

Articles, notes, photos, activity, replies, likes, reposts, bookmarks, and blogroll entries use the existing Micropub API. The server's advertised types constrain new items. Existing types are locked to prevent unintended conversion. Structured or multiple media/content values are read-only, rather than silently flattened. Updates delete only cleared fields owned by the active editor and preserve unrelated properties. Publication dates retain their original precision when unchanged.

Photo uploads use the advertised media endpoint. Images can also use HTTP(S) URLs or site-relative paths. The app does not delete uploaded assets when an entry is deleted.

## Backend follow-up needed for the full plan

Read-only inspection of the adjacent LittlePublisher checkout identified these limits. This change does not modify that repository or deploy either service.

- `MicropubController.GetPostsAsync` caps results at 50 and has no continuation parameter. Filters operate on that returned set. Add a stable cursor and filter before pagination, plus import/discovery of repository content not already represented in storage, to manage the entire archive.
- Pages and projects are not advertised or projected to their respective Hugo sections. Add source-preserving import/update support before enabling them. Existing aliases, paths, front matter and unknown fields must survive editing.
- `MicropubController.ToSourceProperties` populates `url` with the entry URL before merging the stored properties. For blogroll entries this masks the linked website. Return the stored website URL for blogroll source requests, keeping management and published URLs in their existing separate response fields. The editor detects this collision, preserves the stored website on a draft save, and requires the website to be re-entered before publishing.
- `PostPublicationService.PublishAsync` passes `Name` only for articles. This causes photo/activity names to be regenerated and blogroll names to fall back to slugs. Preserve the stored title for content types that support names.
- Events, audio and video are advertised but their dedicated fields are not projected by `MarkdownContentGenerator`, and the site's document template does not render them. Complete both ends before enabling creation in this client.
- There is no deployment-status query in the current client contract. The app reports publication acceptance and deployment pending, rather than claiming the public site is already updated.
- The backend regenerates Markdown on publication. Client-side property preservation alone cannot guarantee lossless round trips for arbitrary imported front matter; the backend requires source-aware updates for that guarantee.

## Verification

`./scripts/verify-site.sh` runs the unit tests, Hugo build, bundle syntax check and local link/asset verification. New unit cases cover cleared fields, preservation of hidden metadata, date precision and library filtering.

A local headless Chrome run with intercepted Micropub responses verified note field visibility, photo previews, blogroll editing, discard/cancel handling, explicit property deletion, preserved timestamps, failed-save recovery, window-close cancellation, keyboard tab navigation, and absence of runtime errors. No live writes were performed. Live create/publish/delete/restore verification remains necessary after the backend changes, using dedicated test content.
