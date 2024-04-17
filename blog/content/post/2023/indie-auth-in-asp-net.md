---
publishDate: 2023-09-27T20:13:11+12:00
title: 'IndieAuth in ASP.NET'
summary: This is a long form blog post about how I added support for IndieAuth as an authentication method for a .NET 6 application.
url: /indieauth-in-asp-dot-net
aliases:
    - /indieauth-in-asp-dot-net-part-1-what-is-indieauth
tags:
    - guide
    - dot net core
    - indieauth
---

## Introduction

[IndieAuth is an extension of the OAuth 2.0 protocol](https://indieauth.spec.indieweb.org/) which allows you to authenticate with your own domain instead of relying directly on a particular authenticaton provider. 

An important aspect of OAuth was to move away from providing your password to third-party apps directly. With OAuth you only need to enter your password in one place; where the account was held. OAuth has been a great success in this regard with many major platforms such as Google, GitHub, Facebook, Twitter, etc. all supporting OAuth. 

IndieAuth takes this a step further by allowing you to use your own domain to authenticate rather than being bound to a particular authentication provider.

#### TL;DR

If you already know the ins and outs around the protocol you can skip straight to
* The [source code on GitHub](https://github.com/myquay/IndieAuth)
* The [related NuGet package: AspNet.Security.IndieAuth](https://www.nuget.org/packages/AspNet.Security.IndieAuth/) 

### Advantages of IndieAuth

The main advantage is that you can sign into an application with any supported authentication service listed on your domain. 

For example, if you have a Twitter account listed on your website then you use that to sign into an application which supports IndieAuth. Lose access to Twitter? No problem, just add a new provider to your website and sign into your existing account with that instead. 

It's a way to decouple your identity from a particular authentication provider.

A secondary advantage is for third party app developers. Traditionally with OAuth if you wanted to support a particular authentication provider such as Facebook or GitHub then you need to register your application to receive a `client_id` and `client_secret`. 

That's okay if there's a few main providers you want to support, but if you want to support a large number of providers then it can be a lot of work to register your application with each provider. With IndieAuth, you don't need to register your application with any provider, you just need to support the IndieAuth protocol and you automatically support any IndieAuth server (and their supported authentication methods).

### Disadvantages of IndieAuth

The main disadvantage is that it's a lot more technical for the user to setup. You need to have your own domain, you need to be able to add a few files to your domain or use a service which can do this for you, and finally you need to add your domain to supported authenticaiton methods. That's a lot more technical than just clicking a button on a website and entering your username and password. 

Consequently, I see this as a niche protocol. However, data ownership and decentralisation are powerful overarching themes which makes this a great protocol that's worth supporting for those who want to use it.

## How does IndieAuth work?

There are two concepts at play here, the client application and the authorization server. The client application is the website or application that you want to sign into. The authorization server is the server which is responsible for parsing the domain supplied and authenticating the user using a authentication method registered at their domain.

### The client application

From the perspective of a client application, [IndieAuth is very similar to OAuth](https://aaronparecki.com/2021/04/13/26/indieauth).

At a high level, the process is:

* Present a sign-in form asking the user to enter their domain
* Fetch the domain to discover the IndieAuth server
* Redirect the user to the IndieAuth server to authenticate
* Receive a redirect back to the client application with an access code
* Exchange the access code for an access token by making a HTTP request to the IndieAuth server

The main difference between IndieAuth and OAuth is that the client application doesn't need to register with the IndieAuth server. Instead, the client application just needs to support the IndieAuth protocol.

### The authorization server

The authorization server is responsible for authenticating the user using a registered authentication method. The authorization server is also responsible for providing the client application with an access code and token which can be used to authenticate the user.

At a high level, the process is:

* Receive a request from the client application to authenticate the user
* Fetch the domain supplied by the client application
* Parse the domain to discover the supported authentication methods
* Authenticate the user using the authentication method (e.g. Email, GitHub, Twitter, etc.)
* Validate the authentication response from the chosen authentication method, and that method chosen is linked to the user's domain
* Ask the user to confirm that they want to authenticate with the client application
* Redirect the user back to the client application with an access code
* Receive a request from the client application to exchange the access code for an access token

## How to add IndieAuth to ASP.NET?

There are two standalone componenets to implement:

  * the authentication handler for the client ASP.NET application that a user logs into
  * the authorization server which is responsible for authenticating the user.

I decided to implement the authentication handler first as we can use the IndieAuth server at [indieauth.com](https://indieauth.com/) to authenticate the user. This will allow us to test the authentication handler without having to implement the authorization server.

### The client application

The scenario we're supporting here is a .NET 6 web application where user's will sign in using their domain. The application will then be able to discover the IndieAuth server for the domain and authenticate the user using the IndieAuth protocol.

In ASP.NET Core 6, authentication is handled by a `AuthenticationHandler` class. This class is responsible for handling the authentication process for a particular authentication scheme. 

With a remote scheme typically two handlers are used:

1. The IndieAuth authentication handler _(the one we need to create)_. This will extend the `RemoteAuthenticationHandler` base class and will be responsible for handling the IndieAuth protocol.
2. A cookie handler to do local session management.

Since IndieAuth is an extension to the OAuth 2.0 protocol [we can use the MIT Licensed `OAuthHandler` as inspiration](https://github.com/dotnet/aspnetcore/tree/main/src/Security/Authentication/OAuth/src) for our `IndieAuthHandler`.

#### The source code

You can view the full source code on [GitHub](https://github.com/myquay/IndieAuth) to see how it all hangs together.

If you just want to to quickly add support to an application you're developing then you can install the [AspNet.Security.IndieAuth](https://www.nuget.org/packages/AspNet.Security.IndieAuth/) NuGet package. If you find any issues or have any suggestions then please [raise an issue on GitHub](https://github.com/myquay/IndieAuth/issues) or submit a pull request!

#### Usage

I wanted to make it easy to add IndieAuth support so the library API is similar to adding support for other authentication methods. You set it up by adding a few lines of code to your config file similar to any other handler.

```csharp

builder.Services.AddAuthentication()
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        options.LoginPath = "/account/sign-in";
    })
    .AddIndieAuth(IndieAuthDefaults.AuthenticationScheme, options =>
    {
        options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.ClientId = config!.IndieAuth.ClientId;
        options.CallbackPath = "/authentication/indie-auth/callback";
        options.Events = new IndieAuthEvents
        {
            OnRemoteFailure = context =>
            {
                context.Response.Redirect(...);
                context.HandleResponse();
                return Task.CompletedTask;
            },
        };
    });

```

### The authorization server

The authrorization server is a bit more complicated. I'm currently looking at how to implement an IndieAuth server in .NET 6 and will update this blog post in the future. Will probably be some sort of middleware that you can add to your ASP.NET Core 6 application to add IndieAuth server support.