const queues: any = [];

let isFlushPending = false;

const p = Promise.resolve();

export function nextTick (fn) {
  return fn ? p.then(fn) : fn;
}

export function queueJobs (fn) {
  if (!queues.includes(fn)) {
    queues.push(fn);
  }

  queueFlush();
}

function queueFlush () {
  if (isFlushPending) return;
  isFlushPending = true;

  nextTick(flushJobs);
}

function flushJobs () {
  isFlushPending = false;
  let job;
  while ((job = queues.shift())) {
    job && job();
  }
}
