    parse(script) {
        if (script && Object.isString(script) && script.length) {
            let tokens = script.toUpperCase().split(" ").map("trim").compact(true);
            
            let action = tokens.shift().toLowerCase();
            let qty = parseInt(tokens.shift());
            this[action](qty);
            
            let price = tokens.shift();
            if (price == "AT") {
                price = tokens.shift();
                
                if (price == "THE") price = tokens.shift();
                
                if (price == "MARKET") {
                    price = tokens.shift();
                    
                    if (price == "ON") {
                        price = tokens.shift();
                        if (price == "OPEN") this.marketOnOpen();
                        else if (price == "CLOSE") this.marketOnClose();
                    }
                    else if (price == "WHEN") {
                        price = tokens.shift();
                        if (!price[0].test(/[0-9]/)) price = price.from(1);
                        price = parseFloat(price);
                        
                        // stop of if-touched order depending on position and price
                    }
                    else {
                        this.market();
                        tokens.unshift(price);
                    }
                }
                else if (price == "MARKET-PROTECT") this.marketProtect();
                else if (price == "MARKET-TO-LIMIT") this.marketToLimit();
                else {
                    if (!price[0].test(/[0-9]/)) price = price.from(1);
                    let limit = parseFloat(price);
                    
                    price = tokens.shift();
                    
                    if (price == "ON") {
                        price = tokens.shift();
                        if (price == "OPEN") this.limitOnOpen(limit);
                        else if (price == "CLOSE") this.limitOnClose(limit);
                    }
                    else if (price == "WHEN") {
                        price = tokens.shift();
                        if (!price[0].test(/[0-9]/)) price = price.from(1);
                        price = parseFloat(price);
                        
                        // stop of if-touched order depending on position and price
                    }
                    else {
                        this.limit(price);
                        tokens.unshift(price);
                    }
                }
            }
            else if (Object.values(constants.ORDER_TYPE).indexOf(price) >= 0) {
                this.ticket.orderType = price;
            }
        }
    }