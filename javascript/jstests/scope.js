// load('mongo-fulltext/_base.js');
var s = db.scope_test;
s.drop();
var j = db.system.js;

j.save({ _id : "scope_x" , value : 4 });
j.save({ _id : "scope_function_returning_closure" ,
        value : function(){
            var scope_closure_var = 73;
            return function(){
                return scope_closure_var;
            };
        }()
       });

assert.eq(2 , j.find({_id: /^scope_/}).count() , "setup functions" );
assert.eq(db.eval("return scope_x;"), 4, "scope_x" );
// the following test would raise an exception; stored functions do not retain their closures in MongoDB
// assert.eq(db.eval("return scope_function_returning_closure();"), 73, "scope_function_returning_closure" );
// However, this works fine, since the variable will be looked up in global scope
j.save({_id: "scope_closure_var", value: 74});
assert.eq(db.eval("return scope_function_returning_closure();"), 74, "closure is global" );

//do changes to global namespace persist?
j.save({
    _id : "scope_function_altering_global_scope" ,
    value : function(){
            scope_function_altering_global_scope_var++;
            return scope_function_altering_global_scope_var;
    }
});
j.save({
    _id : "scope_function_altering_global_scope_var" ,
    value : 5
});

assert.eq(db.eval("return scope_function_altering_global_scope_var;"), 5, "global scope is system.js" );
assert.eq(db.eval("return scope_function_altering_global_scope();"), 6);
//that change should persist in this session
assert.eq(db.eval("return scope_function_altering_global_scope_var;"), 6, "global scope is writeable" );
//but not be persist in the db
assert.eq(j.find({_id: "scope_function_altering_global_scope_var"})[0].value, 5, "global scope is not persistent across sessions" );

