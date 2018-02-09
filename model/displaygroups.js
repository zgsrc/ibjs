const Subscription = require("./subscription");

class DisplayGroups extends Subscription {
    
    constructor(session) {
        super(session);
        
        this.service.queryDisplayGroups().on("data", groups => {
            groups.forEach((group, index) => {
                let displayGroup = this.service.subscribeToGroupEvents(group);
                this.subscriptions.push(displayGroup);
                this[index] = new DisplayGroup(this, group, displayGroup.id);
                displayGroup.on("data", async contract => {
                    if (contract && contract != "none") {
                        try {
                            this[index].contract = await session.contract(contract);
                            this.emit("update", this[index]);
                        }
                        catch (ex) {
                            this.emit("error", ex);
                        }
                    }
                    else {
                        this[index].contract = null;
                    }
                }).send();
                
                Object.defineProperty(this, "loaded", { value: true });
                this.emit("load");
            });
        }).send();
    }
    
}

class DisplayGroup {
    
    constructor(displayGroups, group, id) {
        this.group = group;
        
        this.contract = null;
        
        Object.defineProperty(this, "_id", { value: id, enumerable: false });
        
        Object.defineProperty(this, "update", { 
            value: contract => {
                if (contract.summary) displayGroups.service.updateDisplayGroup(this._id, this.contract.summary.conId.toString() + "@" + this.contract.summary.exchange);
                else if (contract) displayGroups.service.updateDisplayGroup(this._id, this.contract.toString());
                else throw new Error("No contract specified.");
            },
            enumerable: false
        });
        
        return Subscription.observable(this);
    }
    
}

module.exports = DisplayGroups;