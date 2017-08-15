"use strict";

class Scheduler {
    
    constructor() {
        this.timers = { };
    }
    
    notify(time, cb) {
        if (time.isPast() || time.secondsFromNow() < 1) {
            cb();
        }
        else {
            let name = time.getTime();
            if (this.timers[name]) this.timers[name].callbacks.push(cb);
            else {
                this.timers[name] = { callbacks: [ cb ] };
                setTimeout(() => this.timers[name].callbacks.forEach(cb => cb()), time.millisecondsFromNow() - 10);
            }
        }
    }
    
}

module.exports = Scheduler;