"use strict";

const Dispatch = require("./dispatch"),
      relay = require("./relay");

class Proxy {
    
    constructor(socket, dispatch) {
        
        dispatch = dispatch || new Dispatch();
        
        socket.on("connected", msg => {
            dispatch.connected();
        }).on("disconnected", msg => {
            dispatch.disconnected();
        }).on("data", msg => {
            dispatch.data(msg.ref, msg.data);
        }).on("end", msg => {
            dispatch.end(msg.ref);
        }).on("error", msg => {
            dispatch.error(msg.ref, msg.error);
        });
        
        this.isProxy = true;
        
        this.socket = socket;
        
        this.dispatch = dispatch;
        
        this.relay = socket => relay(this, socket);
        
        this.autoOpenOrders = autoBind => {
            socket.emit("command", {
                fn: "autoOpenOrders",
                args: [ autoBind ]
            });
        };
        
        this.globalCancel = () => {
            socket.emit("command", {
                fn: "globalCancel",
                args: [ ]
            });
        };
        
        this.system = request("system", null, socket, dispatch);
        
        this.currentTime = request("currentTime", 2000, socket, dispatch);
        
        this.contractDetails = request("contractDetails", 10000, socket, dispatch);

        this.fundamentalData = request("fundamentalData", 20000, socket, dispatch);
        
        this.historicalData = request("historicalData", 20000, socket, dispatch);
        
        this.headTimestamp = request("headTimestamp", 20000, socket, dispatch);
        
        this.realTimeBars = request("realTimeBars", 10000, socket, dispatch);
        
        this.mktData = request("mktData", 10000, socket, dispatch);
        
        this.mktDepth = request("mktDepth", 10000, socket, dispatch);

        this.scannerParameters = request("scannerParameters", 10000, socket, dispatch);
        
        this.scannerSubscription = request("scannerSubscription", 10000, socket, dispatch);

        this.accountSummary = request("accountSummary", 10000, socket, dispatch);
        
        this.accountUpdates = request("accountUpdates", 10000, socket, dispatch);
        
        this.executions = request("executions", 10000, socket, dispatch);
        
        this.openOrders = request("openOrders", 10000, socket, dispatch);
        
        this.allOpenOrders = request("allOpenOrders", 10000, socket, dispatch);
        
        this.positions = request("positions", 10000, socket, dispatch);
        
        this.orderIds = request("orderIds", 10000, socket, dispatch);
        
        this.placeOrder = request("placeOrder", 10000, socket, dispatch);
        
        this.exerciseOptions = request("exerciseOptions", 10000, socket, dispatch);
        
        this.newsBulletins = request("newsBulletins", null, socket, dispatch);
        
        this.queryDisplayGroups = request("queryDisplayGroups", 10000, socket, dispatch);
        
        this.subscribeToGroupEvents = request("subscribeToGroupEvents", 10000, socket, dispatch);
        
    }
    
}

function request(fn, timeout, socket, dispatch) {
    return function() {
        let args = Array.create(arguments);
        return dispatch.instance(
            fn, 
            req => {
                socket.emit("request", {
                    fn: fn,
                    args: args,
                    ref: req.id
                });
            }, 
            req => {
                socket.emit("cancel", { 
                    ref: req.id
                });
            }, 
            timeout
        );
    };
}

module.exports = Proxy;