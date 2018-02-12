const Events = require("events"),
      IB = require("ib");

class Mock extends Events {
    
    constructor() {
        super();
    }
    
    get contract() {
        return IB.contract;
    }
    
    get order() {
        return IB.order;
    }
    
    get util() {
        return IB.util;
    }
    
    replay(file) {
        require("./replay")(file, this);
    }
    
    connect() { }
    disconnect() { }

    calculateImpliedVolatility(reqId, contract, optionPrice, underPrice) { }
    calculateOptionPrice(reqId, contract, volatility, underPrice) { }
    cancelAccountSummary(reqId) { }
    cancelCalculateImpliedVolatility(reqId) { }
    cancelCalculateOptionPrice(reqId) { }
    cancelFundamentalData(reqId) { }
    cancelHistoricalData(tickerId) { }
    cancelMktData(tickerId) { }
    cancelMktDepth(tickerId) { }
    cancelNewsBulletins() { }
    cancelOrder(id) { }
    cancelPositions() { }
    cancelRealTimeBars(tickerId) { }
    cancelScannerSubscription(tickerId) { }
    exerciseOptions(tickerId, contract, exerciseAction, exerciseQuantity, account, override) { }
    placeOrder(id, contract, order) { }
    replaceFA(faDataType, xml) { }
    reqAccountSummary(reqId, group, tags) { }
    reqAccountUpdates(subscribe, acctCode) { }
    reqAllOpenOrders() { }
    reqAutoOpenOrders(bAutoBind) { }
    reqContractDetails(reqId, contract) { }
    reqCurrentTime() { }
    reqExecutions(reqId, filter) { }
    reqFundamentalData(reqId, contract, reportType) { }
    reqGlobalCancel() { }
    reqHistoricalData(tickerId, contract, endDateTime, durationStr, barSizeSetting, whatToShow, useRTH, formatDate, keepUpToDate) { }
    reqIds(numIds) { }
    reqManagedAccts() { }
    reqMarketDataType(marketDataType) { }
    reqMktData(tickerId, contract, genericTickList, snapshot, regulatorySnapshot) { }
    reqMktDepth(tickerId, contract, numRows) { }
    reqNewsBulletins(allMsgs) { }
    reqOpenOrders() { }
    reqPositions() { }
    reqRealTimeBars(tickerId, contract, barSize, whatToShow, useRTH) { }
    reqScannerParameters() { }
    reqScannerSubscription(tickerId, subscription) { }
    requestFA(faDataType) { }
    queryDisplayGroups(reqId) { }
    subscribeToGroupEvents(reqId, group) { }
    unsubscribeToGroupEvents(reqId) { }
    updateDisplayGroup(reqId, contract) { }
    setServerLogLevel(logLevel) { }
}

module.exports = Mock;