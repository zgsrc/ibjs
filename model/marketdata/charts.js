"use strict";

require("sugar");

Date.getLocale('en').addFormat('{yyyy}{MM}{dd}  {hh}:{mm}:{ss}');

const MarketData = require("./marketdata"),
      Bars = require("./bars");

class Charts extends MarketData {
    
    constructor(session, contract) {
        
        super(session, contract);
        
        this.service.headTimestamp(this.contract.summary, "TRADES", 0, 1).once("data", data => {
            this.earliestDataTimestamp = Date.create(data);
        }).send();
        
        this.seconds = {
            one: new Bars(session, contract, {
                text: "1 sec",
                integer: 1,
                duration: "1800 S"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            five: new Bars(session, contract, {
                text: "5 secs",
                integer: 5,
                duration: "3600 S"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            ten: new Bars(session, contract, {
                text: "10 secs",
                integer: 10,
                duration: "7200 S"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            fifteen: new Bars(session, contract, {
                text: "15 secs",
                integer: 15,
                duration: "10800 S"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            thirty: new Bars(session, contract, {
                text: "30 secs",
                integer: 30,
                duration: "1 D"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data))
        };
        
        this.minutes = { 
            one: new Bars(session, contract, {
                text: "1 min",
                integer: 60,
                duration: "2 D"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            two: new Bars(session, contract, {
                text: "2 mins",
                integer: 120,
                duration: "3 D"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            three: new Bars(session, contract, {
                text: "3 mins",
                integer: 180,
                duration: "4 D"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            five:  new Bars(session, contract, {
                text: "5 mins",
                integer: 300,
                duration: "1 W"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            ten: new Bars(session, contract, {
                text: "10 mins",
                integer: 600,
                duration: "2 W"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            fifteen: new Bars(session, contract, {
                text: "15 mins",
                integer: 900,
                duration: "2 W"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            thirty: new Bars(session, contract, {
                text: "30 mins",
                integer: 1800,
                duration: "1 M"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data))
        };
        
        this.hours = {
            one: new Bars(session, contract, {
                text: "1 hour",
                integer: 3600,
                duration: "2 M"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            two: new Bars(session, contract, {
                text: "2 hour",
                integer: 7200,
                duration: "2 M"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            four: new Bars(session, contract, {
                text: "4 hour",
                integer: 14400,
                duration: "4 M"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data)),
            eight: new Bars(session, contract, {
                text: "4 hour",
                integer: 28800,
                duration: "8 M"
            }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data))
        };

        this.daily = new Bars(session, contract, {
            text: "1 day",
            integer: 3600 * 24,
            duration: "1 Y"
        }).on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));
        
    }
    
    close() {
        this.seconds.one.close();
        this.seconds.two.close();
        this.seconds.five.close();
        this.seconds.ten.close();
        this.seconds.fifteen.close();
        this.seconds.thirty.close();
        
        this.minutes.one.close();
        this.minutes.two.close();
        this.minutes.five.close();
        this.minutes.ten.close();
        this.minutes.fifteen.close();
        this.minutes.thirty.close();
        
        this.hours.one.close();
        this.hours.two.close();
        this.hours.four.close();
        this.hours.eight.close();
        
        this.daily.close();
    }
    
}

module.exports = Charts;