---
date: 2023-05-11T10:00:00+12:00
title: 'TMMM: The Mythical Man Month'
summary: 'Chapter 2, the titular essay and perhaps the most well known.'
slug: /tmmm-the-mythical-man-month
---

One to the more famous essays in the book, and the one I was most looking forward to. It carries the book's signature observation: adding people to a late project just makes it later.

It was interesting to see that many of the points argued in the section are just as valid today, a lot of it could just be classified as standard practice or baseline knowledge. Some conclusions are

* The client puts pressure on the scheduled completion date - that doesn't govern when the actual completion date is. A Project Manager needs to be an effective communicator to set expectations appropriately.
* Adding additional developers late in the piece will slow the whole project down
* There's an optimal number of developers on a project
* Individual developers, more often than not, are optimistic with their estimates. There's often an unspoken assumption that nothing will go awry in the effort analysis

A factor that wasn't talked about which I think fits right in is that developer optimisim isn't just about assuming that nothing will go wrong, but also a mismatch between their understanding of the problem and the actual solution required. There is a lot of hidden complexity masquerading as domain knowledge which can cause a developer to underestimate a task. You don't know what you don't know.

A particular line of reasoning I thought was a little cheeky was 

> The programmer builds from pure thought-stuff: concepts and very flexible representations thereof. Because the medium is tractable, we expect few difficulties in implementation; hence our pervasive optimism. Because our ideas are faulty, we have bugs; hence our optimism is unjustified.
\
\
-- Federick P. Brooks, JR

Are faulty ideas an oblique reference to incomplete domain knowledge? In either case I wouldn't say a developer has minimal difficulty implementing of their ideas; [there's a whole class of bugs that are caused with difficultly of implentation](https://www.infoq.com/presentations/Null-References-The-Billion-Dollar-Mistake-Tony-Hoare/). I think it's a little harsh to call development generally tractable and that any bugs arising from it are due to the developers own faulty ideas. Prehaps it was oversimplified for a pithy quote, who knows.