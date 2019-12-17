+++
date = "2019-07-01T13:11:12+12:00"
description = "Overview of implementing multi-tenancy in .NET core"
title = "Creating a multi-tenant .NET Core Application - Tenant specific options"
subtitle = "Tenant specific configuration options, part 3 of 4"
url = "/multi-tenant-asp-dot-net-core-application-tenant-specific-configuration-options"
tags = ["guide", "azure", "dot net core", "multitenant"]
summary = "This time we are looking at how we can configure options on a per-tenant basis any third party service that supports the Options Pattern."
+++

## Introduction

Today we will extend our multi-tenant solution to work nicely with the [ASP.NET Core Options Pattern](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options?view=aspnetcore-2.2). This will allow us to configure components using tenant specific configuration options. 

> **This post is compatible with .NET Core 2.2 only** <br />
> We make this compatible with [**.NET Core 3.1** (LTS release) in this post here](/multi-tenancy-compatibility-dot-net-core-three)

This is useful in situations where different tenants might have different settings _(connection strings, cookie policies etc)_, but the services we are configuring are unaware of the whole multi-tenant situation.

### Parts in the series

* Part 1: [Tenant resolution](/multi-tenant-asp-dot-net-core-application-tenant-resolution)
* Part 2: [Tenant containers](/multi-tenant-asp-dot-net-core-application-tenant-containers)
* *Part 3: Options configuration per tenant _(this post)_*
* Part 4: [Authentication per tenant](/multi-tenant-asp-dot-net-core-application-tenant-specific-authentication)
* Extra: [Upgrading to .NET Core 3.1 (LTS)](/multi-tenancy-compatibility-dot-net-core-three)

### Why have tenant specific options?

The options pattern is the preferred way to add strongly typed settings to ASP.NET Core applications. By enabling tenant specific options we can vary the settings of any component which uses the options pattern for configuration on a per tenant basis.

The implentation is very extensible and we will be touching four components to support multi-tenancy.

Integration points with the Options Pattern

* `IOptionsFactory<TOptions>:` Responsible for creating new _TOptions_ instances and applying options configuration
* `IOptionsMonitorCache<TOptions>:` Used by _IOptionsMonitor_ to cache _TOptions_ instances
* `IOptionsSnapshot<TOptions>:` Designed to be used in scenarios where the options need to be recalculated on each request
* `IOptions<TOptions>:` Used to retreive options but does not support _IOptionsMonitor_ scenarios and hence ignores our _IOptionsMonitorCache_ extension point

We just need to be careful when using this on thrid party libraries as those libraries may be doing something unexpected such as caching options internally unaware that we are varying it based on tenant so be sure to test any new library thoroughly;  better yet if it's open source read the source.

## Implementation

We are going to allow a user to modify options on a per-tenant basis after the options have been created. ASP.NET Core provides a way to do this called [Post Configuration](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options?view=aspnetcore-2.2#options-post-configuration), but we are going to jump in and allow changes before this step so the order of execution is clear if an application is already applying changes to options using this method.

### 1. Create tenant aware options cache

ASP.NET Core caches options for performance, however we don't want to let `Tenant 1` access `Tenant 2`'s cached options so we will be implementing our own tenant aware options cache.

We will achieve this by implementing the `IOptionsMonitorCache` interface to maintain a dedicated options cache per tenant.

```csharp

/// <summary>
/// Tenant aware options cache
/// </summary>
/// <typeparam name="TOptions"></typeparam>
/// <typeparam name="TTenant"></typeparam>
public class TenantOptionsCache<TOptions, TTenant> : IOptionsMonitorCache<TOptions>
    where TOptions : class
    where TTenant : Tenant
{

    private readonly ITenantAccessor<TTenant> _tenantAccessor;
    private readonly TenantOptionsCacheDictionary<TOptions> _tenantSpecificOptionsCache = 
        new TenantOptionsCacheDictionary<TOptions>();

    public TenantOptionsCache(ITenantAccessor<TTenant> tenantAccessor)
    {
        _tenantAccessor = tenantAccessor;
    }
    
    public void Clear()
    {
        _tenantSpecificOptionsCache.Get(_tenantAccessor.Tenant.Id).Clear();
    }

    public TOptions GetOrAdd(string name, Func<TOptions> createOptions)
    {
        return _tenantSpecificOptionsCache.Get(_tenantAccessor.Tenant.Id)
            .GetOrAdd(name, createOptions);
    }

    public bool TryAdd(string name, TOptions options)
    {
        return _tenantSpecificOptionsCache.Get(_tenantAccessor.Tenant.Id)
            .TryAdd(name, options);
    }

    public bool TryRemove(string name)
    {
        return _tenantSpecificOptionsCache.Get(_tenantAccessor.Tenant.Id)
            .TryRemove(name);
    }
}

```
<br />
The `TenantOptionsCacheDictionary` class just provides a wrapper over a concurrent dictionary which stores each options cache for the different tenants.
<br /><br />

```csharp

/// <summary>
/// Dictionary of tenant specific options caches
/// </summary>
/// <typeparam name="TOptions"></typeparam>
public class TenantOptionsCacheDictionary<TOptions> where TOptions : class
{
    /// <summary>
    /// Caches stored in memory
    /// </summary>
    private readonly ConcurrentDictionary<string, IOptionsMonitorCache<TOptions>> _tenantSpecificOptionCaches = 
        new ConcurrentDictionary<string, IOptionsMonitorCache<TOptions>>();

    /// <summary>
    /// Get options for specific tenant (create if not exists)
    /// </summary>
    /// <param name="tenantId"></param>
    /// <returns></returns>
    public IOptionsMonitorCache<TOptions> Get(string tenantId)
    {
        return _tenantSpecificOptionCaches.GetOrAdd(tenantId, new OptionsCache<TOptions>());
    }
}

```

### 2. Create tenant aware options factory 

The options factory is responsible for creating new options instances. Our tenant aware factory applys our tenant specific options updates after the initial configuration but before the post configuration step.

```csharp

 /// <summary>
/// Create a new options instance with configuration applied
/// </summary>
/// <typeparam name="TOptions"></typeparam>
/// <typeparam name="T"></typeparam>
internal class TenantOptionsFactory<TOptions, T> : IOptionsFactory<TOptions> 
    where TOptions : class, new()
    where T: Tenant
{

    private readonly IEnumerable<IConfigureOptions<TOptions>> _setups;
    private readonly IEnumerable<IPostConfigureOptions<TOptions>> _postConfigures;
    private readonly Action<TOptions, T> _tenantConfig;
    private readonly ITenantAccessor<T> _tenantAccessor;

    public TenantOptionsFactory(
        IEnumerable<IConfigureOptions<TOptions>> setups, 
        IEnumerable<IPostConfigureOptions<TOptions>> postConfigures, Action<TOptions, T> tenantConfig, ITenantAccessor<T> tenantAccessor)
    {
        _setups = setups;
        _postConfigures = postConfigures;
        _tenantAccessor = tenantAccessor;
        _tenantConfig = tenantConfig;
    }

    /// <summary>
    /// Create a new options instance
    /// </summary>
    /// <param name="name"></param>
    /// <returns></returns>
    public TOptions Create(string name)
    {
        var options = new TOptions();

        //Apply options setup configuration
        foreach(var setup in _setups)
        {
            if (setup is IConfigureNamedOptions<TOptions> namedSetup)
            {
                namedSetup.Configure(name, options);
            }
            else
            {
                setup.Configure(options);
            }
        }

        //Apply tenant specifc configuration (to both named and non-named options)
        if(_tenantAccessor.Tenant != null)
            _tenantConfig(options, _tenantAccessor.Tenant);

        //Apply post configuration
        foreach (var postConfig in _postConfigures)
        {
            postConfig.PostConfigure(name, options);
        }

        return options;
    }

```

### 3. Make create an IOptions implementation which is tenant aware

Here we just create a light-weight IOptions implementation which can grab the configured instance out of our tenant aware cache. 

```csharp

/// <summary>
/// Make IOptions tenant aware
/// </summary>
public class TenantOptions<TOptions> : 
    IOptions<TOptions>, IOptionsSnapshot<TOptions> where TOptions : class, new()
{
    private readonly IOptionsFactory<TOptions> _factory;
    private readonly IOptionsMonitorCache<TOptions> _cache;
    
    public TenantOptions(IOptionsFactory<TOptions> factory, IOptionsMonitorCache<TOptions> cache)
    {
        _factory = factory;
        _cache = cache;
    }

    public TOptions Value => Get(Options.DefaultName);

    public TOptions Get(string name)
    {
        return _cache.GetOrAdd(name, () => _factory.Create(name));
    }
}

```

### 4. Extend our tenant builder to register the options provider

We will update our tenant builder from the [first post](/multi-tenant-asp-dot-net-core-application-tenant-resolution) to configire the services to support tenant specifc options for a specific options class.

We will be configuring the four integration points we have created in steps 1 to 3.

```csharp

/// <summary>
/// Register tenant specific options
/// </summary>
/// <typeparam name="TOptions">Type of options we are apply configuration to</typeparam>
/// <param name="tenantOptionsConfiguration">Action to configure options for a tenant</param>
/// <returns></returns>
public TenantBuilder<T> WithPerTenantOptions<TOptions>(Action<TOptions, T> tenantConfig) where TOptions : class, new()
{
    //Register the multi-tenant cache
    _services.AddSingleton<IOptionsMonitorCache<TOptions>>(a => ActivatorUtilities.CreateInstance<TenantOptionsCache<TOptions, T>>(a));

    //Register the multi-tenant options factory
    _services.AddTransient<IOptionsFactory<TOptions>>(a => ActivatorUtilities.CreateInstance<TenantOptionsFactory<TOptions, T>>(a, tenantConfig));

    //Register IOptionsSnapshot support
    _services.AddScoped<IOptionsSnapshot<TOptions>>(a => ActivatorUtilities.CreateInstance<TenantOptions<TOptions>>(a));

    //Register IOptions support
    _services.AddSingleton<IOptions<TOptions>>(a => ActivatorUtilities.CreateInstance<TenantOptions<TOptions>>(a));

    return this;
}

```

Now any services which support the options pattern can be configured on a per-tenant basis.


## Example

Here's an example where we configure the cookie consent requirements based on which tenant is accessed.

```csharp

//Add multi-tenant services
services.AddMultiTenancy<KibbleTenant>()
    .WithHostStrategy()
    .WithPerTenantOptions<CookiePolicyOptions>((options, tenant) =>
    {
        options.ConsentCookie.Name = tenant.Id + "-consent";
        options.CheckConsentNeeded = context => tenant.IsBoundByGDPR,
    });

```

## Wrapping up

In this post we looked at how we can upgrade ASP.NET Core options pattern to support multi-tenancy. This allows us to apply tenant specific configuration changes to any service which uses the pattern. 
