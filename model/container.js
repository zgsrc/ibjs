const Base = require("./base");
const { computed, observe, dispose } = require("hyperactiv");

class Container extends Base {
    constructor(reactive) {
        super();
        if (reactive) {
            let _this = observe(this, { deep: true, batch: true });
            Object.defineProperty(this, "rule", { value: fn => computed(fn) });
            return _this;
        }
    }
}

function container(reactive) {
    return new Proxy(new Container(reactive), {
        set: function(obj, name, value) {
            if (obj[name] && obj[name] instanceof Base) {
                obj[name].removeAllListeners();
                obj[name].cancel();
            }
            
            if (value instanceof Base) {
                value.on("update", data => {
                    data.name = name;
                    obj.emit("update", data);
                });
            }
            
            obj[name] = value;
            obj.emit("set", { name: name, value: value.snapshot || value });
            
            return value;
        }
    });
}

module.exports = container;