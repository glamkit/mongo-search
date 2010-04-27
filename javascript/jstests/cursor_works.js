//tests for our fake cursor workalike
//TODO: test real cursor here too and compare methods
load('mongo-fulltext/_load.js');
mft.DEBUG = true;
var s = db.cursor_works;
s.drop();
var fixture = [
    { "_id" : 1, "title" : "cursor test 1", "content" : "blah" },
    { "_id" : 2, "title" : "cursor test 2", "content" : "blah blah" },
    { "_id" : 3, "title" : "cursor test 3", "content" : "blah blah blah" }
]
var scores_and_ids = [
    [ 1.0, 3],
    [ 0.5, 1],
    [ 0.0, 2]
]
var test_cursor = null;
mft.get('util').load_records_from_list(fixture, 'cursor_works');
// mft.get('util').assign_on_server('scores_and_ids', scores_and_ids);
var conf = db.fulltext_config;
conf.insert({collection_name : 'cursor_works', fields: {'title': 1, 'content': 1}});

db.eval("search = mft.get('search')");

// TODO: work out why this next line throws an exception.
// db.eval("SPC = search.SearchPseudoCursor;");
// db.eval("test_cursor = new SPC('cursor_works', " + tojson(scores_and_ids) + ");");

db.eval("test_cursor = new search.SearchPseudoCursor('cursor_works', " + tojson(scores_and_ids) + ");");

 
assert(db.eval("test_cursor.hasNext();"));

assert.eq(db.eval('return test_cursor.next();'), {
        "_id" : 3,
        "title" : "cursor test 3",
        "content" : "blah blah blah",
        "score" : 1
});

assert.eq(db.eval('test_cursor.next();'), {
        "_id" : 1,
        "title" : "cursor test 1",
        "content" : "blah",
        "score" : 0.5
});
assert.eq(db.eval('test_cursor.next();'), {
        "_id" : 2,
        "title" : "cursor test 2",
        "content" : "blah blah",
        "score" : 0
});
