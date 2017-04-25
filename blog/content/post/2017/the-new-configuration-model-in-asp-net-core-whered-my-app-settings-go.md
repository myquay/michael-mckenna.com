+++
date = "2016-11-28T20:52:32+12:00"
description = "web.config is simply not needed any more as ASP.NET Core can be hosted on any old platform and web.config is strictly used for IIS Configuration."
title = "The New Configuration Model in ASP.NET Core: Where'd My App Settings go?"
url = "/the-new-configuration-model-in-asp-net-core-whered-my-app-settings-go"
draft = true
+++

If you fire up a new ASP.NET Core web project you'll notice a tonne of changes compared to the other versions of ASP.NET. One of the major changes is how applications are configured - web.config is simply not needed any more as ASP.NET Core can be hosted on any old platform and web.config is strictly used for IIS Configuration. 

If you create a new ASP.NET Core MVC project there will be a web.config for IIS support but it'll be very sparse and will have this comment up the top

```
  <!--
    Configure your application settings in appsettings.json. Learn more at
    http://go.microsoft.com/fwlink/?LinkId=786380
  -->
```

So how do I configure my appsetings.json?? Yay JSON, but what is that file, and how do I use it, what about Azure App Services settings defined through the portal?

##### How web.config worked

Before we jump into the new configuration model, we'll just recap how it is done other versions of .NET

There's the web.config file, and inside the web.config file there's an appSettings element which contains all your app settings in a key-value format.

```
<appSettings>
    <add key="webpages:Version" value="3.0.0.0" />
    <add key="webpages:Enabled" value="false" />  
    <add key="ClientValidationEnabled" value="true" />
    <add key="UnobtrusiveJavaScriptEnabled" value="true" />
    ...
</appSettings>
```

Accessing these settings was super easy using the ConfigurationManager.

```
ConfigurationManager.AppSettings["ClientValidationEnabled"];
```

You could even apply XSLT transforms to change the settings for each environment or override the settings in the Azure App Service portal to help keep confidential keys away from the contractors and developers.

But this is all gone in favour of a format that is not so IIS centric. 