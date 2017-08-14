"use strict";

class Scheduler {
    
    constructor() {
        super();
        this.timers = { };
    }
    
    notify(time, cb) {
        if (time.isPast() || time.secondsFromNow() < 10) cb();
        else {
            if (this.timers[time.getTime()]) {
                this.timers[time.getTime()].callbacks.push(cb);
            }
            else {
                this.timers[time.getTime()] = {
                    callbacks: [ cb ],
                    timer: setTimeout(() => {
                        setTimeout(() => {
                            this.timers[time.getTime()].callbacks.forEach(cb => cb());
                            delete this.timers[time.getTime()];
                        }, time.millisecondsFromNow() - 5);
                    }, time.millisecondsFromNow() - 5000)
                }
            }
        }
    }
    
}

module.exports = Scheduler;