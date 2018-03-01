const { Observable, Computable } = require("hyperactiv/mixins");

class Subscription extends Computable(Observable(Object)) {
    
    constructor(base, data) {
        super({ });
        
        if (base) {
            if (base.service) {
                Object.defineProperty(this, "contract", { value: base, enumerable: false });
                Object.defineProperty(this, "service", { value: base.service, enumerable: false });
            }
            else if (base.socket) {
                Object.defineProperty(this, "service", { value: base, enumerable: false });
            }
        }
        
        Object.defineProperty(this, "subscriptions", { value: [ ], enumerable: false });
    }
    
    dispose() {
        super.dispose();
        
        this.streaming = false;
        
        while (this.subscriptions.length) {
            this.subscriptions.pop().cancel();
        }
        
        Object.values(this).forEach(value => {
            if (value.dispose && typeof value == "function") {
                value.dispose();
            }
        });
    }
    
}

module.exports = Subscription;