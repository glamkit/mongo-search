// We require the functions in this file to observe slightly different
// conventions than other files - in particular, these objects must all be
// serialisable and need not use the usual initialiser pattern
// we still need the _all business.
// depends upon mft._inited being created in _load.js

//bootstrap the lib for clientside use
if (typeof mft == 'undefined') {
    mft = {};
}

mft.get = function(name) {
    // objects in the mongod system.js collection lose closures, prototypes etc.
    // we access them using this thing by pulling them out of 
    // the mft namespace and caching initialised versions in the mft._inited one.
    if (typeof mft._inited[name] == 'undefined') {
        mft._inited[name] = mft[name](); 
    };
    return mft._inited[name];
};

mft._inited = {};


