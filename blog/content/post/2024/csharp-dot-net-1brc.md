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
| **GitHub** | https://github.com/myquay/1brc |
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

### Attempt 02: Improved Parser

**Update: 2024-03-13**

I'm going to try and improve the parser first. `ReadLineAsync` is a terrible choice because it's doing a [bunch of string things](https://github.com/Microsoft/referencesource/blob/master/mscorlib/system/io/streamreader.cs) that we don't need. 

My general strategy here is to work with the byte stream directly to avoid all the string operations and use Span<T> so we can avoid unnecessary allocations.

```csharp
Span<byte> buffer = new byte[1024 * 512];
var data = new Dictionary<string, Measurement>();

using var reader = file.OpenRead();

int bufferOffsetStart = 0;

while (reader.Read(buffer) is int numberRead)
{
    if(numberRead == 0)
        break;

    if(numberRead < buffer.Length) //If bytes read is maller than buffer, truncate the buffer
        buffer = buffer[..numberRead];

    if (buffer[bufferOffsetStart] == 239)
        bufferOffsetStart+=3; //SKIP BOM

    //Iterate through all the lines
    while(buffer.Slice(bufferOffsetStart).IndexOf(newLine) is int newLineIndex and > -1)
    {
        var line = buffer.Slice(bufferOffsetStart, newLineIndex);
        bufferOffsetStart += newLineIndex + 1; //Skip the newline

        var seperatorIndex = line.IndexOf(seperator);

        var name = Encoding.UTF8.GetString(line[..seperatorIndex]);
        var measurement = data.TryGetValue(name, out var m) ? m : new Measurement();

        var value = double.Parse(line[(seperatorIndex + 1)..]);

        measurement.Sum += value;
        measurement.Min = measurement.Min < value ? measurement.Min : value;
        measurement.Max = measurement.Max > value ? measurement.Max : value;
        measurement.Count++;

        data[name] = measurement;
    }

    //Backtrack to the start of the line
    reader.Seek(bufferOffsetStart - buffer.Length, SeekOrigin.Current);
    bufferOffsetStart = 0;
}
```

|  Metric   | Value |
| -------- | ------- |
| **Elapsed Time** | 3 Minutes 21 Seconds |

#### Remarks

Better! I guess the parsing is still the most expensive part, I'm going to see what I can do to optimise that.

|Function Name|Total \[unit, %\]|Self \[unit, %\]|Call Count|Module|
|-|-|-|-|-|
|\| - System.Double.Parse\(ReadOnlySpan\`1, NumberStyles, IFormatProvider\)|201.09ms \(11.61%\)|201.09ms \(11.61%\)|1000000|system.runtime|
|\| - Span\`1.Slice\(int32, int32\)|124.24ms \(7.17%\)|124.24ms \(7.17%\)|3000001|system.runtime|
|\| - Dictionary\`2.TryGetValue\(!0, ref !1\)|115.96ms \(6.70%\)|115.96ms \(6.70%\)|1000000|System.Collections|
|\| - System.MemoryExtensions.IndexOf\(Span\`1, !!0\)|105.26ms \(6.08%\)|105.26ms \(6.08%\)|2000027|System.Memory|
|\| - Dictionary\`2.set\_Item\(!0, !1\)|103.00ms \(5.95%\)|103.00ms \(5.95%\)|1000000|System.Collections|