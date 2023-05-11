---
date: 2023-05-11T10:00:00+12:00
title: 'TMMM: The Mythical Man Month'
summary: 'Chapter 2, the titular essay and perhaps the most well known.'
slug: /tmmm-the-mythical-man-month
---

This is one of the more famous essays in the book, and the one I was most looking forward to. I've thought of it as the source of the notion that adding additional developers to a late project will just make it later.

Most of what this chapter covered is standard practice now days, the conclusions shouldn't come as much of a surprise such as

* The client puts pressure on the scheduled completion date - that doesn't govern when the actual completion date is. A Project Manager needs to be an effective communicator to set expectations appropriately.
* Adding additional developers late in the piece will slow the whole project down
* There's an optimal number of developers on a project that's governed sequential constraints on task partitioning
* Individual developers, more often than not, are optimistic with their estimates. There's often an unspoken assumption that nothing will go awry in the effort analysis

A factor that wasn't talked about which I think fits right in is that developer optimisim isn't just about assuming that nothing will go wrong, but also a mismatch between their understanding of the problem and the actual solution required. There is a lot of hidden complexity masquerading as domain knowledge which can cause a developer to underestimate a task. You don't know what you don't know.

A particular line of reasoning I thought was a little cheeky was 

> The programmer builds from pure thought-stuff: concepts and very flexible representations thereof. Because the medium is tractable, we expect few difficulties in implementation; hence our pervasive optimism. Because our ideas are faulty, we have bugs; hence our optimism is unjustified.
\
\
-- Federick P. Brooks, JR

Are faulty ideas an oblique reference to incomplete domain knowledge? In either case I wouldn't say a developer has minimal difficulty implementing of their ideas; [there's a whole class of bugs that are caused with difficultly of implentation](https://www.infoq.com/presentations/Null-References-The-Billion-Dollar-Mistake-Tony-Hoare/). I think it's a little harsh to call development generally tractable and that any bugs arising from it are due to the developers own faulty ideas. Prehaps it was oversimplified for a pithy quote, who knows.