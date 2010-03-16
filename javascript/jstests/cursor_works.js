//tests for our fake cursor workalike
//TODO: test real cursor here too and compare methods
load('jstests/_utility.js');

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
mft_util.load_records_from_list(fixture, 'cursor_works');
// mft_util.assign_on_server('scores_and_ids', scores_and_ids);
var conf = db.fulltext_config;
conf.insert({collection_name : 'cursor_works', fields: {'title': 1, 'content': 1}});
test_cursor = db.eval("return new mft.SearchPseudoCursor('cursor_works', " + tojson(scores_and_ids) + ");")
print(tojson(test_cursor.hasNext));
assert(test_cursor.hasNext());
assert.eq(test_cursor.next(), {
        "_id" : 3,
        "title" : "cursor test 3",
        "content" : "blah blah blah",
        "score" : 1
});
assert.eq(test_cursor.next(), {
        "_id" : 1,
        "title" : "cursor test 1",
        "content" : "blah",
        "score" : 0.5
});
assert.eq(test_cursor.next(), {
        "_id" : 2,
        "title" : "cursor test 2",
        "content" : "blah blah",
        "score" : 0
});
