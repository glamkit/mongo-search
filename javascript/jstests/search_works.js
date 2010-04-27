//TODO: actually use asserts to make this a real test
load('jstests/_utility.js');
var s = db.search_works;
s.drop();
var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
]
mft_util.load_records_from_list(fixture, 'search_works');
var result ;
var conf = db.fulltext_config
conf.insert({'collection_name' : 'search_works', 'fields': {'title': 5, 'content': 1}});
// TODO: add index on collection name (should we have an _id attribute too?)
db.eval("mft.indexAll('search_works')");
result = db.eval("return mft.search('search_works', {$search: 'fish'})").toArray();
// print("Search result for fish: " + tojson(result));
assert.eq(result, [
        {
                "_id" : 1,
                "title" : "fish",
                "content" : "groupers like John Dory",
                "_extracted_terms" : [
                        "fish",
                        "fish",
                        "fish",
                        "fish",
                        "fish",
                        "grouper",
                        "like",
                        "john",
                        "dori"
                ],
                "score" : 0.6757751801802742
        },
        {
                "_id" : 3,
                "title" : "dogs & fish",
                "content" : "whippets kick groupers",
                "_extracted_terms" : [
                        "dog",
                        "fish",
                        "dog",
                        "fish",
                        "dog",
                        "fish",
                        "dog",
                        "fish",
                        "dog",
                        "fish",
                        "whippet",
                        "kick",
                        "grouper"
                ],
                "score" : 0.5622789375752065
        }
]);
result = db.eval("return mft.search('search_works', {$search: 'Dory'})").toArray();
// print("Search result for Dory: " + tojson(result));
assert.eq(result, [
        {
                "_id" : 1,
                "title" : "fish",
                "content" : "groupers like John Dory",
                "_extracted_terms" : [
                        "fish",
                        "fish",
                        "fish",
                        "fish",
                        "fish",
                        "grouper",
                        "like",
                        "john",
                        "dori"
                ],
                "score" : 0.3662040962227033
        }
]);
