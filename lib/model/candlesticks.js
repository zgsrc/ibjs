const Subscription = require("./subscription");

Date.getLocale('en').addFormat('{yyyy}{MM}{dd}  {hh}:{mm}:{ss}');

class Candlesticks extends Subscription {
    
    constructor(contract, field) {
        super(contract);
        Object.defineProperty(this, 'field', { value: field, enumerable: false });
    }
    
    async stream(retry) {
        this.service.headTimestamp(this.contract.summary, this.field, 0, 1).once("data", data => {
            this.earliestDataTimestamp = Date.create(data);
        }).send();
        
        return new Promise((yes, no) => {
            let req = this.service.realTimeBars(this.contract.summary, 5, this.field, false);
            this.subscriptions.push(req);
            this.count = 0;
            
            let errHandler = err => {
                if (!retry && err.timeout) {
                    this.stream(true).then(yes).catch(no);
                }
                else {
                    this.streaming = false;
                    no(err);
                }
            }
            
            req.once("error", errHandler).once("data", () => {
                req.removeListener("error", errHandler);
                req.on("error", err => {
                    this.streaming = false;
                    this.emit("error", `Real time streaming bars request for ${this.contract.summary.localSymbol} timed out.`);
                });
                
                this.streaming = true;
                yes(this);
            }).on("data", data => {
                data.date = Date.create(data.date * 1000);
                data.timestamp = data.date.getTime();
                this.previous = this.last;
                this.last = data;
                this.count++;
                this.emit("update", { contract: this.contract.summary.conId, type: "chart", field: "realtime", value: data });
            }).send();
        });
    }
    
}

module.exports = Candlesticks;