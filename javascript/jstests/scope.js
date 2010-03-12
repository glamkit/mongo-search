// load('jstests/_utility.js');
var s = db.scope_test;
s.drop();
var j = db.system.js;

var fixture = [
    { _id : "scope_x" , value : 4 },
    { _id : "scope_function_returning_closure" ,
        value : function(){
            var scope_closure_var = 73;
            return function(){
                return scope_closure_var;
            };
        }()
    },
];

mft_util.load_records_from_list(fixture, 'system.js');
assert.eq(2 , j.find({_id: /^scope_/}).count() , "setup functions" );
assert.eq(db.eval("return scope_x;"), 4, "scope_x" );
// the following test will raise an exception; stored functions do not retain their closures in MongoDB
// assert.eq(db.eval("return scope_function_returning_closure();"), 73, "scope_function_returning_closure" );
// However, this works find, sinc ethe variable will be looked up in glboal scope
j.save({_id: "scope_closure_var", value: 74});
assert.eq(db.eval("return scope_function_returning_closure();"), 74, "closue is global" );
