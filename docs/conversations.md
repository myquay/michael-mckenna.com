# Authoring conversations

Use `conversation` and `message` shortcodes inside any Markdown post. Each transcript is an inset panel matching the Windows 95 document theme. Messages appear in order, with a visible speaker, role, and automatic turn number.

````markdown
{{< conversation title="Choosing a simpler approach" note="Excerpt; shortened for clarity." >}}

{{< message role="human" name="Michael" >}}
Can you show a **small example**?
{{< /message >}}

{{< message role="ai" name="ChatGPT" >}}
Start with this:

```js
const greeting = "Hello";
console.log(greeting);
```

Then adapt it to your application.
{{< /message >}}

{{< /conversation >}}
````

Use the `{{< ... >}}` delimiters shown above. Put each shortcode on its own line, with blank lines between Markdown blocks. Every message and conversation needs its closing tag.

## Options

| Shortcode | Parameter | Behaviour |
| --- | --- | --- |
| `conversation` | `title` | Optional; defaults to “Conversation”. |
| `conversation` | `note` | Optional editorial note beneath the transcript. Use it to disclose omissions or edits. |
| `message` | `role` | Required: `human`, `ai`, or `system`. |
| `message` | `name` | Optional; defaults to Human, AI, or System. |
| `message` | `model` | Optional model identifier, shown beside the speaker. Include only when known and relevant. |

Titles, names, model identifiers, and notes are plain text. HTML in these fields is escaped. Message bodies support normal Markdown: paragraphs, emphasis, links, lists, blockquotes, tables, images, and highlighted code fences. Raw HTML follows the existing site configuration.

Consecutive turns from the same speaker are allowed. Add another `conversation` for a separate exchange; numbering restarts at 01. System instructions can be included with `role="system"` when they help explain the exchange.

Only message shortcodes may appear directly inside a conversation. Put commentary before or after the conversation, or in its `note`. Empty conversations, empty messages, missing/unsupported roles, orphan messages, and nested conversations fail the Hugo build with the source location.

## Reading and feeds

The entire exchange is visible without JavaScript. All turns use the article typography and full available width. Wide code blocks and tables can scroll horizontally. Speaker labels remain readable without styles, and the transcript is structured as a captioned figure containing an ordered list.

Both full pages and desktop window fragments use the same markup. The main, section, activity, and photo feeds include full post content when a post contains a conversation, even if it has an explicit summary break. Book feeds already include full content. Other entries retain their existing summary behaviour.

## Verification

Run `node --test scripts/tests/conversations.test.mjs` for the temporary Hugo fixtures, or `./scripts/verify-site.sh` for the full repository check. Fixtures are built outside the repository and are never published as posts.
