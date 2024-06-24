---
publishDate: 2024-06-23T13:12:11+12:00
title: Debouncing input change event in Vue 3; wait until user stops typing
summary: Ever needed to create an auto-complete that's powered by an auto-complete API, or have a search field you want to automatically run without forcing the user to hit enter? Use this technique to avoid excessive traffic to your endpoints.
url: /debouncing-input-change-event-wait-until-user-stops-typing
tags:
    - csharp
    - vuejs
---

Ever needed to create an auto-complete that's powered by an auto-complete API, or have a search field you want to automatically run without forcing the user to hit enter? We need to wait until the user has stopped typing before we make the call to the server instead to triggering the request on every key press. This is called debouncing.

In this post I'll show you how I created a component in Vue 3 that debounces the input change event of a wrapped input field.

## The scenario

I have a search field that I've bound to a varible using `v-model` in Vue.js. The user's input to the control is placed into the variable immediately, however I want to make a call to the server to search for items that match the search term once the user has stopped typing. I don't want to make a call to the server on every key press; reacting to changes to the bound variable is not going to work.

## The component

Here's the component I created to debounce the input change event:

```js

<script setup>

    import { watch, ref } from 'vue'
    import _debounce from 'lodash/debounce'

    const internalModel = ref('')
    const model = defineModel()
    const props = defineProps({
        delay: {
            type: Number,
            default: 500
        },
        placeholder: {
            type: String,
            default: ''
        },
        class: {
            type: String,
            default: ''
        },
    })

    watch(internalModel, (newVal) => {
        updateModel(newVal);
    })

    const updateModel = _debounce((newVal) => {
        model.value = newVal
    }, props.delay)

</script>
<template>
    <input :class="props.class" type="text" v-model="internalModel" :placeholder="props.placeholder" />
</template>

```

### import _debounce from 'lodash/debounce'

We're using the `_debounce` function from loadash to do most of the heavy lifting. You'll need this library installed in your project to use this component.

### const internalModel = ref('')

This is the variable that the input field is bound to, it's bound to the input field using `v-model` and contains all the changes as they happen.

### const model = defineModel()

Here we are defining the model that the debounced input field is bound to. This is the variable that we want to update once the user has stopped typing.

### const props = defineProps({ ... })

The `delay` prop is the time in milliseconds that we want to wait after the user has finished typing before updating the model. The `placeholder` and `class` props are passed through to the input field to allow for customisation; add any other props you need here.

### watch(internalModel, (newVal) => { ... })

We're watching the `internalModel` variable for changes. This is the variable that the input field is bound to. When the user types into the input field, this function is called with the new value.

### const updateModel = _debounce((newVal) => { ... }, props.delay)

This is the heart of the component. We're using lodash's `_debounce` function to wrap the function that updates the model. This will have the effect of only updating the value once the user has stopped typing for the amount of time specified in the `delay` prop.

I'm really enjoying the new composition API in Vue 3 and happy with how I can express functionality like this. I hope you found this useful. Let me know if you have any questions or suggestions by raising an issue in this blog's GitHub repository.