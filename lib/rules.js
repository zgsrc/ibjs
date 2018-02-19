const esprima = require('esprima'),
      escodegen = require('escodegen');

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

Context.translateRulesScript = src => {
    let tree = esprima.parse(src.toString());
    tree.body = tree.body.map(statement => {
        let type = statement.type;
        if (type == "FunctionDeclaration") {
            return generateCall(statement);
        }
        else if ([ "BlockStatement", "ForStatement", "ForInStatement", "ForOfStatement", "IfStatement", "SwitchStatement", "TryStatement", "WhileStatement", "WithStatement" ].indexOf(type) >= 0) {
            return generateCall(generateFn(statement));
        }
        else if (type == "ExpressionStatement") {
            if (statement.expression.type == "AssignmentExpression") {
                statement.expression.right = {
                    "type":"AwaitExpression",
                    "argument": statement.expression.right
                };

                return generateCall(generateFn(statement));
            }
        }
        else return statement;
    });

    return escodegen.generate(tree);
};