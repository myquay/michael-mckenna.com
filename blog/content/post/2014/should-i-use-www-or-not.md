---
publishDate: 2014-07-14T15:56:32+12:00
title: Should I use www or not?
summary: Is it still required? Or can we just use the "naked" domain?
url: /should-i-use-www-or-not
tags:
    - article
---

It's common convention to prefix the letter double-u three times on the front of every domain to represent the web host. It's pretty funny that we managed to pick the most awkward, visually dominating letter for this job. 

Is it still required? Or can we just use the naked domain?

### What's the difference?

For most websites it doesn't matter if you enter www or not, you're going to end up at the website. For example, head to http://google.com you'll end up on http://www.google.com. 

However websites will have a preference, everybody will either get directed to the naked domain (e.g. example.com) or the www hostname (e.g. www.example.com). 

Some big sites such as StackOverflow default to their naked domain while others like Google default to using the www hostname.

Since we should always accept both www and non-www requests does it even matter which one is the default? Either way the user will end up on our site. 

### Why use www?

[yes-www.org has a few technical reasons ](http://www.yes-www.org/why-use-www/) why you should default to www but they mainly affect sites with high traffic requirements and performance around DNS resolution. 

> You should use www because today you have a small web site, and tomorrow you want a big web site. Really big.

Normally I'd refrain from the "What if this new service gets huge?" speculation until there's evidence of traction, but here we're chooing between two choices that don't really impact timelines so it's not "gold plating" or anything like that. If your site could be huge, make sure you're okay with the technical trade off required to drop the prefix.

#### CNAMEs

[A few sites](https://www.less-broken.com/blog/2012/05/no-www-considered-harmful.html) [bring up the issue](http://www.yes-www.org/why-use-www/) that you can't use CNAME  records on a naked domain which makes them hard to use with cloud services where the public IP address might change. For example in Azure you'd usually reference {whatever}.cloudapp.net instead of the cloud service's public IP. 

In this case, you can use an [ALIAS record](http://support.dnsimple.com/articles/alias-record/) instead of a CNAME record. Sure, not all hosts support it, just go with one that does and just keep in mind the [performance implications of the method](https://www.netlify.com/blog/2017/02/28/to-www-or-not-www/)

> The precision of the geographic lookups that Netlify does might suffer We now do our lookup based on the IP of the DNS server rather than the IP of the end user, which can lead to inaccuracies based on the lack of granularity of those servers. 

#### Cookies

The other issue is that you can't actually set cookies for just the root domain. Any cookie set for the root domain is actually a wildcard subdomain cookie which will be sent to every subdomain also.

This has implications if you want a cookieless site that serves static content or a third party service that you don't want to leak your cookies to (e.g. an uptime page provided by a third party but hosted under status.{yourdomain}.com.

These are very specialised situations but can be resolved by hosting the affected services under a completely different domain.

Whether this is an issue or not depends entirely on your circumstances.

### Why remove www?

For me it all comes down to communication. Domains are there to hide unsightly IP addresses and to make your website easy to find for other people, much like using an address rather than coordinates when describing your physical location to somebody.

The www is a hindrance to this communication. Let's face it, removing the www not only makes the URL shorter but it removes a massive 9 syllables from the web address. 

### So should I remove www?

For [my blog](https://michael-mckenna.com) I default to the naked domain because I think it looks better and it's already long enough. Since it's a small site which will probably always be tiny the technical issues are not problem for me in this situation.

But like most things in computer science and life, it really depends on your individual circumstances. I can't tell you whether one option is unequivocally better for all situations. Instead I urge you to go look at both sides of the story and decide which is best for your new web app.