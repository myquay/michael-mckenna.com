---
publishDate: 2024-04-13T23:29:12+12:00
title: Multi-tenancy in ASP.NET Core 8 - Dependency Injection & Tenant Specific Services
summary: In this post we look at how to have tenant specific services in a multi-tenant application in ASP.NET Core 8.
url: /multi-tenant-asp-dot-net-8-tenant-services
tags:
    - guide
    - azure
    - dot net core
    - multitenant
series: multi-tenant-net-8
concludeSeries: false
---

## Introduction

This post discusses how we can have tenant specific services in a multi-tenant ASP.NET Core 8 application. 

We'll look at how we can modify the `IServiceProvider` behind `RequestServices` to proivde the capability to resolve different services for different tenants. This is useful if you want a tenant specific configuration for a resolved service or even a completely different implementation returned.

### Acknowledgements

First I want to acknowledge the huge amount of great information out there that really helped me out. I found these resources particularly good

* [This StackOverflow post](https://stackoverflow.com/questions/38940241/autofac-multitenant-in-an-aspnet-core-application-does-not-seem-to-resolve-tenan/38960122#38960122)
Great highlevel overview

* [Andrew Lock's blog](https://andrewlock.net/exploring-dotnet-6-part-10-new-dependency-injection-features-in-dotnet-6/)
I've linked one post but there's a lot of great information on his blog

* [AutoFac Multi-Tenant](https://github.com/autofac/Autofac.AspNetCore.Multitenant)
Excellent codebase that helped me understand some interactions with the ASP.NET dependency injection services

## Overview of the implementation

Before we get into it let's take a look at the how the default DI container works in ASP.NET Core. [A basic understanding of how dependency injection works in ASP.NET Core is essential here](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection?view=aspnetcore-8.0).

#### The root service provider
We start with a service collection that we can register services with during application startup. Everyone is familiar with this part of the ASP.NET Core pipeline. It's all `builder.Services.AddHttpContextAccessor()` and `builder.Services.AddControllers()` etc. When the application starts up, the `IServiceProvider` is created from the service collection. This is the "root" `IServiceProvider`. 

#### The scoped service provider
When a request comes in, the root provider is scoped automatically for each request to allow you to resolve scoped services. These services can be accessed from the `RequestServices` property on the `HttpContext` which is the scoped `IServiceProvider` for the current request. All these scoped services are automatically disposed of at the end of the request.

### How to make this tenant aware

To make this process tenant aware we need to be able to modify the services registered in the root `IServiceCollection` and build a new `IServiceProvider` specific for the current tenant. 

The big departure here is that we don't actually know the tenant until the request comes in so we need to be able to build a new `IServiceProvider` for the current tenant during runtime at the start of the request. 

Then the scoped `IServiceProvider` for the current request can be built from this new tenant specific `IServiceProvider`.

#### The goal
Our plan is to be able to configure the tenant container ahead of the scoped request services but after we have establised our tenant context.

![](/images/2024/request-services.png)

### The source code

You can see all the code in acton on [GitHub](https://github.com/myquay/MultiTenant.AspNetCore) and there's a [NuGet package](https://www.nuget.org/packages/MultiTenant.AspNetCore/) which you can use to implement multi-tenancy in your application.

 I refer to the library quite a bit in this post so it's worth checking out to see how it all fits together.

## The implementation

The implementation consists of the following steps

1. Create a service provider factory that can create a tenant specific `IServiceProvider` from the root `IServiceCollection`
2. Create a scope factory that can create a tenant specific `IServiceScope` from the tenant specific `IServiceProvider`
3. Create a middleware that replaces the `IServiceProvidersFeature` with one that can use the tenant specific `IServiceProvider`
4. Making it easy to configure by extending support to the TenantBuilder

### Create the service provider factory

The service provider factory is responsible for creating a tenant specific `IServiceProvider` from the root container. It does this by creating a new `IServiceCollection` and copying all the services from the root container. It then uses the tenant service configuration action to add tenant specific services to the new container.

```csharp
/// <summary>
/// Factory for creating tenant specific service providers
/// </summary>
/// <typeparam name="T"></typeparam>
internal class MultiTenantServiceProviderFactory<T>(IServiceCollection containerBuilder, Action<IServiceCollection, T?> tenantServiceConfiguration) where T : ITenantInfo
{

    //Cache compiled providers
    private readonly ConcurrentDictionary<string, Lazy<IServiceProvider>> CompiledProviders = new();

    public IServiceProvider GetServiceProviderForTenant(T tenant)
    {
        return CompiledProviders.GetOrAdd(tenant.Id, (key) => new Lazy<IServiceProvider>(() =>
        {
            //Add all default services
            var container = new ServiceCollection();
            foreach (var service in containerBuilder)
                container.Add(service);

            //Add tenant specific services
            tenantServiceConfiguration(container, tenant);
            return container.BuildServiceProvider();

        })).Value;
    }
}
```

### Create the scope factory

The scope factory is responsible for creating a tenant specific `IServiceScope` from the tenant specific `IServiceProvider`. This is an integration point with the ASP.NET Core pipeline and implements `IServiceScopeFactory` so it can be used to create the scoped `IServiceProvider` for the current request. This is what the `RequestServices` property on the `HttpContext` uses to resolve services for the current request.

```csharp
/// <summary>
/// Factory wrapper for creating service scopes
/// </summary>
/// <param name="serviceProvider"></param>
internal class MultiTenantServiceScopeFactory<T>(MultiTenantServiceProviderFactory<T> ServiceProviderFactory, IMultiTenantContextAccessor<T> multiTenantContextAccessor) : IMultiTenantServiceScopeFactory where T : ITenantInfo
{

    /// <summary>
    /// Create scope
    /// </summary>
    /// <returns></returns>
    public IServiceScope CreateScope()
    {
        var tenant = multiTenantContextAccessor.TenantInfo ?? throw new InvalidOperationException("Tenant context is not available");
        return ServiceProviderFactory.GetServiceProviderForTenant(tenant).CreateScope();
    }
}

public interface IMultiTenantServiceScopeFactory : IServiceScopeFactory
{ }
```

### Create the middleware 

The middleware is responsible for replacing the `IServiceProvidersFeature` with one that can use the tenant specific `IServiceProvider` when creating new service scopes. This is the integration point which allows us to use tenant specific scoped services for the rest of the request.

```csharp
/// <summary>
/// This middleware is responsible for setting up the scope for the tenant specific request services
/// </summary>
/// <typeparam name="T"></typeparam>
/// <param name="tenantServicesConfiguration"></param>
internal class MultiTenantRequestServicesMiddleware<T>(RequestDelegate next, IMultiTenantServiceScopeFactory multiTenantServiceProviderScopeFactory, IHttpContextAccessor httpContextAccessor, IMultiTenantContextAccessor<T> TenantAccessor, ITenantLookupService<T> TenantResolver, ITenantResolutionStrategy TenantResolutionStrategy) where T : ITenantInfo
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

        //Replace the service providers feature with our tenant specific one
        IServiceProvidersFeature existingFeature = null!;
        try
        {
            existingFeature = context.Features.Get<IServiceProvidersFeature>()!;
            context.Features.Set<IServiceProvidersFeature>(new RequestServicesFeature(context, multiTenantServiceProviderScopeFactory));
            await next.Invoke(context);
        }
        finally
        {
            // Restore the original feature if it was replaced (in case it is used before the response ends)
            context.Features.Set(existingFeature);
        }
    }
}
```

We also use a `IStartupFilter` to register the middleware as early on as possible in the pipeline so the tenant specific services are available for the rest of the application to use.

```csharp
 /// <summary>
 /// Register the multitenant request services middleware with the app pipeline.
 /// </summary>
 /// <param name="tenantServicesConfiguration">The tenant specific tenant services configuration.</param>
 /// <seealso cref="IStartupFilter" />
 internal class MultitenantRequestServicesStartupFilter<T>() : IStartupFilter where T : ITenantInfo
 {
     /// <summary>
     /// Adds the multitenant request services middleware to the app pipeline.
     /// </summary>
     public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
     {
         return builder =>
         {
             builder.UseMiddleware<MultiTenantRequestServicesMiddleware<T>>();
             next(builder);
         };
     }
 }
```

### Easy configuration

To provide a familiar developer experience we will extend the `TenantBuilder` from the previous post to provide a method to make it easy to configure the tenant specific services. 

```csharp
/// <summary>
/// Register tenant specific services
/// </summary>
/// <param name="configuration"></param>
/// <returns></returns>
public TenantBuilder<T> WithTenantedServices(Action<IServiceCollection, T?> configuration)
{
    //Replace the default service provider with a multitenant service provider
    Services.Insert(0, ServiceDescriptor.Transient<IStartupFilter>(provider => new 
        MultitenantRequestServicesStartupFilter<T>()));

    //Register the multi-tenant service provider
    Services.AddSingleton(new MultiTenantServiceProviderFactory<T>(Services, configuration));
    Services.AddSingleton<IMultiTenantServiceScopeFactory, MultiTenantServiceScopeFactory<T>>();

    return this;
}
```


This allows the developer to provide the action that configures tenant specific services in the same place they configure the tenant resolution strategy and lookup service.

### The result

Now it's super simple to add tenant specific services to your application with the `WithTenantedServices` method on the `TenantBuilder`.

```csharp
//Add multi-tenant services
builder.Services.AddMultiTenancy<...>()
    ...
    .WithTenantedServices((services, tenant) =>
    {
        services.AddSomeTenantSpecificService(options => {
            options.Tenant = tenant;
        });
    })
```

## Summary

In this post we looked at how to we extended the ASP.NET Core dependency injection services to cater for multi-tenanted scenarios. We demonstarted how to replace `RequestServices` with a scoped tenant specific `IServiceProvider` that can resolve tenant specific services.

All the code is available on [GitHub](https://github.com/myquay/MultiTenant.AspNetCore)