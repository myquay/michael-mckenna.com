+++
date = "2016-05-02T09:56:32+12:00"
description = "We create an observable that either emits values from the source or the alternate source based on the status of the circuit breaker."
title = "Reactive Extensions .NET: Implementing the circuit breaker pattern"
url = "/reactive-extensions-dot-net-implementing-the-circuit-breaker-pattern"
+++

_This article assumes you're familiar with both [reactive extensions](http://reactivex.io/) [and the circuit](http://martinfowler.com/bliki/CircuitBreaker.html) [breaker pattern](https://msdn.microsoft.com/en-us/library/dn589784.aspx), although we're focusing on .NET reactive extensions have been implemented in lots of different languages so the same principles apply._

Microservices are great but they can be a little temperamental at times because there can be a lot of moving parts to service one request. This isn't all bad as the server can often tackle each moving part in parallel speeding up the response the client gets. However we don't normally want one moving part to bring down the entire request pipeline so we need to make sure we're handling each microservice in a reliable manner.

It's hard to talk about microservices with mentioning Netflix - in projects if we go ahead with the microservices architecture I love to use reactive extensions. Netflix has a great [blog post here](http://techblog.netflix.com/2013/02/rxjava-netflix-api.html) about how and why they went ahead with reactive extensions which I agree with. My favourite thing about reactive extensions is that they allow developers to take advantage of server-side concurrency without worrying about too many of the messy details.

**Why use the circuit breaker pattern with reactive extensions**

Reactive extensions have a few basic operations that you can use to increase the reliability of your microservice architecture:

* **catch:** recover from an `onError` notification by continuing the sequence
* **retry:** resubscribe to the source observable on an `onError` notification

But these only cover basic requirements. What if we wanted to support something a bit more fancy like the circuit breaker pattern? Well reactive extensions can easily be composed to create new extensions to help with different requirements. In this blog post we're going to compose our own reactive circuit breaker extension.

**The recoverWith operation**

The `recoverWith` operation will accept an alternate datasource as well as a circuit breaker name. This named instance will be shared among all observables that use a circuit breaker of the same name.

It's always easier to explain with a bit of code - here is our end game.

```csharp

//Example usage
observable
    .recoverWith(alternativeObservable, "circuit-breaker-key")
    .Subscribe(...);

//Example of how to define circuit breaker settings
//This is a static method and can be defined at startup if need be
CircuitBreaker
    .GetInstance("circuit-breaker-key")
    .ApplyPolicy(new CircuitBreakerPolicy{
        CircuitResetTimeout = TimeSpan.FromSeconds(10),
        InvocationTimeout = TimeSpan.FromSeconds(2),
        MaxErrors = 3
    });
```

To support the above scenario we need to build two main components, the reactive extension and the circuit breaker. There's [a couple](https://www.nuget.org/packages/CircuitBreaker.Net/) [of existing](https://www.nuget.org/packages/Helpful.CircuitBreaker/) [circuit breakers](https://www.nuget.org/packages/Polly/) out there but I just wanted something threadsafe, light-weight, and with an interface that lends itself to the scenario I'm deploying it in - hence yet another library ;)

**The reactive extension**

This is the interesting part! The reactive extension itself is pretty straight forward - no doubt there's a better way to do this but it worked for me. 

Basically we create an observable that either emits values from the source or the alternate source based on the status of the circuit breaker. Each time the source observable errors or times out we notify the relevant circuit breaker and either retry the main observable or use the alternative observable. 

```csharp

public static IObservable<T> RecoverWith<T>(this IObservable<T> source, IObservable<T> alternateSource, string circuitBreakerName = "global") where T : class
{
    //Step 1: Grab a reference to a circuit breaker
    //By default all observables are on the circuit breaker "global"
    var cb = CircuitBreaker.GetInstance(circuitBreakerName);
    
    //Step 2: Create the observable that's protected by the circuit breaker
    return Observable.Create<T>(observer =>
        {
            source
                .Subscribe(
                    observer.OnNext
                    observer.OnError, 
                    () => { 
                              cb.OperationSucceeded();  
                              observer.OnCompleted(); 
                    });
            return Disposable.Empty;
        })
        //Throw exception if invocation taking too long
        .Timeout(cb.Policy.InvocationTimeout)
        .Catch((Exception ex) =>
        {
            //Let the circuit breaker decide if we're going to try again 
            //or return the alternate source
            return cb.GetSourceOnError(ex, 
                       source.RecoverWith(alternateSource, 
                           circuitBreakerName), 
                       alternateSource);
        });
}
```

I won't go over the implementation of the circuit breaker line by line but the interesting method is `GetSourceOnError` which notifies the circuit breaker and gets back the observable we should continue with. If the circuit breaker hasn't tripped we'll re-wrap the source observable in our `RecoverWith` extension and retry.

**Show me the <strike>money</strike> source code**

The full source code including the extension and circuit breaker implementation are [available on GitHub here](https://github.com/myquay/Solve.Reliability.Rx).