require("sugar");

var IB = require('ib'),
    tickTypeToString = IB.util.tickTypeToString,
    constants = require("./constants"),
    parseXML = require('xml2js').parseString;

exports.client = 0;

var Connection = exports.Connection = function(options) {

    var me = this;
    me.options = options || { };
    me.status = "initialized";
    me.lastRequestId = me.options.minRequestId = (me.options.minRequestId || 0);
    me.callbacks = { };

    function registerCallback(cb, cancel) {
        do {
            if (me.options.maxRequestId && me.lastRequestId >= me.options.maxRequestId) {
                me.lastRequestId = me.options.minRequestId;
            }
            else {
                me.lastRequestId++;
            }
        }
        while (me.callbacks[me.lastRequestId] != null);
        
        var id = me.lastRequestId;
        me.callbacks[id] = { callback: cb, cancel: cancel };
        me.callbacks[id].timeout = setTimeout(function() {
            cb(new Error("Request timed out."), me.callbacks[id].results);
            if (me.callbacks[id].cancel) ib[me.callbacks[id].cancel](id);
            unregisterCallback(id);
        }, 5000);
        
        return me.lastRequestId;
    }

    function invokeCallback(id, args) {
        if (me.callbacks[id]) {
            var cb = me.callbacks[id];
            if (cb.timeout) {
                clearTimeout(cb.timeout);
                delete cb.timeout;
            }
            
            if (cb.cancel) {
                args.push(function() {
                    ib[cb.cancel](id);
                    unregisterCallback(id);
                });
            }
            else {
                unregisterCallback(id);
            }
            
            cb.callback.apply(this, args);
        }
        else {
            //console.warn("No callback registered for request " + id + ".");
        }
    }
    
    function queueResult(id, result) {
        if (me.callbacks[id]) {
            if (!me.callbacks[id].results) {
                me.callbacks[id].results = [ ];
            }
            
            me.callbacks[id].results.push(result);
        }
    }
    
    function returnResults(id) {
        if (me.callbacks[id]) {
            if (me.callbacks[id].timeout) {
                clearTimeout(me.callbacks[id].timeout);
                delete me.callbacks[id].timeout;
            }
            
            var cb = me.callbacks[id];
            if (cb.cancel) {
                cb.callback(null, cb.results, function() {
                    ib[cb.cancel](id);
                    unregisterCallback(id);
                });
            }
            else {
                unregisterCallback(id);
                cb.callback(null, cb.results);
            }
        }
        else {
            //console.warn("No callback registered for request " + id + ".");
        }
    }

    function unregisterCallback(id) {
        delete me.callbacks[id];
    }    
    
    function subscribe(type, cb) {
        if (me.callbacks[type] == null) {
            me.callbacks[type] = [ ];
        }
        
        me.callbacks[type].push({ 
            callback: cb, 
            unsubscribe: function() {
                me.callbacks[type].remove(cb);
            }
        });
    }
    
    function publish(type, args) {
        if (me.callbacks[type] != null) {
            me.callbacks[type].map(function(cb) {
                if (cb.unsubscribe) args.push(cb.unsubscribe);
                cb.callback.apply(this, args);
                args.pop();
            });
        }
    }
    
    var ib = me.socket = new IB({
        clientId: me.options.clientId || exports.client++,
        host: me.options.host || '127.0.0.1',
        port: me.options.port || 4001
    }).on('result', function(event, args) {
        if (me.options.verbose) console.log(event + " - " + JSON.stringify(args));
    }).on('connected', function() {
        me.status = "connected";
        if (me.options.verbose) console.log("Connected");
    }).on('disconnected', function() {
        me.status = "disconnected";
        if (me.options.verbose) console.log("Disconnected");
    }).on('received', function(tokens, data) {
        me.lastUpdate = Date.create();
    }).on('error', function(err, args) {
        if (args && args.id && args.id > 0) {
            invokeCallback(args.id, [ err, null ]);
        }
        else if (me.status != "connected") me.status = "error";
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // CONNECTIVITY
    ////////////////////////////////////////////////////////////////////////
    this.connect = function(cb) {
        if (me.status == "connected" || me.status == "connecting") {
            cb(null, me.status);
            return;
        }
        
        var callback = cb;
        if (callback && Object.isFunction(callback)) {
            ib.once("connected", function() {
                if (callback) callback(null, me.status);
                callback = null;
            }).once("error", function(err) {
                if (callback) callback(err, me.status);
                callback = null;
            });
            
            setTimeout(function() {
                if (callback) callback(new Error("Timeout after 250ms."), me.status);
                callback = null;
            }, 250);
        }
        
        me.status = "connecting";
        ib.connect();
    };
    
    this.disconnect = function(cb) {
        if (me.status == "disconnected" || me.status == "disconnecting") {
            cb(null, me.status);
            return;
        }
        
        var callback = cb;
        if (callback && Object.isFunction(callback)) {
            ib.once("disconnected", function() {
                if (callback) callback(null, me.status);
                callback = null;
            }).once("error", function(err) {
                if (callback) callback(err, me.status);
                callback = null;
            });
            
            setTimeout(function() {
                if (callback) callback(new Error("Timeout after 250ms."), me.status);
                callback = null;
            }, 250);
        }
        
        if (me.status != "disconnected" && me.status != "disconnecting") {
            me.status = "disconnecting";
            ib.disconnect();    
        }
    };
    
    this.currentTime = function(cb) {
        ib.once("currentTime", function(time) {
            cb(null, time);
        });
        
        ib.reqCurrentTime();
    };
    
    this.setServerLogLevel = function(logLevel) {
        ib.setServerLogLevel(logLevel);
    };
    
    this.setMarketDataType = function(marketDataType, cb) {
        ib.once("marketDataType", cb);
        ib.reqMarketDataType(marketDataType);
    };
    
    this.cancelMonitor = function() {
        if (me.monitoringInterval) {
            cancelInterval(me.monitoringInterval);
        }
        
        delete me.monitoringInterval;
        delete me.lastMonitoringAttempt;
        delete me.lastMonitoringSuccess;
    };
    
    this.monitor = function(interval) {
        me.cancelMonitor();
        me.monitoringInterval = setInterval(function() {
            ib.once("currentTime", function(time) {
                me.lastMonitoringSuccess = Date.create();
                ib.emit("connectionResponsive");
            });
            
            ib.reqCurrentTime();
            me.lastMonitoringAttempt = Date.create();
            
            if (me.lastMonitoringSuccess && me.lastMonitoringSuccess.millisecondsAgo() > (3 * interval)) {
                ib.emit("connectionNonResponsive");
            }
        }, interval);
    };
    
    this.start = function(cb) {
        me.connect(function(err, status) {
            if (!err && status == "connected") {
                ib.connection.currentTime(function(err, time) {
                    if (err) cb(new Error("Connection not working properly."));
                    else {
                        me.monitor(1000);
                        cb();
                    }
                });
            }
            else {
                cb(new Error("Error establishing connection."));
            }
        })
    };
    
    this.stop = function(cb) {
        me.cancelMonitor();
        me.disconnect(cb);
    };
    
    
    ////////////////////////////////////////////////////////////////////////
    // CONTRACTS
    ////////////////////////////////////////////////////////////////////////
    this.contract = ib.contract;
    
    this.stock = function(symbol, exchange, currency) {
        return new Security(me, me.contract.stock(symbol, exchange, currency));
    };

    this.option = function(symbol, expiry, strike, right, exchange, currency) {
        return new Security(me, me.contract.option(symbol, expiry, strike, right, exchange, currency));
    };

    this.currency = function(symbol, currency) {
        return new Security(me, me.contract.forex(symbol, currency));
    };

    this.future = function(symbol, expiry, currency) {
        return new Security(me, me.contract.future(symbol, expiry, currency));
    };
    
    
    ////////////////////////////////////////////////////////////////////////
    // SECURITY DETAILS
    ////////////////////////////////////////////////////////////////////////
    this.security = function(contract, cb) {
        ib.reqContractDetails(registerCallback(cb), contract);
    };

    ib.on('contractDetails', function(reqId, contract) {
        queueResult(reqId, contract);
    }).on('bondContractDetails', function(reqId, contract) {
        queueResult(reqId, contract);
    }).on('contractDetailsEnd', function(reqId) {
        returnResults(reqId);
    });

    
    
    ////////////////////////////////////////////////////////////////////////
    // FUNDAMENTALS
    ////////////////////////////////////////////////////////////////////////
    this.fundamentals = function(contract, report, cb) {
        ib.reqFundamentalData(registerCallback(cb), contract, report);
    };

    ib.on('fundamentalData', function(reqId, data) {
        if (data) {
            parseXML(data.toString(), function(err, result) {
                invokeCallback(reqId, [ err, result ]);
            });
        }
        else {
            invokeCallback(reqId, [ null, null ]);
        }
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // BAR CHART
    ////////////////////////////////////////////////////////////////////////
    this.historicals = function(contract, options, cb) {
        if (cb == null && Object.isFunction(options)) {
            cb = options;
            options = null;
        }
        
        options = options || { };
        options.endTime = options.endTime || Date.create();
        options.duration = options.duration || "1 D";
        options.timeframe = options.timeframe || "5 mins";
        options.field = options.field || "TRADES";
        options.regularTradingHours = options.regularTradingHours || true;
        options.dateFormat = options.dateFormat || 1;
        
        ib.reqHistoricalData(
            registerCallback(cb), 
            contract, 
            options.endTime.format("{yyyy}{MM}{dd} {HH}:{mm}:{ss}") + (options.locale ? " " + options.locale : ""), 
            options.duration, 
            options.timeframe, 
            options.field, 
            options.regularTradingHours ? 1 : 0,
            options.dateFormat
        );
    };

    ib.on('historicalData', function(reqId, date, open, high, low, close, volume, count, wap, hasGaps) {
        if (date && date.startsWith("finished")) {
            returnResults(reqId);
        }
        else {
            queueResult(reqId, {
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
    
    this.bar = function(contract, options, cb) {
        if (cb == null && Object.isFunction(options)) {
            cb = options;
            options = null;
        }
        
        options = options || { };
        options.timeframe = options.timeframe || 5;
        options.field = options.field || "MIDPOINT";
        options.regularTradingHours = options.regularTradingHours || true;
        
        ib.reqRealTimeBars(registerCallback(cb, "cancelRealTimeBars"), contract, options.timeframe, options.field, options.regularTradingHours);
    };
    
    ib.on('realtimeBar', function(reqId, date, open, high, low, close, volume, wap, count) {
        invokeCallback(reqId, [ 
            null, 
            {
                date: date, 
                open: open, 
                high: high, 
                low: low, 
                close: close, 
                volume: volume, 
                count: count,
                wap: wap
            }
        ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // QUOTES
    ////////////////////////////////////////////////////////////////////////
    this.quote = function(contract, fields, cb) {
        if (cb == null && Object.isFunction(fields)) {
            cb = fields;
            fields = [];
        }
        
        fields = fields || [];
        if (Array.isArray(fields)) fields = fields.join(",");
        else fields = fields.toString();
        
        ib.reqMktData(registerCallback(cb, "cancelMktData"), contract, fields, false);
    };
    
    this.snapshot = function(contract, cb) {
        ib.reqMktData(registerCallback(cb, "cancelMktData"), contract, "", true);
    };
    
    this.calculateImpliedVolatility = function(contract, optionPrice, underPrice, cb) {
        ib.calculateImpliedVolatility(registerCallback(cb, "cancelCalculateImpliedVolatility"), contract, optionPrice, underPrice);
    };
    
    this.calculateOptionPrice = function(contract, volatility, underPrice, cb) {
        ib.calculateOptionPrice(registerCallback(cb, "cancelCalculateOptionPrice"), contract, volatility, underPrice);
    };

    ib.on('tickEFP', function(tickerId, tickType, basisPoints, formattedBasisPoints, impliedFuturesPrice, holdDays, futureExpiry, dividendImpact, dividendsToExpiry) {
        invokeCallback(tickerId, [ 
            null, 
            { 
                type: 'EFP', 
                tickType: tickType, 
                name: tickTypeToString(tickType),
                basisPoints: basisPoints, 
                formattedBasisPoints: formattedBasisPoints, 
                impliedFuturesPrice: impliedFuturesPrice, 
                holdDays: holdDays, 
                futureExpiry: futureExpiry, 
                dividendImpact: dividendImpact, 
                dividendsToExpiry: dividendsToExpiry 
            }
        ]);
    }).on('tickGeneric', function(tickerId, tickType, value) {
        invokeCallback(tickerId, [ 
            null, 
            { 
                type: 'Generic', 
                tickType: tickType, 
                name: tickTypeToString(tickType),
                value: value 
            }
        ]);
    }).on('tickPrice', function(tickerId, tickType, price, canAutoExecute) {
        invokeCallback(tickerId, [ 
            null, 
            { 
                type: 'Price', 
                tickType: tickType, 
                name: tickTypeToString(tickType),
                value: price, 
                canAutoExecute: canAutoExecute 
            }
        ]);
    }).on('tickSize', function(tickerId, sizeTickType, size) {
        invokeCallback(tickerId, [ 
            null, 
            { 
                type: 'Size', 
                tickType: sizeTickType, 
                name: tickTypeToString(sizeTickType),
                value: size 
            }
        ]);
    }).on('tickString', function(tickerId, tickType, value) {
        invokeCallback(tickerId, [ 
            null, 
            { 
                type: 'String', 
                tickType: tickType, 
                name: tickTypeToString(tickType),
                value: value 
            }
        ]);
    }).on('tickSnapshotEnd', function(reqId) {
        invokeCallback(reqId, [ 
            null, 
            { complete: true }
        ]);
        
        unregisterCallback(reqId);
    }).on('tickOptionComputation', function(tickerId, tickType, impliedVol, delta, optPrice, pvDividend, gamma, vega, theta, undPrice) {
        invokeCallback(tickerId, [ 
            null, 
            {
                type: 'OptionComputation', 
                tickType: tickType, 
                name: tickTypeToString(tickType),
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
            }
        ]);
    });
    

    ////////////////////////////////////////////////////////////////////////
    // L2 QUOTES
    ////////////////////////////////////////////////////////////////////////
    this.quotes = function(contract, rows, cb) {
        if (cb == null && Object.isFunction(rows)) {
            cb = rows;
            rows = 10;
        }
        
        ib.reqMktDepth(registerCallback(cb, "canelMktDepth"), contract, rows);
    };

    ib.on('updateMktDepth', function(id, position, operation, side, price, size) {
        invokeCallback(id, [ 
            null, 
            {
                position: position, 
                marketMaker: "N/A", 
                operation: operation, 
                side: side, 
                price: price, 
                size: size 
            } 
        ]);
    }).on('updateMktDepthL2', function(id, position, marketMaker, operation, side, price, size) {
        invokeCallback(id, [ 
            null, 
            {
                position: position, 
                marketMaker: marketMaker, 
                operation: operation, 
                side: side, 
                price: price, 
                size: size 
            } 
        ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // SCANNERS
    ////////////////////////////////////////////////////////////////////////
    this.scanners = function(cb) {
        ib.once("scannerParameters", function(xml) {
            if (xml) {
                parseXML(xml.toString(), function(err, result) {
                    if (cb) cb(err, result);
                });
            }
            else if (cb) cb(null, null);
        });
        
        ib.reqScannerParameters();
    };
    
    this.scan = function(subscription, cb) {
        ib.reqScannerSubscription(registerCallback(cb, "cancelScannerSubscription"), subscription);
    };
    
    ib.on("scannerData", function (tickerId, rank, contract, distance, benchmark, projection, legsStr) {
        queueResult(tickerId, {
            rank: rank, 
            contract: contract, 
            distance: distance, 
            benchmark: benchmark, 
            projection: projection, 
            legsStr: legsStr 
        });
    }).on("scannerDataEnd", function(tickerId) {
        returnResults(tickerId);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // ACCOUNT SUMMARIES
    ////////////////////////////////////////////////////////////////////////
    this.summary = function(tags, cb) {
        if (cb == null && Object.isFunction(tags)) {
            cb = tags;
            tags = Object.values(constants.TAGS).join(',');
        }
        
        ib.reqAccountSummary(registerCallback(cb, "cancelAccountSummary"), "All", tags);
    };
    
    ib.on('accountSummary', function(reqId, account, tag, value, currency) {
        queueResult(reqId, {
            account: account, 
            tag: tag, 
            value: value, 
            currency: currency 
        });
    }).on('accountSummaryEnd', function(reqId) {
        returnResults(reqId);
    });
        
    
    ////////////////////////////////////////////////////////////////////////
    // TRADE HISTORY
    ////////////////////////////////////////////////////////////////////////
    this.executions = function(account, client, exchange, secType, side, symbol, time, cb) {
        var filter = { };
        if (account) filter.acctCode = account;
        if (client) filter.clientId = client;
        if (exchange) filter.exchange = exchange;
        if (secType) filter.secType = secType;
        if (side) filter.side = side;
        if (symbol) filter.symbol = symbol;
        if (time) filter.time = time;
        
        ib.reqExecutions(registerCallback(cb), filter);
    };
    
    ib.on('execDetails', function(reqId, contract, exec) {
        queueResult(reqId, {
            contract: contract, 
            exec: exec 
        });
    }).on('execDetailsEnd', function(reqId) {
        returnResults(reqId);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // TRADE
    ////////////////////////////////////////////////////////////////////////
    this.order = function(contract, order, cb) {
        orderQueue.push({ 
            type: "order", 
            contract: contract,
            order: order, 
            callback: cb 
        });
        
        ib.reqIds(1);
    };
    
    this.exercise = function(contract, exerciseAction, exerciseQuantity, account, override, cb) {
        orderQueue.push({ 
            type: "exercise", 
            contract: contract, 
            exerciseAction: exerciseAction, 
            exerciseQuantity: exerciseQuantity, 
            account: account, 
            override: override, 
            callback: cb 
        });
        
        ib.reqIds(1);
    };
    
    var orderQueue = [ ];
    ib.on('nextValidId', function(orderId) {
        var order = orderQueue.shift();
        if (order) {
            if (order.type == "order") {
                ib.placeOrder(registerCallback(order.callback, "cancelOrder"), order.contract, order.order);
            }
            else if (order.type == "exercise") {
                ib.exerciseOptions(registerCallback(order.callback, "cancelOrder"), order.contract, order.exerciseAction, order.exerciseQuantity, order.account, order.override);
            }
            else {
                console.warn("Unrecognized order type " + order.type + ".");
            }
        }
    }).on('orderStatus', function(id, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld) {
        invokeCallback(id, [ 
            null, {
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
        ]);
    }).on('commissionReport', function(commissionReport) {
        invokeCallback(id, [ null, commissionReport ]);
    });
    
    this.cancelOrder = function(orderId, cb) {
        ib.cancelOrder(orderId);
    };
    
    this.globalCancel = function() {
        orderQueue = [ ];
        ib.reqGlobalCancel();
    };
    
    
    ////////////////////////////////////////////////////////////////////////
    // MANAGED ACCOUNTS
    ////////////////////////////////////////////////////////////////////////
    this.managedAccounts = function(cb) {
        subscribe("managedAccounts", cb);
        ib.reqManagedAccts();
    };
    
    ib.on('managedAccounts', function(accountsList) {
        publish("managedAccounts", [ null, accountsList ]);
    });
    
    this.financialAdvisor = function(type, cb) {
        subscribe("receiveFA", cb);
        ib.requestFA(type);
    };
    
    this.updateFinancialAdvisor = function(type, xml, cb) {
        subscribe("receiveFA", cb);
        ib.replaceFA(faDataType, xml);
    };
    
    ib.on('receiveFA', function(faDataType, xml) {
        if (xml) {
            parseXML(xml.toString(), function(err, result) {
                publish("receiveFA", [ null, faDataType, result ]);
            });
        }
        else {
            publish("receiveFA", [ null, faDataType, xml ]);
        }
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // INDIVIDUAL ACCOUNT
    ////////////////////////////////////////////////////////////////////////
    this.account = function(accountCode, cb) {
        subscribe("accountUpdates", cb);
        ib.reqAccountUpdates(true, accountCode);
    };
    
    this.cancelAccountUpdates = function(accountCode, cb) {
        ib.reqAccountUpdates(false, accountCode);
    };
    
    ib.on('updateAccountTime', function(timeStamp) {
        publish("accountUpdates", [ null, { 
            timestamp: timeStamp 
        } ]);
    }).on('updateAccountValue', function(key, value, currency, accountName) {
        publish("accountUpdates", [ null, { 
            key: key, 
            value: value, 
            currency: currency, 
            accountName: accountName 
        } ]);
    }).on('updatePortfolio', function(contract, position, marketPrice, marketValue, averageCost, unrealizedPNL, realizedPNL, accountName) {
        publish("accountUpdates", [ null, { 
            contract: contract,
            position: position,
            marketPrice: marketPrice,
            marketValue: marketValue,
            averageCost: averageCost,
            unrealizedPNL: unrealizedPNL,
            realizedPNL: realizedPNL,
            accountName: accountName
        } ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // POSITIONS
    ////////////////////////////////////////////////////////////////////////
    this.positions = function(cb) {
        subscribe("positions", cb);
        ib.reqPositions();
    };
    
    ib.on('position', function(account, contract, pos, avgCost) {
        publish("positions", [ null, {
            complete: false, 
            account: account, 
            contract: contract, 
            pos: pos, 
            avgCost: avgCost 
        } ]);
    }).on('positionEnd', function(reqId) {
        publish("positions", [ null, {
            complete: true 
        } ]);
    }); 
    
    
    ////////////////////////////////////////////////////////////////////////
    // PENDING ORDERS
    ////////////////////////////////////////////////////////////////////////
    this.orders = function(cb) {
        subscribe("orders", cb);
        ib.reqOpenOrders();
    };
    
    ib.on('openOrder', function(orderId, contract, order, orderState) {
        publish("orders", [ null, {
            complete: false, 
            orderId: orderId, 
            contract: contract, 
            order: order, 
            orderState: orderState 
        } ]);
    }).on('openOrderEnd', function() {
        publish("orders", [ null, {
            complete: true
        } ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // NEWS
    ////////////////////////////////////////////////////////////////////////
    this.news = function(all, cb) {
        subscribe("news", cb);
        ib.reqNewsBulletins(all);
    };
    
    this.cancelNews = function() {
        ib.cancelNewsBulletins();
    }
    
    ib.on('updateNewsBulletin', function(newsMsgId, newsMsgType, newsMessage, originatingExch) {
        publish("news", [ 
            null, 
            {
                newsMsgId: newsMsgId, 
                newsMsgType: newsMsgType, 
                newsMessage: newsMessage, 
                originatingExch: originatingExch 
            }, 
            function() { ib.cancelNewsBulletins(); } 
        ]);
    });

};

require('util').inherits(Connection, require('events'));

exports.connect = function(options, cb) {
    var connection = new Connection(options);
    connection.connect(function(err) {
        if (cb) cb(err, connection);
    });
    
    return connection;
};