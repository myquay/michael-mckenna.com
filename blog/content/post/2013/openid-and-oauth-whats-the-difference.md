+++
date = "2013-04-08T22:30:32+12:00"
description = "Authentication using OAuth is like the valet obtaining your identity by checking the glove box and finding your drivers license in there."
title = "OpenID and OAuth: What's the difference?"
url = "/openid-and-oauth-whats-the-difference"
tags = ["security"]
+++

I'm currently in the middle of upgrading [ConceptHQ Accounts](https://accounts.concepthq.net "ConceptHq | Accounts") to accept a small subset of third party identity providers. Microsoft Account (previously Windows Live ID), Google, Facebook, and Twitter. 

![New ConceptHQ Accounts layout](/images/accounts-upgrade.png)

However they all have a slightly different ways of allowing you to authenticate users with them.

1. Facebook: [OAuth 2.0](http://developers.facebook.com/docs/reference/dialogs/oauth/)
2. Twitter: [OAuth 1.0A](https://dev.twitter.com/docs/auth/oauth)
3. Microsoft Account: [OAuth 2.0](http://msdn.microsoft.com/en-us/library/live/hh243647.aspx)
4. Google: [OpenID](https://developers.google.com/accounts/docs/OpenID)

Google is the only IdP there that supports OpenID however they are actively encouraging developers to move towards using "Google+ Sign-in" which is an OAuth provider.

>Note: If you are planning to provide a “sign-in with Google” feature, we recommend using Google+ Sign-in, which provides the OAuth 2.0 authentication mechanism along with additional access to Google desktop and mobile features.

### But I thought OAuth was for authorization, not authentication?

You can perform a authentication by using the generated access token to get the user's details, rather than having the user's details given to the relying application directly.

[Ivan Sagalaev](http://softwaremaniacs.org/about/en/ "Ivan Sagalaev") provided quite a good analogy in "[Difference between OpenID and OAuth](http://softwaremaniacs.org/blog/2011/07/14/openid-oauth-difference/en/ "Software Maniacs blog » Difference between OpenID and OAuth")"

>Here's an analogy. OpenID is your driver's license: it says who you are but it doesn't imply you're going to drive a car whenever you're asked of your ID. OAuth is you car's key: a valet can drive your car with them but he doesn't need to know your name to do it.

Which I'd like to extend.

Authentication using OAuth is like the valet obtaining your identity by checking the glove box and finding your drivers license in there.

He's got to be darn sure that you're the only one that can give him the car key, or in our case, the OAuth access token.