// We require the functions in this file to observe slightly different
// conventions than other files - in particular, these objects must all be
// serialisable and need not use the usual initialiser pattern
// we still need the _all business.
// depends upon mft._inited being created in _load.js

//bootstrap the lib for clientside use
if (typeof mft == 'undefined') {
    mft = {};
}
if (typeof mft._sleeping == 'undefined') {
    mft._sleeping = {};
}
//loading this should always flush loaded modules
mft._awake = {};

mft.get = function(name) {
    // objects in the mongod system.js collection lose closures, prototypes etc.
    // we access them using this thing by storing intialisers in mft._sleeping, 
    // and caching initialised versions in the mft._inited one.
    mft.debug_print('waking name '+name);
    if (typeof mft._awake[name] == 'undefined') {
        mft._awake[name] = mft._sleeping[name](); 
    };
    return mft._awake[name];
};

mft.debug_print = function(msg) {
    if ((typeof mft != 'undefined') && mft.DEBUG) {
      print(tojson(msg));
    }
};


