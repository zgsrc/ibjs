const math = require('mathjs');

const studies = module.exports = { };

// Simple moving average
studies.SMA = window => window.map("close").average();

// Price channel
studies.PC = window => { 
    return { upper: window.max("high"), lower: window.min("low") } 
};

// Momentum
studies.MOM = window => window.last().close - window.first().close;
studies.ROC = window => ((window.last().close / window.first().close) - 1) * 100;

// Average mean price
studies.AMP = window => (window.last().high + window.last().low + window.last().close) / 3;
studies.AMP_SMA = window => window.map("AMP").average();

// Money Flow
studies.MF = window => window.last().AMP * window.last().volume;
studies.MR = window => window.filter(s => s.MF > 0).sum() / window.filter(s => s.MF < 0).sum();
studies.MFI = window => 100 - (100 / (1 + window.last().MR));

// Accelerations Bands
studies.ABANDS = window => {
    return {
        upper: window.map(s => s.high * (1 + 4 * (s.high - s.low) / (s.high + s.low))).average(),
        middle: window.map("close").average(),
        lower: window.map(s => s.low * (1 - 4 * (s.high - s.low) / (s.high + s.low))).average()
    };
};

// Accumulations/Distributions
studies.AD = window => window.map(s => ((((s.close - s.low) - (s.high - s.close)) / (s.high - s.low)) * s.volume)).sum();

// Aroon
studies.AR = window => {
    let ar = {
        up: window.indexOf(window.max("high")) / window.length * 100,
        down: window.indexOf(window.min("low")) / window.length * 100
    };
    
    ar.oscillator = ar.up - ar.down;
    return ar;
};

// Bollinger Bands
studies.BBANDS = (window, factor) => {
    let sma = window.map("close").average(),
        dev = window.map("close").std() * (factor || 2);

    return { upper: sma + dev, middle: sma, lower: sma - dev };
};

// Keltner Channel
studies.KELTNER = window => {
    let typicalPrice = window.map(b => (b.high + b.low + b.close) / 3).average(),
        typicalRange = window.map(b => b.high - b.low).average();
    
    return {
        high: typicalPrice + typicalRange,
        middle: typicalPrice,
        low: typicalPrice - typicalRange
    };
};