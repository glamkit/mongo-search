// examples of storing functions for later use
// from storefunc.js
s = db.system.js;

s.insert( { _id : "bar" , value : function( z ){ return 17 + z; } } );
assert.eq( 22 , db.eval( "return bar(5);"  ) , "exec - 3 " );

assert( s.getIndexKeys().length > 0 , "no indexes" );
assert( s.getIndexKeys()[0]._id , "no _id index" );

// check the "jstests" dir of the mongodb source for some exciting examples of 
// stuff being done - such as mr*.js for mapreduce, and group* for
// grouping