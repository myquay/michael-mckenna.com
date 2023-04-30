---
publishDate: 2013-04-24T11:40:32+12:00
title: The back button and browser caching
summary: If the user navigated away then used the back button they would be shown the original page with the original data. They'd then think the fancy JavaScript was completely broken.
url: /the-back-button-and-browser-caching
tags:
    - browser
---

I [recently found out](https://stackoverflow.com/questions/49547/how-do-we-control-web-page-caching-across-all-browsers/ "How do we control web page caching, across all browsers?") that browsers absolutely love serving up cached pages when the user uses the back button.

### How was this a problem?

We had an issue where we'd update a page in place and save the changes using JavaScript. If the user navigated away then used the back button they would be shown the original page with the original data. They'd then think the changes weren't saved. There's also a few other areas such as security applications which might not want to redisplay content for reasons.

### How do we change this behaviour?

The history list is not actually a cache so is not subject to freshness directives, although in practice cache control headers tend to influence the back button behaviour. So setting some cache-control headers seems to be your best bet - the key directives browers respect are `no-store` and `must-revalidate`.

### How do we do that in ASP.NET MVC?

To control this behaviour in MVC I used a simple action filter attribute.

```csharp
public class NoCacheAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext filterContext)
    {
        HttpCachePolicyBase cache = filterContext.HttpContext.Response.Cache;
        cache.SetCacheability(HttpCacheability.NoCache);
        cache.SetMaxAge(TimeSpan.Zero);
        cache.AppendCacheExtension("must-revalidate, no-store"); 
    }
}
```

Now on any action that I don't want to be cached (even by the browser back button) I just need to decorate it like so

```csharp
[NoCache]
public ActionResult Index()
{
```

If you inspect the HTTP Response you should see the following header

`Cache-Control:no-cache, must-revalidate, no-store`