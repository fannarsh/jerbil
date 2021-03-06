#jerbil

##Features

+ Full set of beanstalkd commands
+ Automatic reconnect
+ Automatic tube re-watch/re-use
+ Automatic [msgpack](http://msgpack.org/) job (de)serialization

###Usage

`npm install jerbil`

```js
//worker.js
var worker = new jerbil.Worker(port, host)

worker.connect(function(err) {
  worker.watch('mytube', function(err) {
    worker.reserve(function(err, jobName, jobData) {
      console.log('Received job', jobName)
    })
  })
})
```

```js
//producer.js
var producer = new jerbil.Producer(port, host)

producer.connect(function(err) {
  producer.use('mytube', function(err, tubeName) {
    var job = {name: 'testjob', someProp: 10}
    producer.put(job, {priority: 1, delay: 1, ttr: 10}, function(err, jobName) {
      console.log('Added job', jobName)
    })
  })
})
```

##Commands

###Generic

*Commands available to workers and producers*

+ `setRaw`() *Disable automatic msgpack (de)serialization*
+ `connect`(callback)
+ `disconnect`(callback)
+ `peek`(jobName, callback)
+ `peekReady`(callback)
+ `peekBuried`(callback)
+ `peekDelayed`(callback)
+ `kick`(count, callback)
+ `kickJob`(jobName, callback)
+ `stats`(callback)
+ `statsTube`(tubeName, callback)
+ `statsJob`(jobName, callback)
+ `listTubes`(callback)
+ `listTubesWatched`(callback)
+ `listTubesWatched`(callback)
+ `listTubeUsed`(callback)
+ `pauseTube`(tubeName, pauseSeconds, callback)
+ `quit`(callback)

###Worker

```js
var worker = new jerbil.Worker(port, host)
```

+ `reserve`(callback)
+ `reserveWithTimeout`(timeoutSeconds, callback)
+ `release`(jobName, priority, delaySeconds, callback)
+ `bury`(jobName, priority, callback)
+ `delete`(jobName, callback)
+ `touch`(jobName, callback)
+ `watch`(tubeName, callback)
+ `ignore`(tubeName, callback)

###Producer

```js
var producer = new jerbil.Producer(port, host)
```

+ `use`(tubeName, callback)
+ `put`(jobData, options, callback)

> **Put options**
> + `priority` A number in range [0, 4294967295]. Jobs with smaller priority values will be scheduled before jobs with larger priorities
> + `delay` Number of seconds to wait before putting the job in the ready queue. The job will be in the "delayed" state during this time
> + `ttr` time to run -- number of seconds to allow a worker to run this job. This time is counted from the moment a worker reserves this job. If the worker does not delete, release, or bury the job within the specified time, the job will time out and beanstalkd will release the job. The minimum ttr is 1. If the client sends 0, the server will silently increase the ttr to 1

##License

**IDNCWYDWTSALAIANLFDIDUOI-BIYFIUTIG-TTFN-v1.0**

I Do Not Care What You Do With This Software As Long As I Am Not Liable For Damages Incurred During Use Of It - But If You Find It Useful That Is Great - Ta Ta For Now - Version One Dot Zero

