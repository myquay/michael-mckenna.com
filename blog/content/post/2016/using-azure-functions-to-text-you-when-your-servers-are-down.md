---
publishDate: 2016-12-06T20:52:32+12:00
title: Using Azure Functions to text you when your servers are down
summary: The thing I like most about it is that it's serverless so no infrastructure to maintain and worry about.
url: /using-azure-functions-to-text-you-when-your-servers-are-down
tags:
    - guide
    - azure
---

So I've just read a great blog post by [Nick Malcolm](http://nick.malcolm.net.nz/) on [Using AWS Lambda to call and text you when your servers are down](https://thisdata.com/blog/using-aws-lambda-to-call-and-text-you-when-your-servers-are-down/). The thing I like most about it is that it's serverless so no infrastructure to maintain and worry about. 

However, not everyone is on AWS. The environment I want to monitor is all hosted in Azure! Turns out Azure also fully supports this serverless set up and it's just as easy, if not easier, to do the exact same thing using Azure Functions and Alerts. 

Sure there are paid services that take care of this exact problem but sometimes you just want to dip your toes in the water, and that's okay - treat this as a fun exercise not a handbook on how to replace your various monitoring services and products. 

To get through this post you'll need

* An Azure account
* A Twilio account

At the end you'll get a nice SMS alert whenever your site goes down (or whatever else you want to be alerted on - e.g. high CPU usage, or server load). This isn't aimed to replace the other offerings out there, it's pretty bare-bones, and at the end of the day it's hosted on the same platform that you're monitoring!

![](/images/smsalert.png)

### Step 1: Add a new Azure Function

If you haven't created an Azure Function App to host your function, [create one now](https://portal.azure.com/#create/Microsoft.FunctionApp). Azure Function Apps have two hosting models - "Consumption" or "App Service Plan". Consumption is similar to AWS Lambda where you pay only for the execution time of the function - but if you're already paying for an under utilised app service plan, you can just have that run your functions at no additional cost.

Go to your Azure Function App and create a new function that uses a HTTP trigger - you can use a wide range of languages, I'm going to choose node just because I want to.

![](/images/create-function.png)

We want this function to text us so we need to add a Twilio output binding - do this from the "integrate" tab and fill it with sensible defaults. Don't worry you can change things like the message and to number in the code, these are just fallback values. While you're at it you can remove the HTTP ($return) output - this is more a fire and forget function from the point of view of the trigger.

![](/images/output-binding.png)

**Note:** Don't put your actual Twilio auth token and sid in "Auth Token setting" and "Account SID setting" - these specify the **app setting keys** which contain your Twilio credentials, so put those credentials in your app settings like any other configuration value and specify what key you used here. To get to your function app settings click the "Function app settings" link on the bottom left.

### Step 2: Write our function
Now for the fun bit! Write our function that sends a message to Twilio. The function is going to accept a payload from an Azure Alert _(you can see the [full payload of the alert here](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/insights-webhooks-alerts))_ and respond by sending an SMS message. An Azure Alert provides lots of contextual information, but we are just going to use the name of the alert.

```

module.exports = function (context, req) {
    context.log('Uptime alert triggered: '+ req.body.context.name);
    context.bindings.message = {
        body : "🔥🔥 Warning! "+req.body.context.name+" 🔥🔥"
        //to: "" - using default
    };
    context.done();
};

```

Yep it's that easy - 8 nicely formatted lines including all the code ceremony.

Now, grab the function URL and let's set up our alert!

![](/images/function-code.png)

### Step 3: Create an Azure alert to trigger our function

You can set an alert to trigger on pretty much any condition you can think of in Azure, they're a bit scattered though the portal but anywhere you see "alert" you'll generally be able to also supply a web hook. Here's some supported scenarios I've seen:

* Server exceptions exceeding a certain threshold
* High memory usage
* High CPU usage
* Response time
* Availability
* Auto-scaling events
* Application Insight metrics including custom ones defined in your app

We want a SMS when our servers are down so we will set up an alert on an availability monitor using Application Insights. 

We're going to set up a simple ping test but we're just scratching the surface here - you can define what a successful response looks like and [even set up multi-step tests](https://docs.microsoft.com/en-us/azure/application-insights/app-insights-monitor-web-app-availability) which gives you a lot of control over what "availability" means in your situation.

If you click the "Alerts" option it allows you to specify a web hook, this is where we past the HTTP endpoint of our Azure Function we created earlier.

![](/images/alert-definition.png)

If you want to test it you can fire off the sample JSON [from here](https://docs.microsoft.com/en-us/azure/monitoring-and-diagnostics/insights-webhooks-alerts) to your Azure Function using Postman, cURL, or something - otherwise just attach the webhook to an alert that will 100% be triggered. E.g. CPU < 100%.

### All done

You'll now get an SMS alert every time one of your Azure alerts are triggered. In this example we've attached it to the availability monitor but I've only just touched on the functionality exposed. You could add Twilio voice support, pass in more context to the SMS message, add different triggers - literally everything can be improved on but hopefully this helps you see how easy Azure Functions are to use.