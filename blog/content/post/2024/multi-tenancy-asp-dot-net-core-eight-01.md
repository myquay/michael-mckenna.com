---
publishDate: 2024-03-03T23:29:12+12:00
title: Multi-tenancy in ASP.NET Core 8 (LTS) - Tenant Resolution
summary: Can you believe it, just like that it's been 4 and a half years since I wrote my initial series on multi-tenancy in ASP.NET and now .NET Core 8 is out. In this post I revisit multi-tenancy in ASP.NET Core and take a fresh look at how I'd implement multi-tenancy today.
url: /multi-tenancy-compatibility-dot-net-core-eight
tags:
    - guide
    - azure
    - dot net core
    - multitenant
series: multi-tenant-net-8
concludeSeries: false
draft: true
---

## Introduction

Can you believe it, just like that it's been 4 and a half years since I wrote my initial series on [multi-tenancy](/multi-tenant-asp-dot-net-core-application-tenant-resolution) which was based on .NET Core 2.2. Later I looked at how'd you'd modify the approach for [.NET Core 3.1](https://devblogs.microsoft.com/dotnet/announcing-net-core-3-1/). Now .NET Core 8 is out and I thought it would be a good time to revisit multi-tenancy in ASP.NET Core and take a fresh look at how I'd implement multi-tenancy today.

In this first installment of the series we'll look at how to resolve the tenant from the request.

## What is multi-tenancy?

You can achieve [multi-tenancy in a number of ways](https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns?view=azuresql), the most common are:

* Standalone app: Redeploy the application for each tenant
* Database per tenant: Each tenant has their own database, but the application is shared
* Sharded multi-tenant: All tenants share the same database, but tenant data is partitioned

In this series we will be looking at the last option where a single deployed instance of your application has the ability to host multiple tenants. Each tenant shares the same infrastrucutre (including the application and database) to reduce hosting costs. Tenant isolation is enforced at the code level. This is a common requirement for SaaS applications where you want to host multiple customers on a single instance of your application.

There's a few core requirements that we need to meet to support multi-tenancy in ASP.NET Core:

### Tenant resolution

We need a way to identify which tenant is making the current request. This could be a domain, a path, or a header in the request.

### Tenant specific settings

The applicaiton might be configured differently depending on the which tenant context is loaded, e.g. the tenant's name, connection string, and other such things.

### Tenant data isolation

We need to ensure that tenant data is isolated from other tenants. This could be at the database level, or at the code level; regardless, we need to ensure that a tenant can't access another tenant's data.

### TL;DR

Just want to see it in action? You can find the code for this post on [GitHub](https://github.com/myquay/Microsoft.AspNetCore.Contrib.MultiTenant). I refer to the library quite a bit in this post so it's worth checking out to see how it all fits together.

## Tenant Resolution

First things first we need a way to identify which tenant is making the current request, to do this we need to be able to extract something from the HTTP request that identifies which tenant we need to load. 

To do this we use a `ITenantResolutionStrategy` to extract the tenant identifier from the request. For example this could be a domain, a path, or a header in the request.

In the library we define a `HostResolutionStrategy` which uses the request host to resolve the tenant. This is a common approach for SaaS applications where each tenant has their own subdomain.

```csharp
/// <summary>
/// Resolve the host to a tenant identifier
/// </summary>
internal class HostResolutionStrategy(IHttpContextAccessor httpContextAccessor) : ITenantResolutionStrategy
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;

    /// <summary>
    /// Get the tenant identifier
    /// </summary>
    /// <param name="context"></param>
    /// <returns></returns>
    public async Task<string> GetTenantIdentifierAsync()
    {
        if (_httpContextAccessor.HttpContext == null)
            throw new InvalidOperationException("HttpContext is not available");

        return await Task.FromResult(_httpContextAccessor.HttpContext.Request.Host.Host);
    }
}
```

Once we have the identifier we can then use a `ITenantLookupService` to fetch the tenant information for that identifier. This could be from a database, a configuration file, or any other source of truth for tenant information.

In the library we define a `InMemoryTenantLookupService` which is a simple implementation that stores the tenant information in memory. This is useful for testing and development.

```csharp
internal class InMemoryLookupService<T>(IEnumerable<T> Tenants) : ITenantLookupService<T> where T : ITenantInfo
{
    public Task<T> GetTenantAsync(string identifier)
    {
        return Task.FromResult(Tenants.Single(t => t.Identifier == identifier));
    }
}
```

Because we don't know what kind of information an application requires about a tenant we define a simple interface `ITenantInfo` which contains the minimum amount of information we need to know to resolve a tenant. 

```csharp
/// <summary>
/// Tenant information
/// </summary>
public interface ITenantInfo
{
    /// <summary>
    /// The tenant Id
    /// </summary>
    string Id { get; set; }

    /// <summary>
    /// The tenant identifier
    /// </summary>
    string Identifier { get; set; }

}
```

The implementing application can implement `ITenantLookupService`, `ITenantInfo` and `ITenantLookupService` to resolve the tenant in a way that makes sense for their application.

Other tenant resolution strategies and lookup services can be implemented to resolve tenants in different ways, for example a `PathResolutionStrategy` could be used to resolve tenants based on the request path.

### Integration with ASP.NET Core pipeline

There are two main aspects to integrating the tenant resolution strategy and lookup service with the ASP.NET Core pipeline:

1. Registering the tenant resolution strategy and lookup service with the dependency injection container
1. Setting the current tenant on the `IMultiTenantContextAccessor` for each request making the tenant available to the rest of the application through ambient context.

#### Registering the services

To provide a familiar developer experience to other ASP.NET Core services we will use the builder pattern to register the tenant resolution strategy and lookup service with the dependency injection container.

First an extension method to support the `.AddMultiTenancy<TenantOptions>()` pattern.

```csharp
/// <summary>
/// Nice method to create the tenant builder
/// </summary>
public static class WebBuilderExtensions
{
    /// <summary>
    /// Add the services
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static TenantBuilder<T> AddMultiTenancy<T>(this IServiceCollection Services) where T : ITenantInfo
    {
        //Provide ambient tenant context
        Services.AddScoped<IMultiTenantContextAccessor<T>, AsyncLocalMultiTenantContextAccessor<T>>();

        //Register middleware to populate the ambient tenant context early in the pipeline
        Services.Insert(0, ServiceDescriptor.Transient<IStartupFilter>(provider => new MultiTenantContextAccessorStartupFilter<T>()));

        return new TenantBuilder<T>(Services);
    }
}
```

It does a few things, it registers the `IMultiTenantContextAccessor` and a `IStartupFilter` to set the current tenant on the `IMultiTenantContextAccessor` early on in the pipeline so the ambient tenant context is available for all downstream processing. 

Then it returns a `TenantBuilder` which is used to provide the "fluent" extensions to register the application specific tenant resolution strategy and lookup service.

```csharp
 /// <summary>
 /// Tenant builder
 /// </summary>
 /// <param name="services"></param>
 public class TenantBuilder<T>(IServiceCollection Services) where T : ITenantInfo
 {
     /// <summary>
     /// Register the tenant resolver implementation
     /// </summary>
     /// <typeparam name="V"></typeparam>
     /// <param name="lifetime"></param>
     /// <returns></returns>
     public TenantBuilder<T> WithResolutionStrategy<V>() where V : class, ITenantResolutionStrategy
     {
         Services.TryAddSingleton<IHttpContextAccessor, HttpContextAccessor>();
         Services.TryAddSingleton(typeof(ITenantResolutionStrategy), typeof(V));
         return this;
     }

     /// <summary>
     /// Register the tenant lookup service implementation
     /// </summary>
     /// <typeparam name="V"></typeparam>
     /// <param name="lifetime"></param>
     /// <returns></returns>
     public TenantBuilder<T> WithTenantLookupService<V>() where V : class, ITenantLookupService<T>
     {
         Services.TryAddSingleton<ITenantLookupService<T>, V>();
         return this;
     }

 }
```

#### Setting the current tenant

We tocuhed on this earlier with the following piece of code from the builder extensions

```csharp
//Register middleware to populate the ambient tenant context early in the pipeline
        Services.Insert(0, ServiceDescriptor.Transient<IStartupFilter>(provider => new MultiTenantContextAccessorStartupFilter<T>()));
```

This is a `IStartupFilter` which is used to register middleware that sets the current tenant on the `IMultiTenantContextAccessor` for each request. This is important because we want the tenant to be available as [early as possible in the request pipeline](https://andrewlock.net/exploring-istartupfilter-in-asp-net-core/).

The middleware itself is very simple, it just uses the tenant resolution strategy and lookup service to set the current tenant on the `IMultiTenantContextAccessor` for each request.

```csharp
/// <summary>
/// This middleware is responsible for setting up the scope for the tenant specific request services
/// </summary>
/// <typeparam name="T"></typeparam>
/// <param name="tenantServicesConfiguration"></param>
internal class MultiTenantContextAccessorMiddleware<T>(RequestDelegate next, IHttpContextAccessor httpContextAccessor, IMultiTenantContextAccessor<T> TenantAccessor, ITenantLookupService<T> TenantResolver, ITenantResolutionStrategy TenantResolutionStrategy) where T : ITenantInfo
{

    /// <summary>
    /// Set the services for the tenant to be our specific tenant services
    /// </summary>
    /// <param name="context"></param>
    /// <returns></returns>
    public async Task Invoke(HttpContext context)
    {
        //Set context if missing so it can be used by the tenant services to resolve the tenant
        httpContextAccessor.HttpContext ??= context;
        TenantAccessor.TenantInfo ??= await TenantResolver.GetTenantAsync(await TenantResolutionStrategy.GetTenantIdentifierAsync());
        await next.Invoke(context);
    }
}
```

### The result

Now you can inject IMultiTenantContextAccessor<T> into your controllers and services to access the current tenant.

```csharp
/// <summary>
/// A controller that returns a value
/// </summary>
[Route("api/values")]
[ApiController]
public class Values : Controller
{

    private readonly IMultiTenantContextAccessor<Tenant> _tenantService; 

    /// <summary>
    /// Constructor with required services
    /// </summary>
    /// <param name="tenantService"></param>
    public Values(IMultiTenantContextAccessor<Tenant> tenantService)
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
        return (await _tenantService.TenantInfo?.Identifier);
    }
}

```

## Summary

In this post we looked at how to resolve the tenant from the request. We looked at how to use a `ITenantResolutionStrategy` to extract the tenant identifier from the request and a `ITenantLookupService` to fetch the tenant information for that identifier. We then looked at how to integrate the tenant resolution strategy and lookup service with the ASP.NET Core pipeline to make the current tenant available to access through ambient context.