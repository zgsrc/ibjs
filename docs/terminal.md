## Terminal

The terminal uses the `REPL` package to expose an `Environment` to the command line.

Starting the terminal is as easy as running the `npm start` command with the `terminal [port]` parameter.

    npm start terminal [port]
    
Or running the index.js file directly.
    
    node index.js terminal [port]

Programmatically, a terminal can be created like so:

```javascript
sdk.terminal(sdk.session({ port: 4001 }));
```