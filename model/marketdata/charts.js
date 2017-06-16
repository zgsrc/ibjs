"use strict";

const MarketData = require("./marketdata"),
      Bars = require("./bars");

class Charts extends MarketData {
    
    constructor(session, contract) {
        
        super(session, contract);
    
        this.ONE_SECOND = new Bars(session, contract, {
            text: "1 sec",
            integer: 1,
            duration: "1800 S"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));
        
        this.FIVE_SECONDS = new Bars(session, contract, {
            text: "5 secs",
            integer: 5,
            duration: "3600 S"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));
        
        this.TEN_SECONDS = new Bars(session, contract, {
            text: "10 secs",
            integer: 10,
            duration: "7200 S"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.FIFTEEN_SECONDS = new Bars(session, contract, {
            text: "15 secs",
            integer: 15,
            duration: "10800 S"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.THIRTY_SECONDS = new Bars(session, contract, {
            text: "30 secs",
            integer: 30,
            duration: "1 D"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.ONE_MINUTE = new Bars(session, contract, {
            text: "1 min",
            integer: 60,
            duration: "2 D"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.TWO_MINUTES = new Bars(session, contract, {
            text: "2 mins",
            integer: 120,
            duration: "3 D"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.THREE_MINUTES = new Bars(session, contract, {
            text: "3 mins",
            integer: 180,
            duration: "4 D"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.FIVE_MINUTES = new Bars(session, contract, {
            text: "5 mins",
            integer: 300,
            duration: "1 W"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));
        
        this.TEN_MINUTES = new Bars(session, contract, {
            text: "10 mins",
            integer: 600,
            duration: "2 W"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.FIFTEEN_MINUTES = new Bars(session, contract, {
            text: "15 mins",
            integer: 900,
            duration: "2 W"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.THIRTY_MINUTES = new Bars(session, contract, {
            text: "30 mins",
            integer: 1800,
            duration: "1 M"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.ONE_HOUR = new Bars(session, contract, {
            text: "1 hour",
            integer: 3600,
            duration: "2 M"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.TWO_HOURS = new Bars(session, contract, {
            text: "2 hour",
            integer: 7200,
            duration: "2 M"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.FOUR_HOURS = new Bars(session, contract, {
            text: "4 hour",
            integer: 14400,
            duration: "4 M"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.EIGHT_HOURS = new Bars(session, contract, {
            text: "4 hour",
            integer: 28800,
            duration: "8 M"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));

        this.ONE_DAY = new Bars(session, contract, {
            text: "1 day",
            integer: 3600 * 24,
            duration: "1 Y"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));
        
    }
    
    cancel() {
        this.ONE_SECOND.cancel();
        this.FIVE_SECONDS.cancel();
        this.TEN_SECONDS.cancel();
        this.FIFTEEN_SECONDS.cancel();
        this.THIRTY_SECONDS.cancel();
        this.ONE_MINUTE.cancel();
        this.TWO_MINUTES.cancel();
        this.THREE_MINUTES.cancel();
        this.FIVE_MINUTES.cancel();
        this.TEN_MINUTES.cancel();
        this.FIFTEEN_MINUTES.cancel();
        this.THIRTY_MINUTES.cancel();
        this.ONE_HOUR.cancel();
        this.TWO_HOURS.cancel();
        this.FOUR_HOURS.cancel();
        this.EIGHT_HOURS.cancel();
        this.ONE_DAY.cancel();
    }
    
}

module.exports = Charts;