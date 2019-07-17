+++
date = "2019-05-25T20:13:11+12:00"
description = "Overview of implementing multi-tenancy in .NET core"
title = "Creating a multi-tenant .NET Core Application - Tenant resolution"
subtitle = "Tenant resolution, part 1 of 5"
url = "/multi-tenant-asp-dot-net-core-application-tenant-resolution"
tags = ["guide", "azure", "dot net core", "multitenant"]
summary = "This series of blog posts is an exploration of how to achieve multi-tenancy in an ASP.NET Core web application. In this part of the series we resolve a request to a tenant and introduce the ability to access information about that tenant."
+++

## Introduction

This series of blog posts is an exploration of how to achieve multi-tenancy in an ASP.NET Core web application.  There's a lot of code snippets so you can follow along with your own sample app. There's no NuGet package you can plug and play at the end of this but it is a great learning exercise. It touches a few "core" _(sorry, not sorry)_ parts of the framework 😉

In this part of the series we resolve a request to a tenant and introduce the ability to access information about that tenant.

### Parts in the series

* *Part 1: Tenant resolution _(this post)_*
* Part 2: [Tenant containers](/multi-tenant-asp-dot-net-core-application-tenant-containers)
* Part 3: [Options configuration per tenant](/multi-tenant-asp-dot-net-core-application-tenant-specific-configuration-options)
* Part 4: [Authentication per tenant](/multi-tenant-asp-dot-net-core-application-tenant-specific-authentication)
* Part 5: Data isolation per tenant _(Upcoming)_

### What is a multi-tenant app exactly?

It's a single codebase that responds differently depending on which "tenant" is accessing it, there's a few different patterns you can use like

* **Application level isolation**: Spin up a new website and associated dependencies for each tenant
* **Multi-tenant app each with their own database**: Tenants use the same website, but have their own database
* **Multi-tenant app each with multi-tenant database**: Tenants use the same website, and the same database (need to be careful about not exposing data to the wrong tenant!!)

Here's a great [in-depth guide about each pattern](https://docs.microsoft.com/en-us/azure/sql-database/saas-tenancy-app-design-patterns). In this series we are exploring the multi-tenant app option.

### What's required in a multi-tenat app?

There's a few core requirements a multi-teant app will need to meet.

#### Tenant resolution

From the HTTP Request we will need to be able to decide which tenant context to run the request under, this impacts things like which database to access, or what configuration to use.

#### Per-tenant app configuration

The application might be configured differently depending on which tenant context is loaded, e.g. Authentication keys for OAuth providers, connection strings etc.

#### Per-tenant data isolation

A tenant will need to be able to access thier data, and their data alone. It should be difficult to expose data in cross tenant scenarios to avoid coding errors. This could be achieved by partitioning data within a single datastore or by using a datastore per-tenant.

## Tenant resolution

First we want to be able to identify which tenant a request is running under, but before we get too excited we need to decide what data we need to hold about a tenant, we really just need one piece of information currently, the tenant identifier.

```csharp
/// <summary>
/// Tenant information
/// </summary>
public class Tenant
{
    /// <summary>
    /// The tenant Id
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// The tenant identifier
    /// </summary>
    public string Identifier { get; set; }

    /// <summary>
    /// Tenant items
    /// </summary>
    public Dictionary<string, object> Items { get; private set; } = new Dictionary<string, object>();
}
```

We will use the `Id` as a durable reference to the tenant _(the Identifier may change e.g. the host domain changes)_.

We will use the `Identifier` to match a tenant based on our resolution strategy.

The property `Items` is just there to let develops add other things to the tenant during the request pipeline, they could also extend the class if they want specific properties or methods.

### Common tenant resolution strategies

We will use a resolution strategy to match a request to a tenant, the strategy should not rely on any external data to make it nice and fast.

#### Host header

The tenant will be inferred based on the host header sent by the browser, this is create if all your tenants have different domains e.g. `https://host1.example.com`, `https://host2.example.com` or `https://host3.com` if you are supporting custom domains.

E.g. if the host header was `https://host1.example.com` we would load `Tenant` with `Identifier` holding the value `host1.example.com`

#### Request Path

The tenant could be inferred based on the route, e.g. `https://example.com/host1/...`

#### Header valude

The tenant could be inferred based on a header value e.g. `x-tenant: host1`, this might be useful if all the tenants are accessable on a core api like `https://api.example.com` and the client can specify the tenant to use with a specific header.

### Defining the tenant resolution strategy

To let the application know which strategy to use we should be able to implement a `ITenantResolutionStrategy` service which resolves the request into a tenant identifier.

```csharp
public interface ITenantResolutionStrategy
{
    Task<string> GetTenantIdentifierAsync();
}
```

In this post, we will implement a strategy which resolves the tenant from the host.

```csharp
/// <summary>
/// Resolve the host to a tenant identifier
/// </summary>
public class HostResolutionStrategy : ITenantResolutionStrategy
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HostResolutionStrategy(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }
    
    /// <summary>
    /// Get the tenant identifier
    /// </summary>
    /// <param name="context"></param>
    /// <returns></returns>
    public async Task<string> GetTenantIdentifierAsync()
    {
        return await Task.FromResult(_httpContextAccessor.HttpContext.Request.Host.Host);
    }
}
```

## Tenant storage

Now we know which tenant to load, where do we fetch it from? That will need to be some kind of tenant store. We will need to implement a `ITenantStore` which accepts the tenant identifier and returns the `Tenant` information.

```csharp
public interface ITenantStore<T> where T : Tenant
{
    Task<T> GetTenantAsync(string identifier);
}
```

> Why'd I make the store generic? Just incase we wanted more application specific tenant info in the project that uses our library - we can just extend tenant to have any other properties that we need at the application level and configure the store appropriately 👍

If you want to store things like connection strings against a tenant it will need to be somewhere secure. In this post we are going to just do an in-memory implentation.

```csharp
 /// <summary>
/// In memory store for testing
/// </summary>
public class InMemoryTenantStore : ITenantStore<Tenant>
{
    /// <summary>
    /// Get a tenant for a given identifier
    /// </summary>
    /// <param name="identifier"></param>
    /// <returns></returns>
    public async Task<Tenant> GetTenantAsync(string identifier)
    {
        var tenant = new[]
            {
                new Tenant{ Id = "80fdb3c0-5888-4295-bf40-ebee0e3cd8f3", Identifier = "localhost" }
            }.SingleOrDefault(t => t.Identifier == identifier);

        return await Task.FromResult(tenant);
    }
}
```

## Intergrate with ASP.NET Core pipeline

There are two main components, registering your services so they can be resolved, and regsitering some middleware so you can add the tenant information to the current HttpContext during the request pipeline to make it avaialble to downstream consumers.

### Registering the services

Now we have a strategy in place for getting a tenant, and a location to retreive the tenant from, we need to register these services with the application container. By convention this looks something like `services.Add{thing}().{fluent-options}`. We will achieve this syntax with a builder pattern.

First we have a little extension to support the nice `.AddMultiTenancy()` syntax.

```csharp
/// <summary>
/// Nice method to create the tenant builder
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Add the services (application specific tenant class)
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static TenantBuilder<T> AddMultiTenancy<T>(this IServiceCollection services) where T : Tenant 
        => new TenantBuilder<T>(services);

    /// <summary>
    /// Add the services (default tenant class)
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static TenantBuilder<Tenant> AddMultiTenancy(this IServiceCollection services) 
        => new TenantBuilder<Tenant>(services);
}
```

Then we have the builder to provide the nice fluent extensions.

```csharp
/// <summary>
/// Configure tenant services
/// </summary>
public class TenantBuilder<T> where T : Tenant
{
    private readonly IServiceCollection _services;

    public TenantBuilder(IServiceCollection services)
    {
        _services = services;
    }

    /// <summary>
    /// Register the tenant resolver implementation
    /// </summary>
    /// <typeparam name="V"></typeparam>
    /// <param name="lifetime"></param>
    /// <returns></returns>
    public TenantBuilder<T> WithResolutionStrategy<V>(ServiceLifetime lifetime = ServiceLifetime.Transient) where V : class, ITenantResolutionStrategy
    {
        _services.TryAddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        _services.Add(ServiceDescriptor.Describe(typeof(ITenantResolutionStrategy), typeof(V), lifetime));
        return this;
    }


    /// <summary>
    /// Register the tenant store implementation
    /// </summary>
    /// <typeparam name="V"></typeparam>
    /// <param name="lifetime"></param>
    /// <returns></returns>
    public TenantBuilder<T> WithStore<V>(ServiceLifetime lifetime = ServiceLifetime.Transient) where V : class, ITenantStore<T>
    {
        _services.Add(ServiceDescriptor.Describe(typeof(ITenantStore<T>), typeof(V), lifetime));
        return this;
    }
}
```

Now in the `ConfigureServices` section of the `StartUp` class in your .NET Core web application you can add the following.

```csharp
services.AddMultiTenancy()
    .WithResolutionStrategy<HostResolutionStrategy>()
    .WithStore<InMemoryTenantStore>();
```

This API is great for getting going, but down the line you'd want to support passing through options e.g. maybe a pattern to extract the tenantId from the host if not using the entire domain etc, but it gets the job done for now.

At this point you will be able to inject the store or resolution strategy into a controller, but that's all a bit low level. You don't want to have to perform these resolution steps everywhere you want to access the Tenant. Let's next create a service to allow us to access the current tenant object.

```csharp
/// <summary>
/// Tenant access service
/// </summary>
/// <typeparam name="T"></typeparam>
public class TenantAccessService<T> where T : Tenant
{
    private readonly ITenantResolutionStrategy _tenantResolutionStrategy;
    private readonly ITenantStore<T> _tenantStore;

    public TenantAccessService(ITenantResolutionStrategy tenantResolutionStrategy, ITenantStore<T> tenantStore)
    {
        _tenantResolutionStrategy = tenantResolutionStrategy;
        _tenantStore = tenantStore;
    }

    /// <summary>
    /// Get the current tenant
    /// </summary>
    /// <returns></returns>
    public async Task<T> GetTenantAsync()
    {
        var tenantIdentifier = await _tenantResolutionStrategy.GetTenantIdentifierAsync();
        return await _tenantStore.GetTenantAsync(tenantIdentifier);
    }
}
```

And upgrading the builder to register this service

```csharp
public TenantBuilder(IServiceCollection services)
{
    services.AddTransient<TenantAccessService<T>>();
    _services = services;
}
```

Cool cool, now you can access the current tenant by injecting the service into your controller

```csharp
/// <summary>
/// A controller that returns a value
/// </summary>
[Route("api/values")]
[ApiController]
public class Values : Controller
{

    private readonly TenantAccessService<Tenant> _tenantService; 

    /// <summary>
    /// Constructor with required services
    /// </summary>
    /// <param name="tenantService"></param>
    public Values(TenantAccessService<Tenant> tenantService)
    {
        _tenantService = tenantService;
    }

    /// <summary>
    /// Get the value
    /// </summary>
    /// <param name="definitionId"></param>
    /// <returns></returns>
    [HttpGet("")]
    public async Task<string> GetValue(Guid definitionId)
    {
        return (await _tenantService.GetTenantAsync()).Id;
    }
}
```

And if you hit the endpoint you should see the tenant Id returned based on the URL

![](/images/2019-multitenant-01.png)

Great, all is looking good, next we can add some middleware to inject the curret `Tenant` into the `HttpContext`, this means we can get the `Tenant` wherever we can access the `HttpContext` for a bit more convienence so we no longer need to go around injecting our `TenantAccessService` everywhere.

### Registering the middleware

Middleware in ASP.NET Core allows you to place some logic into the [request processing pipeline](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/middleware/?view=aspnetcore-2.2). In our case we should have our middleware registered before anything that needs to access `Tenant` information, like the MVC middleware. That will likely need the tenant context in the controllers processing the request.

First let's create our middleware class, this will process the request and inject the `Tenant` into the current `HttpContext` - super simple.

```csharp
internal class TenantMiddleware<T> where T : Tenant
{
    private readonly RequestDelegate next;

    public TenantMiddleware(RequestDelegate next)
    {
        this.next = next;
    }

    public async Task Invoke(HttpContext context)
    {
        if (!context.Items.ContainsKey(Constants.HttpContextTenantKey))
        {
            var tenantService = context.RequestServices.GetService(typeof(TenantAccessService<T>)) as TenantAccessService<T>;
            context.Items.Add(Constants.HttpContextTenantKey, await tenantService.GetTenantAsync());
        }

        //Continue processing
        if (next != null)
            await next(context);
    }
}
```

Next we create a little syntatic sugar to register it

```csharp
/// <summary>
/// Nice method to register our middleware
/// </summary>
public static class IApplicationBuilderExtensions
{
    /// <summary>
    /// Use the Teanant Middleware to process the request
    /// </summary>
    /// <typeparam name="T"></typeparam>
    /// <param name="builder"></param>
    /// <returns></returns>
    public static IApplicationBuilder UseMultiTenancy<T>(this IApplicationBuilder builder) where T : Tenant 
        => builder.UseMiddleware<TenantMiddleware<T>>();


    /// <summary>
    /// Use the Teanant Middleware to process the request
    /// </summary>
    /// <typeparam name="T"></typeparam>
    /// <param name="builder"></param>
    /// <returns></returns>
    public static IApplicationBuilder UseMultiTenancy(this IApplicationBuilder builder) 
        => builder.UseMiddleware<TenantMiddleware<Tenant>>();
}
```

Finally we can register our middleware, the best place to do this is before middleware such as `MVC` which may require access to the `Tenant` information.

```csharp
app.UseMultiTenancy();
app.UseMvc()
```

Now the `Tenant` will be in the items collection but we don't really want to force the developer to find out where we've stored it, remember the type, need to cast it etc. So we'll create a nice extension method to pull out the current tenant information.

```csharp
/// <summary>
/// Extensions to HttpContext to make multitenancy easier to use
/// </summary>
public static class HttpContextExtensions
{
    /// <summary>
    /// Returns the current tenant
    /// </summary>
    /// <typeparam name="T"></typeparam>
    /// <param name="context"></param>
    /// <returns></returns>
    public static T GetTenant<T>(this HttpContext context) where T : Tenant
    {
        if (!context.Items.ContainsKey(Constants.HttpContextTenantKey))
            return null;
        return context.Items[Constants.HttpContextTenantKey] as T;
    }
    
    /// <summary>
    /// Returns the current Tenant
    /// </summary>
    /// <param name="context"></param>
    /// <returns></returns>
    public static Tenant GetTenant(this HttpContext context)
    {
        return context.GetTenant<Tenant>();
    }
}
```

Now we can upgrade our values controller to demostrate using the current `HttpContext` instead of injecting a service.

```csharp
/// <summary>
/// A controller that returns a value
/// </summary>
[Route("api/values")]
[ApiController]
public class Values : Controller
{
    /// <summary>
    /// Get the value
    /// </summary>
    /// <param name="definitionId"></param>
    /// <returns></returns>
    [HttpGet("")]
    public async Task<string> GetValue(Guid definitionId)
    {
        return await Task.FromResult(HttpContext.GetTenant().Id);
    }
}
```

If you run that you will get the same result 🙌

![](/images/2019-multitenant-01.png)

Woohoo, our application is **tenant aware**. That's a big milestone.

## Bonus, the tenant context accessor

In ASP.NET Core, to access the `HttpContext` in services [you use the `IHttpContextAccessor` service](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/http-context?view=aspnetcore-2.2), to provide a familiar access pattern to the Tenant information for a developer working on our application we can create a `ITenantAccessor` service. This will make the library feel familiar to developers used to the existing pattern.

First the interface

```csharp
public interface ITenantAccessor<T> where T : Tenant
{
    T Tenant { get; }
}
```

Then the implementation

```csharp
public class TenantAccessor<T> : ITenantAccessor<T> where T : Tenant
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public T Tenant => _httpContextAccessor.HttpContext.GetTenant<T>();
}
```

Now if a downstream developer wants to add a service to your app which needs to access the current tenant context they can just inject `ITenantAccessor<T>` in the exact same way as using `IHttpContextAccessor` ⚡⚡

Just go back an mark the `TenantAccessService<T>` class as internal so it's not used outside our assembly by mistake.

## Wrapping up

In this post we looked at how we can map a request to a tenant. We configured the application container to be able to resolve our tenancy services and even created an `ITenantAccessor` service to allow the tenant to be accessible inside other services just like `IHttpContextAccessor`. We also wrote custom middleware to inject the current tenant information into the `HttpContext` so it's easily accessable to downstream middleware and created a nice extension method so you can grab the current `Tenant` as easy as `HttpContext.GetTenant()`. In the next post _(upcoming)_ we will look at isolating data acess on a per tenant basis.

Next up in the series we look at how to [configure services on a per-tenant basis](/multi-tenant-asp-dot-net-core-application-tenant-containers) so that we can resolve a different implementation based on which tenant is active.