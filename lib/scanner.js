require("sugar");

var Scanner = exports.Scanner = function(cxn) {
    
    var me = this;
    
    this.priceAbove = function(price) { me.abovePrice = price; return me; };
    this.priceBelow = function(price) { me.belowPrice = price; return me; };
    
    this.volumeAbove = function(volume) { me.aboveVolume = volume; return me; };
    
    this.averageOptionVolumeAbove = function(volume) { me.averageOptionVolumeAbove = volume; return me; };
    
    this.couponRateAbove = function(coupon) { me.couponRateAbove = coupon; return me; };
    this.couponRateBelow = function(coupon) { me.couponRateBelow = coupon; return me; };
    
    this.excludeConvertibleBonds = function() { me.excludeConvertibleBonds = true; return me; };
    
    this.includeInstrumentClass = function(type) { me.instrument = type; return me; };
    
    this.location = function(location) { me.location = location; return me; };
    
    this.maturityDateAfter = function(date) { me.maturityDateAbove = date; return me; };
    this.maturityDateBelow = function(date) { me.maturityDateBelow = date; return me; };
    
    this.marketCapGreaterThan = function(amount) { me.marketCapAbove = amount; return me; };
    this.marketCapLessThan = function(amount) { me.marketCapBelow = amount; return me; };
    
    this.moodysRatingAbove = function(rating) { me.moodysRatingAbove = rating; return me; };
    this.moodysRatingBelow = function(rating) { me.moodysRatingBelow = rating; return me; };
    
    this.spRatingAbove = function(rating) { me.spRatingAbove = rating; return me; };
    this.spRatingBelow = function(rating) { me.spRatingBelow = rating; return me; };
    
    this.stockType = function(stockTypeFilter) { me.stockTypeFilter = stockTypeFilter; return me; };
    
    this.rows = function(rows) { me.numberOfRows = rows; return me; };
    
    this.start = function(cb) {
        cxn.scan(me, cb);
    };
    
};