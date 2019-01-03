+++
date = "2013-04-15T22:55:32+12:00"
description = "First impressions are important - one style change from your app to your identity provider's is enough :)"
title = "Configuring a Live Connect application to use the new Microsoft Account permission page"
url = "/configuring-a-live-connect-application-to-use-the-new-microsoft-account-permission-page"
tags = ["asp dot net mvc"]
+++

When I first configured the new version of ConceptHQ Accounts to federate with Microsoft account using OAuth I used these two endpoints which I picked out of a sample.

    https://oauth.live.com/token
    https://oauth.live.com/authorize

It resulted in a slightly jarring user experience as we switch from the new look sign in page to the old style permissions page.

![New sign in page, old permissions page](/images/old-live-id-permissions.png)

However, by switching to the [new OAuth 2.0 endpoints](http://msdn.microsoft.com/en-us/library/live/hh243647.aspx "OAuth 2.0 Live Connect")

    https://login.live.com/oauth20_token.srf
    https://login.live.com/oauth20_authorize.srf

We get a much smoother experience as the styles between the sign in and permissions page remain the same.

![New sign in page, new permissions page](/images/new-live-id-permissions.png)

Much better. First impressions are important - one style change from your app to your identity provider's is enough :)