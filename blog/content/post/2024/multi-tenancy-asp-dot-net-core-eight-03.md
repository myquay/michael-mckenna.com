---
publishDate: 2024-04-21T23:29:12+12:00
title: Multi-tenancy in ASP.NET Core 8 - Tenant Specific Options
summary: In this post we will configure options on a per-tenant basis using the Options Pattern.
url: /multi-tenant-asp-dot-net-8-tenant-options
tags:
    - guide
    - azure
    - dot net core
    - multitenant
series: multi-tenant-net-8
concludeSeries: false
---

## Introduction

This post discusses how we can have tenant specific options in a multi-tenant ASP.NET Core 8 application that's compatible with the [ASP.NET Core Options Pattern](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options?view=aspnetcore-8.0).

## Overview of the implementation

There are a few moving parts in this one, so let's break down the particular parts of the ASP.NET Core pipeline that we need to provide alternatives for.

#### **`IOptionsMonitorCache<TOptions>`**

This is used by the `IOptionsMonitor<TOptions>` to cache `TOptions` instances, we provide an implementation that caches the options for each tenant.

#### **`IOptionsSnapshot<TOptions>`**

This is used when the `TOptions` instances need to be recomputed for each request.

#### **`IOptions<TOptions>`** 

This is registered at start up as a singleton and can be injected into any service lifetime. 

This is a very common pattern in ASP.NET Core for configuration and presents a problem because it's resolved without a tenant context. Because third party middleware might use this pattern we need to be able to resolve tenant specific options for these services. We will be discuss how to resolve this issue in the next post.

#### **`IConfigureOptions<TOptions>`**

This is used to configure the options, and is run before post-configurion occurs. We will need to be able to configure the options for each tenant so provide the ability here to configure the options differently depending on the current tenant context.

### The source code

You can see all the code in acton on [GitHub](https://github.com/myquay/MultiTenant.AspNetCore) and there's a [NuGet package](https://www.nuget.org/packages/MultiTenant.AspNetCore/) which you can use to implement multi-tenancy in your application.

## The implementation

The implementation consists of the following steps

1. Create a tenant aware `IOptionsMonitorCache<TOptions>`
2. Create a tenant aware `IOptionsSnapshot<TOptions>`/ `IOptions<TOptions>`
3. Create a tenant aware `IConfigureOptions<TOptions>`
4. Create the builder methods to allow easy setup of tenant specific options

### Create a tenant aware `IOptionsMonitorCache<TOptions>`

We don't want options to be shared between tenants so we need to create a cache that is tenant specific. To do this we will just wrap the default `OptionsCache<TOptions>` in a tenant specific cache.

```csharp
internal class MultiTenantOptionsCache<TOptions, T>(IMultiTenantContextAccessor<T> multiTenantContextAccessor) : IOptionsMonitorCache<TOptions>
    where TOptions : class where T : ITenantInfo
{

    private readonly IMultiTenantContextAccessor<T> multiTenantContextAccessor = multiTenantContextAccessor ??
                                          throw new ArgumentNullException(nameof(multiTenantContextAccessor));
    private readonly ConcurrentDictionary<string, IOptionsMonitorCache<TOptions>> tenantCaches = new();

    public void Clear()
    {
        var tenantId = multiTenantContextAccessor.TenantInfo?.Id ?? "no-tenant";
        tenantCaches.GetOrAdd(tenantId, new OptionsCache<TOptions>())
             .Clear();
    }

    public TOptions GetOrAdd(string? name, Func<TOptions> createOptions)
    {
        ArgumentNullException.ThrowIfNull(createOptions);

        name ??= Microsoft.Extensions.Options.Options.DefaultName;
        var tenantId = multiTenantContextAccessor.TenantInfo?.Id ?? "no-tenant";

        var cache = tenantCaches.GetOrAdd(tenantId, new OptionsCache<TOptions>());
        return cache.GetOrAdd(name, createOptions);
    }

    public bool TryAdd(string? name, TOptions options)
    {
        name ??= Microsoft.Extensions.Options.Options.DefaultName;
        var tenantId = multiTenantContextAccessor.TenantInfo?.Id ?? "no-tenant";

        var cache = tenantCaches.GetOrAdd(tenantId, new OptionsCache<TOptions>());
        return cache.TryAdd(name, options);
    }

    public bool TryRemove(string? name)
    {
        name ??= Microsoft.Extensions.Options.Options.DefaultName;
        var tenantId = multiTenantContextAccessor.TenantInfo?.Id ?? "no-tenant";

        var cache = tenantCaches.GetOrAdd(tenantId, new OptionsCache<TOptions>());
        return cache.TryRemove(name);
    }
}
```

### Create a tenant aware `IOptionsSnapshot<TOptions>`/ `IOptions<TOptions>`

We're going to provide a simple implementation which uses the tenant specific cache we created above.

```csharp
internal class MultiTenantOptionsManager<TOptions>(IOptionsFactory<TOptions> factory, IOptionsMonitorCache<TOptions> cache) : IOptionsSnapshot<TOptions> where TOptions : class
{
    public TOptions Value => Get(Microsoft.Extensions.Options.Options.DefaultName);

    public TOptions Get(string? name)
    {
        name ??= Microsoft.Extensions.Options.Options.DefaultName;
        return cache.GetOrAdd(name, () => factory.Create(name));
    }
}
```

### Create a tenant aware `IConfigureOptions<TOptions>`

We're going to provide a bridge between the `IConfigureOptions<TOptions>` and the tenant specific options. This will allow us to configure the options for each tenant.

```csharp
Services.AddSingleton<IConfigureOptions<TOptions>, ConfigureOptions<TOptions>>((IServiceProvider sp) =>
{
    var tenantAccessor = sp.GetRequiredService<IMultiTenantContextAccessor<T>>();
    return new ConfigureOptions<TOptions>((options) => tenantOptionsConfiguration(options, tenantAccessor.TenantInfo));

});
```

### Easy configuration

To provide a familiar developer experience we will extend the `TenantBuilder` to provide a `WithConfigure<TOptions>` variant that allows the developer to configure tenant specific options by passing in an action that configures the options which also has access to the current tenant.

```csharp
/// <summary>
/// Register tenant specific options
/// </summary>
/// <param name="configuration"></param>
/// <returns></returns>
public TenantBuilder<T> WithTenantedConfigure<TOptions>(Action<TOptions, T?> tenantOptionsConfiguration) where TOptions : class
{
    Services.AddOptions();

    Services.TryAddSingleton<IOptionsMonitorCache<TOptions>, MultiTenantOptionsCache<TOptions, T>>();
    Services.TryAddScoped<IOptionsSnapshot<TOptions>>((sp) =>
    {
        return new MultiTenantOptionsManager<TOptions>(sp.GetRequiredService<IOptionsFactory<TOptions>>(), sp.GetRequiredService<IOptionsMonitorCache<TOptions>>());
    });
    Services.TryAddSingleton<IOptions<TOptions>>((sp) =>
    {
        return new MultiTenantOptionsManager<TOptions>(sp.GetRequiredService<IOptionsFactory<TOptions>>(), sp.GetRequiredService<IOptionsMonitorCache<TOptions>>());
    });

    Services.AddSingleton<IConfigureOptions<TOptions>, ConfigureOptions<TOptions>>((IServiceProvider sp) =>
    {
        var tenantAccessor = sp.GetRequiredService<IMultiTenantContextAccessor<T>>();
        return new ConfigureOptions<TOptions>((options) => tenantOptionsConfiguration(options, tenantAccessor.TenantInfo));

    });

    return this;
}
```

### The result

Now we can configure tenant specific options using the options pattern in a very familiar way that's similar to how we also configure the services.

```csharp
//Add multi-tenant services
builder.Services.AddMultiTenancy<...>()
    ...
    .WithTenantedConfigure<RequestLocalizationOptions>((options, tenant) =>
    {
        var supportedCultures = tenant?.CultureOptions ?? ["en-NZ"];

        options.SetDefaultCulture(supportedCultures[0])
            .AddSupportedCultures(supportedCultures)
            .AddSupportedUICultures(supportedCultures);
    })
```

## Summary

In this post we looked at how to we extended the ASP.NET Core Options Pattern to support multi-tenanted scenarios. We created a tenant specific options cache and configuration. We also extended the `TenantBuilder` to provide a familiar developer experience for configuring tenant specific options.

All the code is available on [GitHub](https://github.com/myquay/MultiTenant.AspNetCore)