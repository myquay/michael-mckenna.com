---
date: 2023-05-29T00:00:00+12:00
title: 'TMMM: Sharp Tools'
summary: 'Chapter 12, The throw-one-away concept is itself just an acceptance of the fact that as one learns, he changes the design.'
slug: /tmmm-sharp-tools
---

At first glance this chapter seems a bit dated simply because we're dealing with old concepts like scheduling machine time, utilities for tasks that are now well established, debugging with printouts; however discarding the specific technologies mentioned there are core concepts that are just as relevent today.

> The manager of a project, then, needs to establish a philosophy and set aside resources for the building of common tools. At the same time he must recognize the need for specialized tools, and not begrudge his working teams on their own tool-building.
>
> -- Federick P. Brooks, JR

This is very relevent today. Taking GitHub and Actions for an example, GitHub can be seen as a common tool used by many developers for managing, hosting, and deploying software systems. However it supports customisation in the form of Actions which allows a developer to customise this generalised tool for more specialized processes.

Not only can a developer build a tool for their own use, but can also publish it for others to use amplifying their usefulness. 

The chapter also discusses all the different _Vehicle Machines_ needed between where the software system is developed and where it is deployed (the _Target Machine_). 

> Machine support is usefully divided into the _target machine_ and _the vehicle machines_. The target machine is the one for which software is being written, and on which it must ultimately be tested. The vehicle machines are those that provide the services used in building the system.
>
> -- Federick P. Brooks, JR

One thing to note is build here also refers to the development of the system, not just the compiliation step. Having a dedicated machine for debugging, another for library maintence, another for compiling etc, might seem a bit foreign, especially if we imagine the big machines from back in the day one must schedule to run the newly minted code. However in modern CI/CD pipelines we have dedicated build servers and target environments which are a natural extension of this concept.



