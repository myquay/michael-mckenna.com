+++
date = "2013-02-25T21:41:32+12:00"
description = "By enabling sliding expiration if the user has just requested a form then they are guaranteed to have enough time to fill it out before the token expires on them."
title = "The problem with absolute token expiration in Windows Identity Foundation (WIF)"
url = "/the-problem-with-absolute-token-expiration-in-windows-identity-foundation-wif"
tags = ["asp dot net mvc", "security"]
+++

### The problem

While developing [CronHQ][cronhq] we initially had problems with our Facebook integration. 
Rule #6 of the Facebook guidelines require us to provide an explicit logout link.

> 6\. Your website must offer an explicit "Log Out" option that also logs the user out of Facebook

However Azure ACS 2.0 [doesn’t really support single sign out][azuresso] making the requirement a little harder to meet.

This isn't just Facebook being difficult, it makes sense to enforce this on every identity provider that we federate with. If the user signs into your website via a large identity provider like Facebook, it is not obvious to the user that they need to explicitly visit Facebook to logout after they log out of your website.

Signing out of the identity provider as well as your website helps prevent unauthorised access by third parties. Leaving the user signed into the identity provider leaves your website (and any other federated website) open to the next person that hops on that computer.

### The solution

There are a couple of solutions out there using an intermediary page with either [an image tag][haishibai] or [an iFrame][overcode] to call the identity provider’s logout URL during the logout process.

They both follow the same concept where the user’s browser is asked to call the logout URL of the identity provider that they used to sign in with. This can’t be a back channel process as we need the user’s browser to pass on the cookies for the identity provider so that the identity provider knows who to log out.

We went the image tag approach as it provides an easy way to trigger the completion of the sign out process by hooking into the image tag’s _onerror_ event.

### The implementation

He's how we implemented the process on our MVC 3 web application. It only involves a little extra code in the existing sign out action, a new model and a new view.


#### Step1: Create the model

    public class SignOutModel
    {
        public string IdentityProviderLogoutUrl { get; set; }
        public string IdentityProviderName { get; set; }
    }


#### Step 2: Create the view

    @model SignOutModel
    ...
    <h1>Please stand by, we're currently signing you out of this website and @Model.IdentityProviderName...</h1>
    <img src="@Model.IdentityProviderLogoutUrl" onerror="window.location='/';" />
    ...


#### Step 3: Update the SignOut action 

    //Existing logout logic to log out of current website
    ....
    //ExtractClaim is a custom extension method, but all we're doing here is inspecting the current 
    //user's claims and grabbing the provider one that ACS hands us to id the identity provider
    var provider = User.ExtractClaim("http://schemas.microsoft.com/accesscontrolservice/2010/07/claims/identityprovider");
    
    SignOutModel model = null;
    if (provider.Contains("Google"))
    {
        model = new SignOutModel{
             IdentityProviderLogoutUrl = "https://www.google.com/accounts/Logout",
             IdentityProviderName = "Google"
        };
    }else if(...
        //Repeat for each provider that you support
    ....
    return View(model);

Each identity provider has a different logout URL, here's a couple of the common ones

* LiveID: https://login.live.com/login.srf?wa=wsignout1.0
* Google:  https://www.google.com/accounts/Logout
* Yahoo!: https://login.yahoo.com/config/login?logout=1
* Facebook: https://www.facebook.com/logout.php?next={encoded-ACS-url}&access_token={accesstoken}

The Facebook sign out URL is the only one with a special format

* **{accesstoken}** is the Facebook access token that ACS returns as a claim
* **{encoded ACS url}** is in the form https://{namespace}.accesscontrol.windows.net/v2/wsfederation?wa=wsignoutcleanup1.0 where **{namespace}** is your ACS namespace

### Conclusion

ACS may not directly support single sign out but you can easily log the user out of their identity provider as well as your website using this technique. 

[cronhq]: http://www.cronhq.net/  "CronHQ - Cron service for managing online scheduled tasks"
[azuresso]: http://social.msdn.microsoft.com/Forums/pl-PL/windowsazuresecurity/thread/cea8aeec-e710-4ab3-812d-5e04e4627809/  "Single Sign Out with AppFabric ACS"
[haishibai]: http://haishibai.blogspot.co.nz/2012/08/sign-out-from-identity-providers-when.html  "Sign out cleanly from Identity Providers when using ACS"
[overcode]: http://www.overcode.hk/?cat=10  "Azure | OverCode"
