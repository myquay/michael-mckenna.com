---
date: 2023-06-22T10:00:00+12:00
title: 'IConfigurationSection does not contain a definition for Get'
summary: 'I ran into this issue when upgrading from Microsoft.Extensions.Configuration.Abstractions 3.1.10 to 7.0.0'
slug: /iconfigurationsection-does-not-contain-a-definition-for-get
---

During maintenance I needed to upgrade some NuGet dependencies, one of them been Microsoft.Extensions.Configuration.Abstractions which was upgraded from 3.1.10 to 7.0.0. Which caused the following error


>    'IConfigurationSection' does not contain a definition for 'Get' and no accessible extension method 'Get' accepting a first argument of type 'IConfigurationSection' could be found (are you missing a using directive or an assembly reference?)


This method actually lives in the **Microsoft.Extensions.Configuration.Binder** assembly which was impacted by the Package reference changes affecting some NuGet packages: https://learn.microsoft.com/en-us/dotnet/core/compatibility/aspnet-core/5.0/extensions-package-reference-changes which recommends the following action.

>    Consumers of the affected packages should add a direct dependency on the removed package   dependency in their project if APIs from removed package dependency are used. The following table lists the affected packages and the corresponding changes. Microsoft.Extensions.Configuration.Binder	

So all we need to do to resolve the issue is jump back into NuGet and add a reference to **Microsoft.Extensions.Configuration.Binder** in our project directly as we're using an API from it.


