require("sugar");

var IB = require('ib');
var parseXML = require('xml2js').parseString;
var Constants = require("./constants");

exports.clientSeed = 0;

var Connection = exports.Connection = function(options) {

    var me = this;
    me.options = options = options || { };
    me.status = "initialized";
    
    var chmin = options.min || 1000000,
        chmax = options.max || 2000000,
        cbid = null,
        cbmap = { };

    function setcb(cb, cancel) {
        do cbid = Number.random(chmin, chmax);
        while (cbmap[cbid] != null);
        cbmap[cbid] = { results: [ ], callback: cb, cancel: cancel };
    }

    function addcb(id, result) {
        if (cbmap[id]) {
            cbmap[id].results.push(result);
        }
    }
    
    function returncb(id, save) {
        if (cbmap[id]) {
            var args = [
                null,
                cbmap[id].results,
                function() { 
                    if (cbmap[id].cancel) ib[cbmap[id].cancel](id);
                    unsetcb(id);
                }
            ];
            
            cbmap[id].callback.apply(this, args);
            
            if (save) return;
            else delete cbmap[id];
        }
    }

    function callcb(id, args) {
        if (cbmap[id]) {
            args.push(function() { 
                if (cbmap[id].cancel) ib[cbmap[id].cancel](id);
                unsetcb(id);
            });
            
            cbmap[id].callback.apply(this, args);
        }
    }

    function unsetcb(id) {
        delete cbmap[id];
    }
    
    function subscribecb(type, cb) {
        if (cbmap[type] == null) cbmap[type] = [ ];
        cbmap[type].push({ 
            callback: cb, 
            unsubscribe: function() {
                cbmap[type].remove(cb);
            }
        });
    }
    
    function pushcb(type, args) {
        if (cbmap[type] != null) {
            cbmap[type].map(function(cb) {
                if (cb.unsubscribe) args.push(cb.unsubscribe);
                cb.callback.apply(this, args);
                args.pop();
            });
        }
    }
    
    function popcb(type, args) {
        if (cbmap[type] != null) {
            cbmap[type].map(function(cb) {
                if (cb.unsubscribe) args.push(cb.unsubscribe);
                cb.callback.apply(this, args);
            });
            
            cbmap[type] = [ ];
        }
    }

    var ib = new IB({
        clientId: options.clientId || exports.clientSeed++,
        host: options.host || '127.0.0.1',
        port: options.port || 4001
    }).on('error', function(err, args) {
        if (args && args.id && args.id > 0) {
            callcb(args.id, [ err, null ]);
        }
        else {
            console.warn(err);
            if (me.status != "connected") {
                me.status = "error";
            }
        }
    }).on('result', function(event, args) {
        if (options.verbose) {
            console.log(event + " - " + JSON.stringify(args));
        }
    }).on('connected', function() {
        me.status = "connected";
        if (options.verbose) {
            console.log("Connected");
        }
    }).on('disconnected', function() {
        me.status = "disconnected";
        if (options.verbose) {
            console.log("Disconnected");
        }
    }).on('received', function(tokens, data) {
        me.lastUpdate = Date.create();
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // CONNECTIVITY
    ////////////////////////////////////////////////////////////////////////
    this.connect = function() {
        ib.connect();
    };
    
    this.disconnect = function() {
        ib.disconnect();
    };
    
    this.setServerLogLevel = function(logLevel) {
        ib.setServerLogLevel(logLevel);
    };
    
    this.setMarketDataType = function(marketDataType, cb) {
        subscribecb("marketDataType", cb);
        ib.reqMarketDataType(marketDataType);
    };
    
    ib.on('marketDataType', function(reqId, marketDataType) {
        pushcb("marketDataType", [ null, reqId, marketDataType ]);
    });
    
    this.currentTime = function(cb) {
        subscribecb("currentTime", cb);
        ib.reqCurrentTime();
    };
    
    ib.on("currentTime", function(time) {
        popcb("currentTime", [ null, time ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // CONTRACT
    ////////////////////////////////////////////////////////////////////////
    this.contract = ib.contract;
    
    this.security = function(contract, cb) {
        setcb(cb);
        ib.reqContractDetails(cbid, contract);
    };

    ib.on('contractDetails', function(reqId, contract) {
        addcb(reqId, contract);
    }).on('bondContractDetails', function(reqId, contract) {
        addcb(reqId, contract);
    }).on('contractDetailsEnd', function(reqId) {
        returncb(reqId);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // FUNDAMENTALS
    ////////////////////////////////////////////////////////////////////////
    this.fundamentals = function(contract, report, cb) {
        setcb(cb, "cancelFundamentalData");
        ib.reqFundamentalData(cbid, contract, report);
    };

    ib.on('fundamentalData', function(reqId, data) {
        if (data) {
            parseXML(data.toString(), function(err, result) {
                callcb(reqId, [ err, result ]);
            });
        }
        else {
            callcb(reqId, [ null, null ]);
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
        options.field = options.field || "MIDPOINT";
        options.regularTradingHours = options.regularTradingHours || true;
        options.dateFormat = options.dateFormat || 1;
        
        setcb(cb, "cancelHistoricalData");
        ib.reqHistoricalData(
            cbid, 
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
        callcb(reqId, [ null, {
            date: date, 
            open: open, 
            high: high, 
            low: low, 
            close: close, 
            volume: volume, 
            count: count, 
            wap: wap, 
            hasGaps: hasGaps 
        } ]);
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
        
        setcb(cb, "cancelRealTimeBars");
        ib.reqRealTimeBars(cbid, contract, options.timeframe, options.field, options.regularTradingHours);
    };
    
    ib.on('realtimeBar', function(reqId, date, open, high, low, close, volume, wap, count) {
        callcb(reqId, [ null, {
            date: date, 
            open: open, 
            high: high, 
            low: low, 
            close: close, 
            volume: volume, 
            count: count,
            wap: wap
        } ]);
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
        
        setcb(cb, "cancelMktData");
        ib.reqMktData(cbid, contract, fields, false);
    };

    ib.on('tickEFP', function(tickerId, tickType, basisPoints, formattedBasisPoints, impliedFuturesPrice, holdDays, futureExpiry, dividendImpact, dividendsToExpiry) {
        callcb(tickerId, [ 
            null, 
            { 
                type: 'EFP', 
                tickType: tickType, 
                name: IB.util.tickTypeToString(tickType),
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
        callcb(tickerId, [ 
            null, 
            { 
                type: 'Generic', 
                tickType: tickType, 
                name: IB.util.tickTypeToString(tickType),
                value: value 
            }
        ]);
    }).on('tickPrice', function(tickerId, tickType, price, canAutoExecute) {
        callcb(tickerId, [ 
            null, 
            { 
                type: 'Price', 
                tickType: tickType, 
                name: IB.util.tickTypeToString(tickType),
                value: price, 
                canAutoExecute: canAutoExecute 
            }
        ]);
    }).on('tickSize', function(tickerId, sizeTickType, size) {
        callcb(tickerId, [ 
            null, 
            { 
                type: 'Size', 
                tickType: sizeTickType, 
                name: IB.util.tickTypeToString(sizeTickType),
                value: size 
            }
        ]);
    }).on('tickString', function(tickerId, tickType, value) {
        callcb(tickerId, [ 
            null, 
            { 
                type: 'String', 
                tickType: tickType, 
                name: IB.util.tickTypeToString(tickType),
                value: value 
            }
        ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // SNAPSHOT
    ////////////////////////////////////////////////////////////////////////
    this.snapshot = function(contract, cb) {
        setcb(cb, "cancelMktData");
        ib.reqMktData(cbid, contract, "", true);
    };
    
    ib.on('tickSnapshotEnd', function(reqId) {
        callcb(reqId, [ 
            null, 
            { complete: true }
        ]);
        
        unsetcb(reqId);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // CALCULATIONS
    ////////////////////////////////////////////////////////////////////////
    this.calculateImpliedVolatility = function(contract, optionPrice, underPrice, cb) {
        setcb(cb, "cancelCalculateImpliedVolatility");
        ib.calculateImpliedVolatility(cbid, contract, optionPrice, underPrice);
    };
    
    this.calculateOptionPrice = function(contract, volatility, underPrice, cb) {
        setcb(cb, "cancelCalculateOptionPrice");
        ib.calculateOptionPrice(cbid, contract, volatility, underPrice);
    };
    
    ib.on('tickOptionComputation', function(tickerId, tickType, impliedVol, delta, optPrice, pvDividend, gamma, vega, theta, undPrice) {
        callcb(tickerId, [ 
            null, 
            {
                type: 'OptionComputation', 
                tickType: tickType, 
                name: IB.util.tickTypeToString(tickType),
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
        
        setcb(cb, "canelMktDepth");
        ib.reqMktDepth(cbid, contract, rows);
    };

    ib.on('updateMktDepth', function(id, position, operation, side, price, size) {
        callcb(id, [ null, {
            position: position, 
            marketMaker: "N/A", 
            operation: operation, 
            side: side, 
            price: price, 
            size: size 
        } ]);
    }).on('updateMktDepthL2', function(id, position, marketMaker, operation, side, price, size) {
        callcb(id, [ null, {
            position: position, 
            marketMaker: marketMaker, 
            operation: operation, 
            side: side, 
            price: price, 
            size: size 
        } ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // SCANNERS
    ////////////////////////////////////////////////////////////////////////
    this.scanners = function(cb) {
        subscribecb("scanners", cb);
        ib.reqScannerParameters();
    };
    
    ib.on("scannerParameters", function(xml) {
        if (xml) {
            parseXML(xml.toString(), function(err, result) {
                popcb("scanners", [ err, result ]);
            });
        }
        else popcb("scanners", [ null, null ]);
    });
    
    this.scan = function(subscription, cb) {
        setcb(cb, "cancelScannerSubscription");
        ib.reqScannerSubscription(cbid, subscription);
    };
    
    ib.on("scannerData", function (tickerId, rank, contract, distance, benchmark, projection, legsStr) {
        addcb(tickerId, {
            rank: rank, 
            contract: contract, 
            distance: distance, 
            benchmark: benchmark, 
            projection: projection, 
            legsStr: legsStr 
        });
    }).on("scannerDataEnd", function(tickerId) {
        returncb(tickerId, true);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // ACCOUNT SUMMARIES
    ////////////////////////////////////////////////////////////////////////
    this.summary = function(tags, cb) {
        if (cb == null && Object.isFunction(tags)) {
            cb = tags;
            tags = Object.values(Constants.TAGS).join(',');
        }
        
        setcb(cb, "cancelAccountSummary");
        ib.reqAccountSummary(cbid, "All", tags);
    };
    
    ib.on('accountSummary', function(reqId, account, tag, value, currency) {
        addcb(reqId, {
            account: account, 
            tag: tag, 
            value: value, 
            currency: currency 
        });
    }).on('accountSummaryEnd', function(reqId) {
        returncb(reqId, true);
    });
        
    
    ////////////////////////////////////////////////////////////////////////
    // TRADE HISTORY
    ////////////////////////////////////////////////////////////////////////
    this.executions = function(account, client, exchange, secType, side, symbol, time, cb) {
        setcb(cb);
        
        var filter = { };
        if (account) filter.acctCode = account;
        if (client) filter.clientId = client;
        if (exchange) filter.exchange = exchange;
        if (secType) filter.secType = secType;
        if (side) filter.side = side;
        if (symbol) filter.symbol = symbol;
        if (time) filter.time = time;
        
        ib.reqExecutions(cbid, filter);
    };
    
    ib.on('execDetails', function(reqId, contract, exec) {
        addcb(reqId, {
            contract: contract, 
            exec: exec 
        });
    }).on('execDetailsEnd', function(reqId) {
        returncb(reqId, true);
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
                setcb(order.callback, "cancelOrder"); 
                ib.placeOrder(cbid, order.contract, order.order);
            }
            else if (order.type == "exercise") {
                setcb(order.callback, "cancelOrder");
                ib.exerciseOptions(cbid, order.contract, order.exerciseAction, order.exerciseQuantity, order.account, order.override);
            }
            else {
                console.warn("Unrecognized order type " + order.type + ".");
            }
        }
    }).on('orderStatus', function(id, status, filled, remaining, avgFillPrice, permId, parentId, lastFillPrice, clientId, whyHeld) {
        callcb(id, [ null, {
            status: status, 
            filled: filled, 
            remaining: remaining, 
            avgFillPrice: avgFillPrice, 
            permId: permId, 
            parentId: parentId, 
            lastFillPrice: lastFillPrice, 
            clientId: clientId, 
            whyHeld: whyHeld 
        } ]);
    }).on('commissionReport', function(commissionReport) {
        callcb(id, [ null, commissionReport ]);
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
        subscribecb("managedAccounts", cb);
        ib.reqManagedAccts();
    };
    
    ib.on('managedAccounts', function(accountsList) {
        pushcb("managedAccounts", [ null, accountsList ]);
    });
    
    this.financialAdvisor = function(type, cb) {
        subscribecb("receiveFA", cb);
        ib.requestFA(type);
    };
    
    this.updateFinancialAdvisor = function(type, xml, cb) {
        subscribecb("receiveFA", cb);
        ib.replaceFA(faDataType, xml);
    };
    
    ib.on('receiveFA', function(faDataType, xml) {
        if (xml) {
            parseXML(xml.toString(), function(err, result) {
                pushcb("receiveFA", [ null, faDataType, result ]);
            });
        }
        else {
            pushcb("receiveFA", [ null, faDataType, xml ]);
        }
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // INDIVIDUAL ACCOUNT
    ////////////////////////////////////////////////////////////////////////
    this.account = function(accountCode, cb) {
        subscribecb("accountUpdates", cb);
        ib.reqAccountUpdates(true, accountCode);
    };
    
    this.cancelAccountUpdates = function(accountCode, cb) {
        ib.reqAccountUpdates(false, accountCode);
    };
    
    ib.on('updateAccountTime', function(timeStamp) {
        pushcb("accountUpdates", [ null, { 
            timestamp: timeStamp 
        } ]);
    }).on('updateAccountValue', function(key, value, currency, accountName) {
        pushcb("accountUpdates", [ null, { 
            key: key, 
            value: value, 
            currency: currency, 
            accountName: accountName 
        } ]);
    }).on('updatePortfolio', function(contract, position, marketPrice, marketValue, averageCost, unrealizedPNL, realizedPNL, accountName) {
        pushcb("accountUpdates", [ null, { 
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
        subscribecb("positions", cb);
        ib.reqPositions();
    };
    
    ib.on('position', function(account, contract, pos, avgCost) {
        pushcb("positions", [ null, {
            complete: false, 
            account: account, 
            contract: contract, 
            pos: pos, 
            avgCost: avgCost 
        } ]);
    }).on('positionEnd', function(reqId) {
        pushcb("positions", [ null, {
            complete: true 
        } ]);
    }); 
    
    
    ////////////////////////////////////////////////////////////////////////
    // PENDING ORDERS
    ////////////////////////////////////////////////////////////////////////
    this.orders = function(cb) {
        subscribecb("orders", cb);
        ib.reqOpenOrders();
    };
    
    ib.on('openOrder', function(orderId, contract, order, orderState) {
        pushcb("orders", [ null, {
            complete: false, 
            orderId: orderId, 
            contract: contract, 
            order: order, 
            orderState: orderState 
        } ]);
    })
    .on('openOrderEnd', function() {
        pushcb("orders", [ null, {
            complete: true
        } ]);
    });
    
    
    ////////////////////////////////////////////////////////////////////////
    // NEWS
    ////////////////////////////////////////////////////////////////////////
    this.news = function(all, cb) {
        subscribecb("news", cb);
        ib.reqNewsBulletins(all);
    };
    
    this.cancelNews = function() {
        ib.cancelNewsBulletins();
    }
    
    ib.on('updateNewsBulletin', function(newsMsgId, newsMsgType, newsMessage, originatingExch) {
        pushcb("news", [ 
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

exports.connect = function(options) {
    var connection = new Connection(options);
    connection.connect();
    return connection;
};