class FieldBuffer extends Subscription {
    
    constructor(quote, duration, field) {
        super();
        
        this.duration = duration;
        this.history = [ ];
        
        if (quote[field]) {
            this.history.push(quote[field]);
        }
        
        quote.on("update", data => {
            if (data.key == field) {
                this.history.push(data.newValue);
                this.prune();
                setInterval(() => this.prune(), duration);
                this.emit("update", data);
            }
        });
    }
    
    prune() {
        let now = (new Date()).getTime();
        while (this.history.length && now - this.history.first().time.getTime() > this.duration) {
            this.history.shift();
        }
    }
    
}