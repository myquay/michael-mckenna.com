---
date: 2023-06-14T10:00:00+12:00
title: 'Peripheral: The great blog refresh of 2023'
subtitle: 'My methodology and design behind the new template for my blob'
url: /introducing-peripheral
summary: This blog just turned 10! It's a strange milestone; so inconsequnetial for everyone in the world bar me. Instead of going down a rabbit hole of irrelevance a better use of my time is to give this blog yet another refresh. 
tags:
    - Design
    - Article
---

This blog just turned 10! It's a strange milestone; so inconsequnetial for everyone in the world bar me. Instead of going down a rabbit hole of irrelevance a better use of my time is to give this blog yet another refresh. 

It started life as a custom ASP.NET MVC app and over the years the content has been dragged through a litany of platforms; [WordPress](https://wordpress.com/), [ghost](https://ghost.org/), [jekyll](https://jekyllrb.com/), and most "recently" [hugo](https://gohugo.io/) [^1]. The old theme of the site was a great little project called [Beautiful Hugo](https://github.com/halogenica/beautifulhugo) which was an adaptation of a theme I liked on [Jekyll](https://beautifuljekyll.com/). It's a good theme but it's very generic, I'd wanted something that is more suited to a developer blog so created [peripheral](https://github.com/myquay/hugo-theme-peripheral).

Peripheral is a blog for the technical professional. It's clean, it's lean, it has a few conveniencies that I've wanted for my writing over the years.

### The design

The theme is designed around both form and function. [A large swathe of the modern web](https://danluu.com/web-bloat/) [is inaccessable](https://idlewords.com/talks/website_obesity.htm). This theme is [deisgned to be small](https://benhoyt.com/writings/the-small-web-is-beautiful/), there's no frameworks, no mandatory Javascript, just a bit of CSS to make the content shine. A small website doesn't need to be super spartan, some websites are all "RAWR I AM BASICALLY HTML LOOK AT MY BLUE LINKS" but that's also not what I was after. So YOLO I dropped a few extra bytes on a handcrafted stylesheet. However you won't find an entire CSS framework to render one page nicely here.

The visual design is purposely simple to celebrate the content. The text is high contrast to the background, a dark black-offset on white. I didn't do straight black on white to reduce the harshness when confronted with a wall of text. The homepage was inspired by a newspaper cover, main column of recent articles with a sidebar of other short form content. There's no pagination for the blog posts - I'll take the achievement if I can write enough blog posts for this to be an issue. Overall I was focusing on making the individual articles as readable as possible by getting out of the way of the content.


### Content type

The main fustration when trying to write a post was coming up with something long enough to do a full blog post justice. I didn't want short and long form articles mashed together as you wouldn't know what you were getting yourself into before jumping into the text. Is this a full deep dive? A hot take? A little anecdote? Sometimes I want to write in depth and quite technical, other times a brief "today I learned" type situation. To avoid breaking consistency I have shied away from the latter. 

This theme has two types of content, a **post** and a **fragment**. A post is your standard long-form blog post - nothing to write home about here, this blog has 10 years worth of those. The fragment is something new, it's a small piece of content that can be published without impacting visibility or searchability of the main content. Twitter has gone to the birds, so I might as well post all those fun little thoughts to my own slice of the web as a fragment. The two types of content have their own RSS feeds so someone can decide what they want to subscribe to.

### Features

**Series support:** While exploring a topic sometimes I'd need to break it up into a series of posts. I'd need to manually add a little bit of HTML to each post in the series to reference the other posts so the reader could easily jump between them. This adds support to automatically build the related posts section for that scenario.

**Stale content:** The first post on the blog from 2013 is on a now discontinued Microsoft product called Azure ACS. It's totally irrelevant now. I could delete the piece, but I'm a little nostalgic about it and not exactly ready to consign it to the dustbin. To help with that, this theme supports marking a post as stale. This will make a warning message appear to let the reader know that the content may no longer be accurate. It also adds _noindex_ metadata to the page to ask search engines to no longer index the content. However you can never be quite sure who has linked to your content so it's good to keep the page up if possible.

**Pull request helper:** If Git is enabled then a callout is placed at the bottom of each post (like this one) letting the reader know that if they spot any errors or omissions then they can submit a pull request directly with any recommended fixes.

 ### What's in a name, why peripheral?

 I chose peripheral because accessible content is what makes a blog. The theme is secondary to that; it's on the periphery. 

[^1]: What is it with developers and their blogging platforms?

