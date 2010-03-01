load('jstests/_utility.js');
var s = db.search_works;
s.drop();
var fixture = [
    { "_id" : 1, "title" : "fish", "content" : "groupers like John Dory" },
    { "_id" : 2, "title" : "dogs", "content" : "whippets kick mongrels" },
    { "_id" : 3, "title" : "dogs & fish", "content" : "whippets kick groupers" }
]

load_records_from_list('search_works', fixture);

result = db.eval("return mft.search('search_works', {$search: 'fish'})");
