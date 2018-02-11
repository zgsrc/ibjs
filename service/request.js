

const Events = require("events");

class Request extends Events {
    
    constructor(dispatch, id, call, send, cancel, timeout, oneOff) {
        super();
        
        Object.defineProperty(this, "dispatch", { value: dispatch, enumerable: false });
        
        this.id = id;
        this.call = call;
        
        if (!typeof send == "function") {
            throw new Error("Send must be a function.");
        }
        else {
            Object.defineProperty(this, "send", {
                value: () => {
                    if (timeout) {
                        if (typeof timeout != "number" || timeout <= 0) {
                            throw new Error("Timeout must be a positive number.");
                        }

                        this.timeout = setTimeout(() => {
                            this.cancel();

                            let timeoutError = new Error("Request " + (this.call || this.id) + " timed out.");
                            timeoutError.timeout = timeout;
                            this.emit("error", timeoutError, () => this.cancel());
                        }, timeout);

                        this.once("data", () => {
                            if (oneOff) {
                                this.cancel();
                            }
                            else if (this.timeout) {
                                clearTimeout(this.timeout);
                                delete this.timeout;
                            }
                        });

                        this.once("end", () => {
                            if (oneOff) {
                                this.cancel();
                            }
                            else if (this.timeout) {
                                clearTimeout(this.timeout);
                                delete this.timeout;
                            }
                        });

                        this.once("error", () => {
                            if (oneOff) {
                                this.cancel();
                            }
                            else if (this.timeout) {
                                clearTimeout(this.timeout);
                                delete this.timeout;
                            }
                        });
                    }

                    try {
                        send(this);
                    }
                    catch (ex) {
                        this.emit("error", ex);
                    }

                    return this;
                },
                enumerable: false
            });
        }
        
        if (cancel) {
            if (!typeof cancel == "function") {
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
                
                this.cancel = () => { };
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
                
                this.cancel = () => { };
            };
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
            destination.emit("error", { 
                id: id, 
                error: { message: error.message, stack: error.stack, timeout: error.timeout }, 
                ref: ref 
            }); 
        });
        
        return this;
    }
    
}

module.exports = Request;