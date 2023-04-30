---
publishDate: 2016-06-07T22:40:32+12:00
title: Creating custom knockout bindings in typescript.
slug: /creating-custom-knockout-bindings-in-typescript
aliases: 
    - /creating-custom-knockout-bindings-in-typescript
---

In Javascript you create a custom knockout.js binding like this

```javascript
//Initialise the binding to the value in the input
ko.bindingHandlers.initValue = {
    init: function (element, valueAccessor) {
        valueAccessor()($(element).val());
    }
};
```

But in TypeScript you'll get the error

```
Property 'initValue' does not exist on type 'KnockoutBindingHandlers'.
```

Just create a definition file for your custom bindings, something like `knockout.bindings.d.ts` and provide a definition for your binding.

```
interface KnockoutBindingHandlers {
    initValue: KnockoutBindingHandler;
}
```

Now it will _transpile_ correctly.