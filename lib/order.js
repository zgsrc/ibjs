"use strict";

require("sugar");

var Order = exports.Order = function(cxn, contract) {
    
    var me = this;
    
    this.action = function(side) { 
        me.action = side; 
        return me; 
    };
    
    this.quantity = function(qty) { 
        me.totalQuantity = qty; 
        return me; 
    };
    
    this.minimumQuantity = function(qty) { 
        me.minQty = qty; 
        return me; 
    };
    
    this.displaySize = function(qty) { 
        me.displaySize = qty; 
        return me; 
    };
    
    this.hidden = function(flag) { 
        me.hidden = flag; 
        return me; 
    };
    
    this.type = function(orderType) { 
        me.orderType = orderType; 
        return me; 
    };
    
    this.auxPrice = function(price) { 
        me.auxPrice = price; 
        return me; 
    };
    
    this.limitPrice = function(price) { 
        me.lmtPrice = price; 
        return me; 
    };
    
    this.trailStopPrice = function(price) { 
        me.trailStopPrice = price; 
        return me; 
    };
    
    this.trailingPercent = function(pct) { 
        me.trailingPercent = pct; 
        return me; 
    };
    
    this.percentOffset = function(pct) { 
        me.percentOffset = pct; 
        return me; 
    };
    
    this.overridePercentageContraints = function(flag) { 
        me.overridePercentageContraints = flag; 
        return me; 
    };
    
    this.allOrNone = function(flag) { 
        me.allOrNone = flag; 
        return me; 
    };
    
    this.blockOrder = function(flag) { 
        me.blockOrder = flag; 
        return me; 
    };
    
    this.sweepToFill = function(flag) { 
        me.sweepToFill = flag; 
        return me; 
    };
    
    this.timeInForce = function(option) { 
        me.tif = option; 
        return me; 
    };
    
    this.goodAfter = function(date) { 
        me.goodAfterTime = date; 
        return me; 
    };
    
    this.goodUntil = function(date) { 
        me.goodTillDate = date; 
        return me; 
    };
    
    this.effectiveWindow = function(start, stop) { 
        me.activeStartTime = start;
        me.activeStopTime = stop;
        return me;
    }
    
    this.extendedHours = function(flag) { 
        me.outsideRth = flag; 
        return me; 
    };
    
    this.oneCancelsAll = function(group, type) { 
        me.ocaGroup = group;
        me.ocaType = type;
        return me;
    };
    
    this.orderRef = function(ref) { 
        me.orderRef = ref; 
        return me; 
    };
    
    this.rule80A = function(rule) { 
        me.rule80A = rule; 
        return me; 
    };
    
    this.transmit = function(flag) { 
        me.transmit = flag; 
        return me; 
    };
    
    this.allocation = function(group, method, percentage, profile) {
        me.faGroup = group;
        me.faMethod = method;
        me.faPercentage = percentage;
        me.faProfile = profile;
        return me;
    };
    
    this.institution = function(designatedLocation, openClose, origin, shortSaleSlot) {
        me.designatedLocation = designatedLocation;
        me.openClose = openClose;
        me.origin = origin;
        me.shortSaleSlot = shortSaleSlot;
        return me;
    };
    
    this.smart = function(discretionaryAmount, electronicOnly, firmOnly, nbboPriceCap, optOutOfSmartRouting) {
        me.discretionaryAmt = discretionaryAmount;
        me.eTradeOnly = electronicOnly;
        me.firmQuoteOnly = firmOnly;
        me.nbboPriceCap = nbboPriceCap;
        me.optOutSmartRouting = optOutOfSmartRouting;
        return me;
    };
    
    this.auctionStrategy = function(type) { 
        me.auctionStrategy = type; 
        return me; 
    };
    
    this.box = function(delta, startingPrice, stockRefPrice) {
        me.delta = delta;
        me.startingPrice = startingPrice;
        me.stockRefPrice = stockRefPrice;
        return me;
    };
    
    this.stockRange = function(lower, upper) {
        me.stockRangeLower = lower;
        me.stockRangeUpper = upper;
        return me;
    };
    
    this.volatility = function(continuousUpdate, deltaNeutralOrderType, deltaNeutralAuxPrice, referencePriceType, volatility, volatilityType, deltaNeutralOpenClose, deltaNeutralShortSale, deltaNeutralShortSaleSlot, deltaNeutralDesignatedLocation) {
        me.continuousUpdate = continuousUpdate;
        me.deltaNeutralOrderType = deltaNeutralOrderType;
        me.deltaNeutralAuxPrice = deltaNeutralAuxPrice;
        me.referencePriceType = referencePriceType;
        me.volatility = volatility;
        me.volatilityType = volatilityType;
        me.deltaNeutralOpenClose = deltaNeutralOpenClose;
        me.deltaNeutralShortSale = deltaNeutralShortSale;
        me.deltaNeutralShortSaleSlot = deltaNeutralShortSaleSlot;
        me.deltaNeutralDesignatedLocation = deltaNeutralDesignatedLocation;
        return me;
    };
    
    this.combo = function(basisPoints, basisPointsType) {
        this.basisPoints = basisPoints;
        this.basisPointsType = basisPointsType;
        return me;
    };
    
    this.scale = function(scaleAutoReset, saleInitFillQty, scaleInitLevelSize, scaleInitPosition, scalePriceAdjustInterval, scalePriceAdjustValue, scalePriceIncrement, scaleProfitOffset, scaleRandomPercent, scaleSubsLevelSize, scaleTable) {
        me.scaleAutoReset = scaleAutoReset;
        me.saleInitFillQty = saleInitFillQty;
        me.scaleInitLevelSize = scaleInitLevelSize;
        me.scaleInitPosition = scaleInitPosition;
        me.scalePriceAdjustInterval = scalePriceAdjustInterval;
        me.scalePriceAdjustValue = scalePriceAdjustValue;
        me.scalePriceIncrement = scalePriceIncrement;
        me.scaleProfitOffset = scaleProfitOffset;
        me.scaleRandomPercent = scaleRandomPercent;
        me.scaleSubsLevelSize = scaleSubsLevelSize;
        me.scaleTable = scaleTable;
        return me;
    };
    
    this.hedge = function(hedgeParam, hedgeType) {
        me.hedgeParam = hedgeParam;
        me.hedgeType = hedgeType;
        return me;
    };
    
    this.clearing = function(account, clearingAccount, clearingIntent, settlingFirm) {
        me.account = account;
        me.clearingAccount = clearingAccount;
        me.clearingIntent = clearingIntent;
        me.settlingFirm = settlingFirm;
        return me;
    };
    
    this.algo = function(algoStrategy, algoParams, algoId) {
        me.algoStrategy = algoStrategy;
        me.algoParams = algoParams;
        me.algoId = algoId;
        return me;
    };
    
    this.solicited = function(flag) {
        me.solicited = flag;
        return me;
    };
    
    this.whatIf = function(flag) {
        me.whatIf = flag;
        return me;
    };
    
    this.smartCombo = function(smartComboRoutingParams, legs) {
        me.smartComboRoutingParams = smartComboRoutingParams;
        return me;
    };
    
    this.notHeld = function(flag) {
        me.notHeld = flag;
        return me;
    };
    
    
    ////////////////////////////////////////////////////////////
    // EXECUTION
    ////////////////////////////////////////////////////////////
    this.execute = function(cb) {
        cxn.order(contract, me, cb);
    };
    
    this.exercise = function(exerciseAction, exerciseQuantity, account, override, cb) {
        cxn.exercise(contract, exerciseAction, exerciseQuantity, account, override, cb);
    };
    
};