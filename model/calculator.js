"use strict";

const { observable, observe } = require('@nx-js/observer-util');

class Calculator {
    
    constructor() {
        this.calculations = [ ];
        return observable(this);
    }
    
    rules(fn) {
        this.calculations.push(observe(fn));
    }
    
}

module.exports = Calculator;