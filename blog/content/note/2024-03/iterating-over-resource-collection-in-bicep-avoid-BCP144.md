---
date: 2024-03-26T10:00:00+12:00
title: 'Iterating over a resource collection in bicep - avoid BCP144'
slug: /iterating-over-resource-collection-in-bicep-avoid-BCP144
---

Being doing a bit of IaC with Bicep recently and I ran into an issue when trying to iterate over a list of provisioned resources. I was trying to create a new resource for each one and I kept getting an error - bicep(BCP144)

## Iterating over a list of provisioned resources

I had a scenario where I needed to iterate over a list of provisioned resources and create a new resource for each one. The secnario was I was configuring records on a collection of DNS Zones.

### What I was trying to do

```bicep
param zones array

resource dnsZones 'Microsoft.Network/dnszones@2018-05-01' existing = [for zone in zones: {
  name: zone
}]

resource records 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = [for dnsZone in dnsZones: {
  parent: dnsZone
  ...
}]
```

Denied - you'll get this error: `Directly referencing a resource or module collection is not currently supported here. Apply an array indexer to the expression. bicep(BCP144)`

### Solution

What I needed to do is use an integer index instead to reference each resource object.

```bicep
param zones array

resource dnsZones 'Microsoft.Network/dnszones@2018-05-01' existing = [for zone in zones: {
  name: zone
}]

resource records 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = [for i in range(0,  length(zones)): {
  parent: dnsZones[i]
  ...
}]
```

Whatever, TIL.