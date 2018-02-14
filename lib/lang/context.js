const esprima = require('esprima'),
      escodegen = require('escodegen'),
      vm = require('vm'),
      fs = require('fs'),
      util = require('util'),
      read = util.promisify(fs.readFile),
      { computed, observe, dispose } = require('hyperactiv'),
      Resolver = require("./resolver");

module.exports = class Context {
    
    constructor(service, scope, defaultResolver) {
        Object.defineProperty(this, "resolver", { value: new Resolver(service, defaultResolver) });
        
        scope.$ = observe({ }, { deep: true, batch: true });
        scope.observe = observe;
        scope.rule = computed;
        
        scope.reify = src => this.reify(src);
        scope.run = fn => this.run(fn);
        scope.evaluate = src => this.evaluate(src);
        scope.execute = src => this.execute(src);
        scope.rules = fn => this.rules(fn);
        scope.load = file => this.load(file);
        
        Object.defineProperty(this, "scope", { 
            value: new Proxy(scope, {
                get: (scope, name) => (name in scope) ? scope[name] : scope.$[name],
                set: (scope, name, value) => {
                    if (!(name in scope) && scope.$[name]) scope.$[name] = value;
                    else scope[name] = value;
                    return true;
                }
            })
        });
        
        Object.defineProperty(this, "vm", { 
            value: vm.createContext(this.scope) 
        });
    }
    
    async reify(src) {
        let ids = esprima.tokenize(src.toString()).filter(
            token => token.type == "Identifier" && token.value[0] == "$" && token.value.length > 1
        ).map("value").unique().filter(id => this.scope[id] == null);
        
        return Promise.all(ids.map(async identifier => {
            let value = await this.resolver.resolve(identifier);
            if (identifier[1] == "$" && this.scope.$[identifier] == null) this.scope.$[identifier] = value;
            else this.scope[identifier] = value;
        }));
    }
    
    async run(fn) {
        await this.reify(fn);
        return await vm.runInContext(`((${fn.toString()})())`, this.vm, { columnOffset: 4 });
    }
    
    async evaluate(src, file) {
        await this.reify(src);
        return await vm.runInContext(src.toString(), this.vm, { filename: file });
    }
    
    async execute(src, file) {
        await this.reify(src);
        return await vm.runInContext(`((async () => {\n${src.toString()}\n})())`, this.vm, { filename: file, lineOffset: -1 });
    }
    
    rules(src, file) {
        let tree = esprima.parse(src.toString());
        tree.body = tree.body.map(statement => {
            let type = statement.type;
            if (type == "FunctionDeclaration") {
                return generateCall(statement);
            }
            else if (["BlockStatement", "ForStatement", "ForInStatement", "ForOfStatement", "IfStatement", "SwitchStatement", "TryStatement", "WhileStatement", "WithStatement"].indexOf(type) >= 0) {
                return generateCall(generateFn(statement));
            }
            else if (type == "ExpressionStatement") {
                if (statement.expression.type == "AssignmentExpression") {
                    if (statement.expression.left.type == "Identifier") {
                        statement.expression.left = {
                            "type":"MemberExpression",
                            "computed": false,
                            "object": {
                                "type": "Identifier",
                                "name": "$"
                            },
                            "property": {
                                "type": "Identifier",
                                "name": statement.expression.left.name
                            }
                        };
                    }
                    
                    statement.expression.right = {
                        "type":"AwaitExpression",
                        "argument": statement.expression.right
                    };
                    
                    return generateCall(generateFn(statement));
                }
            }
            else return statement;
        });
        
        src = escodegen.generate(tree);
        console.log(src);
        return this.execute(src, file);
    }
    
    async load(file) {
        if (file.endWith(".rules.js")) return await this.rules(await read(file), file);
        else return await this.execute(await read(file), file);
    }
    
}

function generateCall(fn) {
    return {
        "type": "ExpressionStatement",
        "expression": {
            "type": "CallExpression",
            "callee": {
                "type": "Identifier",
                "name": "rule"
            },
            "arguments": [ fn ]
        }
    };
}

function generateFn(statement) {
    return {
        "type": "ArrowFunctionExpression",
        "id": null,
        "params": [],
        "body":{
            "type": "BlockStatement",
            "body": [statement]
        },
        "generator": false,
        "expression": false,
        "async": true
    };
}