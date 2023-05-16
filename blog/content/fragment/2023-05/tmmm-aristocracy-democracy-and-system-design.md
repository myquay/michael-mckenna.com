---
date: 2023-05-16T10:00:00+12:00
title: 'TMMM: Aristocracy, Democracy, and System Design'
summary: 'Chapter 4, the purpose of a programming system is to make a computer easy to use.'
slug: /tmmm-aristocracy-democracy-and-system-design
---

This chapter describes the importance of conceptual integrity and how to achieve it on a big project with hundreds of implementers. To help achieve consistency throughout the entire project Brooks proposes seperating the architectural effort *(what is to be done)* from the implementation effort *(how it is to be done)* so that the architecture is designed by a small number of people. By limiting the number of people involved in the architectural effort the implementers will be left to build a solution that conforms to a core set of basic concepts. To achieve this consistency someone must control the architectural design process; hence an aristocracy is more suited.


Granted this book talks from the perspective of system design in regards to projects such as the IBM System/360 where an aristocracy sounds more suited, I do think there are other projects such as standards which are more suited to design by committee. This is because standards generally require buy-in from a diverse set of stakeholders to become accepted; it's beneficial to make sure all viewpoints are heard.