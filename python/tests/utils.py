# −*− coding: UTF−8 −*−
"""
Things to help with testing - nice dict compararers etc.
"""

from nose.tools import nottest, assert_equals

@nottest
def key_comparison(dict_a, dict_b, key):
    val_a, val_b = dict_a.get(key), dict_b.get(key)
    if hasattr(val_a, 'to_dict'): val_a = val_a.to_dict()
    if hasattr(val_b, 'to_dict'): val_b = val_b.to_dict()
    if val_a != val_b:
        raise AssertionError(
          "dict unequal for key %s. (%s != %s)" % (key, str(val_a), str(val_b))
        )

@nottest
def dict_comparer(dict_a, dict_b):
    """
    yield keywise tests for dict equality, making it easy to see what is going on
    """
    if not hasattr(dict_a, 'keys'):
        raise AssertionError("left operand doesn't look like a dict")
    if not hasattr(dict_b, 'keys'):
        raise AssertionError("right operand doesn't look like a dict")
    for key in dict_a.keys():
        yield key_comparison, dict_a, dict_b, key
    keys_a, keys_b = dict_a.keys(), dict_b.keys()
    keys_a.sort(); keys_b.sort()