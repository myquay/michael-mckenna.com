+++
date = "2013-04-24T11:40:32+12:00"
description = "If the user navigated away then used the back button they would be shown the original page with the original data. They'd then think the fancy JavaScript was completely broken."
title = "The back button and browser caching"
url = "/the-back-button-and-browser-caching"
+++

I [recently found out](http://blog.55minutes.com/2011/10/how-to-defeat-the-browser-back-button-cache/ "How to Defeat the Browser Back Button Cache • 55 Minutes Blog") that browsers absolutely love serving up cached pages when the user uses the back button.

### How was this a problem?

We had an issue where we'd update a page in place and save the changes using JavaScript. If the user navigated away then used the back button they would be shown the original page with the original data. They'd then think the fancy JavaScript was completely broken.

That makes a developer sad face. Especially when they put a whole bunch of effort in to creating such a seamless editing experience.

### How do we change this behaviour?

As mentioned [in that article on 55 minutes](http://blog.55minutes.com/2011/10/how-to-defeat-the-browser-back-button-cache/ "How to Defeat the Browser Back Button Cache • 55 Minutes Blog") you can simply configure the cache-control header correctly.

### How do we do that in ASP.NET MVC?

To control this behaviour in MVC I used a simple action filter attribute.

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

Now on any action that I don't want to be cached (even by the browser back button) I just need to decorate it like so

    [NoCache]
    public ActionResult Index()
    {

If you inspect the HTTP Response you should see the following header

    Cache-Control:no-cache, must-revalidate, no-store

\#tooeasy