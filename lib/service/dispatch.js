const Request = require("./request");

class Dispatch {
    
    constructor(id) {
        this.id = 1 || id;
        this.requests = { };
    }
    
    singleton(call, send, cancel, timeout, event) {
        if (this.requests[event]) {
            return this.requests[event];
        }
        else {
            let request = new Request(this, event, call, send, cancel, timeout);
            this.requests[event] = request;
            return request;
        }
    }
    
    instance(call, send, cancel, timeout) {
        let request = new Request(this, this.id, call, send, cancel, timeout);
        this.requests[request.id] = request;
        this.id++;
        return request;
    }
    
    data(id, data) {
        if (this.requests[id]) {
            this.requests[id].emit("data", data, () => this.cancel(id));
        }
    }
    
    end(id) {
        if (this.requests[id]) {
            this.requests[id].emit("end", () => this.cancel(id));
        }
    }
    
    error(id, err) {
        if (this.requests[id]) {
            this.requests[id].emit("error", err, () => this.cancel(id));
        }
    }
    
    cancel(id) {
        if (this.requests[id]) {
            this.requests[id].cancel();
        }
    }
    
    connected() {
        for (let p in this.requests) {
            if (this.requests[p] && this.requests[p].emit) {
                this.requests[p].emit("connected");
            }
        }
    }
    
    disconnected() {
        for (let p in this.requests) {
            if (this.requests[p] && this.requests[p].emit) {
                this.requests[p].emit("disconnected");
            }
        }
    }
    
}

module.exports = Dispatch;