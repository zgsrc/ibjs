const esprima = require('esprima'),
      vm = require('vm'),
      repl = require('repl');

module.exports = class Context {
    
    constructor(initialScope) {
        Object.defineProperty(this, "scopes", { 
            value: Array.create([ initialScope || { } ]).compact(true), 
            enerumable: false 
        });
        
        Object.defineProperty(this, "scope", { 
            value: new Proxy({ }, {
                has: (scope, name) => {
                    return this.scopes.some(scope => name in scope);
                },
                get: (scope, name) => {
                    return (this.scopes.find(scope => name in scope) || { })[name];
                },
                set: (scope, name, value) => {
                    let match = this.scopes.find(scope => name in scope);
                    if (match) match[name] = value;
                    else this.scopes[0][name] = value;
                    return true;
                },
                deleteProperty: (scope, name) => {
                    let match = this.scopes.find(scope => name in scope);
                    if (match) {
                        delete match[name];
                        return true;
                    }
                    else return false;
                }
            }),
            enumerable: false
        });

        Object.defineProperty(this, "resolvers", { 
            value: [ ],
            enumerable: false
        });
        
        Object.defineProperty(this, "vm", { 
            value: vm.createContext(this.scope),
            enumerable: false
        });
    }
    
    async resolve(name, property) {
        for (let i = 0; i < this.resolvers.length; i++) {
            let resolver = this.resolvers[i];
            if (Object.isFunction(resolver)) {
                let result = await resolver(name);
                if (result) {
                    if (property) this.scope[property] = result;
                    return result;
                }
            }
            else throw new Error("Resolver " + resolver.toString() + " is not a function.");
        }
    }
    
    async reifyImplicitIdentifiers(ids) {
        if (Array.isArray(ids)) return Promise.all(ids.map(async id => this.scope[id] = await this.resolve(id.substr(1))));
        else this.scope[ids] = await this.resolve(ids.substr(1));
    }
    
    async reifyImplicitIdentifiersInSrc(src) {
        let ids = esprima.tokenize(src.toString()).filter(
            token => token.type == "Identifier" && token.value[0] == "$" && token.value.length > 1
        ).map("value").unique().filter(id => this.scope[id] == null);
        
        await this.reifyImplicitIdentifiers(ids);
    }
    
    async evalInContext(src, file) {
        if (this.resolvers.length) await this.reifyImplicitIdentifiersInSrc(src);
        
        let keys = this.scopes.map(scope => Object.keys(scope)).flatten().compact(true).unique();
        let code = `(async function(${ keys.join(', ') }) {\nreturn (${src.toString().trim()});\n})`;
        let fn = eval(code);
        return await fn(...keys.map(key => this.scope[key]));
        
        
        //return await vm.runInContext(src.toString(), this.vm, { filename: file });
    }
    
    async callInContext(fn) {
        if (this.resolvers.length) await this.reifyImplicitIdentifiersInSrc(fn);
        return await vm.runInContext(`((${fn.toString()})())`, this.vm, { columnOffset: 4 });
    }
    
    async runInContext(src, file) {
        if (this.resolvers.length) await this.reifyImplicitIdentifiersInSrc(src);
        return await vm.runInContext(`((async () => {\n${src.toString()}\n})())`, this.vm, { filename: file, lineOffset: -1 });
    }
    
    get replEval() {
        return (cmd, cxt, filename, cb) => {
            this.evalInContext(cmd).then(val => cb(null, val)).catch(e => {
                if (e.name === "SyntaxError" && /^(Unexpected end of input|Unexpected token)/.test(e.message)) cb(new repl.Recoverable(e));
                else cb(e);
            });
        };
    }
    
}

