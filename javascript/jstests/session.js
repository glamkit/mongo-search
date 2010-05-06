//quirks of session and state in server-side JS evaluation

//TODO: check mutual scope access in parllel thread execution
// *which* we can now do - see assert.parallelTests

load('mongo-fulltext/_load.js');

// the following lines raise an error that we can't confirm using
// assert.throws, since that messes with method binding
// Take-home message: scoping with var doesn't work
// db.eval("var session_server_scoped_test_magic_number = 593;")
db.eval("session_server_unscoped_test_magic_number = 275;");
assert.eq(
  db.eval("return session_server_unscoped_test_magic_number;"),
  275
);
session_client_object_scope_constructor = function() {};
session_client_object_scope_constructor.prototype = {
  bar: 'prototype_property',
  baz: function() {return 'prototype_method';}
};
session_client_object_scope = new session_client_object_scope_constructor();
session_client_object_scope.foo = 'own_property';

assert.eq(
  session_client_object_scope.foo,
  'own_property'
);
assert.eq(
  session_client_object_scope.bar,
  'prototype_property'
);
assert.eq(
  session_client_object_scope.baz(),
  'prototype_method'
);

db.eval("session_server_object_scope_constructor = function() {};");
db.eval("session_server_object_scope_constructor.prototype = {" +
  "bar: 'prototype_property'," +
  "baz: function() {return 'prototype_method';}" +
"};");
db.eval("session_server_object_scope = new session_server_object_scope_constructor();");
db.eval("session_server_object_scope.foo = 'own_property';");
assert.eq(
  db.eval("return session_server_object_scope.foo;"),
  'own_property'
);
assert(
    //if prototypes were not pruned this would be what we expect
    // db.eval("session_server_object_scope.bar;") === 'prototype_property'
    db.eval("typeOf session_server_object_scope.bar;") === 'undefined',
    "prototype properties are missing"
);
assert.eq(
  db.eval("return session_server_object_scope.baz();"),
  'prototype_method'
);