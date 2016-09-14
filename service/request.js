"use strict";

const Events = require("events");

class Request extends Events {
    
    constructor(dispatch, id, call, send, cancel, timeout) {
        super();
        
        this.dispatch = dispatch;
        this.id = id;
        this.call = call;
        
        if (!Object.isFunction(send)) {
            throw new Error("Send must be a function.");
        }
        else {
            this.send = () => {
                send(this);
                return this;
            };
        }
        
        if (cancel) {
            if (!Object.isFunction(cancel)) {
                throw new Error("Cancel must be a function.");
            }
            
            this.cancel = () => {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    delete this.timeout;
                }
                
                cancel(this);
                delete this.dispatch.requests[this.id];
                this.emit("close");
            };
        }
        else {
            this.cancel = () => {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    delete this.timeout;
                }
                
                delete this.dispatch.requests[this.id];
                this.emit("close");
            };
        }
        
        if (timeout) {
            if (!Object.isNumber(timeout) || timeout <= 0) {
                throw new Error("Timeout must be a positive number.");
            }
            
            this.timeout = setTimeout(() => {
                this.cancel();
                
                let timeoutError = new Error("Request " + (this.call || this.id) + " timed out.");
                timeoutError.timeout = timeout;
                this.emit("error", timeoutError, () => this.cancel());
            }, timeout);
            
            this.on("data", () => {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    delete this.timeout;
                }
            });
            
            this.on("end", () => {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    delete this.timeout;
                }
            });
            
            this.on("error", () => {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    delete this.timeout;
                }
            });
        }
    }
    
    proxy(destination, ref) {
        let id = this.id;
        this.on("data", data => { 
            destination.emit("data", { id: id, data: data, ref: ref }); 
        });
        
        this.on("end", () => { 
            destination.emit("end", { id: id, ref: ref }); 
        });
        
        this.on("error", error => { 
            destination.emit("error", { id: id, error: error, ref: ref }); 
        });
        
        return this;
    }
    
}

module.exports = Request;