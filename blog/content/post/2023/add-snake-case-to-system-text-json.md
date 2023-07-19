---
date: 2023-07-20T10:00:00+12:00
title: Adding snake_case support to System.Text.Json
summary: It's not supported out of the box (yet) despite being quite popular (e.g. GitHub API) but it's super simple to add if you need it. 
url: /add-snake-case-to-system-text-json
tags:
    - dotnet
---

## Background

System.Text.Json only supports `CamelCase` naming policy out of the box. The good news is that [support is coming](https://github.com/dotnet/runtime/issues/782) but in the meantime you will need to roll your own policy. Lucky it's really easy to do.

## Solution

Newtonsoft.Json  has a little [String utility here](https://github.com/JamesNK/Newtonsoft.Json/blob/7b8c3b0ed0380cf76d66894e81bf4d4d5b0bd796/Src/Newtonsoft.Json/Utilities/StringUtils.cs#L200-L276) which can be used to convert a property name to `snake_case`.

Just wrap that bit of code up into a utility class.

```csharp
 /// <summary>
    /// ToSnakeCase algorthim from <see href="https://github.com/JamesNK/Newtonsoft.Json/blob/7b8c3b0ed0380cf76d66894e81bf4d4d5b0bd796/Src/Newtonsoft.Json/Utilities/StringUtils.cs#L200-L276">Newtonsoft.Json</see>
    /// </summary>
    public static class StringUtils
    {
        internal enum SnakeCaseState
        {
            Start,
            Lower,
            Upper,
            NewWord
        }

        /// <summary>
        /// Convert a string to snake case.
        /// </summary>
        /// <param name="s"></param>
        /// <returns></returns>
        public static string ToSnakeCase(string s)
        {
            if (string.IsNullOrEmpty(s))
            {
                return s;
            }

            //...Code omitted for brevity...

            return sb.ToString();
        }
    }
```

The reference it in a naming policy.

```csharp
public class SnakeCaseNamingPolicy : JsonNamingPolicy
{
    public override string ConvertName(string name)
    {
        return StringUtils.ToSnakeCase(name);
    }
}
```

That's it! Snake case support is now added.

### Usage

To serialise your objects in `snake_case`, just set the naming policy in the options.

```csharp
JsonSerializer.Serialize(objectToSerialise, new JsonSerializerOptions
            {
                PropertyNamingPolicy = new SnakeCaseNamingPolicy(),
                AllowTrailingCommas = false
            });
```