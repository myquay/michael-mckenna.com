---
date: 2023-07-07T9:00:00+12:00
title: 'HttpCompletionOption.ResponseHeadersRead'
slug: /httpcompletionoption-responseheadersread
---

By default .NET HttpClient will download the entire respones into memory before returning control to the caller. Which means if you're processing data from the stream, your process won't start operating on the stream until the entire response has been buffered into memory.

```csharp
using var feedData = await client.GetAsync(feedUri);
using var reader = XmlReader.Create(await feedData.Content.ReadAsStreamAsync())
```

The default behaviour makes is okay because the response is loaded into memory and the sockets freed up as quickly as possible, however for the application I was working on ([FeedMD - RSS/Atom to MD feed converter](https://github.com/myquay/feedmd)) if there's no new posts we might decide to stop processing the feed very early on. I wanted to start acting on the stream right away.

In this case `GetAsync` accepts a second parameter of type `HttpCompletionOption`. If we update our code to pass in `HttpCompletionOption.ResponseHeadersRead` like so

```csharp
using var feedData = await client.GetAsync(feedUri);
using var reader = XmlReader.Create(await feedData.Content.ReadAsStreamAsync(), HttpCompletionOption.ResponseHeadersRead)
```

Then `GetAsync` will return as soon as the headers have been fully read and will allow us to process the stream directly from the socket without the intermediate memory buffer.