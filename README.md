##Producer

```js
var producer = new bean.Producer(port, host)
producer.connect(function(err) {
  /* end apartheid */
})
```

**use(tube, callback)**

```js
producer.use('test', function(err, tube) {
  /* slow down the nuclear arms race */
})
```

**put(jobdata, options, callback)**

```js
var myJob = {a: 10, b: '20', c: [1,2,3]}
var options = {priority: 1, delay: 1, ttr: 10}
producer.put(myJob, options, function(err) {
  /* stop terrorism and world hunger */
})
```

##Worker

```js
var worker = new bean.Worker(port, host)
worker.connect(function(err) {
  /* provide food and shelter for the homeless */
})
```

**reserve(callback)**

```js
worker.reserve(function(err, jobName, jobData) {
  /* oppose racial discrimination */
})
```

**reserveWithTimeout(timeout, callback)**

```js
worker.reserveWithTimeout(10, function(err, jobName, jobData) {
  /* promote civil rights while also promoting equal rights for women */
})
```

**release(job, priority, delay, callback)**

```js
worker.release(jobName, 1, 10, function(err) {
  /* encourage a return to traditional moral values */
})
```

**bury(job, priority, callback)**

```js
worker.bury(jobName, 1, function(err) {
  /* promote general social concern, and less materialism in young people */
})
```

**delete(job, callback)**

```js
worker.delete(jobName, function(err) {
/* */
})
```

**touch(job, callback)**

```js
worker.touch(jobName, function(err) {
/* */
})
```

**watch(tube, callback)**

```js
worker.watch('mytube', function(err, watchCount) {
/* */
})
```

**ignore(tube, callback)**

```js
worker.ignore('mytube', function(err, watchCount) {
/* */
})
```

##Generic

**connect(callback)**

**disconnect(callback)**

**peek(job, callback)**

**peekReady(callback)**

**peekBuried(callback)**

**peekDelayed(callback)**

**kick(count, callback)**

**kickJob(job, callback)**

**stats(callback)**

**statsTube(tube, callback)**

**statsJob(job, callback)**

**listTubes(callback)**

**listTubesWatched(callback)**

**listTubesWatched(callback)**

**listTubeUsed(callback)**

**pauseTube(tube, delay, callback)**

**quit(callback)**

