"use strict";

const Events = require("events");

const TAGS = {
    accountType: "AccountType",
    netLiquidation: "NetLiquidation",
    totalCashValue: "TotalCashValue",
    settledCash: "SettledCash",
    accruedCash: "AccruedCash",
    buyingPower: "BuyingPower",
    equityWithLoanValue: "EquityWithLoanValue",
    previousDayEquityWithLoanValue: "PreviousDayEquityWithLoanValue",
    grossPositionValue: "GrossPositionValue",
    regTEquity: "RegTEquity",
    regTMargin: "RegTMargin",
    sma: "SMA",
    initMarginReq: "InitMarginReq",
    maintMarginReq: "MaintMarginReq",
    availableFunds: "AvailableFunds",
    excessLiquidity: "ExcessLiquidity",
    cushion: "Cushion",
    fullInitMarginReq: "FullInitMarginReq",
    fullMaintMarginReq: "FullMaintMarginReq",
    fullAvailableFunds: "FullAvailableFunds",
    fullExcessLiquidity: "FullExcessLiquidity",
    lookAheadNextChange: "LookAheadNextChange",
    lookAheadInitMarginReq: "LookAheadInitMarginReq",
    lookAheadMaintMarginReq: "LookAheadMaintMarginReq",
    lookAheadAvailableFunds: "LookAheadAvailableFunds",
    lookAheadExcessLiquidity: "LookAheadExcessLiquidity",
    highestSeverity: "HighestSeverity",
    dayTradesRemaining: "DayTradesRemaining",
    leverage: "Leverage"
};

class Accounts extends Events {
    
    constructor(service) {
        super();
        
        this.service = service;
        this.summary = { };
        this.details = { };
        this.positions = { };
        
        this.TAGS = TAGS;
        this.tags = Object.values(TAGS).join(',');
        this.group = "All";
    }
    
    stream(tags, group) {
        if (tags) this.tags = tags;
        if (group)  this.group = group;
        
        this.service.accountSummary(this.group, this.tags).on("data", datum => {
            if (datum.account && datum.tag) {
                var id = datum.account;
                if (!this.summary[id]) {
                    this.summary[id] = { };
                }

                if (datum.tag) {
                    var value = datum.value;
                    if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                    else if (value == "true") value = true;
                    else if (value == "false") value = false;

                    if (datum.currency && datum.currency != "") {
                        value = { currency: datum.currency, value: value };
                    }

                    var key = datum.tag.camelize(false);
                    this.summary[id][key] = value;
                    this.emit("update", { type: "summary", field: key, value: value });
                }
            }
        }).on("end", cancel => {
            cancel();

            let updates = [ ];
            this.cancel = () => { 
                updates.map("cancel");
                return true;
            };

            Object.keys(this.summary).each(id => {
                this.details[id] = { };
                this.positions[id] = { };
                updates.push(this.service.accountUpdates(id).on("data", data => {
                    if (data.key) {
                        var value = data.value;
                        if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                        else if (value == "true") value = true;
                        else if (value == "false") value = false;

                        if (data.currency && data.currency != "") {
                            value = { currency: data.currency, value: value };
                        }

                        var key = data.key.camelize(false);
                        this.details[id][key] = value;
                        this.emit("update", { type: "details", field: key, value: value });
                    }
                    else if (data.timestamp) {
                        var date = Date.create(data.timestamp);
                        this.details[id].timestamp = date;
                        this.emit("update", { type: "details", field: "timestamp", value: date });
                    }
                    else if (data.contract) {
                        this.positions[id][data.contract.conId] = data;
                        this.emit("update", { type: "position", field: data.contract.conId, value: data });
                    }
                    else {
                        this.emit("warning", "Unrecognized account update " + JSON.stringify(data));
                    }
                }).on("error", err => {
                    this.emit("error", err);
                }).send());
            });
            
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send();
    }
    
    cancel() {
        return false;
    }
    
}



module.exports = Accounts;