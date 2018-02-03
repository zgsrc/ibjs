const Base = require("./base");

class Model extends Base {
    
    constructor(source) {
        super();
        
        if (source) {
            source.on("set", data => {
                this[data.name] = data.value;
            }).on("update", data => {
                let obj = this[data.name];
                if (obj) {
                    if (data.account && !obj.balances) obj[data.account][data.type][data.field] = value;
                    else obj[data.type][data.field] = value;
                }
                
                this.emit("update", data);
            })
        }
    }
    
}

function model(source) {
    return new Proxy(new Model(source), {
        set: function(model, name, value) {
            if (model[name] && model[name] instanceof Base) {
                model[name].removeAllListeners();
                model[name].cancel();
            }
            
            model[name] = value;
            model.emit("set", { name: name, value: value.snapshot || value });
            return value;
        }
    });
}

module.exports = model;