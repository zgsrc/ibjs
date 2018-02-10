require("sugar").extend();

const esprima = require("esprima"),
      escodegen = require("escodegen"),
      code = require("./code");

function exec(script, dictionary) {
    let tokens = esprima.tokenize(script);
    let implicitReferences = tokens.filter(token => token.type == "Identifier" && token.value[0] == "$");
    let implicitSymbols = implicitReferences.map("value").unique();
    
    let declarationCode = implicitSymbols.map(
        symbol => `let ${symbol} = await session.contract("${ dictionary ? dictionary.get(symbol) || symbol : symbol }");`
    ).join("\n");
    
    // generate declare script
    
    // eval and return module
    
    // execute module
}


function compile(script) {
    let tree = esprima.parseModule(script, { tokens: true }, (node, meta) => {
        let root = node, stack = [ root ], found = false;
        while (node && node.type == "MemberExpression" && node.property && node.property.type == "Identifier") {
            node = node.object;
            if (node) {
                if (node.type == "Identifier") {
                    found = true;
                    break;
                }
                else {
                    stack.push(node);
                }
            }
        }
        
        if (found) {
            stack.reverse();
            
            let path = stack[0].object.name + '.' + stack[0].property.name;
            stack.from(1).forEach(prop => path += '.' + prop.property.name);
            root.path = path;
        }
    });
    
        
    let steps = tree.body,
        index = steps.findIndex(step => step.type == "ExpressionStatement" || step.type == "IfStatement"),
        lines = steps.to(index);
    
    steps = steps.from(index);
    
    // Setup module statement
    let identifiers = tree.tokens.filter(t => t.type == "Identifier" && t.value.startsWith("$") && t.value.length > 1).map("value").unique(),
        rewrite = [ ];
    
    identifiers.forEach(symbol => {
        if ([ "account", "accounts", "trades", "positions" ].indexOf(symbol.from(1)) < 0) {
            rewrite.push(code.security(symbol));
        }
        else {
            rewrite.push(code.realtime(symbol));
        }
    });
    
    steps = steps.map(step => {
        if (step.type == "IfStatement") {
            return code.when(step.test, step.consequent.body);
        }
        else if (step.type == "ExpressionStatement" && step.expression.type == "AssignmentExpression") {
            let id = step.expression.left.name;
            if (identifiers.indexOf(id) < 0) identifiers.push(id);
            else throw new Error("Duplicate symbol " + id);
            return code.calculation(id, step.expression.right);
        }
        else {
            //throw new Error("Invalid code: " + escodegen.generate(step));
        }
        
        return step;
    });
    
    steps = traverse(steps, (node, stack) => {
        if (node.path) {
            let id = node.path.split(".")[0];
            if (identifiers.indexOf(id) >= 0) {
                return code.ref(node.path);
            }
        }
        else if (node.type == "Identifier") {
            if (identifiers.indexOf(node.name) >= 0) {
                return code.ref(node.name);
            }
        }
        
        return node;
    });
    
    rewrite.push(...steps);
    lines.push(code.script(rewrite));
    return escodegen.generate(code.program(lines));
}

function traverse(node, fn, stack) {
    if (Array.isArray(node)) {
        return node.map(sub => traverse(sub, fn, stack || [ ]));
    }
    else if (typeof node == "object" && node != null) {
        node = fn(node, stack);
        if (!stack) stack = [ ];
        stack.push(node);
        
        Object.keys(node).forEach(key => {
            node[key] = traverse(node[key], fn, stack);
        });
        
        stack.pop(node);
    }
    
    return node;
}

module.exports = compile;