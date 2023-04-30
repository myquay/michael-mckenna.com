---
publishDate: 2016-11-28T20:52:32+12:00
title: Could not load file or assembly 'Microsoft.VisualStudio.Web.PageInspector.Loader...
slug: /could-not-load-file-or-assembly-microsoft-visualstudio-web-pageinspector-loader
aliases: 
    - /could-not-load-file-or-assembly-microsoft-visualstudio-web-pageinspector-loader
---

[VS 2017 RC is out](https://www.visualstudio.com/vs/visual-studio-2017-rc/), no better time to go remove any old versions of Visual Studio I have lying around. However, when I uninstalled an old version of VS 2012 Express - boom, all my local sites stopped working with the following missing assembly error.

```
Could not load file or assembly 'Microsoft.VisualStudio.Web.PageInspector.Loader, Version=1.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a' or one of its dependencies. The module was expected to contain an assembly manifest.
```

It looks like it's an assembly that VS 2012 adds which is why it's no longer available after uninstall, but we are still trying to reference it somewhere.

This assembly wasn't referenced anywhere in my projects, but the web.config works on a hierarchy system so all we need to do is go up the chain. I eventually located the reference to the non-existent assembly in the root web.config (stored in the same folder as the machine.config - the folder that looks something like `C:\Windows\Microsoft.NET\Framework\v4.0.30319\Config` and/or `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Config` depending on your setup). 

Once you've found the reference - delete it. It will look something like this.
```
<add assembly="Microsoft.VisualStudio.Web.PageInspector.Loader, Version=1.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a" />
```

Problem solved!