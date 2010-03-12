// load('jstests/_utility.js');
var s = db.search_works;
s.drop();
var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
]

mft_util.load_records_from_list(fixture, 'search_works');
var conf = db.fulltext_config
conf.insert({'collection_name' : 'search_works', 'fields': {'title': 5, 'content': 1}});
// TODO: add index on collection name (should we have an _id attribute too?)
db.eval("mft.index_all('search_works')");
result = db.eval("return mft.search('search_works', {$search: 'fish'})");
print("Search result" + tojson(result));
result = db.eval("return mft.search('search_works', {$search: 'Dory'})");
print("Search result" + tojson(result));
