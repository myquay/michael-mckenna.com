+++
date = "2013-03-17T22:14:32+12:00"
description = "By default TempData is stored in session state, which means if the redirected request didn't hit the same instance then it would look like TempData was simply not set."
title = "ASP.NET MVC and TempData"
url = "/asp-net-mvc-and-tempdata"

+++

TempData initially seemed [kind of magical](http://msdn.microsoft.com/en-us/library/system.web.mvc.tempdatadictionary.aspx) and uber useful!

> Represents a set of data that persists only from one request to the next.

Today I almost used it in a multi-instance Azure set up which didn't use session state and so didn't have a central session store. Whoops. 

### Why was that bad?

By default TempData is stored in session state, which means if the redirected request didn't hit the same instance then it would look like TempData was simply not set.

### But what if I still want to use it?

You can specify an alternate TempData provider and store it somewhere else. [Greg Shackles has a great post here with all the details](http://www.gregshackles.com/2010/07/asp-net-mvc-do-you-know-where-your-tempdata-is/ "ASP.NET MVC: Do You Know Where Your TempData Is? «  Greg Shackles").

### I learned a valuable lesson today

Always thoroughly read the documentation and know the details. 

This potential bug wouldn't have presented itself on my development machine and would have resulted in some seemly random behaviour in stage.