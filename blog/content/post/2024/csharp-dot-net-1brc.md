---
publishDate: 2024-03-04T23:29:12+12:00
title: The One Billion Row Challenge in .NET
summary: I just saw the one billion row challenge. I'm a bit late as the challenge was back in January but I thought it would be a fun exercise to try and solve it in .NET.
url: /csharp-dot-net-1brc
tags:
    - 1brc
---

## Introduction

The challenge is to process a text file of weather data and calcuate some aggregates such as minimum, mean, and maximum for each station. The kicker? The size of the input. It's a file that contains one billion rows.

The goal of the challenge is to create the fastest implementation. 

This isn't an offical entry or anything - the orginal challenge was specifically for Java but I thought it would be a fun exercise to see how I'd approach it in .NET.

This is a living post, I intend to update it as I try different approaches and learn more about the problem. I'll also be updating the GitHub repo with the code and results.

|  Parameter   | Description |
| -------- | ------- |
| **Language**  | C#     |
| **Framework** | .NET 8 |
| **GitHub** | *TBC* |
| **Input** | 1 billion rows of weather data |
| **Output** | Minimum, mean, and maximum for each station |
| **Test Machine** | i7-8809G, 32GB |

## The solutions

I'm going to try a few different approaches and see how they compare. I'll start with a simple, naive implementation and then iterate on that. I'll cover what I was trying in each of my attempts and the results I got.

I'm really interested in any other approaches people have tried or if you have any suggestions for me. Please open an issue in the GitHub repo if you have any ideas.

### Attempt 01: Simple implementation

I started with a simple implementation that just read the file and calculated the aggregates.

I gave exactly 0% consideration to performance, just whacked out a solution in about 10 seconds as I need to start somewhere to get a baseline to compare against.

The general gist is to store the data in a dictionary and then calculate the aggregates.

```csharp

//Read the data
 using var reader = new StreamReader(file.FullName);

 var data = new Dictionary<string, Measurement>();
 while (!reader.EndOfStream)
 {
     var stationParts = (await reader.ReadLineAsync())?.Split(';');

     var measurement = data.TryGetValue(stationParts[0], out var m) ? m : new Measurement();

     //Update the measurement
     var value = double.Parse(stationParts[1]);
     measurement.Sum += value;
     measurement.Min = Math.Min(measurement.Min, value);
     measurement.Max = Math.Max(measurement.Max, value);
     measurement.Count++;

     data[stationParts[0]] = measurement;
 }

 //Calculate and sort the measurements
 var measurements = data.Select(d => new
 {
     Station = d.Key,
     Min = d.Value.Min,
     Max = d.Value.Max,
     Mean = d.Value.Sum / d.Value.Count
 })
 .OrderBy(s => s.Station)
 .ToArray();

 //Output data
 Console.Write("{");
 for (int i = 0; i < measurements.Length - 2; i++)
 {
     Console.Write($"{measurements[i].Station}={measurements[i].Min}/{measurements[i].Mean:#.0}/{measurements[i].Max}, ");
 }
 Console.Write($"{measurements[^1].Station}={measurements[^1].Min}/{measurements[^1].Mean:#.0}/{measurements[^1].Max}}}");

```

|  Metric   | Value |
| -------- | ------- |
| **Elapsed Time** | 5 Minutes 34 Seconds |

#### Remarks

Very slow, but we're off the mark!

The most expensive operations are all in parsing the file where we are iterating over the lines and parsing them. This is where I'm going to look to optimise first.

*Note: I've done the profiling with a smaller dataset for now while it's so slow 😬😅*

|Function Name|Total \[unit, %\]|Self \[unit, %\]|Call Count|Module|
|-|-|-|-|-|
|\| - System.IO.TextReader.ReadLineAsync\(\)|231.40ms \(11.89%\)|231.40ms \(11.89%\)|999701|system.runtime|
|\| - System.Double.Parse\(string\)|222.67ms \(11.44%\)|222.67ms \(11.44%\)|999702|system.runtime|
|\| - System.String.Split\(char, StringSplitOptions\)|205.04ms \(10.53%\)|205.04ms \(10.53%\)|999702|system.runtime|
|\| - Dictionary\`2.TryGetValue\(!0, ref !1\)|142.98ms \(7.34%\)|142.98ms \(7.34%\)|999702|System.Collections|
|\| - Dictionary\`2.set\_Item\(!0, !1\)|124.20ms \(6.38%\)|124.20ms \(6.38%\)|999702|System.Collections|
