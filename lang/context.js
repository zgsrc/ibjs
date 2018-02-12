const esprima = require('esprima'),
      vm = require('vm'),
      fs = require('fs'),
      util = require('util'),
      read = util.promisify(fs.readFile),
      Resolver = require("./resolver");

module.exports = class Context {
    
    constructor(service, scope) {
        Object.defineProperty(this, "resolver", { value: new Resolver(service) });
        
        Object.defineProperty(this, "scope", { 
            value: new Proxy(scope, {
                get: function(scope, name) {
                    if (name[0] == "$") return scope[name] || scope[name.from(1)];
                    else return scope[name];
                }
            })
        });
        
        Object.defineProperty(this, "vm", { value: vm.createContext(this.scope) });
    }
    
    async reify(src) {
        let ids = esprima.tokenize(src.toString()).filter(
            token => token.type == "Identifier" && token.value[0] == "$" && token.value.length > 1
        ).map("value").map(id => id.substr(1)).unique().filter(id => this.scope[id] == null);
        
        return Promise.all(ids.map(async identifier => {
            this.scope[identifier] = await this.resolver.resolve(identifier);
        }));
    }
    
    async evaluate(src, file) {
        await this.reify(src);
        return await vm.runInContext(src.toString(), this.vm, { filename: file });
    }
    
    async call(fn) {
        return this.evaluate(`((${fn.toString()})())`);
    }
    
    async execute(src, file) {
        await this.reify(src);
        return await vm.runInContext(`((async () => {\n${src.toString()}\n})())`, this.vm, { filename: file, lineOffset: -1 });
    }
    
    async load(file) {
        return await this.execute(await read(file), file);
    }
    
}