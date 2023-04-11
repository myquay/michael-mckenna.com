+++
date = "2013-03-17T22:14:32+12:00"
description = "By default TempData is stored in session state, which means if the redirected request didn't hit the same instance then it would look like TempData was simply not set."
title = "ASP.NET MVC and TempData"
url = "/asp-net-mvc-and-tempdata"
tags = ["asp dot net mvc"]
+++

TempData initially seemed [kind of magical](http://msdn.microsoft.com/en-us/library/system.web.mvc.tempdatadictionary.aspx) and uber useful!

> Represents a set of data that persists only from one request to the next.

Today I ran into an issue on a multi-instance set up which didn't use shared session state and and didn't have a central session store.

### What went wrong?

By default TempData is stored in session state, which means if the redirected request didn't hit the same instance then it would look like TempData was simply not set.

This bug wouldn't have presented itself on my development environment and resulted in some seemly random behaviour with a multi-instance deployment.

### But what if I still want to use it?

You can specify an alternate TempData provider and store it somewhere else. [Greg Shackles has a great post here with all the details](https://gregshackles.com/asp-net-mvc-do-you-know-where-your-tempdata-is/ "ASP.NET MVC: Do You Know Where Your TempData Is?").