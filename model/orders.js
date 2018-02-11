

const Subscription = require("./subscription"),
      Order = require("./order"),
      contract = require("./contract");

class Orders extends Subscription {
    
    constructor(service, local) {
        super(service);
        
        this.nextOrderId = null;
        
        this.subscriptions.push((local ? this.service.openOrders() : this.service.allOpenOrders()).on("data", async data => {
            if (data.nextOrderId) {
                this.nextOrderId = data.nextOrderId;
            }
            else {
                let id = data.orderId;
                if (id == 0) {
                    if (data.state) id = data.state.permId;
                    if (data.ticket) id = data.ticket.permId;
                    id = id + "_readonly";
                }

                if (this[id] == null) {
                    this[id] = new Order(await contract.first(this.service, data.contract), data);
                }
                else {
                    if (data.ticket) this[id].ticket = data.ticket;
                    if (data.state) this[id].state = data.state;
                    this[id].emit("update");
                }

                if (data.orderId == 0) {
                    this[id].readOnly = true;
                }

                this.emit("update", { account: data.state.account, type: "order", field: id, value: this[id] });
            }
        }).on("end", () => {
            this.loaded = true;
            this.emit("load");
        }).on("error", err => {
            this.streaming = false;
            this.emit("error", err);
        }));
    }
    
    async stream() {
        this.streaming = true;
        return new Promise((yes, no) => this.subscriptions[0].send().once("load", yes).once("error", no));
    }
    
    nextOrderId(count) {
        this.service.orderIds(count > 0 ? count : 1);
    }
    
    placeOrder(order) {
        if (order.readOnly) {
            throw new Error("Cannot modify read-only trade.");
        }
        
        if (order.orderId == null) {
            order.orderId = this.nextOrderId;
            this[order.orderId] = order;
        }

        if (order.children.length) {
            order.children.forEach(child => {
                child.parentId = order.orderId;
                delete child.parent;
            });
        }
        
        this.service.placeOrder(order.orderId, order.contract.summary, order.ticket).send();
        
        return order;
    }
    
    cancelOrder(order) {
        if (order && order.orderId) {
            if (!order.readOnly) this.service.cancelOrder(order.orderId);
            else throw new Error("Cannot cancel read-only trade.");
        }
        else throw new Error("Order has not been placed.");
    }
    
    cancelAllOrders() {
        this.service.globalCancel();
    }
    
    cancel() {
        this.streaming = false;
        super.cancel();
    }
    
}

const serviceLookup = { };
module.exports = (service, local) => {
    return serviceLookup[service] || (serviceLookup[service] = new Orders(service, local));
};