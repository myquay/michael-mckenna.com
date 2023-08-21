---
publishDate: 2023-08-20T20:13:11+12:00
title: 'IndieAuth in ASP.NET Part 1: What is IndieAuth?'
summary: This series of blog posts is an exploration of how to I added IndieAuth as a supported authentication method to a .NET 6 application. In this first installment we take a look at what is IndieAuth exactly.
url: /indieauth-in-asp-dot-net-part-1-what-is-indieauth
tags:
    - guide
    - dot net core
    - indieauth
series: indieauth
---

## Introduction

[IndieAuth is an extension of the OAuth 2.0 protocol](https://indieauth.spec.indieweb.org/) which allows you to authenticate with your own domain instead of relying directly on a particular authenticaton provider. 

An important aspect of OAuth was to move away from providing your password to third-party apps directly, you only needed to enter your password in one place - where the account was held. OAuth has been a great success in this regard with many major platforms such as Google, GitHub, Facebook, Twitter, etc. all supporting OAuth. 

IndieAuth takes this a step further by allowing you to use your own domain to authenticate rather than being bound to a particular authentication provider.

### Advantages of IndieAuth

The main advantage is that you can sign into a website with any supported authentication service listed on your domain. For example, if you have a Twitter account listed on your website then you use that to sign into a website which supports IndieAuth. Lose access to Twitter? No problem, just add a new account to your website and you can still sign into the website. It's basically a way to decouple your identity from a particular authentication provider; the "Dependency Inversion" in SOLID, if you will.

A secondary advantage is for third party app developers. Traditionally with OAuth if you wanted to support a particular authentication provider such as Facebook or GitHub then you need to register your application to receive a `client_id` and `client_secret`. That's okay if there's a few main providers you want to support, but if you want to support a large number of providers then it can be a lot of work to register your application with each provider. With IndieAuth, you don't need to register your application with any provider, you just need to support the IndieAuth protocol and you automatically support any IndieAuth server (and their supported authentication methods).

### Disadvantages of IndieAuth

The main disadvantage is that it's a lot more technical for the user to setup. You need to have your own domain, you need to be able to add a few files to your domain or use a service which can do this for you, and finally you need to add your domain to supported authenticaiton methods. That's a lot more technical than just clicking a button on a website and entering your username and password. 

Consequently, I see this as a niche protocol. However, data ownership and decentralisation are powerful overarching themes which makes this a great protocol that's worth supporting for those who want to use it.

## How does IndieAuth work?

There are two concepts at play here, the client application and the authorization server. The client application is the website or application that you want to sign into. The authorization server is the server which is responsible for parsing the domain supplied and authenticating the user using a authentication method registered at their domain.

### The client application

From the perspective of a client application, [IndieAuth is very similar to OAuth](https://aaronparecki.com/2021/04/13/26/indieauth).

At a high level, the process is:

* Present a sign-in form askign the user to enter their domain
* Fetch the domain to discover their IndieAuth server
* Redirect the user to the IndieAuth server to authenticate
* Receive a redirect back to the client application with an access code
* Exchange the access code for an access token by making a HTTP request to their IndieAuth server

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

In this series of blog posts we'll be looking both at how to add IndieAuth support to a .NET 6 application as well as how to create your very own IndieAuth server implemented in .NET 6.

### The client application

The scenario we're supporting here is a .NET 6 web application where user's will sign in using their domain. The application will then be able to discover the IndieAuth server for the domain and authenticate the user using the IndieAuth protocol.

In ASP.NET Core 6, authentication is handled by a `AuthenticationHandler` class. This class is responsible for handling the authentication process for a particular authentication scheme. 

With a remote scheme typically two handlers are used:

1. The IndieAuth authentication handler _(the one we need to create)_. This will extend the `RemoteAuthenticationHandler` base class and will be responsible for handling the IndieAuth protocol.
2. A cookie handler to do local session management.

Since IndieAuth is an extension to the OAuth 2.0 protocol [we can use the MIT Licensed `OAuthHandler` as inspiration](https://github.com/dotnet/aspnetcore/tree/main/src/Security/Authentication/OAuth/src) for our `IndieAuthHandler`.

We'll be looking at how to implement an IndieAuth handler in .NET 6 in the next installment of this series.

### The authorization server

The authrorization server is a bit more complicated. We'll be looking at how to implement an IndieAuth server in .NET 6 in a future blog post. Will probably be some sort of middleware that you can add to your ASP.NET Core 6 application to add IndieAuth support.