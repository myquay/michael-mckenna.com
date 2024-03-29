---
publishDate: 2016-04-28T09:56:32+12:00
title: 'GUIDs part 2: GUID as gold'
summary: How are GUIDs unique with out a central watch dog?
url: /guid-as-gold
tags:
    - guid
    - guide
series: guid-one
---

How are GUIDs unique with out a central watch dog? They do it through the algorithm that generates them. The specification lists 5 different ways you can end up with a unique identifier, if and only if you follow the instructions. The specification can't prevent someone from choosing the same GUID as you on purpose *(a watchdog might be able to)* but it does prevent them accidentally generating the same GUID as you if they're following it.

> ISBN numbers are not a security system, and neither are GUIDs; ISBN numbers and GUIDs  prevent accidental collisions. Similarly, traffic lights only prevent accidental collisions if everyone agrees to follow the rules of traffic lights; if anyone decides to go when the light is red then collisions might no longer be avoided, and if someone is attempting to deliberately cause a collision then traffic lights cannot stop them. 
\
\
-- [Eric Lippert's Erstwhile Blog](https://blogs.msdn.microsoft.com/ericlippert/2012/04/24/guid-guide-part-one/)

There are 5 different kinds of GUIDs - all have the uniqueness property but some have slightly different attributes, I'm going to talk about the 4 [explicitly defined in the spec](https://www.ietf.org/rfc/rfc4122.txt).

#### Version 1: Date-time and MAC address GUID

The general idea of this method is to take the computer's MAC address and concatenate it with the number of 100ns intervals since the start of the Gregorian calendar. Conceptually this type of GUID ensures uniqueness by representing a single point in space (the MAC address) and time (number of 100ns intervals).

It's main drawbacks is that anyone you give the GUID to will be able to find out both your MAC address and when you generated the GUID - so it's bad for your privacy. Since the resolution is 100ns, you needed to do something special to generate this type of GUID at a faster rate.

This was the original generation scheme for GUIDs so feel free to pop a few off for old times sake.

**Example of how to generate a version 1 GUID**

For this example we'll generate a GUID for **2000-01-01** on a machine with a random MAC address of **29-06-76-EC-E2-D7** and a clock sequence of **30802**

1. Convert time stamp to bytes and insert into the GUID: **<span style="color:red">01d3</span><span style="color:forestgreen">bfde</span><span style="color:lightcoral">63b00000</span>**
_GUID so far: **<span style="color:lightcoral">63b00000</span>-<span style="color:forestgreen">bfde</span>-<span style="color:red">01d3</span>**-xxxx-xxxxxxxxxxxx_

2. Convert clock sequence to bytes and insert into the GUID: **<span style="color:brown">7852</span>**
_GUID so far: 63b00000-bfde-01d3-<span style="color:brown">7852</span>-xxxxxxxxxxxx_

3. Insert the node ID into the GUID: **<span style="color:dodgerblue">290676ece2d7</span>**
_GUID so far: 63b00000-bfde-01d3-7852-**<span style="color:dodgerblue">290676ece2d7</span>**_

4. Next we set the version. Take the 7th byte perform an and operation with 0x0f followed by an or operation of 0x10.
GUID so far: 63b00000-bfde-**1**1d3-7852-290676ece2d7

5. Finally we set the variant. Take the 9th byte perform an and operation with 0x3f followed by an or operation of 0x80.
GUID so far: 63b00000-bfde-11d3-**b**852-290676ece2d7

The GUID for this example is: **63b00000-bfde-11d3-b852-290676ece2d7**

#### Version 2: DCE Security

I'm actually not going to talk about this version because it's [not in the spec](https://www.ietf.org/rfc/rfc4122.txt).

#### Version 3/5: MD5/SHA-1 hash & namespace

The only difference between version 3 & 5 is the hashing algorithm used - version 5 is preferred as MD5 is considered pretty weak.

The general idea of this method is to convert the namespace and the name given to bytes - concat, then hash. If you give the same name in the same namespace you will get the same GUID back.

**Example of how to generate a version 5 GUID**

For this example we'll generate a GUID for the name "www.example.com" using the namespace "6ba7b810-9dad-11d1-80b4-00c04fd430c8" _(what the spec suggests for DNS)_.

1. Convert the name into bytes
_77-77-77-2E-65-78-61-6D-70-6C-65-2E-63-6F-6D_

2. Convert the namespace into bytes
_6B-A7-B8-11-9D-AD-11-D1-80-B4-00-C0-4F-D4-30-C8_

3. Concatenate them and hash using the correct hashing method and take the first 16 bytes
_B6-3C-DF-A4-3D-F9-A6-8E-D7-AE-00-6C-5B-8F-D6-52_

4. Break up the hash into the main components of a GUID, **<span style="color:dodgerblue">timestamp</span>, <span style="color:red">clock sequence</span>, and <span style="color:forestgreen">node ID</span>**
**<span style="color:dodgerblue">B6-3C-DF-A4-3D-F9-A6-8E</span>-<span style="color:red">D7-AE</span>-<span style="color:forestgreen">00-6C-5B-8F-D6-52</span>**

5. Insert the timestamp component into the GUID: **<span style="color:dodgerblue">b63cdfa43df9a68e</span>**
_GUID so far: **<span style="color:dodgerblue">b63cdfa4-3df9-a68e</span>**-xxxx-xxxxxxxxxxxx_

6. Insert the clock sequence component into the GUID: **<span style="color:red">d7ae</span>**
_GUID so far: b63cdfa4-3df9-a68e-**<span style="color:red">d7ae</span>**-xxxxxxxxxxxx_

7. Insert the node ID component into the GUID: **<span style="color:forestgreen">b63cdfa43df9</span>**
_GUID so far: b63cdfa4-3df9-a68e-d7ae- **<span style="color:forestgreen">006c5b8fd652</span>**_

8. Next we set the version. Take the 7th byte perform an and operation with 0x0f followed by an or operation of 0x50.
_GUID so far: b63cdfa4-3df9-**5**68e-d7ae-006c5b8fd652

9. Finally we set the variant. Take the 9th byte perform an and operation with 0x3f followed by an or operation of 0x80.
_GUID so far: b63cdfa4-3df9-568e-**9**7ae-006c5b8fd652

The GUID for this example is: **b63cdfa4-3df9-568e-97ae-006c5b8fd652**

#### Version 4: Random

This is the most common one - it relies solely on random numbers. Literally just spray and pray. Since there's so many combinations [the change of a collision is minimal](https://en.wikipedia.org/wiki/Universally_unique_identifier#Random_UUID_probability_of_duplicates) when using a random number generator of sufficient entropy.

**Example of how to generate a version 4 GUID**

This is actually the easiest to create - fill it up with random bytes and then set the version and variant.

1. Generate some random data: 20-0A-DB-3D-B3-F4-AB-DE-29-C8-2C-68-88-D6-BE-30 
_GUID so far: 200adb3d-b3f4-abde-29c8-2c6888d6be30_

2. Next we set the version. Take the 7th byte perform an and operation with 0x0f followed by an or operation of 0x40.
_GUID so far: 200adb3d-b3f4-**4**bde-29c8-2c6888d6be30_

3. Finally we set the variant. Take the 9th byte perform an and operation with 0x3f followed by an or operation of 0x80.
_GUID so far: 200adb3d-b3f4-4bde-**a**9c8-2c6888d6be30_

The GUID for this example is: **200adb3d-b3f4-4bde-a9c8-2c6888d6be30**

<hr />

This is a 3 part series about my personal exploration of GUIDs. You can follow along to learn all about GUIDs, [check out my open source C# implementation](https://github.com/myquay/GuidOne) of the specification, and [visit a fun GUID generator I built called <b>guid.one</b>](http://guid.one).