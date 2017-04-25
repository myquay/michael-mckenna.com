+++
date = "2014-06-20T20:51:32+12:00"
description = "It's designed to allow an API to support partial updates."
title = "The great confusion about HTTP Patch"
url = "/the-great-confusion-about-http-patch"
+++

PATCH is a relatively new addition to the set of HTTP verbs. Proposed about 4 years ago in [RFC 5789](http://tools.ietf.org/html/rfc5789) it's designed to allow an API to support partial updates.

> A new method is necessary to improve interoperability and prevent
   errors.  The PUT method is already defined to overwrite a resource
   with a complete new body, and cannot be reused to do partial changes.
   Otherwise, proxies and caches, and even clients and servers, may get
   confused as to the result of the operation.
   
 Great, myself along with a bunch of other API designers started to treat it as PUT but for partial updates. Sure it only worked for simple entities and started to break down with objects containing complex properties but this was Web 2.0 and we started to do something along the lines of this.
 
     PATCH /cars/1
     Content-Type: application/json
     
     { "colour": "new-paint-colour" }
     
Now we can just check the verb to see if we want to null out missing entities, if it was a PUT we'd replace the entire object, and if it's a PATCH we'd just update the properties specified right? ...right? Wrong!

[Turns out I was using PATCH like an idiot.](http://williamdurand.fr/2014/02/14/please-do-not-patch-like-an-idiot/)

## What was wrong with that? So what is PATCH then?

Well, it's important to note that the content type of the resource is not the same as the content type of the PATCH request. The PATCH request is a description of changes, the format of that description is up to the server and client to decide. Actually this part becomes clear once we get to the second section immediately after the introduction.

> The PATCH method requests that a set of changes described in the
   request entity be applied to the resource identified by the Request-
   URI.  The set of changes is represented in a format called a "patch
   document" identified by a media type.

In fact [the spec](http://tools.ietf.org/html/rfc578) goes on to say that there won't be any universal "patch document" format.

> Further, it is expected that different patch document formats will be
   appropriate for different types of resources and that no single
   format will be appropriate for all types of resources.  Therefore,
   there is no single default patch document format that implementations
   are required to support. 
   
So there we go, PATCH actually looks something along the lines of

     PATCH /cars/1
     Content-Type: [patch document content type]
     
     [Description of changes]
     
Because of the lack of standardisation around the content type at the moment to support PATCH you need to decide what type of patch documents you wish to support and implement that support yourself.

## What content-type should I support?

Well any old content-type, you could even create one yourself! But the chances are that it won't be that widely supported outside of your ecosystem, but who knows, that might suit you just fine.

Myself, I like the look of [application/json-patch](https://www.mnot.net/blog/2012/09/05/patch) described in [RFC 6902](http://tools.ietf.org/html/rfc6902) as it's easy to read and write and seems to be gaining a lot of mind share. 

Here's an example:

     PATCH /cars/1
     Content-Type: application/json-patch
     
     {"replace": "/colour", "value": "red"}
     
It's super obvious that we're updating the colour property of the car resource to red. Fantastic.

## Closing words

So PATCH is not PUT for partial updates, it applies a set of changes to a resource as described in the request, this set of changes is called a "patch document". 

As a bonus I'm pretty sure it's RESTful, [REST doesn't require representations to be "complete"](https://www.mnot.net/blog/2012/09/05/patch#comment-1814).