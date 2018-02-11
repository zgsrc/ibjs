const esprima = require('esprima');

export default async function(resolve, scope, src) {
    return new Promise((yes, no) => {
        let ids = esprima.tokenize(src)
                         .filter(token => token.type == "Identifier")
                         .map("value")
                         .unique();

        Promise.all(ids.map(async identifier => {
            if (scope[identifier]) {
                return;
            }
            else if (identifier[0] == "$" && identifier.length > 1) {
                if (scope[identifier.from(1)]) scope[identifier] = scope[identifier.from(1)];
                else scope[identifier] = scope[identifier.from(1)] = await resolve(identifier.from(1));
            }
            else if (constants.wellKnownSymbols[identifier]) {
                scope[identifier] = await resolve(constants.wellKnownSymbols[identifier]);
            }
        })).then(() => {
            try {
                with (scope) {
                    yes(eval(src));
                }
            }
            catch(ex) {
                no(ex);
            }
        }).catch(no);
    });
}