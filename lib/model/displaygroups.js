const Subscription = require("./subscription"),
      Contract = require("./contract");

class DisplayGroups extends Subscription {
    
    constructor(service) {
        super(service);
    }
    
    async stream() {
        return new Promise((yes, no) => {
            this.service.queryDisplayGroups().on("data", groups => {
                groups.forEach((group, index) => {
                    let displayGroup = this.service.subscribeToGroupEvents(group);
                    this.subscriptions.push(displayGroup);
                    this[index] = new DisplayGroup(this, group, displayGroup.id);
                    displayGroup.on("data", async contract => {
                        if (contract && contract != "none") {
                            try {
                                this[index].contract = await contract.first(this.service, contract);
                                delete this[index].error;
                            }
                            catch (ex) {
                                this[index].error = ex;
                            }
                        }
                        else {
                            this[index].contract = null;
                        }
                    }).send();

                    this.loaded = true;
                    yes();
                });
            }).once("error", err => no(err)).send();
        })
    }
    
}

class DisplayGroup {
    constructor(displayGroups, group, id) {
        this.group = group;
        this.contract = null;
        Object.defineProperty(this, "update", { 
            value: contract => {
                if (contract.summary) displayGroups.service.updateDisplayGroup(id, this.contract.summary.conId.toString() + "@" + this.contract.summary.exchange);
                else if (contract) displayGroups.service.updateDisplayGroup(id, this.contract.toString());
                else throw new Error("No contract specified.");
            },
            enumerable: false
        });
    }
}

module.exports = DisplayGroups;