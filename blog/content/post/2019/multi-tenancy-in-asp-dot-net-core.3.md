+++
date = "2019-07-15T13:11:12+12:00"
description = "Overview of implementing multi-tenancy in .NET core"
title = "Creating a multi-tenant .NET Core Application - Tenant specific authentication"
subtitle = "Tenant specific authentication, part 4 of 4"
url = "/multi-tenant-asp-dot-net-core-application-tenant-specific-authentication"
tags = ["guide", "azure", "dot net core", "multitenant"]
summary = "This time we are looking at how we can configure authentication on a per-tenant basis."
+++

> 🚨 **This is not compatible with .NET Core 3.0** 🚨 

## Introduction

Today we will extend our multi-tenant solution allow each tenant to have different [ASP.NET Identity](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options?view=aspnetcore-2.2) providers configured. This will allow differet tenants to be able to define different external identiy providers or different clients for the same identity provider.

This is important to allow consent screens on third party services reflect the branding of the particular tenant that the user is signing in to.

### Parts in the series

* Part 1: [Tenant resolution](/multi-tenant-asp-dot-net-core-application-tenant-resolution)
* Part 2: [Tenant containers](/multi-tenant-asp-dot-net-core-application-tenant-containers)
* Part 3: [Options configuration per tenant](/multi-tenant-asp-dot-net-core-application-tenant-specific-configuration-options)
* *Part 4: Authentication per tenant _(this post)_*

### Why have tenant specific authentication?

In this post we will enable three features

**Allow different tenants to configure different authentication options**

This is useful if different tenants want to allow different ways of signing in, e.g. one tenant might want to allow Facebook, and instagram and another wants local logins only.

**Make sure each tenant has their own authentication cookies**

This is useful if tenants are sharing a domain, you don't want the cookies of one tenant signing you in to all tenants.


>    ⚠ If you follow this post your tenants will be sharing decryption keys so one tenant's cookie is a valid ticket on another tenant. Someone could send one tenant's cookie to a second tenant, you will need to either also include a tenant Id claim or extend      this further to have seperate keys to verify the cookie supplied is intended for the tenant.

**Allow different tenants to use different configured clients on an external identity provider**

With platforms such as Facebook if it's the first time the user is signing in they will often be asked to grant access to the application for their account, it's importannt that this grant access screen mentions the tenant that is requesting access. Otherwise the user might get confused and deny access if it's from a shared app which is not directly related to the tenant.

## Implementation

This implementation is only compatible with ASP.NET Core 2.0+. In 1.0 the Authentication was defined in the pipeline so you could use branching to configure services on a per-tenant basis, however this is no longer possible. The approach we've taken is to use our tenant specific container to register the different schemes/ options for each tenant. 

This [post on GitHub](https://github.com/aspnet/Security/issues/1310) outlines all of the changes between 1.0 and 2.0.

### 1. Register the services depending on your tenant

In [Part 2](/multi-tenant-asp-dot-net-core-application-tenant-containers") of this series we added support for a tenant specific services container backed by [Autofac](https://autofac.org/), we can use this to register our authentication services for each tenant.

```csharp
public IServiceProvider ConfigureServices(IServiceCollection services)
{
    ...

    return services.UseMultiTenantServiceProvider<Tenant>((t, c) =>
    {
        //Create a new service collection and register all services
        ServiceCollection tenantServices = new ServiceCollection();
        
        var builder = tenantServices.AddAuthentication(o =>
            {
                //Support tenant specific schemes
                o.DefaultScheme = $"{t.Id}-{IdentityConstants.ApplicationScheme}";
            }).AddCookie($"{t.Id}-{IdentityConstants.ApplicationScheme}", o =>
            {
                ...
            });

        //Optionally add different handlers based on tenant
        if (t.FacebookEnabled)
                builder.AddFacebook(o => { 
                    o.ClientId = t.FacebookClientId; 
                    o.ClientSecret = t.FacebookSecret; });

        //Add services to the container
        c.Populate(tenantServices);

        ...

    });

}
```

Seems too easy right? It is. If you run it as is your handlers aren't registered using the default `.UseAuthentication` middleware. The schemes are registered in the middleware constructor before you have a valid tenant context. Since it doesn't support registering schemes dynamically OOTB we will need to slightly modify it.

### 2. Update the authentication middleware to support dynamic registration of schemes

Disclaimer, the ASP.NET framework was written by very smart people so I get super nervous about making any changes here - I've tried to limit the change but there could be unintended consequences! Proceed with caution 🤔😉

We're going to take the [existing middleware](https://github.com/aspnet/AspNetCore/blob/master/src/Security/Authentication/Core/src/AuthenticationMiddleware.cs) and just move the `IAuthenticationSchemeProvider` injection point from the constructor to the `Invoke` method. Since the invoke method is called after we've registered our tenant services it will have all the tenant specific authentication services available to it now.

```csharp

/// <summary>
/// AuthenticationMiddleware.cs from framework with injection point moved
/// </summary>
public class TenantAuthMiddleware
{
    private readonly RequestDelegate _next;

    public TenantAuthMiddleware(RequestDelegate next)
    {
        _next = next ?? throw new ArgumentNullException(nameof(next));
    }
    
    public async Task Invoke(HttpContext context, IAuthenticationSchemeProvider Schemes)
    {
        context.Features.Set<IAuthenticationFeature>(new AuthenticationFeature
        {
            OriginalPath = context.Request.Path,
            OriginalPathBase = context.Request.PathBase
        });

        // Give any IAuthenticationRequestHandler schemes a chance to handle the request
        var handlers = context.RequestServices.GetRequiredService<IAuthenticationHandlerProvider>();
        foreach (var scheme in await Schemes.GetRequestHandlerSchemesAsync())
        {
            var handler = await handlers.GetHandlerAsync(context, scheme.Name) 
                as IAuthenticationRequestHandler;
            if (handler != null && await handler.HandleRequestAsync())
            {
                return;
            }
        }

        var defaultAuthenticate = await Schemes.GetDefaultAuthenticateSchemeAsync();
        if (defaultAuthenticate != null)
        {
            var result = await context.AuthenticateAsync(defaultAuthenticate.Name);
            if (result?.Principal != null)
            {
                context.User = result.Principal;
            }
        }
        
        await _next(context);
    }
}

```

### 3. Add an application builder extension to register our slightly modified authentication middleware

This provides a nice way for the developer to quickly register the tenant aware authentication middleware

```csharp

/// <summary>
/// Use the Teanant Auth to process the authentication handlers
/// </summary>
/// <param name="builder"></param>
/// <returns></returns>
public static IApplicationBuilder UseMultiTenantAuthentication(this IApplicationBuilder builder) 
    => builder.UseMiddleware<TenantAuthMiddleware>();

```

Now we can register the tenant aware authenticaion middleware like this

```csharp

public void Configure(IApplicationBuilder app, IHostingEnvironment env)
{
    ...

    app.UseMultiTenancy()
        .UseMultiTenantContainer()
        .UseMultiTenantAuthentication();
}

```

## Wrapping up

In this post we looked at how we can upgrade ASP.NET Core to support tenant specifc authentication, this means each tenant can have different external identify providers registered and connect to different clients for each of those providers. 
