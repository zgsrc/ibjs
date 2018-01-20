module.exports = { 

    MIN: window => window.min("low"),
    MAX: window => window.max("high"),
    MOM: window => window.last().close - window.first().open,
    
    SMA: window => window.average("close"),
    WMA: window => window.length.downto(1).map((n,i) => n * window[i]) / (window.length * (window.length + 1) / 2),
    EMA: (window, name) => {
        let P = window.at(-1).close,
            EMAp = window.at(-2)[name],
            n = window.length,
            K = 2 / (n + 1);

        return ( P - EMAp ) * K + EMAp;
    },
    
    VWAP: window => window.map(bar => bar.volume * [ bar.high, bar.low, bar.close ].average()).sum() / window.sum("volume")

};