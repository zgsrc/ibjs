"use strict";

const Dispatch = require("./dispatch"),
      relay = require("./relay"),
      parseString = require('xml2js').parseString;

function camelize(str) {
    return str.camelize(false);
}

function parseXML(txt, cb) {
    parseString(txt, { 
        trim: true, 
        mergeAttrs: true, 
        charkey: "text",
        tagNameProcessors: [ camelize ],
        attrNameProcessors: [ camelize ]
    }, cb);
}

class Service {
    
    constructor(ib, dispatch) {
        
        dispatch = dispatch || new Dispatch();
        
        attach(ib, dispatch);
        
        this.isProxy = false;
        
        this.socket = ib;
        
        this.dispatch = dispatch;
        
        this.relay = socket => relay(this, socket);
        
        this.mktDataType = type => {
            ib.reqMarketDataType(type);
            this.lastMktDataType = type;
        };
        
        this.autoOpenOrders = autoBind => {
            this.socket.reqAutoOpenOrders(autoBind || false);
            this.lastAutoOpenOrders = (autoBind || false);
        };
        
        this.orderIds = count => {
            this.socket.reqIds(count);
        };
        
        this.globalCancel = () => {
            this.socket.reqGlobalCancel();
        };
        
        this.system = () => {
            return dispatch.singleton(
                `system()`,
                req => null,
                req => null,
                null,
                "system"
            );
        };
        
        this.newsBulletins = singleton("news", "reqNewsBulletins", "cancelNewsBulletins", null, ib, dispatch);
        
        this.queryDisplayGroups = instance("queryDisplayGroups", null, 5000, ib, dispatch);
        
        this.subscribeToGroupEvents = instance("subscribeToGroupEvents", "unsubscribeFromGroupEvents", 5000, ib, dispatch);
        
        this.updateDisplayGroup = (reqId, contract) => {
            ib.updateDisplayGroup(reqId, contract);
        };
        
        this.currentTime = singleton("currentTime", "reqCurrentTime", null, 1000, ib, dispatch);
        
        this.contractDetails = instance("reqContractDetails", null, 10000, ib, dispatch);

        this.fundamentalData = instance("reqFundamentalData", null, 10000, ib, dispatch);
        
        this.historicalData = instance("reqHistoricalData", null, 10000, ib, dispatch);
        
        this.headTimestamp = instance("reqHeadTimestamp", null, 10000, ib, dispatch);
        
        this.realTimeBars = instance("reqRealTimeBars", "cancelRealTimeBars", 10000, ib, dispatch);
        
        this.mktData = instance("reqMktData", "cancelMktData", 10000, ib, dispatch);
        
        this.mktDepth = instance("reqMktDepth", "cancelMktDepth", 10000, ib, dispatch);

        this.scannerParameters = singleton("scannerParameters", "reqScannerParameters", null, 10000, ib, dispatch);
        
        this.scannerSubscription = instance("reqScannerSubscription", "cancelScannerSubscription", 10000, ib, dispatch);

        this.managedAccounts = singleton("managedAccounts", "reqManagedAccts", null, 10000, ib, dispatch);
        
        this.accountSummary = instance("reqAccountSummary", "cancelAccountSummary", 10000, ib, dispatch);
        
        this.accountUpdates = accountCode => {
            return dispatch.singleton(
                `accountUpdates(${ accountCode })`,
                req => ib.reqAccountUpdates(true, accountCode), 
                req => ib.reqAccountUpdates(false, accountCode),
                10000,
                "accountUpdates"
            );
        };
        
        this.positions = singleton("positions", "reqPositions", "cancelPositions", 10000, ib, dispatch);
        
        this.executions = instance("reqExecutions", null, 10000, ib, dispatch);
        
        this.commissions = () => {
            return dispatch.singleton(
                `commissions()`,
                req => null, 
                req => null,
                null,
                "commissions"
            );
        };
        
        this.openOrders = singleton("orders", "reqOpenOrders", null, 10000, ib, dispatch);
        
        this.allOpenOrders = singleton("orders", "reqAllOpenOrders", null, 10000, ib, dispatch);
        
        this.placeOrder = (orderId, contract, ticket) => {
            this.socket.placeOrder(orderId, contract, ticket);
        }
        
        this.cancelOrder = orderId => {
            this.socket.cancelOrder(orderId);
        };
        
        this.exerciseOptions = instance("exerciseOptions", "cancelOrder", 5000, ib, dispatch);
        
    }
    
}

function singleton(event, send, cancel, timeout, ib, dispatch) {
    return function() {
        return dispatch.singleton(
            `${ send }(${ Array.create(arguments).map(JSON.stringify).join(', ') })`,
            req => ib[send](...arguments), 
            cancel ? req => ib[cancel]() : null, 
            timeout,
            event
        );
    };
}

function instance(send, cancel, timeout, ib, dispatch) {
    return function() {
        return dispatch.instance(
            `${ send }(${ Array.create(arguments).map(JSON.stringify).join(', ') })`,
            req => ib[send](req.id, ...arguments), 
            cancel ? req => ib[cancel](req.id) : null, 
            timeout
        );
    };
}

function attach(ib, dispatch) {

    ib.on("connected", function() {
        dispatch.connected();
    }).on("disconnected", function() {
        dispatch.disconnected();
    }).on("error", function(err, args) {
        if (args) {
            if (args.id > 0) {
                dispatch.error(args.id, err);
            }
            else if (args.id < -1) {
                args.orderId = args.id;
                delete args.id;
                dispatch.error("order", args);
            }
            else {
                args.message = err.message;
                dispatch.data("system", args);
            }
        }
        else if (err.syscall == "connect" || err.code == "ECONNRESET") {
            dispatch.disconnected();
        }
        else if (err && err.id != -1) {
            console.log("UNCAUGHT ERROR MESSAGE");
            console.log(err);
        }
    });
    
    ib.on("nextValidId", function(orderId) {
        dispatch.data("system", { orderId: orderId });
    });
    
    ib.once("currentTime", function(time) {
        dispatch.data("currentTime", time);
    });  
    
    ib.on('contractDetails', function(reqId, contract) {
        dispatch.data(reqId, contract);
    }).on('bondContractDetails', function(reqId, contract) {
        dispatch.data(reqId, contract);
    }).on('contractDetailsEnd', function(reqId) {
        dispatch.end(reqId);
    });

    ib.on('fundamentalData', function(reqId, data) {
        if (data) {
            parseXML(data.toString(), function(err, result) {
                if (err) dispatch.error(reqId, err);
                if (result) dispatch.data(reqId, result);
            });
        }
        else {
            dispatch.end(reqId);
        }
    });

    ib.on('historicalData', function(reqId, date, open, high, low, close, volume, count, wap, hasGaps) {
        if (date && date.startsWith("finished")) {
            dispatch.end(reqId);
        }
        else {
            dispatch.data(reqId, {
                date: date, 
                open: open, 
                high: high, 
                low: low, 
                close: close, 
                volume: volume, 
                count: count, 
                wap: wap, 
                hasGaps: hasGaps 
            });
        }
    });
    
    ib.on('headTimestamp', function(reqId, timestamp) {
        dispatch.data(reqId, timestamp);
    });
    
    ib.on('realtimeBar', function(reqId, date, open, high, low, close, volume, wap, count) {
        dispatch.data(reqId, {
            date: date, 
            open: open, 
            high: high, 
            low: low, 
            close: close, 
            volume: volume, 
            count: count,
            wap: wap
        });
    });

    ib.on('tickEFP', function(tickerId, tickType, basisPoints, formattedBasisPoints, impliedFuturesPrice, holdDays, futureExpiry, dividendImpact, dividendsToExpiry) {
        dispatch.data(tickerId, { 
            type: 'EFP', 
            tickType: tickType, 
            name: ib.util.tickTypeToString(tickType),
            basisPoints: basisPoints, 
            formattedBasisPoints: formattedBasisPoints, 
            impliedFuturesPrice: impliedFuturesPrice, 
            holdDays: holdDays, 
            futureExpiry: futureExpiry, 
            dividendImpact: dividendImpact, 
            dividendsToExpiry: dividendsToExpiry 
        });
    }).on('tickGeneric', function(tickerId, tickType, value) {
        dispatch.data(tickerId, { 
            type: 'Generic', 
            tickType: tickType, 
            name: ib.util.tickTypeToString(tickType),
            value: value 
        });
    }).on('tickPrice', function(tickerId, tickType, price, canAutoExecute) {
        dispatch.data(tickerId, { 
            type: 'Price', 
            tickType: tickType, 
            name: ib.util.tickTypeToString(tickType),
            value: price, 
            canAutoExecute: canAutoExecute 
        });
    }).on('tickSize', function(tickerId, sizeTickType, size) {
        dispatch.data(tickerId, { 
            type: 'Size', 
            tickType: sizeTickType, 
            name: ib.util.tickTypeToString(sizeTickType),
            value: size 
        });
    }).on('tickString', function(tickerId, tickType, value) {
        dispatch.data(tickerId, { 
            type: 'String', 
            tickType: tickType, 
            name: ib.util.tickTypeToString(tickType),
            value: value 
        });
    }).on('tickSnapshotEnd', function(reqId) {
        dispatch.end(reqId);
    }).on('tickOptionComputation', function(tickerId, tickType, impliedVol, delta, optPrice, pvDividend, gamma, vega, theta, undPrice) {
        dispatch.data(tickerId, {
            type: 'OptionComputation', 
            tickType: tickType, 
            name: ib.util.tickTypeToString(tickType),
            value: {
                impliedVol: impliedVol, 
                delta: delta, 
                optPrice: optPrice, 
                pvDividend: pvDividend, 
                gamma: gamma, 
                vega: vega, 
                theta: theta, 
                undPrice: undPrice
            }
        });
    });
    
    ib.on("marketDataType", function(id, type) {
        dispatch.data(id, type);
    });

    ib.on('updateMktDepth', function(id, position, operation, side, price, size) {
        dispatch.data(id, {
            position: position, 
            marketMaker: "N/A", 
            operation: operation, 
            side: side, 
            price: price, 
            size: size 
        });
    }).on('updateMktDepthL2', function(id, position, marketMaker, operation, side, price, size) {
        dispatch.data(id, {
            position: position, 
            marketMaker: marketMaker, 
            operation: operation, 
            side: side, 
            price: price, 
            size: size 
        });
    });
    
    ib.on("scannerParameters", function(xml) {
        if (xml) {
            parseXML(xml.toString(), function(err, result) {
                if (err) dispatch.error("scannerParameters", err);
                if (result) dispatch.data("scannerParameters", result);
            });
        }
        else dispatch.end("scannerParameters");
    });
    
    ib.on("scannerData", function(tickerId, rank, contract, distance, benchmark, projection, legsStr) {
        dispatch.data(tickerId, {
            rank: rank, 
            contract: contract, 
            distance: distance, 
            benchmark: benchmark, 
            projection: projection, 
            legsStr: legsStr 
        });
    }).on("scannerDataEnd", function(tickerId) {
        dispatch.end(tickerId);
    });
    
    ib.on('managedAccounts', function(accountsList) {
        dispatch.data("managedAccounts", accountsList);
    });
    
    ib.on('receiveFA', function(faDataType, xml) {
        if (xml) {
            parseXML(xml.toString(), function(err, result) {
                if (err) dispatch.error("receiveFA", err);
                if (result) dispatch.data("receiveFA", { type: faDataType, xml: result });
            });
        }
        else {
            dispatch.end("receiveFA");
        }
    });
    
    ib.on('accountSummary', function(reqId, account, tag, value, currency) {
        dispatch.data(reqId, {
            account: account, 
            tag: tag, 
            value: value, 
            currency: currency 
        });
    }).on('accountSummaryEnd', function(reqId) {
        dispatch.end(reqId);
    });
    
    ib.on('updateAccountTime', function(timeStamp) {
        dispatch.data("accountUpdates", { 
            timestamp: timeStamp 
        });
    }).on('updateAccountValue', function(key, value, currency, accountName) {
        dispatch.data("accountUpdates", { 
            key: key, 
            value: value, 
            currency: currency, 
            accountName: accountName 
        });
    }).on('updatePortfolio', function(contract, position, marketPrice, marketValue, averageCost, unrealizedPNL, realizedPNL, accountName) {
        dispatch.data("accountUpdates", { 
            contract: contract,
            position: position,
            marketPrice: marketPrice,
            marketValue: marketValue,
            averageCost: averageCost,
            unrealizedPNL: unrealizedPNL,
            realizedPNL: realizedPNL,
            accountName: accountName
        });
    }).on('accountDownloadEnd', function(accountId) {
        dispatch.end("accountUpdates");
    });
    
    ib.on('position', function(account, contract, pos, avgCost) {
        dispatch.data("positions", {
            accountName: account, 
            contract: contract, 
            position: pos, 
            averageCost: avgCost 
        });
    }).on('positionEnd', function() {
        dispatch.end("positions");
    }); 
    
    ib.on('execDetails', function(reqId, contract, exec) {
        dispatch.data(reqId, {
            contract: contract, 
            exec: exec 
        });
    }).on('execDetailsEnd', function(reqId) {
        dispatch.end(reqId);
    });
    
    ib.on('openOrder', function(orderId, contract, order, orderState) {
        dispatch.data("orders", {
            orderId: orderId, 
            contract: { summary: contract }, 
            ticket: order, 
            state: orderState 
        });
    }).on('openOrderEnd', function() {
        dispatch.end("orders");
    });
        
    ib.on('orderStatus', function(orderId, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld) {
        dispatch.data("orders", {
            orderId: orderId, 
            state: {
                status: status, 
                filled: filled, 
                remaining: remaining, 
                avgFillPrice: avgFillPrice, 
                permId: permId, 
                parentId: parentId, 
                lastFillPrice: lastFillPrice, 
                clientId: clientId, 
                whyHeld: whyHeld 
            } 
        });
    });
    
    ib.on('commissionReport', function(commissionReport) {
        dispatch.data("commissions", commissionReport);
    });
    
    ib.on('updateNewsBulletin', function(newsMsgId, newsMsgType, newsMessage, originatingExch) {
        dispatch.data("news", {
            newsMsgId: newsMsgId, 
            newsMsgType: newsMsgType, 
            newsMessage: newsMessage, 
            originatingExch: originatingExch 
        });
    });
    
    ib.on('displayGroupList', function(reqId, groups) {
        dispatch.data(reqId, groups ? groups.split("|") : [ ]);
    });
    
    ib.on('displayGroupUpdated', function(reqId, contractInfo) {
        dispatch.data(reqId, contractInfo);
    });

}

module.exports = Service;