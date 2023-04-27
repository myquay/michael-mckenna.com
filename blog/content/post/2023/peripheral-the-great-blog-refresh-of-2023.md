---
date: 2023-04-26T10:00:00+12:00
title: 'Peripheral: The great blog refresh of 2023'
subtitle: 'My methodology and design behind the new template for my blob'
url: /introducing-peripheral
tags:
    - Design
    - Article
---

## The motivation behind peripheral

This blog just turned 10! It's a strange milestone; so inconsequnetial for everyone in the world bar me. Instead of going down a rabbit hole of irrelevance a better use of my time is to give this blog yet another refresh. 

It started life as a custom ASP.NET MVC app and over the years the content has been dragged through a litany of platforms; [WordPress](https://wordpress.com/), [ghost](https://ghost.org/), [jekyll](https://jekyllrb.com/), and most "recently" [hugo](https://gohugo.io/) [1].

The old theme of the site was a great little project called [Beautiful Hugo](https://github.com/halogenica/beautifulhugo) which was an adaptation of a theme I liked on [Jekyll](https://beautifuljekyll.com/). It's a good theme but it's very generic, I'd wanted something that is more suited to a developer blog so created [peripheral](https://github.com/myquay/hugo-theme-peripheral).

## Peripheral

Peripheral is a blog for the technical professional. It's clean, it's lean, it has a few conveniencies that I've wanted for my writing over the years.

### The design

The design is centered around the text, the two most important elements for me were the typography and colour. 

### The type of content

 The fustration I would like to resolve is around the nature of a post. Sometimes I want to write in depth and quite technical, other times a brief "today I learned" type situation. To avoid breaking consistency I have shied away from the latter. 

The theme has two main archetypes, **posts** and **fragments**.

 #### Post

This is your standard long-form blog post - nothing to write home about here.

 #### Fragment

This is something new, it's a small piece of content that can be published to your blog without impacting visibility or searchability of the main content. Twitter has gone to the birds, might as well post all those fun little thoughts to your own slice of the web as a fragment.

### Series support

While exploring a topic sometimes I'd need to break it up into a series of posts. I'd need to manually add a little bit of HTML to each post in the series to reference the other posts so the reader could easily jump between them. This adds support to automatically build the related posts section for that scenario.

### Stale content

The first post on the blog from 2013 is on a now discontinued Microsoft product called Azure ACS. It's totally irrelevant now. I could delete the piece, but I'm a little nostalgic about it and not exactly ready to consign it to the dustbin. To help with that, this theme supports marking a post as stale. This will make a warning message appear to let the reader know that the content may no longer be accurate. It also adds _noindex_ metadata to the page to ask search engines to no longer index the content. However you can never be quite sure who has linked to your content so it's good to keep the page up if possible.

### Pull request helper

 ## What's in a name

 I chose peripheral because accessible content is what makes a blog. The theme is secondary to that; it' on the periphery. [A large swathe of the modern web](https://danluu.com/web-bloat/) [is inaccessable](https://idlewords.com/talks/website_obesity.htm). There's no frameworks, no Javascript, just a bit of CSS to make the content shine.

[1]: What is it with developers and their blogging platforms?

