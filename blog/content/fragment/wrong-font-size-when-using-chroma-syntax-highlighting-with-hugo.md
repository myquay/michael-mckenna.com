---
date: 2023-05-04T10:00:00+12:00
title: 'Wrong font size on iOS when using Chroma syntax highlighting with Hugo'
subtitle: 'WebKit has this habit of trying to enlarge the "primary" text on the screen'
slug: /wrong-font-size-on-ios-when-using-chroma-syntax-highlighting-with-hugo
---

When I first turned on syntax highlighting it all looked great, except for on the iPhone. Some sections of the text were randomly zoomed in. [On StackOverflow I found out that it could be due to feature of WebKit which tries to enlarge the primary text of the website to make it more mobile friendly](https://stackoverflow.com/questions/20924039/wrong-font-size-when-using-float-right-in-css-on-mobile-safari/22417120#22417120), which was causing us a bit of trouble.

![](/images/2023-05-font-ios-sizing-issue.png)

To resolve this they recommended some CSS rules to disable the behaviour which worked for me.

```css
body {
    text-size-adjust: 100%; 
    -ms-text-size-adjust: 100%; 
    -moz-text-size-adjust: 100%; 
    -webkit-text-size-adjust: 100%;
}
```