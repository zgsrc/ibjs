(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require("sugar").extend();

const dop = require("dop");

(window || module.exports).subscribe = async () => root.model = await (root.remote = dop.connect()).subscribe();
},{"dop":2,"sugar":439}],2:[function(require,module,exports){
/*
 * dop@0.26.0
 * www.distributedobjectprotocol.org
 * (c) 2016 Josema Gonzalez
 * MIT License.
 */

//////////  src/dop.js
(function factory(root) {

var dop = {
    version: '0.26.0',
    create: factory,

    // Internal data
    data: {
        node_inc: 0,
        node: {},

        object_inc: 1,
        object: {},

        collectors: [],

        gets_collecting: false,
        gets_paths: [],

        computed_inc: 0,
        computed: {},

        observers_inc: 0,
        observers: {},

        path: {
            // "1.thepath.value": {
                // observers: {},
                // observers_prop: {},
                // interceptors: {},
                // interceptors_prop: {},
                // computeds: [],
                // derivations: [],
            // }
        }
    },
    
    // src
    util: {},
    core: {},
    protocol: {},
    transports: {listen:{}, connect:{}},

    // Constants
    cons: {
        TOKEN: '~TOKEN_DOP',
        DOP: '~DOP',
        // CONNECT: '~CONNECT',
        SEND: '~SEND',
        DISCONNECT: '~DISCONNECT',
        REMOTE_FUNCTION: '$DOP_REMOTE_FUNCTION',
        REMOTE_FUNCTION_UNSETUP: '$DOP_REMOTE_FUNCTION_UNSETUP',
        BROADCAST_FUNCTION: '$DOP_BROADCAST_FUNCTION',
        COMPUTED_FUNCTION: '$DOP_COMPUTED_FUNCTION',
    }

};





//////////  src/env/browser/connect.js

dop.connect = function(options) {

    var args = Array.prototype.slice.call(arguments, 0);

    if (dop.util.typeof(args[0]) != 'object')
        options = args[0] = {};

    if (typeof options.transport != 'function')
        options.transport = dop.transports.connect.websocket;

    return dop.core.connector(args);
};




//////////  src/env/browser/emitter.js

dop.util.emitter = function() {
    this._events = {};
};


dop.util.emitter.prototype.on = function(name, callback, once) {
    if (isFunction(callback)) {
        if (!isObject(this._events))
            this._events = {};
        if (!isObject(this._events[name]))
            this._events[name] = [];
        this._events[name].push(
            (once === true) ? [ callback, true ] : [ callback ]
       );
    }
    return this;
};



dop.util.emitter.prototype.once = function(name, callback) {
    return this.on(name, callback, true);
};



dop.util.emitter.prototype.emit = function(name) {
    if (isObject(this._events[name]) && this._events[name].length > 0) {
        for (var i=0, fun=[], args=Array.prototype.slice.call(arguments, 1); i < this._events[name].length; i++) {
            fun.push(this._events[name][i][0]);
            if (this._events[name][i][1] === true) {
               this._events[name].splice(i, 1); 
               i -= 1;
            }
        }
        for (i=0; i < fun.length; i++)
            fun[i].apply(this, args);
    }
    return this;
};




dop.util.emitter.prototype.removeListener = function(name, callback) {
    if (isObject(this._events[name]) && this._events[name].length > 0) {
        for (var i=0; i < this._events[name].length; i++) {
            if (this._events[name][i][0] === callback) {
                this._events[name].splice(i, 1); 
                i -= 1;
            }
        }
    }
    return this;
};




/*
name = 'T@!#asty ';
emitter = new require('events').EventEmitter();
emitter = new dop.util.emitter();

emitter.on(name, function() {
    console.log('AAA', arguments.length); 
})

cached = function() { console.log('BBB',this._events[name].length); emitter.removeListener(name, cached) };
emitter.on(name, cached);
emitter.on(name, cached);

emitter.once(name, function() {
    console.log('CCC', this._events[name].length); 
})


emitter.emit(name);
emitter.emit(name, 2, 3);
emitter.emit(name, 4);
*/




//////////  src/env/browser/listen.js

dop.listen = function(options) {

    var args = Array.prototype.slice.call(arguments, 0);

    if (dop.util.typeof(args[0]) != 'object')
        options = args[0] = {};

    if (typeof options.transport != 'function')
        options.transport = dop.transports.listen.local;

    return new dop.core.listener(args);
};




//////////  src/env/browser/websocket.js
(function(root){
function websocket(dop, node, options) {

    var url = 'ws://localhost:4444/'+dop.name,
        oldSocket;

    if (typeof options.url == 'string')
        url = options.url.replace('http','ws');
    else if (typeof window!='undefined' && typeof window.location!='undefined' && /http/.test(window.location.href)) {
        var domain_prefix = /(ss|ps)?:\/\/([^\/]+)\/?(.+)?/.exec(window.location.href),
            protocol = domain_prefix[1] ? 'wss' : 'ws';
        url = protocol+'://'+domain_prefix[2].toLocaleLowerCase()+'/'+dop.name;
    }

    // Variables
    var api = options.transport.getApi(),
        socket = new api(url),
        tokenServer,
        send_queue = [],
        readyState;
    
    // Helpers
    function send(message) {
        (socket.readyState===OPEN) ?
            socket.send(message)
        :
            send_queue.push(message); 
    }
    function sendQueue() {
        if (socket.readyState===OPEN)
            while (send_queue.length>0)
                socket.send(send_queue.shift());
    }

    // Socket events
    function onopen() {
        // Reconnect
        if (readyState === CONNECTING)
            socket.send(tokenServer);
        // Connect
        else {
            socket.send(''); // Empty means we want to get connected
            readyState = OPEN;
        }
        dop.core.emitOpen(node, socket, options.transport);
    }
    function onmessage(message) {
        // console.log( 'C<<: `'+message.data+'`' );
        // Reconnecting
        if (readyState===CONNECTING && message.data===tokenServer) {
            readyState = CONNECT;
            dop.core.setSocketToNode(node, socket);
            dop.core.emitReconnect(node, oldSocket);
            sendQueue();
        }
        else if (readyState !== CONNECT) {
            tokenServer = message.data;
            readyState = CONNECT;
            dop.core.setSocketToNode(node, socket);
            send(tokenServer);
            sendQueue();
            dop.core.emitConnect(node);
        }
        else
            dop.core.emitMessage(node, message.data, message);
    }
    function onclose() {
        readyState = CLOSE;
        dop.core.emitClose(node, socket);
        dop.core.emitDisconnect(node);
    }

    // dop events
    // function onconnect() {
    //     if (readyState === CONNECTING) {
    //         dop.core.emitDisconnect(node);
    //         dop.core.setSocketToNode(node, socket);
    //     }
    //     readyState = CONNECT;
    //     dop.core.emitConnect(node);
    //     sendQueue();
    // }
    function ondisconnect() {
        readyState = CLOSE;
        socket.close();
    }

    function reconnect() {
        if (readyState === CLOSE) {
            oldSocket = socket;
            socket = new api(url);
            readyState = CONNECTING;
            addListeners(socket, onopen, onmessage, onclose);
            removeListeners(oldSocket, onopen, onmessage, onclose);
        }
    }

    // Setting up
    dop.core.setSocketToNode(node, socket);
    readyState = CLOSE;
    node.reconnect = reconnect;
    // node.on(dop.cons.CONNECT, onconnect);
    node.on(dop.cons.SEND, send);
    node.on(dop.cons.DISCONNECT, ondisconnect);
    addListeners(socket, onopen, onmessage, onclose);
    
    return socket;
}

function addListeners(socket, onopen, onmessage, onclose) {
    socket.addEventListener('open', onopen);
    socket.addEventListener('message', onmessage);
    socket.addEventListener('close', onclose);
}
function removeListeners(socket, onopen, onmessage, onclose) {
    socket.removeEventListener('open', onopen);
    socket.removeEventListener('message', onmessage);
    socket.removeEventListener('close', onclose);
}


// UMD
if (
    typeof module == 'object' &&
    module.exports &&
    !(typeof dop == 'object' && typeof factory == 'function' && dop.create === factory) // this is true if we are inside of dop.factory
)
    module.exports = websocket;
else {
    websocket.getApi = function() { return window.WebSocket };
    (typeof dop != 'undefined') ?
        dop.transports.connect.websocket = websocket
    :
        root.dopTransportsConnectWebsocket = websocket;
}

// Cons
var CLOSE = 0,
    OPEN = 1,
    CONNECTING = 2,
    CONNECT = 3;


})(this);




//////////  src/util/alias.js
// Private alias
function isFunction(func) {
    return typeof func == 'function';
}

function isObject(object) {
    return (object!==null && typeof object=='object');
}

function isArray(array) {
    return Array.isArray(array);
}

function isNumber(number) {
    return typeof number == 'number';
}




//////////  src/util/clone.js

dop.util.clone = function(value) {
    return (dop.isObjectRegistrable(value)) ?
        dop.util.merge(isArray(value) ? [] : {}, value)
    :
        value;
};




//////////  src/util/get.js

dop.util.get = function(object, path) {

    if (path.length === 0)
        return object;

    for (var index=0, total=path.length, tmpobject; index<total; index++) {

        tmpobject = object[ path[index] ];

        if (index+1<total && isObject(tmpobject))
            object = tmpobject;

        else if (object.hasOwnProperty(path[index]))
            return tmpobject;

        else
            return undefined;

    }

    return object[ path[index] ];
};




// dop.util.set = function(object, path, value) {

//     if (path.length == 0)
//         return object;

//     path = path.slice(0);
//     var obj = object, objdeep, index=0, total=path.length-1;

//     for (;index<total; ++index) {
//         objdeep = obj[path[index]];
//         obj = (objdeep && typeof objdeep == 'object') ?
//             objdeep
//         :
//             obj[path[index]] = {};
//     }

//     obj[path[index]] = value;

//     return object;
// };

// /*
// ori = {test:{hs:124}}
// console.log( dop.util.set(ori, ['test','more'], undefined))
// */







//////////  src/util/invariant.js

dop.util.invariant = function(check) {
    if (!check) {
        var message = dop.util.sprintf.apply(this, Array.prototype.slice.call(arguments, 1));
        throw new Error("[dop] Invariant failed: " + message);
    }
};




//////////  src/util/merge.js

dop.util.merge = function(first, second) {
    var args = arguments;
    if (args.length > 2) {
        // Remove the first 2 arguments of the arguments and add thoose arguments as merged at the begining
        Array.prototype.splice.call(args, 0, 2, dop.util.merge.call(this, first, second));
        // Recursion
        return dop.util.merge.apply(this, args);
    }
    else {
        dop.util.path(second, this, first, dop.util.mergeMutator);
        if (isArray(second))
            first.length = second.length;
        return first;
    }
};

dop.util.mergeMutator = function(destiny, prop, value, typeofValue) {
    if (typeofValue=='object' || typeofValue=='array')
        (!destiny.hasOwnProperty(prop)) ? (destiny[prop] = (typeofValue=='array') ? [] : {}) : destiny[prop];
    else
        destiny[prop] = value;
};




//////////  src/util/path.js

dop.util.path = function (source, callback, destiny, mutator) {
    var hasCallback = isFunction(callback),
        hasDestiny = isObject(destiny);
    dop.util.pathRecursive(source, callback, destiny, mutator, [], [], hasCallback, hasDestiny);
    return destiny;
};

dop.util.pathRecursive = function (source, callback, destiny, mutator, circular, path, hasCallback, hasDestiny) {

    var prop, value, typeofValue, skip;

    for (prop in source) {

        skip = false;
        value = source[prop];
        path.push(prop);

        if (hasCallback)
            skip = callback(source, prop, value, destiny, path, this);

        if (skip !== true) {

            typeofValue = dop.util.typeof(value);

            if (hasDestiny)
                skip = mutator(destiny, prop, value, typeofValue, path);

            // Objects or arrays
            if (
                (typeofValue=='object' || typeofValue=='array') &&
                skip !== true && 
                value!==source && 
                circular.indexOf(value)==-1 &&
                (hasDestiny && destiny[prop]!==undefined)
            ) {
                circular.push(value);
                dop.util.pathRecursive(
                    value,
                    callback,
                    hasDestiny ? destiny[prop] : undefined,
                    mutator,
                    circular,
                    path,
                    hasCallback,
                    hasDestiny
                );
            }

            path.pop();
        }
    }
};




//////////  src/util/sprintf.js

dop.util.sprintf = function() {

    var s = -1, result, str=arguments[0], array = Array.prototype.slice.call(arguments, 1);
    return str.replace(/"/g, "'").replace(/%([0-9]+)|%s/g , function() {

        result = array[ 
            (arguments[1] === undefined || arguments[1] === '') ? ++s : arguments[1]
        ];

        if (result === undefined)
            result = arguments[0];

        return result;

    });

};
// Usage: sprintf('Code error %s for %s', 25, 'Hi') -> "Code error 25 for Hi"
// Usage2: sprintf('Code error %1 for %0', 25, 'Hi') -> "Code error Hi for 25"




//////////  src/util/swap.js

dop.util.swap = function(array, swaps, callback) {

    if (array.length>0 && swaps.length>1) {

        var index = 0,
            total = swaps.length-1,
            tempItem, swapA, swapB,
            isCallback = isFunction(callback);

        for (;index<total; index+=2) {
            swapA = swaps[index];
            swapB = swaps[index+1];
            tempItem = array[swapA];
            array[swapA] = array[swapB];
            array[swapB] = tempItem;
            if (isCallback)
                callback(swapA, swapB);
        }
    }

     return array;
};




//////////  src/util/typeof.js
// https://jsperf.com/typeof-with-more-types
// dop={util:{}}
dop.util.typeof = function(value) {
    var s = typeof value;
    if (s == 'object') {
        if (value) {
            if (isArray(value))
                s = 'array';
            else if (value instanceof Date)
                s = 'date';
            else if (value instanceof RegExp)
                s = 'regexp';
        }
        else
            s = 'null';
    }
    return s;
};



// dop.util.typeof2 = (function() {
    
//     var list = {

//         '[object Null]': 'null',
//         '[object Undefined]': 'undefined',
//         '[object Object]': 'object',
//         '[object Function]': 'function',
//         '[object Array]': 'array',
//         '[object Number]': 'number',
//         '[object String]': 'string',
//         '[object Boolean]': 'boolean',
//         '[object Symbol]': 'symbol',
//         '[object RegExp]': 'regexp',
//         '[object Date]': 'date'
//     };


//     return function(type) {

//         return list[ Object.prototype.toString.call(type) ];

//     };


// })();

// Typeof=dop.util.typeof;
// console.log(Typeof(null));
// console.log(Typeof(undefined));
// console.log(Typeof({}));
// console.log(Typeof(function(){}));
// console.log(Typeof([]));
// console.log(Typeof(1));
// console.log(Typeof("s"));
// console.log(Typeof(true));
// console.log(Typeof(/a/));
// console.log(Typeof(new Date()));
// console.log(Typeof(Symbol('')));
// console.log(Typeof(new Typeof));


// Typeof(null);
// Typeof(undefined);
// Typeof({});
// Typeof(function(){});
// Typeof([]);
// Typeof(1);
// Typeof("s");
// Typeof(true);
// Typeof(/a/);
// Typeof(new Date());
// Typeof(Symbol(''));
// Typeof(new Typeof);






//////////  src/util/uuid.js

dop.util.uuid = function () {

    for (var i=0, uuid='', random; i < 32; i++) {
        random = Math.random() * 16 | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20)
            uuid += '-';
        uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
    }

    return uuid;
};




//////////  src/api/action.js

dop.action = function(func) {
    return function() {
        var collector = dop.collect();
        func.apply(this, arguments);
        collector.emit();
    }
};




//////////  src/api/collect.js

dop.collect = function(index_function) {
    dop.util.invariant(arguments.length==0 || (arguments.length==1 && isFunction(index_function)), 'dop.collect only accept one argument as function');
    var index = index_function ? index_function(dop.data.collectors) : dop.data.collectors.length;
    return dop.core.createCollector(dop.data.collectors, index);
};




//////////  src/api/computed.js

dop.computed = function(callback) {
    dop.util.invariant(isFunction(callback), 'dop.computed needs a function as first parameter');
    var f = function (object, property, shallWeSet, oldValue) {
        return dop.core.createComputed(object, property, callback, shallWeSet, oldValue);
    }
    f._name = dop.cons.COMPUTED_FUNCTION;
    return f;
};




//////////  src/api/createObserver.js

dop.createObserver = function(callback) {
    dop.util.invariant(isFunction(callback), 'dop.createObserver only accept one argument as function');
    var observers=dop.data.observers, index, observer_id, observer;
    for (index in observers)
        if (observers[index].callback === callback)
            return observers[index];

    observer_id = dop.data.observers_inc++;
    observer = new dop.core.observer(callback, observer_id);
    return observers[observer_id] = observer;
};




//////////  src/api/decode.js

dop.decode = function(data, node) {
    var undefineds = [],
        index = 0,
        total,
        output = JSON.parse(data, function(property, value) {
            return dop.core.decode.call(this, property, value, node, undefineds);
        });

    for (total=undefineds.length,index=0; index<total; ++index)
        undefineds[index][0][undefineds[index][1]] = undefined;

    return output;
};




//////////  src/api/del.js

dop.del = function(object, property) {
    // dop.util.invariant(dop.isRegistered(object), 'Object passed to dop.del must be a registered object');
    return (dop.isRegistered(object)) ?
        dop.core.delete(object, property) !== undefined
    :
        delete object[property];
};




//////////  src/api/encode.js

dop.encode = function(data, encoder) {
    if (typeof encoder != 'function')
        encoder = dop.core.encode;
    return JSON.stringify(data, encoder);
};
dop.encodeFunction = function(data) {
    return JSON.stringify(data, dop.core.encodeFunction);
};




//////////  src/api/get.js

dop.get = function(object, property) {
    // dop.util.invariant(dop.isRegistered(object), 'Object passed to dop.del must be a registered object');
    if (dop.data.gets_collecting && dop.isRegistered(object))
        dop.core.proxyObjectHandler.get(dop.getObjectTarget(object), property);

    return object[property];
};




//////////  src/api/getNodeBySocket.js

dop.getNodeBySocket = function(socket) {
    return dop.data.node[ socket[dop.cons.TOKEN] ];
};




//////////  src/api/getObject.js

dop.getObjectDop = function(object) {
    return object[dop.cons.DOP];
};

dop.getObjectRoot = function(object) {
    return dop.getObjectDop(object).r;
};

dop.getObjectParent = function(object) {
    return dop.getObjectDop(object)._;
};

dop.getObjectProxy = function(object) {
    return dop.getObjectDop(object).p;
};

dop.getObjectTarget = function(object) {
    return dop.getObjectDop(object).t;
};

dop.getObjectProperty = function(object) {
    var object_dop = dop.getObjectDop(object);
    if (isArray(object_dop._))
        dop.getObjectPath(object);
    return object_dop.pr;
};

dop.getObjectId = function(object) {
    return dop.getObjectProperty(dop.getObjectRoot(object));
};

dop.getObjectLevel = function(object) {
    return dop.getObjectDop(object).l;
};





// dop.getObjectId = function(object) {
//     var object_dop = dop.getObjectDop(object);
//     return object_dop ? object_dop[0] : undefined;
// };
// dop.getObjectProperty = function(object) {
//     var object_dop = dop.getObjectDop(object);
//     return object_dop[object_dop.length-1];
// };
// dop.getObjectRoot = function(object) {
//     while(dop.getObjectParent(object) !== undefined)
//         object = dop.getObjectParent(object);
//     return dop.getObjectProxy(object);
// };

// dop.getObjectRoot = function(object) {
//     return dop.data.object[dop.getObjectId(object)];
// };

// dop.getObjectRootById = function(object_id) {
//     return dop.data.object[object_id];
// };




//////////  src/api/getObjectPath.js

dop.getObjectPath = function(object, strict) {

    var path = [], 
        // path_id = '',
        parent,
        prop,
        object_dop = object[dop.cons.DOP];

    strict = strict !== false;    

    while (object_dop._ !== undefined) {
        prop = object_dop.pr;
        parent = dop.getObjectTarget(object_dop._);
        if (!strict || parent[prop] === object_dop.p) {
            path.unshift(prop);
            object_dop = parent[dop.cons.DOP];
            // path_id = dop.core.pathSeparator(prop)+path_id;
        }
        else {
            if (isArray(parent)) {
                prop = parent.indexOf(object_dop.p);
                if (prop === -1)
                    return;
                else
                    object_dop.pr = prop;
                    // path.unshift(prop);
            }
            else
                return;
        }
    }
    
    path.unshift(object_dop.pr);
    // path.path_id = dop.core.pathSeparator(object_dop.pr)+path_id;
    return path;
};


// dop.getObjectPathId = function(object) {
//     return dop.core.getPathId(dop.getObjectPath(object));
// };




//////////  src/api/intercept.js

dop.intercept = function(object, property, callback) {

    dop.util.invariant(dop.isRegistered(object), 'dop.intercept() needs a registered object as first parameter');
    var path = dop.getObjectPath(object);
    dop.util.invariant(isArray(path), 'dop.intercept() The object you are passing is not allocated to a registered object');
    var type = 'interceptors';
    if (arguments.length === 2)
        callback = property;
        
    dop.util.invariant(isFunction(callback), 'dop.intercept() needs a callback as last parameter');

    var path_id = dop.core.getPathId(path),
        data_path = dop.data.path;

    if (arguments.length === 3) {
        type = 'interceptors_prop';
        path_id += dop.core.pathSeparator(property);
    }

    if (data_path[path_id] === undefined)
        data_path[path_id] = {};

    if (data_path[path_id][type] === undefined)
        data_path[path_id][type] = [];

    var interceptors = data_path[path_id][type];
    interceptors.push(callback);

    return function dispose() {
        // delete interceptors[interceptors.indexOf(callback)]; // we splice in dop.core.runInterceptors
        interceptors.splice(interceptors.indexOf(callback), 1);
    };

};








//////////  src/api/isBroadcastFunction.js

dop.isBroadcastFunction = function(fun) {
    return (isFunction(fun) && fun._name===dop.cons.BROADCAST_FUNCTION);
};




//////////  src/api/isObjectRegistrable.js

dop.isObjectRegistrable = function(object) {
    if (object === null || typeof object !== "object") return false;
    var prototype = Object.getPrototypeOf(object);
    return prototype === Object.prototype || prototype === Array.prototype;
};

//dop.isObjectRegistrable = function(object) {
//     var tof = dop.util.typeof(object);
//     return (tof === 'object' || tof == 'array');
// };

// function Test(){}
// console.log(isObjectRegistrable({}));
// console.log(isObjectRegistrable([]));
// console.log(isObjectRegistrable(new Test));
// console.log(isObjectRegistrable(new Map));
// console.log(isObjectRegistrable(new Date()));
// console.log(isObjectRegistrable(null));
// console.log(isObjectRegistrable(Symbol('')));
// console.log(isObjectRegistrable(function(){}));
// console.log(isObjectRegistrable(1));
// console.log(isObjectRegistrable("s"));
// console.log(isObjectRegistrable(true));
// console.log(isObjectRegistrable(/a/));




//////////  src/api/isRegistered.js

dop.isRegistered = function(object) {
    return (
        isObject(object) &&
        dop.getObjectDop(object) !== undefined &&
        !Object.getOwnPropertyDescriptor(object, dop.cons.DOP).enumerable
    );
};




//////////  src/api/isRemoteFunction.js

dop.isRemoteFunction = function(fun) {
    return (isFunction(fun) && fun._name===dop.cons.REMOTE_FUNCTION);
};




//////////  src/api/onsubscribe.js

dop.onSubscribe = function(callback) {
    dop.util.invariant(isFunction(callback), 'dop.onSubscribe only accept a function as parameter');
    dop.data.onsubscribe = callback;
};




//////////  src/api/register.js

dop.register = function(object) {
    dop.util.invariant(dop.isObjectRegistrable(object) && !isArray(object), 'dop.register needs a regular plain object as first parameter');
    return (dop.isRegistered(object)) ?
        dop.getObjectProxy(object)
    :
        dop.core.configureObject(object, dop.data.object_inc++);
};





//////////  src/api/removeComputed.js

dop.removeComputed = function(object, property, callback) {
    dop.util.invariant(dop.isRegistered(object), 'dop.removeComputed needs a registered object as first parameter');
    dop.util.invariant(property !== undefined, 'dop.removeComputed needs a string or number as second parameter');
    
    var computed_pathid = dop.core.getPathId(dop.getObjectPath(object, false).concat(property)),
        shallWeRemoveAll = !isFunction(callback),
        isSameFunction,
        data_path = dop.data.path,
        removed = [],
        computed_ids,
        computed_id,
        computed,
        derivation_pathid,
        derivations,
        index,
        // total,
        index2,
        total2;

    if (isObject(data_path[computed_pathid]) && isArray(data_path[computed_pathid].computeds) && data_path[computed_pathid].computeds.length>0) {
        computed_ids = data_path[computed_pathid].computeds;
        for (index=0; index<computed_ids.length; ++index) {
            computed_id = computed_ids[index];
            computed = dop.data.computed[computed_id];
            isSameFunction = computed.function===callback;
            if (shallWeRemoveAll || isSameFunction) {
                // Deleting computing itself
                delete dop.data.computed[computed_id];
                // Removing id in computed
                computed_ids.splice(computed_ids.indexOf(computed_id), 1);
                // Removing derivations
                for (index2=0,total2=computed.derivations.length; index2<total2; ++index2) {
                    derivation_pathid = computed.derivations[index2];
                    derivations = data_path[derivation_pathid].derivations;
                    derivations.splice(derivations.indexOf(computed_id), 1);
                }
                index -= 1;
                removed.push(computed.function);
            }

            if (isSameFunction)
                break;
        }
    }

    return removed;
};




//////////  src/api/set.js

dop.set = function(object, property, value, options) {
    // dop.util.invariant(dop.isRegistered(object), 'Object passed to dop.set must be a registered object');
    (dop.isRegistered(object)) ?
        dop.core.set(object, property, value, options)
    :
        object[property] = value;
    return value;
};




//////////  src/api/setBroadcastFunction.js

dop.setBroadcastFunction = function (object, namefunction) {
    dop.util.invariant(dop.isRegistered(object), 'Object passed to dop.setBroadcastFunction must be a registered object');
    var path = dop.getObjectPath(object),
        object_id = path.shift();
    path.push(namefunction);
    dop.getObjectTarget(object)[namefunction] = function() {
        return dop.protocol.broadcast(object_id, path, arguments);
    }
    dop.getObjectTarget(object)[namefunction]._name = dop.cons.BROADCAST_FUNCTION;
};






//////////  src/core/api_transports/emitClose.js

dop.core.emitClose = function(node, socket) {
    if (node.listener)
        node.listener.emit('close', socket);
    node.emit('close', socket);
};




//////////  src/core/api_transports/emitConnect.js

dop.core.emitConnect = function(node) {
    node.connected = true;
    if (node.listener)
        node.listener.emit('connect', node);
    node.emit('connect');
    dop.core.sendMessages(node);
};




//////////  src/core/api_transports/emitDisconnect.js

dop.core.emitDisconnect = function(node) {
    node.connected = false;
    if (node.listener) {
        dop.core.unregisterNode(node);
        node.listener.emit('disconnect', node);
    }
    node.emit('disconnect');
};




//////////  src/core/api_transports/emitMessage.js

dop.core.emitMessage = function(node, message_string, message_raw) {

    // If server
    if (node.listener)
        node.listener.emit('message', node, message_string, message_raw);

    node.emit('message', message_string, message_raw);

    var messages;

    // Parsing messages
    if (typeof message_string == 'string' && message_string[0] == '[') { // https://jsperf.com/slice-substr-substring-test
        try { messages = dop.decode(message_string, node); } 
        catch(e) { /*console.log(e);*/ }
    }
    else 
        messages = message_string;


    // Managing protocol
    if (isArray(messages)) {

        // Detecting if is multimessage
        if (typeof messages[0] == 'number')
            messages = [messages];

        // Managing all messages one by one
        for (var i=0, t=messages.length, message, requests, request, request_id, response, instruction_type, message_typeof; i<t; i++) {

            message = messages[i];
            request_id = message[0];

            // If is a number we manage the request
            if (typeof request_id == 'number' && request_id !== 0) {

                // If is only one request
                message_typeof = dop.util.typeof(message[1]);
                requests = ((message_typeof=='number' && message_typeof!='array') || request_id<0) ? 
                    [request_id, message.slice(1)]
                :
                    requests = message;


                for (var j=1, t2=requests.length, instruction_function; j<t2; ++j) {
                    
                    request = requests[j];

                    if (dop.util.typeof(request)=='array' && ((typeof request[0]=='number' && request_id>0) || request_id<0)) {
                        
                        instruction_type = request[0];
                        instruction_function = 'on'+dop.protocol.instructions[instruction_type];

                        // REQUEST ===============================================================
                        if (request_id>0 && isFunction(dop.protocol[instruction_function]))
                            dop.protocol[instruction_function](node, request_id, request);


                        // RESPONSE ===============================================================
                        else {

                            request_id *= -1;

                            if (isObject(node.requests[request_id])) {

                                response = request;
                                request = node.requests[request_id];

                                instruction_type = request[1];
                                instruction_function = '_on'+dop.protocol.instructions[instruction_type];

                                if (isFunction(dop.protocol[instruction_function]))
                                    dop.protocol[instruction_function](node, request_id, request, response);
                                
                                dop.core.deleteRequest(node, request_id);
                            }

                        }

                    }
                }

            }

        }

    }






    // var messages, 
    //     user = (socket[dop.cons.TOKEN] === undefined) ?
    //         socket
    //     :
    //         node.users[ socket[dop.cons.TOKEN] ];






    // // Managing OSP protocol
    // if (dop.util.typeof(messages) == 'array')
    //     dop.core.manage.call(this, user, messages);

};




//////////  src/core/api_transports/emitOpen.js

dop.core.emitOpen = function(listener_node, socket, transport) {
    var node;
    // Client
    if (listener_node instanceof dop.core.node)
        node = listener_node;
    // Server
    else {
        node = new dop.core.node();
        node.listener = listener_node;
    }
    node.transport = transport;
    dop.core.registerNode(node);
    listener_node.emit('open', socket);
    return node;
};




//////////  src/core/api_transports/emitReconnect.js

dop.core.emitReconnect = function(node, oldSocket, newNode) {
    if (node.listener) {
        dop.core.unregisterNode(newNode);
        node.listener.emit('reconnect', node, oldSocket);
    }
    node.emit('reconnect', oldSocket);
    dop.core.sendMessages(node);
};





//////////  src/core/constructors/collector.js

dop.core.collector = function Collector(queue, index) {
    this.active = true;
    this.mutations = [];
    this.queue = queue;
    queue.splice(index, 0, this);
};

dop.core.collector.prototype.add = function(mutation) {
    if (this.active && (this.filter===undefined || this.filter(mutation)===true)) {
        this.mutations.push(mutation);
        return true;
    }
    return false;
};

dop.core.collector.prototype.emit = function() {
    this.destroy();
    return this.emitWithoutDestroy();
};

dop.core.collector.prototype.emitWithoutDestroy = function() {
    var snapshot = new dop.core.snapshot(this.mutations);
    snapshot.emit();
    this.mutations = [];
    return snapshot;
};

dop.core.collector.prototype.pause = function() {
    this.active = false;
};

dop.core.collector.prototype.resume = function() {
    this.active = true;
};

dop.core.collector.prototype.destroy = function() {
    this.active = false;
    this.queue.splice(this.queue.indexOf(this), 1);
};




//////////  src/core/constructors/listener.js

dop.core.listener = function Listener(args) {
    // Inherit emitter
    dop.util.merge(this, new dop.util.emitter);
    args.unshift(dop, this);
    this.options = args[2];
    this.transport = this.options.transport;
    this.listener = this.options.transport.apply(this, args);
};




//////////  src/core/constructors/node.js

dop.core.node = function Node() {
    // Inherit emitter
    dop.util.merge(this, new dop.util.emitter); //https://jsperf.com/inheritance-call-vs-object-assign
    this.connected = false;
    this.request_inc = 1;
    this.requests = {};
    this.message_queue = []; // Response / Request / instrunctions queue
    this.subscriber = {};
    this.owner = {};
    // Generating token
    do { this.token = dop.util.uuid() }
    while (typeof dop.data.node[this.token]=='object');
};



dop.core.node.prototype.send = function(message) {
    this.emit(dop.cons.SEND, message);
};

dop.core.node.prototype.disconnect = function() {
    this.emit(dop.cons.DISCONNECT);
};

dop.core.node.prototype.subscribe = function() {
    return dop.protocol.subscribe(this, arguments);
};

dop.core.node.prototype.unsubscribe = function(object) {
    dop.util.invariant(dop.isRegistered(object), 'Node.unsubscribe needs a subscribed object');
    return dop.protocol.unsubscribe(this, object);
};




//////////  src/core/constructors/observer.js

dop.core.observer = function Observer(callback, id) {
    this.callback = callback;
    this.id = id;
    this.observers = {}; // need it for destroy()
    this.observers_prop = {}; // need it for destroy()
};


dop.core.observer.prototype.observe = function(object, property) {
    dop.util.invariant(dop.isRegistered(object), 'observer.observe() needs a registered object as first parameter');
    var path = dop.getObjectPath(object);
    dop.util.invariant(isArray(path), 'observer.observe() The object you are passing is not allocated to a registered object');
    

    var path_id = dop.core.getPathId(path),
        data_path = dop.data.path,
        type = 'observers';

    // is observeProperty
    if (arguments.length === 2) {
        type = 'observers_prop';
        path_id += dop.core.pathSeparator(property);
    }

    if (data_path[path_id] === undefined)
        data_path[path_id] = {};

    if (data_path[path_id][type] === undefined)
        data_path[path_id][type] = {};

    data_path[path_id][type][this.id] = true;
    this[type][path_id] = true;

    return function unobserve() {
        delete data_path[path_id][type][this.id];
        delete this[type][path_id];
    }.bind(this);
};


// dop.core.observer.prototype.unobserve = function(object, property) {
//     dop.util.invariant(dop.isRegistered(object), 'observer.unobserve() needs a registered object as first parameter');
//     var path = dop.getObjectPath(object);
//     dop.util.invariant(isArray(path), 'observer.unobserve() The object you are passing is not allocated to a registered object');
    

//     var path_id = dop.core.getPathId(path);
//         data_path = dop.data.path,
//         type = 'observers';

//     // is observeProperty
//     if (arguments.length === 2) {
//         type = 'observers_prop';
//         path_id += dop.core.pathSeparator(property);
//     }

//     if (data_path[path_id] !== undefined && data_path[path_id][type] !== undefined) {
//         delete data_path[path_id][type][this.id];
//         delete this[type][path_id];
//     }
// };


dop.core.observer.prototype.destroy = function() {
    var path_id,
        data_path = dop.data.path;
        
    delete dop.data.observers[this.id];

    for (path_id in this.observers)
        delete data_path[path_id].observers[this.id];

    for (path_id in this.observers_prop)
        delete data_path[path_id].observers_prop[this.id];
};






//////////  src/core/constructors/snapshot.js

dop.core.snapshot = function Snapshot(mutations) {
    this.mutations = mutations;
    this.forward = true;
};


dop.core.snapshot.prototype.undo = function () {
    if (this.forward && this.mutations.length>0) {
        this.forward = false;
        this.setPatch(this.getUnpatch());
    }
};


dop.core.snapshot.prototype.redo = function () {
    if (!this.forward && this.mutations.length>0) {
        this.forward = true;
        this.setPatch(this.getPatch());
    }
};


dop.core.snapshot.prototype.emit = function () {
    // This is true if we have nodes subscribed to those object/mutations
    // Then we have to emit to nodes
    if (this.mutations.length>0 && dop.core.emitToObservers(this.mutations))
        dop.core.emitNodes(this.forward ? this.getPatch() : this.getUnpatch());
};


dop.core.snapshot.prototype.getPatch = function() {
    return this.patch = (this.patch === undefined) ?
        dop.core.getPatch(this.mutations)
    :
        this.patch;
};


dop.core.snapshot.prototype.getUnpatch = function() {
    return this.unpatch = (this.unpatch === undefined) ?
        dop.core.getUnpatch(this.mutations)
    :
        this.unpatch;     
};


dop.core.snapshot.prototype.setPatch = function(patch) {
    for (var object_id in patch)
        dop.core.setPatch(
            patch[object_id].object,
            patch[object_id].chunks,
            dop.core.setPatchMutator
        );
};




//////////  src/core/error.js

dop.core.error = {

    // warning: {
    //     TOKEN_REJECTED: 'User disconnected because is rejecting too many times the token assigned'
    // },

    reject_local: {
        OBJECT_NOT_FOUND: 'Object not found',
        NODE_NOT_FOUND: 'Node not found',
        TIMEOUT_REQUEST: 'Timeout waiting for response'
    },

    // Remote rejects
    reject_remote: {
        OBJECT_NOT_FOUND: 1,
        1: 'Remote object not found or not permissions to use it',
        SUBSCRIPTION_NOT_FOUND: 2,
        2: 'Subscription not found to unsubscribe this object',
        FUNCTION_NOT_FOUND: 3,
        3: 'Remote function not found to be called',
        CUSTOM_REJECTION: 4,
        // 4: ''
    }

};





//////////  src/core/mutators/delete.js

dop.core.delete = function(object, property) {
    var descriptor = Object.getOwnPropertyDescriptor(object, property);
    if (descriptor && descriptor.configurable) {
        
        var objectTarget = dop.getObjectTarget(object),
            objectProxy = dop.getObjectProxy(object),
            path,
            oldValue = objectTarget[property],
            deleted = delete objectTarget[property];

        if ((objectTarget===objectProxy || object===objectProxy) && (path = dop.getObjectPath(object)))
            dop.core.storeMutation({
                object: dop.getObjectProxy(objectTarget),
                prop: String(property),
                path: path,
                oldValue: dop.util.clone(oldValue)
            });

        // needed for dop.core.proxyObjectHandler.deleteProperty
        return deleted;
    }
};




//////////  src/core/mutators/pop.js

dop.core.pop = function(array) {
    if (array.length === 0)
        return undefined;
    var spliced = dop.core.splice(array, [array.length-1, 1]);
    return spliced[0];
};




//////////  src/core/mutators/push.js
// https://jsperf.com/push-against-splice OR https://jsperf.com/push-vs-splice
dop.core.push = function(array, items) {
    if (items.length === 0)
        return array.length;
    items.unshift(array.length, 0);
    dop.core.splice(array, items);
    return array.length;
};




//////////  src/core/mutators/reverse.js
// https://jsperf.com/array-reverse-algorithm
dop.core.reverse = function(array) {

    var objectTarget = dop.getObjectTarget(array),
        objectProxy = dop.getObjectProxy(array),
        path;

    if ((objectTarget===objectProxy || array===objectProxy) && (path = dop.getObjectPath(array))) {

        var total = objectTarget.length/2,
            index = 0,
            indexr,
            tempItem,
            swaps = [];

        for (;index<total; ++index) {
            indexr = objectTarget.length-index-1;
            if (index !== indexr) {
                tempItem = objectTarget[indexr];
                objectTarget[indexr] = objectTarget[index];
                objectTarget[index] = tempItem;
                swaps.push(index, indexr);
            }
        }


        if (swaps.length>0)
            dop.core.storeMutation({
                object: objectProxy,
                prop: dop.getObjectProperty(array),
                path: path,
                swaps: swaps
            });
    }
    else
        Array.prototype.reverse.call(objectTarget);

    return array;
};




//////////  src/core/mutators/set.js

dop.core.set = function(object, property, value, options) {

    if (!isObject(options))
        options = {}

    options.deep = typeof options.deep == 'boolean' ? options.deep : true
    options.shadow = typeof options.shadow == 'boolean' ? options.shadow : false

    // If is a different value
    if (object[property] !== value) {

        var descriptor = Object.getOwnPropertyDescriptor(object, property);

        if (!descriptor || (descriptor && descriptor.writable)) {
            var objectTarget = dop.getObjectTarget(object),
                objectProxy = dop.getObjectProxy(object),
                oldValue = objectTarget[property],
                length = objectTarget.length,
                isNewProperty = !objectTarget.hasOwnProperty(property),
                objectIsArray = isArray(objectTarget),
                path;
            
            // if (objectIsArray)
            //     property = Number(property);

            // object or array
            if (options.deep && dop.isObjectRegistrable(value) && !(dop.isRegistered(value) && dop.getObjectParent(value) === objectProxy))
                objectTarget[property] = dop.core.configureObject(value, property, objectProxy);
            // computed value
            else if (isFunction(value) && value._name==dop.cons.COMPUTED_FUNCTION)
                objectTarget[property] = value(objectTarget, property, false, oldValue);
            // other
            else
                objectTarget[property] = value;

            if (
                !options.shadow &&
                (objectTarget===objectProxy || object===objectProxy) &&
                !(isFunction(oldValue) && isFunction(value)) &&
                (path = dop.getObjectPath(object))
            ) {
                var mutation = {
                    object: objectProxy,
                    prop: objectIsArray ? String(property) : property,
                    path: path,
                    value: dop.util.clone(value)
                };
                if (!isNewProperty)
                    mutation.oldValue = dop.util.clone(oldValue)

                dop.core.storeMutation(mutation);

                // If is array and length is different we must store the length 
                if (property !== 'length' && objectTarget.length !== length && objectIsArray)
                    dop.core.storeMutation({
                        object: objectProxy,
                        prop: 'length',
                        path: path,
                        value: objectTarget.length,
                        oldValue: length
                    });
            }
        }
    }
};




//////////  src/core/mutators/shift.js

dop.core.shift = function(array) {
    if (array.length === 0)
        return undefined;
    var spliced = dop.core.splice(array, [0, 1]);
    return spliced[0];
};




//////////  src/core/mutators/sort.js
// http://stackoverflow.com/a/234777/1469219 http://stackoverflow.com/a/38905402/1469219
// https://en.wikipedia.org/wiki/Sorting_algorithm#Stability
// http://khan4019.github.io/front-end-Interview-Questions/sort.html#bubbleSort
// https://github.com/benoitvallon/computer-science-in-javascript/tree/master/sorting-algorithms-in-javascript
dop.core.sort = function(array, compareFunction) {
    var objectTarget = dop.getObjectTarget(array),
        objectProxy = dop.getObjectProxy(array),
        copy = objectTarget.slice(0),
        output, swaps, path;

    output = Array.prototype.sort.call(objectTarget, compareFunction);

    if ((objectTarget===objectProxy || array===objectProxy) && (path = dop.getObjectPath(array))) {
        swaps = dop.core.sortDiff(objectTarget, copy);
        if (swaps.length>1)
            dop.core.storeMutation({
                object: dop.getObjectProxy(array),
                prop: dop.getObjectProperty(array),
                path: path,
                swaps: swaps
            });
    }

    return output;
};


dop.core.sortDiff = function (array, copy) {

    var total = copy.length,
        swaps = [],
        index1 = 0,
        index2, tmp;

    for (;index1<total; ++index1) {
        if (array[index1] !== copy[index1]) {
            index2 = copy.indexOf(array[index1]);
            tmp = copy[index1];
            copy[index1] = copy[index2];
            copy[index2] = tmp;
            swaps.push(index1, index2);
        }
    }

    return swaps;
};




// function diffArray(array) {
//     var copy = array.slice(0),
//         swaps = [],
//         index = 0,
//         total = copy.length,
//         indexNew, tmp;

//     array.sort();

//     for (;index<total; ++index) {
//         if (copy[index] !== array[index]) {
//             indexNew = copy.indexOf(array[index]);
//             tmp = copy[index];
//             copy[index] = copy[indexNew];
//             copy[indexNew] = tmp;
//             swaps.push([index, indexNew]);
            
//             console.log([index, indexNew], copy );
//             if (indexNew < index) {
//                 console.log( 'lol' );
//             }
            
//             // swapeds[indexNew] = true;
//             // if (indexCache!==indexNew && indexCache !== index) {
//             //     swapeds[indexCache] = true;
//             //     swap(copy, indexNew, indexCache);
//             //     swaps.push([indexNew, indexCache]);
//             //     console.log([indexNew, indexCache], copy, swapeds );
//             // }
//         }
//     }

//     return swaps;
// }




//////////  src/core/mutators/splice.js

dop.core.splice = function(array, args) {

    var objectTarget = dop.getObjectTarget(array),
        objectProxy = dop.getObjectProxy(array),
        originalLength = objectTarget.length,
        spliced,
        path;

    // Splicing!!
    spliced = Array.prototype.splice.apply(objectTarget, args);

    // If enviroment do not allow proxies (objectTarget and objectProxy are same object in that case) 
    // or if the array is the proxy itself
    path = dop.getObjectPath(array)
    if (path) {

        var argslength = args.length,
            length = objectTarget.length,
            index=2,
            start = Number(args[0]),
            // deleteCount = (Number(args[1])>0) ? args[1] : 0,
            itemslength = (args.length>2) ? (args.length-2) : 0,
            item;


        // Defaults for start
        if (isNaN(start))
            start = 0;
        else if (start<0)
            start = (length+start < 0) ? 0 : length+start;
        else if (start>originalLength)
            start = originalLength;


        // // We dont need update becase no items remaining after splice
        // end = (argslength===1) ? 0 :
        //     // If deleteCount is the same of items to add means the new lengh is the same and we only need to update the new elements
        //     (argslength>2 && deleteCount===itemslength) ?
        //         start+deleteCount
        //     :
        //         objectTarget.length;


        // We must register new objects
        for (;index<argslength; ++index, ++start) {
            item = args[index];
            if (dop.isObjectRegistrable(item))
                objectTarget[start] = dop.core.configureObject(
                    item,
                    start,
                    objectProxy
                );
        }

        // Storing mutation
        if ((objectTarget===objectProxy || array===objectProxy) && (originalLength!==length || itemslength>0)) {
            if (args[0]<0)
                args[0] = array.length+args[0];
            var mutation = {
                object: objectProxy,
                prop: dop.getObjectProperty(array),
                path: path,
                splice: args
            };

            if (spliced.length > 0)
                mutation.spliced = dop.util.clone(spliced);

            if (length !== originalLength)
                mutation.oldLength = originalLength;

            dop.core.storeMutation(mutation);
        }

    }

    return spliced;
};




//////////  src/core/mutators/swap.js

dop.core.swap = function(array, swaps) {
    var objectTarget = dop.getObjectTarget(array),
        objectProxy = dop.getObjectProxy(array);

    var result = dop.util.swap(objectTarget, swaps);

    if (objectTarget===objectProxy || array===objectProxy)
        dop.core.storeMutation({
            object: objectProxy,
            prop: dop.getObjectProperty(array),
            path: dop.getObjectPath(array),
            swaps: swaps.slice(0)
        });

    return result;
};




//////////  src/core/mutators/unshift.js

dop.core.unshift = function(array, items) {
    if (items.length === 0)
        return array.length;
    items.unshift(0, 0);
    dop.core.splice(array, items);
    return array.length;
};





//////////  src/core/objects/configureObject.js

var canWeProxy = typeof Proxy == 'function';
dop.core.configureObject = function(object, propertyParent, parent) {

    // Creating a copy if is another object registered
    if (dop.isRegistered(object))
        return dop.core.configureObject(
            dop.util.clone(object),
            propertyParent,
            parent
        );

    // // Removing fake dop property
    // delete object[dop.cons.DOP];


    // Setting ~DOP object
    var object_dop = {}, object_proxy, object_target;
    object_dop._ = parent; // parent
    object_dop.pr = isArray(parent) ? Number(propertyParent) : propertyParent; // property
    
    // Making proxy object
    if (canWeProxy) {
        object_proxy = object_dop.p = new Proxy(object, dop.core.proxyObjectHandler);
        object_target = object_dop.t = object;
    }
    else
        object_proxy = object_target = object_dop.p = object_dop.t = object;

    // root
    object_dop.r = (parent === undefined) ? object_proxy : dop.getObjectDop(parent).r;
    


    // // Object parent level and more
    // if (parent === undefined) {
    //     object_dop.r = object_proxy;  // root
    //     object_dop.l = 1; // deep level [1,"prop","arr"] this is level 3
    //     object_dop.ia = false; // is inside of array
    // }
    // else {
    //     var object_dop_parent = dop.getObjectDop(parent);
    //     object_dop.l = object_dop_parent.l+1;  // deep level [1,"prop","arr"] this is level 3
    //     object_dop.ia = (object_dop_parent.ia || isArray(parent)); // is inside of array
    // }


    Object.defineProperty(object_target, dop.cons.DOP, {
        value:object_dop,
        enumerable:false,
        configurable:false,
        writable:false
    });


    // Deep objects (Recursion)
    var property, 
        value,
        path,
        is_array = isArray(object_target),
        is_function;

    for (property in object_target) {
        if (is_array)
            property = Number(property);
        value = object_target[property];
        is_function = isFunction(value);
        // remote function
        if (is_function && value._name==dop.cons.REMOTE_FUNCTION_UNSETUP) {
            path = dop.getObjectPath(object);
            object_target[property] = value(path[0], path.slice(1).concat(property));
        }
        // storing computed value function
        else if (is_function && value._name==dop.cons.COMPUTED_FUNCTION)
            object_target[property] = value(object_proxy, property, false, undefined);
        // object or array
        else if (dop.isObjectRegistrable(value))
            object_target[property] = dop.core.configureObject(value, property, object_proxy);
    }


    // if (isObject(parent))
        // object_dop._ = (dop.isRegistered(parent)) ? dop.getObjectTarget(parent) : parent;

    // Adding traps for mutations methods of arrays
    if (dop.util.typeof(object_target) == 'array')
        Object.defineProperties(object_target, dop.core.proxyArrayHandler);


    return object_proxy;
};




//////////  src/core/objects/createCollector.js

dop.core.createCollector = function(queue, index) {
    var collector = new dop.core.collector(queue, index);
    return collector;
};




//////////  src/core/objects/createComputed.js

dop.core.createComputed = function (object, prop, f, shallWeSet, oldValue) {
    var data_path = dop.data.path,
        value,
        computed_id = dop.data.computed_inc++,
        computed = {
            object_root: dop.getObjectRoot(object),
            prop: prop,
            function: f,
            derivations: []
        },
        path = dop.getObjectPath(object, false);

    computed.path = path.slice(1);
    computed.pathid = dop.core.getPathId(path.concat(prop));

    if (data_path[computed.pathid] === undefined)
        data_path[computed.pathid] = {};
    
    if (data_path[computed.pathid].computeds === undefined)
        data_path[computed.pathid].computeds = [];

    dop.data.computed[computed_id] = computed;
    value = dop.core.updateComputed(computed_id, computed, object, oldValue);

    // Setting value
    if (shallWeSet)
        dop.core.set(object, prop, value);

    return value;
};




//////////  src/core/objects/emitToObservers.js

dop.core.emitToObservers = function(mutations) {

    var mutation,
        path_id,
        observer_id,
        mutationsToEmitByIdObserver = {},
        mutationsWithSubscribers = false,
        data_path = dop.data.path,
        index = 0,
        total = mutations.length;

    for (;index<total; ++index) {
        mutation = mutations[index];
        path_id = mutation.path_id;

        if (!mutationsWithSubscribers && isObject(dop.data.object[dop.getObjectId(mutation.object)]))
            mutationsWithSubscribers = true;

        // .observers
        if (data_path[path_id] !== undefined && data_path[path_id].observers !== undefined) {
            for (observer_id in data_path[path_id].observers) {
                if (mutationsToEmitByIdObserver[observer_id] === undefined)
                    mutationsToEmitByIdObserver[observer_id] = [];
                mutationsToEmitByIdObserver[observer_id].push(mutation);
            }
        }

        // .observers_prop
        if (mutation.swaps === undefined) { // If mutation is swaps type we should skip because does not have observers_prop and also the length never changes
            path_id += dop.core.pathSeparator(mutation.splice===undefined ? mutation.prop : 'length');
            if (data_path[path_id] !== undefined && data_path[path_id].observers_prop !== undefined) {
                for (observer_id in data_path[path_id].observers_prop) {
                    if (mutationsToEmitByIdObserver[observer_id] === undefined)
                        mutationsToEmitByIdObserver[observer_id] = [];
                    // We have to check this because we dont want to duplicate
                    if (mutationsToEmitByIdObserver[observer_id].indexOf(mutation) == -1)
                        mutationsToEmitByIdObserver[observer_id].push(mutation);
                }
            }
        }

    }

    // Emiting
    for (observer_id in mutationsToEmitByIdObserver) {
        var observer = dop.data.observers[observer_id];
        if (observer !== undefined) // We need to make sure that the observer still exists, because maybe has been removed after calling previous observers
            observer.callback(mutationsToEmitByIdObserver[observer_id]);
    }

    return mutationsWithSubscribers;
};




//////////  src/core/objects/getMutationInverted.js

dop.core.getMutationInverted = function(mutation) {

    var mutationInverted = {
        object: mutation.object,
        path: mutation.path,
        prop: mutation.prop
    };

    // splice
    if (mutation.splice !== undefined) {
        var splice = mutation.splice,
            spliced = (mutation.spliced === undefined) ? [] : mutation.spliced;

        mutationInverted.splice = [splice[0], splice.length-2];
        Array.prototype.push.apply(mutationInverted.splice, spliced);

        mutationInverted.spliced = splice.slice(2);
        if (mutationInverted.spliced.length === 0)
            delete mutationInverted.spliced;
    }

    // swaps
    else if (mutation.swaps !== undefined)
        mutationInverted.swaps = mutation.swaps.slice(0).reverse();

    // new value
    else if (!mutation.hasOwnProperty('oldValue'))
        mutationInverted.oldValue = mutation.value;

    // delete
    else if (!mutation.hasOwnProperty('value'))
        mutationInverted.value = mutation.oldValue;

    // set
    else {
        mutationInverted.oldValue = mutation.value;
        mutationInverted.value = mutation.oldValue;
    }

    return mutationInverted;
};




//////////  src/core/objects/getPatch.js

dop.core.getPatch = function(mutations, isUnpatch) {

    var patchs = {},
        index = 0,
        total = mutations.length,
        mutation,
        object_id;

    for (;index<total; ++index) {
        mutation = isUnpatch ? dop.core.getMutationInverted(mutations[index]) : mutations[index];
        object_id = dop.getObjectId(mutation.object);
        if (patchs[object_id] === undefined)
            patchs[object_id] = {chunks:[{}], object:dop.getObjectRoot(mutation.object)};
        dop.core.injectMutationInPatch(patchs[object_id], mutation);
        // console.log(JSON.stringify(patchs[object_id].chunks))
    }

    return patchs;
};



// dop.core.objectIsStillStoredOnPath = function(object) {

//     var path = dop.getObjectDop(object),
//         index = path.length-1,
//         parent;

//     for (;index>0; --index) {
//         // parent = (index>1) ? dop.getObjectDop(object)._ : dop.data.object[path[0]];
//         if (index>1) {
//             parent = dop.getObjectParent(object);
//             if (parent[path[index]] !== object)
//                 return false;
//             object = dop.getObjectProxy(parent);
//         }
//         // else
//             // return false;
//     }

//     return true;
// };




//////////  src/core/objects/getPathId.js

dop.core.getPathId = function(path) {

    var index = 0,
        total = path.length,
        path_id = '';

    for (; index<total; ++index)
        path_id += dop.core.pathSeparator(path[index]);

    return path_id;
};




//////////  src/core/objects/getUnpatch.js

dop.core.getUnpatch = function(mutations) {
    return dop.core.getPatch(mutations.slice(0).reverse(), true);
};




//////////  src/core/objects/injectMutationInPatch.js

dop.core.injectMutationInPatch = function(patch, mutation) {

    var prop = mutation.prop,
        path = mutation.path,
        value = mutation.value,
        isMutationSplice = mutation.splice!==undefined,
        isMutationSwaps = mutation.swaps!==undefined,
        isMutationArray = isMutationSplice || isMutationSwaps,
        typeofValue = dop.util.typeof(value),
        index = 1,
        chunk = patch.chunks[patch.chunks.length-1],
        chunkParent = chunk,
        chunkNext = {},
        chunkNextParent = chunkNext,
        chunkNextRoot = chunkNext,
        tofCurrentObject,
        specialInstruction,
        instructionsPatchs = dop.protocol.instructionsPatchs,
        isNewObject = false,
        isNewChunk = false,
        propPath,
        valueMerged,
        newSpecialInstruction;



    // Going deep
    for (;index<path.length; ++index) {

        propPath = path[index];
        chunkParent = chunk;
        chunkNextParent = chunkNext;
        chunkNext = chunkNext[propPath] = {};
        tofCurrentObject = dop.util.typeof(chunk[propPath]);


        if (tofCurrentObject == 'array') {
            specialInstruction = chunk[propPath];
            // Is a new object
            if (specialInstruction[0] === instructionsPatchs.object) {
                isNewObject = true;
                chunk = specialInstruction[1];
            }
            else if (!isMutationArray || (isMutationArray && index+1<path.length)) {
                isNewChunk = true;
                chunk = chunkNext;
                patch.chunks.push(chunkNextRoot);
            }
        }

        else if (!isNewChunk && isMutationArray && tofCurrentObject == 'object') {
            // isNewChunk = true;
            chunkParent = chunkNextParent;
            chunk = chunkNext; 
            patch.chunks.push(chunkNextRoot);
        }

        else if (tofCurrentObject == 'object')
            chunk = chunk[propPath];

        else
            chunk = chunk[propPath] = {};
    }


    /// INJECTING ///

    // Objects or array
    if (typeofValue == 'object' || typeofValue == 'array') {
        valueMerged = dop.util.merge(typeofValue == 'array' ? [] : {}, value);
        if (isNewObject)
            chunk[prop] = valueMerged;
        else {
            chunk[prop] = [
                instructionsPatchs.object,
                valueMerged
            ];
        }
    }


    // Mutations over arrays
    else if (isMutationArray) {
        if (isNewObject)
            (isMutationSplice) ?
                Array.prototype.splice.apply(chunk, mutation.splice.slice(0))
            :
                dop.util.swap(chunk, mutation.swaps.slice(0));

        else {
            newSpecialInstruction = (isMutationSplice) ?
                [instructionsPatchs.splice, mutation.splice.slice(0)]
            :
                [instructionsPatchs.swaps, mutation.swaps.slice(0)]

            if (!isArray(chunkParent[prop]))
                chunkParent[prop] = newSpecialInstruction;

            else {
                if (isNumber(chunkParent[prop][0]))
                    chunkParent[prop] = [chunkParent[prop]]

                chunkParent[prop].push(newSpecialInstruction)
            }
        }
    }


    // Others values
    else
        chunk[prop] = value;
};


// isCurrentNewObject
// isCurrentArrayMutation
// isValueNewObject
// isValueArrayMutation
// isTheLastOne
// isNewObject




//////////  src/core/objects/pathSeparator.js

dop.core.pathSeparator = function(property) {
    return property+'.'+property;
};




//////////  src/core/objects/proxyArrayHandler.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/prototype#Mutator_methods
dop.core.proxyArrayHandler = {
    splice: {value:function() {
        return dop.core.splice(this, Array.prototype.slice.call(arguments,0));
    }},
    shift: {value: function() {
        return dop.core.shift(this, Array.prototype.slice.call(arguments,0));
    }},
    pop: {value:function() {
        return dop.core.pop(this, Array.prototype.slice.call(arguments,0));
    }},
    push: {value:function() {
        return dop.core.push(this, Array.prototype.slice.call(arguments,0));
    }},
    unshift: {value:function() {
        return dop.core.unshift(this, Array.prototype.slice.call(arguments,0));
    }},
    reverse: {value:function() {
        return dop.core.reverse(this);
    }},
    sort: {value:function(compareFunction) {
        return dop.core.sort(this, compareFunction);
    }},
    /*fill: {value:function() {
        return dop.core.fill.apply(this, arguments);
    }},
    copyWithin: {value:function() {
        return dop.core.copyWithin.apply(this, arguments);
    }},*/
};




//////////  src/core/objects/proxyObjectHandler.js

dop.core.proxyObjectHandler = {
    set: function(object, property, value) {
        dop.core.set(dop.getObjectProxy(object), property, value);
        return true;
    },
    deleteProperty: function(object, property) {
        dop.core.delete(dop.getObjectProxy(object), property) !== undefined;
        return true;
    },
    get: function(object, property) {
        if (dop.data.gets_collecting && typeof property == 'string' && property !== dop.cons.DOP && object[property] !== Array.prototype[property])
            dop.data.gets_paths.push(dop.getObjectPath(object, false).concat(property));

        return object[property];
    }
};
            /*var gets_paths = dop.data.gets_paths,
                last_path = gets_paths[gets_paths.length-1],
                path = dop.getObjectPath(object).concat(property);

            if (gets_paths.length>0 && path.length>last_path.length)
                gets_paths.pop();
            
            gets_paths.push(path);*/





//////////  src/core/objects/runDerivations.js

dop.core.runDerivations = function(path_id) {
    if (dop.data.path[path_id] !== undefined && dop.data.path[path_id].derivations !== undefined) {
        var derivations = dop.data.path[path_id].derivations,
            computed,
            computed_id,
            object,
            total = derivations.length,
            index = 0;

        for (;index<total; ++index) {
            computed_id = derivations[index];
            computed = dop.data.computed[computed_id];
            object = dop.util.get(computed.object_root, computed.path);
            if (object !== undefined)
                dop.core.set(
                    object,
                    computed.prop,
                    // computed.function.call(object, object[computed.prop])
                    dop.core.updateComputed(computed_id, computed, object, object[computed.prop])
                );
        }
    }
};




//////////  src/core/objects/setPatch.js

dop.core.setPatch = function(object, patch, mutator) {
    if (!isArray(patch))
        patch = [patch];
    
    for (var index=0,total=patch.length; index<total; ++index)
        dop.util.path(patch[index], null, object, mutator);

    return object;
};


dop.core.setPatchFunctionMutator = function(destiny, prop, value, typeofValue, path){
    if (isFunction(value) && value._name==dop.cons.REMOTE_FUNCTION_UNSETUP)
        dop.set(destiny, prop, value(dop.getObjectId(destiny), path.slice(0)));
    else
        return dop.core.setPatchMutator(destiny, prop, value, typeofValue, path);
};


dop.core.setPatchMutator = function(destiny, prop, value, typeofValue) {
    var typeInstruction,
        instructionsPatchs = dop.protocol.instructionsPatchs,
        mutation;

    // console.log( prop, typeofValue, value );
    if (typeofValue == 'array') {
        typeInstruction = value[0];

        // New object/array
        if (typeInstruction === instructionsPatchs.object)
            dop.set(destiny, prop, dop.util.clone(value[1]));

        // Array mutations
        else if (isArray(destiny[prop])) {
            if (!isArray(typeInstruction))
                value = [value];

            for (var index=0,total=value.length; index<total; ++index) {
                mutation = value[index];

                // Splice
                if (mutation[0] === instructionsPatchs.splice)
                    dop.core.splice(destiny[prop], mutation[1]);

                else if (mutation[0] === instructionsPatchs.swaps)
                    dop.core.swap(destiny[prop], mutation[1]);
            }
        }

        return true; // Skiping to dont go inside of [instructionPatch, ...]
    }

    // Delete
    else if (typeofValue=='undefined')
        dop.del(destiny, prop);

    // Set value
    else if (typeofValue!='object')
        dop.set(destiny, prop, value);
};


    

    // // Array mutations
    // if (typeofValue=='object' && typeofDestiny=='array' && value.hasOwnProperty(dop.cons.DOP)) {

    //     var mutations = value[dop.cons.DOP],
    //         mutation,
    //         index=0,
    //         total=mutations.length,
    //         typeArrayMutation;

    //     // if (typeofDestiny!='array')
    //     //     dop.set(destiny, prop, []);

    //     for (;index<total; ++index) {
    //         typeArrayMutation = mutations[index][0]; // 0=swaps 1=splices
    //         mutation = mutations[index].slice(1);

    //         // swap
    //         if (typeArrayMutation===0)
    //             dop.core.swap(destiny[prop], mutation);

    //         // length
    //         else if (typeArrayMutation===2)
    //             dop.set(destiny[prop], 'length', mutation[0]);

    //         // splice & set & del
    //         else {
    //             // We have to update the length of the array in case that is lower than before
    //             if (destiny[prop].length<mutation[0])
    //                 dop.getObjectTarget(destiny[prop]).length = mutation[0];
                    
    //             // set
    //             if (mutation.length===3 && mutation[1]===1) {
    //                 (mutation[2] === undefined) ?
    //                     dop.del(destiny[prop], mutation[0])
    //                 :
    //                     dop.set(destiny[prop], mutation[0], mutation[2]);
    //             }

    //             // splice
    //             else
    //                 dop.core.splice(destiny[prop], mutation);
    //         }
    //     }

    //     // if (typeof value.length == 'number' && value.length>-1)
    //         // destiny[prop].length = value.length;

    //     return true; // Skiping to dont go inside of {~dop:...}
    // }

    // else //if (path.length > 1) {

    //     // Objects
    //     if (typeofValue=='object' && typeofDestiny!='object') //!destiny.hasOwnProperty(prop)
    //         dop.set(destiny, prop, {});

    //     // Arrays
    //     else if (typeofValue=='array' && typeofDestiny!='array')
    //         dop.set(destiny, prop, []);

    //     // Delete
    //     else if (typeofValue=='undefined')
    //         dop.del(destiny, prop);

    //     // Set value
    //     else if (typeofValue!='object')
    //         dop.set(destiny, prop, value);
    // //}





//////////  src/core/objects/storeMutation.js

dop.core.storeMutation = function(mutation) {

    var collectors = dop.data.collectors,
        paths = dop.data.path,
        index=0,
        total=collectors.length,
        path_id_parent,
        path_id;

    // Saving path_id
    path_id_parent = path_id = mutation.path_id = dop.core.getPathId(mutation.path);

    if (mutation.splice===undefined && mutation.swaps===undefined)
        path_id += dop.core.pathSeparator(mutation.prop);


    // Interceptors objects
    if (!dop.core.runInterceptors(paths[path_id_parent], 'interceptors', mutation))
        return


    // Interceptors properties
    if (!dop.core.runInterceptors(paths[path_id], 'interceptors_prop', mutation))
        return


    // Collectors
    for (;index<total; index++)
        if (collectors[index].add(mutation))
            return dop.core.runDerivations(path_id);


    var snapshot = new dop.core.snapshot([mutation]);
    snapshot.emit();

    dop.core.runDerivations(path_id);
};


dop.core.runInterceptors = function(interceptors, type, mutation) {
    if (interceptors && (interceptors=interceptors[type]) && interceptors.length>0)
        for (var index=0,total=interceptors.length; index<total; ++index)
            if (interceptors[index](mutation, dop.getObjectTarget(mutation.object)) !== true)
                return false;

    return true;
};


// dop.core.runInterceptors = function(interceptors, type, mutation) {
//     if (interceptors && (interceptors=interceptors[type]) && interceptors.length>0) {
//         for (var index=0,total=interceptors.length, tosplice=[]; index<total; ++index) {
//             if (interceptors[index] === undefined)
//                 tosplice.push(index);
//             else if (interceptors[index](mutation) !== true)
//                 return false;
//         }
//         for (index=0,total=tosplice.length; index<total; ++index)
//             tosplice.splice(tosplice[index], 1);
//     }

//     return true;
// };





//////////  src/core/objects/updateComputed.js

dop.core.updateComputed = function (computed_id, computed, context, oldValue) {

    var data_path = dop.data.path,
        derived_paths,
        derived_pathsids = computed.derivations,
        derived_path,
        derived_pathid,
        value,
        index = 0,
        total,
        index2,
        total2;


    // Running function and saving paths from getters
    dop.data.gets_collecting = true;
    value = computed.function.call(context, oldValue);
    dop.data.gets_collecting = false;
    derived_paths = dop.data.gets_paths;
    dop.data.gets_paths = [];


    // Generating and storing paths ids
    for (total=derived_paths.length; index<total; ++index) {
        derived_path = derived_paths[index];
        derived_pathid = '';
        for (index2=0,total2=derived_path.length; index2<total2; ++index2) {
            derived_pathid += dop.core.pathSeparator(derived_path[index2]);
            if (index2>0) {
                if (data_path[derived_pathid] === undefined)
                    data_path[derived_pathid] = {};
                
                if (data_path[derived_pathid].derivations === undefined)
                    data_path[derived_pathid].derivations = [];
                
                if (data_path[derived_pathid].derivations.indexOf(computed_id) < 0) {
                    data_path[derived_pathid].derivations.push(computed_id);
                    derived_pathsids.push(derived_pathid);
                }
            }
        }
    }


    // Storing computed in dop.data 
    if (data_path[computed.pathid].computeds.indexOf(computed_id) === -1)
        data_path[computed.pathid].computeds.push(computed_id);


    return value;
};





//////////  src/core/protocol/connector.js

dop.core.connector = function(args) {
    var node = new dop.core.node();
    args.unshift(dop, node);
    node.options = args[2];
    node.transport = node.options.transport;
    node.options.transport.apply(this, args);
    return node;
};





//////////  src/core/protocol/createAsync.js

dop.core.createAsync = function() {
    var resolve, reject,
    promise = new Promise(function(res, rej) {
        resolve = res;
        reject = rej;
    });
    promise.resolve = resolve;
    promise.reject = reject;
    return promise;
};



// mypromise = dop.core.createAsync();
// mypromise.then(function(v) {
//     console.log('yeah',v)
// });
// setTimeout(function() {
//     mypromise.resolve(1234567890)
// },1000);


// dop.core.createAsync = function() {
//     var observable = Rx.Observable.create(function(observer) {
//         observable.resolve = function(value) {
//             observer.onNext(value);
//             observer.onCompleted();
//         };
//         observable.reject = observer.onError;
//     });
//     return observable;
//     // return {stream:observable,resolve:observer.onNext,reject:observer.onError,cancel:cancel};
// };
// mypromise = dop.core.createAsync();
// mypromise.subscribe(function(v) {
//     console.log('yeah',v);
// });
// setTimeout(function() {
//     mypromise.resolve(1234567890);
// },1000);




// https://github.com/ReactiveX/rxjs/issues/556
// function getData(num) {
//   return new Promise((resolve, reject) => {
//     resolve(num + 1);
//   });
// }

// async function create() {
//   var list = await Rx.Observable.range(1, 5)
//     .flatMap(num => getData(num))
//     .toArray().toPromise();

//   return list;
// }

// console.clear();

// Rx.Observable.fromPromise(create()).subscribe(list => {
//   console.log(list);
// }, err => {
//   console.log(err);
// });





//////////  src/core/protocol/createRemoteFunction.js

dop.core.createRemoteFunction = function(node) {
    var f = function (object_id, path) {
        // // http://jsperf.com/dynamic-name-of-functions
        // return new Function(
        //     "var a=arguments;return function " + path[path.length-1] + "(){return a[0](a[1], a[2], a[3], arguments)}"
        // )(dop.protocol.call, node, object_id, path)
        var f2 = function $DOP_REMOTE_FUNCTION() {
            return dop.protocol.call(node, object_id, path, arguments);
        }
        f2._name = dop.cons.REMOTE_FUNCTION
        return f2;
    }
    f._name = dop.cons.REMOTE_FUNCTION_UNSETUP;
    return f;
};





//////////  src/core/protocol/createRequest.js

dop.core.createRequest = function(node) {
    var request_id = node.request_inc++,
        request = Array.prototype.slice.call(arguments, 1);

    node.requests[request_id] = request;
    request.unshift(request_id);
    request.promise = dop.core.createAsync();

    return request;
};




//////////  src/core/protocol/createResponse.js

dop.core.createResponse = function() {
    arguments[0] = arguments[0]*-1;
    return Array.prototype.slice.call(arguments, 0);
};




//////////  src/core/protocol/decode.js
var regexpdate = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/,
    regexpsplit = /\/(.+)\/([gimuy]{0,5})/;

dop.core.decode = function(property, value, node, undefineds) {

    if (typeof value == 'string') {

        if (value == dop.protocol.instructionsPatchs.function)
            return dop.core.createRemoteFunction(node);

        if (value == dop.protocol.instructionsPatchs.undefined && isObject(undefineds)) {
            undefineds.push([this, property]); // http://stackoverflow.com/questions/17648150/how-does-json-parse-manage-undefined
            return undefined;
        }

        if (value == dop.protocol.instructionsPatchs.infinity)
            return Infinity;

        if (value == dop.protocol.instructionsPatchs._infinity)
            return -Infinity;

        if (value == dop.protocol.instructionsPatchs.nan)
            return NaN;

        if (regexpdate.exec(value))
            return new Date(value);

        if (value.substr(0,2) == dop.protocol.instructionsPatchs.regex) {
            var split = regexpsplit.exec(value.substr(2)); // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/RegExp
            return new RegExp(split[1], split[2]);
        }

        if (value[0] == '~') // https://jsperf.com/charat-vs-index/5
            return value.substring(1);


    }

    return value;

};






//////////  src/core/protocol/deleteRequest.js

dop.core.deleteRequest = function(node, request_id) {
    clearTimeout(node.requests[request_id].timeout);
    delete node.requests[request_id];
};





//////////  src/core/protocol/emitNodes.js

dop.core.emitNodes = function(patch) {
    var object_id, node_token, node, object_data, chunks;
    for (object_id in patch) {
        if (isObject(dop.data.object[object_id])) {
            object_data = dop.data.object[object_id];
            for (node_token in object_data.node) {
                if (object_data.node[node_token].subscriber===1) {
                    node = dop.data.node[node_token];
                    chunks = patch[object_id].chunks;
                    dop.protocol.patch(node, Number(object_id), chunks.length>1 ? chunks : chunks[0]);
                }
            }
        }
    }
};




//////////  src/core/protocol/encode.js

dop.core.encode = function(property, value) {

    var tof = typeof value;

    if (tof == 'undefined') // http://stackoverflow.com/questions/17648150/how-does-json-parse-manage-undefined
        return dop.protocol.instructionsPatchs.undefined;

    if (tof == 'string' && value[0] == '~')
        return '~'+value;
    
    if (tof == 'number' && isNaN(value))
        return dop.protocol.instructionsPatchs.nan;

    if (tof == 'object' && value instanceof RegExp)
        return dop.protocol.instructionsPatchs.regex + value.toString();

    if (value === Infinity)
        return dop.protocol.instructionsPatchs.infinity;

    if (value === -Infinity)
        return dop.protocol.instructionsPatchs._infinity;

    return value;
};


// // Extending example
// var encode = dop.core.encodeUtil;
// dop.core.encodeUtil = function(property, value) {
//     if (typeof value == 'boolean')
//         return '~BOOL';
//     return encode(property, value);
// };






//////////  src/core/protocol/encodeFunction.js

dop.core.encodeFunction = function(property, value) {
    return (isFunction(value) && !dop.isBroadcastFunction(value)) ? 
        dop.protocol.instructionsPatchs.function
    : 
        dop.core.encode(property, value);
};




//////////  src/core/protocol/getRejectError.js

dop.core.getRejectError = function(error) {
    if (typeof error == 'number' && dop.core.error.reject_remote[error] !== undefined) {
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift(dop.core.error.reject_remote[error]);
        return dop.util.sprintf.apply(this, args);
    }
    return error;  
};




//////////  src/core/protocol/localProcedureCall.js

dop.core.localProcedureCall = function(f, args, resolve, reject, configureReq, scope) {
    var req = dop.core.createAsync(), output;
    if (isFunction(configureReq))
        req = configureReq(req);

    args.push(req);
    req.then(resolve).catch(reject);
    output = f.apply(scope||req, args);

    // Is sync
    if (output !== req)
        req.resolve(output);
};




//////////  src/core/protocol/multiEncode.js

// dop.core.multiEncode = function() {
//     var encoders = arguments,
//         length = encoders.length, v;
//     return function recursion(property, value, index) {
//         if (index>=length)
//             return value;
//         else if (index === undefined) {
//             v = value;
//             index = 0;
//         }
//         v = encoders[index](property, value);
//         return (v!==value) ? v : recursion(property, value, index+1);
//     }
// };




//////////  src/core/protocol/registerNode.js

dop.core.registerNode = function(node) {
    dop.data.node[node.token] = node;
};




//////////  src/core/protocol/registerObjectToNode.js

dop.core.registerObjectToNode = function(node, object) {

    var object_id = dop.getObjectId(object), object_data;

    if (dop.data.object[object_id] === undefined)
        dop.data.object[object_id] = {
            object: object,
            nodes_total: 0,
            node: {}
        };
    
    object_data = dop.data.object[object_id];

    if (object_data.node[node.token] === undefined) {
        object_data.nodes_total += 1;
        object_data.node[node.token] = {
            subscriber: 0, // 0 or 1 || false true 
            owner: 0, // object_id_owner || 0 === false
            version: 0, // incremental integer for new patches
            pending: [],
            applied_version: 0, // last patch version applied correctly
            applied: {}
        };
    }

    return object_data;
};




//////////  src/core/protocol/registerOwner.js

dop.core.registerOwner = function(node, object, object_owner_id) {
    var object_data = dop.core.registerObjectToNode(node, object),
        object_id = dop.getObjectId(object_data.object);
    object_data.node[node.token].owner = object_owner_id;
    node.owner[object_owner_id] = object_id;
};




//////////  src/core/protocol/registerSubscriber.js

dop.core.registerSubscriber = function(node, object) {
    var object_data = dop.core.registerObjectToNode(node, object),
        object_id = dop.getObjectId(object_data.object);
    node.subscriber[object_id] = true;
    if (object_data.node[node.token].subscriber)
        return false;
    else {
        object_data.node[node.token].subscriber = 1;
        return true;
    }
};




//////////  src/core/protocol/sendMessages.js

dop.core.sendMessages = function(node) {
    var total = node.message_queue.length;
    if (total>0 && node.connected) {
        var index = 0,
            messages_wrapped = [],
            message_string,
            message,
            request_id;
        
        for (;index<total; ++index) {
            message = node.message_queue[index][0];
            messages_wrapped.push( node.message_queue[index][1](message) );
            request_id = message[0]
            // If is a request (not a response) we set a timeout
            if (request_id>0) {
                var nameinstruction = dop.protocol.instructions[message[1]];
                message.timeout = setTimeout(function() {
                    // if (node.requests[request_id] !== undefined) {
                        dop.protocol['on'+nameinstruction+'timeout'](node, request_id, message);
                        delete node.requests[request_id];
                    // }
                }, dop.protocol.timeouts[nameinstruction]);
            }
        }

        
        message_string = (index>1) ? '['+messages_wrapped.join(',')+']' : messages_wrapped[0];

        node.message_queue = [];
        node.send(message_string);
    }
};




//////////  src/core/protocol/setSocketToNode.js

dop.core.setSocketToNode = function(node, socket) {
    node.socket = socket;
    socket[dop.cons.TOKEN] = node.token;
};




//////////  src/core/protocol/storeMessage.js

dop.core.storeMessage = function(node, message, wrapper) {
    if (typeof wrapper != 'function')
        wrapper = dop.encode;
    node.message_queue.push([message, wrapper]);
};




//////////  src/core/protocol/storeSendMessages.js

dop.core.storeSendMessages = function(node, message, wrapper) {
    dop.core.storeMessage(node, message, wrapper);
    dop.core.sendMessages(node);
};




//////////  src/core/protocol/unregisterNode.js

dop.core.unregisterNode = function(node) {
    var object_id, object_owner_id, object_data;
    // Removing subscriber objects
    for (object_id in node.subscriber) {
        object_data = dop.data.object[object_id];
        if (object_data !== undefined && object_data.node[node.token] !== undefined) {
            object_data.nodes_total -= 1;
            delete object_data.node[node.token];
        }
    }
    // Removing owner objects
    for (object_owner_id in node.owner) {
        object_id = node.owner[object_owner_id];
        object_data = dop.data.object[object_id];
        if (object_data !== undefined && object_data.node[node.token] !== undefined) {
            object_data.nodes_total -= 1;
            delete object_data.node[node.token];
        }
    }
    // Deleting object data if not more nodes are depending
    if (object_data!==undefined && object_data.nodes_total === 0)
        delete dop.data.object[object_id];
    delete dop.data.node[node.token];
};




//////////  src/protocol/_onbroadcast.js

dop.protocol._onbroadcast = function(node, request_id, request, response) {
    dop.protocol._oncall(node, request_id, request, response);
};




//////////  src/protocol/_oncall.js

dop.protocol._oncall = function(node, request_id, request, response) {
    var rejection = response[0],
        promise = request.promise;
    if (rejection !== undefined) {
        if (rejection === 0)
            promise.resolve(response[1]);
        else if (rejection===dop.core.error.reject_remote.CUSTOM_REJECTION)
            promise.reject(response[1]);
        else
            promise.reject(dop.core.getRejectError(rejection));
    }
};




//////////  src/protocol/_onpatch.js

dop.protocol._onpatch = function(node, request_id, request, response) {
    var rejection = response[0],
        object_id = request[2],
        object_node = dop.data.object[object_id].node[node.token],
        version = request[3],
        pending_list = object_node.pending,
        promise = request.promise,
        index = 0,
        total = pending_list.length,
        version_item;


    if (rejection !== undefined) {
        if (rejection === 0) {
            for (;index<total; index++) {
                version_item = pending_list[index][0];
                // Removing from pending because its been received correctly
                if (version_item >= version) {
                    if (version_item === version)
                        pending_list.splice(index, 1);
                    break;
                }
                // Resending
                else
                    dop.protocol.patchSend(node, object_id, version_item, pending_list[index][1]);
            }
            promise.resolve(response[1]);
        }
        else
            promise.reject(dop.core.getRejectError(rejection));
    }
};




//////////  src/protocol/_onsubscribe.js

dop.protocol._onsubscribe = function(node, request_id, request, response) {

    if (response[0] !== undefined) {

        if (response[0] !== 0)
            request.promise.reject(dop.core.getRejectError(response[0]));

        else {
            var object_owner_id = response[1],
                object_owner = response[2],
                object_path = isArray(object_owner) ? object_owner : [],
                object, collector;

            // New object
            if (node.owner[object_owner_id] === undefined) {

                // If is new object and third parameter is an array we must reject
                if (object_owner===object_path)
                    request.promise.reject(dop.core.error.reject_local.OBJECT_NOT_FOUND);

                collector = dop.collect();
                if (dop.isRegistered(request.into))
                    object = dop.core.setPatch(request.into, object_owner, dop.core.setPatchFunctionMutator);
                else
                    object = dop.register((request.into===undefined) ? 
                        object_owner
                    :
                        dop.core.setPatch(request.into, object_owner, dop.core.setPatchMutator)
                    );
                dop.core.registerOwner(node, object, object_owner_id);
                collector.emit();
            }
            // Already registered
            else
                object = dop.data.object[node.owner[object_owner_id]].object;

            object = dop.util.get(object, object_path);

            if (!isObject(object))
                request.promise.reject(dop.core.error.reject_local.OBJECT_NOT_FOUND);
            else
                request.promise.resolve(dop.getObjectProxy(object));
            
        }
    }
};




//////////  src/protocol/_onunsubscribe.js

dop.protocol._onunsubscribe = function(node, request_id, request, response) {

    if (response[0] !== undefined) {
        if (response[0] !== 0)
            request.promise.reject(response[0]);
        else {
            var object_owner_id = request[2],
                object_id = node.owner[object_owner_id],
                object_data = dop.data.object[object_id];

            if (isObject(object_data) && isObject(object_data.node[node.token]) && object_data.node[node.token].owner===object_owner_id) {
                var roles = object_data.node[node.token];
                roles.owner = 0;

                if (roles.subscriber === 0)
                    object_data.nodes_total -= 1;

                if (object_data.nodes_total === 0)
                    delete dop.data.object[object_id];
                
                request.promise.resolve();
            }
        }
    }
};




//////////  src/protocol/broadcast.js

dop.protocol.broadcast = function(object_id, path, params) {

    var object_data = dop.data.object[object_id],
        promises = [];

    if (isObject(object_data) && isObject(object_data.node)) {
        var token, node, request, 
            nodes = object_data.node;
        params = Array.prototype.slice.call(params, 0);
        for (token in nodes) {
            if (nodes[token].subscriber === 1) {
                node = dop.data.node[token];
                request = dop.core.createRequest(
                    node,
                    dop.protocol.instructions.broadcast,
                    object_id,
                    path,
                    params
                );
                request.promise.node = node;
                dop.core.storeSendMessages(node, request);
                promises.push(request.promise);
            }
        }
    }
    
    return promises;
};




//////////  src/protocol/call.js

dop.protocol.call = function(node, object_id, path, params) {

    var object_data = dop.data.object[object_id];

    if (isObject(object_data) && isObject(object_data.node[node.token]) && object_data.node[node.token].owner>0) {
        params = Array.prototype.slice.call(params, 0);
        var request = dop.core.createRequest(
            node,
            dop.protocol.instructions.call,
            object_data.node[node.token].owner,
            path,
            params
        );
        dop.core.storeSendMessages(node, request);
        return request.promise;
    }
    else
        return Promise.reject(dop.core.error.reject_local.NODE_NOT_FOUND);
};




//////////  src/protocol/instructions.js

dop.protocol.instructions = {


    // [<request_id>, <instruction>, <params...>]
    // If <request_id> it's greater than 0 is a request, if is less than 0 then is the response of the request.

    // Is possible send multiple requests in one message, just wrapping it in an Array. But the order of the responses is not determined. Which means the response of request_idTwo could be resolved before request_idOne
    // [[<request_id1>, <instruction>, <params...>], [<request_id2>, <instruction>, <params...>]]

    // Is possible send one request with multiple instructions. The response will be recieved when all the requests are resolved. The response could be only one. But if the response is multiple has to respect the order
    // [<request_id>, [<instruction>, <params...>], [<instruction>, <params...>]]

    // If the response has a 0 as second parameter, means the response it's fulfilled. Any other value is an error
    // [-1234, 0, <params...>]

    // Also the error response could be custom as string
    // [-1234, 'My custom message error']

    // Response with instructions, if the second parameter of the response is an array it means is an instruction that could be (set, delete or merge)
    // [-<request_id>, [<instruction>, <params...>], [<instruction>, <params...>]]

    // Sending the same request without parameters means a cancel/abort of the request
    // [1234]

                        // Subscriber -> Owner
    subscribe: 1,       // [ 1234, <instruction>, <params...>]
                        // [-1234, 0, <object_id>, <data_object>]
                        // [-1234, 0, <object_id>, ['path']]

                        // Subscriber -> Owner
    unsubscribe: 2,     // [ 1234, <instruction>, <object_id>]
                        // [-1234, 0]

                        // Subscriber -> Owner
    call: 3,            // [ 1234, <instruction>, <object_id>, ['path','subpath'], [<params...>]]
                        // [-1234, 0, <return>]

                        // Owner -> Subscriber
    broadcast: 4,       // [ 1234, <instruction>, <object_id>, ['path','subpath'], [<params...>]]
                        // [-1234, 0, <return>]

                        // Owner -> Subscriber
    patch: 5,           // [ 1234, <instruction>, <object_id>, <version>, <patch>]
                        // [-1234, 0]
    


    1: 'subscribe',
    2: 'unsubscribe',
    3: 'call',
    4: 'broadcast',
    5: 'patch'
};

// for (var instruction in dop.protocol.instructions)
    // dop.protocol.instructions[ dop.protocol.instructions[instruction] ] = instruction;




//////////  src/protocol/instructionsPatchs.js

dop.protocol.instructionsPatchs = {
    undefined: '~U', // Delete
    function: '~F', // Remote function
    object: 0, // New object or array
    splice: 1, // Splice array
    swaps: 2, // Swap array

    // Non standards, only for JavaScript
    nan: '~N',
    regex: '~R',
    infinity: '~I',
    _infinity: '~i'
};




// a={
//     a: [0],
//     b: undefined,
//     c: "[0]",
//     newarr: {a:[0],b:undefined,c:"[0]",d:[4,[0],{}]},
// }

// // --------

// b={
//     a: [2,[0]],
//     b: [0],
//     c: "[0]",
//     newarr: [2,{a:[2,[0]],b:[0],c:"[0]",d:[2,[4,[2,[0]],[2,{}]]] }],
// }

// c={
//     a: [2,[0]],
//     b: [0],
//     c: "[0]",
//     newarr: [2,{a:"[0]",b:[0],c:"[[0]",d:[4,[0],{}]}],
// }


// c={
//     a: [2,[0]],
//     b: "~U",
//     c: "[0]",
//     newarr: [2,{a:[0],b:"~U",c:"[0]",d:[4,[0],{}]}],
// }





//////////  src/protocol/onbroadcast.js

dop.protocol.onbroadcast = function(node, request_id, request) {
    dop.protocol.onfunction(node, request_id, request, node.owner[request[1]], function(permission) {
        return permission.owner===request[1];
    });
};




//////////  src/protocol/oncall.js

dop.protocol.oncall = function(node, request_id, request) {
    dop.protocol.onfunction(node, request_id, request, request[1], function(permission) {
        return permission.subscriber===1;
    });
}




//////////  src/protocol/onfunction.js
// Used by dop.protocol.oncall && dop.protocol.onbroadcast
dop.protocol.onfunction = function(node, request_id, request, object_id, validator) {
    var path = request[2],
        params = request[3],
        object_data = dop.data.object[object_id];

    if (isObject(object_data) && isObject(object_data.node[node.token]) && validator(object_data.node[node.token])) {
        var functionName = path.pop(),
            object = dop.util.get(object_data.object, path),
            f = object[functionName];
        if (isFunction(f) && !dop.isBroadcastFunction(f)) {
            function resolve(value) {
                var response = dop.core.createResponse(request_id, 0);
                if (value !== undefined)
                    response.push(value);
                dop.core.storeSendMessages(node, response);
                return value;
            }
            function reject(err){
                dop.core.storeSendMessages(node, dop.core.createResponse(request_id, dop.core.error.reject_remote.CUSTOM_REJECTION, err));
            }

            if (dop.isRemoteFunction(f))
                f.apply(null, params).then(resolve).catch(reject);
            else
                dop.core.localProcedureCall(f, params, resolve, reject, function(req) {
                    req.node = node;
                    return req;
                }, dop.getObjectProxy(object));

            return;
        }
    }
    
    dop.core.storeSendMessages(node, dop.core.createResponse(request_id, dop.core.error.reject_remote.FUNCTION_NOT_FOUND));
};




//////////  src/protocol/onpatch.js

dop.protocol.onpatch = function(node, request_id, request) {
    var object_id_owner = request[1],
        object_id = node.owner[object_id_owner],
        version = request[2],
        patch = request[3],
        response = dop.core.createResponse(request_id),
        object_data = dop.data.object[object_id],
        object_node,
        collector;
    
    if (isObject(object_data) && isObject(object_data.node[node.token]) && object_data.node[node.token].owner===object_id_owner) {
        object_node = object_data.node[node.token];
        // Storing patch
        if (object_node.applied_version < version && object_node.applied[version]===undefined) {
            // Storing patch
            object_node.applied[version] = patch;
            // Applying
            collector = dop.collect();
            while (object_node.applied[object_node.applied_version+1]) {
                object_node.applied_version += 1;
                dop.core.setPatch(
                    object_data.object,
                    object_node.applied[object_node.applied_version],
                    dop.core.setPatchFunctionMutator
                );
                delete object_node.applied[object_node.applied_version];
            }
            collector.emit();
        }
        response.push(0);
    }
    else
        response.push(dop.core.error.reject_remote.OBJECT_NOT_FOUND);
    
    dop.core.storeSendMessages(node, response);
};




//////////  src/protocol/onpatchtimeout.js

dop.protocol.onpatchtimeout = function(node, request_id, request) {
    dop.protocol.patchSend(node, request[2], request[3], request[4]);
};




//////////  src/protocol/onsubscribe.js

dop.protocol.onsubscribe = function(node, request_id, request) {

    if (isFunction(dop.data.onsubscribe)) {

        var params = Array.prototype.slice.call(request, 1);

        dop.core.localProcedureCall(dop.data.onsubscribe, params, function resolve(value) {
            if (dop.isObjectRegistrable(value)) {
                var object = dop.register(value),
                    object_root = dop.getObjectRoot(object),
                    object_path = dop.getObjectPath(object),
                    object_id = object_path[0],
                    response = dop.core.createResponse(request_id, 0);

                // New object
                if (dop.core.registerSubscriber(node, object_root))
                    response.push(object_id, object_root);

                // Object already subscribed
                else
                    response.push(object_id, object_path.slice(1));

                dop.core.storeSendMessages(node, response, dop.encodeFunction);
                return object;
            }
            else if (value === undefined)
                return Promise.reject(dop.core.error.reject_remote.OBJECT_NOT_FOUND);
            else
                // http://www.2ality.com/2016/03/promise-rejections-vs-exceptions.html
                // http://stackoverflow.com/questions/41254636/catch-an-error-inside-of-promise-resolver
                dop.util.invariant(false, 'dop.onsubscribe callback must return or resolve a regular object');


        }, reject, function(req) {
            req.node = node;
            return req;
        });

    }
    else
        reject(dop.core.error.reject_remote.OBJECT_NOT_FOUND);

    function reject(error) {
        var response = dop.core.createResponse(request_id);
        (error instanceof Error) ? console.log(error.stack) : response.push(error);
        dop.core.storeSendMessages(node, response, JSON.stringify);
    }
};




//////////  src/protocol/ontimeout.js
dop.protocol.onsubscribetimeout = 
dop.protocol.onunsubscribetimeout = 
dop.protocol.oncalltimeout = 
dop.protocol.onbroadcasttimeout = function(node, request_id, request) {
    request.promise.reject(dop.core.error.reject_local.TIMEOUT_REQUEST);
};




//////////  src/protocol/onunsubscribe.js

dop.protocol.onunsubscribe = function(node, request_id, request) {
    var object_id = request[1],
        object_data = dop.data.object[object_id],
        response = dop.core.createResponse(request_id);

    if (isObject(object_data) && isObject(object_data.node[node.token]) && object_data.node[node.token].subscriber) {
        
        var roles = object_data.node[node.token];
        roles.subscriber = 0;

        if (roles.owner === 0)
            object_data.nodes_total -= 1;

        if (object_data.nodes_total === 0)
            delete dop.data.object[object_id];

        response.push(0);
    }
    else
        response.push(dop.core.error.reject_remote.SUBSCRIPTION_NOT_FOUND);

    dop.core.storeSendMessages(node, response);
};




//////////  src/protocol/patch.js

dop.protocol.patch = function(node, object_id, patch) {
    var object_node = dop.data.object[object_id].node[node.token],
        version = ++object_node.version;
    object_node.pending.push([version, dop.util.merge({}, patch)]); // Making a copy because this object is exposed to the api users and can be mutated
    return dop.protocol.patchSend(node, object_id, version, patch);
};

// Also used by dop.protocol._onpatch
dop.protocol.patchSend = function(node, object_id, version, patch) {
    var request = dop.core.createRequest( node, dop.protocol.instructions.patch, object_id, version, patch);
    dop.core.storeSendMessages(node, request, dop.encodeFunction);
    return request.promise;
};




//////////  src/protocol/subscribe.js

dop.protocol.subscribe = function(node, params) {
    params = Array.prototype.slice.call(params, 0);
    params.unshift(node, dop.protocol.instructions.subscribe);
    var request = dop.core.createRequest.apply(node, params);
    request.promise.into = function(object) {
        if (dop.isObjectRegistrable(object))
            request.into = (dop.isRegistered(object)) ? dop.getObjectProxy(object) : object;
        return request.promise;
    };
    dop.core.storeSendMessages(node, request);
    return request.promise;
};




//////////  src/protocol/timeouts.js
// Default timeouts
dop.protocol.timeouts = {
    subscribe: 5000,
    unsubscribe: 5000,
    call: 10000,  
    broadcast: 10000,
    patch: 1000    
};




//////////  src/protocol/unsubscribe.js

dop.protocol.unsubscribe = function(node, object) {
    var object_id = dop.getObjectId(object),
        object_data = dop.data.object[object_id];

    if (isObject(object_data) && isObject(object_data.node[node.token]) && object_data.node[node.token].owner>0) {
        var request = dop.core.createRequest(
            node,
            dop.protocol.instructions.unsubscribe,
            object_data.node[node.token].owner
        );
        dop.core.storeSendMessages(node, request);
        return request.promise;
    }
    else
        return Promise.reject(dop.core.error.reject_remote[2]);
};





//////////  src/umd.js
// Factory
if (root === undefined)
    return dop;

// AMD
if (typeof define === 'function' && define.amd)
    define([], function() { return dop });

// Node
else if (typeof module == 'object' && module.exports)
    module.exports = dop;

// Browser
else if (typeof window == 'object' && window)
    window.dop = dop;

else
    root.dop = dop;

})(this);



},{}],3:[function(require,module,exports){
(function (global){
/*
 *  Sugar v2.0.4
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c) Andrew Plummer
 *  https://sugarjs.com/
 *
 * ---------------------------- */
(function() {
  'use strict';

  /***
   * @module Core
   * @description Core functionality including the ability to define methods and
   *              extend onto natives.
   *
   ***/

  // The global to export.
  var Sugar;

  // The name of Sugar in the global namespace.
  var SUGAR_GLOBAL = 'Sugar';

  // Natives available on initialization. Letting Object go first to ensure its
  // global is set by the time the rest are checking for chainable Object methods.
  var NATIVE_NAMES = 'Object Number String Array Date RegExp Function';

  // Static method flag
  var STATIC   = 0x1;

  // Instance method flag
  var INSTANCE = 0x2;

  // IE8 has a broken defineProperty but no defineProperties so this saves a try/catch.
  var PROPERTY_DESCRIPTOR_SUPPORT = !!(Object.defineProperty && Object.defineProperties);

  // The global context. Rhino uses a different "global" keyword so
  // do an extra check to be sure that it's actually the global context.
  var globalContext = typeof global !== 'undefined' && global.Object === Object ? global : this;

  // Is the environment node?
  var hasExports = typeof module !== 'undefined' && module.exports;

  // Whether object instance methods can be mapped to the prototype.
  var allowObjectPrototype = false;

  // A map from Array to SugarArray.
  var namespacesByName = {};

  // A map from [object Object] to namespace.
  var namespacesByClassString = {};

  // Defining properties.
  var defineProperty = PROPERTY_DESCRIPTOR_SUPPORT ?  Object.defineProperty : definePropertyShim;

  // A default chainable class for unknown types.
  var DefaultChainable = getNewChainableClass('Chainable');


  // Global methods

  function setupGlobal() {
    Sugar = globalContext[SUGAR_GLOBAL];
    if (Sugar) {
      // Reuse already defined Sugar global object.
      return;
    }
    Sugar = function(arg) {
      forEachProperty(Sugar, function(sugarNamespace, name) {
        // Although only the only enumerable properties on the global
        // object are Sugar namespaces, environments that can't set
        // non-enumerable properties will step through the utility methods
        // as well here, so use this check to only allow true namespaces.
        if (hasOwn(namespacesByName, name)) {
          sugarNamespace.extend(arg);
        }
      });
      return Sugar;
    };
    if (hasExports) {
      module.exports = Sugar;
    } else {
      try {
        globalContext[SUGAR_GLOBAL] = Sugar;
      } catch (e) {
        // Contexts such as QML have a read-only global context.
      }
    }
    forEachProperty(NATIVE_NAMES.split(' '), function(name) {
      createNamespace(name);
    });
    setGlobalProperties();
  }

  /***
   * @method createNamespace(name)
   * @returns SugarNamespace
   * @namespace Sugar
   * @short Creates a new Sugar namespace.
   * @extra This method is for plugin developers who want to define methods to be
   *        used with natives that Sugar does not handle by default. The new
   *        namespace will appear on the `Sugar` global with all the methods of
   *        normal namespaces, including the ability to define new methods. When
   *        extended, any defined methods will be mapped to `name` in the global
   *        context.
   *
   * @example
   *
   *   Sugar.createNamespace('Boolean');
   *
   * @param {string} name - The namespace name.
   *
   ***/
  function createNamespace(name) {

    // Is the current namespace Object?
    var isObject = name === 'Object';

    // A Sugar namespace is also a chainable class: Sugar.Array, etc.
    var sugarNamespace = getNewChainableClass(name, true);

    /***
     * @method extend([opts])
     * @returns Sugar
     * @namespace Sugar
     * @short Extends Sugar defined methods onto natives.
     * @extra This method can be called on individual namespaces like
     *        `Sugar.Array` or on the `Sugar` global itself, in which case
     *        [opts] will be forwarded to each `extend` call. For more,
     *        see `extending`.
     *
     * @options
     *
     *   methods           An array of method names to explicitly extend.
     *
     *   except            An array of method names or global namespaces (`Array`,
     *                     `String`) to explicitly exclude. Namespaces should be the
     *                     actual global objects, not strings.
     *
     *   namespaces        An array of global namespaces (`Array`, `String`) to
     *                     explicitly extend. Namespaces should be the actual
     *                     global objects, not strings.
     *
     *   enhance           A shortcut to disallow all "enhance" flags at once
     *                     (flags listed below). For more, see `enhanced methods`.
     *                     Default is `true`.
     *
     *   enhanceString     A boolean allowing String enhancements. Default is `true`.
     *
     *   enhanceArray      A boolean allowing Array enhancements. Default is `true`.
     *
     *   objectPrototype   A boolean allowing Sugar to extend Object.prototype
     *                     with instance methods. This option is off by default
     *                     and should generally not be used except with caution.
     *                     For more, see `object methods`.
     *
     * @example
     *
     *   Sugar.Array.extend();
     *   Sugar.extend();
     *
     * @option {Array<string>} [methods]
     * @option {Array<string|NativeConstructor>} [except]
     * @option {Array<NativeConstructor>} [namespaces]
     * @option {boolean} [enhance]
     * @option {boolean} [enhanceString]
     * @option {boolean} [enhanceArray]
     * @option {boolean} [objectPrototype]
     * @param {ExtendOptions} [opts]
     *
     ***
     * @method extend([opts])
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Extends Sugar defined methods for a specific namespace onto natives.
     * @param {ExtendOptions} [opts]
     *
     ***/
    var extend = function (opts) {

      var nativeClass = globalContext[name], nativeProto = nativeClass.prototype;
      var staticMethods = {}, instanceMethods = {}, methodsByName;

      function objectRestricted(name, target) {
        return isObject && target === nativeProto &&
               (!allowObjectPrototype || name === 'get' || name === 'set');
      }

      function arrayOptionExists(field, val) {
        var arr = opts[field];
        if (arr) {
          for (var i = 0, el; el = arr[i]; i++) {
            if (el === val) {
              return true;
            }
          }
        }
        return false;
      }

      function arrayOptionExcludes(field, val) {
        return opts[field] && !arrayOptionExists(field, val);
      }

      function disallowedByFlags(methodName, target, flags) {
        // Disallowing methods by flag currently only applies if methods already
        // exist to avoid enhancing native methods, as aliases should still be
        // extended (i.e. Array#all should still be extended even if Array#every
        // is being disallowed by a flag).
        if (!target[methodName] || !flags) {
          return false;
        }
        for (var i = 0; i < flags.length; i++) {
          if (opts[flags[i]] === false) {
            return true;
          }
        }
      }

      function namespaceIsExcepted() {
        return arrayOptionExists('except', nativeClass) ||
               arrayOptionExcludes('namespaces', nativeClass);
      }

      function methodIsExcepted(methodName) {
        return arrayOptionExists('except', methodName);
      }

      function canExtend(methodName, method, target) {
        return !objectRestricted(methodName, target) &&
               !disallowedByFlags(methodName, target, method.flags) &&
               !methodIsExcepted(methodName);
      }

      opts = opts || {};
      methodsByName = opts.methods;

      if (namespaceIsExcepted()) {
        return;
      } else if (isObject && typeof opts.objectPrototype === 'boolean') {
        // Store "objectPrototype" flag for future reference.
        allowObjectPrototype = opts.objectPrototype;
      }

      forEachProperty(methodsByName || sugarNamespace, function(method, methodName) {
        if (methodsByName) {
          // If we have method names passed in an array,
          // then we need to flip the key and value here
          // and find the method in the Sugar namespace.
          methodName = method;
          method = sugarNamespace[methodName];
        }
        if (hasOwn(method, 'instance') && canExtend(methodName, method, nativeProto)) {
          instanceMethods[methodName] = method.instance;
        }
        if(hasOwn(method, 'static') && canExtend(methodName, method, nativeClass)) {
          staticMethods[methodName] = method;
        }
      });

      // Accessing the extend target each time instead of holding a reference as
      // it may have been overwritten (for example Date by Sinon). Also need to
      // access through the global to allow extension of user-defined namespaces.
      extendNative(nativeClass, staticMethods);
      extendNative(nativeProto, instanceMethods);

      if (!methodsByName) {
        // If there are no method names passed, then
        // all methods in the namespace will be extended
        // to the native. This includes all future defined
        // methods, so add a flag here to check later.
        setProperty(sugarNamespace, 'active', true);
      }
      return sugarNamespace;
    };

    function defineWithOptionCollect(methodName, instance, args) {
      setProperty(sugarNamespace, methodName, function(arg1, arg2, arg3) {
        var opts = collectDefineOptions(arg1, arg2, arg3);
        defineMethods(sugarNamespace, opts.methods, instance, args, opts.last);
        return sugarNamespace;
      });
    }

    /***
     * @method defineStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods on the namespace that can later be extended
     *        onto the native globals.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. If `extend` was previously called
     *        with no arguments, the method will be immediately mapped to its
     *        native when defined.
     *
     * @example
     *
     *   Sugar.Number.defineStatic({
     *     isOdd: function (num) {
     *       return num % 2 === 1;
     *     }
     *   });
     *
     * @signature defineStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStatic', STATIC);

    /***
     * @method defineInstance(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines methods on the namespace that can later be extended as
     *        instance methods onto the native prototype.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. All functions should accept the
     *        native for which they are mapped as their first argument, and should
     *        never refer to `this`. If `extend` was previously called with no
     *        arguments, the method will be immediately mapped to its native when
     *        defined.
     *
     *        Methods cannot accept more than 4 arguments in addition to the
     *        native (5 arguments total). Any additional arguments will not be
     *        mapped. If the method needs to accept unlimited arguments, use
     *        `defineInstanceWithArguments`. Otherwise if more options are
     *        required, use an options object instead.
     *
     * @example
     *
     *   Sugar.Number.defineInstance({
     *     square: function (num) {
     *       return num * num;
     *     }
     *   });
     *
     * @signature defineInstance(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstance', INSTANCE);

    /***
     * @method defineInstanceAndStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short A shortcut to define both static and instance methods on the namespace.
     * @extra This method is intended for use with `Object` instance methods. Sugar
     *        will not map any methods to `Object.prototype` by default, so defining
     *        instance methods as static helps facilitate their proper use.
     *
     * @example
     *
     *   Sugar.Object.defineInstanceAndStatic({
     *     isAwesome: function (obj) {
     *       // check if obj is awesome!
     *     }
     *   });
     *
     * @signature defineInstanceAndStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceAndStatic', INSTANCE | STATIC);


    /***
     * @method defineStaticWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that collect arguments.
     * @extra This method is identical to `defineStatic`, except that when defined
     *        methods are called, they will collect any arguments past `n - 1`,
     *        where `n` is the number of arguments that the method accepts.
     *        Collected arguments will be passed to the method in an array
     *        as the last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineStaticWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineStaticWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStaticWithArguments', STATIC, true);

    /***
     * @method defineInstanceWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that collect arguments.
     * @extra This method is identical to `defineInstance`, except that when
     *        defined methods are called, they will collect any arguments past
     *        `n - 1`, where `n` is the number of arguments that the method
     *        accepts. Collected arguments will be passed to the method as the
     *        last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineInstanceWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineInstanceWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceWithArguments', INSTANCE, true);

    /***
     * @method defineStaticPolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that are mapped onto the native if they do
     *        not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments.
     *
     * @example
     *
     *   Sugar.Object.defineStaticPolyfill({
     *     keys: function (obj) {
     *       // get keys!
     *     }
     *   });
     *
     * @signature defineStaticPolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineStaticPolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name], opts.methods, true, opts.last);
      return sugarNamespace;
    });

    /***
     * @method defineInstancePolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that are mapped onto the native prototype
     *        if they do not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments. This method differs from
     *        `defineInstance` as there is no static signature (as the method
     *        is mapped as-is to the native), so it should refer to its `this`
     *        object.
     *
     * @example
     *
     *   Sugar.Array.defineInstancePolyfill({
     *     indexOf: function (arr, el) {
     *       // index finding code here!
     *     }
     *   });
     *
     * @signature defineInstancePolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineInstancePolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name].prototype, opts.methods, true, opts.last);
      // Map instance polyfills to chainable as well.
      forEachProperty(opts.methods, function(fn, methodName) {
        defineChainableMethod(sugarNamespace, methodName, fn);
      });
      return sugarNamespace;
    });

    /***
     * @method alias(toName, from)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Aliases one Sugar method to another.
     *
     * @example
     *
     *   Sugar.Array.alias('all', 'every');
     *
     * @signature alias(toName, fn)
     * @param {string} toName - Name for new method.
     * @param {string|Function} from - Method to alias, or string shortcut.
     ***/
    setProperty(sugarNamespace, 'alias', function(name, source) {
      var method = typeof source === 'string' ? sugarNamespace[source] : source;
      setMethod(sugarNamespace, name, method);
      return sugarNamespace;
    });

    // Each namespace can extend only itself through its .extend method.
    setProperty(sugarNamespace, 'extend', extend);

    // Cache the class to namespace relationship for later use.
    namespacesByName[name] = sugarNamespace;
    namespacesByClassString['[object ' + name + ']'] = sugarNamespace;

    mapNativeToChainable(name);
    mapObjectChainablesToNamespace(sugarNamespace);


    // Export
    return Sugar[name] = sugarNamespace;
  }

  function setGlobalProperties() {
    setProperty(Sugar, 'extend', Sugar);
    setProperty(Sugar, 'toString', toString);
    setProperty(Sugar, 'createNamespace', createNamespace);

    setProperty(Sugar, 'util', {
      'hasOwn': hasOwn,
      'getOwn': getOwn,
      'setProperty': setProperty,
      'classToString': classToString,
      'defineProperty': defineProperty,
      'forEachProperty': forEachProperty,
      'mapNativeToChainable': mapNativeToChainable
    });
  }

  function toString() {
    return SUGAR_GLOBAL;
  }


  // Defining Methods

  function defineMethods(sugarNamespace, methods, type, args, flags) {
    forEachProperty(methods, function(method, methodName) {
      var instanceMethod, staticMethod = method;
      if (args) {
        staticMethod = wrapMethodWithArguments(method);
      }
      if (flags) {
        staticMethod.flags = flags;
      }

      // A method may define its own custom implementation, so
      // make sure that's not the case before creating one.
      if (type & INSTANCE && !method.instance) {
        instanceMethod = wrapInstanceMethod(method, args);
        setProperty(staticMethod, 'instance', instanceMethod);
      }

      if (type & STATIC) {
        setProperty(staticMethod, 'static', true);
      }

      setMethod(sugarNamespace, methodName, staticMethod);

      if (sugarNamespace.active) {
        // If the namespace has been activated (.extend has been called),
        // then map this method as well.
        sugarNamespace.extend(methodName);
      }
    });
  }

  function collectDefineOptions(arg1, arg2, arg3) {
    var methods, last;
    if (typeof arg1 === 'string') {
      methods = {};
      methods[arg1] = arg2;
      last = arg3;
    } else {
      methods = arg1;
      last = arg2;
    }
    return {
      last: last,
      methods: methods
    };
  }

  function wrapInstanceMethod(fn, args) {
    return args ? wrapMethodWithArguments(fn, true) : wrapInstanceMethodFixed(fn);
  }

  function wrapMethodWithArguments(fn, instance) {
    // Functions accepting enumerated arguments will always have "args" as the
    // last argument, so subtract one from the function length to get the point
    // at which to start collecting arguments. If this is an instance method on
    // a prototype, then "this" will be pushed into the arguments array so start
    // collecting 1 argument earlier.
    var startCollect = fn.length - 1 - (instance ? 1 : 0);
    return function() {
      var args = [], collectedArgs = [], len;
      if (instance) {
        args.push(this);
      }
      len = Math.max(arguments.length, startCollect);
      // Optimized: no leaking arguments
      for (var i = 0; i < len; i++) {
        if (i < startCollect) {
          args.push(arguments[i]);
        } else {
          collectedArgs.push(arguments[i]);
        }
      }
      args.push(collectedArgs);
      return fn.apply(this, args);
    };
  }

  function wrapInstanceMethodFixed(fn) {
    switch(fn.length) {
      // Wrapped instance methods will always be passed the instance
      // as the first argument, but requiring the argument to be defined
      // may cause confusion here, so return the same wrapped function regardless.
      case 0:
      case 1:
        return function() {
          return fn(this);
        };
      case 2:
        return function(a) {
          return fn(this, a);
        };
      case 3:
        return function(a, b) {
          return fn(this, a, b);
        };
      case 4:
        return function(a, b, c) {
          return fn(this, a, b, c);
        };
      case 5:
        return function(a, b, c, d) {
          return fn(this, a, b, c, d);
        };
    }
  }

  // Method helpers

  function extendNative(target, source, polyfill, override) {
    forEachProperty(source, function(method, name) {
      if (polyfill && !override && target[name]) {
        // Method exists, so bail.
        return;
      }
      setProperty(target, name, method);
    });
  }

  function setMethod(sugarNamespace, methodName, method) {
    sugarNamespace[methodName] = method;
    if (method.instance) {
      defineChainableMethod(sugarNamespace, methodName, method.instance, true);
    }
  }


  // Chainables

  function getNewChainableClass(name) {
    var fn = function SugarChainable(obj, arg) {
      if (!(this instanceof fn)) {
        return new fn(obj, arg);
      }
      if (this.constructor !== fn) {
        // Allow modules to define their own constructors.
        obj = this.constructor.apply(obj, arguments);
      }
      this.raw = obj;
    };
    setProperty(fn, 'toString', function() {
      return SUGAR_GLOBAL + name;
    });
    setProperty(fn.prototype, 'valueOf', function() {
      return this.raw;
    });
    return fn;
  }

  function defineChainableMethod(sugarNamespace, methodName, fn) {
    var wrapped = wrapWithChainableResult(fn), existing, collision, dcp;
    dcp = DefaultChainable.prototype;
    existing = dcp[methodName];

    // If the method was previously defined on the default chainable, then a
    // collision exists, so set the method to a disambiguation function that will
    // lazily evaluate the object and find it's associated chainable. An extra
    // check is required to avoid false positives from Object inherited methods.
    collision = existing && existing !== Object.prototype[methodName];

    // The disambiguation function is only required once.
    if (!existing || !existing.disambiguate) {
      dcp[methodName] = collision ? disambiguateMethod(methodName) : wrapped;
    }

    // The target chainable always receives the wrapped method. Additionally,
    // if the target chainable is Sugar.Object, then map the wrapped method
    // to all other namespaces as well if they do not define their own method
    // of the same name. This way, a Sugar.Number will have methods like
    // isEqual that can be called on any object without having to traverse up
    // the prototype chain and perform disambiguation, which costs cycles.
    // Note that the "if" block below actually does nothing on init as Object
    // goes first and no other namespaces exist yet. However it needs to be
    // here as Object instance methods defined later also need to be mapped
    // back onto existing namespaces.
    sugarNamespace.prototype[methodName] = wrapped;
    if (sugarNamespace === Sugar.Object) {
      mapObjectChainableToAllNamespaces(methodName, wrapped);
    }
  }

  function mapObjectChainablesToNamespace(sugarNamespace) {
    forEachProperty(Sugar.Object && Sugar.Object.prototype, function(val, methodName) {
      if (typeof val === 'function') {
        setObjectChainableOnNamespace(sugarNamespace, methodName, val);
      }
    });
  }

  function mapObjectChainableToAllNamespaces(methodName, fn) {
    forEachProperty(namespacesByName, function(sugarNamespace) {
      setObjectChainableOnNamespace(sugarNamespace, methodName, fn);
    });
  }

  function setObjectChainableOnNamespace(sugarNamespace, methodName, fn) {
    var proto = sugarNamespace.prototype;
    if (!hasOwn(proto, methodName)) {
      proto[methodName] = fn;
    }
  }

  function wrapWithChainableResult(fn) {
    return function() {
      return new DefaultChainable(fn.apply(this.raw, arguments));
    };
  }

  function disambiguateMethod(methodName) {
    var fn = function() {
      var raw = this.raw, sugarNamespace, fn;
      if (raw != null) {
        // Find the Sugar namespace for this unknown.
        sugarNamespace = namespacesByClassString[classToString(raw)];
      }
      if (!sugarNamespace) {
        // If no sugarNamespace can be resolved, then default
        // back to Sugar.Object so that undefined and other
        // non-supported types can still have basic object
        // methods called on them, such as type checks.
        sugarNamespace = Sugar.Object;
      }

      fn = new sugarNamespace(raw)[methodName];

      if (fn.disambiguate) {
        // If the method about to be called on this chainable is
        // itself a disambiguation method, then throw an error to
        // prevent infinite recursion.
        throw new TypeError('Cannot resolve namespace for ' + raw);
      }

      return fn.apply(this, arguments);
    };
    fn.disambiguate = true;
    return fn;
  }

  function mapNativeToChainable(name, methodNames) {
    var sugarNamespace = namespacesByName[name],
        nativeProto = globalContext[name].prototype;

    if (!methodNames && ownPropertyNames) {
      methodNames = ownPropertyNames(nativeProto);
    }

    forEachProperty(methodNames, function(methodName) {
      if (nativeMethodProhibited(methodName)) {
        // Sugar chainables have their own constructors as well as "valueOf"
        // methods, so exclude them here. The __proto__ argument should be trapped
        // by the function check below, however simply accessing this property on
        // Object.prototype causes QML to segfault, so pre-emptively excluding it.
        return;
      }
      try {
        var fn = nativeProto[methodName];
        if (typeof fn !== 'function') {
          // Bail on anything not a function.
          return;
        }
      } catch (e) {
        // Function.prototype has properties that
        // will throw errors when accessed.
        return;
      }
      defineChainableMethod(sugarNamespace, methodName, fn);
    });
  }

  function nativeMethodProhibited(methodName) {
    return methodName === 'constructor' ||
           methodName === 'valueOf' ||
           methodName === '__proto__';
  }


  // Util

  // Internal references
  var ownPropertyNames = Object.getOwnPropertyNames,
      internalToString = Object.prototype.toString,
      internalHasOwnProperty = Object.prototype.hasOwnProperty;

  // Defining this as a variable here as the ES5 module
  // overwrites it to patch DONTENUM.
  var forEachProperty = function (obj, fn) {
    for(var key in obj) {
      if (!hasOwn(obj, key)) continue;
      if (fn.call(obj, obj[key], key, obj) === false) break;
    }
  };

  function definePropertyShim(obj, prop, descriptor) {
    obj[prop] = descriptor.value;
  }

  function setProperty(target, name, value, enumerable) {
    defineProperty(target, name, {
      value: value,
      enumerable: !!enumerable,
      configurable: true,
      writable: true
    });
  }

  // PERF: Attempts to speed this method up get very Heisenbergy. Quickly
  // returning based on typeof works for primitives, but slows down object
  // types. Even === checks on null and undefined (no typeof) will end up
  // basically breaking even. This seems to be as fast as it can go.
  function classToString(obj) {
    return internalToString.call(obj);
  }

  function hasOwn(obj, prop) {
    return !!obj && internalHasOwnProperty.call(obj, prop);
  }

  function getOwn(obj, prop) {
    if (hasOwn(obj, prop)) {
      return obj[prop];
    }
  }

  setupGlobal();

}).call(this);
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],4:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayClone = require('./internal/arrayClone'),
    arrayAppend = require('./internal/arrayAppend');

Sugar.Array.defineInstance({

  'add': function(arr, item, index) {
    return arrayAppend(arrayClone(arr), item, index);
  }

});

module.exports = Sugar.Array.add;
},{"./internal/arrayAppend":33,"./internal/arrayClone":34,"sugar-core":3}],5:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayAppend = require('./internal/arrayAppend');

Sugar.Array.defineInstance({

  'append': function(arr, item, index) {
    return arrayAppend(arr, item, index);
  }

});

module.exports = Sugar.Array.append;
},{"./internal/arrayAppend":33,"sugar-core":3}],6:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getEntriesForIndexes = require('../common/internal/getEntriesForIndexes');

Sugar.Array.defineInstance({

  'at': function(arr, index, loop) {
    return getEntriesForIndexes(arr, index, loop);
  }

});

module.exports = Sugar.Array.at;
},{"../common/internal/getEntriesForIndexes":118,"sugar-core":3}],7:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    average = require('../enumerable/internal/average');

Sugar.Array.defineInstance({

  'average': function(arr, map) {
    return average(arr, map);
  }

});

module.exports = Sugar.Array.average;
},{"../enumerable/internal/average":393,"sugar-core":3}],8:[function(require,module,exports){
'use strict';

var setArrayChainableConstructor = require('../internal/setArrayChainableConstructor');

setArrayChainableConstructor();
},{"../internal/setArrayChainableConstructor":55}],9:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayClone = require('./internal/arrayClone');

Sugar.Array.defineInstance({

  'clone': function(arr) {
    return arrayClone(arr);
  }

});

module.exports = Sugar.Array.clone;
},{"./internal/arrayClone":34,"sugar-core":3}],10:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayCompact = require('./internal/arrayCompact');

Sugar.Array.defineInstance({

  'compact': function(arr, all) {
    return arrayCompact(arr, all);
  }

});

module.exports = Sugar.Array.compact;
},{"./internal/arrayCompact":35,"sugar-core":3}],11:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

Sugar.Array.defineStatic({

  'construct': function(n, fn) {
    n = coercePositiveInteger(n);
    return Array.from(new Array(n), function(el, i) {
      return fn && fn(i);
    });
  }

});

module.exports = Sugar.Array.construct;
},{"../common/internal/coercePositiveInteger":95,"sugar-core":3}],12:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayCount = require('../enumerable/internal/arrayCount'),
    fixArgumentLength = require('../common/internal/fixArgumentLength');

Sugar.Array.defineInstance({

  'count': fixArgumentLength(arrayCount)

});

module.exports = Sugar.Array.count;
},{"../common/internal/fixArgumentLength":113,"../enumerable/internal/arrayCount":391,"sugar-core":3}],13:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayCreate = require('./internal/arrayCreate');

require('./build/setArrayChainableConstructorCall');

Sugar.Array.defineStatic({

  'create': function(obj, clone) {
    return arrayCreate(obj, clone);
  }

});

module.exports = Sugar.Array.create;
},{"./build/setArrayChainableConstructorCall":8,"./internal/arrayCreate":37,"sugar-core":3}],14:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedEvery = enhancedMatcherMethods.enhancedEvery;

Sugar.Array.defineInstance({

  'every': fixArgumentLength(enhancedEvery)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.every;
},{"../common/internal/fixArgumentLength":113,"../common/var/ENHANCEMENTS_FLAG":166,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":413,"../enumerable/var/enhancedMatcherMethods":415,"sugar-core":3}],15:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.everyFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],16:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayExclude = require('./internal/arrayExclude');

Sugar.Array.defineInstance({

  'exclude': function(arr, f) {
    return arrayExclude(arr, f);
  }

});

module.exports = Sugar.Array.exclude;
},{"./internal/arrayExclude":38,"sugar-core":3}],17:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedFilter = enhancedMatcherMethods.enhancedFilter;

Sugar.Array.defineInstance({

  'filter': fixArgumentLength(enhancedFilter)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.filter;
},{"../common/internal/fixArgumentLength":113,"../common/var/ENHANCEMENTS_FLAG":166,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":413,"../enumerable/var/enhancedMatcherMethods":415,"sugar-core":3}],18:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.filterFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],19:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedFind = enhancedMatcherMethods.enhancedFind;

Sugar.Array.defineInstance({

  'find': fixArgumentLength(enhancedFind)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.find;
},{"../common/internal/fixArgumentLength":113,"../common/var/ENHANCEMENTS_FLAG":166,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":413,"../enumerable/var/enhancedMatcherMethods":415,"sugar-core":3}],20:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.findFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],21:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedFindIndex = enhancedMatcherMethods.enhancedFindIndex;

Sugar.Array.defineInstance({

  'findIndex': fixArgumentLength(enhancedFindIndex)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.findIndex;
},{"../common/internal/fixArgumentLength":113,"../common/var/ENHANCEMENTS_FLAG":166,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":413,"../enumerable/var/enhancedMatcherMethods":415,"sugar-core":3}],22:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.findIndexFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],23:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'first': function(arr, num) {
    if (isUndefined(num)) return arr[0];
    if (num < 0) num = 0;
    return arr.slice(0, num);
  }

});

module.exports = Sugar.Array.first;
},{"../common/internal/isUndefined":140,"sugar-core":3}],24:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayFlatten = require('./internal/arrayFlatten');

Sugar.Array.defineInstance({

  'flatten': function(arr, limit) {
    return arrayFlatten(arr, limit);
  }

});

module.exports = Sugar.Array.flatten;
},{"./internal/arrayFlatten":39,"sugar-core":3}],25:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.forEachFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],26:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Array.defineInstance({

  'from': function(arr, num) {
    return arr.slice(num);
  }

});

module.exports = Sugar.Array.from;
},{"sugar-core":3}],27:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ARRAY_OPTIONS = require('./var/ARRAY_OPTIONS');

var _arrayOptions = ARRAY_OPTIONS._arrayOptions;

module.exports = Sugar.Array.getOption;
},{"./var/ARRAY_OPTIONS":83,"sugar-core":3}],28:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayGroupBy = require('./internal/arrayGroupBy');

Sugar.Array.defineInstance({

  'groupBy': function(arr, map, fn) {
    return arrayGroupBy(arr, map, fn);
  }

});

module.exports = Sugar.Array.groupBy;
},{"./internal/arrayGroupBy":40,"sugar-core":3}],29:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isDefined = require('../common/internal/isDefined'),
    mathAliases = require('../common/var/mathAliases'),
    simpleRepeat = require('../common/internal/simpleRepeat');

var ceil = mathAliases.ceil;

Sugar.Array.defineInstance({

  'inGroups': function(arr, num, padding) {
    var pad = isDefined(padding);
    var result = new Array(num);
    var divisor = ceil(arr.length / num);
    simpleRepeat(num, function(i) {
      var index = i * divisor;
      var group = arr.slice(index, index + divisor);
      if (pad && group.length < divisor) {
        simpleRepeat(divisor - group.length, function() {
          group.push(padding);
        });
      }
      result[i] = group;
    });
    return result;
  }

});

module.exports = Sugar.Array.inGroups;
},{"../common/internal/isDefined":134,"../common/internal/simpleRepeat":159,"../common/var/mathAliases":180,"sugar-core":3}],30:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined'),
    mathAliases = require('../common/var/mathAliases'),
    simpleRepeat = require('../common/internal/simpleRepeat');

var ceil = mathAliases.ceil;

Sugar.Array.defineInstance({

  'inGroupsOf': function(arr, num, padding) {
    var result = [], len = arr.length, group;
    if (len === 0 || num === 0) return arr;
    if (isUndefined(num)) num = 1;
    if (isUndefined(padding)) padding = null;
    simpleRepeat(ceil(len / num), function(i) {
      group = arr.slice(num * i, num * i + num);
      while(group.length < num) {
        group.push(padding);
      }
      result.push(group);
    });
    return result;
  }

});

module.exports = Sugar.Array.inGroupsOf;
},{"../common/internal/isUndefined":140,"../common/internal/simpleRepeat":159,"../common/var/mathAliases":180,"sugar-core":3}],31:[function(require,module,exports){
'use strict';

// Static Methods
require('./construct');
require('./create');

// Instance Methods
require('./add');
require('./append');
require('./at');
require('./clone');
require('./compact');
require('./exclude');
require('./first');
require('./flatten');
require('./from');
require('./groupBy');
require('./inGroups');
require('./inGroupsOf');
require('./intersect');
require('./isEmpty');
require('./isEqual');
require('./last');
require('./remove');
require('./removeAt');
require('./sample');
require('./shuffle');
require('./sortBy');
require('./subtract');
require('./to');
require('./union');
require('./unique');
require('./zip');

// Aliases
require('./insert');

// Accessors
require('./getOption');
require('./setOption');

module.exports = require('sugar-core');
},{"./add":4,"./append":5,"./at":6,"./clone":9,"./compact":10,"./construct":11,"./create":13,"./exclude":16,"./first":23,"./flatten":24,"./from":26,"./getOption":27,"./groupBy":28,"./inGroups":29,"./inGroupsOf":30,"./insert":32,"./intersect":56,"./isEmpty":57,"./isEqual":58,"./last":59,"./remove":70,"./removeAt":71,"./sample":72,"./setOption":73,"./shuffle":74,"./sortBy":77,"./subtract":78,"./to":80,"./union":81,"./unique":82,"./zip":87,"sugar-core":3}],32:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    append = require('./append');

Sugar.Array.alias('insert', 'append');

module.exports = Sugar.Array.insert;
},{"./append":5,"sugar-core":3}],33:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined');

function arrayAppend(arr, el, index) {
  var spliceArgs;
  index = +index;
  if (isNaN(index)) {
    index = arr.length;
  }
  spliceArgs = [index, 0];
  if (isDefined(el)) {
    spliceArgs = spliceArgs.concat(el);
  }
  arr.splice.apply(arr, spliceArgs);
  return arr;
}

module.exports = arrayAppend;
},{"../../common/internal/isDefined":134}],34:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach');

function arrayClone(arr) {
  var clone = new Array(arr.length);
  forEach(arr, function(el, i) {
    clone[i] = el;
  });
  return clone;
}

module.exports = arrayClone;
},{"../../common/internal/forEach":114}],35:[function(require,module,exports){
'use strict';

var filter = require('../../common/internal/filter');

function arrayCompact(arr, all) {
  return filter(arr, function(el) {
    return el || (!all && el != null && el.valueOf() === el.valueOf());
  });
}

module.exports = arrayCompact;
},{"../../common/internal/filter":112}],36:[function(require,module,exports){
'use strict';

var HAS_CONCAT_BUG = require('../var/HAS_CONCAT_BUG'),
    arraySafeConcat = require('./arraySafeConcat');

function arrayConcat(arr1, arr2) {
  if (HAS_CONCAT_BUG) {
    return arraySafeConcat(arr1, arr2);
  }
  return arr1.concat(arr2);
}

module.exports = arrayConcat;
},{"../var/HAS_CONCAT_BUG":86,"./arraySafeConcat":43}],37:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    arrayClone = require('./arrayClone'),
    classChecks = require('../../common/var/classChecks'),
    isObjectType = require('../../common/internal/isObjectType'),
    isArrayOrInherited = require('./isArrayOrInherited');

var isString = classChecks.isString;

function arrayCreate(obj, clone) {
  var arr;
  if (isArrayOrInherited(obj)) {
    arr = clone ? arrayClone(obj) : obj;
  } else if (isObjectType(obj) || isString(obj)) {
    arr = Array.from(obj);
  } else if (isDefined(obj)) {
    arr = [obj];
  }
  return arr || [];
}

module.exports = arrayCreate;
},{"../../common/internal/isDefined":134,"../../common/internal/isObjectType":136,"../../common/var/classChecks":177,"./arrayClone":34,"./isArrayOrInherited":54}],38:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher');

function arrayExclude(arr, f) {
  var result = [], matcher = getMatcher(f);
  for (var i = 0; i < arr.length; i++) {
    if (!matcher(arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
}

module.exports = arrayExclude;
},{"../../common/internal/getMatcher":121}],39:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function arrayFlatten(arr, level, current) {
  var result = [];
  level = level || Infinity;
  current = current || 0;
  forEach(arr, function(el) {
    if (isArray(el) && current < level) {
      result = result.concat(arrayFlatten(el, level, current + 1));
    } else {
      result.push(el);
    }
  });
  return result;
}

module.exports = arrayFlatten;
},{"../../common/internal/forEach":114,"../../common/var/classChecks":177}],40:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    forEachProperty = coreUtilityAliases.forEachProperty;

function arrayGroupBy(arr, map, fn) {
  var result = {}, key;
  forEach(arr, function(el, i) {
    key = mapWithShortcuts(el, map, arr, [el, i, arr]);
    if (!hasOwn(result, key)) {
      result[key] = [];
    }
    result[key].push(el);
  });
  if (fn) {
    forEachProperty(result, fn);
  }
  return result;
}

module.exports = arrayGroupBy;
},{"../../common/internal/forEach":114,"../../common/internal/mapWithShortcuts":145,"../../common/var/coreUtilityAliases":178}],41:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    arrayWrap = require('./arrayWrap'),
    classChecks = require('../../common/var/classChecks'),
    serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var isArray = classChecks.isArray,
    hasOwn = coreUtilityAliases.hasOwn;

function arrayIntersectOrSubtract(arr1, arr2, subtract) {
  var result = [], obj = {}, refs = [];
  if (!isArray(arr2)) {
    arr2 = arrayWrap(arr2);
  }
  forEach(arr2, function(el) {
    obj[serializeInternal(el, refs)] = true;
  });
  forEach(arr1, function(el) {
    var key = serializeInternal(el, refs);
    if (hasOwn(obj, key) !== subtract) {
      delete obj[key];
      result.push(el);
    }
  });
  return result;
}

module.exports = arrayIntersectOrSubtract;
},{"../../common/internal/forEach":114,"../../common/internal/serializeInternal":153,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"./arrayWrap":46}],42:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher');

function arrayRemove(arr, f) {
  var matcher = getMatcher(f), i = 0;
  while(i < arr.length) {
    if (matcher(arr[i], i, arr)) {
      arr.splice(i, 1);
    } else {
      i++;
    }
  }
  return arr;
}

module.exports = arrayRemove;
},{"../../common/internal/getMatcher":121}],43:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    arrayClone = require('./arrayClone'),
    classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function arraySafeConcat(arr, arg) {
  var result = arrayClone(arr), len = result.length, arr2;
  arr2 = isArray(arg) ? arg : [arg];
  result.length += arr2.length;
  forEach(arr2, function(el, i) {
    result[len + i] = el;
  });
  return result;
}

module.exports = arraySafeConcat;
},{"../../common/internal/forEach":114,"../../common/var/classChecks":177,"./arrayClone":34}],44:[function(require,module,exports){
'use strict';

var arrayClone = require('./arrayClone');

function arrayShuffle(arr) {
  arr = arrayClone(arr);
  var i = arr.length, j, x;
  while(i) {
    j = (Math.random() * i) | 0;
    x = arr[--i];
    arr[i] = arr[j];
    arr[j] = x;
  }
  return arr;
}

module.exports = arrayShuffle;
},{"./arrayClone":34}],45:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function arrayUnique(arr, map) {
  var result = [], obj = {}, refs = [];
  forEach(arr, function(el, i) {
    var transformed = map ? mapWithShortcuts(el, map, arr, [el, i, arr]) : el;
    var key = serializeInternal(transformed, refs);
    if (!hasOwn(obj, key)) {
      result.push(el);
      obj[key] = true;
    }
  });
  return result;
}

module.exports = arrayUnique;
},{"../../common/internal/forEach":114,"../../common/internal/mapWithShortcuts":145,"../../common/internal/serializeInternal":153,"../../common/var/coreUtilityAliases":178}],46:[function(require,module,exports){
'use strict';

function arrayWrap(obj) {
  var arr = [];
  arr.push(obj);
  return arr;
}

module.exports = arrayWrap;
},{}],47:[function(require,module,exports){
'use strict';

var HALF_WIDTH_NINE = require('../var/HALF_WIDTH_NINE'),
    FULL_WIDTH_NINE = require('../var/FULL_WIDTH_NINE'),
    CommonChars = require('../../common/var/CommonChars');

var HALF_WIDTH_ZERO = CommonChars.HALF_WIDTH_ZERO,
    FULL_WIDTH_ZERO = CommonChars.FULL_WIDTH_ZERO;

function codeIsNumeral(code) {
  return (code >= HALF_WIDTH_ZERO && code <= HALF_WIDTH_NINE) ||
         (code >= FULL_WIDTH_ZERO && code <= FULL_WIDTH_NINE);
}

module.exports = codeIsNumeral;
},{"../../common/var/CommonChars":165,"../var/FULL_WIDTH_NINE":84,"../var/HALF_WIDTH_NINE":85}],48:[function(require,module,exports){
'use strict';

var ARRAY_OPTIONS = require('../var/ARRAY_OPTIONS'),
    classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString,
    isArray = classChecks.isArray,
    _arrayOptions = ARRAY_OPTIONS._arrayOptions;

function compareValue(aVal, bVal) {
  var cmp, i, collate;
  if (isString(aVal) && isString(bVal)) {
    collate = _arrayOptions('sortCollate');
    return collate(aVal, bVal);
  } else if (isArray(aVal) && isArray(bVal)) {
    if (aVal.length < bVal.length) {
      return -1;
    } else if (aVal.length > bVal.length) {
      return 1;
    } else {
      for(i = 0; i < aVal.length; i++) {
        cmp = compareValue(aVal[i], bVal[i]);
        if (cmp !== 0) {
          return cmp;
        }
      }
      return 0;
    }
  }
  return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
}

module.exports = compareValue;
},{"../../common/var/classChecks":177,"../var/ARRAY_OPTIONS":83}],49:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn;

function getCollationCharacter(str, index, sortEquivalents) {
  var chr = str.charAt(index);
  return getOwn(sortEquivalents, chr) || chr;
}

module.exports = getCollationCharacter;
},{"../../common/var/coreUtilityAliases":178}],50:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function getCollationReadyString(str, sortIgnore, sortIgnoreCase) {
  if (!isString(str)) str = String(str);
  if (sortIgnoreCase) {
    str = str.toLowerCase();
  }
  if (sortIgnore) {
    str = str.replace(sortIgnore, '');
  }
  return str;
}

module.exports = getCollationReadyString;
},{"../../common/var/classChecks":177}],51:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    spaceSplit = require('../../common/internal/spaceSplit');

function getSortEquivalents() {
  var equivalents = {};
  forEach(spaceSplit('AÁÀÂÃÄ CÇ EÉÈÊË IÍÌİÎÏ OÓÒÔÕÖ Sß UÚÙÛÜ'), function(set) {
    var first = set.charAt(0);
    forEach(set.slice(1).split(''), function(chr) {
      equivalents[chr] = first;
      equivalents[chr.toLowerCase()] = first.toLowerCase();
    });
  });
  return equivalents;
}

module.exports = getSortEquivalents;
},{"../../common/internal/forEach":114,"../../common/internal/spaceSplit":160}],52:[function(require,module,exports){
'use strict';

var map = require('../../common/internal/map');

function getSortOrder() {
  var order = 'AÁÀÂÃĄBCĆČÇDĎÐEÉÈĚÊËĘFGĞHıIÍÌİÎÏJKLŁMNŃŇÑOÓÒÔPQRŘSŚŠŞTŤUÚÙŮÛÜVWXYÝZŹŻŽÞÆŒØÕÅÄÖ';
  return map(order.split(''), function(str) {
    return str + str.toLowerCase();
  }).join('');
}

module.exports = getSortOrder;
},{"../../common/internal/map":143}],53:[function(require,module,exports){
'use strict';

function getSortOrderIndex(chr, sortOrder) {
  if (!chr) {
    return null;
  } else {
    return sortOrder.indexOf(chr);
  }
}

module.exports = getSortOrderIndex;
},{}],54:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function isArrayOrInherited(obj) {
  return obj && obj.constructor && isArray(obj.constructor.prototype);
}

module.exports = isArrayOrInherited;
},{"../../common/var/classChecks":177}],55:[function(require,module,exports){
'use strict';

var arrayCreate = require('./arrayCreate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    setChainableConstructor = require('../../common/internal/setChainableConstructor');

var sugarArray = namespaceAliases.sugarArray;

function setArrayChainableConstructor() {
  setChainableConstructor(sugarArray, arrayCreate);
}

module.exports = setArrayChainableConstructor;
},{"../../common/internal/setChainableConstructor":154,"../../common/var/namespaceAliases":182,"./arrayCreate":37}],56:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayIntersectOrSubtract = require('./internal/arrayIntersectOrSubtract');

Sugar.Array.defineInstance({

  'intersect': function(arr1, arr2) {
    return arrayIntersectOrSubtract(arr1, arr2, false);
  }

});

module.exports = Sugar.Array.intersect;
},{"./internal/arrayIntersectOrSubtract":41,"sugar-core":3}],57:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Array.defineInstance({

  'isEmpty': function(arr) {
    return arr.length === 0;
  }

});

module.exports = Sugar.Array.isEmpty;
},{"sugar-core":3}],58:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isEqual = require('../common/internal/isEqual');

Sugar.Array.defineInstance({

  'isEqual': function(a, b) {
    return isEqual(a, b);
  }

});

module.exports = Sugar.Array.isEqual;
},{"../common/internal/isEqual":135,"sugar-core":3}],59:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'last': function(arr, num) {
    if (isUndefined(num)) return arr[arr.length - 1];
    var start = arr.length - num < 0 ? 0 : arr.length - num;
    return arr.slice(start);
  }

});

module.exports = Sugar.Array.last;
},{"../common/internal/isUndefined":140,"sugar-core":3}],60:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Array.defineInstance({

  'least': function(arr, all, map) {
    return getLeastOrMost(arr, all, map);
  }

});

module.exports = Sugar.Array.least;
},{"../enumerable/internal/getLeastOrMost":400,"sugar-core":3}],61:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    enhancedMap = require('../enumerable/var/enhancedMap'),
    fixArgumentLength = require('../common/internal/fixArgumentLength');

Sugar.Array.defineInstance({

  'map': fixArgumentLength(enhancedMap)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.map;
},{"../common/internal/fixArgumentLength":113,"../common/var/ENHANCEMENTS_FLAG":166,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":413,"../enumerable/var/enhancedMap":414,"sugar-core":3}],62:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.mapFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],63:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Array.defineInstance({

  'max': function(arr, all, map) {
    return getMinOrMax(arr, all, map, true);
  }

});

module.exports = Sugar.Array.max;
},{"../enumerable/internal/getMinOrMax":401,"sugar-core":3}],64:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    median = require('../enumerable/internal/median');

Sugar.Array.defineInstance({

  'median': function(arr, map) {
    return median(arr, map);
  }

});

module.exports = Sugar.Array.median;
},{"../enumerable/internal/median":403,"sugar-core":3}],65:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Array.defineInstance({

  'min': function(arr, all, map) {
    return getMinOrMax(arr, all, map);
  }

});

module.exports = Sugar.Array.min;
},{"../enumerable/internal/getMinOrMax":401,"sugar-core":3}],66:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Array.defineInstance({

  'most': function(arr, all, map) {
    return getLeastOrMost(arr, all, map, true);
  }

});

module.exports = Sugar.Array.most;
},{"../enumerable/internal/getLeastOrMost":400,"sugar-core":3}],67:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayNone = require('../enumerable/internal/arrayNone'),
    fixArgumentLength = require('../common/internal/fixArgumentLength');

Sugar.Array.defineInstance({

  'none': fixArgumentLength(arrayNone)

});

module.exports = Sugar.Array.none;
},{"../common/internal/fixArgumentLength":113,"../enumerable/internal/arrayNone":392,"sugar-core":3}],68:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.reduceFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],69:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.reduceRightFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],70:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayRemove = require('./internal/arrayRemove');

Sugar.Array.defineInstance({

  'remove': function(arr, f) {
    return arrayRemove(arr, f);
  }

});

module.exports = Sugar.Array.remove;
},{"./internal/arrayRemove":42,"sugar-core":3}],71:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'removeAt': function(arr, start, end) {
    if (isUndefined(start)) return arr;
    if (isUndefined(end))   end = start;
    arr.splice(start, end - start + 1);
    return arr;
  }

});

module.exports = Sugar.Array.removeAt;
},{"../common/internal/isUndefined":140,"sugar-core":3}],72:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trunc = require('../common/var/trunc'),
    arrayClone = require('./internal/arrayClone'),
    classChecks = require('../common/var/classChecks'),
    isUndefined = require('../common/internal/isUndefined'),
    mathAliases = require('../common/var/mathAliases');

var isBoolean = classChecks.isBoolean,
    min = mathAliases.min;

Sugar.Array.defineInstance({

  'sample': function(arr, arg1, arg2) {
    var result = [], num, remove, single;
    if (isBoolean(arg1)) {
      remove = arg1;
    } else {
      num = arg1;
      remove = arg2;
    }
    if (isUndefined(num)) {
      num = 1;
      single = true;
    }
    if (!remove) {
      arr = arrayClone(arr);
    }
    num = min(num, arr.length);
    for (var i = 0, index; i < num; i++) {
      index = trunc(Math.random() * arr.length);
      result.push(arr[index]);
      arr.splice(index, 1);
    }
    return single ? result[0] : result;
  }

});

module.exports = Sugar.Array.sample;
},{"../common/internal/isUndefined":140,"../common/var/classChecks":177,"../common/var/mathAliases":180,"../common/var/trunc":183,"./internal/arrayClone":34,"sugar-core":3}],73:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ARRAY_OPTIONS = require('./var/ARRAY_OPTIONS');

var _arrayOptions = ARRAY_OPTIONS._arrayOptions;

module.exports = Sugar.Array.setOption;
},{"./var/ARRAY_OPTIONS":83,"sugar-core":3}],74:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayShuffle = require('./internal/arrayShuffle');

Sugar.Array.defineInstance({

  'shuffle': function(arr) {
    return arrayShuffle(arr);
  }

});

module.exports = Sugar.Array.shuffle;
},{"./internal/arrayShuffle":44,"sugar-core":3}],75:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedSome = enhancedMatcherMethods.enhancedSome;

Sugar.Array.defineInstance({

  'some': fixArgumentLength(enhancedSome)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.some;
},{"../common/internal/fixArgumentLength":113,"../common/var/ENHANCEMENTS_FLAG":166,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":413,"../enumerable/var/enhancedMatcherMethods":415,"sugar-core":3}],76:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.someFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":389,"sugar-core":3}],77:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    compareValue = require('./internal/compareValue'),
    mapWithShortcuts = require('../common/internal/mapWithShortcuts');

Sugar.Array.defineInstance({

  'sortBy': function(arr, map, desc) {
    arr.sort(function(a, b) {
      var aProperty = mapWithShortcuts(a, map, arr, [a]);
      var bProperty = mapWithShortcuts(b, map, arr, [b]);
      return compareValue(aProperty, bProperty) * (desc ? -1 : 1);
    });
    return arr;
  }

});

module.exports = Sugar.Array.sortBy;
},{"../common/internal/mapWithShortcuts":145,"./internal/compareValue":48,"sugar-core":3}],78:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayIntersectOrSubtract = require('./internal/arrayIntersectOrSubtract');

Sugar.Array.defineInstance({

  'subtract': function(arr, item) {
    return arrayIntersectOrSubtract(arr, item, true);
  }

});

module.exports = Sugar.Array.subtract;
},{"./internal/arrayIntersectOrSubtract":41,"sugar-core":3}],79:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    sum = require('../enumerable/internal/sum');

Sugar.Array.defineInstance({

  'sum': function(arr, map) {
    return sum(arr, map);
  }

});

module.exports = Sugar.Array.sum;
},{"../enumerable/internal/sum":410,"sugar-core":3}],80:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'to': function(arr, num) {
    if (isUndefined(num)) num = arr.length;
    return arr.slice(0, num);
  }

});

module.exports = Sugar.Array.to;
},{"../common/internal/isUndefined":140,"sugar-core":3}],81:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayUnique = require('./internal/arrayUnique'),
    arrayConcat = require('./internal/arrayConcat');

Sugar.Array.defineInstance({

  'union': function(arr1, arr2) {
    return arrayUnique(arrayConcat(arr1, arr2));
  }

});

module.exports = Sugar.Array.union;
},{"./internal/arrayConcat":36,"./internal/arrayUnique":45,"sugar-core":3}],82:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayUnique = require('./internal/arrayUnique');

Sugar.Array.defineInstance({

  'unique': function(arr, map) {
    return arrayUnique(arr, map);
  }

});

module.exports = Sugar.Array.unique;
},{"./internal/arrayUnique":45,"sugar-core":3}],83:[function(require,module,exports){
'use strict';

var getSortOrder = require('../internal/getSortOrder'),
    codeIsNumeral = require('../internal/codeIsNumeral'),
    stringToNumber = require('../../common/internal/stringToNumber'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    getSortOrderIndex = require('../internal/getSortOrderIndex'),
    getSortEquivalents = require('../internal/getSortEquivalents'),
    defineOptionsAccessor = require('../../common/internal/defineOptionsAccessor'),
    getCollationCharacter = require('../internal/getCollationCharacter'),
    getCollationReadyString = require('../internal/getCollationReadyString');

var sugarArray = namespaceAliases.sugarArray;

var ARRAY_OPTIONS = {
  'sortIgnore':      null,
  'sortNatural':     true,
  'sortIgnoreCase':  true,
  'sortOrder':       getSortOrder(),
  'sortCollate':     collateStrings,
  'sortEquivalents': getSortEquivalents()
};

var _arrayOptions = defineOptionsAccessor(sugarArray, ARRAY_OPTIONS);

function collateStrings(a, b) {
  var aValue, bValue, aChar, bChar, aEquiv, bEquiv, index = 0, tiebreaker = 0;

  var sortOrder       = _arrayOptions('sortOrder');
  var sortIgnore      = _arrayOptions('sortIgnore');
  var sortNatural     = _arrayOptions('sortNatural');
  var sortIgnoreCase  = _arrayOptions('sortIgnoreCase');
  var sortEquivalents = _arrayOptions('sortEquivalents');

  a = getCollationReadyString(a, sortIgnore, sortIgnoreCase);
  b = getCollationReadyString(b, sortIgnore, sortIgnoreCase);

  do {

    aChar  = getCollationCharacter(a, index, sortEquivalents);
    bChar  = getCollationCharacter(b, index, sortEquivalents);
    aValue = getSortOrderIndex(aChar, sortOrder);
    bValue = getSortOrderIndex(bChar, sortOrder);

    if (aValue === -1 || bValue === -1) {
      aValue = a.charCodeAt(index) || null;
      bValue = b.charCodeAt(index) || null;
      if (sortNatural && codeIsNumeral(aValue) && codeIsNumeral(bValue)) {
        aValue = stringToNumber(a.slice(index));
        bValue = stringToNumber(b.slice(index));
      }
    } else {
      aEquiv = aChar !== a.charAt(index);
      bEquiv = bChar !== b.charAt(index);
      if (aEquiv !== bEquiv && tiebreaker === 0) {
        tiebreaker = aEquiv - bEquiv;
      }
    }
    index += 1;
  } while(aValue != null && bValue != null && aValue === bValue);
  if (aValue === bValue) return tiebreaker;
  return aValue - bValue;
}

module.exports = {
  ARRAY_OPTIONS: ARRAY_OPTIONS,
  _arrayOptions: _arrayOptions
};
},{"../../common/internal/defineOptionsAccessor":109,"../../common/internal/stringToNumber":161,"../../common/var/namespaceAliases":182,"../internal/codeIsNumeral":47,"../internal/getCollationCharacter":49,"../internal/getCollationReadyString":50,"../internal/getSortEquivalents":51,"../internal/getSortOrder":52,"../internal/getSortOrderIndex":53}],84:[function(require,module,exports){
'use strict';

module.exports = 0xff19;
},{}],85:[function(require,module,exports){
'use strict';

module.exports = 0x39;
},{}],86:[function(require,module,exports){
'use strict';

module.exports = !('0' in [].concat(undefined).concat());
},{}],87:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    map = require('../common/internal/map');

Sugar.Array.defineInstanceWithArguments({

  'zip': function(arr, args) {
    return map(arr, function(el, i) {
      return [el].concat(map(args, function(k) {
        return (i in k) ? k[i] : null;
      }));
    });
  }

});

module.exports = Sugar.Array.zip;
},{"../common/internal/map":143,"sugar-core":3}],88:[function(require,module,exports){
'use strict';

function allCharsReg(src) {
  return RegExp('[' + src + ']', 'g');
}

module.exports = allCharsReg;
},{}],89:[function(require,module,exports){
'use strict';

function assertArgument(exists) {
  if (!exists) {
    throw new TypeError('Argument required');
  }
}

module.exports = assertArgument;
},{}],90:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks');

var isArray = classChecks.isArray;

function assertArray(obj) {
  if (!isArray(obj)) {
    throw new TypeError('Array required');
  }
}

module.exports = assertArray;
},{"../var/classChecks":177}],91:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks');

var isFunction = classChecks.isFunction;

function assertCallable(obj) {
  if (!isFunction(obj)) {
    throw new TypeError('Function is not callable');
  }
}

module.exports = assertCallable;
},{"../var/classChecks":177}],92:[function(require,module,exports){
'use strict';

var isPrimitive = require('./isPrimitive');

function assertWritable(obj) {
  if (isPrimitive(obj)) {
    // If strict mode is active then primitives will throw an
    // error when attempting to write properties. We can't be
    // sure if strict mode is available, so pre-emptively
    // throw an error here to ensure consistent behavior.
    throw new TypeError('Property cannot be written');
  }
}

module.exports = assertWritable;
},{"./isPrimitive":138}],93:[function(require,module,exports){
'use strict';

var _utc = require('../var/_utc');

function callDateGet(d, method) {
  return d['get' + (_utc(d) ? 'UTC' : '') + method]();
}

module.exports = callDateGet;
},{"../var/_utc":175}],94:[function(require,module,exports){
'use strict';

var _utc = require('../var/_utc'),
    callDateGet = require('./callDateGet');

function callDateSet(d, method, value, safe) {
  // "Safe" denotes not setting the date if the value is the same as what is
  // currently set. In theory this should be a noop, however it will cause
  // timezone shifts when in the middle of a DST fallback. This is unavoidable
  // as the notation itself is ambiguous (i.e. there are two "1:00ams" on
  // November 1st, 2015 in northern hemisphere timezones that follow DST),
  // however when advancing or rewinding dates this can throw off calculations
  // so avoiding this unintentional shifting on an opt-in basis.
  if (safe && value === callDateGet(d, method, value)) {
    return;
  }
  d['set' + (_utc(d) ? 'UTC' : '') + method](value);
}

module.exports = callDateSet;
},{"../var/_utc":175,"./callDateGet":93}],95:[function(require,module,exports){
'use strict';

var trunc = require('../var/trunc'),
    classChecks = require('../var/classChecks');

var isNumber = classChecks.isNumber;

function coercePositiveInteger(n) {
  n = +n || 0;
  if (n < 0 || !isNumber(n) || !isFinite(n)) {
    throw new RangeError('Invalid number');
  }
  return trunc(n);
}

module.exports = coercePositiveInteger;
},{"../var/classChecks":177,"../var/trunc":183}],96:[function(require,module,exports){
'use strict';

var NO_KEYS_IN_STRING_OBJECTS = require('../var/NO_KEYS_IN_STRING_OBJECTS'),
    isPrimitive = require('./isPrimitive'),
    classChecks = require('../var/classChecks'),
    forceStringCoercion = require('./forceStringCoercion');

var isString = classChecks.isString;

function coercePrimitiveToObject(obj) {
  if (isPrimitive(obj)) {
    obj = Object(obj);
  }
  if (NO_KEYS_IN_STRING_OBJECTS && isString(obj)) {
    forceStringCoercion(obj);
  }
  return obj;
}

module.exports = coercePrimitiveToObject;
},{"../var/NO_KEYS_IN_STRING_OBJECTS":170,"../var/classChecks":177,"./forceStringCoercion":115,"./isPrimitive":138}],97:[function(require,module,exports){
'use strict';

var forEach = require('./forEach'),
    spaceSplit = require('./spaceSplit'),
    classChecks = require('../var/classChecks');

var isString = classChecks.isString;

function collectSimilarMethods(set, fn) {
  var methods = {};
  if (isString(set)) {
    set = spaceSplit(set);
  }
  forEach(set, function(el, i) {
    fn(methods, el, i);
  });
  return methods;
}

module.exports = collectSimilarMethods;
},{"../var/classChecks":177,"./forEach":114,"./spaceSplit":160}],98:[function(require,module,exports){
'use strict';

var CommonChars = require('../var/CommonChars');

var HALF_WIDTH_COMMA = CommonChars.HALF_WIDTH_COMMA;

function commaSplit(str) {
  return str.split(HALF_WIDTH_COMMA);
}

module.exports = commaSplit;
},{"../var/CommonChars":165}],99:[function(require,module,exports){
'use strict';

var STRING_FORMAT_REG = require('../var/STRING_FORMAT_REG'),
    CommonChars = require('../var/CommonChars'),
    memoizeFunction = require('./memoizeFunction');

var OPEN_BRACE = CommonChars.OPEN_BRACE,
    CLOSE_BRACE = CommonChars.CLOSE_BRACE;

function createFormatMatcher(bracketMatcher, percentMatcher, precheck) {

  var reg = STRING_FORMAT_REG;
  var compileMemoized = memoizeFunction(compile);

  function getToken(format, match) {
    var get, token, literal, fn;
    var bKey = match[2];
    var pLit = match[3];
    var pKey = match[5];
    if (match[4] && percentMatcher) {
      token = pKey;
      get = percentMatcher;
    } else if (bKey) {
      token = bKey;
      get = bracketMatcher;
    } else if (pLit && percentMatcher) {
      literal = pLit;
    } else {
      literal = match[1] || match[0];
    }
    if (get) {
      assertPassesPrecheck(precheck, bKey, pKey);
      fn = function(obj, opt) {
        return get(obj, token, opt);
      };
    }
    format.push(fn || getLiteral(literal));
  }

  function getSubstring(format, str, start, end) {
    if (end > start) {
      var sub = str.slice(start, end);
      assertNoUnmatched(sub, OPEN_BRACE);
      assertNoUnmatched(sub, CLOSE_BRACE);
      format.push(function() {
        return sub;
      });
    }
  }

  function getLiteral(str) {
    return function() {
      return str;
    };
  }

  function assertPassesPrecheck(precheck, bt, pt) {
    if (precheck && !precheck(bt, pt)) {
      throw new TypeError('Invalid token '+ (bt || pt) +' in format string');
    }
  }

  function assertNoUnmatched(str, chr) {
    if (str.indexOf(chr) !== -1) {
      throw new TypeError('Unmatched '+ chr +' in format string');
    }
  }

  function compile(str) {
    var format = [], lastIndex = 0, match;
    reg.lastIndex = 0;
    while(match = reg.exec(str)) {
      getSubstring(format, str, lastIndex, match.index);
      getToken(format, match);
      lastIndex = reg.lastIndex;
    }
    getSubstring(format, str, lastIndex, str.length);
    return format;
  }

  return function(str, obj, opt) {
    var format = compileMemoized(str), result = '';
    for (var i = 0; i < format.length; i++) {
      result += format[i](obj, opt);
    }
    return result;
  };
}

module.exports = createFormatMatcher;
},{"../var/CommonChars":165,"../var/STRING_FORMAT_REG":173,"./memoizeFunction":146}],100:[function(require,module,exports){
'use strict';

function dateMatcher(d) {
  var ms = d.getTime();
  return function(el) {
    return !!(el && el.getTime) && el.getTime() === ms;
  };
}

module.exports = dateMatcher;
},{}],101:[function(require,module,exports){
'use strict';

var handleDeepProperty = require('./handleDeepProperty');

function deepGetProperty(obj, key, any) {
  return handleDeepProperty(obj, key, any, false);
}

module.exports = deepGetProperty;
},{"./handleDeepProperty":127}],102:[function(require,module,exports){
'use strict';

var handleDeepProperty = require('./handleDeepProperty');

function deepHasProperty(obj, key, any) {
  return handleDeepProperty(obj, key, any, true);
}

module.exports = deepHasProperty;
},{"./handleDeepProperty":127}],103:[function(require,module,exports){
'use strict';

var handleDeepProperty = require('./handleDeepProperty');

function deepSetProperty(obj, key, val) {
  handleDeepProperty(obj, key, false, false, true, false, val);
  return obj;
}

module.exports = deepSetProperty;
},{"./handleDeepProperty":127}],104:[function(require,module,exports){
'use strict';

var isEqual = require('./isEqual');

function defaultMatcher(f) {
  return function(el) {
    return isEqual(el, f);
  };
}

module.exports = defaultMatcher;
},{"./isEqual":135}],105:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var setProperty = coreUtilityAliases.setProperty;

function defineAccessor(namespace, name, fn) {
  setProperty(namespace, name, fn);
}

module.exports = defineAccessor;
},{"../var/coreUtilityAliases":178}],106:[function(require,module,exports){
'use strict';

var methodDefineAliases = require('../var/methodDefineAliases'),
    collectSimilarMethods = require('./collectSimilarMethods');

var defineInstanceAndStatic = methodDefineAliases.defineInstanceAndStatic;

function defineInstanceAndStaticSimilar(sugarNamespace, set, fn, flags) {
  defineInstanceAndStatic(sugarNamespace, collectSimilarMethods(set, fn), flags);
}

module.exports = defineInstanceAndStaticSimilar;
},{"../var/methodDefineAliases":181,"./collectSimilarMethods":97}],107:[function(require,module,exports){
'use strict';

var methodDefineAliases = require('../var/methodDefineAliases'),
    collectSimilarMethods = require('./collectSimilarMethods');

var defineInstance = methodDefineAliases.defineInstance;

function defineInstanceSimilar(sugarNamespace, set, fn, flags) {
  defineInstance(sugarNamespace, collectSimilarMethods(set, fn), flags);
}

module.exports = defineInstanceSimilar;
},{"../var/methodDefineAliases":181,"./collectSimilarMethods":97}],108:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function defineOnPrototype(ctor, methods) {
  var proto = ctor.prototype;
  forEachProperty(methods, function(val, key) {
    proto[key] = val;
  });
}

module.exports = defineOnPrototype;
},{"../var/coreUtilityAliases":178}],109:[function(require,module,exports){
'use strict';

var simpleClone = require('./simpleClone'),
    defineAccessor = require('./defineAccessor'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function defineOptionsAccessor(namespace, defaults) {
  var obj = simpleClone(defaults);

  function getOption(name) {
    return obj[name];
  }

  function setOption(arg1, arg2) {
    var options;
    if (arguments.length === 1) {
      options = arg1;
    } else {
      options = {};
      options[arg1] = arg2;
    }
    forEachProperty(options, function(val, name) {
      if (val === null) {
        val = defaults[name];
      }
      obj[name] = val;
    });
  }

  defineAccessor(namespace, 'getOption', getOption);
  defineAccessor(namespace, 'setOption', setOption);
  return getOption;
}

module.exports = defineOptionsAccessor;
},{"../var/coreUtilityAliases":178,"./defineAccessor":105,"./simpleClone":157}],110:[function(require,module,exports){
'use strict';

var getNormalizedIndex = require('./getNormalizedIndex');

function entryAtIndex(obj, index, length, loop, isString) {
  index = getNormalizedIndex(index, length, loop);
  return isString ? obj.charAt(index) : obj[index];
}

module.exports = entryAtIndex;
},{"./getNormalizedIndex":122}],111:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks');

var isString = classChecks.isString;

function escapeRegExp(str) {
  if (!isString(str)) str = String(str);
  return str.replace(/([\\\/\'*+?|()\[\]{}.^$-])/g,'\\$1');
}

module.exports = escapeRegExp;
},{"../var/classChecks":177}],112:[function(require,module,exports){
'use strict';

function filter(arr, fn) {
  var result = [];
  for (var i = 0, len = arr.length; i < len; i++) {
    var el = arr[i];
    if (i in arr && fn(el, i)) {
      result.push(el);
    }
  }
  return result;
}

module.exports = filter;
},{}],113:[function(require,module,exports){
'use strict';

function fixArgumentLength(fn) {
  var staticFn = function(a) {
    var args = arguments;
    return fn(a, args[1], args[2], args.length - 1);
  };
  staticFn.instance = function(b) {
    var args = arguments;
    return fn(this, b, args[1], args.length);
  };
  return staticFn;
}

module.exports = fixArgumentLength;
},{}],114:[function(require,module,exports){
'use strict';

var iterateOverSparseArray = require('./iterateOverSparseArray');

function forEach(arr, fn) {
  for (var i = 0, len = arr.length; i < len; i++) {
    if (!(i in arr)) {
      return iterateOverSparseArray(arr, fn, i);
    }
    fn(arr[i], i);
  }
}

module.exports = forEach;
},{"./iterateOverSparseArray":141}],115:[function(require,module,exports){
'use strict';

function forceStringCoercion(obj) {
  var i = 0, chr;
  while (chr = obj.charAt(i)) {
    obj[i++] = chr;
  }
}

module.exports = forceStringCoercion;
},{}],116:[function(require,module,exports){
'use strict';

function functionMatcher(fn) {
  return function(el, i, arr) {
    // Return true up front if match by reference
    return el === fn || fn.call(arr, el, i, arr);
  };
}

module.exports = functionMatcher;
},{}],117:[function(require,module,exports){
'use strict';

var Inflections = require('../var/Inflections');

function getAcronym(str) {
  return Inflections.acronyms && Inflections.acronyms.find(str);
}

module.exports = getAcronym;
},{"../var/Inflections":168}],118:[function(require,module,exports){
'use strict';

var forEach = require('./forEach'),
    classChecks = require('../var/classChecks'),
    entryAtIndex = require('./entryAtIndex');

var isArray = classChecks.isArray;

function getEntriesForIndexes(obj, find, loop, isString) {
  var result, length = obj.length;
  if (!isArray(find)) {
    return entryAtIndex(obj, find, length, loop, isString);
  }
  result = new Array(find.length);
  forEach(find, function(index, i) {
    result[i] = entryAtIndex(obj, index, length, loop, isString);
  });
  return result;
}

module.exports = getEntriesForIndexes;
},{"../var/classChecks":177,"./entryAtIndex":110,"./forEach":114}],119:[function(require,module,exports){
'use strict';

var Inflections = require('../var/Inflections');

function getHumanWord(str) {
  return Inflections.human && Inflections.human.find(str);
}

module.exports = getHumanWord;
},{"../var/Inflections":168}],120:[function(require,module,exports){
'use strict';

function getKeys(obj) {
  return Object.keys(obj);
}

module.exports = getKeys;
},{}],121:[function(require,module,exports){
'use strict';

var isPrimitive = require('./isPrimitive'),
    classChecks = require('../var/classChecks'),
    dateMatcher = require('./dateMatcher'),
    regexMatcher = require('./regexMatcher'),
    isObjectType = require('./isObjectType'),
    isPlainObject = require('./isPlainObject'),
    defaultMatcher = require('./defaultMatcher'),
    functionMatcher = require('./functionMatcher'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn,
    classToString = coreUtilityAliases.classToString,
    forEachProperty = coreUtilityAliases.forEachProperty,
    isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction;

function getMatcher(f) {
  if (!isPrimitive(f)) {
    var className = classToString(f);
    if (isRegExp(f, className)) {
      return regexMatcher(f);
    } else if (isDate(f, className)) {
      return dateMatcher(f);
    } else if (isFunction(f, className)) {
      return functionMatcher(f);
    } else if (isPlainObject(f, className)) {
      return fuzzyMatcher(f);
    }
  }
  // Default is standard isEqual
  return defaultMatcher(f);
}

function fuzzyMatcher(obj) {
  var matchers = {};
  return function(el, i, arr) {
    var matched = true;
    if (!isObjectType(el)) {
      return false;
    }
    forEachProperty(obj, function(val, key) {
      matchers[key] = getOwn(matchers, key) || getMatcher(val);
      if (matchers[key].call(arr, el[key], i, arr) === false) {
        matched = false;
      }
      return matched;
    });
    return matched;
  };
}

module.exports = getMatcher;
},{"../var/classChecks":177,"../var/coreUtilityAliases":178,"./dateMatcher":100,"./defaultMatcher":104,"./functionMatcher":116,"./isObjectType":136,"./isPlainObject":137,"./isPrimitive":138,"./regexMatcher":150}],122:[function(require,module,exports){
'use strict';

function getNormalizedIndex(index, length, loop) {
  if (index && loop) {
    index = index % length;
  }
  if (index < 0) index = length + index;
  return index;
}

module.exports = getNormalizedIndex;
},{}],123:[function(require,module,exports){
'use strict';

function getOrdinalSuffix(num) {
  if (num >= 11 && num <= 13) {
    return 'th';
  } else {
    switch(num % 10) {
      case 1:  return 'st';
      case 2:  return 'nd';
      case 3:  return 'rd';
      default: return 'th';
    }
  }
}

module.exports = getOrdinalSuffix;
},{}],124:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function getOwnKey(obj, key) {
  if (hasOwn(obj, key)) {
    return key;
  }
}

module.exports = getOwnKey;
},{"../var/coreUtilityAliases":178}],125:[function(require,module,exports){
'use strict';

function getRegExpFlags(reg, add) {
  var flags = '';
  add = add || '';
  function checkFlag(prop, flag) {
    if (prop || add.indexOf(flag) > -1) {
      flags += flag;
    }
  }
  checkFlag(reg.global, 'g');
  checkFlag(reg.ignoreCase, 'i');
  checkFlag(reg.multiline, 'm');
  checkFlag(reg.sticky, 'y');
  return flags;
}

module.exports = getRegExpFlags;
},{}],126:[function(require,module,exports){
'use strict';

var isArrayIndex = require('./isArrayIndex');

function getSparseArrayIndexes(arr, fromIndex, loop, fromRight) {
  var indexes = [], i;
  for (i in arr) {
    if (isArrayIndex(i) && (loop || (fromRight ? i <= fromIndex : i >= fromIndex))) {
      indexes.push(+i);
    }
  }
  indexes.sort(function(a, b) {
    var aLoop = a > fromIndex;
    var bLoop = b > fromIndex;
    if (aLoop !== bLoop) {
      return aLoop ? -1 : 1;
    }
    return a - b;
  });
  return indexes;
}

module.exports = getSparseArrayIndexes;
},{"./isArrayIndex":132}],127:[function(require,module,exports){
'use strict';

var PROPERTY_RANGE_REG = require('../var/PROPERTY_RANGE_REG'),
    CommonChars = require('../var/CommonChars'),
    isDefined = require('./isDefined'),
    classChecks = require('../var/classChecks'),
    periodSplit = require('./periodSplit'),
    assertArray = require('./assertArray'),
    isObjectType = require('./isObjectType'),
    assertWritable = require('./assertWritable'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var isString = classChecks.isString,
    hasOwn = coreUtilityAliases.hasOwn,
    HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD;

function handleDeepProperty(obj, key, any, has, fill, fillLast, val) {
  var ns, bs, ps, cbi, set, isLast, isPush, isIndex, nextIsIndex, exists;
  ns = obj || undefined;
  if (key == null) return;

  if (isObjectType(key)) {
    // Allow array and array-like accessors
    bs = [key];
  } else {
    key = String(key);
    if (key.indexOf('..') !== -1) {
      return handleArrayIndexRange(obj, key, any, val);
    }
    bs = key.split('[');
  }

  set = isDefined(val);

  for (var i = 0, blen = bs.length; i < blen; i++) {
    ps = bs[i];

    if (isString(ps)) {
      ps = periodSplit(ps);
    }

    for (var j = 0, plen = ps.length; j < plen; j++) {
      key = ps[j];

      // Is this the last key?
      isLast = i === blen - 1 && j === plen - 1;

      // Index of the closing ]
      cbi = key.indexOf(']');

      // Is the key an array index?
      isIndex = cbi !== -1;

      // Is this array push syntax "[]"?
      isPush = set && cbi === 0;

      // If the bracket split was successful and this is the last element
      // in the dot split, then we know the next key will be an array index.
      nextIsIndex = blen > 1 && j === plen - 1;

      if (isPush) {
        // Set the index to the end of the array
        key = ns.length;
      } else if (isIndex) {
        // Remove the closing ]
        key = key.slice(0, -1);
      }

      // If the array index is less than 0, then
      // add its length to allow negative indexes.
      if (isIndex && key < 0) {
        key = +key + ns.length;
      }

      // Bracket keys may look like users[5] or just [5], so the leading
      // characters are optional. We can enter the namespace if this is the
      // 2nd part, if there is only 1 part, or if there is an explicit key.
      if (i || key || blen === 1) {

        exists = any ? key in ns : hasOwn(ns, key);

        // Non-existent namespaces are only filled if they are intermediate
        // (not at the end) or explicitly filling the last.
        if (fill && (!isLast || fillLast) && !exists) {
          // For our purposes, last only needs to be an array.
          ns = ns[key] = nextIsIndex || (fillLast && isLast) ? [] : {};
          continue;
        }

        if (has) {
          if (isLast || !exists) {
            return exists;
          }
        } else if (set && isLast) {
          assertWritable(ns);
          ns[key] = val;
        }

        ns = exists ? ns[key] : undefined;
      }

    }
  }
  return ns;
}

function handleArrayIndexRange(obj, key, any, val) {
  var match, start, end, leading, trailing, arr, set;
  match = key.match(PROPERTY_RANGE_REG);
  if (!match) {
    return;
  }

  set = isDefined(val);
  leading = match[1];

  if (leading) {
    arr = handleDeepProperty(obj, leading, any, false, set ? true : false, true);
  } else {
    arr = obj;
  }

  assertArray(arr);

  trailing = match[4];
  start    = match[2] ? +match[2] : 0;
  end      = match[3] ? +match[3] : arr.length;

  // A range of 0..1 is inclusive, so we need to add 1 to the end. If this
  // pushes the index from -1 to 0, then set it to the full length of the
  // array, otherwise it will return nothing.
  end = end === -1 ? arr.length : end + 1;

  if (set) {
    for (var i = start; i < end; i++) {
      handleDeepProperty(arr, i + trailing, any, false, true, false, val);
    }
  } else {
    arr = arr.slice(start, end);

    // If there are trailing properties, then they need to be mapped for each
    // element in the array.
    if (trailing) {
      if (trailing.charAt(0) === HALF_WIDTH_PERIOD) {
        // Need to chomp the period if one is trailing after the range. We
        // can't do this at the regex level because it will be required if
        // we're setting the value as it needs to be concatentated together
        // with the array index to be set.
        trailing = trailing.slice(1);
      }
      return arr.map(function(el) {
        return handleDeepProperty(el, trailing);
      });
    }
  }
  return arr;
}

module.exports = handleDeepProperty;
},{"../var/CommonChars":165,"../var/PROPERTY_RANGE_REG":172,"../var/classChecks":177,"../var/coreUtilityAliases":178,"./assertArray":90,"./assertWritable":92,"./isDefined":134,"./isObjectType":136,"./periodSplit":148}],128:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function hasOwnEnumeratedProperties(obj) {
  // Plain objects are generally defined as having enumerated properties
  // all their own, however in early IE environments without defineProperty,
  // there may also be enumerated methods in the prototype chain, so check
  // for both of these cases.
  var objectProto = Object.prototype;
  for (var key in obj) {
    var val = obj[key];
    if (!hasOwn(obj, key) && val !== objectProto[key]) {
      return false;
    }
  }
  return true;
}

module.exports = hasOwnEnumeratedProperties;
},{"../var/coreUtilityAliases":178}],129:[function(require,module,exports){
'use strict';

var isPrimitive = require('./isPrimitive');

function hasProperty(obj, prop) {
  return !isPrimitive(obj) && prop in obj;
}

module.exports = hasProperty;
},{"./isPrimitive":138}],130:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function hasValidPlainObjectPrototype(obj) {
  var hasToString = 'toString' in obj;
  var hasConstructor = 'constructor' in obj;
  // An object created with Object.create(null) has no methods in the
  // prototype chain, so check if any are missing. The additional hasToString
  // check is for false positives on some host objects in old IE which have
  // toString but no constructor. If the object has an inherited constructor,
  // then check if it is Object (the "isPrototypeOf" tapdance here is a more
  // robust way of ensuring this if the global has been hijacked). Note that
  // accessing the constructor directly (without "in" or "hasOwnProperty")
  // will throw a permissions error in IE8 on cross-domain windows.
  return (!hasConstructor && !hasToString) ||
          (hasConstructor && !hasOwn(obj, 'constructor') &&
           hasOwn(obj.constructor.prototype, 'isPrototypeOf'));
}

module.exports = hasValidPlainObjectPrototype;
},{"../var/coreUtilityAliases":178}],131:[function(require,module,exports){
'use strict';

function indexOf(arr, el) {
  for (var i = 0, len = arr.length; i < len; i++) {
    if (i in arr && arr[i] === el) return i;
  }
  return -1;
}

module.exports = indexOf;
},{}],132:[function(require,module,exports){
'use strict';

function isArrayIndex(n) {
  return n >>> 0 == n && n != 0xFFFFFFFF;
}

module.exports = isArrayIndex;
},{}],133:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var classToString = coreUtilityAliases.classToString;

function isClass(obj, className, str) {
  if (!str) {
    str = classToString(obj);
  }
  return str === '[object '+ className +']';
}

module.exports = isClass;
},{"../var/coreUtilityAliases":178}],134:[function(require,module,exports){
'use strict';

function isDefined(o) {
  return o !== undefined;
}

module.exports = isDefined;
},{}],135:[function(require,module,exports){
'use strict';

var getKeys = require('./getKeys'),
    setToArray = require('./setToArray'),
    mapToArray = require('./mapToArray'),
    classChecks = require('../var/classChecks'),
    isObjectType = require('./isObjectType'),
    coreUtilityAliases = require('../var/coreUtilityAliases'),
    iterateWithCyclicCheck = require('./iterateWithCyclicCheck');

var classToString = coreUtilityAliases.classToString,
    isSerializable = classChecks.isSerializable,
    isSet = classChecks.isSet,
    isMap = classChecks.isMap,
    isError = classChecks.isError;

function isEqual(a, b, stack) {
  var aClass, bClass;
  if (a === b) {
    // Return quickly up front when matched by reference,
    // but be careful about 0 !== -0.
    return a !== 0 || 1 / a === 1 / b;
  }
  aClass = classToString(a);
  bClass = classToString(b);
  if (aClass !== bClass) {
    return false;
  }

  if (isSerializable(a, aClass) && isSerializable(b, bClass)) {
    return objectIsEqual(a, b, aClass, stack);
  } else if (isSet(a, aClass) && isSet(b, bClass)) {
    return a.size === b.size && isEqual(setToArray(a), setToArray(b), stack);
  } else if (isMap(a, aClass) && isMap(b, bClass)) {
    return a.size === b.size && isEqual(mapToArray(a), mapToArray(b), stack);
  } else if (isError(a, aClass) && isError(b, bClass)) {
    return a.toString() === b.toString();
  }

  return false;
}

function objectIsEqual(a, b, aClass, stack) {
  var aType = typeof a, bType = typeof b, propsEqual, count;
  if (aType !== bType) {
    return false;
  }
  if (isObjectType(a.valueOf())) {
    if (a.length !== b.length) {
      // perf: Quickly returning up front for arrays.
      return false;
    }
    count = 0;
    propsEqual = true;
    iterateWithCyclicCheck(a, false, stack, function(key, val, cyc, stack) {
      if (!cyc && (!(key in b) || !isEqual(val, b[key], stack))) {
        propsEqual = false;
      }
      count++;
      return propsEqual;
    });
    if (!propsEqual || count !== getKeys(b).length) {
      return false;
    }
  }
  // Stringifying the value handles NaN, wrapped primitives, dates, and errors in one go.
  return a.valueOf().toString() === b.valueOf().toString();
}

module.exports = isEqual;
},{"../var/classChecks":177,"../var/coreUtilityAliases":178,"./getKeys":120,"./isObjectType":136,"./iterateWithCyclicCheck":142,"./mapToArray":144,"./setToArray":155}],136:[function(require,module,exports){
'use strict';

function isObjectType(obj, type) {
  return !!obj && (type || typeof obj) === 'object';
}

module.exports = isObjectType;
},{}],137:[function(require,module,exports){
'use strict';

var isClass = require('./isClass'),
    isObjectType = require('./isObjectType'),
    hasOwnEnumeratedProperties = require('./hasOwnEnumeratedProperties'),
    hasValidPlainObjectPrototype = require('./hasValidPlainObjectPrototype');

function isPlainObject(obj, className) {
  return isObjectType(obj) &&
         isClass(obj, 'Object', className) &&
         hasValidPlainObjectPrototype(obj) &&
         hasOwnEnumeratedProperties(obj);
}

module.exports = isPlainObject;
},{"./hasOwnEnumeratedProperties":128,"./hasValidPlainObjectPrototype":130,"./isClass":133,"./isObjectType":136}],138:[function(require,module,exports){
'use strict';

function isPrimitive(obj, type) {
  type = type || typeof obj;
  return obj == null || type === 'string' || type === 'number' || type === 'boolean';
}

module.exports = isPrimitive;
},{}],139:[function(require,module,exports){
'use strict';

function isRealNaN(obj) {
  // This is only true of NaN
  return obj != null && obj !== obj;
}

module.exports = isRealNaN;
},{}],140:[function(require,module,exports){
'use strict';

function isUndefined(o) {
  return o === undefined;
}

module.exports = isUndefined;
},{}],141:[function(require,module,exports){
'use strict';

var getSparseArrayIndexes = require('./getSparseArrayIndexes');

function iterateOverSparseArray(arr, fn, fromIndex, loop) {
  var indexes = getSparseArrayIndexes(arr, fromIndex, loop), index;
  for (var i = 0, len = indexes.length; i < len; i++) {
    index = indexes[i];
    fn.call(arr, arr[index], index, arr);
  }
  return arr;
}

module.exports = iterateOverSparseArray;
},{"./getSparseArrayIndexes":126}],142:[function(require,module,exports){
'use strict';

var getKeys = require('./getKeys'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function iterateWithCyclicCheck(obj, sortedKeys, stack, fn) {

  function next(val, key) {
    var cyc = false;

    // Allowing a step into the structure before triggering this check to save
    // cycles on standard JSON structures and also to try as hard as possible to
    // catch basic properties that may have been modified.
    if (stack.length > 1) {
      var i = stack.length;
      while (i--) {
        if (stack[i] === val) {
          cyc = true;
        }
      }
    }

    stack.push(val);
    fn(key, val, cyc, stack);
    stack.pop();
  }

  function iterateWithSortedKeys() {
    // Sorted keys is required for serialization, where object order
    // does not matter but stringified order does.
    var arr = getKeys(obj).sort(), key;
    for (var i = 0; i < arr.length; i++) {
      key = arr[i];
      next(obj[key], arr[i]);
    }
  }

  // This method for checking for cyclic structures was egregiously stolen from
  // the ingenious method by @kitcambridge from the Underscore script:
  // https://github.com/documentcloud/underscore/issues/240
  if (!stack) {
    stack = [];
  }

  if (sortedKeys) {
    iterateWithSortedKeys();
  } else {
    forEachProperty(obj, next);
  }
}

module.exports = iterateWithCyclicCheck;
},{"../var/coreUtilityAliases":178,"./getKeys":120}],143:[function(require,module,exports){
'use strict';

function map(arr, fn) {
  // perf: Not using fixed array len here as it may be sparse.
  var result = [];
  for (var i = 0, len = arr.length; i < len; i++) {
    if (i in arr) {
      result.push(fn(arr[i], i));
    }
  }
  return result;
}

module.exports = map;
},{}],144:[function(require,module,exports){
'use strict';

function mapToArray(map) {
  var arr = new Array(map.size), i = 0;
  map.forEach(function(val, key) {
    arr[i++] = [key, val];
  });
  return arr;
}

module.exports = mapToArray;
},{}],145:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks'),
    deepGetProperty = require('./deepGetProperty');

var isFunction = classChecks.isFunction,
    isArray = classChecks.isArray;

function mapWithShortcuts(el, f, context, mapArgs) {
  if (!f) {
    return el;
  } else if (f.apply) {
    return f.apply(context, mapArgs || []);
  } else if (isArray(f)) {
    return f.map(function(m) {
      return mapWithShortcuts(el, m, context, mapArgs);
    });
  } else if (isFunction(el[f])) {
    return el[f].call(el);
  } else {
    return deepGetProperty(el, f);
  }
}

module.exports = mapWithShortcuts;
},{"../var/classChecks":177,"./deepGetProperty":101}],146:[function(require,module,exports){
'use strict';

var INTERNAL_MEMOIZE_LIMIT = require('../var/INTERNAL_MEMOIZE_LIMIT'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function memoizeFunction(fn) {
  var memo = {}, counter = 0;

  return function(key) {
    if (hasOwn(memo, key)) {
      return memo[key];
    }
    if (counter === INTERNAL_MEMOIZE_LIMIT) {
      memo = {};
      counter = 0;
    }
    counter++;
    return memo[key] = fn(key);
  };
}

module.exports = memoizeFunction;
},{"../var/INTERNAL_MEMOIZE_LIMIT":167,"../var/coreUtilityAliases":178}],147:[function(require,module,exports){
'use strict';

var mathAliases = require('../var/mathAliases'),
    repeatString = require('./repeatString');

var abs = mathAliases.abs;

function padNumber(num, place, sign, base, replacement) {
  var str = abs(num).toString(base || 10);
  str = repeatString(replacement || '0', place - str.replace(/\.\d+/, '').length) + str;
  if (sign || num < 0) {
    str = (num < 0 ? '-' : '+') + str;
  }
  return str;
}

module.exports = padNumber;
},{"../var/mathAliases":180,"./repeatString":151}],148:[function(require,module,exports){
'use strict';

var CommonChars = require('../var/CommonChars');

var HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD;

function periodSplit(str) {
  return str.split(HALF_WIDTH_PERIOD);
}

module.exports = periodSplit;
},{"../var/CommonChars":165}],149:[function(require,module,exports){
'use strict';

var PRIVATE_PROP_PREFIX = require('../var/PRIVATE_PROP_PREFIX'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var setProperty = coreUtilityAliases.setProperty;

function privatePropertyAccessor(key) {
  var privateKey = PRIVATE_PROP_PREFIX + key;
  return function(obj, val) {
    if (arguments.length > 1) {
      setProperty(obj, privateKey, val);
      return obj;
    }
    return obj[privateKey];
  };
}

module.exports = privatePropertyAccessor;
},{"../var/PRIVATE_PROP_PREFIX":171,"../var/coreUtilityAliases":178}],150:[function(require,module,exports){
'use strict';

function regexMatcher(reg) {
  reg = RegExp(reg);
  return function(el) {
    return reg.test(el);
  };
}

module.exports = regexMatcher;
},{}],151:[function(require,module,exports){
'use strict';

function repeatString(str, num) {
  var result = '';
  str = str.toString();
  while (num > 0) {
    if (num & 1) {
      result += str;
    }
    if (num >>= 1) {
      str += str;
    }
  }
  return result;
}

module.exports = repeatString;
},{}],152:[function(require,module,exports){
'use strict';

var Inflections = require('../var/Inflections');

function runHumanRules(str) {
  return Inflections.human && Inflections.human.runRules(str) || str;
}

module.exports = runHumanRules;
},{"../var/Inflections":168}],153:[function(require,module,exports){
'use strict';

var indexOf = require('./indexOf'),
    isRealNaN = require('./isRealNaN'),
    isPrimitive = require('./isPrimitive'),
    classChecks = require('../var/classChecks'),
    isObjectType = require('./isObjectType'),
    coreUtilityAliases = require('../var/coreUtilityAliases'),
    iterateWithCyclicCheck = require('./iterateWithCyclicCheck');

var classToString = coreUtilityAliases.classToString,
    isSerializable = classChecks.isSerializable;

function serializeInternal(obj, refs, stack) {
  var type = typeof obj, className, value, ref;

  // Return quickly for primitives to save cycles
  if (isPrimitive(obj, type) && !isRealNaN(obj)) {
    return type + obj;
  }

  className = classToString(obj);

  if (!isSerializable(obj, className)) {
    ref = indexOf(refs, obj);
    if (ref === -1) {
      ref = refs.length;
      refs.push(obj);
    }
    return ref;
  } else if (isObjectType(obj)) {
    value = serializeDeep(obj, refs, stack) + obj.toString();
  } else if (1 / obj === -Infinity) {
    value = '-0';
  } else if (obj.valueOf) {
    value = obj.valueOf();
  }
  return type + className + value;
}

function serializeDeep(obj, refs, stack) {
  var result = '';
  iterateWithCyclicCheck(obj, true, stack, function(key, val, cyc, stack) {
    result += cyc ? 'CYC' : key + serializeInternal(val, refs, stack);
  });
  return result;
}

module.exports = serializeInternal;
},{"../var/classChecks":177,"../var/coreUtilityAliases":178,"./indexOf":131,"./isObjectType":136,"./isPrimitive":138,"./isRealNaN":139,"./iterateWithCyclicCheck":142}],154:[function(require,module,exports){
'use strict';

function setChainableConstructor(sugarNamespace, createFn) {
  sugarNamespace.prototype.constructor = function() {
    return createFn.apply(this, arguments);
  };
}

module.exports = setChainableConstructor;
},{}],155:[function(require,module,exports){
'use strict';

function setToArray(set) {
  var arr = new Array(set.size), i = 0;
  set.forEach(function(val) {
    arr[i++] = val;
  });
  return arr;
}

module.exports = setToArray;
},{}],156:[function(require,module,exports){
'use strict';

function simpleCapitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = simpleCapitalize;
},{}],157:[function(require,module,exports){
'use strict';

var simpleMerge = require('./simpleMerge');

function simpleClone(obj) {
  return simpleMerge({}, obj);
}

module.exports = simpleClone;
},{"./simpleMerge":158}],158:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function simpleMerge(target, source) {
  forEachProperty(source, function(val, key) {
    target[key] = val;
  });
  return target;
}

module.exports = simpleMerge;
},{"../var/coreUtilityAliases":178}],159:[function(require,module,exports){
'use strict';

function simpleRepeat(n, fn) {
  for (var i = 0; i < n; i++) {
    fn(i);
  }
}

module.exports = simpleRepeat;
},{}],160:[function(require,module,exports){
'use strict';

function spaceSplit(str) {
  return str.split(' ');
}

module.exports = spaceSplit;
},{}],161:[function(require,module,exports){
'use strict';

var CommonChars = require('../var/CommonChars'),
    coreUtilityAliases = require('../var/coreUtilityAliases'),
    fullwidthNumberHelpers = require('../var/fullwidthNumberHelpers');

var fullWidthNumberReg = fullwidthNumberHelpers.fullWidthNumberReg,
    fullWidthNumberMap = fullwidthNumberHelpers.fullWidthNumberMap,
    getOwn = coreUtilityAliases.getOwn,
    HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD;

function stringToNumber(str, base) {
  var sanitized, isDecimal;
  sanitized = str.replace(fullWidthNumberReg, function(chr) {
    var replacement = getOwn(fullWidthNumberMap, chr);
    if (replacement === HALF_WIDTH_PERIOD) {
      isDecimal = true;
    }
    return replacement;
  });
  return isDecimal ? parseFloat(sanitized) : parseInt(sanitized, base || 10);
}

module.exports = stringToNumber;
},{"../var/CommonChars":165,"../var/coreUtilityAliases":178,"../var/fullwidthNumberHelpers":179}],162:[function(require,module,exports){
'use strict';

function trim(str) {
  return str.trim();
}

module.exports = trim;
},{}],163:[function(require,module,exports){
'use strict';

var mathAliases = require('../var/mathAliases');

var abs = mathAliases.abs,
    pow = mathAliases.pow,
    round = mathAliases.round;

function withPrecision(val, precision, fn) {
  var multiplier = pow(10, abs(precision || 0));
  fn = fn || round;
  if (precision < 0) multiplier = 1 / multiplier;
  return fn(val * multiplier) / multiplier;
}

module.exports = withPrecision;
},{"../var/mathAliases":180}],164:[function(require,module,exports){
'use strict';

function wrapNamespace(method) {
  return function(sugarNamespace, arg1, arg2) {
    sugarNamespace[method](arg1, arg2);
  };
}

module.exports = wrapNamespace;
},{}],165:[function(require,module,exports){
'use strict';

module.exports = {
  HALF_WIDTH_ZERO: 0x30,
  FULL_WIDTH_ZERO: 0xff10,
  HALF_WIDTH_PERIOD: '.',
  FULL_WIDTH_PERIOD: '．',
  HALF_WIDTH_COMMA: ',',
  OPEN_BRACE: '{',
  CLOSE_BRACE: '}'
};
},{}],166:[function(require,module,exports){
'use strict';

module.exports = 'enhance';
},{}],167:[function(require,module,exports){
'use strict';

module.exports = 1000;
},{}],168:[function(require,module,exports){
'use strict';

module.exports = {};
},{}],169:[function(require,module,exports){
'use strict';

module.exports = 'Boolean Number String Date RegExp Function Array Error Set Map';
},{}],170:[function(require,module,exports){
'use strict';

module.exports = !('0' in Object('a'));
},{}],171:[function(require,module,exports){
'use strict';

module.exports = '_sugar_';
},{}],172:[function(require,module,exports){
'use strict';

module.exports = /^(.*?)\[([-\d]*)\.\.([-\d]*)\](.*)$/;
},{}],173:[function(require,module,exports){
'use strict';

module.exports = /([{}])\1|\{([^}]*)\}|(%)%|(%(\w*))/g;
},{}],174:[function(require,module,exports){
'use strict';

module.exports = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';
},{}],175:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('utc');
},{"../internal/privatePropertyAccessor":149}],176:[function(require,module,exports){
'use strict';

module.exports = String.fromCharCode;
},{}],177:[function(require,module,exports){
'use strict';

var NATIVE_TYPES = require('./NATIVE_TYPES'),
    forEach = require('../internal/forEach'),
    isClass = require('../internal/isClass'),
    spaceSplit = require('../internal/spaceSplit'),
    isPlainObject = require('../internal/isPlainObject'),
    coreUtilityAliases = require('./coreUtilityAliases');

var classToString = coreUtilityAliases.classToString;

var isSerializable,
    isBoolean, isNumber, isString,
    isDate, isRegExp, isFunction,
    isArray, isSet, isMap, isError;

function buildClassChecks() {

  var knownTypes = {};

  function addCoreTypes() {

    var names = spaceSplit(NATIVE_TYPES);

    isBoolean = buildPrimitiveClassCheck(names[0]);
    isNumber  = buildPrimitiveClassCheck(names[1]);
    isString  = buildPrimitiveClassCheck(names[2]);

    isDate   = buildClassCheck(names[3]);
    isRegExp = buildClassCheck(names[4]);

    // Wanted to enhance performance here by using simply "typeof"
    // but Firefox has two major issues that make this impossible,
    // one fixed, the other not, so perform a full class check here.
    //
    // 1. Regexes can be typeof "function" in FF < 3
    //    https://bugzilla.mozilla.org/show_bug.cgi?id=61911 (fixed)
    //
    // 2. HTMLEmbedElement and HTMLObjectElement are be typeof "function"
    //    https://bugzilla.mozilla.org/show_bug.cgi?id=268945 (won't fix)
    isFunction = buildClassCheck(names[5]);


    isArray = Array.isArray || buildClassCheck(names[6]);
    isError = buildClassCheck(names[7]);

    isSet = buildClassCheck(names[8], typeof Set !== 'undefined' && Set);
    isMap = buildClassCheck(names[9], typeof Map !== 'undefined' && Map);

    // Add core types as known so that they can be checked by value below,
    // notably excluding Functions and adding Arguments and Error.
    addKnownType('Arguments');
    addKnownType(names[0]);
    addKnownType(names[1]);
    addKnownType(names[2]);
    addKnownType(names[3]);
    addKnownType(names[4]);
    addKnownType(names[6]);

  }

  function addArrayTypes() {
    var types = 'Int8 Uint8 Uint8Clamped Int16 Uint16 Int32 Uint32 Float32 Float64';
    forEach(spaceSplit(types), function(str) {
      addKnownType(str + 'Array');
    });
  }

  function addKnownType(className) {
    var str = '[object '+ className +']';
    knownTypes[str] = true;
  }

  function isKnownType(className) {
    return knownTypes[className];
  }

  function buildClassCheck(className, globalObject) {
    if (globalObject && isClass(new globalObject, 'Object')) {
      return getConstructorClassCheck(globalObject);
    } else {
      return getToStringClassCheck(className);
    }
  }

  function getConstructorClassCheck(obj) {
    var ctorStr = String(obj);
    return function(obj) {
      return String(obj.constructor) === ctorStr;
    };
  }

  function getToStringClassCheck(className) {
    return function(obj, str) {
      // perf: Returning up front on instanceof appears to be slower.
      return isClass(obj, className, str);
    };
  }

  function buildPrimitiveClassCheck(className) {
    var type = className.toLowerCase();
    return function(obj) {
      var t = typeof obj;
      return t === type || t === 'object' && isClass(obj, className);
    };
  }

  addCoreTypes();
  addArrayTypes();

  isSerializable = function(obj, className) {
    // Only known objects can be serialized. This notably excludes functions,
    // host objects, Symbols (which are matched by reference), and instances
    // of classes. The latter can arguably be matched by value, but
    // distinguishing between these and host objects -- which should never be
    // compared by value -- is very tricky so not dealing with it here.
    className = className || classToString(obj);
    return isKnownType(className) || isPlainObject(obj, className);
  };

}

buildClassChecks();

module.exports = {
  isSerializable: isSerializable,
  isBoolean: isBoolean,
  isNumber: isNumber,
  isString: isString,
  isDate: isDate,
  isRegExp: isRegExp,
  isFunction: isFunction,
  isArray: isArray,
  isSet: isSet,
  isMap: isMap,
  isError: isError
};
},{"../internal/forEach":114,"../internal/isClass":133,"../internal/isPlainObject":137,"../internal/spaceSplit":160,"./NATIVE_TYPES":169,"./coreUtilityAliases":178}],178:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

module.exports = {
  hasOwn: Sugar.util.hasOwn,
  getOwn: Sugar.util.getOwn,
  setProperty: Sugar.util.setProperty,
  classToString: Sugar.util.classToString,
  defineProperty: Sugar.util.defineProperty,
  forEachProperty: Sugar.util.forEachProperty,
  mapNativeToChainable: Sugar.util.mapNativeToChainable
};
},{"sugar-core":3}],179:[function(require,module,exports){
'use strict';

var CommonChars = require('./CommonChars'),
    chr = require('./chr'),
    allCharsReg = require('../internal/allCharsReg');

var HALF_WIDTH_ZERO = CommonChars.HALF_WIDTH_ZERO,
    FULL_WIDTH_ZERO = CommonChars.FULL_WIDTH_ZERO,
    HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD,
    FULL_WIDTH_PERIOD = CommonChars.FULL_WIDTH_PERIOD,
    HALF_WIDTH_COMMA = CommonChars.HALF_WIDTH_COMMA;

var fullWidthNumberReg, fullWidthNumberMap, fullWidthNumbers;

function buildFullWidthNumber() {
  var fwp = FULL_WIDTH_PERIOD, hwp = HALF_WIDTH_PERIOD, hwc = HALF_WIDTH_COMMA, fwn = '';
  fullWidthNumberMap = {};
  for (var i = 0, digit; i <= 9; i++) {
    digit = chr(i + FULL_WIDTH_ZERO);
    fwn += digit;
    fullWidthNumberMap[digit] = chr(i + HALF_WIDTH_ZERO);
  }
  fullWidthNumberMap[hwc] = '';
  fullWidthNumberMap[fwp] = hwp;
  // Mapping this to itself to capture it easily
  // in stringToNumber to detect decimals later.
  fullWidthNumberMap[hwp] = hwp;
  fullWidthNumberReg = allCharsReg(fwn + fwp + hwc + hwp);
  fullWidthNumbers = fwn;
}

buildFullWidthNumber();

module.exports = {
  fullWidthNumberReg: fullWidthNumberReg,
  fullWidthNumberMap: fullWidthNumberMap,
  fullWidthNumbers: fullWidthNumbers
};
},{"../internal/allCharsReg":88,"./CommonChars":165,"./chr":176}],180:[function(require,module,exports){
'use strict';

module.exports = {
  abs: Math.abs,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round
};
},{}],181:[function(require,module,exports){
'use strict';

var wrapNamespace = require('../internal/wrapNamespace');

module.exports = {
  alias: wrapNamespace('alias'),
  defineStatic: wrapNamespace('defineStatic'),
  defineInstance: wrapNamespace('defineInstance'),
  defineStaticPolyfill: wrapNamespace('defineStaticPolyfill'),
  defineInstancePolyfill: wrapNamespace('defineInstancePolyfill'),
  defineInstanceAndStatic: wrapNamespace('defineInstanceAndStatic'),
  defineInstanceWithArguments: wrapNamespace('defineInstanceWithArguments')
};
},{"../internal/wrapNamespace":164}],182:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

module.exports = {
  sugarObject: Sugar.Object,
  sugarArray: Sugar.Array,
  sugarDate: Sugar.Date,
  sugarString: Sugar.String,
  sugarNumber: Sugar.Number,
  sugarFunction: Sugar.Function,
  sugarRegExp: Sugar.RegExp
};
},{"sugar-core":3}],183:[function(require,module,exports){
'use strict';

var mathAliases = require('./mathAliases');

var ceil = mathAliases.ceil,
    floor = mathAliases.floor;

var trunc = Math.trunc || function(n) {
  if (n === 0 || !isFinite(n)) return n;
  return n < 0 ? ceil(n) : floor(n);
};

module.exports = trunc;
},{"./mathAliases":180}],184:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addDays;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],185:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addHours;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],186:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'addLocale': function(code, set) {
    return localeManager.add(code, set);
  }

});

module.exports = Sugar.Date.addLocale;
},{"./var/LocaleHelpers":374,"sugar-core":3}],187:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addMilliseconds;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],188:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addMinutes;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],189:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addMonths;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],190:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addSeconds;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],191:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addWeeks;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],192:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addYears;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],193:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    advanceDateWithArgs = require('./internal/advanceDateWithArgs');

Sugar.Date.defineInstanceWithArguments({

  'advance': function(d, args) {
    return advanceDateWithArgs(d, args, 1);
  }

});

module.exports = Sugar.Date.advance;
},{"./internal/advanceDateWithArgs":231,"sugar-core":3}],194:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfDay;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],195:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    resetTime = require('./internal/resetTime'),
    getWeekday = require('./internal/getWeekday'),
    setWeekday = require('./internal/setWeekday');

Sugar.Date.defineInstance({

  'beginningOfISOWeek': function(date) {
    var day = getWeekday(date);
    if (day === 0) {
      day = -6;
    } else if (day !== 1) {
      day = 1;
    }
    setWeekday(date, day);
    return resetTime(date);
  }

});

module.exports = Sugar.Date.beginningOfISOWeek;
},{"./internal/getWeekday":278,"./internal/resetTime":291,"./internal/setWeekday":297,"sugar-core":3}],196:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfMonth;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],197:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfWeek;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],198:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfYear;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],199:[function(require,module,exports){
'use strict';

var buildDateUnitMethods = require('../internal/buildDateUnitMethods');

buildDateUnitMethods();
},{"../internal/buildDateUnitMethods":234}],200:[function(require,module,exports){
'use strict';

var buildNumberUnitMethods = require('../internal/buildNumberUnitMethods');

buildNumberUnitMethods();
},{"../internal/buildNumberUnitMethods":235}],201:[function(require,module,exports){
'use strict';

var buildRelativeAliases = require('../internal/buildRelativeAliases');

buildRelativeAliases();
},{"../internal/buildRelativeAliases":236}],202:[function(require,module,exports){
'use strict';

var setDateChainableConstructor = require('../internal/setDateChainableConstructor');

setDateChainableConstructor();
},{"../internal/setDateChainableConstructor":293}],203:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    cloneDate = require('./internal/cloneDate');

Sugar.Date.defineInstance({

  'clone': function(date) {
    return cloneDate(date);
  }

});

module.exports = Sugar.Date.clone;
},{"./internal/cloneDate":238,"sugar-core":3}],204:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate');

require('./build/setDateChainableConstructorCall');

Sugar.Date.defineStatic({

  'create': function(d, options) {
    return createDate(d, options);
  }

});

module.exports = Sugar.Date.create;
},{"./build/setDateChainableConstructorCall":202,"./internal/createDate":243,"sugar-core":3}],205:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],206:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],207:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getDaysInMonth = require('./internal/getDaysInMonth');

Sugar.Date.defineInstance({

  'daysInMonth': function(date) {
    return getDaysInMonth(date);
  }

});

module.exports = Sugar.Date.daysInMonth;
},{"./internal/getDaysInMonth":259,"sugar-core":3}],208:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],209:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],210:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfDay;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],211:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    DateUnitIndexes = require('./var/DateUnitIndexes'),
    getWeekday = require('./internal/getWeekday'),
    setWeekday = require('./internal/setWeekday'),
    moveToEndOfUnit = require('./internal/moveToEndOfUnit');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

Sugar.Date.defineInstance({

  'endOfISOWeek': function(date) {
    if (getWeekday(date) !== 0) {
      setWeekday(date, 7);
    }
    return moveToEndOfUnit(date, DAY_INDEX);
  }

});

module.exports = Sugar.Date.endOfISOWeek;
},{"./internal/getWeekday":278,"./internal/moveToEndOfUnit":287,"./internal/setWeekday":297,"./var/DateUnitIndexes":367,"sugar-core":3}],212:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfMonth;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],213:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfWeek;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],214:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfYear;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],215:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    dateFormat = require('./internal/dateFormat');

Sugar.Date.defineInstance({

  'format': function(date, f, localeCode) {
    return dateFormat(date, f, localeCode);
  }

});

module.exports = Sugar.Date.format;
},{"./internal/dateFormat":245,"sugar-core":3}],216:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDateWithContext = require('./internal/createDateWithContext');

Sugar.Date.defineInstance({

  'get': function(date, d, options) {
    return createDateWithContext(date, d, options);
  }

});

module.exports = Sugar.Date.get;
},{"./internal/createDateWithContext":244,"sugar-core":3}],217:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers'),
    getKeys = require('../common/internal/getKeys');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'getAllLocaleCodes': function() {
    return getKeys(localeManager.getAll());
  }

});

module.exports = Sugar.Date.getAllLocaleCodes;
},{"../common/internal/getKeys":120,"./var/LocaleHelpers":374,"sugar-core":3}],218:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'getAllLocales': function() {
    return localeManager.getAll();
  }

});

module.exports = Sugar.Date.getAllLocales;
},{"./var/LocaleHelpers":374,"sugar-core":3}],219:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getWeekNumber = require('./internal/getWeekNumber');

Sugar.Date.defineInstance({

  'getISOWeek': function(date) {
    return getWeekNumber(date, true);
  }

});

module.exports = Sugar.Date.getISOWeek;
},{"./internal/getWeekNumber":276,"sugar-core":3}],220:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'getLocale': function(code) {
    return localeManager.get(code, !code);
  }

});

module.exports = Sugar.Date.getLocale;
},{"./var/LocaleHelpers":374,"sugar-core":3}],221:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _dateOptions = require('./var/_dateOptions');

module.exports = Sugar.Date.getOption;
},{"./var/_dateOptions":379,"sugar-core":3}],222:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getUTCOffset = require('./internal/getUTCOffset');

Sugar.Date.defineInstance({

  'getUTCOffset': function(date, iso) {
    return getUTCOffset(date, iso);
  }

});

module.exports = Sugar.Date.getUTCOffset;
},{"./internal/getUTCOffset":274,"sugar-core":3}],223:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Date.defineInstance({

  'getUTCWeekday': function(date) {
    return date.getUTCDay();
  }

});

module.exports = Sugar.Date.getUTCWeekday;
},{"sugar-core":3}],224:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getWeekday = require('./internal/getWeekday');

Sugar.Date.defineInstance({

  'getWeekday': function(date) {
    return getWeekday(date);
  }

});

module.exports = Sugar.Date.getWeekday;
},{"./internal/getWeekday":278,"sugar-core":3}],225:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],226:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],227:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],228:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],229:[function(require,module,exports){
'use strict';

// Static Methods
require('./addLocale');
require('./create');
require('./getAllLocaleCodes');
require('./getAllLocales');
require('./getLocale');
require('./removeLocale');
require('./setLocale');

// Instance Methods
require('../number/day');
require('../number/dayAfter');
require('../number/dayAgo');
require('../number/dayBefore');
require('../number/dayFromNow');
require('../number/days');
require('../number/daysAfter');
require('../number/daysAgo');
require('../number/daysBefore');
require('../number/daysFromNow');
require('../number/duration');
require('../number/hour');
require('../number/hourAfter');
require('../number/hourAgo');
require('../number/hourBefore');
require('../number/hourFromNow');
require('../number/hours');
require('../number/hoursAfter');
require('../number/hoursAgo');
require('../number/hoursBefore');
require('../number/hoursFromNow');
require('../number/millisecond');
require('../number/millisecondAfter');
require('../number/millisecondAgo');
require('../number/millisecondBefore');
require('../number/millisecondFromNow');
require('../number/milliseconds');
require('../number/millisecondsAfter');
require('../number/millisecondsAgo');
require('../number/millisecondsBefore');
require('../number/millisecondsFromNow');
require('../number/minute');
require('../number/minuteAfter');
require('../number/minuteAgo');
require('../number/minuteBefore');
require('../number/minuteFromNow');
require('../number/minutes');
require('../number/minutesAfter');
require('../number/minutesAgo');
require('../number/minutesBefore');
require('../number/minutesFromNow');
require('../number/month');
require('../number/monthAfter');
require('../number/monthAgo');
require('../number/monthBefore');
require('../number/monthFromNow');
require('../number/months');
require('../number/monthsAfter');
require('../number/monthsAgo');
require('../number/monthsBefore');
require('../number/monthsFromNow');
require('../number/second');
require('../number/secondAfter');
require('../number/secondAgo');
require('../number/secondBefore');
require('../number/secondFromNow');
require('../number/seconds');
require('../number/secondsAfter');
require('../number/secondsAgo');
require('../number/secondsBefore');
require('../number/secondsFromNow');
require('../number/week');
require('../number/weekAfter');
require('../number/weekAgo');
require('../number/weekBefore');
require('../number/weekFromNow');
require('../number/weeks');
require('../number/weeksAfter');
require('../number/weeksAgo');
require('../number/weeksBefore');
require('../number/weeksFromNow');
require('../number/year');
require('../number/yearAfter');
require('../number/yearAgo');
require('../number/yearBefore');
require('../number/yearFromNow');
require('../number/years');
require('../number/yearsAfter');
require('../number/yearsAgo');
require('../number/yearsBefore');
require('../number/yearsFromNow');
require('./addDays');
require('./addHours');
require('./addMilliseconds');
require('./addMinutes');
require('./addMonths');
require('./addSeconds');
require('./addWeeks');
require('./addYears');
require('./advance');
require('./beginningOfDay');
require('./beginningOfISOWeek');
require('./beginningOfMonth');
require('./beginningOfWeek');
require('./beginningOfYear');
require('./clone');
require('./daysAgo');
require('./daysFromNow');
require('./daysInMonth');
require('./daysSince');
require('./daysUntil');
require('./endOfDay');
require('./endOfISOWeek');
require('./endOfMonth');
require('./endOfWeek');
require('./endOfYear');
require('./format');
require('./get');
require('./getISOWeek');
require('./getUTCOffset');
require('./getUTCWeekday');
require('./getWeekday');
require('./hoursAgo');
require('./hoursFromNow');
require('./hoursSince');
require('./hoursUntil');
require('./is');
require('./isAfter');
require('./isBefore');
require('./isBetween');
require('./isFriday');
require('./isFuture');
require('./isLastMonth');
require('./isLastWeek');
require('./isLastYear');
require('./isLeapYear');
require('./isMonday');
require('./isNextMonth');
require('./isNextWeek');
require('./isNextYear');
require('./isPast');
require('./isSaturday');
require('./isSunday');
require('./isThisMonth');
require('./isThisWeek');
require('./isThisYear');
require('./isThursday');
require('./isToday');
require('./isTomorrow');
require('./isTuesday');
require('./isUTC');
require('./isValid');
require('./isWednesday');
require('./isWeekday');
require('./isWeekend');
require('./isYesterday');
require('./iso');
require('./millisecondsAgo');
require('./millisecondsFromNow');
require('./millisecondsSince');
require('./millisecondsUntil');
require('./minutesAgo');
require('./minutesFromNow');
require('./minutesSince');
require('./minutesUntil');
require('./monthsAgo');
require('./monthsFromNow');
require('./monthsSince');
require('./monthsUntil');
require('./relative');
require('./relativeTo');
require('./reset');
require('./rewind');
require('./secondsAgo');
require('./secondsFromNow');
require('./secondsSince');
require('./secondsUntil');
require('./set');
require('./setISOWeek');
require('./setUTC');
require('./setWeekday');
require('./weeksAgo');
require('./weeksFromNow');
require('./weeksSince');
require('./weeksUntil');
require('./yearsAgo');
require('./yearsFromNow');
require('./yearsSince');
require('./yearsUntil');

// Accessors
require('./getOption');
require('./setOption');

module.exports = require('sugar-core');
},{"../number/day":452,"../number/dayAfter":453,"../number/dayAgo":454,"../number/dayBefore":455,"../number/dayFromNow":456,"../number/days":457,"../number/daysAfter":458,"../number/daysAgo":459,"../number/daysBefore":460,"../number/daysFromNow":461,"../number/duration":463,"../number/hour":469,"../number/hourAfter":470,"../number/hourAgo":471,"../number/hourBefore":472,"../number/hourFromNow":473,"../number/hours":474,"../number/hoursAfter":475,"../number/hoursAgo":476,"../number/hoursBefore":477,"../number/hoursFromNow":478,"../number/millisecond":492,"../number/millisecondAfter":493,"../number/millisecondAgo":494,"../number/millisecondBefore":495,"../number/millisecondFromNow":496,"../number/milliseconds":497,"../number/millisecondsAfter":498,"../number/millisecondsAgo":499,"../number/millisecondsBefore":500,"../number/millisecondsFromNow":501,"../number/minute":502,"../number/minuteAfter":503,"../number/minuteAgo":504,"../number/minuteBefore":505,"../number/minuteFromNow":506,"../number/minutes":507,"../number/minutesAfter":508,"../number/minutesAgo":509,"../number/minutesBefore":510,"../number/minutesFromNow":511,"../number/month":512,"../number/monthAfter":513,"../number/monthAgo":514,"../number/monthBefore":515,"../number/monthFromNow":516,"../number/months":517,"../number/monthsAfter":518,"../number/monthsAgo":519,"../number/monthsBefore":520,"../number/monthsFromNow":521,"../number/second":528,"../number/secondAfter":529,"../number/secondAgo":530,"../number/secondBefore":531,"../number/secondFromNow":532,"../number/seconds":533,"../number/secondsAfter":534,"../number/secondsAgo":535,"../number/secondsBefore":536,"../number/secondsFromNow":537,"../number/week":548,"../number/weekAfter":549,"../number/weekAgo":550,"../number/weekBefore":551,"../number/weekFromNow":552,"../number/weeks":553,"../number/weeksAfter":554,"../number/weeksAgo":555,"../number/weeksBefore":556,"../number/weeksFromNow":557,"../number/year":558,"../number/yearAfter":559,"../number/yearAgo":560,"../number/yearBefore":561,"../number/yearFromNow":562,"../number/years":563,"../number/yearsAfter":564,"../number/yearsAgo":565,"../number/yearsBefore":566,"../number/yearsFromNow":567,"./addDays":184,"./addHours":185,"./addLocale":186,"./addMilliseconds":187,"./addMinutes":188,"./addMonths":189,"./addSeconds":190,"./addWeeks":191,"./addYears":192,"./advance":193,"./beginningOfDay":194,"./beginningOfISOWeek":195,"./beginningOfMonth":196,"./beginningOfWeek":197,"./beginningOfYear":198,"./clone":203,"./create":204,"./daysAgo":205,"./daysFromNow":206,"./daysInMonth":207,"./daysSince":208,"./daysUntil":209,"./endOfDay":210,"./endOfISOWeek":211,"./endOfMonth":212,"./endOfWeek":213,"./endOfYear":214,"./format":215,"./get":216,"./getAllLocaleCodes":217,"./getAllLocales":218,"./getISOWeek":219,"./getLocale":220,"./getOption":221,"./getUTCOffset":222,"./getUTCWeekday":223,"./getWeekday":224,"./hoursAgo":225,"./hoursFromNow":226,"./hoursSince":227,"./hoursUntil":228,"./is":302,"./isAfter":303,"./isBefore":304,"./isBetween":305,"./isFriday":306,"./isFuture":307,"./isLastMonth":308,"./isLastWeek":309,"./isLastYear":310,"./isLeapYear":311,"./isMonday":312,"./isNextMonth":313,"./isNextWeek":314,"./isNextYear":315,"./isPast":316,"./isSaturday":317,"./isSunday":318,"./isThisMonth":319,"./isThisWeek":320,"./isThisYear":321,"./isThursday":322,"./isToday":323,"./isTomorrow":324,"./isTuesday":325,"./isUTC":326,"./isValid":327,"./isWednesday":328,"./isWeekday":329,"./isWeekend":330,"./isYesterday":331,"./iso":332,"./millisecondsAgo":333,"./millisecondsFromNow":334,"./millisecondsSince":335,"./millisecondsUntil":336,"./minutesAgo":337,"./minutesFromNow":338,"./minutesSince":339,"./minutesUntil":340,"./monthsAgo":341,"./monthsFromNow":342,"./monthsSince":343,"./monthsUntil":344,"./relative":346,"./relativeTo":347,"./removeLocale":348,"./reset":349,"./rewind":350,"./secondsAgo":351,"./secondsFromNow":352,"./secondsSince":353,"./secondsUntil":354,"./set":355,"./setISOWeek":356,"./setLocale":357,"./setOption":358,"./setUTC":359,"./setWeekday":360,"./weeksAgo":381,"./weeksFromNow":382,"./weeksSince":383,"./weeksUntil":384,"./yearsAgo":385,"./yearsFromNow":386,"./yearsSince":387,"./yearsUntil":388,"sugar-core":3}],230:[function(require,module,exports){
'use strict';

var updateDate = require('./updateDate');

function advanceDate(d, unit, num, reset) {
  var set = {};
  set[unit] = num;
  return updateDate(d, set, reset, 1);
}

module.exports = advanceDate;
},{"./updateDate":300}],231:[function(require,module,exports){
'use strict';

var updateDate = require('./updateDate'),
    collectDateArguments = require('./collectDateArguments');

function advanceDateWithArgs(d, args, dir) {
  args = collectDateArguments(args, true);
  return updateDate(d, args[0], args[1], dir);
}

module.exports = advanceDateWithArgs;
},{"./collectDateArguments":239,"./updateDate":300}],232:[function(require,module,exports){
'use strict';

var map = require('../../common/internal/map'),
    escapeRegExp = require('../../common/internal/escapeRegExp');

function arrayToRegAlternates(arr) {
  var joined = arr.join('');
  if (!arr || !arr.length) {
    return '';
  }
  if (joined.length === arr.length) {
    return '[' + joined + ']';
  }
  // map handles sparse arrays so no need to compact the array here.
  return map(arr, escapeRegExp).join('|');
}

module.exports = arrayToRegAlternates;
},{"../../common/internal/escapeRegExp":111,"../../common/internal/map":143}],233:[function(require,module,exports){
'use strict';

var dateIsValid = require('./dateIsValid');

function assertDateIsValid(d) {
  if (!dateIsValid(d)) {
    throw new TypeError('Date is not valid');
  }
}

module.exports = assertDateIsValid;
},{"./dateIsValid":246}],234:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    forEach = require('../../common/internal/forEach'),
    compareDate = require('./compareDate'),
    advanceDate = require('./advanceDate'),
    moveToEndOfUnit = require('./moveToEndOfUnit'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar'),
    moveToBeginningOfUnit = require('./moveToBeginningOfUnit'),
    createDateWithContext = require('./createDateWithContext'),
    getTimeDistanceForUnit = require('./getTimeDistanceForUnit');

var sugarDate = namespaceAliases.sugarDate,
    HOURS_INDEX = DateUnitIndexes.HOURS_INDEX,
    DAY_INDEX = DateUnitIndexes.DAY_INDEX;

function buildDateUnitMethods() {

  defineInstanceSimilar(sugarDate, DateUnits, function(methods, unit, index) {
    var name = unit.name, caps = simpleCapitalize(name);

    if (index > DAY_INDEX) {
      forEach(['Last','This','Next'], function(shift) {
        methods['is' + shift + caps] = function(d, localeCode) {
          return compareDate(d, shift + ' ' + name, 0, localeCode, { locale: 'en' });
        };
      });
    }
    if (index > HOURS_INDEX) {
      methods['beginningOf' + caps] = function(d, localeCode) {
        return moveToBeginningOfUnit(d, index, localeCode);
      };
      methods['endOf' + caps] = function(d, localeCode) {
        return moveToEndOfUnit(d, index, localeCode);
      };
    }

    methods['add' + caps + 's'] = function(d, num, reset) {
      return advanceDate(d, name, num, reset);
    };

    var since = function(date, d, options) {
      return getTimeDistanceForUnit(date, createDateWithContext(date, d, options, true), unit);
    };
    var until = function(date, d, options) {
      return getTimeDistanceForUnit(createDateWithContext(date, d, options, true), date, unit);
    };

    methods[name + 'sAgo']   = methods[name + 'sUntil']   = until;
    methods[name + 'sSince'] = methods[name + 'sFromNow'] = since;

  });

}

module.exports = buildDateUnitMethods;
},{"../../common/internal/defineInstanceSimilar":107,"../../common/internal/forEach":114,"../../common/internal/simpleCapitalize":156,"../../common/var/namespaceAliases":182,"../var/DateUnitIndexes":367,"../var/DateUnits":368,"./advanceDate":230,"./compareDate":241,"./createDateWithContext":244,"./getTimeDistanceForUnit":273,"./moveToBeginningOfUnit":285,"./moveToEndOfUnit":287}],235:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    createDate = require('./createDate'),
    mathAliases = require('../../common/var/mathAliases'),
    advanceDate = require('./advanceDate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var sugarNumber = namespaceAliases.sugarNumber,
    round = mathAliases.round;

function buildNumberUnitMethods() {
  defineInstanceSimilar(sugarNumber, DateUnits, function(methods, unit) {
    var name = unit.name, base, after, before;
    base = function(n) {
      return round(n * unit.multiplier);
    };
    after = function(n, d, options) {
      return advanceDate(createDate(d, options, true), name, n);
    };
    before = function(n, d, options) {
      return advanceDate(createDate(d, options, true), name, -n);
    };
    methods[name] = base;
    methods[name + 's'] = base;
    methods[name + 'Before'] = before;
    methods[name + 'sBefore'] = before;
    methods[name + 'Ago'] = before;
    methods[name + 'sAgo'] = before;
    methods[name + 'After'] = after;
    methods[name + 'sAfter'] = after;
    methods[name + 'FromNow'] = after;
    methods[name + 'sFromNow'] = after;
  });
}

module.exports = buildNumberUnitMethods;
},{"../../common/internal/defineInstanceSimilar":107,"../../common/var/mathAliases":180,"../../common/var/namespaceAliases":182,"../var/DateUnits":368,"./advanceDate":230,"./createDate":243}],236:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    spaceSplit = require('../../common/internal/spaceSplit'),
    fullCompareDate = require('./fullCompareDate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var English = LocaleHelpers.English,
    sugarDate = namespaceAliases.sugarDate;

function buildRelativeAliases() {
  var special  = spaceSplit('Today Yesterday Tomorrow Weekday Weekend Future Past');
  var weekdays = English.weekdays.slice(0, 7);
  var months   = English.months.slice(0, 12);
  var together = special.concat(weekdays).concat(months);
  defineInstanceSimilar(sugarDate, together, function(methods, name) {
    methods['is'+ name] = function(d) {
      return fullCompareDate(d, name);
    };
  });
}

module.exports = buildRelativeAliases;
},{"../../common/internal/defineInstanceSimilar":107,"../../common/internal/spaceSplit":160,"../../common/var/namespaceAliases":182,"../var/LocaleHelpers":374,"./fullCompareDate":250}],237:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet'),
    setISOWeekNumber = require('./setISOWeekNumber');

function callDateSetWithWeek(d, method, value, safe) {
  if (method === 'ISOWeek') {
    setISOWeekNumber(d, value);
  } else {
    callDateSet(d, method, value, safe);
  }
}

module.exports = callDateSetWithWeek;
},{"../../common/internal/callDateSet":94,"./setISOWeekNumber":294}],238:[function(require,module,exports){
'use strict';

var _utc = require('../../common/var/_utc');

function cloneDate(d) {
  // Rhino environments have a bug where new Date(d) truncates
  // milliseconds so need to call getTime() here.
  var clone = new Date(d.getTime());
  _utc(clone, !!_utc(d));
  return clone;
}

module.exports = cloneDate;
},{"../../common/var/_utc":175}],239:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    simpleClone = require('../../common/internal/simpleClone'),
    isObjectType = require('../../common/internal/isObjectType'),
    getDateParamsFromString = require('./getDateParamsFromString'),
    collectDateParamsFromArguments = require('./collectDateParamsFromArguments');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString;

function collectDateArguments(args, allowDuration) {
  var arg1 = args[0], arg2 = args[1];
  if (allowDuration && isString(arg1)) {
    arg1 = getDateParamsFromString(arg1);
  } else if (isNumber(arg1) && isNumber(arg2)) {
    arg1 = collectDateParamsFromArguments(args);
    arg2 = null;
  } else {
    if (isObjectType(arg1)) {
      arg1 = simpleClone(arg1);
    }
  }
  return [arg1, arg2];
}

module.exports = collectDateArguments;
},{"../../common/internal/isObjectType":136,"../../common/internal/simpleClone":157,"../../common/var/classChecks":177,"./collectDateParamsFromArguments":240,"./getDateParamsFromString":258}],240:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    isDefined = require('../../common/internal/isDefined'),
    walkUnitDown = require('./walkUnitDown');

var YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function collectDateParamsFromArguments(args) {
  var params = {}, index = 0;
  walkUnitDown(YEAR_INDEX, function(unit) {
    var arg = args[index++];
    if (isDefined(arg)) {
      params[unit.name] = arg;
    }
  });
  return params;
}

module.exports = collectDateParamsFromArguments;
},{"../../common/internal/isDefined":134,"../var/DateUnitIndexes":367,"./walkUnitDown":301}],241:[function(require,module,exports){
'use strict';

var MINUTES = require('../var/MINUTES'),
    DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    _utc = require('../../common/var/_utc'),
    tzOffset = require('./tzOffset'),
    cloneDate = require('./cloneDate'),
    isDefined = require('../../common/internal/isDefined'),
    advanceDate = require('./advanceDate'),
    dateIsValid = require('./dateIsValid'),
    moveToEndOfUnit = require('./moveToEndOfUnit'),
    getExtendedDate = require('./getExtendedDate'),
    moveToBeginningOfUnit = require('./moveToBeginningOfUnit');

var MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function compareDate(date, d, margin, localeCode, options) {
  var loMargin = 0, hiMargin = 0, timezoneShift, compareEdges, override, min, max, p, t;

  function getTimezoneShift() {
    // If there is any specificity in the date then we're implicitly not
    // checking absolute time, so ignore timezone shifts.
    if (p.set && p.set.specificity) {
      return 0;
    }
    return (tzOffset(p.date) - tzOffset(date)) * MINUTES;
  }

  function addSpecificUnit() {
    var unit = DateUnits[p.set.specificity];
    return advanceDate(cloneDate(p.date), unit.name, 1).getTime() - 1;
  }

  if (_utc(date)) {
    options = options || {};
    options.fromUTC = true;
    options.setUTC = true;
  }

  p = getExtendedDate(null, d, options, true);

  if (margin > 0) {
    loMargin = hiMargin = margin;
    override = true;
  }
  if (!dateIsValid(p.date)) return false;
  if (p.set && p.set.specificity) {
    if (isDefined(p.set.edge) || isDefined(p.set.shift)) {
      compareEdges = true;
      moveToBeginningOfUnit(p.date, p.set.specificity, localeCode);
    }
    if (compareEdges || p.set.specificity === MONTH_INDEX) {
      max = moveToEndOfUnit(cloneDate(p.date), p.set.specificity, localeCode).getTime();
    } else {
      max = addSpecificUnit();
    }
    if (!override && isDefined(p.set.sign) && p.set.specificity) {
      // If the time is relative, there can occasionally be an disparity between
      // the relative date and "now", which it is being compared to, so set an
      // extra margin to account for this.
      loMargin = 50;
      hiMargin = -50;
    }
  }
  t   = date.getTime();
  min = p.date.getTime();
  max = max || min;
  timezoneShift = getTimezoneShift();
  if (timezoneShift) {
    min -= timezoneShift;
    max -= timezoneShift;
  }
  return t >= (min - loMargin) && t <= (max + hiMargin);
}

module.exports = compareDate;
},{"../../common/internal/isDefined":134,"../../common/var/_utc":175,"../var/DateUnitIndexes":367,"../var/DateUnits":368,"../var/MINUTES":376,"./advanceDate":230,"./cloneDate":238,"./dateIsValid":246,"./getExtendedDate":262,"./moveToBeginningOfUnit":285,"./moveToEndOfUnit":287,"./tzOffset":299}],242:[function(require,module,exports){
'use strict';

var setDate = require('./setDate'),
    getDate = require('./getDate'),
    getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    getNewDate = require('./getNewDate');

function compareDay(d, shift) {
  var comp = getNewDate();
  if (shift) {
    setDate(comp, getDate(comp) + shift);
  }
  return getYear(d) === getYear(comp) &&
         getMonth(d) === getMonth(comp) &&
         getDate(d) === getDate(comp);
}

module.exports = compareDay;
},{"./getDate":255,"./getMonth":267,"./getNewDate":268,"./getYear":279,"./setDate":292}],243:[function(require,module,exports){
'use strict';

var getExtendedDate = require('./getExtendedDate');

function createDate(d, options, forceClone) {
  return getExtendedDate(null, d, options, forceClone).date;
}

module.exports = createDate;
},{"./getExtendedDate":262}],244:[function(require,module,exports){
'use strict';

var getExtendedDate = require('./getExtendedDate');

function createDateWithContext(contextDate, d, options, forceClone) {
  return getExtendedDate(contextDate, d, options, forceClone).date;
}

module.exports = createDateWithContext;
},{"./getExtendedDate":262}],245:[function(require,module,exports){
'use strict';

var CoreOutputFormats = require('../var/CoreOutputFormats'),
    formattingTokens = require('../var/formattingTokens'),
    assertDateIsValid = require('./assertDateIsValid');

var dateFormatMatcher = formattingTokens.dateFormatMatcher;

function dateFormat(d, format, localeCode) {
  assertDateIsValid(d);
  format = CoreOutputFormats[format] || format || '{long}';
  return dateFormatMatcher(format, d, localeCode);
}

module.exports = dateFormat;
},{"../var/CoreOutputFormats":364,"../var/formattingTokens":380,"./assertDateIsValid":233}],246:[function(require,module,exports){
'use strict';

function dateIsValid(d) {
  return !isNaN(d.getTime());
}

module.exports = dateIsValid;
},{}],247:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    dateFormat = require('./dateFormat'),
    classChecks = require('../../common/var/classChecks'),
    assertDateIsValid = require('./assertDateIsValid'),
    getAdjustedUnitForDate = require('./getAdjustedUnitForDate');

var isFunction = classChecks.isFunction,
    localeManager = LocaleHelpers.localeManager;

function dateRelative(d, dRelative, arg1, arg2) {
  var adu, format, type, localeCode, fn;
  assertDateIsValid(d);
  if (isFunction(arg1)) {
    fn = arg1;
  } else {
    localeCode = arg1;
    fn = arg2;
  }
  adu = getAdjustedUnitForDate(d, dRelative);
  if (fn) {
    format = fn.apply(d, adu.concat(localeManager.get(localeCode)));
    if (format) {
      return dateFormat(d, format, localeCode);
    }
  }
  // Adjust up if time is in ms, as this doesn't
  // look very good for a standard relative date.
  if (adu[1] === 0) {
    adu[1] = 1;
    adu[0] = 1;
  }
  if (dRelative) {
    type = 'duration';
  } else if (adu[2] > 0) {
    type = 'future';
  } else {
    type = 'past';
  }
  return localeManager.get(localeCode).getRelativeFormat(adu, type);
}

module.exports = dateRelative;
},{"../../common/var/classChecks":177,"../var/LocaleHelpers":374,"./assertDateIsValid":233,"./dateFormat":245,"./getAdjustedUnitForDate":252}],248:[function(require,module,exports){
'use strict';

function defaultNewDate() {
  return new Date;
}

module.exports = defaultNewDate;
},{}],249:[function(require,module,exports){
'use strict';

var getDateParamKey = require('./getDateParamKey');

function deleteDateParam(params, key) {
  delete params[getDateParamKey(params, key)];
}

module.exports = deleteDateParam;
},{"./getDateParamKey":257}],250:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    trim = require('../../common/internal/trim'),
    getMonth = require('./getMonth'),
    isDefined = require('../../common/internal/isDefined'),
    getNewDate = require('./getNewDate'),
    compareDay = require('./compareDay'),
    getWeekday = require('./getWeekday'),
    dateIsValid = require('./dateIsValid'),
    classChecks = require('../../common/var/classChecks'),
    compareDate = require('./compareDate');

var isString = classChecks.isString,
    English = LocaleHelpers.English;

function fullCompareDate(date, d, margin) {
  var tmp;
  if (!dateIsValid(date)) return;
  if (isString(d)) {
    d = trim(d).toLowerCase();
    switch(true) {
      case d === 'future':    return date.getTime() > getNewDate().getTime();
      case d === 'past':      return date.getTime() < getNewDate().getTime();
      case d === 'today':     return compareDay(date);
      case d === 'tomorrow':  return compareDay(date,  1);
      case d === 'yesterday': return compareDay(date, -1);
      case d === 'weekday':   return getWeekday(date) > 0 && getWeekday(date) < 6;
      case d === 'weekend':   return getWeekday(date) === 0 || getWeekday(date) === 6;

      case (isDefined(tmp = English.weekdayMap[d])):
        return getWeekday(date) === tmp;
      case (isDefined(tmp = English.monthMap[d])):
        return getMonth(date) === tmp;
    }
  }
  return compareDate(date, d, margin);
}

module.exports = fullCompareDate;
},{"../../common/internal/isDefined":134,"../../common/internal/trim":162,"../../common/var/classChecks":177,"../var/LocaleHelpers":374,"./compareDate":241,"./compareDay":242,"./dateIsValid":246,"./getMonth":267,"./getNewDate":268,"./getWeekday":278}],251:[function(require,module,exports){
'use strict';

var mathAliases = require('../../common/var/mathAliases'),
    iterateOverDateUnits = require('./iterateOverDateUnits');

var abs = mathAliases.abs;

function getAdjustedUnit(ms, fn) {
  var unitIndex = 0, value = 0;
  iterateOverDateUnits(function(unit, i) {
    value = abs(fn(unit));
    if (value >= 1) {
      unitIndex = i;
      return false;
    }
  });
  return [value, unitIndex, ms];
}

module.exports = getAdjustedUnit;
},{"../../common/var/mathAliases":180,"./iterateOverDateUnits":283}],252:[function(require,module,exports){
'use strict';

var getNewDate = require('./getNewDate'),
    mathAliases = require('../../common/var/mathAliases'),
    getAdjustedUnit = require('./getAdjustedUnit'),
    getTimeDistanceForUnit = require('./getTimeDistanceForUnit');

var abs = mathAliases.abs;

function getAdjustedUnitForDate(d, dRelative) {
  var ms;
  if (!dRelative) {
    dRelative = getNewDate();
    if (d > dRelative) {
      // If our date is greater than the one that we got from getNewDate, it
      // means that we are finding the unit for a date that is in the future
      // relative to now. However, often the incoming date was created in
      // the same cycle as our comparison, but our "now" date will have been
      // created an instant after it, creating situations where "5 minutes from
      // now" becomes "4 minutes from now" in the same tick. To prevent this,
      // subtract a buffer of 10ms to compensate.
      dRelative = new Date(dRelative.getTime() - 10);
    }
  }
  ms = d - dRelative;
  return getAdjustedUnit(ms, function(u) {
    return abs(getTimeDistanceForUnit(d, dRelative, u));
  });
}

module.exports = getAdjustedUnitForDate;
},{"../../common/var/mathAliases":180,"./getAdjustedUnit":251,"./getNewDate":268,"./getTimeDistanceForUnit":273}],253:[function(require,module,exports){
'use strict';

var trunc = require('../../common/var/trunc'),
    withPrecision = require('../../common/internal/withPrecision'),
    getAdjustedUnit = require('./getAdjustedUnit');

function getAdjustedUnitForNumber(ms) {
  return getAdjustedUnit(ms, function(unit) {
    return trunc(withPrecision(ms / unit.multiplier, 1));
  });
}

module.exports = getAdjustedUnitForNumber;
},{"../../common/internal/withPrecision":163,"../../common/var/trunc":183,"./getAdjustedUnit":251}],254:[function(require,module,exports){
'use strict';

function getArrayWithOffset(arr, n, alternate, offset) {
  var val;
  if (alternate > 1) {
    val = arr[n + (alternate - 1) * offset];
  }
  return val || arr[n];
}

module.exports = getArrayWithOffset;
},{}],255:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getDate(d) {
  return callDateGet(d, 'Date');
}

module.exports = getDate;
},{"../../common/internal/callDateGet":93}],256:[function(require,module,exports){
'use strict';

var getDateParamKey = require('./getDateParamKey'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn;

function getDateParam(params, key) {
  return getOwn(params, getDateParamKey(params, key));
}

module.exports = getDateParam;
},{"../../common/var/coreUtilityAliases":178,"./getDateParamKey":257}],257:[function(require,module,exports){
'use strict';

var getOwnKey = require('../../common/internal/getOwnKey');

function getDateParamKey(params, key) {
  return getOwnKey(params, key) ||
         getOwnKey(params, key + 's') ||
         (key === 'day' && getOwnKey(params, 'date'));
}

module.exports = getDateParamKey;
},{"../../common/internal/getOwnKey":124}],258:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined');

function getDateParamsFromString(str) {
  var match, num, params = {};
  match = str.match(/^(-?\d*[\d.]\d*)?\s?(\w+?)s?$/i);
  if (match) {
    if (isUndefined(num)) {
      num = +match[1];
      if (isNaN(num)) {
        num = 1;
      }
    }
    params[match[2].toLowerCase()] = num;
  }
  return params;
}

module.exports = getDateParamsFromString;
},{"../../common/internal/isUndefined":140}],259:[function(require,module,exports){
'use strict';

var getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    callDateGet = require('../../common/internal/callDateGet');

function getDaysInMonth(d) {
  return 32 - callDateGet(new Date(getYear(d), getMonth(d), 32), 'Date');
}

module.exports = getDaysInMonth;
},{"../../common/internal/callDateGet":93,"./getMonth":267,"./getYear":279}],260:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    getTimeDistanceForUnit = require('./getTimeDistanceForUnit');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

function getDaysSince(d1, d2) {
  return getTimeDistanceForUnit(d1, d2, DateUnits[DAY_INDEX]);
}

module.exports = getDaysSince;
},{"../var/DateUnitIndexes":367,"../var/DateUnits":368,"./getTimeDistanceForUnit":273}],261:[function(require,module,exports){
'use strict';

var EnglishLocaleBaseDefinition = require('../var/EnglishLocaleBaseDefinition'),
    simpleMerge = require('../../common/internal/simpleMerge'),
    simpleClone = require('../../common/internal/simpleClone');

function getEnglishVariant(v) {
  return simpleMerge(simpleClone(EnglishLocaleBaseDefinition), v);
}

module.exports = getEnglishVariant;
},{"../../common/internal/simpleClone":157,"../../common/internal/simpleMerge":158,"../var/EnglishLocaleBaseDefinition":369}],262:[function(require,module,exports){
'use strict';

var MINUTES = require('../var/MINUTES'),
    ParsingTokens = require('../var/ParsingTokens'),
    LocaleHelpers = require('../var/LocaleHelpers'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    _utc = require('../../common/var/_utc'),
    trunc = require('../../common/var/trunc'),
    forEach = require('../../common/internal/forEach'),
    tzOffset = require('./tzOffset'),
    resetTime = require('./resetTime'),
    isDefined = require('../../common/internal/isDefined'),
    setWeekday = require('./setWeekday'),
    updateDate = require('./updateDate'),
    getNewDate = require('./getNewDate'),
    isUndefined = require('../../common/internal/isUndefined'),
    classChecks = require('../../common/var/classChecks'),
    advanceDate = require('./advanceDate'),
    simpleClone = require('../../common/internal/simpleClone'),
    isObjectType = require('../../common/internal/isObjectType'),
    moveToEndOfUnit = require('./moveToEndOfUnit'),
    deleteDateParam = require('./deleteDateParam'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getParsingTokenValue = require('./getParsingTokenValue'),
    moveToBeginningOfUnit = require('./moveToBeginningOfUnit'),
    iterateOverDateParams = require('./iterateOverDateParams'),
    getYearFromAbbreviation = require('./getYearFromAbbreviation'),
    iterateOverHigherDateParams = require('./iterateOverHigherDateParams');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString,
    isDate = classChecks.isDate,
    hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn,
    English = LocaleHelpers.English,
    localeManager = LocaleHelpers.localeManager,
    DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX,
    YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function getExtendedDate(contextDate, d, opt, forceClone) {

  var date, set, loc, options, afterCallbacks, relative, weekdayDir;

  afterCallbacks = [];
  options = getDateOptions(opt);

  function getDateOptions(opt) {
    var options = isString(opt) ? { locale: opt } : opt || {};
    options.prefer = +!!getOwn(options, 'future') - +!!getOwn(options, 'past');
    return options;
  }

  function getFormatParams(match, dif) {
    var set = getOwn(options, 'params') || {};
    forEach(dif.to, function(field, i) {
      var str = match[i + 1], token, val;
      if (!str) return;
      if (field === 'yy' || field === 'y') {
        field = 'year';
        val = getYearFromAbbreviation(str, date, getOwn(options, 'prefer'));
      } else if (token = getOwn(ParsingTokens, field)) {
        field = token.param || field;
        val = getParsingTokenValue(token, str);
      } else {
        val = loc.getTokenValue(field, str);
      }
      set[field] = val;
    });
    return set;
  }

  // Clone date will set the utc flag, but it will
  // be overriden later, so set option flags instead.
  function cloneDateByFlag(d, clone) {
    if (_utc(d) && !isDefined(getOwn(options, 'fromUTC'))) {
      options.fromUTC = true;
    }
    if (_utc(d) && !isDefined(getOwn(options, 'setUTC'))) {
      options.setUTC = true;
    }
    if (clone) {
      d = new Date(d.getTime());
    }
    return d;
  }

  function afterDateSet(fn) {
    afterCallbacks.push(fn);
  }

  function fireCallbacks() {
    forEach(afterCallbacks, function(fn) {
      fn.call();
    });
  }

  function parseStringDate(str) {

    str = str.toLowerCase();

    // The act of getting the locale will initialize
    // if it is missing and add the required formats.
    loc = localeManager.get(getOwn(options, 'locale'));

    for (var i = 0, dif, match; dif = loc.compiledFormats[i]; i++) {
      match = str.match(dif.reg);
      if (match) {

        // Note that caching the format will modify the compiledFormats array
        // which is not a good idea to do inside its for loop, however we
        // know at this point that we have a matched format and that we will
        // break out below, so simpler to do it here.
        loc.cacheFormat(dif, i);

        set = getFormatParams(match, dif);

        if (isDefined(set.timestamp)) {
          str = set.timestamp;
          set = null;
          break;
        }

        if (isDefined(set.ampm)) {
          handleAmpm(set.ampm);
        }

        if (set.utc || isDefined(set.tzHour)) {
          handleTimezoneOffset(set.tzHour, set.tzMinute, set.tzSign);
        }

        if (isDefined(set.shift) && isUndefined(set.unit)) {
          // "next january", "next monday", etc
          handleUnitlessShift();
        }

        if (isDefined(set.num) && isUndefined(set.unit)) {
          // "the second of January", etc
          handleUnitlessNum(set.num);
        }

        if (set.midday) {
          // "noon" and "midnight"
          handleMidday(set.midday);
        }

        if (isDefined(set.day)) {
          // Relative day localizations such as "today" and "tomorrow".
          handleRelativeDay(set.day);
        }

        if (isDefined(set.unit)) {
          // "3 days ago", etc
          handleRelativeUnit(set.unit);
        }

        if (set.edge) {
          // "the end of January", etc
          handleEdge(set.edge, set);
        }

        if (set.yearSign) {
          set.year *= set.yearSign;
        }

        break;
      }
    }

    if (!set) {
      // Fall back to native parsing
      date = new Date(str);
      if (getOwn(options, 'fromUTC')) {
        // Falling back to system date here which cannot be parsed as UTC,
        // so if we're forcing UTC then simply add the offset.
        date.setTime(date.getTime() + (tzOffset(date) * MINUTES));
      }
    } else if (relative) {
      updateDate(date, set, false, 1);
    } else {
      if (_utc(date)) {
        // UTC times can traverse into other days or even months,
        // so preemtively reset the time here to prevent this.
        resetTime(date);
      }
      updateDate(date, set, true, 0, getOwn(options, 'prefer'), weekdayDir);
    }
    fireCallbacks();
    return date;
  }

  function handleAmpm(ampm) {
    if (ampm === 1 && set.hour < 12) {
      // If the time is 1pm-11pm advance the time by 12 hours.
      set.hour += 12;
    } else if (ampm === 0 && set.hour === 12) {
      // If it is 12:00am then set the hour to 0.
      set.hour = 0;
    }
  }

  function handleTimezoneOffset(tzHour, tzMinute, tzSign) {
    // Adjust for timezone offset
    _utc(date, true);
    var offset = (tzSign || 1) * ((tzHour || 0) * 60 + (tzMinute || 0));
    if (offset) {
      set.minute = (set.minute || 0) - offset;
    }
  }

  function handleUnitlessShift() {
    if (isDefined(set.month)) {
      // "next January"
      set.unit = YEAR_INDEX;
    } else if (isDefined(set.weekday)) {
      // "next Monday"
      set.unit = WEEK_INDEX;
    }
  }

  function handleUnitlessNum(num) {
    if (isDefined(set.weekday)) {
      // "The second Tuesday of March"
      setOrdinalWeekday(num);
    } else if (isDefined(set.month)) {
      // "The second of March"
      set.date = set.num;
    }
  }

  function handleMidday(hour) {
    set.hour = hour % 24;
    if (hour > 23) {
      // If the date has hours past 24, we need to prevent it from traversing
      // into a new day as that would make it being part of a new week in
      // ambiguous dates such as "Monday".
      afterDateSet(function() {
        advanceDate(date, 'date', trunc(hour / 24));
      });
    }
  }

  function handleRelativeDay() {
    resetTime(date);
    if (isUndefined(set.unit)) {
      set.unit = DAY_INDEX;
      set.num  = set.day;
      delete set.day;
    }
  }

  function handleRelativeUnit(unitIndex) {
    var num = isDefined(set.num) ? set.num : 1;

    // If a weekday is defined, there are 3 possible formats being applied:
    //
    // 1. "the day after monday": unit is days
    // 2. "next monday": short for "next week monday", unit is weeks
    // 3. "the 2nd monday of next month": unit is months
    //
    // In the first case, we need to set the weekday up front, as the day is
    // relative to it. The second case also needs to be handled up front for
    // formats like "next monday at midnight" which will have its weekday reset
    // if not set up front. The last case will set up the params necessary to
    // shift the weekday and allow separateAbsoluteUnits below to handle setting
    // it after the date has been shifted.
    if(isDefined(set.weekday)) {
      if(unitIndex === MONTH_INDEX) {
        setOrdinalWeekday(num);
        num = 1;
      } else {
        updateDate(date, { weekday: set.weekday }, true);
        delete set.weekday;
      }
    }

    if (set.half) {
      // Allow localized "half" as a standalone colloquialism. Purposely avoiding
      // the locale number system to reduce complexity. The units "month" and
      // "week" are purposely excluded in the English date formats below, as
      // "half a week" and "half a month" are meaningless as exact dates.
      num *= set.half;
    }

    if (isDefined(set.shift)) {
      // Shift and unit, ie "next month", "last week", etc.
      num *= set.shift;
    } else if (set.sign) {
      // Unit and sign, ie "months ago", "weeks from now", etc.
      num *= set.sign;
    }

    if (isDefined(set.day)) {
      // "the day after tomorrow"
      num += set.day;
      delete set.day;
    }

    // Formats like "the 15th of last month" or "6:30pm of next week"
    // contain absolute units in addition to relative ones, so separate
    // them here, remove them from the params, and set up a callback to
    // set them after the relative ones have been set.
    separateAbsoluteUnits(unitIndex);

    // Finally shift the unit.
    set[English.units[unitIndex]] = num;
    relative = true;
  }

  function handleEdge(edge, params) {
    var edgeIndex = params.unit, weekdayOfMonth;
    if (!edgeIndex) {
      // If we have "the end of January", then we need to find the unit index.
      iterateOverHigherDateParams(params, function(unitName, val, unit, i) {
        if (unitName === 'weekday' && isDefined(params.month)) {
          // If both a month and weekday exist, then we have a format like
          // "the last tuesday in November, 2012", where the "last" is still
          // relative to the end of the month, so prevent the unit "weekday"
          // from taking over.
          return;
        }
        edgeIndex = i;
      });
    }
    if (edgeIndex === MONTH_INDEX && isDefined(params.weekday)) {
      // If a weekday in a month exists (as described above),
      // then set it up to be set after the date has been shifted.
      weekdayOfMonth = params.weekday;
      delete params.weekday;
    }
    afterDateSet(function() {
      var stopIndex;
      // "edge" values that are at the very edge are "2" so the beginning of the
      // year is -2 and the end of the year is 2. Conversely, the "last day" is
      // actually 00:00am so it is 1. -1 is reserved but unused for now.
      if (edge < 0) {
        moveToBeginningOfUnit(date, edgeIndex, getOwn(options, 'locale'));
      } else if (edge > 0) {
        if (edge === 1) {
          stopIndex = DAY_INDEX;
          moveToBeginningOfUnit(date, DAY_INDEX);
        }
        moveToEndOfUnit(date, edgeIndex, getOwn(options, 'locale'), stopIndex);
      }
      if (isDefined(weekdayOfMonth)) {
        setWeekday(date, weekdayOfMonth, -edge);
        resetTime(date);
      }
    });
    if (edgeIndex === MONTH_INDEX) {
      params.specificity = DAY_INDEX;
    } else {
      params.specificity = edgeIndex - 1;
    }
  }

  function setOrdinalWeekday(num) {
    // If we have "the 2nd Tuesday of June", then pass the "weekdayDir"
    // flag along to updateDate so that the date does not accidentally traverse
    // into the previous month. This needs to be independent of the "prefer"
    // flag because we are only ensuring that the weekday is in the future, not
    // the entire date.
    set.weekday = 7 * (num - 1) + set.weekday;
    set.date = 1;
    weekdayDir = 1;
  }

  function separateAbsoluteUnits(unitIndex) {
    var params;

    iterateOverDateParams(set, function(name, val, unit, i) {
      // If there is a time unit set that is more specific than
      // the matched unit we have a string like "5:30am in 2 minutes",
      // which is meaningless, so invalidate the date...
      if (i >= unitIndex) {
        date.setTime(NaN);
        return false;
      } else if (i < unitIndex) {
        // ...otherwise set the params to set the absolute date
        // as a callback after the relative date has been set.
        params = params || {};
        params[name] = val;
        deleteDateParam(set, name);
      }
    });
    if (params) {
      afterDateSet(function() {
        updateDate(date, params, true, false, getOwn(options, 'prefer'), weekdayDir);
      });
      if (set.edge) {
        // "the end of March of next year"
        handleEdge(set.edge, params);
        delete set.edge;
      }
    }
  }

  if (contextDate && d) {
    // If a context date is passed ("get" and "unitsFromNow"),
    // then use it as the starting point.
    date = cloneDateByFlag(contextDate, true);
  } else {
    date = getNewDate();
  }

  _utc(date, getOwn(options, 'fromUTC'));

  if (isString(d)) {
    date = parseStringDate(d);
  } else if (isDate(d)) {
    date = cloneDateByFlag(d, hasOwn(options, 'clone') || forceClone);
  } else if (isObjectType(d)) {
    set = simpleClone(d);
    updateDate(date, set, true);
  } else if (isNumber(d) || d === null) {
    date.setTime(d);
  }
  // A date created by parsing a string presumes that the format *itself* is
  // UTC, but not that the date, once created, should be manipulated as such. In
  // other words, if you are creating a date object from a server time
  // "2012-11-15T12:00:00Z", in the majority of cases you are using it to create
  // a date that will, after creation, be manipulated as local, so reset the utc
  // flag here unless "setUTC" is also set.
  _utc(date, !!getOwn(options, 'setUTC'));
  return {
    set: set,
    date: date
  };
}

module.exports = getExtendedDate;
},{"../../common/internal/forEach":114,"../../common/internal/isDefined":134,"../../common/internal/isObjectType":136,"../../common/internal/isUndefined":140,"../../common/internal/simpleClone":157,"../../common/var/_utc":175,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"../../common/var/trunc":183,"../var/DateUnitIndexes":367,"../var/LocaleHelpers":374,"../var/MINUTES":376,"../var/ParsingTokens":377,"./advanceDate":230,"./deleteDateParam":249,"./getNewDate":268,"./getParsingTokenValue":270,"./getYearFromAbbreviation":280,"./iterateOverDateParams":282,"./iterateOverHigherDateParams":284,"./moveToBeginningOfUnit":285,"./moveToEndOfUnit":287,"./resetTime":291,"./setWeekday":297,"./tzOffset":299,"./updateDate":300}],263:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function getHigherUnitIndex(index) {
  return index === DAY_INDEX ? MONTH_INDEX : index + 1;
}

module.exports = getHigherUnitIndex;
},{"../var/DateUnitIndexes":367}],264:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getHours(d) {
  return callDateGet(d, 'Hours');
}

module.exports = getHours;
},{"../../common/internal/callDateGet":93}],265:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes');

var HOURS_INDEX = DateUnitIndexes.HOURS_INDEX,
    DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function getLowerUnitIndex(index) {
  if (index === MONTH_INDEX) {
    return DAY_INDEX;
  } else if (index === WEEK_INDEX) {
    return HOURS_INDEX;
  }
  return index - 1;
}

module.exports = getLowerUnitIndex;
},{"../var/DateUnitIndexes":367}],266:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    trunc = require('../../common/var/trunc'),
    getHours = require('./getHours');

var localeManager = LocaleHelpers.localeManager;

function getMeridiemToken(d, localeCode) {
  var hours = getHours(d);
  return localeManager.get(localeCode).ampm[trunc(hours / 12)] || '';
}

module.exports = getMeridiemToken;
},{"../../common/var/trunc":183,"../var/LocaleHelpers":374,"./getHours":264}],267:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getMonth(d) {
  return callDateGet(d, 'Month');
}

module.exports = getMonth;
},{"../../common/internal/callDateGet":93}],268:[function(require,module,exports){
'use strict';

var _dateOptions = require('../var/_dateOptions');

function getNewDate() {
  return _dateOptions('newDateInternal')();
}

module.exports = getNewDate;
},{"../var/_dateOptions":379}],269:[function(require,module,exports){
'use strict';

var LOCALE_ARRAY_FIELDS = require('../var/LOCALE_ARRAY_FIELDS'),
    ISODefaults = require('../var/ISODefaults'),
    ParsingTokens = require('../var/ParsingTokens'),
    CoreParsingFormats = require('../var/CoreParsingFormats'),
    LocalizedParsingTokens = require('../var/LocalizedParsingTokens'),
    map = require('../../common/internal/map'),
    filter = require('../../common/internal/filter'),
    forEach = require('../../common/internal/forEach'),
    isDefined = require('../../common/internal/isDefined'),
    commaSplit = require('../../common/internal/commaSplit'),
    classChecks = require('../../common/var/classChecks'),
    isUndefined = require('../../common/internal/isUndefined'),
    mathAliases = require('../../common/var/mathAliases'),
    simpleMerge = require('../../common/internal/simpleMerge'),
    getOrdinalSuffix = require('../../common/internal/getOrdinalSuffix'),
    getRegNonCapturing = require('./getRegNonCapturing'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getArrayWithOffset = require('./getArrayWithOffset'),
    iterateOverDateUnits = require('./iterateOverDateUnits'),
    arrayToRegAlternates = require('./arrayToRegAlternates'),
    fullwidthNumberHelpers = require('../../common/var/fullwidthNumberHelpers'),
    getAdjustedUnitForNumber = require('./getAdjustedUnitForNumber'),
    getParsingTokenWithSuffix = require('./getParsingTokenWithSuffix');

var getOwn = coreUtilityAliases.getOwn,
    forEachProperty = coreUtilityAliases.forEachProperty,
    fullWidthNumberMap = fullwidthNumberHelpers.fullWidthNumberMap,
    fullWidthNumbers = fullwidthNumberHelpers.fullWidthNumbers,
    pow = mathAliases.pow,
    max = mathAliases.max,
    ISO_FIRST_DAY_OF_WEEK = ISODefaults.ISO_FIRST_DAY_OF_WEEK,
    ISO_FIRST_DAY_OF_WEEK_YEAR = ISODefaults.ISO_FIRST_DAY_OF_WEEK_YEAR,
    isString = classChecks.isString,
    isFunction = classChecks.isFunction;

function getNewLocale(def) {

  function Locale(def) {
    this.init(def);
  }

  Locale.prototype = {

    getMonthName: function(n, alternate) {
      if (this.monthSuffix) {
        return (n + 1) + this.monthSuffix;
      }
      return getArrayWithOffset(this.months, n, alternate, 12);
    },

    getWeekdayName: function(n, alternate) {
      return getArrayWithOffset(this.weekdays, n, alternate, 7);
    },

    getTokenValue: function(field, str) {
      var map = this[field + 'Map'], val;
      if (map) {
        val = map[str];
      }
      if (isUndefined(val)) {
        val = this.getNumber(str);
        if (field === 'month') {
          // Months are the only numeric date field
          // whose value is not the same as its number.
          val -= 1;
        }
      }
      return val;
    },

    getNumber: function(str) {
      var num = this.numeralMap[str];
      if (isDefined(num)) {
        return num;
      }
      // The unary plus operator here show better performance and handles
      // every format that parseFloat does with the exception of trailing
      // characters, which are guaranteed not to be in our string at this point.
      num = +str.replace(/,/, '.');
      if (!isNaN(num)) {
        return num;
      }
      num = this.getNumeralValue(str);
      if (!isNaN(num)) {
        this.numeralMap[str] = num;
        return num;
      }
      return num;
    },

    getNumeralValue: function(str) {
      var place = 1, num = 0, lastWasPlace, isPlace, numeral, digit, arr;
      // Note that "numerals" that need to be converted through this method are
      // all considered to be single characters in order to handle CJK. This
      // method is by no means unique to CJK, but the complexity of handling
      // inflections in non-CJK languages adds too much overhead for not enough
      // value, so avoiding for now.
      arr = str.split('');
      for (var i = arr.length - 1; numeral = arr[i]; i--) {
        digit = getOwn(this.numeralMap, numeral);
        if (isUndefined(digit)) {
          digit = getOwn(fullWidthNumberMap, numeral) || 0;
        }
        isPlace = digit > 0 && digit % 10 === 0;
        if (isPlace) {
          if (lastWasPlace) {
            num += place;
          }
          if (i) {
            place = digit;
          } else {
            num += digit;
          }
        } else {
          num += digit * place;
          place *= 10;
        }
        lastWasPlace = isPlace;
      }
      return num;
    },

    getOrdinal: function(n) {
      var suffix = this.ordinalSuffix;
      return suffix || getOrdinalSuffix(n);
    },

    getRelativeFormat: function(adu, type) {
      return this.convertAdjustedToFormat(adu, type);
    },

    getDuration: function(ms) {
      return this.convertAdjustedToFormat(getAdjustedUnitForNumber(max(0, ms)), 'duration');
    },

    getFirstDayOfWeek: function() {
      var val = this.firstDayOfWeek;
      return isDefined(val) ? val : ISO_FIRST_DAY_OF_WEEK;
    },

    getFirstDayOfWeekYear: function() {
      return this.firstDayOfWeekYear || ISO_FIRST_DAY_OF_WEEK_YEAR;
    },

    convertAdjustedToFormat: function(adu, type) {
      var sign, unit, mult,
          num    = adu[0],
          u      = adu[1],
          ms     = adu[2],
          format = this[type] || this.relative;
      if (isFunction(format)) {
        return format.call(this, num, u, ms, type);
      }
      mult = !this.plural || num === 1 ? 0 : 1;
      unit = this.units[mult * 8 + u] || this.units[u];
      sign = this[ms > 0 ? 'fromNow' : 'ago'];
      return format.replace(/\{(.*?)\}/g, function(full, match) {
        switch(match) {
          case 'num': return num;
          case 'unit': return unit;
          case 'sign': return sign;
        }
      });
    },

    cacheFormat: function(dif, i) {
      this.compiledFormats.splice(i, 1);
      this.compiledFormats.unshift(dif);
    },

    addFormat: function(src, to) {
      var loc = this;

      function getTokenSrc(str) {
        var suffix, src, val,
            opt   = str.match(/\?$/),
            nc    = str.match(/^(\d+)\??$/),
            slice = str.match(/(\d)(?:-(\d))?/),
            key   = str.replace(/[^a-z]+$/i, '');

        // Allowing alias tokens such as {time}
        if (val = getOwn(loc.parsingAliases, key)) {
          src = replaceParsingTokens(val);
          if (opt) {
            src = getRegNonCapturing(src, true);
          }
          return src;
        }

        if (nc) {
          src = loc.tokens[nc[1]];
        } else if (val = getOwn(ParsingTokens, key)) {
          src = val.src;
        } else {
          val = getOwn(loc.parsingTokens, key) || getOwn(loc, key);

          // Both the "months" array and the "month" parsing token can be accessed
          // by either {month} or {months}, falling back as necessary, however
          // regardless of whether or not a fallback occurs, the final field to
          // be passed to addRawFormat must be normalized as singular.
          key = key.replace(/s$/, '');

          if (!val) {
            val = getOwn(loc.parsingTokens, key) || getOwn(loc, key + 's');
          }

          if (isString(val)) {
            src = val;
            suffix = loc[key + 'Suffix'];
          } else {
            if (slice) {
              val = filter(val, function(m, i) {
                var mod = i % (loc.units ? 8 : val.length);
                return mod >= slice[1] && mod <= (slice[2] || slice[1]);
              });
            }
            src = arrayToRegAlternates(val);
          }
        }
        if (!src) {
          return '';
        }
        if (nc) {
          // Non-capturing tokens like {0}
          src = getRegNonCapturing(src);
        } else {
          // Capturing group and add to parsed tokens
          to.push(key);
          src = '(' + src + ')';
        }
        if (suffix) {
          // Date/time suffixes such as those in CJK
          src = getParsingTokenWithSuffix(key, src, suffix);
        }
        if (opt) {
          src += '?';
        }
        return src;
      }

      function replaceParsingTokens(str) {

        // Make spaces optional
        str = str.replace(/ /g, ' ?');

        return str.replace(/\{([^,]+?)\}/g, function(match, token) {
          var tokens = token.split('|'), src;
          if (tokens.length > 1) {
            src = getRegNonCapturing(map(tokens, getTokenSrc).join('|'));
          } else {
            src = getTokenSrc(token);
          }
          return src;
        });
      }

      if (!to) {
        to = [];
        src = replaceParsingTokens(src);
      }

      loc.addRawFormat(src, to);
    },

    addRawFormat: function(format, to) {
      this.compiledFormats.unshift({
        reg: RegExp('^ *' + format + ' *$', 'i'),
        to: to
      });
    },

    init: function(def) {
      var loc = this;

      // -- Initialization helpers

      function initFormats() {
        loc.compiledFormats = [];
        loc.parsingAliases = {};
        loc.parsingTokens = {};
      }

      function initDefinition() {
        simpleMerge(loc, def);
      }

      function initArrayFields() {
        forEach(LOCALE_ARRAY_FIELDS, function(name) {
          var val = loc[name];
          if (isString(val)) {
            loc[name] = commaSplit(val);
          } else if (!val) {
            loc[name] = [];
          }
        });
      }

      // -- Value array build helpers

      function buildValueArray(name, mod, map, fn) {
        var field = name, all = [], setMap;
        if (!loc[field]) {
          field += 's';
        }
        if (!map) {
          map = {};
          setMap = true;
        }
        forAllAlternates(field, function(alt, j, i) {
          var idx = j * mod + i, val;
          val = fn ? fn(i) : i;
          map[alt] = val;
          map[alt.toLowerCase()] = val;
          all[idx] = alt;
        });
        loc[field] = all;
        if (setMap) {
          loc[name + 'Map'] = map;
        }
      }

      function forAllAlternates(field, fn) {
        forEach(loc[field], function(str, i) {
          forEachAlternate(str, function(alt, j) {
            fn(alt, j, i);
          });
        });
      }

      function forEachAlternate(str, fn) {
        var arr = map(str.split('+'), function(split) {
          return split.replace(/(.+):(.+)$/, function(full, base, suffixes) {
            return map(suffixes.split('|'), function(suffix) {
              return base + suffix;
            }).join('|');
          });
        }).join('|');
        forEach(arr.split('|'), fn);
      }

      function buildNumerals() {
        var map = {};
        buildValueArray('numeral', 10, map);
        buildValueArray('article', 1, map, function() {
          return 1;
        });
        buildValueArray('placeholder', 4, map, function(n) {
          return pow(10, n + 1);
        });
        loc.numeralMap = map;
      }

      function buildTimeFormats() {
        loc.parsingAliases['time'] = getTimeFormat();
        loc.parsingAliases['tzOffset'] = getTZOffsetFormat();
      }

      function getTimeFormat() {
        var src;
        if (loc.ampmFront) {
          // "ampmFront" exists mostly for CJK locales, which also presume that
          // time suffixes exist, allowing this to be a simpler regex.
          src = '{ampm?} {hour} (?:{minute} (?::?{second})?)?';
        } else if(loc.ampm.length) {
          src = '{hour}(?:[.:]{minute}(?:[.:]{second})? {ampm?}| {ampm})';
        } else {
          src = '{hour}(?:[.:]{minute}(?:[.:]{second})?)';
        }
        return src;
      }

      function getTZOffsetFormat() {
        return '(?:{Z}|{GMT?}(?:{tzSign}{tzHour}(?::?{tzMinute}(?: \\([\\w\\s]+\\))?)?)?)?';
      }

      function buildParsingTokens() {
        forEachProperty(LocalizedParsingTokens, function(token, name) {
          var src, arr;
          src = token.base ? ParsingTokens[token.base].src : token.src;
          if (token.requiresNumerals || loc.numeralUnits) {
            src += getNumeralSrc();
          }
          arr = loc[name + 's'];
          if (arr && arr.length) {
            src += '|' + arrayToRegAlternates(arr);
          }
          loc.parsingTokens[name] = src;
        });
      }

      function getNumeralSrc() {
        var all, src = '';
        all = loc.numerals.concat(loc.placeholders).concat(loc.articles);
        if (loc.allowsFullWidth) {
          all = all.concat(fullWidthNumbers.split(''));
        }
        if (all.length) {
          src = '|(?:' + arrayToRegAlternates(all) + ')+';
        }
        return src;
      }

      function buildTimeSuffixes() {
        iterateOverDateUnits(function(unit, i) {
          var token = loc.timeSuffixes[i];
          if (token) {
            loc[(unit.alias || unit.name) + 'Suffix'] = token;
          }
        });
      }

      function buildModifiers() {
        forEach(loc.modifiers, function(modifier) {
          var name = modifier.name, mapKey = name + 'Map', map;
          map = loc[mapKey] || {};
          forEachAlternate(modifier.src, function(alt, j) {
            var token = getOwn(loc.parsingTokens, name), val = modifier.value;
            map[alt] = val;
            loc.parsingTokens[name] = token ? token + '|' + alt : alt;
            if (modifier.name === 'sign' && j === 0) {
              // Hooking in here to set the first "fromNow" or "ago" modifier
              // directly on the locale, so that it can be reused in the
              // relative format.
              loc[val === 1 ? 'fromNow' : 'ago'] = alt;
            }
          });
          loc[mapKey] = map;
        });
      }

      // -- Format adding helpers

      function addCoreFormats() {
        forEach(CoreParsingFormats, function(df) {
          var src = df.src;
          if (df.mdy && loc.mdy) {
            // Use the mm/dd/yyyy variant if it
            // exists and the locale requires it
            src = df.mdy;
          }
          if (df.time) {
            // Core formats that allow time require the time
            // reg on both sides, so add both versions here.
            loc.addFormat(getFormatWithTime(src, true));
            loc.addFormat(getFormatWithTime(src));
          } else {
            loc.addFormat(src);
          }
        });
        loc.addFormat('{time}');
      }

      function addLocaleFormats() {
        addFormatSet('parse');
        addFormatSet('timeParse', true);
        addFormatSet('timeFrontParse', true, true);
      }

      function addFormatSet(field, allowTime, timeFront) {
        forEach(loc[field], function(format) {
          if (allowTime) {
            format = getFormatWithTime(format, timeFront);
          }
          loc.addFormat(format);
        });
      }

      function getFormatWithTime(baseFormat, timeBefore) {
        if (timeBefore) {
          return getTimeBefore() + baseFormat;
        }
        return baseFormat + getTimeAfter();
      }

      function getTimeBefore() {
        return getRegNonCapturing('{time}[,\\s\\u3000]', true);
      }

      function getTimeAfter() {
        var markers = ',?[\\s\\u3000]', localized;
        localized = arrayToRegAlternates(loc.timeMarkers);
        if (localized) {
          markers += '| (?:' + localized + ') ';
        }
        markers = getRegNonCapturing(markers, loc.timeMarkerOptional);
        return getRegNonCapturing(markers + '{time}', true);
      }

      initFormats();
      initDefinition();
      initArrayFields();

      buildValueArray('month', 12);
      buildValueArray('weekday', 7);
      buildValueArray('unit', 8);
      buildValueArray('ampm', 2);

      buildNumerals();
      buildTimeFormats();
      buildParsingTokens();
      buildTimeSuffixes();
      buildModifiers();

      // The order of these formats is important. Order is reversed so formats
      // that are initialized later will take precedence. Generally, this means
      // that more specific formats should come later.
      addCoreFormats();
      addLocaleFormats();

    }

  };

  return new Locale(def);
}

module.exports = getNewLocale;
},{"../../common/internal/commaSplit":98,"../../common/internal/filter":112,"../../common/internal/forEach":114,"../../common/internal/getOrdinalSuffix":123,"../../common/internal/isDefined":134,"../../common/internal/isUndefined":140,"../../common/internal/map":143,"../../common/internal/simpleMerge":158,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"../../common/var/fullwidthNumberHelpers":179,"../../common/var/mathAliases":180,"../var/CoreParsingFormats":365,"../var/ISODefaults":371,"../var/LOCALE_ARRAY_FIELDS":372,"../var/LocalizedParsingTokens":375,"../var/ParsingTokens":377,"./arrayToRegAlternates":232,"./getAdjustedUnitForNumber":253,"./getArrayWithOffset":254,"./getParsingTokenWithSuffix":271,"./getRegNonCapturing":272,"./iterateOverDateUnits":283}],270:[function(require,module,exports){
'use strict';

function getParsingTokenValue(token, str) {
  var val;
  if (token.val) {
    val = token.val;
  } else if (token.sign) {
    val = str === '+' ? 1 : -1;
  } else if (token.bool) {
    val = !!val;
  } else {
    val = +str.replace(/,/, '.');
  }
  if (token.param === 'month') {
    val -= 1;
  }
  return val;
}

module.exports = getParsingTokenValue;
},{}],271:[function(require,module,exports){
'use strict';

var LocalizedParsingTokens = require('../var/LocalizedParsingTokens'),
    getRegNonCapturing = require('./getRegNonCapturing');

function getParsingTokenWithSuffix(field, src, suffix) {
  var token = LocalizedParsingTokens[field];
  if (token.requiresSuffix) {
    src = getRegNonCapturing(src + getRegNonCapturing(suffix));
  } else if (token.requiresSuffixOr) {
    src += getRegNonCapturing(token.requiresSuffixOr + '|' + suffix);
  } else {
    src += getRegNonCapturing(suffix, true);
  }
  return src;
}

module.exports = getParsingTokenWithSuffix;
},{"../var/LocalizedParsingTokens":375,"./getRegNonCapturing":272}],272:[function(require,module,exports){
'use strict';

function getRegNonCapturing(src, opt) {
  if (src.length > 1) {
    src = '(?:' + src + ')';
  }
  if (opt) {
    src += '?';
  }
  return src;
}

module.exports = getRegNonCapturing;
},{}],273:[function(require,module,exports){
'use strict';

var trunc = require('../../common/var/trunc'),
    cloneDate = require('./cloneDate'),
    advanceDate = require('./advanceDate');

function getTimeDistanceForUnit(d1, d2, unit) {
  var fwd = d2 > d1, num, tmp;
  if (!fwd) {
    tmp = d2;
    d2  = d1;
    d1  = tmp;
  }
  num = d2 - d1;
  if (unit.multiplier > 1) {
    num = trunc(num / unit.multiplier);
  }
  // For higher order with potential ambiguity, use the numeric calculation
  // as a starting point, then iterate until we pass the target date.
  if (unit.ambiguous) {
    d1 = cloneDate(d1);
    if (num) {
      advanceDate(d1, unit.name, num);
    }
    while (d1 < d2) {
      advanceDate(d1, unit.name, 1);
      if (d1 > d2) {
        break;
      }
      num += 1;
    }
  }
  return fwd ? -num : num;
}

module.exports = getTimeDistanceForUnit;
},{"../../common/var/trunc":183,"./advanceDate":230,"./cloneDate":238}],274:[function(require,module,exports){
'use strict';

var _utc = require('../../common/var/_utc'),
    trunc = require('../../common/var/trunc'),
    tzOffset = require('./tzOffset'),
    padNumber = require('../../common/internal/padNumber'),
    mathAliases = require('../../common/var/mathAliases');

var abs = mathAliases.abs;

function getUTCOffset(d, iso) {
  var offset = _utc(d) ? 0 : tzOffset(d), hours, mins, colon;
  colon  = iso === true ? ':' : '';
  if (!offset && iso) return 'Z';
  hours = padNumber(trunc(-offset / 60), 2, true);
  mins = padNumber(abs(offset % 60), 2);
  return  hours + colon + mins;
}

module.exports = getUTCOffset;
},{"../../common/internal/padNumber":147,"../../common/var/_utc":175,"../../common/var/mathAliases":180,"../../common/var/trunc":183,"./tzOffset":299}],275:[function(require,module,exports){
'use strict';

var iterateOverDateParams = require('./iterateOverDateParams');

function getUnitIndexForParamName(name) {
  var params = {}, unitIndex;
  params[name] = 1;
  iterateOverDateParams(params, function(name, val, unit, i) {
    unitIndex = i;
    return false;
  });
  return unitIndex;
}

module.exports = getUnitIndexForParamName;
},{"./iterateOverDateParams":282}],276:[function(require,module,exports){
'use strict';

var ISODefaults = require('../var/ISODefaults'),
    setDate = require('./setDate'),
    getDate = require('./getDate'),
    cloneDate = require('./cloneDate'),
    isUndefined = require('../../common/internal/isUndefined'),
    moveToEndOfWeek = require('./moveToEndOfWeek'),
    moveToBeginningOfWeek = require('./moveToBeginningOfWeek'),
    moveToFirstDayOfWeekYear = require('./moveToFirstDayOfWeekYear');

var ISO_FIRST_DAY_OF_WEEK = ISODefaults.ISO_FIRST_DAY_OF_WEEK,
    ISO_FIRST_DAY_OF_WEEK_YEAR = ISODefaults.ISO_FIRST_DAY_OF_WEEK_YEAR;

function getWeekNumber(d, allowPrevious, firstDayOfWeek, firstDayOfWeekYear) {
  var isoWeek, n = 0;
  if (isUndefined(firstDayOfWeek)) {
    firstDayOfWeek = ISO_FIRST_DAY_OF_WEEK;
  }
  if (isUndefined(firstDayOfWeekYear)) {
    firstDayOfWeekYear = ISO_FIRST_DAY_OF_WEEK_YEAR;
  }
  // Moving to the end of the week allows for forward year traversal, ie
  // Dec 29 2014 is actually week 01 of 2015.
  isoWeek = moveToEndOfWeek(cloneDate(d), firstDayOfWeek);
  moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
  if (allowPrevious && d < isoWeek) {
    // If the date is still before the start of the year, then it should be
    // the last week of the previous year, ie Jan 1 2016 is actually week 53
    // of 2015, so move to the beginning of the week to traverse the year.
    isoWeek = moveToBeginningOfWeek(cloneDate(d), firstDayOfWeek);
    moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
  }
  while (isoWeek <= d) {
    // Doing a very simple walk to get the week number.
    setDate(isoWeek, getDate(isoWeek) + 7);
    n++;
  }
  return n;
}

module.exports = getWeekNumber;
},{"../../common/internal/isUndefined":140,"../var/ISODefaults":371,"./cloneDate":238,"./getDate":255,"./moveToBeginningOfWeek":286,"./moveToEndOfWeek":288,"./moveToFirstDayOfWeekYear":289,"./setDate":292}],277:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    getWeekNumber = require('./getWeekNumber');

var localeManager = LocaleHelpers.localeManager;

function getWeekYear(d, localeCode, iso) {
  var year, month, firstDayOfWeek, firstDayOfWeekYear, week, loc;
  year = getYear(d);
  month = getMonth(d);
  if (month === 0 || month === 11) {
    if (!iso) {
      loc = localeManager.get(localeCode);
      firstDayOfWeek = loc.getFirstDayOfWeek(localeCode);
      firstDayOfWeekYear = loc.getFirstDayOfWeekYear(localeCode);
    }
    week = getWeekNumber(d, false, firstDayOfWeek, firstDayOfWeekYear);
    if (month === 0 && week === 0) {
      year -= 1;
    } else if (month === 11 && week === 1) {
      year += 1;
    }
  }
  return year;
}

module.exports = getWeekYear;
},{"../var/LocaleHelpers":374,"./getMonth":267,"./getWeekNumber":276,"./getYear":279}],278:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getWeekday(d) {
  return callDateGet(d, 'Day');
}

module.exports = getWeekday;
},{"../../common/internal/callDateGet":93}],279:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getYear(d) {
  return callDateGet(d, 'FullYear');
}

module.exports = getYear;
},{"../../common/internal/callDateGet":93}],280:[function(require,module,exports){
'use strict';

var getYear = require('./getYear'),
    mathAliases = require('../../common/var/mathAliases');

var abs = mathAliases.abs;

function getYearFromAbbreviation(str, d, prefer) {
  // Following IETF here, adding 1900 or 2000 depending on the last two digits.
  // Note that this makes no accordance for what should happen after 2050, but
  // intentionally ignoring this for now. https://www.ietf.org/rfc/rfc2822.txt
  var val = +str, delta;
  val += val < 50 ? 2000 : 1900;
  if (prefer) {
    delta = val - getYear(d);
    if (delta / abs(delta) !== prefer) {
      val += prefer * 100;
    }
  }
  return val;
}

module.exports = getYearFromAbbreviation;
},{"../../common/var/mathAliases":180,"./getYear":279}],281:[function(require,module,exports){
'use strict';

var _utc = require('../../common/var/_utc'),
    tzOffset = require('./tzOffset');

function isUTC(d) {
  return !!_utc(d) || tzOffset(d) === 0;
}

module.exports = isUTC;
},{"../../common/var/_utc":175,"./tzOffset":299}],282:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    isDefined = require('../../common/internal/isDefined'),
    getDateParam = require('./getDateParam'),
    iterateOverDateUnits = require('./iterateOverDateUnits');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

function iterateOverDateParams(params, fn, startIndex, endIndex) {

  function run(name, unit, i) {
    var val = getDateParam(params, name);
    if (isDefined(val)) {
      fn(name, val, unit, i);
    }
  }

  iterateOverDateUnits(function (unit, i) {
    var result = run(unit.name, unit, i);
    if (result !== false && i === DAY_INDEX) {
      // Check for "weekday", which has a distinct meaning
      // in the context of setting a date, but has the same
      // meaning as "day" as a unit of time.
      result = run('weekday', unit, i);
    }
    return result;
  }, startIndex, endIndex);

}

module.exports = iterateOverDateParams;
},{"../../common/internal/isDefined":134,"../var/DateUnitIndexes":367,"./getDateParam":256,"./iterateOverDateUnits":283}],283:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    isUndefined = require('../../common/internal/isUndefined');

var YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function iterateOverDateUnits(fn, startIndex, endIndex) {
  endIndex = endIndex || 0;
  if (isUndefined(startIndex)) {
    startIndex = YEAR_INDEX;
  }
  for (var index = startIndex; index >= endIndex; index--) {
    if (fn(DateUnits[index], index) === false) {
      break;
    }
  }
}

module.exports = iterateOverDateUnits;
},{"../../common/internal/isUndefined":140,"../var/DateUnitIndexes":367,"../var/DateUnits":368}],284:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    iterateOverDateParams = require('./iterateOverDateParams');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function iterateOverHigherDateParams(params, fn) {
  iterateOverDateParams(params, fn, YEAR_INDEX, DAY_INDEX);
}

module.exports = iterateOverHigherDateParams;
},{"../var/DateUnitIndexes":367,"./iterateOverDateParams":282}],285:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    getLowerUnitIndex = require('./getLowerUnitIndex'),
    moveToBeginningOfWeek = require('./moveToBeginningOfWeek'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

var WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    localeManager = LocaleHelpers.localeManager;

function moveToBeginningOfUnit(d, unitIndex, localeCode) {
  if (unitIndex === WEEK_INDEX) {
    moveToBeginningOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
  }
  return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
}

module.exports = moveToBeginningOfUnit;
},{"../var/DateUnitIndexes":367,"../var/LocaleHelpers":374,"./getLowerUnitIndex":265,"./moveToBeginningOfWeek":286,"./setUnitAndLowerToEdge":296}],286:[function(require,module,exports){
'use strict';

var setWeekday = require('./setWeekday'),
    getWeekday = require('./getWeekday'),
    mathAliases = require('../../common/var/mathAliases');

var floor = mathAliases.floor;

function moveToBeginningOfWeek(d, firstDayOfWeek) {
  setWeekday(d, floor((getWeekday(d) - firstDayOfWeek) / 7) * 7 + firstDayOfWeek);
  return d;
}

module.exports = moveToBeginningOfWeek;
},{"../../common/var/mathAliases":180,"./getWeekday":278,"./setWeekday":297}],287:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    moveToEndOfWeek = require('./moveToEndOfWeek'),
    getLowerUnitIndex = require('./getLowerUnitIndex'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

var WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    localeManager = LocaleHelpers.localeManager;

function moveToEndOfUnit(d, unitIndex, localeCode, stopIndex) {
  if (unitIndex === WEEK_INDEX) {
    moveToEndOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
  }
  return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex), stopIndex, true);
}

module.exports = moveToEndOfUnit;
},{"../var/DateUnitIndexes":367,"../var/LocaleHelpers":374,"./getLowerUnitIndex":265,"./moveToEndOfWeek":288,"./setUnitAndLowerToEdge":296}],288:[function(require,module,exports){
'use strict';

var setWeekday = require('./setWeekday'),
    getWeekday = require('./getWeekday'),
    mathAliases = require('../../common/var/mathAliases');

var ceil = mathAliases.ceil;

function moveToEndOfWeek(d, firstDayOfWeek) {
  var target = firstDayOfWeek - 1;
  setWeekday(d, ceil((getWeekday(d) - target) / 7) * 7 + target);
  return d;
}

module.exports = moveToEndOfWeek;
},{"../../common/var/mathAliases":180,"./getWeekday":278,"./setWeekday":297}],289:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    setDate = require('./setDate'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge'),
    moveToBeginningOfWeek = require('./moveToBeginningOfWeek');

var MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function moveToFirstDayOfWeekYear(d, firstDayOfWeek, firstDayOfWeekYear) {
  setUnitAndLowerToEdge(d, MONTH_INDEX);
  setDate(d, firstDayOfWeekYear);
  moveToBeginningOfWeek(d, firstDayOfWeek);
}

module.exports = moveToFirstDayOfWeekYear;
},{"../var/DateUnitIndexes":367,"./moveToBeginningOfWeek":286,"./setDate":292,"./setUnitAndLowerToEdge":296}],290:[function(require,module,exports){
'use strict';

var getLowerUnitIndex = require('./getLowerUnitIndex'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

function resetLowerUnits(d, unitIndex) {
  return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
}

module.exports = resetLowerUnits;
},{"./getLowerUnitIndex":265,"./setUnitAndLowerToEdge":296}],291:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

var HOURS_INDEX = DateUnitIndexes.HOURS_INDEX;

function resetTime(d) {
  return setUnitAndLowerToEdge(d, HOURS_INDEX);
}

module.exports = resetTime;
},{"../var/DateUnitIndexes":367,"./setUnitAndLowerToEdge":296}],292:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet');

function setDate(d, val) {
  callDateSet(d, 'Date', val);
}

module.exports = setDate;
},{"../../common/internal/callDateSet":94}],293:[function(require,module,exports){
'use strict';

var createDate = require('./createDate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    setChainableConstructor = require('../../common/internal/setChainableConstructor');

var sugarDate = namespaceAliases.sugarDate;

function setDateChainableConstructor() {
  setChainableConstructor(sugarDate, createDate);
}

module.exports = setDateChainableConstructor;
},{"../../common/internal/setChainableConstructor":154,"../../common/var/namespaceAliases":182,"./createDate":243}],294:[function(require,module,exports){
'use strict';

var ISODefaults = require('../var/ISODefaults'),
    getDate = require('./getDate'),
    setDate = require('./setDate'),
    setYear = require('./setYear'),
    getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    setMonth = require('./setMonth'),
    cloneDate = require('./cloneDate'),
    getWeekday = require('./getWeekday'),
    setWeekday = require('./setWeekday'),
    classChecks = require('../../common/var/classChecks'),
    moveToFirstDayOfWeekYear = require('./moveToFirstDayOfWeekYear');

var isNumber = classChecks.isNumber,
    ISO_FIRST_DAY_OF_WEEK = ISODefaults.ISO_FIRST_DAY_OF_WEEK,
    ISO_FIRST_DAY_OF_WEEK_YEAR = ISODefaults.ISO_FIRST_DAY_OF_WEEK_YEAR;

function setISOWeekNumber(d, num) {
  if (isNumber(num)) {
    // Intentionally avoiding updateDate here to prevent circular dependencies.
    var isoWeek = cloneDate(d), dow = getWeekday(d);
    moveToFirstDayOfWeekYear(isoWeek, ISO_FIRST_DAY_OF_WEEK, ISO_FIRST_DAY_OF_WEEK_YEAR);
    setDate(isoWeek, getDate(isoWeek) + 7 * (num - 1));
    setYear(d, getYear(isoWeek));
    setMonth(d, getMonth(isoWeek));
    setDate(d, getDate(isoWeek));
    setWeekday(d, dow || 7);
  }
  return d.getTime();
}

module.exports = setISOWeekNumber;
},{"../../common/var/classChecks":177,"../var/ISODefaults":371,"./cloneDate":238,"./getDate":255,"./getMonth":267,"./getWeekday":278,"./getYear":279,"./moveToFirstDayOfWeekYear":289,"./setDate":292,"./setMonth":295,"./setWeekday":297,"./setYear":298}],295:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet');

function setMonth(d, val) {
  callDateSet(d, 'Month', val);
}

module.exports = setMonth;
},{"../../common/internal/callDateSet":94}],296:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    classChecks = require('../../common/var/classChecks'),
    callDateSet = require('../../common/internal/callDateSet'),
    walkUnitDown = require('./walkUnitDown');

var isFunction = classChecks.isFunction;

function setUnitAndLowerToEdge(d, startIndex, stopIndex, end) {
  walkUnitDown(startIndex, function(unit, i) {
    var val = end ? unit.end : unit.start;
    if (isFunction(val)) {
      val = val(d);
    }
    callDateSet(d, unit.method, val);
    return !isDefined(stopIndex) || i > stopIndex;
  });
  return d;
}

module.exports = setUnitAndLowerToEdge;
},{"../../common/internal/callDateSet":94,"../../common/internal/isDefined":134,"../../common/var/classChecks":177,"./walkUnitDown":301}],297:[function(require,module,exports){
'use strict';

var setDate = require('./setDate'),
    getDate = require('./getDate'),
    getWeekday = require('./getWeekday'),
    classChecks = require('../../common/var/classChecks'),
    mathAliases = require('../../common/var/mathAliases');

var isNumber = classChecks.isNumber,
    abs = mathAliases.abs;

function setWeekday(d, dow, dir) {
  if (!isNumber(dow)) return;
  var currentWeekday = getWeekday(d);
  if (dir) {
    // Allow a "direction" parameter to determine whether a weekday can
    // be set beyond the current weekday in either direction.
    var ndir = dir > 0 ? 1 : -1;
    var offset = dow % 7 - currentWeekday;
    if (offset && offset / abs(offset) !== ndir) {
      dow += 7 * ndir;
    }
  }
  setDate(d, getDate(d) + dow - currentWeekday);
  return d.getTime();
}

module.exports = setWeekday;
},{"../../common/var/classChecks":177,"../../common/var/mathAliases":180,"./getDate":255,"./getWeekday":278,"./setDate":292}],298:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet');

function setYear(d, val) {
  callDateSet(d, 'FullYear', val);
}

module.exports = setYear;
},{"../../common/internal/callDateSet":94}],299:[function(require,module,exports){
'use strict';

function tzOffset(d) {
  return d.getTimezoneOffset();
}

module.exports = tzOffset;
},{}],300:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    trunc = require('../../common/var/trunc'),
    setDate = require('./setDate'),
    getDate = require('./getDate'),
    getMonth = require('./getMonth'),
    getNewDate = require('./getNewDate'),
    setWeekday = require('./setWeekday'),
    mathAliases = require('../../common/var/mathAliases'),
    callDateGet = require('../../common/internal/callDateGet'),
    classChecks = require('../../common/var/classChecks'),
    resetLowerUnits = require('./resetLowerUnits'),
    getLowerUnitIndex = require('./getLowerUnitIndex'),
    getHigherUnitIndex = require('./getHigherUnitIndex'),
    callDateSetWithWeek = require('./callDateSetWithWeek'),
    iterateOverDateParams = require('./iterateOverDateParams');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX,
    YEAR_INDEX = DateUnitIndexes.YEAR_INDEX,
    round = mathAliases.round,
    isNumber = classChecks.isNumber;

function updateDate(d, params, reset, advance, prefer, weekdayDir) {
  var upperUnitIndex;

  function setUpperUnit(unitName, unitIndex) {
    if (prefer && !upperUnitIndex) {
      if (unitName === 'weekday') {
        upperUnitIndex = WEEK_INDEX;
      } else {
        upperUnitIndex = getHigherUnitIndex(unitIndex);
      }
    }
  }

  function setSpecificity(unitIndex) {
    // Other functions may preemptively set the specificity before arriving
    // here so concede to them if they have already set more specific units.
    if (unitIndex > params.specificity) {
      return;
    }
    params.specificity = unitIndex;
  }

  function canDisambiguate() {
    if (!upperUnitIndex || upperUnitIndex > YEAR_INDEX) {
      return;
    }
    switch(prefer) {
      case -1: return d > getNewDate();
      case  1: return d < getNewDate();
    }
  }

  function disambiguateHigherUnit() {
    var unit = DateUnits[upperUnitIndex];
    advance = prefer;
    setUnit(unit.name, 1, unit, upperUnitIndex);
  }

  function handleFraction(unit, unitIndex, fraction) {
    if (unitIndex) {
      var lowerUnit = DateUnits[getLowerUnitIndex(unitIndex)];
      var val = round(unit.multiplier / lowerUnit.multiplier * fraction);
      params[lowerUnit.name] = val;
    }
  }

  function monthHasShifted(d, targetMonth) {
    if (targetMonth < 0) {
      targetMonth = targetMonth % 12 + 12;
    }
    return targetMonth % 12 !== getMonth(d);
  }

  function setUnit(unitName, value, unit, unitIndex) {
    var method = unit.method, checkMonth, fraction;

    setUpperUnit(unitName, unitIndex);
    setSpecificity(unitIndex);

    fraction = value % 1;
    if (fraction) {
      handleFraction(unit, unitIndex, fraction);
      value = trunc(value);
    }

    if (unitName === 'weekday') {
      if (!advance) {
        // Weekdays are always considered absolute units so simply set them
        // here even if it is an "advance" operation. This is to help avoid
        // ambiguous meanings in "advance" as well as to neatly allow formats
        // like "Wednesday of next week" without more complex logic.
        setWeekday(d, value, weekdayDir);
      }
      return;
    }
    checkMonth = unitIndex === MONTH_INDEX && getDate(d) > 28;

    // If we are advancing or rewinding, then we need we need to set the
    // absolute time if the unit is "hours" or less. This is due to the fact
    // that setting by method is ambiguous during DST shifts. For example,
    // 1:00am on November 1st 2015 occurs twice in North American timezones
    // with DST, the second time being after the clocks are rolled back at
    // 2:00am. When springing forward this is automatically handled as there
    // is no 2:00am so the date automatically jumps to 3:00am. However, when
    // rolling back, setHours(2) will always choose the first "2am" even if
    // the date is currently set to the second, causing unintended jumps.
    // This ambiguity is unavoidable when setting dates as the notation is
    // ambiguous. However when advancing, we clearly want the resulting date
    // to be an acutal hour ahead, which can only be accomplished by setting
    // the absolute time. Conversely, any unit higher than "hours" MUST use
    // the internal set methods, as they are ambiguous as absolute units of
    // time. Years may be 365 or 366 days depending on leap years, months are
    // all over the place, and even days may be 23-25 hours depending on DST
    // shifts. Finally, note that the kind of jumping described above will
    // occur when calling ANY "set" method on the date and will occur even if
    // the value being set is identical to the one currently set (i.e.
    // setHours(2) on a date at 2am may not be a noop). This is precarious,
    // so avoiding this situation in callDateSet by checking up front that
    // the value is not the same before setting.
    if (advance && !unit.ambiguous) {
      d.setTime(d.getTime() + (value * advance * unit.multiplier));
      return;
    } else if (advance) {
      if (unitIndex === WEEK_INDEX) {
        value *= 7;
        method = DateUnits[DAY_INDEX].method;
      }
      value = (value * advance) + callDateGet(d, method);
    }
    callDateSetWithWeek(d, method, value, advance);
    if (checkMonth && monthHasShifted(d, value)) {
      // As we are setting the units in reverse order, there is a chance that
      // our date may accidentally traverse into a new month, such as setting
      // { month: 1, date 15 } on January 31st. Check for this here and reset
      // the date to the last day of the previous month if this has happened.
      setDate(d, 0);
    }
  }

  if (isNumber(params) && advance) {
    // If param is a number and advancing, the number is in milliseconds.
    params = { millisecond: params };
  } else if (isNumber(params)) {
    // Otherwise just set the timestamp and return.
    d.setTime(params);
    return d;
  }

  iterateOverDateParams(params, setUnit);

  if (reset && params.specificity) {
    resetLowerUnits(d, params.specificity);
  }

  // If past or future is preferred, then the process of "disambiguation" will
  // ensure that an ambiguous time/date ("4pm", "thursday", "June", etc.) will
  // be in the past or future. Weeks are only considered ambiguous if there is
  // a weekday, i.e. "thursday" is an ambiguous week, but "the 4th" is an
  // ambiguous month.
  if (canDisambiguate()) {
    disambiguateHigherUnit();
  }
  return d;
}

module.exports = updateDate;
},{"../../common/internal/callDateGet":93,"../../common/var/classChecks":177,"../../common/var/mathAliases":180,"../../common/var/trunc":183,"../var/DateUnitIndexes":367,"../var/DateUnits":368,"./callDateSetWithWeek":237,"./getDate":255,"./getHigherUnitIndex":263,"./getLowerUnitIndex":265,"./getMonth":267,"./getNewDate":268,"./iterateOverDateParams":282,"./resetLowerUnits":290,"./setDate":292,"./setWeekday":297}],301:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    getLowerUnitIndex = require('./getLowerUnitIndex');

function walkUnitDown(unitIndex, fn) {
  while (unitIndex >= 0) {
    if (fn(DateUnits[unitIndex], unitIndex) === false) {
      break;
    }
    unitIndex = getLowerUnitIndex(unitIndex);
  }
}

module.exports = walkUnitDown;
},{"../var/DateUnits":368,"./getLowerUnitIndex":265}],302:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    fullCompareDate = require('./internal/fullCompareDate');

Sugar.Date.defineInstance({

  'is': function(date, d, margin) {
    return fullCompareDate(date, d, margin);
  }

});

module.exports = Sugar.Date.is;
},{"./internal/fullCompareDate":250,"sugar-core":3}],303:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate');

Sugar.Date.defineInstance({

  'isAfter': function(date, d, margin) {
    return date.getTime() > createDate(d).getTime() - (margin || 0);
  }

});

module.exports = Sugar.Date.isAfter;
},{"./internal/createDate":243,"sugar-core":3}],304:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate');

Sugar.Date.defineInstance({

  'isBefore': function(date, d, margin) {
    return date.getTime() < createDate(d).getTime() + (margin || 0);
  }

});

module.exports = Sugar.Date.isBefore;
},{"./internal/createDate":243,"sugar-core":3}],305:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate'),
    mathAliases = require('../common/var/mathAliases');

var min = mathAliases.min,
    max = mathAliases.max;

Sugar.Date.defineInstance({

  'isBetween': function(date, d1, d2, margin) {
    var t  = date.getTime();
    var t1 = createDate(d1).getTime();
    var t2 = createDate(d2).getTime();
    var lo = min(t1, t2);
    var hi = max(t1, t2);
    margin = margin || 0;
    return (lo - margin <= t) && (hi + margin >= t);
  }

});

module.exports = Sugar.Date.isBetween;
},{"../common/var/mathAliases":180,"./internal/createDate":243,"sugar-core":3}],306:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isFriday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],307:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isFuture;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],308:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isLastMonth;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],309:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isLastWeek;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],310:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isLastYear;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],311:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getYear = require('./internal/getYear');

Sugar.Date.defineInstance({

  'isLeapYear': function(date) {
    var year = getYear(date);
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

});

module.exports = Sugar.Date.isLeapYear;
},{"./internal/getYear":279,"sugar-core":3}],312:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isMonday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],313:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isNextMonth;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],314:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isNextWeek;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],315:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isNextYear;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],316:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isPast;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],317:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isSaturday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],318:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isSunday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],319:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isThisMonth;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],320:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isThisWeek;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],321:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isThisYear;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],322:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isThursday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],323:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isToday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],324:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isTomorrow;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],325:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isTuesday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],326:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUTC = require('./internal/isUTC');

Sugar.Date.defineInstance({

  'isUTC': function(date) {
    return isUTC(date);
  }

});

module.exports = Sugar.Date.isUTC;
},{"./internal/isUTC":281,"sugar-core":3}],327:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    dateIsValid = require('./internal/dateIsValid');

Sugar.Date.defineInstance({

  'isValid': function(date) {
    return dateIsValid(date);
  }

});

module.exports = Sugar.Date.isValid;
},{"./internal/dateIsValid":246,"sugar-core":3}],328:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isWednesday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],329:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isWeekday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],330:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isWeekend;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],331:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isYesterday;
},{"./build/buildRelativeAliasesCall":201,"sugar-core":3}],332:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Date.defineInstance({

  'iso': function(date) {
    return date.toISOString();
  }

});

module.exports = Sugar.Date.iso;
},{"sugar-core":3}],333:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],334:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],335:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],336:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],337:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],338:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],339:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],340:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],341:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],342:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],343:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],344:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],345:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    DateRangeConstructor = require('../range/var/DateRangeConstructor');

Sugar.Date.defineStatic({

  'range': DateRangeConstructor

});

module.exports = Sugar.Date.range;
},{"../range/var/DateRangeConstructor":699,"sugar-core":3}],346:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    dateRelative = require('./internal/dateRelative');

Sugar.Date.defineInstance({

  'relative': function(date, localeCode, fn) {
    return dateRelative(date, null, localeCode, fn);
  }

});

module.exports = Sugar.Date.relative;
},{"./internal/dateRelative":247,"sugar-core":3}],347:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate'),
    dateRelative = require('./internal/dateRelative');

Sugar.Date.defineInstance({

  'relativeTo': function(date, d, localeCode) {
    return dateRelative(date, createDate(d), localeCode);
  }

});

module.exports = Sugar.Date.relativeTo;
},{"./internal/createDate":243,"./internal/dateRelative":247,"sugar-core":3}],348:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'removeLocale': function(code) {
    return localeManager.remove(code);
  }

});

module.exports = Sugar.Date.removeLocale;
},{"./var/LocaleHelpers":374,"sugar-core":3}],349:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    DateUnitIndexes = require('./var/DateUnitIndexes'),
    moveToBeginningOfUnit = require('./internal/moveToBeginningOfUnit'),
    getUnitIndexForParamName = require('./internal/getUnitIndexForParamName');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

Sugar.Date.defineInstance({

  'reset': function(date, unit, localeCode) {
    var unitIndex = unit ? getUnitIndexForParamName(unit) : DAY_INDEX;
    moveToBeginningOfUnit(date, unitIndex, localeCode);
    return date;
  }

});

module.exports = Sugar.Date.reset;
},{"./internal/getUnitIndexForParamName":275,"./internal/moveToBeginningOfUnit":285,"./var/DateUnitIndexes":367,"sugar-core":3}],350:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    advanceDateWithArgs = require('./internal/advanceDateWithArgs');

Sugar.Date.defineInstanceWithArguments({

  'rewind': function(d, args) {
    return advanceDateWithArgs(d, args, -1);
  }

});

module.exports = Sugar.Date.rewind;
},{"./internal/advanceDateWithArgs":231,"sugar-core":3}],351:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],352:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],353:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],354:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],355:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    updateDate = require('./internal/updateDate'),
    collectDateArguments = require('./internal/collectDateArguments');

Sugar.Date.defineInstanceWithArguments({

  'set': function(d, args) {
    args = collectDateArguments(args);
    return updateDate(d, args[0], args[1]);
  }

});

module.exports = Sugar.Date.set;
},{"./internal/collectDateArguments":239,"./internal/updateDate":300,"sugar-core":3}],356:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setISOWeekNumber = require('./internal/setISOWeekNumber');

Sugar.Date.defineInstance({

  'setISOWeek': function(date, num) {
    return setISOWeekNumber(date, num);
  }

});

module.exports = Sugar.Date.setISOWeek;
},{"./internal/setISOWeekNumber":294,"sugar-core":3}],357:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'setLocale': function(code) {
    return localeManager.set(code);
  }

});

module.exports = Sugar.Date.setLocale;
},{"./var/LocaleHelpers":374,"sugar-core":3}],358:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _dateOptions = require('./var/_dateOptions');

module.exports = Sugar.Date.setOption;
},{"./var/_dateOptions":379,"sugar-core":3}],359:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _utc = require('../common/var/_utc');

Sugar.Date.defineInstance({

  'setUTC': function(date, on) {
    return _utc(date, on);
  }

});

module.exports = Sugar.Date.setUTC;
},{"../common/var/_utc":175,"sugar-core":3}],360:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setWeekday = require('./internal/setWeekday');

Sugar.Date.defineInstance({

  'setWeekday': function(date, dow) {
    return setWeekday(date, dow);
  }

});

module.exports = Sugar.Date.setWeekday;
},{"./internal/setWeekday":297,"sugar-core":3}],361:[function(require,module,exports){
'use strict';

var getEnglishVariant = require('../internal/getEnglishVariant');

var AmericanEnglishDefinition = getEnglishVariant({
  'mdy': true,
  'firstDayOfWeek': 0,
  'firstDayOfWeekYear': 1,
  'short':  '{MM}/{dd}/{yyyy}',
  'medium': '{Month} {d}, {yyyy}',
  'long':   '{Month} {d}, {yyyy} {time}',
  'full':   '{Weekday}, {Month} {d}, {yyyy} {time}',
  'stamp':  '{Dow} {Mon} {d} {yyyy} {time}',
  'time':   '{h}:{mm} {TT}'
});

module.exports = AmericanEnglishDefinition;
},{"../internal/getEnglishVariant":261}],362:[function(require,module,exports){
'use strict';

var getEnglishVariant = require('../internal/getEnglishVariant');

var BritishEnglishDefinition = getEnglishVariant({
  'short':  '{dd}/{MM}/{yyyy}',
  'medium': '{d} {Month} {yyyy}',
  'long':   '{d} {Month} {yyyy} {H}:{mm}',
  'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
  'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
});

module.exports = BritishEnglishDefinition;
},{"../internal/getEnglishVariant":261}],363:[function(require,module,exports){
'use strict';

var getEnglishVariant = require('../internal/getEnglishVariant');

var CanadianEnglishDefinition = getEnglishVariant({
  'short':  '{yyyy}-{MM}-{dd}',
  'medium': '{d} {Month}, {yyyy}',
  'long':   '{d} {Month}, {yyyy} {H}:{mm}',
  'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
  'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
});

module.exports = CanadianEnglishDefinition;
},{"../internal/getEnglishVariant":261}],364:[function(require,module,exports){
'use strict';

var CoreOutputFormats = {
  'ISO8601': '{yyyy}-{MM}-{dd}T{HH}:{mm}:{ss}.{SSS}{Z}',
  'RFC1123': '{Dow}, {dd} {Mon} {yyyy} {HH}:{mm}:{ss} {ZZ}',
  'RFC1036': '{Weekday}, {dd}-{Mon}-{yy} {HH}:{mm}:{ss} {ZZ}'
};

module.exports = CoreOutputFormats;
},{}],365:[function(require,module,exports){
'use strict';

var CoreParsingFormats = [
  {
    // 12-1978
    // 08-1978 (MDY)
    src: '{MM}[-.\\/]{yyyy}'
  },
  {
    // 12/08/1978
    // 08/12/1978 (MDY)
    time: true,
    src: '{dd}[-.\\/]{MM}(?:[-.\\/]{yyyy|yy|y})?',
    mdy: '{MM}[-.\\/]{dd}(?:[-.\\/]{yyyy|yy|y})?'
  },
  {
    // 1975-08-25
    time: true,
    src: '{yyyy}[-.\\/]{MM}(?:[-.\\/]{dd})?'
  },
  {
    // .NET JSON
    src: '\\\\/Date\\({timestamp}(?:[+-]\\d{4,4})?\\)\\\\/'
  },
  {
    // ISO-8601
    src: '{yearSign?}{yyyy}(?:-?{MM}(?:-?{dd}(?:T{ihh}(?::?{imm}(?::?{ss})?)?)?)?)?{tzOffset?}'
  }
];

module.exports = CoreParsingFormats;
},{}],366:[function(require,module,exports){
'use strict';

var defaultNewDate = require('../internal/defaultNewDate');

var DATE_OPTIONS = {
  'newDateInternal': defaultNewDate
};

module.exports = DATE_OPTIONS;
},{"../internal/defaultNewDate":248}],367:[function(require,module,exports){
'use strict';

module.exports = {
  HOURS_INDEX: 3,
  DAY_INDEX: 4,
  WEEK_INDEX: 5,
  MONTH_INDEX: 6,
  YEAR_INDEX: 7
};
},{}],368:[function(require,module,exports){
'use strict';

var getDaysInMonth = require('../internal/getDaysInMonth');

var DateUnits = [
  {
    name: 'millisecond',
    method: 'Milliseconds',
    multiplier: 1,
    start: 0,
    end: 999
  },
  {
    name: 'second',
    method: 'Seconds',
    multiplier: 1000,
    start: 0,
    end: 59
  },
  {
    name: 'minute',
    method: 'Minutes',
    multiplier: 60 * 1000,
    start: 0,
    end: 59
  },
  {
    name: 'hour',
    method: 'Hours',
    multiplier: 60 * 60 * 1000,
    start: 0,
    end: 23
  },
  {
    name: 'day',
    alias: 'date',
    method: 'Date',
    ambiguous: true,
    multiplier: 24 * 60 * 60 * 1000,
    start: 1,
    end: function(d) {
      return getDaysInMonth(d);
    }
  },
  {
    name: 'week',
    method: 'ISOWeek',
    ambiguous: true,
    multiplier: 7 * 24 * 60 * 60 * 1000
  },
  {
    name: 'month',
    method: 'Month',
    ambiguous: true,
    multiplier: 30.4375 * 24 * 60 * 60 * 1000,
    start: 0,
    end: 11
  },
  {
    name: 'year',
    method: 'FullYear',
    ambiguous: true,
    multiplier: 365.25 * 24 * 60 * 60 * 1000,
    start: 0
  }
];

module.exports = DateUnits;
},{"../internal/getDaysInMonth":259}],369:[function(require,module,exports){
'use strict';

var EnglishLocaleBaseDefinition = {
  'code': 'en',
  'plural': true,
  'timeMarkers': 'at',
  'ampm': 'AM|A.M.|a,PM|P.M.|p',
  'units': 'millisecond:|s,second:|s,minute:|s,hour:|s,day:|s,week:|s,month:|s,year:|s',
  'months': 'Jan:uary|,Feb:ruary|,Mar:ch|,Apr:il|,May,Jun:e|,Jul:y|,Aug:ust|,Sep:tember|t|,Oct:ober|,Nov:ember|,Dec:ember|',
  'weekdays': 'Sun:day|,Mon:day|,Tue:sday|,Wed:nesday|,Thu:rsday|,Fri:day|,Sat:urday|+weekend',
  'numerals': 'zero,one|first,two|second,three|third,four:|th,five|fifth,six:|th,seven:|th,eight:|h,nin:e|th,ten:|th',
  'articles': 'a,an,the',
  'tokens': 'the,st|nd|rd|th,of|in,a|an,on',
  'time': '{H}:{mm}',
  'past': '{num} {unit} {sign}',
  'future': '{num} {unit} {sign}',
  'duration': '{num} {unit}',
  'modifiers': [
    { 'name': 'half',   'src': 'half', 'value': .5 },
    { 'name': 'midday', 'src': 'noon', 'value': 12 },
    { 'name': 'midday', 'src': 'midnight', 'value': 24 },
    { 'name': 'day',    'src': 'yesterday', 'value': -1 },
    { 'name': 'day',    'src': 'today|tonight', 'value': 0 },
    { 'name': 'day',    'src': 'tomorrow', 'value': 1 },
    { 'name': 'sign',   'src': 'ago|before', 'value': -1 },
    { 'name': 'sign',   'src': 'from now|after|from|in|later', 'value': 1 },
    { 'name': 'edge',   'src': 'first day|first|beginning', 'value': -2 },
    { 'name': 'edge',   'src': 'last day', 'value': 1 },
    { 'name': 'edge',   'src': 'end|last', 'value': 2 },
    { 'name': 'shift',  'src': 'last', 'value': -1 },
    { 'name': 'shift',  'src': 'the|this', 'value': 0 },
    { 'name': 'shift',  'src': 'next', 'value': 1 }
  ],
  'parse': [
    '(?:just)? now',
    '{shift} {unit:5-7}',
    "{months?} (?:{year}|'{yy})",
    '{midday} {4?} {day|weekday}',
    '{months},?(?:[-.\\/\\s]{year})?',
    '{edge} of (?:day)? {day|weekday}',
    '{0} {num}{1?} {weekday} {2} {months},? {year?}',
    '{shift?} {day?} {weekday?} {timeMarker?} {midday}',
    '{sign?} {3?} {half} {3?} {unit:3-4|unit:7} {sign?}',
    '{0?} {edge} {weekday?} {2} {shift?} {unit:4-7?} {months?},? {year?}'
  ],
  'timeParse': [
    '{day|weekday}',
    '{shift} {unit:5?} {weekday}',
    '{0?} {date}{1?} {2?} {months?}',
    '{weekday} {2?} {shift} {unit:5}',
    '{0?} {num} {2?} {months}\\.?,? {year?}',
    '{num?} {unit:4-5} {sign} {day|weekday}',
    '{year}[-.\\/\\s]{months}[-.\\/\\s]{date}',
    '{0|months} {date?}{1?} of {shift} {unit:6-7}',
    '{0?} {num}{1?} {weekday} of {shift} {unit:6}',
    "{date}[-.\\/\\s]{months}[-.\\/\\s](?:{year}|'?{yy})",
    "{weekday?}\\.?,? {months}\\.?,? {date}{1?},? (?:{year}|'{yy})?"
  ],
  'timeFrontParse': [
    '{sign} {num} {unit}',
    '{num} {unit} {sign}',
    '{4?} {day|weekday}'
  ]
};

module.exports = EnglishLocaleBaseDefinition;
},{}],370:[function(require,module,exports){
'use strict';

var TIMEZONE_ABBREVIATION_REG = require('./TIMEZONE_ABBREVIATION_REG'),
    LocaleHelpers = require('./LocaleHelpers'),
    DateUnitIndexes = require('./DateUnitIndexes'),
    trunc = require('../../common/var/trunc'),
    getDate = require('../internal/getDate'),
    getYear = require('../internal/getYear'),
    getHours = require('../internal/getHours'),
    getMonth = require('../internal/getMonth'),
    cloneDate = require('../internal/cloneDate'),
    padNumber = require('../../common/internal/padNumber'),
    getWeekday = require('../internal/getWeekday'),
    callDateGet = require('../../common/internal/callDateGet'),
    mathAliases = require('../../common/var/mathAliases'),
    getWeekYear = require('../internal/getWeekYear'),
    getUTCOffset = require('../internal/getUTCOffset'),
    getDaysSince = require('../internal/getDaysSince'),
    getWeekNumber = require('../internal/getWeekNumber'),
    getMeridiemToken = require('../internal/getMeridiemToken'),
    setUnitAndLowerToEdge = require('../internal/setUnitAndLowerToEdge');

var localeManager = LocaleHelpers.localeManager,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX,
    ceil = mathAliases.ceil;

var FormatTokensBase = [
  {
    ldml: 'Dow',
    strf: 'a',
    lowerToken: 'dow',
    get: function(d, localeCode) {
      return localeManager.get(localeCode).getWeekdayName(getWeekday(d), 2);
    }
  },
  {
    ldml: 'Weekday',
    strf: 'A',
    lowerToken: 'weekday',
    allowAlternates: true,
    get: function(d, localeCode, alternate) {
      return localeManager.get(localeCode).getWeekdayName(getWeekday(d), alternate);
    }
  },
  {
    ldml: 'Mon',
    strf: 'b h',
    lowerToken: 'mon',
    get: function(d, localeCode) {
      return localeManager.get(localeCode).getMonthName(getMonth(d), 2);
    }
  },
  {
    ldml: 'Month',
    strf: 'B',
    lowerToken: 'month',
    allowAlternates: true,
    get: function(d, localeCode, alternate) {
      return localeManager.get(localeCode).getMonthName(getMonth(d), alternate);
    }
  },
  {
    strf: 'C',
    get: function(d) {
      return getYear(d).toString().slice(0, 2);
    }
  },
  {
    ldml: 'd date day',
    strf: 'd',
    strfPadding: 2,
    ldmlPaddedToken: 'dd',
    ordinalToken: 'do',
    get: function(d) {
      return getDate(d);
    }
  },
  {
    strf: 'e',
    get: function(d) {
      return padNumber(getDate(d), 2, false, 10, ' ');
    }
  },
  {
    ldml: 'H 24hr',
    strf: 'H',
    strfPadding: 2,
    ldmlPaddedToken: 'HH',
    get: function(d) {
      return getHours(d);
    }
  },
  {
    ldml: 'h hours 12hr',
    strf: 'I',
    strfPadding: 2,
    ldmlPaddedToken: 'hh',
    get: function(d) {
      return getHours(d) % 12 || 12;
    }
  },
  {
    ldml: 'D',
    strf: 'j',
    strfPadding: 3,
    ldmlPaddedToken: 'DDD',
    get: function(d) {
      var s = setUnitAndLowerToEdge(cloneDate(d), MONTH_INDEX);
      return getDaysSince(d, s) + 1;
    }
  },
  {
    ldml: 'M',
    strf: 'm',
    strfPadding: 2,
    ordinalToken: 'Mo',
    ldmlPaddedToken: 'MM',
    get: function(d) {
      return getMonth(d) + 1;
    }
  },
  {
    ldml: 'm minutes',
    strf: 'M',
    strfPadding: 2,
    ldmlPaddedToken: 'mm',
    get: function(d) {
      return callDateGet(d, 'Minutes');
    }
  },
  {
    ldml: 'Q',
    get: function(d) {
      return ceil((getMonth(d) + 1) / 3);
    }
  },
  {
    ldml: 'TT',
    strf: 'p',
    get: function(d, localeCode) {
      return getMeridiemToken(d, localeCode);
    }
  },
  {
    ldml: 'tt',
    strf: 'P',
    get: function(d, localeCode) {
      return getMeridiemToken(d, localeCode).toLowerCase();
    }
  },
  {
    ldml: 'T',
    lowerToken: 't',
    get: function(d, localeCode) {
      return getMeridiemToken(d, localeCode).charAt(0);
    }
  },
  {
    ldml: 's seconds',
    strf: 'S',
    strfPadding: 2,
    ldmlPaddedToken: 'ss',
    get: function(d) {
      return callDateGet(d, 'Seconds');
    }
  },
  {
    ldml: 'S ms',
    strfPadding: 3,
    ldmlPaddedToken: 'SSS',
    get: function(d) {
      return callDateGet(d, 'Milliseconds');
    }
  },
  {
    ldml: 'e',
    strf: 'u',
    ordinalToken: 'eo',
    get: function(d) {
      return getWeekday(d) || 7;
    }
  },
  {
    strf: 'U',
    strfPadding: 2,
    get: function(d) {
      // Sunday first, 0-53
      return getWeekNumber(d, false, 0);
    }
  },
  {
    ldml: 'W',
    strf: 'V',
    strfPadding: 2,
    ordinalToken: 'Wo',
    ldmlPaddedToken: 'WW',
    get: function(d) {
      // Monday first, 1-53 (ISO8601)
      return getWeekNumber(d, true);
    }
  },
  {
    strf: 'w',
    get: function(d) {
      return getWeekday(d);
    }
  },
  {
    ldml: 'w',
    ordinalToken: 'wo',
    ldmlPaddedToken: 'ww',
    get: function(d, localeCode) {
      // Locale dependent, 1-53
      var loc = localeManager.get(localeCode),
          dow = loc.getFirstDayOfWeek(localeCode),
          doy = loc.getFirstDayOfWeekYear(localeCode);
      return getWeekNumber(d, true, dow, doy);
    }
  },
  {
    strf: 'W',
    strfPadding: 2,
    get: function(d) {
      // Monday first, 0-53
      return getWeekNumber(d, false);
    }
  },
  {
    ldmlPaddedToken: 'gggg',
    ldmlTwoDigitToken: 'gg',
    get: function(d, localeCode) {
      return getWeekYear(d, localeCode);
    }
  },
  {
    strf: 'G',
    strfPadding: 4,
    strfTwoDigitToken: 'g',
    ldmlPaddedToken: 'GGGG',
    ldmlTwoDigitToken: 'GG',
    get: function(d, localeCode) {
      return getWeekYear(d, localeCode, true);
    }
  },
  {
    ldml: 'year',
    ldmlPaddedToken: 'yyyy',
    ldmlTwoDigitToken: 'yy',
    strf: 'Y',
    strfPadding: 4,
    strfTwoDigitToken: 'y',
    get: function(d) {
      return getYear(d);
    }
  },
  {
    ldml: 'ZZ',
    strf: 'z',
    get: function(d) {
      return getUTCOffset(d);
    }
  },
  {
    ldml: 'X',
    get: function(d) {
      return trunc(d.getTime() / 1000);
    }
  },
  {
    ldml: 'x',
    get: function(d) {
      return d.getTime();
    }
  },
  {
    ldml: 'Z',
    get: function(d) {
      return getUTCOffset(d, true);
    }
  },
  {
    ldml: 'z',
    strf: 'Z',
    get: function(d) {
      // Note that this is not accurate in all browsing environments!
      // https://github.com/moment/moment/issues/162
      // It will continue to be supported for Node and usage with the
      // understanding that it may be blank.
      var match = d.toString().match(TIMEZONE_ABBREVIATION_REG);
      return match ? match[1]: '';
    }
  },
  {
    strf: 'D',
    alias: '%m/%d/%y'
  },
  {
    strf: 'F',
    alias: '%Y-%m-%d'
  },
  {
    strf: 'r',
    alias: '%I:%M:%S %p'
  },
  {
    strf: 'R',
    alias: '%H:%M'
  },
  {
    strf: 'T',
    alias: '%H:%M:%S'
  },
  {
    strf: 'x',
    alias: '{short}'
  },
  {
    strf: 'X',
    alias: '{time}'
  },
  {
    strf: 'c',
    alias: '{stamp}'
  }
];

module.exports = FormatTokensBase;
},{"../../common/internal/callDateGet":93,"../../common/internal/padNumber":147,"../../common/var/mathAliases":180,"../../common/var/trunc":183,"../internal/cloneDate":238,"../internal/getDate":255,"../internal/getDaysSince":260,"../internal/getHours":264,"../internal/getMeridiemToken":266,"../internal/getMonth":267,"../internal/getUTCOffset":274,"../internal/getWeekNumber":276,"../internal/getWeekYear":277,"../internal/getWeekday":278,"../internal/getYear":279,"../internal/setUnitAndLowerToEdge":296,"./DateUnitIndexes":367,"./LocaleHelpers":374,"./TIMEZONE_ABBREVIATION_REG":378}],371:[function(require,module,exports){
'use strict';

module.exports = {
  ISO_FIRST_DAY_OF_WEEK: 1,
  ISO_FIRST_DAY_OF_WEEK_YEAR: 4
};
},{}],372:[function(require,module,exports){
'use strict';

var LOCALE_ARRAY_FIELDS = [
  'months', 'weekdays', 'units', 'numerals', 'placeholders',
  'articles', 'tokens', 'timeMarkers', 'ampm', 'timeSuffixes',
  'parse', 'timeParse', 'timeFrontParse', 'modifiers'
];

module.exports = LOCALE_ARRAY_FIELDS;
},{}],373:[function(require,module,exports){
'use strict';

var BritishEnglishDefinition = require('./BritishEnglishDefinition'),
    AmericanEnglishDefinition = require('./AmericanEnglishDefinition'),
    CanadianEnglishDefinition = require('./CanadianEnglishDefinition');

var LazyLoadedLocales = {
  'en-US': AmericanEnglishDefinition,
  'en-GB': BritishEnglishDefinition,
  'en-AU': BritishEnglishDefinition,
  'en-CA': CanadianEnglishDefinition
};

module.exports = LazyLoadedLocales;
},{"./AmericanEnglishDefinition":361,"./BritishEnglishDefinition":362,"./CanadianEnglishDefinition":363}],374:[function(require,module,exports){
'use strict';

var LazyLoadedLocales = require('./LazyLoadedLocales'),
    AmericanEnglishDefinition = require('./AmericanEnglishDefinition'),
    getNewLocale = require('../internal/getNewLocale');

var English, localeManager;

function buildLocales() {

  function LocaleManager(loc) {
    this.locales = {};
    this.add(loc);
  }

  LocaleManager.prototype = {

    get: function(code, fallback) {
      var loc = this.locales[code];
      if (!loc && LazyLoadedLocales[code]) {
        loc = this.add(code, LazyLoadedLocales[code]);
      } else if (!loc && code) {
        loc = this.locales[code.slice(0, 2)];
      }
      return loc || fallback === false ? loc : this.current;
    },

    getAll: function() {
      return this.locales;
    },

    set: function(code) {
      var loc = this.get(code, false);
      if (!loc) {
        throw new TypeError('Invalid Locale: ' + code);
      }
      return this.current = loc;
    },

    add: function(code, def) {
      if (!def) {
        def = code;
        code = def.code;
      } else {
        def.code = code;
      }
      var loc = def.compiledFormats ? def : getNewLocale(def);
      this.locales[code] = loc;
      if (!this.current) {
        this.current = loc;
      }
      return loc;
    },

    remove: function(code) {
      if (this.current.code === code) {
        this.current = this.get('en');
      }
      return delete this.locales[code];
    }

  };

  // Sorry about this guys...
  English = getNewLocale(AmericanEnglishDefinition);
  localeManager = new LocaleManager(English);
}

buildLocales();

module.exports = {
  English: English,
  localeManager: localeManager
};
},{"../internal/getNewLocale":269,"./AmericanEnglishDefinition":361,"./LazyLoadedLocales":373}],375:[function(require,module,exports){
'use strict';

var LocalizedParsingTokens = {
  'year': {
    base: 'yyyy',
    requiresSuffix: true
  },
  'month': {
    base: 'MM',
    requiresSuffix: true
  },
  'date': {
    base: 'dd',
    requiresSuffix: true
  },
  'hour': {
    base: 'hh',
    requiresSuffixOr: ':'
  },
  'minute': {
    base: 'mm'
  },
  'second': {
    base: 'ss'
  },
  'num': {
    src: '\\d+',
    requiresNumerals: true
  }
};

module.exports = LocalizedParsingTokens;
},{}],376:[function(require,module,exports){
'use strict';

module.exports = 60 * 1000;
},{}],377:[function(require,module,exports){
'use strict';

var ParsingTokens = {
  'yyyy': {
    param: 'year',
    src: '\\d{4}'
  },
  'MM': {
    param: 'month',
    src: '[01]?\\d'
  },
  'dd': {
    param: 'date',
    src: '[0123]?\\d'
  },
  'hh': {
    param: 'hour',
    src: '[0-2]?\\d'
  },
  'mm': {
    param: 'minute',
    src: '[0-5]\\d'
  },
  'ss': {
    param: 'second',
    src: '[0-5]\\d(?:[,.]\\d+)?'
  },
  'yy': {
    param: 'year',
    src: '\\d{2}'
  },
  'y': {
    param: 'year',
    src: '\\d'
  },
  'yearSign': {
    src: '[+-]',
    sign: true
  },
  'tzHour': {
    src: '[0-1]\\d'
  },
  'tzMinute': {
    src: '[0-5]\\d'
  },
  'tzSign': {
    src: '[+−-]',
    sign: true
  },
  'ihh': {
    param: 'hour',
    src: '[0-2]?\\d(?:[,.]\\d+)?'
  },
  'imm': {
    param: 'minute',
    src: '[0-5]\\d(?:[,.]\\d+)?'
  },
  'GMT': {
    param: 'utc',
    src: 'GMT',
    val: 1
  },
  'Z': {
    param: 'utc',
    src: 'Z',
    val: 1
  },
  'timestamp': {
    src: '\\d+'
  }
};

module.exports = ParsingTokens;
},{}],378:[function(require,module,exports){
'use strict';

module.exports = /(\w{3})[()\s\d]*$/;
},{}],379:[function(require,module,exports){
'use strict';

var DATE_OPTIONS = require('./DATE_OPTIONS'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineOptionsAccessor = require('../../common/internal/defineOptionsAccessor');

var sugarDate = namespaceAliases.sugarDate;

module.exports = defineOptionsAccessor(sugarDate, DATE_OPTIONS);
},{"../../common/internal/defineOptionsAccessor":109,"../../common/var/namespaceAliases":182,"./DATE_OPTIONS":366}],380:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('./LocaleHelpers'),
    FormatTokensBase = require('./FormatTokensBase'),
    CoreOutputFormats = require('./CoreOutputFormats'),
    forEach = require('../../common/internal/forEach'),
    padNumber = require('../../common/internal/padNumber'),
    spaceSplit = require('../../common/internal/spaceSplit'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    createFormatMatcher = require('../../common/internal/createFormatMatcher'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var localeManager = LocaleHelpers.localeManager,
    hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn,
    forEachProperty = coreUtilityAliases.forEachProperty,
    sugarDate = namespaceAliases.sugarDate;

var ldmlTokens, strfTokens;

function buildDateFormatTokens() {

  function addFormats(target, tokens, fn) {
    if (tokens) {
      forEach(spaceSplit(tokens), function(token) {
        target[token] = fn;
      });
    }
  }

  function buildLowercase(get) {
    return function(d, localeCode) {
      return get(d, localeCode).toLowerCase();
    };
  }

  function buildOrdinal(get) {
    return function(d, localeCode) {
      var n = get(d, localeCode);
      return n + localeManager.get(localeCode).getOrdinal(n);
    };
  }

  function buildPadded(get, padding) {
    return function(d, localeCode) {
      return padNumber(get(d, localeCode), padding);
    };
  }

  function buildTwoDigits(get) {
    return function(d, localeCode) {
      return get(d, localeCode) % 100;
    };
  }

  function buildAlias(alias) {
    return function(d, localeCode) {
      return dateFormatMatcher(alias, d, localeCode);
    };
  }

  function buildAlternates(f) {
    for (var n = 1; n <= 5; n++) {
      buildAlternate(f, n);
    }
  }

  function buildAlternate(f, n) {
    var alternate = function(d, localeCode) {
      return f.get(d, localeCode, n);
    };
    addFormats(ldmlTokens, f.ldml + n, alternate);
    if (f.lowerToken) {
      ldmlTokens[f.lowerToken + n] = buildLowercase(alternate);
    }
  }

  function getIdentityFormat(name) {
    return function(d, localeCode) {
      var loc = localeManager.get(localeCode);
      return dateFormatMatcher(loc[name], d, localeCode);
    };
  }

  ldmlTokens = {};
  strfTokens = {};

  forEach(FormatTokensBase, function(f) {
    var get = f.get, getPadded;
    if (f.lowerToken) {
      ldmlTokens[f.lowerToken] = buildLowercase(get);
    }
    if (f.ordinalToken) {
      ldmlTokens[f.ordinalToken] = buildOrdinal(get, f);
    }
    if (f.ldmlPaddedToken) {
      ldmlTokens[f.ldmlPaddedToken] = buildPadded(get, f.ldmlPaddedToken.length);
    }
    if (f.ldmlTwoDigitToken) {
      ldmlTokens[f.ldmlTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
    }
    if (f.strfTwoDigitToken) {
      strfTokens[f.strfTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
    }
    if (f.strfPadding) {
      getPadded = buildPadded(get, f.strfPadding);
    }
    if (f.alias) {
      get = buildAlias(f.alias);
    }
    if (f.allowAlternates) {
      buildAlternates(f);
    }
    addFormats(ldmlTokens, f.ldml, get);
    addFormats(strfTokens, f.strf, getPadded || get);
  });

  forEachProperty(CoreOutputFormats, function(src, name) {
    addFormats(ldmlTokens, name, buildAlias(src));
  });

  defineInstanceSimilar(sugarDate, 'short medium long full', function(methods, name) {
    var fn = getIdentityFormat(name);
    addFormats(ldmlTokens, name, fn);
    methods[name] = fn;
  });

  addFormats(ldmlTokens, 'time', getIdentityFormat('time'));
  addFormats(ldmlTokens, 'stamp', getIdentityFormat('stamp'));
}

var dateFormatMatcher;

function buildDateFormatMatcher() {

  function getLdml(d, token, localeCode) {
    return getOwn(ldmlTokens, token)(d, localeCode);
  }

  function getStrf(d, token, localeCode) {
    return getOwn(strfTokens, token)(d, localeCode);
  }

  function checkDateToken(ldml, strf) {
    return hasOwn(ldmlTokens, ldml) || hasOwn(strfTokens, strf);
  }

  // Format matcher for LDML or STRF tokens.
  dateFormatMatcher = createFormatMatcher(getLdml, getStrf, checkDateToken);
}

buildDateFormatTokens();

buildDateFormatMatcher();

module.exports = {
  ldmlTokens: ldmlTokens,
  strfTokens: strfTokens,
  dateFormatMatcher: dateFormatMatcher
};
},{"../../common/internal/createFormatMatcher":99,"../../common/internal/defineInstanceSimilar":107,"../../common/internal/forEach":114,"../../common/internal/padNumber":147,"../../common/internal/spaceSplit":160,"../../common/var/coreUtilityAliases":178,"../../common/var/namespaceAliases":182,"./CoreOutputFormats":364,"./FormatTokensBase":370,"./LocaleHelpers":374}],381:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],382:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],383:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],384:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],385:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsAgo;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],386:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsFromNow;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],387:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsSince;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],388:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsUntil;
},{"./build/buildDateUnitMethodsCall":199,"sugar-core":3}],389:[function(require,module,exports){
'use strict';

var buildFromIndexMethods = require('../internal/buildFromIndexMethods');

buildFromIndexMethods();
},{"../internal/buildFromIndexMethods":396}],390:[function(require,module,exports){
'use strict';

// Static Methods
require('../object/average');
require('../object/count');
require('../object/every');
require('../object/filter');
require('../object/find');
require('../object/forEach');
require('../object/least');
require('../object/map');
require('../object/max');
require('../object/median');
require('../object/min');
require('../object/most');
require('../object/none');
require('../object/reduce');
require('../object/some');
require('../object/sum');

// Instance Methods
require('../array/average');
require('../array/count');
require('../array/every');
require('../array/everyFromIndex');
require('../array/filter');
require('../array/filterFromIndex');
require('../array/find');
require('../array/findFromIndex');
require('../array/findIndex');
require('../array/findIndexFromIndex');
require('../array/forEachFromIndex');
require('../array/least');
require('../array/map');
require('../array/mapFromIndex');
require('../array/max');
require('../array/median');
require('../array/min');
require('../array/most');
require('../array/none');
require('../array/reduceFromIndex');
require('../array/reduceRightFromIndex');
require('../array/some');
require('../array/someFromIndex');
require('../array/sum');

module.exports = require('sugar-core');
},{"../array/average":7,"../array/count":12,"../array/every":14,"../array/everyFromIndex":15,"../array/filter":17,"../array/filterFromIndex":18,"../array/find":19,"../array/findFromIndex":20,"../array/findIndex":21,"../array/findIndexFromIndex":22,"../array/forEachFromIndex":25,"../array/least":60,"../array/map":61,"../array/mapFromIndex":62,"../array/max":63,"../array/median":64,"../array/min":65,"../array/most":66,"../array/none":67,"../array/reduceFromIndex":68,"../array/reduceRightFromIndex":69,"../array/some":75,"../array/someFromIndex":76,"../array/sum":79,"../object/average":570,"../object/count":573,"../object/every":575,"../object/filter":577,"../object/find":578,"../object/forEach":579,"../object/least":634,"../object/map":635,"../object/max":636,"../object/median":637,"../object/min":640,"../object/most":641,"../object/none":642,"../object/reduce":643,"../object/some":649,"../object/sum":651,"sugar-core":3}],391:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined'),
    enhancedMatcherMethods = require('../var/enhancedMatcherMethods');

var enhancedFilter = enhancedMatcherMethods.enhancedFilter;

function arrayCount(arr, f) {
  if (isUndefined(f)) {
    return arr.length;
  }
  return enhancedFilter.apply(this, arguments).length;
}

module.exports = arrayCount;
},{"../../common/internal/isUndefined":140,"../var/enhancedMatcherMethods":415}],392:[function(require,module,exports){
'use strict';

var enhancedMatcherMethods = require('../var/enhancedMatcherMethods');

var enhancedSome = enhancedMatcherMethods.enhancedSome;

function arrayNone() {
  return !enhancedSome.apply(this, arguments);
}

module.exports = arrayNone;
},{"../var/enhancedMatcherMethods":415}],393:[function(require,module,exports){
'use strict';

var enumerateWithMapping = require('./enumerateWithMapping');

function average(obj, map) {
  var sum = 0, count = 0;
  enumerateWithMapping(obj, map, function(val) {
    sum += val;
    count++;
  });
  // Prevent divide by 0
  return sum / (count || 1);
}

module.exports = average;
},{"./enumerateWithMapping":399}],394:[function(require,module,exports){
'use strict';

var enhancedMapping = require('./enhancedMapping'),
    wrapNativeArrayMethod = require('./wrapNativeArrayMethod');

function buildEnhancedMapping(name) {
  return wrapNativeArrayMethod(name, enhancedMapping);
}

module.exports = buildEnhancedMapping;
},{"./enhancedMapping":397,"./wrapNativeArrayMethod":411}],395:[function(require,module,exports){
'use strict';

var enhancedMatching = require('./enhancedMatching'),
    wrapNativeArrayMethod = require('./wrapNativeArrayMethod');

function buildEnhancedMatching(name) {
  return wrapNativeArrayMethod(name, enhancedMatching);
}

module.exports = buildEnhancedMatching;
},{"./enhancedMatching":398,"./wrapNativeArrayMethod":411}],396:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    spaceSplit = require('../../common/internal/spaceSplit'),
    classChecks = require('../../common/var/classChecks'),
    mathAliases = require('../../common/var/mathAliases'),
    assertArgument = require('../../common/internal/assertArgument'),
    enhancedMapping = require('./enhancedMapping'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    enhancedMatching = require('./enhancedMatching'),
    getNormalizedIndex = require('../../common/internal/getNormalizedIndex'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    methodDefineAliases = require('../../common/var/methodDefineAliases');

var forEachProperty = coreUtilityAliases.forEachProperty,
    defineInstanceWithArguments = methodDefineAliases.defineInstanceWithArguments,
    sugarArray = namespaceAliases.sugarArray,
    min = mathAliases.min,
    max = mathAliases.max,
    isBoolean = classChecks.isBoolean;

function buildFromIndexMethods() {

  var methods = {
    'forEach': {
      base: forEachAsNative
    },
    'map': {
      wrapper: enhancedMapping
    },
    'some every': {
      wrapper: enhancedMatching
    },
    'findIndex': {
      wrapper: enhancedMatching,
      result: indexResult
    },
    'reduce': {
      apply: applyReduce
    },
    'filter find': {
      wrapper: enhancedMatching
    },
    'reduceRight': {
      apply: applyReduce,
      slice: sliceArrayFromRight,
      clamp: clampStartIndexFromRight
    }
  };

  forEachProperty(methods, function(opts, key) {
    forEach(spaceSplit(key), function(baseName) {
      var methodName = baseName + 'FromIndex';
      var fn = createFromIndexWithOptions(baseName, opts);
      defineInstanceWithArguments(sugarArray, methodName, fn);
    });
  });

  function forEachAsNative(fn) {
    forEach(this, fn);
  }

  // Methods like filter and find have a direct association between the value
  // returned by the callback and the element of the current iteration. This
  // means that when looping, array elements must match the actual index for
  // which they are being called, so the array must be sliced. This is not the
  // case for methods like forEach and map, which either do not use return
  // values or use them in a way that simply getting the element at a shifted
  // index will not affect the final return value. However, these methods will
  // still fail on sparse arrays, so always slicing them here. For example, if
  // "forEachFromIndex" were to be called on [1,,2] from index 1, although the
  // actual index 1 would itself would be skipped, when the array loops back to
  // index 0, shifting it by adding 1 would result in the element for that
  // iteration being undefined. For shifting to work, all gaps in the array
  // between the actual index and the shifted index would have to be accounted
  // for. This is infeasible and is easily solved by simply slicing the actual
  // array instead so that gaps align. Note also that in the case of forEach,
  // we are using the internal function which handles sparse arrays in a way
  // that does not increment the index, and so is highly optimized compared to
  // the others here, which are simply going through the native implementation.
  function sliceArrayFromLeft(arr, startIndex, loop) {
    var result = arr;
    if (startIndex) {
      result = arr.slice(startIndex);
      if (loop) {
        result = result.concat(arr.slice(0, startIndex));
      }
    }
    return result;
  }

  // When iterating from the right, indexes are effectively shifted by 1.
  // For example, iterating from the right from index 2 in an array of 3
  // should also include the last element in the array. This matches the
  // "lastIndexOf" method which also iterates from the right.
  function sliceArrayFromRight(arr, startIndex, loop) {
    if (!loop) {
      startIndex += 1;
      arr = arr.slice(0, max(0, startIndex));
    }
    return arr;
  }

  function clampStartIndex(startIndex, len) {
    return min(len, max(0, startIndex));
  }

  // As indexes are shifted by 1 when starting from the right, clamping has to
  // go down to -1 to accommodate the full range of the sliced array.
  function clampStartIndexFromRight(startIndex, len) {
    return min(len, max(-1, startIndex));
  }

  function applyReduce(arr, startIndex, fn, context, len, loop) {
    return function(acc, val, i) {
      i = getNormalizedIndex(i + startIndex, len, loop);
      return fn.call(arr, acc, val, i, arr);
    };
  }

  function applyEach(arr, startIndex, fn, context, len, loop) {
    return function(el, i) {
      i = getNormalizedIndex(i + startIndex, len, loop);
      return fn.call(context, arr[i], i, arr);
    };
  }

  function indexResult(result, startIndex, len) {
    if (result !== -1) {
      result = (result + startIndex) % len;
    }
    return result;
  }

  function createFromIndexWithOptions(methodName, opts) {

    var baseFn = opts.base || Array.prototype[methodName],
        applyCallback = opts.apply || applyEach,
        sliceArray = opts.slice || sliceArrayFromLeft,
        clampIndex = opts.clamp || clampStartIndex,
        getResult = opts.result,
        wrapper = opts.wrapper;

    return function(arr, startIndex, args) {
      var callArgs = [], argIndex = 0, lastArg, result, len, loop, fn;
      len = arr.length;
      if (isBoolean(args[0])) {
        loop = args[argIndex++];
      }
      fn = args[argIndex++];
      lastArg = args[argIndex];
      if (startIndex < 0) {
        startIndex += len;
      }
      startIndex = clampIndex(startIndex, len);
      assertArgument(args.length);
      fn = wrapper ? wrapper(fn, lastArg) : fn;
      callArgs.push(applyCallback(arr, startIndex, fn, lastArg, len, loop));
      if (lastArg) {
        callArgs.push(lastArg);
      }
      result = baseFn.apply(sliceArray(arr, startIndex, loop), callArgs);
      if (getResult) {
        result = getResult(result, startIndex, len);
      }
      return result;
    };
  }
}

module.exports = buildFromIndexMethods;
},{"../../common/internal/assertArgument":89,"../../common/internal/forEach":114,"../../common/internal/getNormalizedIndex":122,"../../common/internal/spaceSplit":160,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"../../common/var/mathAliases":180,"../../common/var/methodDefineAliases":181,"../../common/var/namespaceAliases":182,"./enhancedMapping":397,"./enhancedMatching":398}],397:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts');

var isFunction = classChecks.isFunction;

function enhancedMapping(map, context) {
  if (isFunction(map)) {
    return map;
  } else if (map) {
    return function(el, i, arr) {
      return mapWithShortcuts(el, map, context, [el, i, arr]);
    };
  }
}

module.exports = enhancedMapping;
},{"../../common/internal/mapWithShortcuts":145,"../../common/var/classChecks":177}],398:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    classChecks = require('../../common/var/classChecks');

var isFunction = classChecks.isFunction;

function enhancedMatching(f) {
  var matcher;
  if (isFunction(f)) {
    return f;
  }
  matcher = getMatcher(f);
  return function(el, i, arr) {
    return matcher(el, i, arr);
  };
}

module.exports = enhancedMatching;
},{"../../common/internal/getMatcher":121,"../../common/var/classChecks":177}],399:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isArrayIndex = require('../../common/internal/isArrayIndex'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var isArray = classChecks.isArray,
    forEachProperty = coreUtilityAliases.forEachProperty;

function enumerateWithMapping(obj, map, fn) {
  var arrayIndexes = isArray(obj);
  forEachProperty(obj, function(val, key) {
    if (arrayIndexes) {
      if (!isArrayIndex(key)) {
        return;
      }
      key = +key;
    }
    var mapped = mapWithShortcuts(val, map, obj, [val, key, obj]);
    fn(mapped, key);
  });
}

module.exports = enumerateWithMapping;
},{"../../common/internal/isArrayIndex":132,"../../common/internal/mapWithShortcuts":145,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178}],400:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    getMinOrMax = require('./getMinOrMax'),
    serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    enumerateWithMapping = require('./enumerateWithMapping'),
    getReducedMinMaxResult = require('./getReducedMinMaxResult');

var isBoolean = classChecks.isBoolean,
    getOwn = coreUtilityAliases.getOwn,
    forEachProperty = coreUtilityAliases.forEachProperty;

function getLeastOrMost(obj, arg1, arg2, most, asObject) {
  var group = {}, refs = [], minMaxResult, result, all, map;
  if (isBoolean(arg1)) {
    all = arg1;
    map = arg2;
  } else {
    map = arg1;
  }
  enumerateWithMapping(obj, map, function(val, key) {
    var groupKey = serializeInternal(val, refs);
    var arr = getOwn(group, groupKey) || [];
    arr.push(asObject ? key : obj[key]);
    group[groupKey] = arr;
  });
  minMaxResult = getMinOrMax(group, !!all, 'length', most, true);
  if (all) {
    result = [];
    // Flatten result
    forEachProperty(minMaxResult, function(val) {
      result = result.concat(val);
    });
  } else {
    result = getOwn(group, minMaxResult);
  }
  return getReducedMinMaxResult(result, obj, all, asObject);
}

module.exports = getLeastOrMost;
},{"../../common/internal/serializeInternal":153,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"./enumerateWithMapping":399,"./getMinOrMax":401,"./getReducedMinMaxResult":402}],401:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isUndefined = require('../../common/internal/isUndefined'),
    enumerateWithMapping = require('./enumerateWithMapping'),
    getReducedMinMaxResult = require('./getReducedMinMaxResult');

var isBoolean = classChecks.isBoolean;

function getMinOrMax(obj, arg1, arg2, max, asObject) {
  var result = [], pushVal, edge, all, map;
  if (isBoolean(arg1)) {
    all = arg1;
    map = arg2;
  } else {
    map = arg1;
  }
  enumerateWithMapping(obj, map, function(val, key) {
    if (isUndefined(val)) {
      throw new TypeError('Cannot compare with undefined');
    }
    pushVal = asObject ? key : obj[key];
    if (val === edge) {
      result.push(pushVal);
    } else if (isUndefined(edge) || (max && val > edge) || (!max && val < edge)) {
      result = [pushVal];
      edge = val;
    }
  });
  return getReducedMinMaxResult(result, obj, all, asObject);
}

module.exports = getMinOrMax;
},{"../../common/internal/isUndefined":140,"../../common/var/classChecks":177,"./enumerateWithMapping":399,"./getReducedMinMaxResult":402}],402:[function(require,module,exports){
'use strict';

function getReducedMinMaxResult(result, obj, all, asObject) {
  if (asObject && all) {
    // The method has returned an array of keys so use this array
    // to build up the resulting object in the form we want it in.
    return result.reduce(function(o, key) {
      o[key] = obj[key];
      return o;
    }, {});
  } else if (result && !all) {
    result = result[0];
  }
  return result;
}

module.exports = getReducedMinMaxResult;
},{}],403:[function(require,module,exports){
'use strict';

var trunc = require('../../common/var/trunc'),
    enumerateWithMapping = require('./enumerateWithMapping');

function median(obj, map) {
  var result = [], middle, len;
  enumerateWithMapping(obj, map, function(val) {
    result.push(val);
  });
  len = result.length;
  if (!len) return 0;
  result.sort(function(a, b) {
    // IE7 will throw errors on non-numbers!
    return (a || 0) - (b || 0);
  });
  middle = trunc(len / 2);
  return len % 2 ? result[middle] : (result[middle - 1] + result[middle]) / 2;
}

module.exports = median;
},{"../../common/var/trunc":183,"./enumerateWithMapping":399}],404:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectCount(obj, f) {
  var matcher = getMatcher(f), count = 0;
  forEachProperty(obj, function(val, key) {
    if (matcher(val, key, obj)) {
      count++;
    }
  });
  return count;
}

module.exports = objectCount;
},{"../../common/internal/getMatcher":121,"../../common/var/coreUtilityAliases":178}],405:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectFilter(obj, f) {
  var matcher = getMatcher(f), result = {};
  forEachProperty(obj, function(val, key) {
    if (matcher(val, key, obj)) {
      result[key] = val;
    }
  });
  return result;
}

module.exports = objectFilter;
},{"../../common/internal/getMatcher":121,"../../common/var/coreUtilityAliases":178}],406:[function(require,module,exports){
'use strict';

var assertCallable = require('../../common/internal/assertCallable'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectForEach(obj, fn) {
  assertCallable(fn);
  forEachProperty(obj, function(val, key) {
    fn(val, key, obj);
  });
  return obj;
}

module.exports = objectForEach;
},{"../../common/internal/assertCallable":91,"../../common/var/coreUtilityAliases":178}],407:[function(require,module,exports){
'use strict';

var mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectMap(obj, map) {
  var result = {};
  forEachProperty(obj, function(val, key) {
    result[key] = mapWithShortcuts(val, map, obj, [val, key, obj]);
  });
  return result;
}

module.exports = objectMap;
},{"../../common/internal/mapWithShortcuts":145,"../../common/var/coreUtilityAliases":178}],408:[function(require,module,exports){
'use strict';

var objectMatchers = require('../var/objectMatchers');

var objectSome = objectMatchers.objectSome;

function objectNone(obj, f) {
  return !objectSome(obj, f);
}

module.exports = objectNone;
},{"../var/objectMatchers":416}],409:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectReduce(obj, fn, acc) {
  var init = isDefined(acc);
  forEachProperty(obj, function(val, key) {
    if (!init) {
      acc = val;
      init = true;
      return;
    }
    acc = fn(acc, val, key, obj);
  });
  return acc;
}

module.exports = objectReduce;
},{"../../common/internal/isDefined":134,"../../common/var/coreUtilityAliases":178}],410:[function(require,module,exports){
'use strict';

var enumerateWithMapping = require('./enumerateWithMapping');

function sum(obj, map) {
  var sum = 0;
  enumerateWithMapping(obj, map, function(val) {
    sum += val;
  });
  return sum;
}

module.exports = sum;
},{"./enumerateWithMapping":399}],411:[function(require,module,exports){
'use strict';

var assertArgument = require('../../common/internal/assertArgument');

function wrapNativeArrayMethod(methodName, wrapper) {
  var nativeFn = Array.prototype[methodName];
  return function(arr, f, context, argsLen) {
    var args = new Array(2);
    assertArgument(argsLen > 0);
    args[0] = wrapper(f, context);
    args[1] = context;
    return nativeFn.apply(arr, args);
  };
}

module.exports = wrapNativeArrayMethod;
},{"../../common/internal/assertArgument":89}],412:[function(require,module,exports){
'use strict';

var getKeys = require('../../common/internal/getKeys'),
    getMatcher = require('../../common/internal/getMatcher');

function wrapObjectMatcher(name) {
  var nativeFn = Array.prototype[name];
  return function(obj, f) {
    var matcher = getMatcher(f);
    return nativeFn.call(getKeys(obj), function(key) {
      return matcher(obj[key], key, obj);
    });
  };
}

module.exports = wrapObjectMatcher;
},{"../../common/internal/getKeys":120,"../../common/internal/getMatcher":121}],413:[function(require,module,exports){
'use strict';

module.exports = 'enhanceArray';
},{}],414:[function(require,module,exports){
'use strict';

var buildEnhancedMapping = require('../internal/buildEnhancedMapping');

module.exports = buildEnhancedMapping('map');
},{"../internal/buildEnhancedMapping":394}],415:[function(require,module,exports){
'use strict';

var buildEnhancedMatching = require('../internal/buildEnhancedMatching');

module.exports = {
  enhancedFind: buildEnhancedMatching('find'),
  enhancedSome: buildEnhancedMatching('some'),
  enhancedEvery: buildEnhancedMatching('every'),
  enhancedFilter: buildEnhancedMatching('filter'),
  enhancedFindIndex: buildEnhancedMatching('findIndex')
};
},{"../internal/buildEnhancedMatching":395}],416:[function(require,module,exports){
'use strict';

var wrapObjectMatcher = require('../internal/wrapObjectMatcher');

module.exports = {
  objectSome: wrapObjectMatcher('some'),
  objectFind: wrapObjectMatcher('find'),
  objectEvery: wrapObjectMatcher('every')
};
},{"../internal/wrapObjectMatcher":412}],417:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

Sugar.Function.defineInstance({

  'after': function(fn, num) {
    var count = 0, collectedArgs = [];
    num = coercePositiveInteger(num);
    return function() {
      // Optimized: no leaking arguments
      var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
      collectedArgs.push(args);
      count++;
      if (count >= num) {
        return fn.call(this, collectedArgs);
      }
    };
  }

});

module.exports = Sugar.Function.after;
},{"../common/internal/coercePositiveInteger":95,"sugar-core":3}],418:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    cancelFunction = require('./internal/cancelFunction');

Sugar.Function.defineInstance({

  'cancel': function(fn) {
    return cancelFunction(fn);
  }

});

module.exports = Sugar.Function.cancel;
},{"./internal/cancelFunction":423,"sugar-core":3}],419:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setDelay = require('./internal/setDelay'),
    cancelFunction = require('./internal/cancelFunction');

Sugar.Function.defineInstance({

  'debounce': function(fn, ms) {
    function debounced() {
      // Optimized: no leaking arguments
      var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
      cancelFunction(debounced);
      setDelay(debounced, ms, fn, this, args);
    }
    return debounced;
  }

});

module.exports = Sugar.Function.debounce;
},{"./internal/cancelFunction":423,"./internal/setDelay":427,"sugar-core":3}],420:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setDelay = require('./internal/setDelay');

Sugar.Function.defineInstanceWithArguments({

  'delay': function(fn, ms, args) {
    setDelay(fn, ms, fn, fn, args);
    return fn;
  }

});

module.exports = Sugar.Function.delay;
},{"./internal/setDelay":427,"sugar-core":3}],421:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setDelay = require('./internal/setDelay');

Sugar.Function.defineInstanceWithArguments({

  'every': function(fn, ms, args) {
    function execute () {
      // Set the delay first here, so that cancel
      // can be called within the executing function.
      setDelay(fn, ms, execute);
      fn.apply(fn, args);
    }
    setDelay(fn, ms, execute);
    return fn;
  }

});

module.exports = Sugar.Function.every;
},{"./internal/setDelay":427,"sugar-core":3}],422:[function(require,module,exports){
'use strict';

// Instance Methods
require('./after');
require('./cancel');
require('./debounce');
require('./delay');
require('./every');
require('./lazy');
require('./lock');
require('./memoize');
require('./once');
require('./partial');
require('./throttle');

module.exports = require('sugar-core');
},{"./after":417,"./cancel":418,"./debounce":419,"./delay":420,"./every":421,"./lazy":428,"./lock":429,"./memoize":430,"./once":431,"./partial":432,"./throttle":433,"sugar-core":3}],423:[function(require,module,exports){
'use strict';

var _timers = require('../var/_timers'),
    _canceled = require('../var/_canceled'),
    classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function cancelFunction(fn) {
  var timers = _timers(fn), timer;
  if (isArray(timers)) {
    while(timer = timers.shift()) {
      clearTimeout(timer);
    }
  }
  _canceled(fn, true);
  return fn;
}

module.exports = cancelFunction;
},{"../../common/var/classChecks":177,"../var/_canceled":434,"../var/_timers":437}],424:[function(require,module,exports){
'use strict';

function collectArguments() {
  var args = arguments, i = args.length, arr = new Array(i);
  while (i--) {
    arr[i] = args[i];
  }
  return arr;
}

module.exports = collectArguments;
},{}],425:[function(require,module,exports){
'use strict';

var serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn;

function createHashedMemoizeFunction(fn, hashFn, limit) {
  var map = {}, refs = [], counter = 0;
  return function() {
    var hashObj = hashFn.apply(this, arguments);
    var key = serializeInternal(hashObj, refs);
    if (hasOwn(map, key)) {
      return getOwn(map, key);
    }
    if (counter === limit) {
      map = {};
      refs = [];
      counter = 0;
    }
    counter++;
    return map[key] = fn.apply(this, arguments);
  };
}

module.exports = createHashedMemoizeFunction;
},{"../../common/internal/serializeInternal":153,"../../common/var/coreUtilityAliases":178}],426:[function(require,module,exports){
'use strict';

var setDelay = require('./setDelay'),
    mathAliases = require('../../common/var/mathAliases');

var max = mathAliases.max,
    ceil = mathAliases.ceil,
    round = mathAliases.round;

function createLazyFunction(fn, ms, immediate, limit) {
  var queue = [], locked = false, execute, rounded, perExecution, result;
  ms = ms || 1;
  limit = limit || Infinity;
  rounded = ceil(ms);
  perExecution = round(rounded / ms) || 1;
  execute = function() {
    var queueLength = queue.length, maxPerRound;
    if (queueLength == 0) return;
    // Allow fractions of a millisecond by calling
    // multiple times per actual timeout execution
    maxPerRound = max(queueLength - perExecution, 0);
    while(queueLength > maxPerRound) {
      // Getting uber-meta here...
      result = Function.prototype.apply.apply(fn, queue.shift());
      queueLength--;
    }
    setDelay(lazy, rounded, function() {
      locked = false;
      execute();
    });
  };
  function lazy() {
    // If the execution has locked and it's immediate, then
    // allow 1 less in the queue as 1 call has already taken place.
    if (queue.length < limit - (locked && immediate ? 1 : 0)) {
      // Optimized: no leaking arguments
      var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
      queue.push([this, args]);
    }
    if (!locked) {
      locked = true;
      if (immediate) {
        execute();
      } else {
        setDelay(lazy, rounded, execute);
      }
    }
    // Return the memoized result
    return result;
  }
  return lazy;
}

module.exports = createLazyFunction;
},{"../../common/var/mathAliases":180,"./setDelay":427}],427:[function(require,module,exports){
'use strict';

var _timers = require('../var/_timers'),
    _canceled = require('../var/_canceled'),
    coercePositiveInteger = require('../../common/internal/coercePositiveInteger');

function setDelay(fn, ms, after, scope, args) {
  // Delay of infinity is never called of course...
  ms = coercePositiveInteger(ms || 0);
  if (!_timers(fn)) {
    _timers(fn, []);
  }
  // This is a workaround for <= IE8, which apparently has the
  // ability to call timeouts in the queue on the same tick (ms?)
  // even if functionally they have already been cleared.
  _canceled(fn, false);
  _timers(fn).push(setTimeout(function() {
    if (!_canceled(fn)) {
      after.apply(scope, args || []);
    }
  }, ms));
}

module.exports = setDelay;
},{"../../common/internal/coercePositiveInteger":95,"../var/_canceled":434,"../var/_timers":437}],428:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createLazyFunction = require('./internal/createLazyFunction');

Sugar.Function.defineInstance({

  'lazy': function(fn, ms, immediate, limit) {
    return createLazyFunction(fn, ms, immediate, limit);
  }

});

module.exports = Sugar.Function.lazy;
},{"./internal/createLazyFunction":426,"sugar-core":3}],429:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _lock = require('./var/_lock'),
    _partial = require('./var/_partial'),
    classChecks = require('../common/var/classChecks'),
    mathAliases = require('../common/var/mathAliases');

var isNumber = classChecks.isNumber,
    min = mathAliases.min;

Sugar.Function.defineInstance({

  'lock': function(fn, n) {
    var lockedFn;
    if (_partial(fn)) {
      _lock(fn, isNumber(n) ? n : null);
      return fn;
    }
    lockedFn = function() {
      arguments.length = min(_lock(lockedFn), arguments.length);
      return fn.apply(this, arguments);
    };
    _lock(lockedFn, isNumber(n) ? n : fn.length);
    return lockedFn;
  }

});

module.exports = Sugar.Function.lock;
},{"../common/var/classChecks":177,"../common/var/mathAliases":180,"./var/_lock":435,"./var/_partial":436,"sugar-core":3}],430:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    classChecks = require('../common/var/classChecks'),
    deepGetProperty = require('../common/internal/deepGetProperty'),
    collectArguments = require('./internal/collectArguments'),
    createHashedMemoizeFunction = require('./internal/createHashedMemoizeFunction');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString;

Sugar.Function.defineInstance({

  'memoize': function(fn, arg1, arg2) {
    var hashFn, limit, prop;
    if (isNumber(arg1)) {
      limit = arg1;
    } else {
      hashFn = arg1;
      limit  = arg2;
    }
    if (isString(hashFn)) {
      prop = hashFn;
      hashFn = function(obj) {
        return deepGetProperty(obj, prop);
      };
    } else if (!hashFn) {
      hashFn = collectArguments;
    }
    return createHashedMemoizeFunction(fn, hashFn, limit);
  }

});

module.exports = Sugar.Function.memoize;
},{"../common/internal/deepGetProperty":101,"../common/var/classChecks":177,"./internal/collectArguments":424,"./internal/createHashedMemoizeFunction":425,"sugar-core":3}],431:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Function.defineInstance({

  'once': function(fn) {
    var called = false, val;
    return function() {
      if (called) {
        return val;
      }
      called = true;
      return val = fn.apply(this, arguments);
    };
  }

});

module.exports = Sugar.Function.once;
},{"sugar-core":3}],432:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _lock = require('./var/_lock'),
    _partial = require('./var/_partial'),
    isDefined = require('../common/internal/isDefined'),
    classChecks = require('../common/var/classChecks'),
    mathAliases = require('../common/var/mathAliases'),
    isObjectType = require('../common/internal/isObjectType'),
    createInstanceFromPrototype = require('./var/createInstanceFromPrototype');

var isNumber = classChecks.isNumber,
    min = mathAliases.min;

Sugar.Function.defineInstanceWithArguments({

  'partial': function(fn, curriedArgs) {
    var curriedLen = curriedArgs.length;
    var partialFn = function() {
      var argIndex = 0, applyArgs = [], self = this, lock = _lock(partialFn), result, i;
      for (i = 0; i < curriedLen; i++) {
        var arg = curriedArgs[i];
        if (isDefined(arg)) {
          applyArgs[i] = arg;
        } else {
          applyArgs[i] = arguments[argIndex++];
        }
      }
      for (i = argIndex; i < arguments.length; i++) {
        applyArgs.push(arguments[i]);
      }
      if (lock === null) {
        lock = curriedLen;
      }
      if (isNumber(lock)) {
        applyArgs.length = min(applyArgs.length, lock);
      }
      // If the bound "this" object is an instance of the partialed
      // function, then "new" was used, so preserve the prototype
      // so that constructor functions can also be partialed.
      if (self instanceof partialFn) {
        self = createInstanceFromPrototype(fn.prototype);
        result = fn.apply(self, applyArgs);
        // An explicit return value is allowed from constructors
        // as long as they are of "object" type, so return the
        // correct result here accordingly.
        return isObjectType(result) ? result : self;
      }
      return fn.apply(self, applyArgs);
    };
    _partial(partialFn, true);
    return partialFn;
  }

});

module.exports = Sugar.Function.partial;
},{"../common/internal/isDefined":134,"../common/internal/isObjectType":136,"../common/var/classChecks":177,"../common/var/mathAliases":180,"./var/_lock":435,"./var/_partial":436,"./var/createInstanceFromPrototype":438,"sugar-core":3}],433:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createLazyFunction = require('./internal/createLazyFunction');

Sugar.Function.defineInstance({

  'throttle': function(fn, ms) {
    return createLazyFunction(fn, ms, true, 1);
  }

});

module.exports = Sugar.Function.throttle;
},{"./internal/createLazyFunction":426,"sugar-core":3}],434:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('canceled');
},{"../../common/internal/privatePropertyAccessor":149}],435:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('lock');
},{"../../common/internal/privatePropertyAccessor":149}],436:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('partial');
},{"../../common/internal/privatePropertyAccessor":149}],437:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('timers');
},{"../../common/internal/privatePropertyAccessor":149}],438:[function(require,module,exports){
'use strict';

var createInstanceFromPrototype = Object.create || function(prototype) {
  var ctor = function() {};
  ctor.prototype = prototype;
  return new ctor;
};

module.exports = createInstanceFromPrototype;
},{}],439:[function(require,module,exports){
'use strict';

require('./string');
require('./number');
require('./array');
require('./enumerable');
require('./object');
require('./date');
require('./range');
require('./function');
require('./regexp');

module.exports = require('sugar-core');
},{"./array":31,"./date":229,"./enumerable":390,"./function":422,"./number":479,"./object":583,"./range":668,"./regexp":709,"./string":728,"sugar-core":3}],440:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    AbbreviationUnits = require('./var/AbbreviationUnits'),
    abbreviateNumber = require('./internal/abbreviateNumber');

var BASIC_UNITS = AbbreviationUnits.BASIC_UNITS;

Sugar.Number.defineInstance({

  'abbr': function(n, precision) {
    return abbreviateNumber(n, precision, BASIC_UNITS);
  }

});

module.exports = Sugar.Number.abbr;
},{"./internal/abbreviateNumber":480,"./var/AbbreviationUnits":545,"sugar-core":3}],441:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.abs;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],442:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.acos;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],443:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.asin;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],444:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.atan;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],445:[function(require,module,exports){
'use strict';

var buildMathAliases = require('../internal/buildMathAliases');

buildMathAliases();
},{"../internal/buildMathAliases":481}],446:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    AbbreviationUnits = require('./var/AbbreviationUnits'),
    abbreviateNumber = require('./internal/abbreviateNumber');

var MEMORY_UNITS = AbbreviationUnits.MEMORY_UNITS,
    MEMORY_BINARY_UNITS = AbbreviationUnits.MEMORY_BINARY_UNITS;

Sugar.Number.defineInstance({

  'bytes': function(n, precision, binary, units) {
    if (units === 'binary' || (!units && binary)) {
      units = MEMORY_BINARY_UNITS;
    } else if(units === 'si' || !units) {
      units = MEMORY_UNITS;
    }
    return abbreviateNumber(n, precision, units, binary) + 'B';
  }

});

module.exports = Sugar.Number.bytes;
},{"./internal/abbreviateNumber":480,"./var/AbbreviationUnits":545,"sugar-core":3}],447:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    Range = require('../range/internal/Range'),
    rangeClamp = require('../range/internal/rangeClamp');

Sugar.Number.defineInstance({

  'cap': function(n, max) {
    return rangeClamp(new Range(undefined, max), n);
  }

});

module.exports = Sugar.Number.cap;
},{"../range/internal/Range":669,"../range/internal/rangeClamp":683,"sugar-core":3}],448:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    createRoundingFunction = require('./internal/createRoundingFunction');

var ceil = mathAliases.ceil;

Sugar.Number.defineInstance({

  'ceil': createRoundingFunction(ceil)

});

module.exports = Sugar.Number.ceil;
},{"../common/var/mathAliases":180,"./internal/createRoundingFunction":482,"sugar-core":3}],449:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    chr = require('../common/var/chr');

Sugar.Number.defineInstance({

  'chr': function(n) {
    return chr(n);
  }

});

module.exports = Sugar.Number.chr;
},{"../common/var/chr":176,"sugar-core":3}],450:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    Range = require('../range/internal/Range'),
    rangeClamp = require('../range/internal/rangeClamp');

Sugar.Number.defineInstance({

  'clamp': function(n, start, end) {
    return rangeClamp(new Range(start, end), n);
  }

});

module.exports = Sugar.Number.clamp;
},{"../range/internal/Range":669,"../range/internal/rangeClamp":683,"sugar-core":3}],451:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.cos;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],452:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.day;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],453:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],454:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],455:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],456:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],457:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.days;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],458:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],459:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],460:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],461:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],462:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    upto = require('./upto');

Sugar.Number.alias('downto', 'upto');

module.exports = Sugar.Number.downto;
},{"./upto":544,"sugar-core":3}],463:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('../date/var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Number.defineInstance({

  'duration': function(n, localeCode) {
    return localeManager.get(localeCode).getDuration(n);
  }

});

module.exports = Sugar.Number.duration;
},{"../date/var/LocaleHelpers":374,"sugar-core":3}],464:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.exp;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],465:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    createRoundingFunction = require('./internal/createRoundingFunction');

var floor = mathAliases.floor;

Sugar.Number.defineInstance({

  'floor': createRoundingFunction(floor)

});

module.exports = Sugar.Number.floor;
},{"../common/var/mathAliases":180,"./internal/createRoundingFunction":482,"sugar-core":3}],466:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    numberFormat = require('./internal/numberFormat');

Sugar.Number.defineInstance({

  'format': function(n, place) {
    return numberFormat(n, place);
  }

});

module.exports = Sugar.Number.format;
},{"./internal/numberFormat":485,"sugar-core":3}],467:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _numberOptions = require('./var/_numberOptions');

module.exports = Sugar.Number.getOption;
},{"./var/_numberOptions":547,"sugar-core":3}],468:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padNumber = require('../common/internal/padNumber');

Sugar.Number.defineInstance({

  'hex': function(n, pad) {
    return padNumber(n, pad || 1, false, 16);
  }

});

module.exports = Sugar.Number.hex;
},{"../common/internal/padNumber":147,"sugar-core":3}],469:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hour;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],470:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],471:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],472:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],473:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],474:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hours;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],475:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],476:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],477:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],478:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],479:[function(require,module,exports){
'use strict';

// Static Methods
require('./random');

// Instance Methods
require('./abbr');
require('./abs');
require('./acos');
require('./asin');
require('./atan');
require('./bytes');
require('./ceil');
require('./chr');
require('./cos');
require('./exp');
require('./floor');
require('./format');
require('./hex');
require('./isEven');
require('./isInteger');
require('./isMultipleOf');
require('./isOdd');
require('./log');
require('./metric');
require('./ordinalize');
require('./pad');
require('./pow');
require('./round');
require('./sin');
require('./sqrt');
require('./tan');
require('./times');
require('./toNumber');

// Accessors
require('./getOption');
require('./setOption');

module.exports = require('sugar-core');
},{"./abbr":440,"./abs":441,"./acos":442,"./asin":443,"./atan":444,"./bytes":446,"./ceil":448,"./chr":449,"./cos":451,"./exp":464,"./floor":465,"./format":466,"./getOption":467,"./hex":468,"./isEven":486,"./isInteger":487,"./isMultipleOf":488,"./isOdd":489,"./log":490,"./metric":491,"./ordinalize":522,"./pad":523,"./pow":524,"./random":525,"./round":527,"./setOption":538,"./sin":539,"./sqrt":540,"./tan":541,"./times":542,"./toNumber":543,"sugar-core":3}],480:[function(require,module,exports){
'use strict';

var commaSplit = require('../../common/internal/commaSplit'),
    mathAliases = require('../../common/var/mathAliases'),
    numberFormat = require('./numberFormat'),
    withPrecision = require('../../common/internal/withPrecision');

var abs = mathAliases.abs,
    pow = mathAliases.pow,
    min = mathAliases.min,
    max = mathAliases.max,
    floor = mathAliases.floor;

function abbreviateNumber(num, precision, ustr, bytes) {
  var fixed        = num.toFixed(20),
      decimalPlace = fixed.search(/\./),
      numeralPlace = fixed.search(/[1-9]/),
      significant  = decimalPlace - numeralPlace,
      units, unit, mid, i, divisor;
  if (significant > 0) {
    significant -= 1;
  }
  units = commaSplit(ustr);
  if (units.length === 1) {
    units = ustr.split('');
  }
  mid = units.indexOf('|');
  if (mid === -1) {
    // Skipping the placeholder means the units should start from zero,
    // otherwise assume they end at zero.
    mid = units[0] === '_' ? 0 : units.length;
  }
  i = max(min(floor(significant / 3), units.length - mid - 1), -mid);
  unit = units[i + mid];
  while (unit === '_') {
    i += i < 0 ? -1 : 1;
    unit = units[i + mid];
  }
  if (unit === '|') {
    unit = '';
  }
  if (significant < -9) {
    precision = abs(significant) - 9;
  }
  divisor = bytes ? pow(2, 10 * i) : pow(10, i * 3);
  return numberFormat(withPrecision(num / divisor, precision || 0)) + unit;
}

module.exports = abbreviateNumber;
},{"../../common/internal/commaSplit":98,"../../common/internal/withPrecision":163,"../../common/var/mathAliases":180,"./numberFormat":485}],481:[function(require,module,exports){
'use strict';

var namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var sugarNumber = namespaceAliases.sugarNumber;

function buildMathAliases() {
  defineInstanceSimilar(sugarNumber, 'abs pow sin asin cos acos tan atan exp pow sqrt', function(methods, name) {
    methods[name] = function(n, arg) {
      // Note that .valueOf() here is only required due to a
      // very strange bug in iOS7 that only occurs occasionally
      // in which Math.abs() called on non-primitive numbers
      // returns a completely different number (Issue #400)
      return Math[name](n.valueOf(), arg);
    };
  });
}

module.exports = buildMathAliases;
},{"../../common/internal/defineInstanceSimilar":107,"../../common/var/namespaceAliases":182}],482:[function(require,module,exports){
'use strict';

var withPrecision = require('../../common/internal/withPrecision');

function createRoundingFunction(fn) {
  return function(n, precision) {
    return precision ? withPrecision(n, precision, fn) : fn(n);
  };
}

module.exports = createRoundingFunction;
},{"../../common/internal/withPrecision":163}],483:[function(require,module,exports){
'use strict';

function isInteger(n) {
  return n % 1 === 0;
}

module.exports = isInteger;
},{}],484:[function(require,module,exports){
'use strict';

function isMultipleOf(n1, n2) {
  return n1 % n2 === 0;
}

module.exports = isMultipleOf;
},{}],485:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    mathAliases = require('../../common/var/mathAliases'),
    periodSplit = require('../../common/internal/periodSplit'),
    repeatString = require('../../common/internal/repeatString'),
    withPrecision = require('../../common/internal/withPrecision'),
    _numberOptions = require('../var/_numberOptions');

var isNumber = classChecks.isNumber,
    max = mathAliases.max;

function numberFormat(num, place) {
  var result = '', thousands, decimal, fraction, integer, split, str;

  decimal   = _numberOptions('decimal');
  thousands = _numberOptions('thousands');

  if (isNumber(place)) {
    str = withPrecision(num, place || 0).toFixed(max(place, 0));
  } else {
    str = num.toString();
  }

  str = str.replace(/^-/, '');
  split    = periodSplit(str);
  integer  = split[0];
  fraction = split[1];
  if (/e/.test(str)) {
    result = str;
  } else {
    for(var i = integer.length; i > 0; i -= 3) {
      if (i < integer.length) {
        result = thousands + result;
      }
      result = integer.slice(max(0, i - 3), i) + result;
    }
  }
  if (fraction) {
    result += decimal + repeatString('0', (place || 0) - fraction.length) + fraction;
  }
  return (num < 0 ? '-' : '') + result;
}

module.exports = numberFormat;
},{"../../common/internal/periodSplit":148,"../../common/internal/repeatString":151,"../../common/internal/withPrecision":163,"../../common/var/classChecks":177,"../../common/var/mathAliases":180,"../var/_numberOptions":547}],486:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isMultipleOf = require('./internal/isMultipleOf');

Sugar.Number.defineInstance({

  'isEven': function(n) {
    return isMultipleOf(n, 2);
  }

});

module.exports = Sugar.Number.isEven;
},{"./internal/isMultipleOf":484,"sugar-core":3}],487:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isInteger = require('./internal/isInteger');

Sugar.Number.defineInstance({

  'isInteger': function(n) {
    return isInteger(n);
  }

});

module.exports = Sugar.Number.isInteger;
},{"./internal/isInteger":483,"sugar-core":3}],488:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isMultipleOf = require('./internal/isMultipleOf');

Sugar.Number.defineInstance({

  'isMultipleOf': function(n, num) {
    return isMultipleOf(n, num);
  }

});

module.exports = Sugar.Number.isMultipleOf;
},{"./internal/isMultipleOf":484,"sugar-core":3}],489:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isInteger = require('./internal/isInteger'),
    isMultipleOf = require('./internal/isMultipleOf');

Sugar.Number.defineInstance({

  'isOdd': function(n) {
    return isInteger(n) && !isMultipleOf(n, 2);
  }

});

module.exports = Sugar.Number.isOdd;
},{"./internal/isInteger":483,"./internal/isMultipleOf":484,"sugar-core":3}],490:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Number.defineInstance({

  'log': function(n, base) {
    return Math.log(n) / (base ? Math.log(base) : 1);
  }

});

module.exports = Sugar.Number.log;
},{"sugar-core":3}],491:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    AbbreviationUnits = require('./var/AbbreviationUnits'),
    abbreviateNumber = require('./internal/abbreviateNumber');

var METRIC_UNITS_SHORT = AbbreviationUnits.METRIC_UNITS_SHORT,
    METRIC_UNITS_FULL = AbbreviationUnits.METRIC_UNITS_FULL;

Sugar.Number.defineInstance({

  'metric': function(n, precision, units) {
    if (units === 'all') {
      units = METRIC_UNITS_FULL;
    } else if (!units) {
      units = METRIC_UNITS_SHORT;
    }
    return abbreviateNumber(n, precision, units);
  }

});

module.exports = Sugar.Number.metric;
},{"./internal/abbreviateNumber":480,"./var/AbbreviationUnits":545,"sugar-core":3}],492:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecond;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],493:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],494:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],495:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],496:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],497:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.milliseconds;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],498:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],499:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],500:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],501:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],502:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minute;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],503:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],504:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],505:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],506:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],507:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutes;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],508:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],509:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],510:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],511:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],512:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.month;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],513:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],514:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],515:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],516:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],517:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.months;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],518:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],519:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],520:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],521:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],522:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    getOrdinalSuffix = require('../common/internal/getOrdinalSuffix');

var abs = mathAliases.abs;

Sugar.Number.defineInstance({

  'ordinalize': function(n) {
    var num = abs(n), last = +num.toString().slice(-2);
    return n + getOrdinalSuffix(last);
  }

});

module.exports = Sugar.Number.ordinalize;
},{"../common/internal/getOrdinalSuffix":123,"../common/var/mathAliases":180,"sugar-core":3}],523:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padNumber = require('../common/internal/padNumber');

Sugar.Number.defineInstance({

  'pad': function(n, place, sign, base) {
    return padNumber(n, place, sign, base);
  }

});

module.exports = Sugar.Number.pad;
},{"../common/internal/padNumber":147,"sugar-core":3}],524:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.pow;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],525:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trunc = require('../common/var/trunc'),
    mathAliases = require('../common/var/mathAliases'),
    isUndefined = require('../common/internal/isUndefined');

var min = mathAliases.min,
    max = mathAliases.max;

Sugar.Number.defineStatic({

  'random': function(n1, n2) {
    var minNum, maxNum;
    if (arguments.length == 1) n2 = n1, n1 = 0;
    minNum = min(n1 || 0, isUndefined(n2) ? 1 : n2);
    maxNum = max(n1 || 0, isUndefined(n2) ? 1 : n2) + 1;
    return trunc((Math.random() * (maxNum - minNum)) + minNum);
  }

});

module.exports = Sugar.Number.random;
},{"../common/internal/isUndefined":140,"../common/var/mathAliases":180,"../common/var/trunc":183,"sugar-core":3}],526:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    PrimitiveRangeConstructor = require('../range/var/PrimitiveRangeConstructor');

Sugar.Number.defineStatic({

  'range': PrimitiveRangeConstructor

});

module.exports = Sugar.Number.range;
},{"../range/var/PrimitiveRangeConstructor":703,"sugar-core":3}],527:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    createRoundingFunction = require('./internal/createRoundingFunction');

var round = mathAliases.round;

Sugar.Number.defineInstance({

  'round': createRoundingFunction(round)

});

module.exports = Sugar.Number.round;
},{"../common/var/mathAliases":180,"./internal/createRoundingFunction":482,"sugar-core":3}],528:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.second;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],529:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],530:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],531:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],532:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],533:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.seconds;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],534:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],535:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],536:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],537:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],538:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _numberOptions = require('./var/_numberOptions');

module.exports = Sugar.Number.setOption;
},{"./var/_numberOptions":547,"sugar-core":3}],539:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.sin;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],540:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.sqrt;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],541:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.tan;
},{"./build/buildMathAliasesCall":445,"sugar-core":3}],542:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isDefined = require('../common/internal/isDefined');

Sugar.Number.defineInstance({

  'times': function(n, fn) {
    var arr, result;
    for(var i = 0; i < n; i++) {
      result = fn.call(n, i);
      if (isDefined(result)) {
        if (!arr) {
          arr = [];
        }
        arr.push(result);
      }
    }
    return arr;
  }

});

module.exports = Sugar.Number.times;
},{"../common/internal/isDefined":134,"sugar-core":3}],543:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Number.defineInstance({

  'toNumber': function(n) {
    return n.valueOf();
  }

});

module.exports = Sugar.Number.toNumber;
},{"sugar-core":3}],544:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    Range = require('../range/internal/Range'),
    rangeEvery = require('../range/internal/rangeEvery');

Sugar.Number.defineInstance({

  'upto': function(n, num, step, fn) {
    return rangeEvery(new Range(n, num), step, false, fn);
  }

});

module.exports = Sugar.Number.upto;
},{"../range/internal/Range":669,"../range/internal/rangeEvery":684,"sugar-core":3}],545:[function(require,module,exports){
'use strict';

module.exports = {
  BASIC_UNITS: '|kmbt',
  MEMORY_UNITS: '|KMGTPE',
  MEMORY_BINARY_UNITS: '|,Ki,Mi,Gi,Ti,Pi,Ei',
  METRIC_UNITS_SHORT: 'nμm|k',
  METRIC_UNITS_FULL: 'yzafpnμm|KMGTPEZY'
};
},{}],546:[function(require,module,exports){
'use strict';

var CommonChars = require('../../common/var/CommonChars');

var HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD,
    HALF_WIDTH_COMMA = CommonChars.HALF_WIDTH_COMMA;

var NUMBER_OPTIONS = {
  'decimal': HALF_WIDTH_PERIOD,
  'thousands': HALF_WIDTH_COMMA
};

module.exports = NUMBER_OPTIONS;
},{"../../common/var/CommonChars":165}],547:[function(require,module,exports){
'use strict';

var NUMBER_OPTIONS = require('./NUMBER_OPTIONS'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineOptionsAccessor = require('../../common/internal/defineOptionsAccessor');

var sugarNumber = namespaceAliases.sugarNumber;

module.exports = defineOptionsAccessor(sugarNumber, NUMBER_OPTIONS);
},{"../../common/internal/defineOptionsAccessor":109,"../../common/var/namespaceAliases":182,"./NUMBER_OPTIONS":546}],548:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.week;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],549:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],550:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],551:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],552:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],553:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeks;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],554:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],555:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],556:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],557:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],558:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.year;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],559:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],560:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],561:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],562:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],563:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.years;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],564:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsAfter;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],565:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsAgo;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],566:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsBefore;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],567:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":200,"sugar-core":3}],568:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    clone = require('./internal/clone'),
    mergeWithOptions = require('./internal/mergeWithOptions');

Sugar.Object.defineInstanceAndStatic({

  'add': function(obj1, obj2, opts) {
    return mergeWithOptions(clone(obj1), obj2, opts);
  }

});

module.exports = Sugar.Object.add;
},{"./internal/clone":585,"./internal/mergeWithOptions":600,"sugar-core":3}],569:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    clone = require('./internal/clone'),
    mergeAll = require('./internal/mergeAll');

Sugar.Object.defineInstanceAndStatic({

  'addAll': function(obj, sources, opts) {
    return mergeAll(clone(obj), sources, opts);
  }

});

module.exports = Sugar.Object.addAll;
},{"./internal/clone":585,"./internal/mergeAll":598,"sugar-core":3}],570:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    average = require('../enumerable/internal/average');

Sugar.Object.defineInstanceAndStatic({

  'average': function(obj, map) {
    return average(obj, map);
  }

});

module.exports = Sugar.Object.average;
},{"../enumerable/internal/average":393,"sugar-core":3}],571:[function(require,module,exports){
'use strict';

var buildClassCheckMethods = require('../internal/buildClassCheckMethods');

buildClassCheckMethods();
},{"../internal/buildClassCheckMethods":584}],572:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    clone = require('./internal/clone');

Sugar.Object.defineInstanceAndStatic({

  'clone': function(obj, deep) {
    return clone(obj, deep);
  }

});

module.exports = Sugar.Object.clone;
},{"./internal/clone":585,"sugar-core":3}],573:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectCount = require('../enumerable/internal/objectCount');

Sugar.Object.defineInstanceAndStatic({

  'count': function(obj, f) {
    return objectCount(obj, f);
  }

});

module.exports = Sugar.Object.count;
},{"../enumerable/internal/objectCount":404,"sugar-core":3}],574:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    defaults = require('./internal/defaults');

Sugar.Object.defineInstanceAndStatic({

  'defaults': function(target, sources, opts) {
    return defaults(target, sources, opts);
  }

});

module.exports = Sugar.Object.defaults;
},{"./internal/defaults":586,"sugar-core":3}],575:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMatchers = require('../enumerable/var/objectMatchers');

var objectEvery = objectMatchers.objectEvery;

Sugar.Object.defineInstanceAndStatic({

  'every': objectEvery

});

module.exports = Sugar.Object.every;
},{"../enumerable/var/objectMatchers":416,"sugar-core":3}],576:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectExclude = require('./internal/objectExclude');

Sugar.Object.defineInstanceAndStatic({

  'exclude': function(obj, f) {
    return objectExclude(obj, f);
  }

});

module.exports = Sugar.Object.exclude;
},{"./internal/objectExclude":601,"sugar-core":3}],577:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectFilter = require('../enumerable/internal/objectFilter');

Sugar.Object.defineInstanceAndStatic({

  'filter': function(obj, f) {
    return objectFilter(obj, f);
  }

});

module.exports = Sugar.Object.filter;
},{"../enumerable/internal/objectFilter":405,"sugar-core":3}],578:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMatchers = require('../enumerable/var/objectMatchers');

var objectFind = objectMatchers.objectFind;

Sugar.Object.defineInstanceAndStatic({

  'find': objectFind

});

module.exports = Sugar.Object.find;
},{"../enumerable/var/objectMatchers":416,"sugar-core":3}],579:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectForEach = require('../enumerable/internal/objectForEach');

Sugar.Object.defineInstanceAndStatic({

  'forEach': function(obj, fn) {
    return objectForEach(obj, fn);
  }

});

module.exports = Sugar.Object.forEach;
},{"../enumerable/internal/objectForEach":406,"sugar-core":3}],580:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    fromQueryStringWithOptions = require('./internal/fromQueryStringWithOptions');

Sugar.Object.defineStatic({

  'fromQueryString': function(obj, options) {
    return fromQueryStringWithOptions(obj, options);
  }

});

module.exports = Sugar.Object.fromQueryString;
},{"./internal/fromQueryStringWithOptions":587,"sugar-core":3}],581:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    deepGetProperty = require('../common/internal/deepGetProperty');

Sugar.Object.defineInstanceAndStatic({

  'get': function(obj, key, any) {
    return deepGetProperty(obj, key, any);
  }

});

module.exports = Sugar.Object.get;
},{"../common/internal/deepGetProperty":101,"sugar-core":3}],582:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    deepHasProperty = require('../common/internal/deepHasProperty');

Sugar.Object.defineInstanceAndStatic({

  'has': function(obj, key, any) {
    return deepHasProperty(obj, key, any);
  }

});

module.exports = Sugar.Object.has;
},{"../common/internal/deepHasProperty":102,"sugar-core":3}],583:[function(require,module,exports){
'use strict';

// Static Methods
require('./add');
require('./addAll');
require('./clone');
require('./defaults');
require('./exclude');
require('./fromQueryString');
require('./get');
require('./has');
require('./intersect');
require('./invert');
require('./isArguments');
require('./isArray');
require('./isBoolean');
require('./isDate');
require('./isEmpty');
require('./isEqual');
require('./isError');
require('./isFunction');
require('./isMap');
require('./isNumber');
require('./isObject');
require('./isRegExp');
require('./isSet');
require('./isString');
require('./merge');
require('./mergeAll');
require('./reject');
require('./remove');
require('./select');
require('./set');
require('./size');
require('./subtract');
require('./tap');
require('./toQueryString');
require('./values');

// Instance Methods
require('./keys');

module.exports = require('sugar-core');
},{"./add":568,"./addAll":569,"./clone":572,"./defaults":574,"./exclude":576,"./fromQueryString":580,"./get":581,"./has":582,"./intersect":617,"./invert":618,"./isArguments":619,"./isArray":620,"./isBoolean":621,"./isDate":622,"./isEmpty":623,"./isEqual":624,"./isError":625,"./isFunction":626,"./isMap":627,"./isNumber":628,"./isObject":629,"./isRegExp":630,"./isSet":631,"./isString":632,"./keys":633,"./merge":638,"./mergeAll":639,"./reject":644,"./remove":645,"./select":646,"./set":647,"./size":648,"./subtract":650,"./tap":652,"./toQueryString":653,"./values":654,"sugar-core":3}],584:[function(require,module,exports){
'use strict';

var NATIVE_TYPES = require('../../common/var/NATIVE_TYPES'),
    classChecks = require('../../common/var/classChecks'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceAndStaticSimilar = require('../../common/internal/defineInstanceAndStaticSimilar');

var isBoolean = classChecks.isBoolean,
    isNumber = classChecks.isNumber,
    isString = classChecks.isString,
    isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction,
    isArray = classChecks.isArray,
    isSet = classChecks.isSet,
    isMap = classChecks.isMap,
    isError = classChecks.isError,
    sugarObject = namespaceAliases.sugarObject;

function buildClassCheckMethods() {
  var checks = [isBoolean, isNumber, isString, isDate, isRegExp, isFunction, isArray, isError, isSet, isMap];
  defineInstanceAndStaticSimilar(sugarObject, NATIVE_TYPES, function(methods, name, i) {
    methods['is' + name] = checks[i];
  });
}

module.exports = buildClassCheckMethods;
},{"../../common/internal/defineInstanceAndStaticSimilar":106,"../../common/var/NATIVE_TYPES":169,"../../common/var/classChecks":177,"../../common/var/namespaceAliases":182}],585:[function(require,module,exports){
'use strict';

var objectMerge = require('./objectMerge'),
    getNewObjectForMerge = require('./getNewObjectForMerge');

function clone(source, deep) {
  var target = getNewObjectForMerge(source);
  return objectMerge(target, source, deep, true, true, true);
}

module.exports = clone;
},{"./getNewObjectForMerge":589,"./objectMerge":603}],586:[function(require,module,exports){
'use strict';

var mergeAll = require('./mergeAll');

function defaults(target, sources, opts) {
  opts = opts || {};
  opts.resolve = opts.resolve || false;
  return mergeAll(target, sources, opts);
}

module.exports = defaults;
},{"./mergeAll":598}],587:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    parseQueryComponent = require('./parseQueryComponent');

function fromQueryStringWithOptions(obj, opts) {
  var str = String(obj || '').replace(/^.*?\?/, ''), result = {}, auto;
  opts = opts || {};
  if (str) {
    forEach(str.split('&'), function(p) {
      var split = p.split('=');
      var key = decodeURIComponent(split[0]);
      var val = split.length === 2 ? decodeURIComponent(split[1]) : '';
      auto = opts.auto !== false;
      parseQueryComponent(result, key, val, opts.deep, auto, opts.separator, opts.transform);
    });
  }
  return result;
}

module.exports = fromQueryStringWithOptions;
},{"../../common/internal/forEach":114,"./parseQueryComponent":609}],588:[function(require,module,exports){
'use strict';

var getKeys = require('../../common/internal/getKeys'),
    coercePrimitiveToObject = require('../../common/internal/coercePrimitiveToObject');

function getKeysWithObjectCoercion(obj) {
  return getKeys(coercePrimitiveToObject(obj));
}

module.exports = getKeysWithObjectCoercion;
},{"../../common/internal/coercePrimitiveToObject":96,"../../common/internal/getKeys":120}],589:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isPrimitive = require('../../common/internal/isPrimitive'),
    isPlainObject = require('../../common/internal/isPlainObject'),
    getRegExpFlags = require('../../common/internal/getRegExpFlags'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var classToString = coreUtilityAliases.classToString,
    isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isArray = classChecks.isArray;

function getNewObjectForMerge(source) {
  var klass = classToString(source);
  // Primitive types, dates, and regexes have no "empty" state. If they exist
  // at all, then they have an associated value. As we are only creating new
  // objects when they don't exist in the target, these values can come alone
  // for the ride when created.
  if (isArray(source, klass)) {
    return [];
  } else if (isPlainObject(source, klass)) {
    return {};
  } else if (isDate(source, klass)) {
    return new Date(source.getTime());
  } else if (isRegExp(source, klass)) {
    return RegExp(source.source, getRegExpFlags(source));
  } else if (isPrimitive(source && source.valueOf())) {
    return source;
  }
  // If the object is not of a known type, then simply merging its
  // properties into a plain object will result in something different
  // (it will not respond to instanceof operator etc). Similarly we don't
  // want to call a constructor here as we can't know for sure what the
  // original constructor was called with (Events etc), so throw an
  // error here instead. Non-standard types can be handled if either they
  // already exist and simply have their properties merged, if the merge
  // is not deep so their references will simply be copied over, or if a
  // resolve function is used to assist the merge.
  throw new TypeError('Must be a basic data type');
}

module.exports = getNewObjectForMerge;
},{"../../common/internal/getRegExpFlags":125,"../../common/internal/isPlainObject":137,"../../common/internal/isPrimitive":138,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178}],590:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    stringIsDecimal = require('./stringIsDecimal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn,
    isArray = classChecks.isArray;

function getQueryValueAuto(obj, key, val) {
  if (!val) {
    return null;
  } else if (val === 'true') {
    return true;
  } else if (val === 'false') {
    return false;
  }
  var num = +val;
  if (!isNaN(num) && stringIsDecimal(val)) {
    return num;
  }
  var existing = getOwn(obj, key);
  if (val && existing) {
    return isArray(existing) ? existing.concat(val) : [existing, val];
  }
  return val;
}

module.exports = getQueryValueAuto;
},{"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"./stringIsDecimal":613}],591:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    sanitizeURIComponent = require('./sanitizeURIComponent');

var isDate = classChecks.isDate;

function getURIComponentValue(obj, prefix, transform) {
  var value;
  if (transform) {
    value = transform(obj, prefix);
  } else if (isDate(obj)) {
    value = obj.getTime();
  } else {
    value = obj;
  }
  return sanitizeURIComponent(prefix) + '=' + sanitizeURIComponent(value);
}

module.exports = getURIComponentValue;
},{"../../common/var/classChecks":177,"./sanitizeURIComponent":610}],592:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function getValues(obj) {
  var values = [];
  forEachProperty(obj, function(val) {
    values.push(val);
  });
  return values;
}

module.exports = getValues;
},{"../../common/var/coreUtilityAliases":178}],593:[function(require,module,exports){
'use strict';

var hasProperty = require('../../common/internal/hasProperty'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var classToString = coreUtilityAliases.classToString;

function isArguments(obj, className) {
  className = className || classToString(obj);
  // .callee exists on Arguments objects in < IE8
  return hasProperty(obj, 'length') && (className === '[object Arguments]' || !!obj.callee);
}

module.exports = isArguments;
},{"../../common/internal/hasProperty":129,"../../common/var/coreUtilityAliases":178}],594:[function(require,module,exports){
'use strict';

var getOwnPropertyDescriptor = require('../var/getOwnPropertyDescriptor');

function iterateOverKeys(getFn, obj, fn, hidden) {
  var keys = getFn(obj), desc;
  for (var i = 0, key; key = keys[i]; i++) {
    desc = getOwnPropertyDescriptor(obj, key);
    if (desc.enumerable || hidden) {
      fn(obj[key], key);
    }
  }
}

module.exports = iterateOverKeys;
},{"../var/getOwnPropertyDescriptor":657}],595:[function(require,module,exports){
'use strict';

var iterateOverKeys = require('./iterateOverKeys'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getOwnPropertyNames = require('../var/getOwnPropertyNames'),
    getOwnPropertySymbols = require('../var/getOwnPropertySymbols');

var forEachProperty = coreUtilityAliases.forEachProperty;

function iterateOverProperties(hidden, obj, fn) {
  if (getOwnPropertyNames && hidden) {
    iterateOverKeys(getOwnPropertyNames, obj, fn, hidden);
  } else {
    forEachProperty(obj, fn);
  }
  if (getOwnPropertySymbols) {
    iterateOverKeys(getOwnPropertySymbols, obj, fn, hidden);
  }
}

module.exports = iterateOverProperties;
},{"../../common/var/coreUtilityAliases":178,"../var/getOwnPropertyNames":658,"../var/getOwnPropertySymbols":659,"./iterateOverKeys":594}],596:[function(require,module,exports){
'use strict';

function mapQuerySeparatorToKeys(key, separator) {
  var split = key.split(separator), result = split[0];
  for (var i = 1, len = split.length; i < len; i++) {
    result += '[' + split[i] + ']';
  }
  return result;
}

module.exports = mapQuerySeparatorToKeys;
},{}],597:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isObjectType = require('../../common/internal/isObjectType');

var isRegExp = classChecks.isRegExp;

function matchInObject(match, key) {
  if (isRegExp(match)) {
    return match.test(key);
  } else if (isObjectType(match)) {
    return key in match;
  } else {
    return key === String(match);
  }
}

module.exports = matchInObject;
},{"../../common/internal/isObjectType":136,"../../common/var/classChecks":177}],598:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    classChecks = require('../../common/var/classChecks'),
    mergeWithOptions = require('./mergeWithOptions');

var isArray = classChecks.isArray;

function mergeAll(target, sources, opts) {
  if (!isArray(sources)) {
    sources = [sources];
  }
  forEach(sources, function(source) {
    return mergeWithOptions(target, source, opts);
  });
  return target;
}

module.exports = mergeAll;
},{"../../common/internal/forEach":114,"../../common/var/classChecks":177,"./mergeWithOptions":600}],599:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getOwnPropertyDescriptor = require('../var/getOwnPropertyDescriptor');

var defineProperty = coreUtilityAliases.defineProperty;

function mergeByPropertyDescriptor(target, source, prop, sourceVal) {
  var descriptor = getOwnPropertyDescriptor(source, prop);
  if (isDefined(descriptor.value)) {
    descriptor.value = sourceVal;
  }
  defineProperty(target, prop, descriptor);
}

module.exports = mergeByPropertyDescriptor;
},{"../../common/internal/isDefined":134,"../../common/var/coreUtilityAliases":178,"../var/getOwnPropertyDescriptor":657}],600:[function(require,module,exports){
'use strict';

var objectMerge = require('./objectMerge');

function mergeWithOptions(target, source, opts) {
  opts = opts || {};
  return objectMerge(target, source, opts.deep, opts.resolve, opts.hidden, opts.descriptor);
}

module.exports = mergeWithOptions;
},{"./objectMerge":603}],601:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectExclude(obj, f) {
  var result = {};
  var matcher = getMatcher(f);
  forEachProperty(obj, function(val, key) {
    if (!matcher(val, key, obj)) {
      result[key] = val;
    }
  });
  return result;
}

module.exports = objectExclude;
},{"../../common/internal/getMatcher":121,"../../common/var/coreUtilityAliases":178}],602:[function(require,module,exports){
'use strict';

var isEqual = require('../../common/internal/isEqual'),
    objectMerge = require('./objectMerge'),
    isObjectType = require('../../common/internal/isObjectType'),
    coercePrimitiveToObject = require('../../common/internal/coercePrimitiveToObject');

function objectIntersectOrSubtract(obj1, obj2, subtract) {
  if (!isObjectType(obj1)) {
    return subtract ? obj1 : {};
  }
  obj2 = coercePrimitiveToObject(obj2);
  function resolve(key, val, val1) {
    var exists = key in obj2 && isEqual(val1, obj2[key]);
    if (exists !== subtract) {
      return val1;
    }
  }
  return objectMerge({}, obj1, false, resolve);
}

module.exports = objectIntersectOrSubtract;
},{"../../common/internal/coercePrimitiveToObject":96,"../../common/internal/isEqual":135,"../../common/internal/isObjectType":136,"./objectMerge":603}],603:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isDefined = require('../../common/internal/isDefined'),
    classChecks = require('../../common/var/classChecks'),
    isPrimitive = require('../../common/internal/isPrimitive'),
    isUndefined = require('../../common/internal/isUndefined'),
    isObjectType = require('../../common/internal/isObjectType'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getOwnPropertyNames = require('../var/getOwnPropertyNames'),
    getNewObjectForMerge = require('./getNewObjectForMerge'),
    iterateOverProperties = require('./iterateOverProperties'),
    coercePrimitiveToObject = require('../../common/internal/coercePrimitiveToObject'),
    mergeByPropertyDescriptor = require('./mergeByPropertyDescriptor');

var isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction,
    getOwn = coreUtilityAliases.getOwn;

function objectMerge(target, source, deep, resolve, hidden, descriptor) {
  var resolveByFunction = isFunction(resolve), resolveConflicts = resolve !== false;

  if (isUndefined(target)) {
    target = getNewObjectForMerge(source);
  } else if (resolveConflicts && isDate(target) && isDate(source)) {
    // A date's timestamp is a property that can only be reached through its
    // methods, so actively set it up front if both are dates.
    target.setTime(source.getTime());
  }

  if (isPrimitive(target)) {
    // Will not merge into a primitive type, so simply override.
    return source;
  }

  // If the source object is a primitive
  // type then coerce it into an object.
  if (isPrimitive(source)) {
    source = coercePrimitiveToObject(source);
  }

  iterateOverProperties(hidden, source, function(val, key) {
    var sourceVal, targetVal, resolved, goDeep, result;

    sourceVal = source[key];

    // We are iterating over properties of the source, so hasOwnProperty on
    // it is guaranteed to always be true. However, the target may happen to
    // have properties in its prototype chain that should not be considered
    // as conflicts.
    targetVal = getOwn(target, key);

    if (resolveByFunction) {
      result = resolve(key, targetVal, sourceVal, target, source);
      if (isUndefined(result)) {
        // Result is undefined so do not merge this property.
        return;
      } else if (isDefined(result) && result !== Sugar) {
        // If the source returns anything except undefined, then the conflict
        // has been resolved, so don't continue traversing into the object. If
        // the returned value is the Sugar global object, then allowing Sugar
        // to resolve the conflict, so continue on.
        sourceVal = result;
        resolved = true;
      }
    } else if (isUndefined(sourceVal)) {
      // Will not merge undefined.
      return;
    }

    // Regex properties are read-only, so intentionally disallowing deep
    // merging for now. Instead merge by reference even if deep.
    goDeep = !resolved && deep && isObjectType(sourceVal) && !isRegExp(sourceVal);

    if (!goDeep && !resolveConflicts && isDefined(targetVal)) {
      return;
    }

    if (goDeep) {
      sourceVal = objectMerge(targetVal, sourceVal, deep, resolve, hidden, descriptor);
    }

    // getOwnPropertyNames is standing in as
    // a test for property descriptor support
    if (getOwnPropertyNames && descriptor) {
      mergeByPropertyDescriptor(target, source, key, sourceVal);
    } else {
      target[key] = sourceVal;
    }

  });
  return target;
}

module.exports = objectMerge;
},{"../../common/internal/coercePrimitiveToObject":96,"../../common/internal/isDefined":134,"../../common/internal/isObjectType":136,"../../common/internal/isPrimitive":138,"../../common/internal/isUndefined":140,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"../var/getOwnPropertyNames":658,"./getNewObjectForMerge":589,"./iterateOverProperties":595,"./mergeByPropertyDescriptor":599,"sugar-core":3}],604:[function(require,module,exports){
'use strict';

var selectFromObject = require('./selectFromObject');

function objectReject(obj, f) {
  return selectFromObject(obj, f, false);
}

module.exports = objectReject;
},{"./selectFromObject":611}],605:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectRemove(obj, f) {
  var matcher = getMatcher(f);
  forEachProperty(obj, function(val, key) {
    if (matcher(val, key, obj)) {
      delete obj[key];
    }
  });
  return obj;
}

module.exports = objectRemove;
},{"../../common/internal/getMatcher":121,"../../common/var/coreUtilityAliases":178}],606:[function(require,module,exports){
'use strict';

var selectFromObject = require('./selectFromObject');

function objectSelect(obj, f) {
  return selectFromObject(obj, f, true);
}

module.exports = objectSelect;
},{"./selectFromObject":611}],607:[function(require,module,exports){
'use strict';

var getKeysWithObjectCoercion = require('./getKeysWithObjectCoercion');

function objectSize(obj) {
  return getKeysWithObjectCoercion(obj).length;
}

module.exports = objectSize;
},{"./getKeysWithObjectCoercion":588}],608:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    setQueryProperty = require('./setQueryProperty'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn;

function parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform) {
  var key = match[1];
  var inner = match[2].slice(1, -1).split('][');
  forEach(inner, function(k) {
    if (!hasOwn(obj, key)) {
      obj[key] = k ? {} : [];
    }
    obj = getOwn(obj, key);
    key = k ? k : obj.length.toString();
  });
  setQueryProperty(obj, key, val, auto, transform);
}

module.exports = parseDeepQueryComponent;
},{"../../common/internal/forEach":114,"../../common/var/coreUtilityAliases":178,"./setQueryProperty":612}],609:[function(require,module,exports){
'use strict';

var DEEP_QUERY_STRING_REG = require('../var/DEEP_QUERY_STRING_REG'),
    setQueryProperty = require('./setQueryProperty'),
    mapQuerySeparatorToKeys = require('./mapQuerySeparatorToKeys'),
    parseDeepQueryComponent = require('./parseDeepQueryComponent');

function parseQueryComponent(obj, key, val, deep, auto, separator, transform) {
  var match;
  if (separator) {
    key = mapQuerySeparatorToKeys(key, separator);
    deep = true;
  }
  if (deep === true && (match = key.match(DEEP_QUERY_STRING_REG))) {
    parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform);
  } else {
    setQueryProperty(obj, key, val, auto, transform);
  }
}

module.exports = parseQueryComponent;
},{"../var/DEEP_QUERY_STRING_REG":655,"./mapQuerySeparatorToKeys":596,"./parseDeepQueryComponent":608,"./setQueryProperty":612}],610:[function(require,module,exports){
'use strict';

function sanitizeURIComponent(obj) {
  // undefined, null, and NaN are represented as a blank string,
  // while false and 0 are stringified.
  return !obj && obj !== false && obj !== 0 ? '' : encodeURIComponent(obj);
}

module.exports = sanitizeURIComponent;
},{}],611:[function(require,module,exports){
'use strict';

var matchInObject = require('./matchInObject'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function selectFromObject(obj, f, select) {
  var match, result = {};
  f = [].concat(f);
  forEachProperty(obj, function(val, key) {
    match = false;
    for (var i = 0; i < f.length; i++) {
      if (matchInObject(f[i], key)) {
        match = true;
      }
    }
    if (match === select) {
      result[key] = val;
    }
  });
  return result;
}

module.exports = selectFromObject;
},{"../../common/var/coreUtilityAliases":178,"./matchInObject":597}],612:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    getQueryValueAuto = require('./getQueryValueAuto');

function setQueryProperty(obj, key, val, auto, transform) {
  var fnValue;
  if (transform) {
    fnValue = transform(val, key, obj);
  }
  if (isDefined(fnValue)) {
    val = fnValue;
  } else if (auto) {
    val = getQueryValueAuto(obj, key, val);
  }
  obj[key] = val;
}

module.exports = setQueryProperty;
},{"../../common/internal/isDefined":134,"./getQueryValueAuto":590}],613:[function(require,module,exports){
'use strict';

var NON_DECIMAL_REG = require('../var/NON_DECIMAL_REG');

function stringIsDecimal(str) {
  return str !== '' && !NON_DECIMAL_REG.test(str);
}

module.exports = stringIsDecimal;
},{"../var/NON_DECIMAL_REG":656}],614:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isFunction = classChecks.isFunction;

function tap(obj, arg) {
  var fn = arg;
  if (!isFunction(arg)) {
    fn = function() {
      if (arg) obj[arg]();
    };
  }
  fn.call(obj, obj);
  return obj;
}

module.exports = tap;
},{"../../common/var/classChecks":177}],615:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isObjectType = require('../../common/internal/isObjectType'),
    internalToString = require('../var/internalToString'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getURIComponentValue = require('./getURIComponentValue'),
    sanitizeURIComponent = require('./sanitizeURIComponent');

var isArray = classChecks.isArray,
    forEachProperty = coreUtilityAliases.forEachProperty;

function toQueryString(obj, deep, transform, prefix, separator) {
  if (isArray(obj)) {
    return collectArrayAsQueryString(obj, deep, transform, prefix, separator);
  } else if (isObjectType(obj) && obj.toString === internalToString) {
    return collectObjectAsQueryString(obj, deep, transform, prefix, separator);
  } else if (prefix) {
    return getURIComponentValue(obj, prefix, transform);
  }
  return '';
}

function collectArrayAsQueryString(arr, deep, transform, prefix, separator) {
  var el, qc, key, result = [];
  // Intentionally treating sparse arrays as dense here by avoiding map,
  // otherwise indexes will shift during the process of serialization.
  for (var i = 0, len = arr.length; i < len; i++) {
    el = arr[i];
    key = prefix + (prefix && deep ? '[]' : '');
    if (!key && !isObjectType(el)) {
      // If there is no key, then the values of the array should be
      // considered as null keys, so use them instead;
      qc = sanitizeURIComponent(el);
    } else {
      qc = toQueryString(el, deep, transform, key, separator);
    }
    result.push(qc);
  }
  return result.join('&');
}

function collectObjectAsQueryString(obj, deep, transform, prefix, separator) {
  var result = [];
  forEachProperty(obj, function(val, key) {
    var fullKey;
    if (prefix && deep) {
      fullKey = prefix + '[' + key + ']';
    } else if (prefix) {
      fullKey = prefix + separator + key;
    } else {
      fullKey = key;
    }
    result.push(toQueryString(val, deep, transform, fullKey, separator));
  });
  return result.join('&');
}

module.exports = toQueryString;
},{"../../common/internal/isObjectType":136,"../../common/var/classChecks":177,"../../common/var/coreUtilityAliases":178,"../var/internalToString":660,"./getURIComponentValue":591,"./sanitizeURIComponent":610}],616:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined'),
    toQueryString = require('./toQueryString');

function toQueryStringWithOptions(obj, opts) {
  opts = opts || {};
  if (isUndefined(opts.separator)) {
    opts.separator = '_';
  }
  return toQueryString(obj, opts.deep, opts.transform, opts.prefix || '', opts.separator);
}

module.exports = toQueryStringWithOptions;
},{"../../common/internal/isUndefined":140,"./toQueryString":615}],617:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectIntersectOrSubtract = require('./internal/objectIntersectOrSubtract');

Sugar.Object.defineInstanceAndStatic({

  'intersect': function(obj1, obj2) {
    return objectIntersectOrSubtract(obj1, obj2, false);
  }

});

module.exports = Sugar.Object.intersect;
},{"./internal/objectIntersectOrSubtract":602,"sugar-core":3}],618:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    coreUtilityAliases = require('../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    forEachProperty = coreUtilityAliases.forEachProperty;

Sugar.Object.defineInstanceAndStatic({

  'invert': function(obj, multi) {
    var result = {};
    multi = multi === true;
    forEachProperty(obj, function(val, key) {
      if (hasOwn(result, val) && multi) {
        result[val].push(key);
      } else if (multi) {
        result[val] = [key];
      } else {
        result[val] = key;
      }
    });
    return result;
  }

});

module.exports = Sugar.Object.invert;
},{"../common/var/coreUtilityAliases":178,"sugar-core":3}],619:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isArguments = require('./internal/isArguments');

Sugar.Object.defineInstanceAndStatic({

  'isArguments': function(obj) {
    return isArguments(obj);
  }

});

module.exports = Sugar.Object.isArguments;
},{"./internal/isArguments":593,"sugar-core":3}],620:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isArray;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],621:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isBoolean;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],622:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isDate;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],623:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectSize = require('./internal/objectSize');

Sugar.Object.defineInstanceAndStatic({

  'isEmpty': function(obj) {
    return objectSize(obj) === 0;
  }

});

module.exports = Sugar.Object.isEmpty;
},{"./internal/objectSize":607,"sugar-core":3}],624:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isEqual = require('../common/internal/isEqual');

Sugar.Object.defineInstanceAndStatic({

  'isEqual': function(obj1, obj2) {
    return isEqual(obj1, obj2);
  }

});

module.exports = Sugar.Object.isEqual;
},{"../common/internal/isEqual":135,"sugar-core":3}],625:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isError;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],626:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isFunction;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],627:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isMap;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],628:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isNumber;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],629:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isPlainObject = require('../common/internal/isPlainObject');

Sugar.Object.defineInstanceAndStatic({

  'isObject': function(obj) {
    return isPlainObject(obj);
  }

});

module.exports = Sugar.Object.isObject;
},{"../common/internal/isPlainObject":137,"sugar-core":3}],630:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isRegExp;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],631:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isSet;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],632:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isString;
},{"./build/buildClassCheckMethodsCall":571,"sugar-core":3}],633:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getKeys = require('../common/internal/getKeys');

Sugar.Object.defineInstance({

  'keys': function(obj) {
    return getKeys(obj);
  }

});

module.exports = Sugar.Object.keys;
},{"../common/internal/getKeys":120,"sugar-core":3}],634:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Object.defineInstanceAndStatic({

  'least': function(obj, all, map) {
    return getLeastOrMost(obj, all, map, false, true);
  }

});

module.exports = Sugar.Object.least;
},{"../enumerable/internal/getLeastOrMost":400,"sugar-core":3}],635:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMap = require('../enumerable/internal/objectMap');

Sugar.Object.defineInstanceAndStatic({

  'map': function(obj, map) {
    return objectMap(obj, map);
  }

});

module.exports = Sugar.Object.map;
},{"../enumerable/internal/objectMap":407,"sugar-core":3}],636:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Object.defineInstanceAndStatic({

  'max': function(obj, all, map) {
    return getMinOrMax(obj, all, map, true, true);
  }

});

module.exports = Sugar.Object.max;
},{"../enumerable/internal/getMinOrMax":401,"sugar-core":3}],637:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    median = require('../enumerable/internal/median');

Sugar.Object.defineInstanceAndStatic({

  'median': function(obj, map) {
    return median(obj, map);
  }

});

module.exports = Sugar.Object.median;
},{"../enumerable/internal/median":403,"sugar-core":3}],638:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mergeWithOptions = require('./internal/mergeWithOptions');

Sugar.Object.defineInstanceAndStatic({

  'merge': function(target, source, opts) {
    return mergeWithOptions(target, source, opts);
  }

});

module.exports = Sugar.Object.merge;
},{"./internal/mergeWithOptions":600,"sugar-core":3}],639:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mergeAll = require('./internal/mergeAll');

Sugar.Object.defineInstanceAndStatic({

  'mergeAll': function(target, sources, opts) {
    return mergeAll(target, sources, opts);
  }

});

module.exports = Sugar.Object.mergeAll;
},{"./internal/mergeAll":598,"sugar-core":3}],640:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Object.defineInstanceAndStatic({

  'min': function(obj, all, map) {
    return getMinOrMax(obj, all, map, false, true);
  }

});

module.exports = Sugar.Object.min;
},{"../enumerable/internal/getMinOrMax":401,"sugar-core":3}],641:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Object.defineInstanceAndStatic({

  'most': function(obj, all, map) {
    return getLeastOrMost(obj, all, map, true, true);
  }

});

module.exports = Sugar.Object.most;
},{"../enumerable/internal/getLeastOrMost":400,"sugar-core":3}],642:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectNone = require('../enumerable/internal/objectNone');

Sugar.Object.defineInstanceAndStatic({

  'none': function(obj, f) {
    return objectNone(obj, f);
  }

});

module.exports = Sugar.Object.none;
},{"../enumerable/internal/objectNone":408,"sugar-core":3}],643:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectReduce = require('../enumerable/internal/objectReduce');

Sugar.Object.defineInstanceAndStatic({

  'reduce': function(obj, fn, init) {
    return objectReduce(obj, fn, init);
  }

});

module.exports = Sugar.Object.reduce;
},{"../enumerable/internal/objectReduce":409,"sugar-core":3}],644:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectReject = require('./internal/objectReject');

Sugar.Object.defineInstanceAndStatic({

  'reject': function(obj, f) {
    return objectReject(obj, f);
  }

});

module.exports = Sugar.Object.reject;
},{"./internal/objectReject":604,"sugar-core":3}],645:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectRemove = require('./internal/objectRemove');

Sugar.Object.defineInstanceAndStatic({

  'remove': function(obj, f) {
    return objectRemove(obj, f);
  }

});

module.exports = Sugar.Object.remove;
},{"./internal/objectRemove":605,"sugar-core":3}],646:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectSelect = require('./internal/objectSelect');

Sugar.Object.defineInstanceAndStatic({

  'select': function(obj, f) {
    return objectSelect(obj, f);
  }

});

module.exports = Sugar.Object.select;
},{"./internal/objectSelect":606,"sugar-core":3}],647:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    deepSetProperty = require('../common/internal/deepSetProperty');

Sugar.Object.defineInstanceAndStatic({

  'set': function(obj, key, val) {
    return deepSetProperty(obj, key, val);
  }

});

module.exports = Sugar.Object.set;
},{"../common/internal/deepSetProperty":103,"sugar-core":3}],648:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectSize = require('./internal/objectSize');

Sugar.Object.defineInstanceAndStatic({

  'size': function(obj) {
    return objectSize(obj);
  }

});

module.exports = Sugar.Object.size;
},{"./internal/objectSize":607,"sugar-core":3}],649:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMatchers = require('../enumerable/var/objectMatchers');

var objectSome = objectMatchers.objectSome;

Sugar.Object.defineInstanceAndStatic({

  'some': objectSome

});

module.exports = Sugar.Object.some;
},{"../enumerable/var/objectMatchers":416,"sugar-core":3}],650:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectIntersectOrSubtract = require('./internal/objectIntersectOrSubtract');

Sugar.Object.defineInstanceAndStatic({

  'subtract': function(obj1, obj2) {
    return objectIntersectOrSubtract(obj1, obj2, true);
  }

});

module.exports = Sugar.Object.subtract;
},{"./internal/objectIntersectOrSubtract":602,"sugar-core":3}],651:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    sum = require('../enumerable/internal/sum');

Sugar.Object.defineInstanceAndStatic({

  'sum': function(obj, map) {
    return sum(obj, map);
  }

});

module.exports = Sugar.Object.sum;
},{"../enumerable/internal/sum":410,"sugar-core":3}],652:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    tap = require('./internal/tap');

Sugar.Object.defineInstanceAndStatic({

  'tap': function(obj, arg) {
    return tap(obj, arg);
  }

});

module.exports = Sugar.Object.tap;
},{"./internal/tap":614,"sugar-core":3}],653:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    toQueryStringWithOptions = require('./internal/toQueryStringWithOptions');

Sugar.Object.defineInstanceAndStatic({

  'toQueryString': function(obj, options) {
    return toQueryStringWithOptions(obj, options);
  }

});

module.exports = Sugar.Object.toQueryString;
},{"./internal/toQueryStringWithOptions":616,"sugar-core":3}],654:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getValues = require('./internal/getValues');

Sugar.Object.defineInstanceAndStatic({

  'values': function(obj) {
    return getValues(obj);
  }

});

module.exports = Sugar.Object.values;
},{"./internal/getValues":592,"sugar-core":3}],655:[function(require,module,exports){
'use strict';

module.exports = /^(.+?)(\[.*\])$/;
},{}],656:[function(require,module,exports){
'use strict';

module.exports = /[^\d.-]/;
},{}],657:[function(require,module,exports){
'use strict';

module.exports = Object.getOwnPropertyDescriptor;
},{}],658:[function(require,module,exports){
'use strict';

module.exports = Object.getOwnPropertyNames;
},{}],659:[function(require,module,exports){
'use strict';

module.exports = Object.getOwnPropertySymbols;
},{}],660:[function(require,module,exports){
'use strict';

module.exports = Object.prototype.toString;
},{}],661:[function(require,module,exports){
'use strict';

var buildDateRangeUnits = require('../internal/buildDateRangeUnits');

buildDateRangeUnits();
},{"../internal/buildDateRangeUnits":670}],662:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeClamp = require('./internal/rangeClamp'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'clamp': function(el) {
    return rangeClamp(this, el);
  }

});

// This package does not export anything as it is
// simply defining "clamp" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669,"./internal/rangeClamp":683}],663:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'clone': function() {
    return new Range(this.start, this.end);
  }

});

// This package does not export anything as it is
// simply defining "clone" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669}],664:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'contains': function(el) {
    if (el == null) return false;
    if (el.start && el.end) {
      return el.start >= this.start && el.start <= this.end &&
             el.end   >= this.start && el.end   <= this.end;
    } else {
      return el >= this.start && el <= this.end;
    }
  }

});

// This package does not export anything as it is
// simply defining "contains" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669}],665:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "days" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],666:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeEvery = require('./internal/rangeEvery'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'every': function(amount, fn) {
    return rangeEvery(this, amount, false, fn);
  }

});

// This package does not export anything as it is
// simply defining "every" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669,"./internal/rangeEvery":684}],667:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "hours" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],668:[function(require,module,exports){
'use strict';

// Static Methods
require('../date/range');
require('../number/range');
require('../string/range');

// Instance Methods
require('../number/cap');
require('../number/clamp');
require('../number/upto');

// Prototype Methods
require('./clamp');
require('./clone');
require('./contains');
require('./days');
require('./every');
require('./hours');
require('./intersect');
require('./isValid');
require('./milliseconds');
require('./minutes');
require('./months');
require('./seconds');
require('./span');
require('./toArray');
require('./toString');
require('./union');
require('./weeks');
require('./years');

// Aliases
require('../number/downto');

module.exports = require('sugar-core');
},{"../date/range":345,"../number/cap":447,"../number/clamp":450,"../number/downto":462,"../number/range":526,"../number/upto":544,"../string/range":759,"./clamp":662,"./clone":663,"./contains":664,"./days":665,"./every":666,"./hours":667,"./intersect":687,"./isValid":688,"./milliseconds":689,"./minutes":690,"./months":691,"./seconds":692,"./span":693,"./toArray":694,"./toString":695,"./union":696,"./weeks":704,"./years":705,"sugar-core":3}],669:[function(require,module,exports){
'use strict';

var cloneRangeMember = require('./cloneRangeMember');

function Range(start, end) {
  this.start = cloneRangeMember(start);
  this.end   = cloneRangeMember(end);
}

module.exports = Range;
},{"./cloneRangeMember":671}],670:[function(require,module,exports){
'use strict';

var MULTIPLIERS = require('../var/MULTIPLIERS'),
    DURATION_UNITS = require('../var/DURATION_UNITS'),
    Range = require('./Range'),
    trunc = require('../../common/var/trunc'),
    forEach = require('../../common/internal/forEach'),
    rangeEvery = require('./rangeEvery'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize'),
    defineOnPrototype = require('../../common/internal/defineOnPrototype');

function buildDateRangeUnits() {
  var methods = {};
  forEach(DURATION_UNITS.split('|'), function(unit, i) {
    var name = unit + 's', mult, fn;
    if (i < 4) {
      fn = function() {
        return rangeEvery(this, unit, true);
      };
    } else {
      mult = MULTIPLIERS[simpleCapitalize(name)];
      fn = function() {
        return trunc((this.end - this.start) / mult);
      };
    }
    methods[name] = fn;
  });
  defineOnPrototype(Range, methods);
}

module.exports = buildDateRangeUnits;
},{"../../common/internal/defineOnPrototype":108,"../../common/internal/forEach":114,"../../common/internal/simpleCapitalize":156,"../../common/var/trunc":183,"../var/DURATION_UNITS":698,"../var/MULTIPLIERS":702,"./Range":669,"./rangeEvery":684}],671:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    getRangeMemberPrimitiveValue = require('./getRangeMemberPrimitiveValue');

var isDate = classChecks.isDate;

function cloneRangeMember(m) {
  if (isDate(m)) {
    return new Date(m.getTime());
  } else {
    return getRangeMemberPrimitiveValue(m);
  }
}

module.exports = cloneRangeMember;
},{"../../common/var/classChecks":177,"./getRangeMemberPrimitiveValue":678}],672:[function(require,module,exports){
'use strict';

var Range = require('./Range'),
    DurationTextFormats = require('../var/DurationTextFormats'),
    incrementDate = require('./incrementDate'),
    getDateForRange = require('./getDateForRange'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    getDateIncrementObject = require('./getDateIncrementObject');

var sugarDate = namespaceAliases.sugarDate,
    RANGE_REG_FROM_TO = DurationTextFormats.RANGE_REG_FROM_TO,
    RANGE_REG_REAR_DURATION = DurationTextFormats.RANGE_REG_REAR_DURATION,
    RANGE_REG_FRONT_DURATION = DurationTextFormats.RANGE_REG_FRONT_DURATION;

function createDateRangeFromString(str) {
  var match, datetime, duration, dio, start, end;
  if (sugarDate.get && (match = str.match(RANGE_REG_FROM_TO))) {
    start = getDateForRange(match[1].replace('from', 'at'));
    end = sugarDate.get(start, match[2]);
    return new Range(start, end);
  }
  if (match = str.match(RANGE_REG_FRONT_DURATION)) {
    duration = match[1];
    datetime = match[2];
  }
  if (match = str.match(RANGE_REG_REAR_DURATION)) {
    datetime = match[1];
    duration = match[2];
  }
  if (datetime && duration) {
    start = getDateForRange(datetime);
    dio = getDateIncrementObject(duration);
    end = incrementDate(start, dio[0], dio[1]);
  } else {
    start = str;
  }
  return new Range(getDateForRange(start), getDateForRange(end));
}

module.exports = createDateRangeFromString;
},{"../../common/var/namespaceAliases":182,"../var/DurationTextFormats":700,"./Range":669,"./getDateForRange":673,"./getDateIncrementObject":674,"./incrementDate":679}],673:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    namespaceAliases = require('../../common/var/namespaceAliases');

var isDate = classChecks.isDate,
    sugarDate = namespaceAliases.sugarDate;

function getDateForRange(d) {
  if (isDate(d)) {
    return d;
  } else if (d == null) {
    return new Date();
  } else if (sugarDate.create) {
    return sugarDate.create(d);
  }
  return new Date(d);
}

module.exports = getDateForRange;
},{"../../common/var/classChecks":177,"../../common/var/namespaceAliases":182}],674:[function(require,module,exports){
'use strict';

var DURATION_REG = require('../var/DURATION_REG'),
    classChecks = require('../../common/var/classChecks'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize');

var isNumber = classChecks.isNumber;

function getDateIncrementObject(amt) {
  var match, val, unit;
  if (isNumber(amt)) {
    return [amt, 'Milliseconds'];
  }
  match = amt.match(DURATION_REG);
  val = +match[1] || 1;
  unit = simpleCapitalize(match[2].toLowerCase());
  if (unit.match(/hour|minute|second/i)) {
    unit += 's';
  } else if (unit === 'Year') {
    unit = 'FullYear';
  } else if (unit === 'Week') {
    unit = 'Date';
    val *= 7;
  } else if (unit === 'Day') {
    unit = 'Date';
  }
  return [val, unit];
}

module.exports = getDateIncrementObject;
},{"../../common/internal/simpleCapitalize":156,"../../common/var/classChecks":177,"../var/DURATION_REG":697}],675:[function(require,module,exports){
'use strict';

var mathAliases = require('../../common/var/mathAliases'),
    getPrecision = require('./getPrecision');

var max = mathAliases.max;

function getGreaterPrecision(n1, n2) {
  return max(getPrecision(n1), getPrecision(n2));
}

module.exports = getGreaterPrecision;
},{"../../common/var/mathAliases":180,"./getPrecision":676}],676:[function(require,module,exports){
'use strict';

var periodSplit = require('../../common/internal/periodSplit');

function getPrecision(n) {
  var split = periodSplit(n.toString());
  return split[1] ? split[1].length : 0;
}

module.exports = getPrecision;
},{"../../common/internal/periodSplit":148}],677:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function getRangeMemberNumericValue(m) {
  return isString(m) ? m.charCodeAt(0) : m;
}

module.exports = getRangeMemberNumericValue;
},{"../../common/var/classChecks":177}],678:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isDate = classChecks.isDate;

function getRangeMemberPrimitiveValue(m) {
  if (m == null) return m;
  return isDate(m) ? m.getTime() : m.valueOf();
}

module.exports = getRangeMemberPrimitiveValue;
},{"../../common/var/classChecks":177}],679:[function(require,module,exports){
'use strict';

var MULTIPLIERS = require('../var/MULTIPLIERS'),
    callDateSet = require('../../common/internal/callDateSet'),
    callDateGet = require('../../common/internal/callDateGet');

function incrementDate(src, amount, unit) {
  var mult = MULTIPLIERS[unit], d;
  if (mult) {
    d = new Date(src.getTime() + (amount * mult));
  } else {
    d = new Date(src);
    callDateSet(d, unit, callDateGet(src, unit) + amount);
  }
  return d;
}

module.exports = incrementDate;
},{"../../common/internal/callDateGet":93,"../../common/internal/callDateSet":94,"../var/MULTIPLIERS":702}],680:[function(require,module,exports){
'use strict';

var withPrecision = require('../../common/internal/withPrecision');

function incrementNumber(current, amount, precision) {
  return withPrecision(current + amount, precision);
}

module.exports = incrementNumber;
},{"../../common/internal/withPrecision":163}],681:[function(require,module,exports){
'use strict';

var chr = require('../../common/var/chr');

function incrementString(current, amount) {
  return chr(current.charCodeAt(0) + amount);
}

module.exports = incrementString;
},{"../../common/var/chr":176}],682:[function(require,module,exports){
'use strict';

var valueIsNotInfinite = require('./valueIsNotInfinite'),
    getRangeMemberPrimitiveValue = require('./getRangeMemberPrimitiveValue');

function isValidRangeMember(m) {
  var val = getRangeMemberPrimitiveValue(m);
  return (!!val || val === 0) && valueIsNotInfinite(m);
}

module.exports = isValidRangeMember;
},{"./getRangeMemberPrimitiveValue":678,"./valueIsNotInfinite":686}],683:[function(require,module,exports){
'use strict';

var cloneRangeMember = require('./cloneRangeMember');

function rangeClamp(range, obj) {
  var clamped,
      start = range.start,
      end = range.end,
      min = end < start ? end : start,
      max = start > end ? start : end;
  if (obj < min) {
    clamped = min;
  } else if (obj > max) {
    clamped = max;
  } else {
    clamped = obj;
  }
  return cloneRangeMember(clamped);
}

module.exports = rangeClamp;
},{"./cloneRangeMember":671}],684:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    rangeIsValid = require('./rangeIsValid'),
    incrementDate = require('./incrementDate'),
    incrementNumber = require('./incrementNumber'),
    incrementString = require('./incrementString'),
    getGreaterPrecision = require('./getGreaterPrecision'),
    getDateIncrementObject = require('./getDateIncrementObject');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString,
    isDate = classChecks.isDate,
    isFunction = classChecks.isFunction;

function rangeEvery(range, step, countOnly, fn) {
  var increment,
      precision,
      dio,
      unit,
      start   = range.start,
      end     = range.end,
      inverse = end < start,
      current = start,
      index   = 0,
      result  = [];

  if (!rangeIsValid(range)) {
    return countOnly ? NaN : [];
  }
  if (isFunction(step)) {
    fn = step;
    step = null;
  }
  step = step || 1;
  if (isNumber(start)) {
    precision = getGreaterPrecision(start, step);
    increment = function() {
      return incrementNumber(current, step, precision);
    };
  } else if (isString(start)) {
    increment = function() {
      return incrementString(current, step);
    };
  } else if (isDate(start)) {
    dio  = getDateIncrementObject(step);
    step = dio[0];
    unit = dio[1];
    increment = function() {
      return incrementDate(current, step, unit);
    };
  }
  // Avoiding infinite loops
  if (inverse && step > 0) {
    step *= -1;
  }
  while(inverse ? current >= end : current <= end) {
    if (!countOnly) {
      result.push(current);
    }
    if (fn) {
      fn(current, index, range);
    }
    current = increment();
    index++;
  }
  return countOnly ? index - 1 : result;
}

module.exports = rangeEvery;
},{"../../common/var/classChecks":177,"./getDateIncrementObject":674,"./getGreaterPrecision":675,"./incrementDate":679,"./incrementNumber":680,"./incrementString":681,"./rangeIsValid":685}],685:[function(require,module,exports){
'use strict';

var isValidRangeMember = require('./isValidRangeMember');

function rangeIsValid(range) {
  return isValidRangeMember(range.start) &&
         isValidRangeMember(range.end) &&
         typeof range.start === typeof range.end;
}

module.exports = rangeIsValid;
},{"./isValidRangeMember":682}],686:[function(require,module,exports){
'use strict';

function valueIsNotInfinite(m) {
  return m !== -Infinity && m !== Infinity;
}

module.exports = valueIsNotInfinite;
},{}],687:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'intersect': function(range) {
    if (range.start > this.end || range.end < this.start) {
      return new Range(NaN, NaN);
    }
    return new Range(
      this.start > range.start ? this.start : range.start,
      this.end   < range.end   ? this.end   : range.end
    );
  }

});

// This package does not export anything as it is
// simply defining "intersect" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669}],688:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeIsValid = require('./internal/rangeIsValid'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'isValid': function() {
    return rangeIsValid(this);
  }

});

// This package does not export anything as it is
// simply defining "isValid" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669,"./internal/rangeIsValid":685}],689:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "milliseconds" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],690:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "minutes" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],691:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "months" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],692:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "seconds" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],693:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    mathAliases = require('../common/var/mathAliases'),
    rangeIsValid = require('./internal/rangeIsValid'),
    defineOnPrototype = require('../common/internal/defineOnPrototype'),
    getRangeMemberNumericValue = require('./internal/getRangeMemberNumericValue');

var abs = mathAliases.abs;

defineOnPrototype(Range, {

  'span': function() {
    var n = getRangeMemberNumericValue(this.end) - getRangeMemberNumericValue(this.start);
    return rangeIsValid(this) ? abs(n) + 1 : NaN;
  }

});

// This package does not export anything as it is
// simply defining "span" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"../common/var/mathAliases":180,"./internal/Range":669,"./internal/getRangeMemberNumericValue":677,"./internal/rangeIsValid":685}],694:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeEvery = require('./internal/rangeEvery'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'toArray': function() {
    return rangeEvery(this);
  }

});

// This package does not export anything as it is
// simply defining "toArray" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669,"./internal/rangeEvery":684}],695:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeIsValid = require('./internal/rangeIsValid'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'toString': function() {
    return rangeIsValid(this) ? this.start + '..' + this.end : 'Invalid Range';
  }

});

// This package does not export anything as it is
// simply defining "toString" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669,"./internal/rangeIsValid":685}],696:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'union': function(range) {
    return new Range(
      this.start < range.start ? this.start : range.start,
      this.end   > range.end   ? this.end   : range.end
    );
  }

});

// This package does not export anything as it is
// simply defining "union" on Range.prototype.
},{"../common/internal/defineOnPrototype":108,"./internal/Range":669}],697:[function(require,module,exports){
'use strict';

var DURATION_UNITS = require('./DURATION_UNITS');

module.exports = RegExp('(\\d+)?\\s*('+ DURATION_UNITS +')s?', 'i');
},{"./DURATION_UNITS":698}],698:[function(require,module,exports){
'use strict';

module.exports = 'year|month|week|day|hour|minute|second|millisecond';
},{}],699:[function(require,module,exports){
'use strict';

var Range = require('../internal/Range'),
    classChecks = require('../../common/var/classChecks'),
    getDateForRange = require('../internal/getDateForRange'),
    createDateRangeFromString = require('../internal/createDateRangeFromString');

var isString = classChecks.isString;

var DateRangeConstructor = function(start, end) {
  if (arguments.length === 1 && isString(start)) {
    return createDateRangeFromString(start);
  }
  return new Range(getDateForRange(start), getDateForRange(end));
};

module.exports = DateRangeConstructor;
},{"../../common/var/classChecks":177,"../internal/Range":669,"../internal/createDateRangeFromString":672,"../internal/getDateForRange":673}],700:[function(require,module,exports){
'use strict';

var FULL_CAPTURED_DURATION = require('./FULL_CAPTURED_DURATION');

module.exports = {
  RANGE_REG_FROM_TO: /(?:from)?\s*(.+)\s+(?:to|until)\s+(.+)$/i,
  RANGE_REG_REAR_DURATION: RegExp('(.+)\\s*for\\s*' + FULL_CAPTURED_DURATION, 'i'),
  RANGE_REG_FRONT_DURATION: RegExp('(?:for)?\\s*'+ FULL_CAPTURED_DURATION +'\\s*(?:starting)?\\s(?:at\\s)?(.+)', 'i')
};
},{"./FULL_CAPTURED_DURATION":701}],701:[function(require,module,exports){
'use strict';

var DURATION_UNITS = require('./DURATION_UNITS');

module.exports = '((?:\\d+)?\\s*(?:' + DURATION_UNITS + '))s?';
},{"./DURATION_UNITS":698}],702:[function(require,module,exports){
'use strict';

var MULTIPLIERS = {
  'Hours': 60 * 60 * 1000,
  'Minutes': 60 * 1000,
  'Seconds': 1000,
  'Milliseconds': 1
};

module.exports = MULTIPLIERS;
},{}],703:[function(require,module,exports){
'use strict';

var Range = require('../internal/Range');

var PrimitiveRangeConstructor = function(start, end) {
  return new Range(start, end);
};

module.exports = PrimitiveRangeConstructor;
},{"../internal/Range":669}],704:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "weeks" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],705:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "years" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":661}],706:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getRegExpFlags = require('../common/internal/getRegExpFlags');

Sugar.RegExp.defineInstance({

  'addFlags': function(r, flags) {
    return RegExp(r.source, getRegExpFlags(r, flags));
  }

});

module.exports = Sugar.RegExp.addFlags;
},{"../common/internal/getRegExpFlags":125,"sugar-core":3}],707:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    escapeRegExp = require('../common/internal/escapeRegExp');

Sugar.RegExp.defineStatic({

  'escape': function(str) {
    return escapeRegExp(str);
  }

});

module.exports = Sugar.RegExp.escape;
},{"../common/internal/escapeRegExp":111,"sugar-core":3}],708:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getRegExpFlags = require('../common/internal/getRegExpFlags');

Sugar.RegExp.defineInstance({

  'getFlags': function(r) {
    return getRegExpFlags(r);
  }

});

module.exports = Sugar.RegExp.getFlags;
},{"../common/internal/getRegExpFlags":125,"sugar-core":3}],709:[function(require,module,exports){
'use strict';

// Static Methods
require('./escape');

// Instance Methods
require('./addFlags');
require('./getFlags');
require('./removeFlags');
require('./setFlags');

module.exports = require('sugar-core');
},{"./addFlags":706,"./escape":707,"./getFlags":708,"./removeFlags":710,"./setFlags":711,"sugar-core":3}],710:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    allCharsReg = require('../common/internal/allCharsReg'),
    getRegExpFlags = require('../common/internal/getRegExpFlags');

Sugar.RegExp.defineInstance({

  'removeFlags': function(r, flags) {
    var reg = allCharsReg(flags);
    return RegExp(r.source, getRegExpFlags(r).replace(reg, ''));
  }

});

module.exports = Sugar.RegExp.removeFlags;
},{"../common/internal/allCharsReg":88,"../common/internal/getRegExpFlags":125,"sugar-core":3}],711:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.RegExp.defineInstance({

  'setFlags': function(r, flags) {
    return RegExp(r.source, flags);
  }

});

module.exports = Sugar.RegExp.setFlags;
},{"sugar-core":3}],712:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getEntriesForIndexes = require('../common/internal/getEntriesForIndexes');

Sugar.String.defineInstance({

  'at': function(str, index, loop) {
    return getEntriesForIndexes(str, index, loop, true);
  }

});

module.exports = Sugar.String.at;
},{"../common/internal/getEntriesForIndexes":118,"sugar-core":3}],713:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringCamelize = require('./internal/stringCamelize');

Sugar.String.defineInstance({

  'camelize': function(str, upper) {
    return stringCamelize(str, upper);
  }

});

module.exports = Sugar.String.camelize;
},{"./internal/stringCamelize":738,"sugar-core":3}],714:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringCapitalize = require('./internal/stringCapitalize');

Sugar.String.defineInstance({

  'capitalize': function(str, lower, all) {
    return stringCapitalize(str, lower, all);
  }

});

module.exports = Sugar.String.capitalize;
},{"./internal/stringCapitalize":739,"sugar-core":3}],715:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'chars': function(str, search, fn) {
    return stringEach(str, search, fn);
  }

});

module.exports = Sugar.String.chars;
},{"./internal/stringEach":741,"sugar-core":3}],716:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringCodes = require('./internal/stringCodes');

Sugar.String.defineInstance({

  'codes': function(str, fn) {
    return stringCodes(str, fn);
  }

});

module.exports = Sugar.String.codes;
},{"./internal/stringCodes":740,"sugar-core":3}],717:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim');

Sugar.String.defineInstance({

  'compact': function(str) {
    return trim(str).replace(/([\r\n\s　])+/g, function(match, whitespace) {
      return whitespace === '　' ? whitespace : ' ';
    });
  }

});

module.exports = Sugar.String.compact;
},{"../common/internal/trim":162,"sugar-core":3}],718:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringUnderscore = require('./internal/stringUnderscore');

Sugar.String.defineInstance({

  'dasherize': function(str) {
    return stringUnderscore(str).replace(/_/g, '-');
  }

});

module.exports = Sugar.String.dasherize;
},{"./internal/stringUnderscore":746,"sugar-core":3}],719:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    base64 = require('./var/base64');

var decodeBase64 = base64.decodeBase64;

Sugar.String.defineInstance({

  'decodeBase64': function(str) {
    return decodeBase64(str);
  }

});

module.exports = Sugar.String.decodeBase64;
},{"./var/base64":790,"sugar-core":3}],720:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    base64 = require('./var/base64');

var encodeBase64 = base64.encodeBase64;

Sugar.String.defineInstance({

  'encodeBase64': function(str) {
    return encodeBase64(str);
  }

});

module.exports = Sugar.String.encodeBase64;
},{"./var/base64":790,"sugar-core":3}],721:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    HTML_ESCAPE_REG = require('./var/HTML_ESCAPE_REG'),
    HTMLToEntityMap = require('./var/HTMLToEntityMap'),
    coreUtilityAliases = require('../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn;

Sugar.String.defineInstance({

  'escapeHTML': function(str) {
    return str.replace(HTML_ESCAPE_REG, function(chr) {
      return getOwn(HTMLToEntityMap, chr);
    });
  }

});

module.exports = Sugar.String.escapeHTML;
},{"../common/var/coreUtilityAliases":178,"./var/HTMLToEntityMap":782,"./var/HTML_ESCAPE_REG":784,"sugar-core":3}],722:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'escapeURL': function(str, param) {
    return param ? encodeURIComponent(str) : encodeURI(str);
  }

});

module.exports = Sugar.String.escapeURL;
},{"sugar-core":3}],723:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.String.defineInstance({

  'first': function(str, num) {
    if (isUndefined(num)) num = 1;
    return str.substr(0, num);
  }

});

module.exports = Sugar.String.first;
},{"../common/internal/isUndefined":140,"sugar-core":3}],724:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'forEach': function(str, search, fn) {
    return stringEach(str, search, fn);
  }

});

module.exports = Sugar.String.forEach;
},{"./internal/stringEach":741,"sugar-core":3}],725:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isObjectType = require('../common/internal/isObjectType'),
    stringFormatMatcher = require('./var/stringFormatMatcher');

Sugar.String.defineInstanceWithArguments({

  'format': function(str, args) {
    var arg1 = args[0] && args[0].valueOf();
    // Unwrap if a single object is passed in.
    if (args.length === 1 && isObjectType(arg1)) {
      args = arg1;
    }
    return stringFormatMatcher(str, args);
  }

});

module.exports = Sugar.String.format;
},{"../common/internal/isObjectType":136,"./var/stringFormatMatcher":792,"sugar-core":3}],726:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    numberOrIndex = require('./internal/numberOrIndex');

Sugar.String.defineInstance({

  'from': function(str, from) {
    return str.slice(numberOrIndex(str, from, true));
  }

});

module.exports = Sugar.String.from;
},{"./internal/numberOrIndex":732,"sugar-core":3}],727:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    STRING_ENHANCEMENTS_FLAG = require('./var/STRING_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    callIncludesWithRegexSupport = require('./internal/callIncludesWithRegexSupport');

Sugar.String.defineInstance({

  'includes': fixArgumentLength(callIncludesWithRegexSupport)

}, [ENHANCEMENTS_FLAG, STRING_ENHANCEMENTS_FLAG]);

module.exports = Sugar.String.includes;
},{"../common/internal/fixArgumentLength":113,"../common/var/ENHANCEMENTS_FLAG":166,"./internal/callIncludesWithRegexSupport":730,"./var/STRING_ENHANCEMENTS_FLAG":788,"sugar-core":3}],728:[function(require,module,exports){
'use strict';

// Instance Methods
require('./at');
require('./camelize');
require('./capitalize');
require('./chars');
require('./codes');
require('./compact');
require('./dasherize');
require('./decodeBase64');
require('./encodeBase64');
require('./escapeHTML');
require('./escapeURL');
require('./first');
require('./forEach');
require('./format');
require('./from');
require('./includes');
require('./insert');
require('./isBlank');
require('./isEmpty');
require('./last');
require('./lines');
require('./pad');
require('./padLeft');
require('./padRight');
require('./parameterize');
require('./remove');
require('./removeAll');
require('./removeTags');
require('./replaceAll');
require('./reverse');
require('./shift');
require('./spacify');
require('./stripTags');
require('./titleize');
require('./to');
require('./toNumber');
require('./trimLeft');
require('./trimRight');
require('./truncate');
require('./truncateOnWord');
require('./underscore');
require('./unescapeHTML');
require('./unescapeURL');
require('./words');

module.exports = require('sugar-core');
},{"./at":712,"./camelize":713,"./capitalize":714,"./chars":715,"./codes":716,"./compact":717,"./dasherize":718,"./decodeBase64":719,"./encodeBase64":720,"./escapeHTML":721,"./escapeURL":722,"./first":723,"./forEach":724,"./format":725,"./from":726,"./includes":727,"./insert":729,"./isBlank":751,"./isEmpty":752,"./last":753,"./lines":754,"./pad":755,"./padLeft":756,"./padRight":757,"./parameterize":758,"./remove":760,"./removeAll":761,"./removeTags":762,"./replaceAll":763,"./reverse":764,"./shift":765,"./spacify":766,"./stripTags":767,"./titleize":768,"./to":769,"./toNumber":770,"./trimLeft":771,"./trimRight":772,"./truncate":773,"./truncateOnWord":774,"./underscore":775,"./unescapeHTML":776,"./unescapeURL":777,"./words":793,"sugar-core":3}],729:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.String.defineInstance({

  'insert': function(str, substr, index) {
    index = isUndefined(index) ? str.length : index;
    return str.slice(0, index) + substr + str.slice(index);
  }

});

module.exports = Sugar.String.insert;
},{"../common/internal/isUndefined":140,"sugar-core":3}],730:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    nativeIncludes = require('../var/nativeIncludes');

var isRegExp = classChecks.isRegExp;

function callIncludesWithRegexSupport(str, search, position) {
  if (!isRegExp(search)) {
    return nativeIncludes.call(str, search, position);
  }
  if (position) {
    str = str.slice(position);
  }
  return search.test(str);
}

module.exports = callIncludesWithRegexSupport;
},{"../../common/var/classChecks":177,"../var/nativeIncludes":791}],731:[function(require,module,exports){
'use strict';

var trim = require('../../common/internal/trim'),
    stringEach = require('./stringEach');

function eachWord(str, fn) {
  return stringEach(trim(str), /\S+/g, fn);
}

module.exports = eachWord;
},{"../../common/internal/trim":162,"./stringEach":741}],732:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function numberOrIndex(str, n, from) {
  if (isString(n)) {
    n = str.indexOf(n);
    if (n === -1) {
      n = from ? str.length : 0;
    }
  }
  return n;
}

module.exports = numberOrIndex;
},{"../../common/var/classChecks":177}],733:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    repeatString = require('../../common/internal/repeatString');

function padString(num, padding) {
  return repeatString(isDefined(padding) ? padding : ' ', num);
}

module.exports = padString;
},{"../../common/internal/isDefined":134,"../../common/internal/repeatString":151}],734:[function(require,module,exports){
'use strict';

var map = require('../../common/internal/map'),
    classChecks = require('../../common/var/classChecks'),
    escapeRegExp = require('../../common/internal/escapeRegExp'),
    runTagReplacements = require('./runTagReplacements');

var isString = classChecks.isString;

function replaceTags(str, find, replacement, strip) {
  var tags = isString(find) ? [find] : find, reg, src;
  tags = map(tags || [], function(t) {
    return escapeRegExp(t);
  }).join('|');
  src = tags.replace('all', '') || '[^\\s>]+';
  src = '<(\\/)?(' + src + ')(\\s+[^<>]*?)?\\s*(\\/)?>';
  reg = RegExp(src, 'gi');
  return runTagReplacements(str.toString(), reg, strip, replacement);
}

module.exports = replaceTags;
},{"../../common/internal/escapeRegExp":111,"../../common/internal/map":143,"../../common/var/classChecks":177,"./runTagReplacements":737}],735:[function(require,module,exports){
'use strict';

function reverseString(str) {
  return str.split('').reverse().join('');
}

module.exports = reverseString;
},{}],736:[function(require,module,exports){
'use strict';

function runGlobalMatch(str, reg) {
  var result = [], match, lastLastIndex;
  while ((match = reg.exec(str)) != null) {
    if (reg.lastIndex === lastLastIndex) {
      reg.lastIndex += 1;
    } else {
      result.push(match[0]);
    }
    lastLastIndex = reg.lastIndex;
  }
  return result;
}

module.exports = runGlobalMatch;
},{}],737:[function(require,module,exports){
'use strict';

var tagIsVoid = require('./tagIsVoid'),
    classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function runTagReplacements(str, reg, strip, replacement, fullString) {

  var match;
  var result = '';
  var currentIndex = 0;
  var openTagName;
  var openTagAttributes;
  var openTagCount = 0;

  function processTag(index, tagName, attributes, tagLength, isVoid) {
    var content = str.slice(currentIndex, index), s = '', r = '';
    if (isString(replacement)) {
      r = replacement;
    } else if (replacement) {
      r = replacement.call(fullString, tagName, content, attributes, fullString) || '';
    }
    if (strip) {
      s = r;
    } else {
      content = r;
    }
    if (content) {
      content = runTagReplacements(content, reg, strip, replacement, fullString);
    }
    result += s + content + (isVoid ? '' : s);
    currentIndex = index + (tagLength || 0);
  }

  fullString = fullString || str;
  reg = RegExp(reg.source, 'gi');

  while(match = reg.exec(str)) {

    var tagName         = match[2];
    var attributes      = (match[3]|| '').slice(1);
    var isClosingTag    = !!match[1];
    var isSelfClosing   = !!match[4];
    var tagLength       = match[0].length;
    var isVoid          = tagIsVoid(tagName);
    var isOpeningTag    = !isClosingTag && !isSelfClosing && !isVoid;
    var isSameAsCurrent = tagName === openTagName;

    if (!openTagName) {
      result += str.slice(currentIndex, match.index);
      currentIndex = match.index;
    }

    if (isOpeningTag) {
      if (!openTagName) {
        openTagName = tagName;
        openTagAttributes = attributes;
        openTagCount++;
        currentIndex += tagLength;
      } else if (isSameAsCurrent) {
        openTagCount++;
      }
    } else if (isClosingTag && isSameAsCurrent) {
      openTagCount--;
      if (openTagCount === 0) {
        processTag(match.index, openTagName, openTagAttributes, tagLength, isVoid);
        openTagName       = null;
        openTagAttributes = null;
      }
    } else if (!openTagName) {
      processTag(match.index, tagName, attributes, tagLength, isVoid);
    }
  }
  if (openTagName) {
    processTag(str.length, openTagName, openTagAttributes);
  }
  result += str.slice(currentIndex);
  return result;
}

module.exports = runTagReplacements;
},{"../../common/var/classChecks":177,"./tagIsVoid":747}],738:[function(require,module,exports){
'use strict';

var CAMELIZE_REG = require('../var/CAMELIZE_REG'),
    getAcronym = require('../../common/internal/getAcronym'),
    stringUnderscore = require('./stringUnderscore'),
    stringCapitalize = require('./stringCapitalize');

function stringCamelize(str, upper) {
  str = stringUnderscore(str);
  return str.replace(CAMELIZE_REG, function(match, pre, word, index) {
    var cap = upper !== false || index > 0, acronym;
    acronym = getAcronym(word);
    if (acronym && cap) {
      return acronym;
    }
    return cap ? stringCapitalize(word, true) : word;
  });
}

module.exports = stringCamelize;
},{"../../common/internal/getAcronym":117,"../var/CAMELIZE_REG":778,"./stringCapitalize":739,"./stringUnderscore":746}],739:[function(require,module,exports){
'use strict';

var CAPITALIZE_REG = require('../var/CAPITALIZE_REG'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize');

function stringCapitalize(str, downcase, all) {
  if (downcase) {
    str = str.toLowerCase();
  }
  return all ? str.replace(CAPITALIZE_REG, simpleCapitalize) : simpleCapitalize(str);
}

module.exports = stringCapitalize;
},{"../../common/internal/simpleCapitalize":156,"../var/CAPITALIZE_REG":779}],740:[function(require,module,exports){
'use strict';

function stringCodes(str, fn) {
  var codes = new Array(str.length), i, len;
  for(i = 0, len = str.length; i < len; i++) {
    var code = str.charCodeAt(i);
    codes[i] = code;
    if (fn) {
      fn.call(str, code, i, str);
    }
  }
  return codes;
}

module.exports = stringCodes;
},{}],741:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    classChecks = require('../../common/var/classChecks'),
    escapeRegExp = require('../../common/internal/escapeRegExp'),
    getRegExpFlags = require('../../common/internal/getRegExpFlags'),
    runGlobalMatch = require('./runGlobalMatch');

var isString = classChecks.isString,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction;

function stringEach(str, search, fn) {
  var chunks, chunk, reg, result = [];
  if (isFunction(search)) {
    fn = search;
    reg = /[\s\S]/g;
  } else if (!search) {
    reg = /[\s\S]/g;
  } else if (isString(search)) {
    reg = RegExp(escapeRegExp(search), 'gi');
  } else if (isRegExp(search)) {
    reg = RegExp(search.source, getRegExpFlags(search, 'g'));
  }
  // Getting the entire array of chunks up front as we need to
  // pass this into the callback function as an argument.
  chunks = runGlobalMatch(str, reg);

  if (chunks) {
    for(var i = 0, len = chunks.length, r; i < len; i++) {
      chunk = chunks[i];
      result[i] = chunk;
      if (fn) {
        r = fn.call(str, chunk, i, chunks);
        if (r === false) {
          break;
        } else if (isDefined(r)) {
          result[i] = r;
        }
      }
    }
  }
  return result;
}

module.exports = stringEach;
},{"../../common/internal/escapeRegExp":111,"../../common/internal/getRegExpFlags":125,"../../common/internal/isDefined":134,"../../common/var/classChecks":177,"./runGlobalMatch":736}],742:[function(require,module,exports){
'use strict';

var escapeRegExp = require('../../common/internal/escapeRegExp');

function stringParameterize(str, separator) {
  if (separator === undefined) separator = '-';
  str = str.replace(/[^a-z0-9\-_]+/gi, separator);
  if (separator) {
    var reg = RegExp('^{s}+|{s}+$|({s}){s}+'.split('{s}').join(escapeRegExp(separator)), 'g');
    str = str.replace(reg, '$1');
  }
  return encodeURI(str.toLowerCase());
}

module.exports = stringParameterize;
},{"../../common/internal/escapeRegExp":111}],743:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    escapeRegExp = require('../../common/internal/escapeRegExp'),
    getRegExpFlags = require('../../common/internal/getRegExpFlags');

var isString = classChecks.isString;

function stringReplaceAll(str, f, replace) {
  var i = 0, tokens;
  if (isString(f)) {
    f = RegExp(escapeRegExp(f), 'g');
  } else if (f && !f.global) {
    f = RegExp(f.source, getRegExpFlags(f, 'g'));
  }
  if (!replace) {
    replace = '';
  } else {
    tokens = replace;
    replace = function() {
      var t = tokens[i++];
      return t != null ? t : '';
    };
  }
  return str.replace(f, replace);
}

module.exports = stringReplaceAll;
},{"../../common/internal/escapeRegExp":111,"../../common/internal/getRegExpFlags":125,"../../common/var/classChecks":177}],744:[function(require,module,exports){
'use strict';

var stringUnderscore = require('./stringUnderscore');

function stringSpacify(str) {
  return stringUnderscore(str).replace(/_/g, ' ');
}

module.exports = stringSpacify;
},{"./stringUnderscore":746}],745:[function(require,module,exports){
'use strict';

var DOWNCASED_WORDS = require('../var/DOWNCASED_WORDS'),
    indexOf = require('../../common/internal/indexOf'),
    eachWord = require('./eachWord'),
    getAcronym = require('../../common/internal/getAcronym'),
    getHumanWord = require('../../common/internal/getHumanWord'),
    runHumanRules = require('../../common/internal/runHumanRules'),
    stringSpacify = require('./stringSpacify'),
    stringCapitalize = require('./stringCapitalize');

function stringTitleize(str) {
  var fullStopPunctuation = /[.:;!]$/, lastHadPunctuation;
  str = runHumanRules(str);
  str = stringSpacify(str);
  return eachWord(str, function(word, index, words) {
    word = getHumanWord(word) || word;
    word = getAcronym(word) || word;
    var hasPunctuation, isFirstOrLast;
    var first = index == 0, last = index == words.length - 1;
    hasPunctuation = fullStopPunctuation.test(word);
    isFirstOrLast = first || last || hasPunctuation || lastHadPunctuation;
    lastHadPunctuation = hasPunctuation;
    if (isFirstOrLast || indexOf(DOWNCASED_WORDS, word) === -1) {
      return stringCapitalize(word, false, true);
    } else {
      return word;
    }
  }).join(' ');
}

module.exports = stringTitleize;
},{"../../common/internal/getAcronym":117,"../../common/internal/getHumanWord":119,"../../common/internal/indexOf":131,"../../common/internal/runHumanRules":152,"../var/DOWNCASED_WORDS":780,"./eachWord":731,"./stringCapitalize":739,"./stringSpacify":744}],746:[function(require,module,exports){
'use strict';

var Inflections = require('../../common/var/Inflections');

function stringUnderscore(str) {
  var areg = Inflections.acronyms && Inflections.acronyms.reg;
  return str
    .replace(/[-\s]+/g, '_')
    .replace(areg, function(acronym, index) {
      return (index > 0 ? '_' : '') + acronym.toLowerCase();
    })
    .replace(/([A-Z\d]+)([A-Z][a-z])/g,'$1_$2')
    .replace(/([a-z\d])([A-Z])/g,'$1_$2')
    .toLowerCase();
}

module.exports = stringUnderscore;
},{"../../common/var/Inflections":168}],747:[function(require,module,exports){
'use strict';

var HTML_VOID_ELEMENTS = require('../var/HTML_VOID_ELEMENTS'),
    indexOf = require('../../common/internal/indexOf');

function tagIsVoid(tag) {
  return indexOf(HTML_VOID_ELEMENTS, tag.toLowerCase()) !== -1;
}

module.exports = tagIsVoid;
},{"../../common/internal/indexOf":131,"../var/HTML_VOID_ELEMENTS":785}],748:[function(require,module,exports){
'use strict';

var TRUNC_REG = require('../var/TRUNC_REG'),
    filter = require('../../common/internal/filter'),
    reverseString = require('./reverseString');

function truncateOnWord(str, limit, fromLeft) {
  if (fromLeft) {
    return reverseString(truncateOnWord(reverseString(str), limit));
  }
  var words = str.split(TRUNC_REG);
  var count = 0;
  return filter(words, function(word) {
    count += word.length;
    return count <= limit;
  }).join('');
}

module.exports = truncateOnWord;
},{"../../common/internal/filter":112,"../var/TRUNC_REG":789,"./reverseString":735}],749:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined'),
    mathAliases = require('../../common/var/mathAliases'),
    truncateOnWord = require('./truncateOnWord');

var ceil = mathAliases.ceil,
    floor = mathAliases.floor;

function truncateString(str, length, from, ellipsis, split) {
  var str1, str2, len1, len2;
  if (str.length <= length) {
    return str.toString();
  }
  ellipsis = isUndefined(ellipsis) ? '...' : ellipsis;
  switch(from) {
    case 'left':
      str2 = split ? truncateOnWord(str, length, true) : str.slice(str.length - length);
      return ellipsis + str2;
    case 'middle':
      len1 = ceil(length / 2);
      len2 = floor(length / 2);
      str1 = split ? truncateOnWord(str, len1) : str.slice(0, len1);
      str2 = split ? truncateOnWord(str, len2, true) : str.slice(str.length - len2);
      return str1 + ellipsis + str2;
    default:
      str1 = split ? truncateOnWord(str, length) : str.slice(0, length);
      return str1 + ellipsis;
  }
}

module.exports = truncateString;
},{"../../common/internal/isUndefined":140,"../../common/var/mathAliases":180,"./truncateOnWord":748}],750:[function(require,module,exports){
'use strict';

var HTML_ENTITY_REG = require('../var/HTML_ENTITY_REG'),
    HTMLFromEntityMap = require('../var/HTMLFromEntityMap'),
    chr = require('../../common/var/chr');

function unescapeHTML(str) {
  return str.replace(HTML_ENTITY_REG, function(full, hex, code) {
    var special = HTMLFromEntityMap[code];
    return special || chr(hex ? parseInt(code, 16) : +code);
  });
}

module.exports = unescapeHTML;
},{"../../common/var/chr":176,"../var/HTMLFromEntityMap":781,"../var/HTML_ENTITY_REG":783}],751:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim');

Sugar.String.defineInstance({

  'isBlank': function(str) {
    return trim(str).length === 0;
  }

});

module.exports = Sugar.String.isBlank;
},{"../common/internal/trim":162,"sugar-core":3}],752:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'isEmpty': function(str) {
    return str.length === 0;
  }

});

module.exports = Sugar.String.isEmpty;
},{"sugar-core":3}],753:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.String.defineInstance({

  'last': function(str, num) {
    if (isUndefined(num)) num = 1;
    var start = str.length - num < 0 ? 0 : str.length - num;
    return str.substr(start);
  }

});

module.exports = Sugar.String.last;
},{"../common/internal/isUndefined":140,"sugar-core":3}],754:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'lines': function(str, fn) {
    return stringEach(trim(str), /^.*$/gm, fn);
  }

});

module.exports = Sugar.String.lines;
},{"../common/internal/trim":162,"./internal/stringEach":741,"sugar-core":3}],755:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padString = require('./internal/padString'),
    mathAliases = require('../common/var/mathAliases'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

var max = mathAliases.max,
    ceil = mathAliases.ceil,
    floor = mathAliases.floor;

Sugar.String.defineInstance({

  'pad': function(str, num, padding) {
    var half, front, back;
    num   = coercePositiveInteger(num);
    half  = max(0, num - str.length) / 2;
    front = floor(half);
    back  = ceil(half);
    return padString(front, padding) + str + padString(back, padding);
  }

});

module.exports = Sugar.String.pad;
},{"../common/internal/coercePositiveInteger":95,"../common/var/mathAliases":180,"./internal/padString":733,"sugar-core":3}],756:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padString = require('./internal/padString'),
    mathAliases = require('../common/var/mathAliases'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

var max = mathAliases.max;

Sugar.String.defineInstance({

  'padLeft': function(str, num, padding) {
    num = coercePositiveInteger(num);
    return padString(max(0, num - str.length), padding) + str;
  }

});

module.exports = Sugar.String.padLeft;
},{"../common/internal/coercePositiveInteger":95,"../common/var/mathAliases":180,"./internal/padString":733,"sugar-core":3}],757:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padString = require('./internal/padString'),
    mathAliases = require('../common/var/mathAliases'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

var max = mathAliases.max;

Sugar.String.defineInstance({

  'padRight': function(str, num, padding) {
    num = coercePositiveInteger(num);
    return str + padString(max(0, num - str.length), padding);
  }

});

module.exports = Sugar.String.padRight;
},{"../common/internal/coercePositiveInteger":95,"../common/var/mathAliases":180,"./internal/padString":733,"sugar-core":3}],758:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringParameterize = require('./internal/stringParameterize');

Sugar.String.defineInstance({

  'parameterize': function(str, separator) {
    return stringParameterize(str, separator);
  }

});

module.exports = Sugar.String.parameterize;
},{"./internal/stringParameterize":742,"sugar-core":3}],759:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    PrimitiveRangeConstructor = require('../range/var/PrimitiveRangeConstructor');

Sugar.String.defineStatic({

  'range': PrimitiveRangeConstructor

});

module.exports = Sugar.String.range;
},{"../range/var/PrimitiveRangeConstructor":703,"sugar-core":3}],760:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'remove': function(str, f) {
    return str.replace(f, '');
  }

});

module.exports = Sugar.String.remove;
},{"sugar-core":3}],761:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringReplaceAll = require('./internal/stringReplaceAll');

Sugar.String.defineInstance({

  'removeAll': function(str, f) {
    return stringReplaceAll(str, f);
  }

});

module.exports = Sugar.String.removeAll;
},{"./internal/stringReplaceAll":743,"sugar-core":3}],762:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    replaceTags = require('./internal/replaceTags');

Sugar.String.defineInstance({

  'removeTags': function(str, tag, replace) {
    return replaceTags(str, tag, replace, false);
  }

});

module.exports = Sugar.String.removeTags;
},{"./internal/replaceTags":734,"sugar-core":3}],763:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringReplaceAll = require('./internal/stringReplaceAll');

Sugar.String.defineInstanceWithArguments({

  'replaceAll': function(str, f, args) {
    return stringReplaceAll(str, f, args);
  }

});

module.exports = Sugar.String.replaceAll;
},{"./internal/stringReplaceAll":743,"sugar-core":3}],764:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    reverseString = require('./internal/reverseString');

Sugar.String.defineInstance({

  'reverse': function(str) {
    return reverseString(str);
  }

});

module.exports = Sugar.String.reverse;
},{"./internal/reverseString":735,"sugar-core":3}],765:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    chr = require('../common/var/chr'),
    stringCodes = require('./internal/stringCodes');

Sugar.String.defineInstance({

  'shift': function(str, n) {
    var result = '';
    n = n || 0;
    stringCodes(str, function(c) {
      result += chr(c + n);
    });
    return result;
  }

});

module.exports = Sugar.String.shift;
},{"../common/var/chr":176,"./internal/stringCodes":740,"sugar-core":3}],766:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringSpacify = require('./internal/stringSpacify');

Sugar.String.defineInstance({

  'spacify': function(str) {
    return stringSpacify(str);
  }

});

module.exports = Sugar.String.spacify;
},{"./internal/stringSpacify":744,"sugar-core":3}],767:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    replaceTags = require('./internal/replaceTags');

Sugar.String.defineInstance({

  'stripTags': function(str, tag, replace) {
    return replaceTags(str, tag, replace, true);
  }

});

module.exports = Sugar.String.stripTags;
},{"./internal/replaceTags":734,"sugar-core":3}],768:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringTitleize = require('./internal/stringTitleize');

Sugar.String.defineInstance({

  'titleize': function(str) {
    return stringTitleize(str);
  }

});

module.exports = Sugar.String.titleize;
},{"./internal/stringTitleize":745,"sugar-core":3}],769:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined'),
    numberOrIndex = require('./internal/numberOrIndex');

Sugar.String.defineInstance({

  'to': function(str, to) {
    if (isUndefined(to)) to = str.length;
    return str.slice(0, numberOrIndex(str, to));
  }

});

module.exports = Sugar.String.to;
},{"../common/internal/isUndefined":140,"./internal/numberOrIndex":732,"sugar-core":3}],770:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringToNumber = require('../common/internal/stringToNumber');

Sugar.String.defineInstance({

  'toNumber': function(str, base) {
    return stringToNumber(str, base);
  }

});

module.exports = Sugar.String.toNumber;
},{"../common/internal/stringToNumber":161,"sugar-core":3}],771:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LEFT_TRIM_REG = require('./var/LEFT_TRIM_REG');

Sugar.String.defineInstance({

  'trimLeft': function(str) {
    return str.replace(LEFT_TRIM_REG, '');
  }

});

module.exports = Sugar.String.trimLeft;
},{"./var/LEFT_TRIM_REG":786,"sugar-core":3}],772:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    RIGHT_TRIM_REG = require('./var/RIGHT_TRIM_REG');

Sugar.String.defineInstance({

  'trimRight': function(str) {
    return str.replace(RIGHT_TRIM_REG, '');
  }

});

module.exports = Sugar.String.trimRight;
},{"./var/RIGHT_TRIM_REG":787,"sugar-core":3}],773:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    truncateString = require('./internal/truncateString');

Sugar.String.defineInstance({

  'truncate': function(str, length, from, ellipsis) {
    return truncateString(str, length, from, ellipsis);
  }

});

module.exports = Sugar.String.truncate;
},{"./internal/truncateString":749,"sugar-core":3}],774:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    truncateString = require('./internal/truncateString');

Sugar.String.defineInstance({

  'truncateOnWord': function(str, length, from, ellipsis) {
    return truncateString(str, length, from, ellipsis, true);
  }

});

module.exports = Sugar.String.truncateOnWord;
},{"./internal/truncateString":749,"sugar-core":3}],775:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringUnderscore = require('./internal/stringUnderscore');

Sugar.String.defineInstance({

  'underscore': function(str) {
    return stringUnderscore(str);
  }

});

module.exports = Sugar.String.underscore;
},{"./internal/stringUnderscore":746,"sugar-core":3}],776:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    unescapeHTML = require('./internal/unescapeHTML');

Sugar.String.defineInstance({

  'unescapeHTML': function(str) {
    return unescapeHTML(str);
  }

});

module.exports = Sugar.String.unescapeHTML;
},{"./internal/unescapeHTML":750,"sugar-core":3}],777:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'unescapeURL': function(str, param) {
    return param ? decodeURI(str) : decodeURIComponent(str);
  }

});

module.exports = Sugar.String.unescapeURL;
},{"sugar-core":3}],778:[function(require,module,exports){
'use strict';

module.exports = /(^|_)([^_]+)/g;
},{}],779:[function(require,module,exports){
'use strict';

module.exports = /[^\u0000-\u0040\u005B-\u0060\u007B-\u007F]+('s)?/g;
},{}],780:[function(require,module,exports){
'use strict';

var DOWNCASED_WORDS = [
  'and', 'or', 'nor', 'a', 'an', 'the', 'so', 'but', 'to', 'of', 'at',
  'by', 'from', 'into', 'on', 'onto', 'off', 'out', 'in', 'over',
  'with', 'for'
];

module.exports = DOWNCASED_WORDS;
},{}],781:[function(require,module,exports){
'use strict';

var HTMLFromEntityMap = {
  'lt':    '<',
  'gt':    '>',
  'amp':   '&',
  'nbsp':  ' ',
  'quot':  '"',
  'apos':  "'"
};

module.exports = HTMLFromEntityMap;
},{}],782:[function(require,module,exports){
'use strict';

var HTMLFromEntityMap = require('./HTMLFromEntityMap'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

var HTMLToEntityMap;

function buildEntities() {
  HTMLToEntityMap = {};
  forEachProperty(HTMLFromEntityMap, function(val, key) {
    HTMLToEntityMap[val] = '&' + key + ';';
  });
}

buildEntities();

module.exports = HTMLToEntityMap;
},{"../../common/var/coreUtilityAliases":178,"./HTMLFromEntityMap":781}],783:[function(require,module,exports){
'use strict';

module.exports = /&#?(x)?([\w\d]{0,5});/gi;
},{}],784:[function(require,module,exports){
'use strict';

module.exports = /[&<>]/g;
},{}],785:[function(require,module,exports){
'use strict';

var HTML_VOID_ELEMENTS = [
  'area','base','br','col','command','embed','hr','img',
  'input','keygen','link','meta','param','source','track','wbr'
];

module.exports = HTML_VOID_ELEMENTS;
},{}],786:[function(require,module,exports){
'use strict';

var TRIM_CHARS = require('../../common/var/TRIM_CHARS');

module.exports = RegExp('^['+ TRIM_CHARS +']+');
},{"../../common/var/TRIM_CHARS":174}],787:[function(require,module,exports){
'use strict';

var TRIM_CHARS = require('../../common/var/TRIM_CHARS');

module.exports = RegExp('['+ TRIM_CHARS +']+$');
},{"../../common/var/TRIM_CHARS":174}],788:[function(require,module,exports){
'use strict';

module.exports = 'enhanceString';
},{}],789:[function(require,module,exports){
'use strict';

var TRIM_CHARS = require('../../common/var/TRIM_CHARS');

module.exports = RegExp('(?=[' + TRIM_CHARS + '])');
},{"../../common/var/TRIM_CHARS":174}],790:[function(require,module,exports){
(function (Buffer){
'use strict';

var chr = require('../../common/var/chr');

var encodeBase64, decodeBase64;

function buildBase64() {
  var encodeAscii, decodeAscii;

  function catchEncodingError(fn) {
    return function(str) {
      try {
        return fn(str);
      } catch(e) {
        return '';
      }
    };
  }

  if (typeof Buffer !== 'undefined') {
    encodeBase64 = function(str) {
      return new Buffer(str).toString('base64');
    };
    decodeBase64 = function(str) {
      return new Buffer(str, 'base64').toString('utf8');
    };
    return;
  }
  if (typeof btoa !== 'undefined') {
    encodeAscii = catchEncodingError(btoa);
    decodeAscii = catchEncodingError(atob);
  } else {
    var key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var base64reg = /[^A-Za-z0-9\+\/\=]/g;
    encodeAscii = function(str) {
      var output = '';
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;
      do {
        chr1 = str.charCodeAt(i++);
        chr2 = str.charCodeAt(i++);
        chr3 = str.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;
        if (isNaN(chr2)) {
          enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
          enc4 = 64;
        }
        output += key.charAt(enc1);
        output += key.charAt(enc2);
        output += key.charAt(enc3);
        output += key.charAt(enc4);
        chr1 = chr2 = chr3 = '';
        enc1 = enc2 = enc3 = enc4 = '';
      } while (i < str.length);
      return output;
    };
    decodeAscii = function(input) {
      var output = '';
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;
      if (input.match(base64reg)) {
        return '';
      }
      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
      do {
        enc1 = key.indexOf(input.charAt(i++));
        enc2 = key.indexOf(input.charAt(i++));
        enc3 = key.indexOf(input.charAt(i++));
        enc4 = key.indexOf(input.charAt(i++));
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
        output = output + chr(chr1);
        if (enc3 != 64) {
          output = output + chr(chr2);
        }
        if (enc4 != 64) {
          output = output + chr(chr3);
        }
        chr1 = chr2 = chr3 = '';
        enc1 = enc2 = enc3 = enc4 = '';
      } while (i < input.length);
      return output;
    };
  }
  encodeBase64 = function(str) {
    return encodeAscii(unescape(encodeURIComponent(str)));
  };
  decodeBase64 = function(str) {
    return decodeURIComponent(escape(decodeAscii(str)));
  };
}

buildBase64();

module.exports = {
  encodeBase64: encodeBase64,
  decodeBase64: decodeBase64
};
}).call(this,require("buffer").Buffer)
},{"../../common/var/chr":176,"buffer":794}],791:[function(require,module,exports){
'use strict';

module.exports = String.prototype.includes;
},{}],792:[function(require,module,exports){
'use strict';

var deepGetProperty = require('../../common/internal/deepGetProperty'),
    createFormatMatcher = require('../../common/internal/createFormatMatcher');

module.exports = createFormatMatcher(deepGetProperty);
},{"../../common/internal/createFormatMatcher":99,"../../common/internal/deepGetProperty":101}],793:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'words': function(str, fn) {
    return stringEach(trim(str), /\S+/g, fn);
  }

});

module.exports = Sugar.String.words;
},{"../common/internal/trim":162,"./internal/stringEach":741,"sugar-core":3}],794:[function(require,module,exports){

},{}]},{},[1]);
