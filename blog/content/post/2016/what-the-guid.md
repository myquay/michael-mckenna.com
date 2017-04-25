+++
date = "2016-04-19T11:58:32+12:00"
description = "I asked myself some questions and ended up learning a lot about the humble GUID - they really are quite cool."
title = "GUIDs part 1: What the GUID?"
url = "/what-the-guid"
+++

Most developers have seen a GUID or two. A GUID *(Globally Unique Identifier)* is used extensively in computing to uniquely identify all sorts of things. You might also see them referred to as UUIDs - don't worry they're the same thing.

> This specification defines a Uniform Resource Name namespace for
   UUIDs (Universally Unique IDentifier), also known as GUIDs (Globally
   Unique IDentifier).<br /><cite>&mdash; <a href="https://www.ietf.org/rfc/rfc4122.txt" target="_blank">RFC 4122: A Universally Unique IDentifier (UUID) URN Namespace</a></cite>

But why are they so pervasive? What about auto-incrementing numbers? Why do they look so ugly?? I asked myself the same questions and ended up learning a lot about the humble GUID - they really are quite cool.

**A GUID introduction**

I have a dog, his name is Snowy. Sometimes I take my dog to doggy daycare. When I pick up my dog I ask for Snowy. But what if someone else's dog is also called Snowy? The name was supposed to uniquely identify my dog - how do they identify which dog is mine?

Although not a major issue the problem of unique identification in dogs is already solved through micro-chipping. The local council maintains a registry to ensure uniqueness - if there really was confusion you could always scan the dog - look up its unique identifier and discover the owner.

At first glance this type of system seems like it does the job, why do we need GUIDs?

Well, what if I wanted to make my own dog-chips? Nothing in the specification ensures global uniqueness if everyone started creating their own chips. The chip number consists of <a href="https://en.wikipedia.org/wiki/ISO_11784_%26_11785">a country code, 38 ID bits and a few other things</a>. How do I make sure I don't choose the same country code and 38 bits as someone else? Well I can't <a href="https://www.dia.govt.nz/diawebsite.nsf/wpg_URL/Resource-material-Dog-Control-Microchipping-Questions-and-Answers#two">the central repository *(national dog database)* ensures uniqueness</a>, not the standard.

GUIDs don't have this problem, uniqueness is baked into the standard. There is no requirement for a central authority to ensure uniqueness; GUIDs are 128-bit numbers generated in a particular way that allows you to create an identifier which you can be certain that _**no one else in the world will ever generate**_ *(assuming they also follow the standard - it doesn't prevent someone maliciously generating a duplicate GUID just to mess with you)*.

Amazing right? Am I right? Over the next few installments in this series we'll take a look at how GUIDs ensure uniqueness without a central repository.

<alert><span>Note:</span>This is a [3 part series](https://michael-mckenna.com/tag/guid/) about my personal exploration of GUIDs. You can follow along to learn all about GUIDs, [check out my open source C# implementation](https://github.com/myquay/GuidOne) of the specification, and [visit a fun GUID generator I built called <b>guid.one</b>](http://guid.one).
</alert>