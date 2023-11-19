(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.Utils = {}));
}(this, (function (exports) { 'use strict';

  //     Underscore.js 1.8.3
  //     http://underscorejs.org
  //     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
  //     Underscore may be freely distributed under the MIT license.

  // (function() {

    // Baseline setup
    // --------------

    // Establish the root object, `window` in the browser, or `exports` on the server.
    // var root = this;

    // Save the previous value of the `_` variable.
    // var previousUnderscore = root._;

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var
      push             = ArrayProto.push,
      slice            = ArrayProto.slice,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
      nativeIsArray      = Array.isArray,
      nativeKeys         = Object.keys,
      nativeBind         = FuncProto.bind,
      nativeCreate       = Object.create;

    // Naked function reference for surrogate-prototype-swapping.
    var Ctor = function(){};

    // Create a safe reference to the Underscore object for use below.
    var _ = function(obj) {
      if (obj instanceof _) return obj;
      if (!(this instanceof _)) return new _(obj);
      this._wrapped = obj;
    };

    // Current version.
    _.VERSION = '1.8.3';

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    var optimizeCb = function(func, context, argCount) {
      if (context === void 0) return func;
      switch (argCount == null ? 3 : argCount) {
        case 1: return function(value) {
          return func.call(context, value);
        };
        case 2: return function(value, other) {
          return func.call(context, value, other);
        };
        case 3: return function(value, index, collection) {
          return func.call(context, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(context, accumulator, value, index, collection);
        };
      }
      return function() {
        return func.apply(context, arguments);
      };
    };

    // A mostly-internal function to generate callbacks that can be applied
    // to each element in a collection, returning the desired result — either
    // identity, an arbitrary callback, a property matcher, or a property accessor.
    var cb = function(value, context, argCount) {
      if (value == null) return _.identity;
      if (_.isFunction(value)) return optimizeCb(value, context, argCount);
      if (_.isObject(value)) return _.matcher(value);
      return _.property(value);
    };
    _.iteratee = function(value, context) {
      return cb(value, context, Infinity);
    };

    // An internal function for creating assigner functions.
    var createAssigner = function(keysFunc, undefinedOnly) {
      return function(obj) {
        var length = arguments.length;
        if (length < 2 || obj == null) return obj;
        for (var index = 1; index < length; index++) {
          var source = arguments[index],
              keys = keysFunc(source),
              l = keys.length;
          for (var i = 0; i < l; i++) {
            var key = keys[i];
            if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
          }
        }
        return obj;
      };
    };

    // An internal function for creating a new object that inherits from another.
    var baseCreate = function(prototype) {
      if (!_.isObject(prototype)) return {};
      if (nativeCreate) return nativeCreate(prototype);
      Ctor.prototype = prototype;
      var result = new Ctor;
      Ctor.prototype = null;
      return result;
    };

    var property = function(key) {
      return function(obj) {
        return obj == null ? void 0 : obj[key];
      };
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
    var getLength = property('length');
    var isArrayLike = function(collection) {
      var length = getLength(collection);
      return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // Collection Functions
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    _.each = _.forEach = function(obj, iteratee, context) {
      iteratee = optimizeCb(iteratee, context);
      var i, length;
      if (isArrayLike(obj)) {
        for (i = 0, length = obj.length; i < length; i++) {
          iteratee(obj[i], i, obj);
        }
      } else {
        var keys = _.keys(obj);
        for (i = 0, length = keys.length; i < length; i++) {
          iteratee(obj[keys[i]], keys[i], obj);
        }
      }
      return obj;
    };

    // Return the results of applying the iteratee to each element.
    _.map = _.collect = function(obj, iteratee, context) {
      iteratee = cb(iteratee, context);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          results = Array(length);
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        results[index] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
    };

    // Create a reducing function iterating left or right.
    function createReduce(dir) {
      // Optimized iterator function as using arguments.length
      // in the main function will deoptimize the, see #1991.
      function iterator(obj, iteratee, memo, keys, index, length) {
        for (; index >= 0 && index < length; index += dir) {
          var currentKey = keys ? keys[index] : index;
          memo = iteratee(memo, obj[currentKey], currentKey, obj);
        }
        return memo;
      }

      return function(obj, iteratee, memo, context) {
        iteratee = optimizeCb(iteratee, context, 4);
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length,
            index = dir > 0 ? 0 : length - 1;
        // Determine the initial value if none is provided.
        if (arguments.length < 3) {
          memo = obj[keys ? keys[index] : index];
          index += dir;
        }
        return iterator(obj, iteratee, memo, keys, index, length);
      };
    }

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    _.reduce = _.foldl = _.inject = createReduce(1);

    // The right-associative version of reduce, also known as `foldr`.
    _.reduceRight = _.foldr = createReduce(-1);

    // Return the first value which passes a truth test. Aliased as `detect`.
    _.find = _.detect = function(obj, predicate, context) {
      var key;
      if (isArrayLike(obj)) {
        key = _.findIndex(obj, predicate, context);
      } else {
        key = _.findKey(obj, predicate, context);
      }
      if (key !== void 0 && key !== -1) return obj[key];
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    _.filter = _.select = function(obj, predicate, context) {
      var results = [];
      predicate = cb(predicate, context);
      _.each(obj, function(value, index, list) {
        if (predicate(value, index, list)) results.push(value);
      });
      return results;
    };

    // Return all the elements for which a truth test fails.
    _.reject = function(obj, predicate, context) {
      return _.filter(obj, _.negate(cb(predicate)), context);
    };

    // Determine whether all of the elements match a truth test.
    // Aliased as `all`.
    _.every = _.all = function(obj, predicate, context) {
      predicate = cb(predicate, context);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        if (!predicate(obj[currentKey], currentKey, obj)) return false;
      }
      return true;
    };

    // Determine if at least one element in the object matches a truth test.
    // Aliased as `any`.
    _.some = _.any = function(obj, predicate, context) {
      predicate = cb(predicate, context);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        if (predicate(obj[currentKey], currentKey, obj)) return true;
      }
      return false;
    };

    // Determine if the array or object contains a given item (using `===`).
    // Aliased as `includes` and `include`.
    _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      if (typeof fromIndex != 'number' || guard) fromIndex = 0;
      return _.indexOf(obj, item, fromIndex) >= 0;
    };

    // Invoke a method (with arguments) on every item in a collection.
    _.invoke = function(obj, method) {
      var args = slice.call(arguments, 2);
      var isFunc = _.isFunction(method);
      return _.map(obj, function(value) {
        var func = isFunc ? method : value[method];
        return func == null ? func : func.apply(value, args);
      });
    };

    // Convenience version of a common use case of `map`: fetching a property.
    _.pluck = function(obj, key) {
      return _.map(obj, _.property(key));
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    _.where = function(obj, attrs) {
      return _.filter(obj, _.matcher(attrs));
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    _.findWhere = function(obj, attrs) {
      return _.find(obj, _.matcher(attrs));
    };

    // Return the maximum element (or element-based computation).
    _.max = function(obj, iteratee, context) {
      var result = -Infinity, lastComputed = -Infinity,
          value, computed;
      if (iteratee == null && obj != null) {
        obj = isArrayLike(obj) ? obj : _.values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value > result) {
            result = value;
          }
        }
      } else {
        iteratee = cb(iteratee, context);
        _.each(obj, function(value, index, list) {
          computed = iteratee(value, index, list);
          if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
            result = value;
            lastComputed = computed;
          }
        });
      }
      return result;
    };

    // Return the minimum element (or element-based computation).
    _.min = function(obj, iteratee, context) {
      var result = Infinity, lastComputed = Infinity,
          value, computed;
      if (iteratee == null && obj != null) {
        obj = isArrayLike(obj) ? obj : _.values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value < result) {
            result = value;
          }
        }
      } else {
        iteratee = cb(iteratee, context);
        _.each(obj, function(value, index, list) {
          computed = iteratee(value, index, list);
          if (computed < lastComputed || computed === Infinity && result === Infinity) {
            result = value;
            lastComputed = computed;
          }
        });
      }
      return result;
    };

    // Shuffle a collection, using the modern version of the
    // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    _.shuffle = function(obj) {
      var set = isArrayLike(obj) ? obj : _.values(obj);
      var length = set.length;
      var shuffled = Array(length);
      for (var index = 0, rand; index < length; index++) {
        rand = _.random(0, index);
        if (rand !== index) shuffled[index] = shuffled[rand];
        shuffled[rand] = set[index];
      }
      return shuffled;
    };

    // Sample **n** random values from a collection.
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `map`.
    _.sample = function(obj, n, guard) {
      if (n == null || guard) {
        if (!isArrayLike(obj)) obj = _.values(obj);
        return obj[_.random(obj.length - 1)];
      }
      return _.shuffle(obj).slice(0, Math.max(0, n));
    };

    // Sort the object's values by a criterion produced by an iteratee.
    _.sortBy = function(obj, iteratee, context) {
      iteratee = cb(iteratee, context);
      return _.pluck(_.map(obj, function(value, index, list) {
        return {
          value: value,
          index: index,
          criteria: iteratee(value, index, list)
        };
      }).sort(function(left, right) {
        var a = left.criteria;
        var b = right.criteria;
        if (a !== b) {
          if (a > b || a === void 0) return 1;
          if (a < b || b === void 0) return -1;
        }
        return left.index - right.index;
      }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    var group = function(behavior) {
      return function(obj, iteratee, context) {
        var result = {};
        iteratee = cb(iteratee, context);
        _.each(obj, function(value, index) {
          var key = iteratee(value, index, obj);
          behavior(result, value, key);
        });
        return result;
      };
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    _.groupBy = group(function(result, value, key) {
      if (_.has(result, key)) result[key].push(value); else result[key] = [value];
    });

    // Indexes the object's values by a criterion, similar to `groupBy`, but for
    // when you know that your index values will be unique.
    _.indexBy = group(function(result, value, key) {
      result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _.countBy = group(function(result, value, key) {
      if (_.has(result, key)) result[key]++; else result[key] = 1;
    });

    // Safely create a real, live array from anything iterable.
    _.toArray = function(obj) {
      if (!obj) return [];
      if (_.isArray(obj)) return slice.call(obj);
      if (isArrayLike(obj)) return _.map(obj, _.identity);
      return _.values(obj);
    };

    // Return the number of elements in an object.
    _.size = function(obj) {
      if (obj == null) return 0;
      return isArrayLike(obj) ? obj.length : _.keys(obj).length;
    };

    // Split a collection into two arrays: one whose elements all satisfy the given
    // predicate, and one whose elements all do not satisfy the predicate.
    _.partition = function(obj, predicate, context) {
      predicate = cb(predicate, context);
      var pass = [], fail = [];
      _.each(obj, function(value, key, obj) {
        (predicate(value, key, obj) ? pass : fail).push(value);
      });
      return [pass, fail];
    };

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    _.first = _.head = _.take = function(array, n, guard) {
      if (array == null) return void 0;
      if (n == null || guard) return array[0];
      return _.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    _.initial = function(array, n, guard) {
      return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    _.last = function(array, n, guard) {
      if (array == null) return void 0;
      if (n == null || guard) return array[array.length - 1];
      return _.rest(array, Math.max(0, array.length - n));
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array.
    _.rest = _.tail = _.drop = function(array, n, guard) {
      return slice.call(array, n == null || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    _.compact = function(array) {
      return _.filter(array, _.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    var flatten = function(input, shallow, strict, startIndex) {
      var output = [], idx = 0;
      for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
        var value = input[i];
        if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
          //flatten current level of array or arguments object
          if (!shallow) value = flatten(value, shallow, strict);
          var j = 0, len = value.length;
          output.length += len;
          while (j < len) {
            output[idx++] = value[j++];
          }
        } else if (!strict) {
          output[idx++] = value;
        }
      }
      return output;
    };

    // Flatten out an array, either recursively (by default), or just one level.
    _.flatten = function(array, shallow) {
      return flatten(array, shallow, false);
    };

    // Return a version of the array that does not contain the specified value(s).
    _.without = function(array) {
      return _.difference(array, slice.call(arguments, 1));
    };

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    _.uniq = _.unique = function(array, isSorted, iteratee, context) {
      if (!_.isBoolean(isSorted)) {
        context = iteratee;
        iteratee = isSorted;
        isSorted = false;
      }
      if (iteratee != null) iteratee = cb(iteratee, context);
      var result = [];
      var seen = [];
      for (var i = 0, length = getLength(array); i < length; i++) {
        var value = array[i],
            computed = iteratee ? iteratee(value, i, array) : value;
        if (isSorted) {
          if (!i || seen !== computed) result.push(value);
          seen = computed;
        } else if (iteratee) {
          if (!_.contains(seen, computed)) {
            seen.push(computed);
            result.push(value);
          }
        } else if (!_.contains(result, value)) {
          result.push(value);
        }
      }
      return result;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _.union = function() {
      return _.uniq(flatten(arguments, true, true));
    };

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    _.intersection = function(array) {
      var result = [];
      var argsLength = arguments.length;
      for (var i = 0, length = getLength(array); i < length; i++) {
        var item = array[i];
        if (_.contains(result, item)) continue;
        for (var j = 1; j < argsLength; j++) {
          if (!_.contains(arguments[j], item)) break;
        }
        if (j === argsLength) result.push(item);
      }
      return result;
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    _.difference = function(array) {
      var rest = flatten(arguments, true, true, 1);
      return _.filter(array, function(value){
        return !_.contains(rest, value);
      });
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    _.zip = function() {
      return _.unzip(arguments);
    };

    // Complement of _.zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices
    _.unzip = function(array) {
      var length = array && _.max(array, getLength).length || 0;
      var result = Array(length);

      for (var index = 0; index < length; index++) {
        result[index] = _.pluck(array, index);
      }
      return result;
    };

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    _.object = function(list, values) {
      var result = {};
      for (var i = 0, length = getLength(list); i < length; i++) {
        if (values) {
          result[list[i]] = values[i];
        } else {
          result[list[i][0]] = list[i][1];
        }
      }
      return result;
    };

    // Generator function to create the findIndex and findLastIndex functions
    function createPredicateIndexFinder(dir) {
      return function(array, predicate, context) {
        predicate = cb(predicate, context);
        var length = getLength(array);
        var index = dir > 0 ? 0 : length - 1;
        for (; index >= 0 && index < length; index += dir) {
          if (predicate(array[index], index, array)) return index;
        }
        return -1;
      };
    }

    // Returns the first index on an array-like that passes a predicate test
    _.findIndex = createPredicateIndexFinder(1);
    _.findLastIndex = createPredicateIndexFinder(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    _.sortedIndex = function(array, obj, iteratee, context) {
      iteratee = cb(iteratee, context, 1);
      var value = iteratee(obj);
      var low = 0, high = getLength(array);
      while (low < high) {
        var mid = Math.floor((low + high) / 2);
        if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
      }
      return low;
    };

    // Generator function to create the indexOf and lastIndexOf functions
    function createIndexFinder(dir, predicateFind, sortedIndex) {
      return function(array, item, idx) {
        var i = 0, length = getLength(array);
        if (typeof idx == 'number') {
          if (dir > 0) {
              i = idx >= 0 ? idx : Math.max(idx + length, i);
          } else {
              length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
          }
        } else if (sortedIndex && idx && length) {
          idx = sortedIndex(array, item);
          return array[idx] === item ? idx : -1;
        }
        if (item !== item) {
          idx = predicateFind(slice.call(array, i, length), _.isNaN);
          return idx >= 0 ? idx + i : -1;
        }
        for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
          if (array[idx] === item) return idx;
        }
        return -1;
      };
    }

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
    _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    _.range = function(start, stop, step) {
      if (stop == null) {
        stop = start || 0;
        start = 0;
      }
      step = step || 1;

      var length = Math.max(Math.ceil((stop - start) / step), 0);
      var range = Array(length);

      for (var idx = 0; idx < length; idx++, start += step) {
        range[idx] = start;
      }

      return range;
    };

    // Function (ahem) Functions
    // ------------------

    // Determines whether to execute a function as a constructor
    // or a normal function with the provided arguments
    var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
      if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
      var self = baseCreate(sourceFunc.prototype);
      var result = sourceFunc.apply(self, args);
      if (_.isObject(result)) return result;
      return self;
    };

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function(func, context) {
      if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
      if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
      var args = slice.call(arguments, 2);
      var bound = function() {
        return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
      };
      return bound;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder, allowing any combination of arguments to be pre-filled.
    _.partial = function(func) {
      var boundArgs = slice.call(arguments, 1);
      var bound = function() {
        var position = 0, length = boundArgs.length;
        var args = Array(length);
        for (var i = 0; i < length; i++) {
          args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
        }
        while (position < arguments.length) args.push(arguments[position++]);
        return executeBound(func, bound, this, this, args);
      };
      return bound;
    };

    // Bind a number of an object's methods to that object. Remaining arguments
    // are the method names to be bound. Useful for ensuring that all callbacks
    // defined on an object belong to it.
    _.bindAll = function(obj) {
      var i, length = arguments.length, key;
      if (length <= 1) throw new Error('bindAll must be passed function names');
      for (i = 1; i < length; i++) {
        key = arguments[i];
        obj[key] = _.bind(obj[key], obj);
      }
      return obj;
    };

    // Memoize an expensive function by storing its results.
    _.memoize = function(func, hasher) {
      var memoize = function(key) {
        var cache = memoize.cache;
        var address = '' + (hasher ? hasher.apply(this, arguments) : key);
        if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
        return cache[address];
      };
      memoize.cache = {};
      return memoize;
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    _.delay = function(func, wait) {
      var args = slice.call(arguments, 2);
      return setTimeout(function(){
        return func.apply(null, args);
      }, wait);
    };

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    _.defer = _.partial(_.delay, _, 1);

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time. Normally, the throttled function will run
    // as much as it can, without ever going more than once per `wait` duration;
    // but if you'd like to disable the execution on the leading edge, pass
    // `{leading: false}`. To disable execution on the trailing edge, ditto.
    _.throttle = function(func, wait, options) {
      var context, args, result;
      var timeout = null;
      var previous = 0;
      if (!options) options = {};
      var later = function() {
        previous = options.leading === false ? 0 : _.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      };
      return function() {
        var now = _.now();
        if (!previous && options.leading === false) previous = now;
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          previous = now;
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        } else if (!timeout && options.trailing !== false) {
          timeout = setTimeout(later, remaining);
        }
        return result;
      };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    _.debounce = function(func, wait, immediate) {
      var timeout, args, context, timestamp, result;

      var later = function() {
        var last = _.now() - timestamp;

        if (last < wait && last >= 0) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) {
            result = func.apply(context, args);
            if (!timeout) context = args = null;
          }
        }
      };

      return function() {
        context = this;
        args = arguments;
        timestamp = _.now();
        var callNow = immediate && !timeout;
        if (!timeout) timeout = setTimeout(later, wait);
        if (callNow) {
          result = func.apply(context, args);
          context = args = null;
        }

        return result;
      };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    _.wrap = function(func, wrapper) {
      return _.partial(wrapper, func);
    };

    // Returns a negated version of the passed-in predicate.
    _.negate = function(predicate) {
      return function() {
        return !predicate.apply(this, arguments);
      };
    };

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    _.compose = function() {
      var args = arguments;
      var start = args.length - 1;
      return function() {
        var i = start;
        var result = args[start].apply(this, arguments);
        while (i--) result = args[i].call(this, result);
        return result;
      };
    };

    // Returns a function that will only be executed on and after the Nth call.
    _.after = function(times, func) {
      return function() {
        if (--times < 1) {
          return func.apply(this, arguments);
        }
      };
    };

    // Returns a function that will only be executed up to (but not including) the Nth call.
    _.before = function(times, func) {
      var memo;
      return function() {
        if (--times > 0) {
          memo = func.apply(this, arguments);
        }
        if (times <= 1) func = null;
        return memo;
      };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _.once = _.partial(_.before, 2);

    // Object Functions
    // ----------------

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

    function collectNonEnumProps(obj, keys) {
      var nonEnumIdx = nonEnumerableProps.length;
      var constructor = obj.constructor;
      var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

      // Constructor is a special case.
      var prop = 'constructor';
      if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

      while (nonEnumIdx--) {
        prop = nonEnumerableProps[nonEnumIdx];
        if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
          keys.push(prop);
        }
      }
    }

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _.keys = function(obj) {
      if (!_.isObject(obj)) return [];
      if (nativeKeys) return nativeKeys(obj);
      var keys = [];
      for (var key in obj) if (_.has(obj, key)) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug) collectNonEnumProps(obj, keys);
      return keys;
    };

    // Retrieve all the property names of an object.
    _.allKeys = function(obj) {
      if (!_.isObject(obj)) return [];
      var keys = [];
      for (var key in obj) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug) collectNonEnumProps(obj, keys);
      return keys;
    };

    // Retrieve the values of an object's properties.
    _.values = function(obj) {
      var keys = _.keys(obj);
      var length = keys.length;
      var values = Array(length);
      for (var i = 0; i < length; i++) {
        values[i] = obj[keys[i]];
      }
      return values;
    };

    // Returns the results of applying the iteratee to each element of the object
    // In contrast to _.map it returns an object
    _.mapObject = function(obj, iteratee, context) {
      iteratee = cb(iteratee, context);
      var keys =  _.keys(obj),
            length = keys.length,
            results = {},
            currentKey;
        for (var index = 0; index < length; index++) {
          currentKey = keys[index];
          results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Convert an object into a list of `[key, value]` pairs.
    _.pairs = function(obj) {
      var keys = _.keys(obj);
      var length = keys.length;
      var pairs = Array(length);
      for (var i = 0; i < length; i++) {
        pairs[i] = [keys[i], obj[keys[i]]];
      }
      return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    _.invert = function(obj) {
      var result = {};
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        result[obj[keys[i]]] = keys[i];
      }
      return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    _.functions = _.methods = function(obj) {
      var names = [];
      for (var key in obj) {
        if (_.isFunction(obj[key])) names.push(key);
      }
      return names.sort();
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = createAssigner(_.allKeys);

    // Assigns a given object with all the own properties in the passed-in object(s)
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    _.extendOwn = _.assign = createAssigner(_.keys);

    // Returns the first key on an object that passes a predicate test
    _.findKey = function(obj, predicate, context) {
      predicate = cb(predicate, context);
      var keys = _.keys(obj), key;
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (predicate(obj[key], key, obj)) return key;
      }
    };

    // Return a copy of the object only containing the whitelisted properties.
    _.pick = function(object, oiteratee, context) {
      var result = {}, obj = object, iteratee, keys;
      if (obj == null) return result;
      if (_.isFunction(oiteratee)) {
        keys = _.allKeys(obj);
        iteratee = optimizeCb(oiteratee, context);
      } else {
        keys = flatten(arguments, false, false, 1);
        iteratee = function(value, key, obj) { return key in obj; };
        obj = Object(obj);
      }
      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
      return result;
    };

     // Return a copy of the object without the blacklisted properties.
    _.omit = function(obj, iteratee, context) {
      if (_.isFunction(iteratee)) {
        iteratee = _.negate(iteratee);
      } else {
        var keys = _.map(flatten(arguments, false, false, 1), String);
        iteratee = function(value, key) {
          return !_.contains(keys, key);
        };
      }
      return _.pick(obj, iteratee, context);
    };

    // Fill in a given object with default properties.
    _.defaults = createAssigner(_.allKeys, true);

    // Creates an object that inherits from the given prototype object.
    // If additional properties are provided then they will be added to the
    // created object.
    _.create = function(prototype, props) {
      var result = baseCreate(prototype);
      if (props) _.extendOwn(result, props);
      return result;
    };

    // Create a (shallow-cloned) duplicate of an object.
    _.clone = function(obj) {
      if (!_.isObject(obj)) return obj;
      return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    _.tap = function(obj, interceptor) {
      interceptor(obj);
      return obj;
    };

    // Returns whether an object has a given set of `key:value` pairs.
    _.isMatch = function(object, attrs) {
      var keys = _.keys(attrs), length = keys.length;
      if (object == null) return !length;
      var obj = Object(object);
      for (var i = 0; i < length; i++) {
        var key = keys[i];
        if (attrs[key] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };


    // Internal recursive comparison function for `isEqual`.
    var eq = function(a, b, aStack, bStack) {
      // Identical objects are equal. `0 === -0`, but they aren't identical.
      // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
      if (a === b) return a !== 0 || 1 / a === 1 / b;
      // A strict comparison is necessary because `null == undefined`.
      if (a == null || b == null) return a === b;
      // Unwrap any wrapped objects.
      if (a instanceof _) a = a._wrapped;
      if (b instanceof _) b = b._wrapped;
      // Compare `[[Class]]` names.
      var className = toString.call(a);
      if (className !== toString.call(b)) return false;
      switch (className) {
        // Strings, numbers, regular expressions, dates, and booleans are compared by value.
        case '[object RegExp]':
        // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
        case '[object String]':
          // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
          // equivalent to `new String("5")`.
          return '' + a === '' + b;
        case '[object Number]':
          // `NaN`s are equivalent, but non-reflexive.
          // Object(NaN) is equivalent to NaN
          if (+a !== +a) return +b !== +b;
          // An `egal` comparison is performed for other numeric values.
          return +a === 0 ? 1 / +a === 1 / b : +a === +b;
        case '[object Date]':
        case '[object Boolean]':
          // Coerce dates and booleans to numeric primitive values. Dates are compared by their
          // millisecond representations. Note that invalid dates with millisecond representations
          // of `NaN` are not equivalent.
          return +a === +b;
      }

      var areArrays = className === '[object Array]';
      if (!areArrays) {
        if (typeof a != 'object' || typeof b != 'object') return false;

        // Objects with different constructors are not equivalent, but `Object`s or `Array`s
        // from different frames are.
        var aCtor = a.constructor, bCtor = b.constructor;
        if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                                 _.isFunction(bCtor) && bCtor instanceof bCtor)
                            && ('constructor' in a && 'constructor' in b)) {
          return false;
        }
      }
      // Assume equality for cyclic structures. The algorithm for detecting cyclic
      // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

      // Initializing stack of traversed objects.
      // It's done here since we only need them for objects and arrays comparison.
      aStack = aStack || [];
      bStack = bStack || [];
      var length = aStack.length;
      while (length--) {
        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        if (aStack[length] === a) return bStack[length] === b;
      }

      // Add the first object to the stack of traversed objects.
      aStack.push(a);
      bStack.push(b);

      // Recursively compare objects and arrays.
      if (areArrays) {
        // Compare array lengths to determine if a deep comparison is necessary.
        length = a.length;
        if (length !== b.length) return false;
        // Deep compare the contents, ignoring non-numeric properties.
        while (length--) {
          if (!eq(a[length], b[length], aStack, bStack)) return false;
        }
      } else {
        // Deep compare objects.
        var keys = _.keys(a), key;
        length = keys.length;
        // Ensure that both objects contain the same number of properties before comparing deep equality.
        if (_.keys(b).length !== length) return false;
        while (length--) {
          // Deep compare each member
          key = keys[length];
          if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
        }
      }
      // Remove the first object from the stack of traversed objects.
      aStack.pop();
      bStack.pop();
      return true;
    };

    // Perform a deep comparison to check if two objects are equal.
    _.isEqual = function(a, b) {
      return eq(a, b);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _.isEmpty = function(obj) {
      if (obj == null) return true;
      if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
      return _.keys(obj).length === 0;
    };

    // Is a given value a DOM element?
    _.isElement = function(obj) {
      return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = nativeIsArray || function(obj) {
      return toString.call(obj) === '[object Array]';
    };

    // Is a given variable an object?
    _.isObject = function(obj) {
      var type = typeof obj;
      return type === 'function' || type === 'object' && !!obj;
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
    _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
      _['is' + name] = function(obj) {
        return toString.call(obj) === '[object ' + name + ']';
      };
    });

    // Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    if (!_.isArguments(arguments)) {
      _.isArguments = function(obj) {
        return _.has(obj, 'callee');
      };
    }

    // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
    // IE 11 (#1621), and in Safari 8 (#1929).
    if (typeof /./ != 'function' && typeof Int8Array != 'object') {
      _.isFunction = function(obj) {
        return typeof obj == 'function' || false;
      };
    }

    // Is a given object a finite number?
    _.isFinite = function(obj) {
      return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    _.isNaN = function(obj) {
      return _.isNumber(obj) && obj !== +obj;
    };

    // Is a given value a boolean?
    _.isBoolean = function(obj) {
      return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
    };

    // Is a given value equal to null?
    _.isNull = function(obj) {
      return obj === null;
    };

    // Is a given variable undefined?
    _.isUndefined = function(obj) {
      return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _.has = function(obj, key) {
      return obj != null && hasOwnProperty.call(obj, key);
    };

    // Utility Functions
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    _.noConflict = function() {
      root._ = previousUnderscore;
      return this;
    };

    // Keep the identity function around for default iteratees.
    _.identity = function(value) {
      return value;
    };

    // Predicate-generating functions. Often useful outside of Underscore.
    _.constant = function(value) {
      return function() {
        return value;
      };
    };

    _.noop = function(){};

    _.property = property;

    // Generates a function for a given object that returns a given property.
    _.propertyOf = function(obj) {
      return obj == null ? function(){} : function(key) {
        return obj[key];
      };
    };

    // Returns a predicate for checking whether an object has a given set of
    // `key:value` pairs.
    _.matcher = _.matches = function(attrs) {
      attrs = _.extendOwn({}, attrs);
      return function(obj) {
        return _.isMatch(obj, attrs);
      };
    };

    // Run a function **n** times.
    _.times = function(n, iteratee, context) {
      var accum = Array(Math.max(0, n));
      iteratee = optimizeCb(iteratee, context, 1);
      for (var i = 0; i < n; i++) accum[i] = iteratee(i);
      return accum;
    };

    // Return a random integer between min and max (inclusive).
    _.random = function(min, max) {
      if (max == null) {
        max = min;
        min = 0;
      }
      return min + Math.floor(Math.random() * (max - min + 1));
    };

    // A (possibly faster) way to get the current timestamp as an integer.
    _.now = Date.now || function() {
      return new Date().getTime();
    };

     // List of HTML entities for escaping.
    var escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '`': '&#x60;'
    };
    var unescapeMap = _.invert(escapeMap);

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    var createEscaper = function(map) {
      var escaper = function(match) {
        return map[match];
      };
      // Regexes for identifying a key that needs to be escaped
      var source = '(?:' + _.keys(map).join('|') + ')';
      var testRegexp = RegExp(source);
      var replaceRegexp = RegExp(source, 'g');
      return function(string) {
        string = string == null ? '' : '' + string;
        return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
      };
    };
    _.escape = createEscaper(escapeMap);
    _.unescape = createEscaper(unescapeMap);

    // If the value of the named `property` is a function then invoke it with the
    // `object` as context; otherwise, return it.
    _.result = function(object, property, fallback) {
      var value = object == null ? void 0 : object[property];
      if (value === void 0) {
        value = fallback;
      }
      return _.isFunction(value) ? value.call(object) : value;
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter = 0;
    _.uniqueId = function(prefix) {
      var id = ++idCounter + '';
      return prefix ? prefix + id : id;
    };

    // By default, Underscore uses ERB-style template delimiters, change the
    // following template settings to use alternative delimiters.
    _.templateSettings = {
      evaluate    : /<%([\s\S]+?)%>/g,
      interpolate : /<%=([\s\S]+?)%>/g,
      escape      : /<%-([\s\S]+?)%>/g
    };

    // When customizing `templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch = /(.)^/;

    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes = {
      "'":      "'",
      '\\':     '\\',
      '\r':     'r',
      '\n':     'n',
      '\u2028': 'u2028',
      '\u2029': 'u2029'
    };

    var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

    var escapeChar = function(match) {
      return '\\' + escapes[match];
    };

    // JavaScript micro-templating, similar to John Resig's implementation.
    // Underscore templating handles arbitrary delimiters, preserves whitespace,
    // and correctly escapes quotes within interpolated code.
    // NB: `oldSettings` only exists for backwards compatibility.
    _.template = function(text, settings, oldSettings) {
      if (!settings && oldSettings) settings = oldSettings;
      settings = _.defaults({}, settings, _.templateSettings);

      // Combine delimiters into one regular expression via alternation.
      var matcher = RegExp([
        (settings.escape || noMatch).source,
        (settings.interpolate || noMatch).source,
        (settings.evaluate || noMatch).source
      ].join('|') + '|$', 'g');

      // Compile the template source, escaping string literals appropriately.
      var index = 0;
      var source = "__p+='";
      text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
        source += text.slice(index, offset).replace(escaper, escapeChar);
        index = offset + match.length;

        if (escape) {
          source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
        } else if (interpolate) {
          source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
        } else if (evaluate) {
          source += "';\n" + evaluate + "\n__p+='";
        }

        // Adobe VMs need the match returned to produce the correct offest.
        return match;
      });
      source += "';\n";

      // If a variable is not specified, place data values in local scope.
      if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

      source = "var __t,__p='',__j=Array.prototype.join," +
        "print=function(){__p+=__j.call(arguments,'');};\n" +
        source + 'return __p;\n';

      try {
        var render = new Function(settings.variable || 'obj', '_', source);
      } catch (e) {
        e.source = source;
        throw e;
      }

      var template = function(data) {
        return render.call(this, data, _);
      };

      // Provide the compiled source as a convenience for precompilation.
      var argument = settings.variable || 'obj';
      template.source = 'function(' + argument + '){\n' + source + '}';

      return template;
    };

    // Add a "chain" function. Start chaining a wrapped Underscore object.
    _.chain = function(obj) {
      var instance = _(obj);
      instance._chain = true;
      return instance;
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // Helper function to continue chaining intermediate results.
    var result = function(instance, obj) {
      return instance._chain ? _(obj).chain() : obj;
    };

    // Add your own custom functions to the Underscore object.
    _.mixin = function(obj) {
      _.each(_.functions(obj), function(name) {
        var func = _[name] = obj[name];
        _.prototype[name] = function() {
          var args = [this._wrapped];
          push.apply(args, arguments);
          return result(this, func.apply(_, args));
        };
      });
    };

    // Add all of the Underscore functions to the wrapper object.
    _.mixin(_);

    // Add all mutator Array functions to the wrapper.
    _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
      var method = ArrayProto[name];
      _.prototype[name] = function() {
        var obj = this._wrapped;
        method.apply(obj, arguments);
        if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
        return result(this, obj);
      };
    });

    // Add all accessor Array functions to the wrapper.
    _.each(['concat', 'join', 'slice'], function(name) {
      var method = ArrayProto[name];
      _.prototype[name] = function() {
        return result(this, method.apply(this._wrapped, arguments));
      };
    });

    // Extracts the result from a wrapped and chained object.
    _.prototype.value = function() {
      return this._wrapped;
    };

    // Provide unwrapping proxy for some methods used in engine operations
    // such as arithmetic and JSON stringification.
    _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

    _.prototype.toString = function() {
      return '' + this._wrapped;
    };

    // AMD registration happens at the end for compatibility with AMD loaders
    // that may not enforce next-turn semantics on modules. Even though general
    // practice for AMD registration is to be anonymous, underscore registers
    // as a named module because, like jQuery, it is a base library that is
    // popular enough to be bundled in a third party lib, but not be part of
    // an AMD load request. Those cases could generate an error when an
    // anonymous define() is called outside of a loader request.
    if (typeof define === 'function' && define.amd) {
      define('underscore', [], function() {
        return _;
      });
    }
  // }.call(this));

  /**
   * Modularized from:
   * ===========================================================================
   * Tokenizer/jQuery.Tokenizer
   * Copyright (c) 2007-2008 Ariel Flesler - aflesler(at)gmail(dot)com | http://flesler.blogspot.com
   * Dual licensed under MIT and GPL.
   * Date: 2/29/2008
   *
   * @projectDescription JS Class to generate tokens from strings.
   * http://flesler.blogspot.com/2008/03/string-tokenizer-for-javascript.html
   *
   * @author Ariel Flesler
   * @version 1.0.1
   */

  var Tokenizer = function( tokenizers, doBuild ){
    if( !(this instanceof Tokenizer ) )
      return new Tokenizer( tokenizers, onEnd, onFound );

    this.tokenizers = tokenizers.splice ? tokenizers : [tokenizers];
    if( doBuild )
      this.doBuild = doBuild;
  };

  Tokenizer.prototype = {
    parse:function( src ){
      this.src = src;
      this.ended = false;
      this.tokens = [ ];
      do this.next(); while( !this.ended );
      return this.tokens;
    },
    build:function( src, real ){
      if( src )
        this.tokens.push(
          !this.doBuild ? src :
          this.doBuild(src,real,this.tkn)
        );
    },
    next:function(){
      var self = this,
        plain;

      self.findMin();
      plain = self.src.slice(0, self.min);

      self.build( plain, false );

      self.src = self.src.slice(self.min).replace(self.tkn,function( all ){
        self.build(all, true);
        return '';
      });

      if( !self.src )
        self.ended = true;
    },
    findMin:function(){
      var self = this, i=0, tkn, idx;
      self.min = -1;
      self.tkn = '';

      while(( tkn = self.tokenizers[i++]) !== undefined ){
        idx = self.src[tkn.test?'search':'indexOf'](tkn);
        if( idx != -1 && (self.min == -1 || idx < self.min )){
          self.tkn = tkn;
          self.min = idx;
        }
      }
      if( self.min == -1 )
        self.min = self.src.length;
    }
  };

  const allTibetanCharacters = "†◌卍卐\u{f00}-\u{fda}\u{f021}-\u{f042}\u{f162}-\u{f588}";
  const allTibetanCharactersWithSpaces = `${allTibetanCharacters} `;
  const allTibetanCharactersRange = `[${allTibetanCharacters}]`;
  const allTibetanCharactersWithSpacesRange = `[${allTibetanCharactersWithSpaces}]`;
  const anythingNonTibetanRange = `[^${allTibetanCharacters}]`;
  const punctuationCharacters = "༄༅་༈།༎༑༔";
  const punctuationCharactersRange = `[${punctuationCharacters}]`;

  var tibetanRegexps = {
    tibetanGroups: new RegExp( `(${allTibetanCharactersRange}+)`, 'iug'),
    onlyTibetanWithSpaces: new RegExp(`^(${allTibetanCharactersWithSpacesRange}+)$`, 'iug'),
    onlyTibetanWithoutSpaces: new RegExp(`^(${allTibetanCharactersRange}+)$`, 'iug'),
    anythingNonTibetan: new RegExp(`(${anythingNonTibetanRange}+)`, 'iug'),
    punctuation: new RegExp(`(${punctuationCharactersRange}+)`, 'iug'),
    beginningPunctuation: new RegExp(`^(${punctuationCharactersRange}+)`, 'iug'),
    endPunctuation: new RegExp(`(${punctuationCharactersRange}+)$`, 'iug'),
    expressions: {
      allTibetanCharacters: allTibetanCharacters,
      allTibetanCharactersRange: allTibetanCharactersRange,
      anythingNonTibetanRange: anythingNonTibetanRange,
      punctuationCharacters: punctuationCharacters,
      punctuationCharactersRange: punctuationCharactersRange
    },
  };

  //     Underscore.js 1.8.3
  //     http://underscorejs.org
  //     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
  //     Underscore may be freely distributed under the MIT license.

  // (function() {

    // Baseline setup
    // --------------

    // Establish the root object, `window` in the browser, or `exports` on the server.
    // var root = this;

    // Save the previous value of the `_` variable.
    // var previousUnderscore = root._;

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto$1 = Array.prototype, ObjProto$1 = Object.prototype, FuncProto$1 = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var
      push$1             = ArrayProto$1.push,
      slice$1            = ArrayProto$1.slice,
      toString$1         = ObjProto$1.toString,
      hasOwnProperty$1   = ObjProto$1.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
      nativeIsArray$1      = Array.isArray,
      nativeKeys$1         = Object.keys,
      nativeBind$1         = FuncProto$1.bind,
      nativeCreate$1       = Object.create;

    // Naked function reference for surrogate-prototype-swapping.
    var Ctor$1 = function(){};

    // Create a safe reference to the Underscore object for use below.
    var _$1 = function(obj) {
      if (obj instanceof _$1) return obj;
      if (!(this instanceof _$1)) return new _$1(obj);
      this._wrapped = obj;
    };

    // Current version.
    _$1.VERSION = '1.8.3';

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    var optimizeCb$1 = function(func, context, argCount) {
      if (context === void 0) return func;
      switch (argCount == null ? 3 : argCount) {
        case 1: return function(value) {
          return func.call(context, value);
        };
        case 2: return function(value, other) {
          return func.call(context, value, other);
        };
        case 3: return function(value, index, collection) {
          return func.call(context, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(context, accumulator, value, index, collection);
        };
      }
      return function() {
        return func.apply(context, arguments);
      };
    };

    // A mostly-internal function to generate callbacks that can be applied
    // to each element in a collection, returning the desired result — either
    // identity, an arbitrary callback, a property matcher, or a property accessor.
    var cb$1 = function(value, context, argCount) {
      if (value == null) return _$1.identity;
      if (_$1.isFunction(value)) return optimizeCb$1(value, context, argCount);
      if (_$1.isObject(value)) return _$1.matcher(value);
      return _$1.property(value);
    };
    _$1.iteratee = function(value, context) {
      return cb$1(value, context, Infinity);
    };

    // An internal function for creating assigner functions.
    var createAssigner$1 = function(keysFunc, undefinedOnly) {
      return function(obj) {
        var length = arguments.length;
        if (length < 2 || obj == null) return obj;
        for (var index = 1; index < length; index++) {
          var source = arguments[index],
              keys = keysFunc(source),
              l = keys.length;
          for (var i = 0; i < l; i++) {
            var key = keys[i];
            if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
          }
        }
        return obj;
      };
    };

    // An internal function for creating a new object that inherits from another.
    var baseCreate$1 = function(prototype) {
      if (!_$1.isObject(prototype)) return {};
      if (nativeCreate$1) return nativeCreate$1(prototype);
      Ctor$1.prototype = prototype;
      var result = new Ctor$1;
      Ctor$1.prototype = null;
      return result;
    };

    var property$1 = function(key) {
      return function(obj) {
        return obj == null ? void 0 : obj[key];
      };
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var MAX_ARRAY_INDEX$1 = Math.pow(2, 53) - 1;
    var getLength$1 = property$1('length');
    var isArrayLike$1 = function(collection) {
      var length = getLength$1(collection);
      return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX$1;
    };

    // Collection Functions
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    _$1.each = _$1.forEach = function(obj, iteratee, context) {
      iteratee = optimizeCb$1(iteratee, context);
      var i, length;
      if (isArrayLike$1(obj)) {
        for (i = 0, length = obj.length; i < length; i++) {
          iteratee(obj[i], i, obj);
        }
      } else {
        var keys = _$1.keys(obj);
        for (i = 0, length = keys.length; i < length; i++) {
          iteratee(obj[keys[i]], keys[i], obj);
        }
      }
      return obj;
    };

    // Return the results of applying the iteratee to each element.
    _$1.map = _$1.collect = function(obj, iteratee, context) {
      iteratee = cb$1(iteratee, context);
      var keys = !isArrayLike$1(obj) && _$1.keys(obj),
          length = (keys || obj).length,
          results = Array(length);
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        results[index] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
    };

    // Create a reducing function iterating left or right.
    function createReduce$1(dir) {
      // Optimized iterator function as using arguments.length
      // in the main function will deoptimize the, see #1991.
      function iterator(obj, iteratee, memo, keys, index, length) {
        for (; index >= 0 && index < length; index += dir) {
          var currentKey = keys ? keys[index] : index;
          memo = iteratee(memo, obj[currentKey], currentKey, obj);
        }
        return memo;
      }

      return function(obj, iteratee, memo, context) {
        iteratee = optimizeCb$1(iteratee, context, 4);
        var keys = !isArrayLike$1(obj) && _$1.keys(obj),
            length = (keys || obj).length,
            index = dir > 0 ? 0 : length - 1;
        // Determine the initial value if none is provided.
        if (arguments.length < 3) {
          memo = obj[keys ? keys[index] : index];
          index += dir;
        }
        return iterator(obj, iteratee, memo, keys, index, length);
      };
    }

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    _$1.reduce = _$1.foldl = _$1.inject = createReduce$1(1);

    // The right-associative version of reduce, also known as `foldr`.
    _$1.reduceRight = _$1.foldr = createReduce$1(-1);

    // Return the first value which passes a truth test. Aliased as `detect`.
    _$1.find = _$1.detect = function(obj, predicate, context) {
      var key;
      if (isArrayLike$1(obj)) {
        key = _$1.findIndex(obj, predicate, context);
      } else {
        key = _$1.findKey(obj, predicate, context);
      }
      if (key !== void 0 && key !== -1) return obj[key];
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    _$1.filter = _$1.select = function(obj, predicate, context) {
      var results = [];
      predicate = cb$1(predicate, context);
      _$1.each(obj, function(value, index, list) {
        if (predicate(value, index, list)) results.push(value);
      });
      return results;
    };

    // Return all the elements for which a truth test fails.
    _$1.reject = function(obj, predicate, context) {
      return _$1.filter(obj, _$1.negate(cb$1(predicate)), context);
    };

    // Determine whether all of the elements match a truth test.
    // Aliased as `all`.
    _$1.every = _$1.all = function(obj, predicate, context) {
      predicate = cb$1(predicate, context);
      var keys = !isArrayLike$1(obj) && _$1.keys(obj),
          length = (keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        if (!predicate(obj[currentKey], currentKey, obj)) return false;
      }
      return true;
    };

    // Determine if at least one element in the object matches a truth test.
    // Aliased as `any`.
    _$1.some = _$1.any = function(obj, predicate, context) {
      predicate = cb$1(predicate, context);
      var keys = !isArrayLike$1(obj) && _$1.keys(obj),
          length = (keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        if (predicate(obj[currentKey], currentKey, obj)) return true;
      }
      return false;
    };

    // Determine if the array or object contains a given item (using `===`).
    // Aliased as `includes` and `include`.
    _$1.contains = _$1.includes = _$1.include = function(obj, item, fromIndex, guard) {
      if (!isArrayLike$1(obj)) obj = _$1.values(obj);
      if (typeof fromIndex != 'number' || guard) fromIndex = 0;
      return _$1.indexOf(obj, item, fromIndex) >= 0;
    };

    // Invoke a method (with arguments) on every item in a collection.
    _$1.invoke = function(obj, method) {
      var args = slice$1.call(arguments, 2);
      var isFunc = _$1.isFunction(method);
      return _$1.map(obj, function(value) {
        var func = isFunc ? method : value[method];
        return func == null ? func : func.apply(value, args);
      });
    };

    // Convenience version of a common use case of `map`: fetching a property.
    _$1.pluck = function(obj, key) {
      return _$1.map(obj, _$1.property(key));
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    _$1.where = function(obj, attrs) {
      return _$1.filter(obj, _$1.matcher(attrs));
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    _$1.findWhere = function(obj, attrs) {
      return _$1.find(obj, _$1.matcher(attrs));
    };

    // Return the maximum element (or element-based computation).
    _$1.max = function(obj, iteratee, context) {
      var result = -Infinity, lastComputed = -Infinity,
          value, computed;
      if (iteratee == null && obj != null) {
        obj = isArrayLike$1(obj) ? obj : _$1.values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value > result) {
            result = value;
          }
        }
      } else {
        iteratee = cb$1(iteratee, context);
        _$1.each(obj, function(value, index, list) {
          computed = iteratee(value, index, list);
          if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
            result = value;
            lastComputed = computed;
          }
        });
      }
      return result;
    };

    // Return the minimum element (or element-based computation).
    _$1.min = function(obj, iteratee, context) {
      var result = Infinity, lastComputed = Infinity,
          value, computed;
      if (iteratee == null && obj != null) {
        obj = isArrayLike$1(obj) ? obj : _$1.values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value < result) {
            result = value;
          }
        }
      } else {
        iteratee = cb$1(iteratee, context);
        _$1.each(obj, function(value, index, list) {
          computed = iteratee(value, index, list);
          if (computed < lastComputed || computed === Infinity && result === Infinity) {
            result = value;
            lastComputed = computed;
          }
        });
      }
      return result;
    };

    // Shuffle a collection, using the modern version of the
    // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    _$1.shuffle = function(obj) {
      var set = isArrayLike$1(obj) ? obj : _$1.values(obj);
      var length = set.length;
      var shuffled = Array(length);
      for (var index = 0, rand; index < length; index++) {
        rand = _$1.random(0, index);
        if (rand !== index) shuffled[index] = shuffled[rand];
        shuffled[rand] = set[index];
      }
      return shuffled;
    };

    // Sample **n** random values from a collection.
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `map`.
    _$1.sample = function(obj, n, guard) {
      if (n == null || guard) {
        if (!isArrayLike$1(obj)) obj = _$1.values(obj);
        return obj[_$1.random(obj.length - 1)];
      }
      return _$1.shuffle(obj).slice(0, Math.max(0, n));
    };

    // Sort the object's values by a criterion produced by an iteratee.
    _$1.sortBy = function(obj, iteratee, context) {
      iteratee = cb$1(iteratee, context);
      return _$1.pluck(_$1.map(obj, function(value, index, list) {
        return {
          value: value,
          index: index,
          criteria: iteratee(value, index, list)
        };
      }).sort(function(left, right) {
        var a = left.criteria;
        var b = right.criteria;
        if (a !== b) {
          if (a > b || a === void 0) return 1;
          if (a < b || b === void 0) return -1;
        }
        return left.index - right.index;
      }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    var group$1 = function(behavior) {
      return function(obj, iteratee, context) {
        var result = {};
        iteratee = cb$1(iteratee, context);
        _$1.each(obj, function(value, index) {
          var key = iteratee(value, index, obj);
          behavior(result, value, key);
        });
        return result;
      };
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    _$1.groupBy = group$1(function(result, value, key) {
      if (_$1.has(result, key)) result[key].push(value); else result[key] = [value];
    });

    // Indexes the object's values by a criterion, similar to `groupBy`, but for
    // when you know that your index values will be unique.
    _$1.indexBy = group$1(function(result, value, key) {
      result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _$1.countBy = group$1(function(result, value, key) {
      if (_$1.has(result, key)) result[key]++; else result[key] = 1;
    });

    // Safely create a real, live array from anything iterable.
    _$1.toArray = function(obj) {
      if (!obj) return [];
      if (_$1.isArray(obj)) return slice$1.call(obj);
      if (isArrayLike$1(obj)) return _$1.map(obj, _$1.identity);
      return _$1.values(obj);
    };

    // Return the number of elements in an object.
    _$1.size = function(obj) {
      if (obj == null) return 0;
      return isArrayLike$1(obj) ? obj.length : _$1.keys(obj).length;
    };

    // Split a collection into two arrays: one whose elements all satisfy the given
    // predicate, and one whose elements all do not satisfy the predicate.
    _$1.partition = function(obj, predicate, context) {
      predicate = cb$1(predicate, context);
      var pass = [], fail = [];
      _$1.each(obj, function(value, key, obj) {
        (predicate(value, key, obj) ? pass : fail).push(value);
      });
      return [pass, fail];
    };

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    _$1.first = _$1.head = _$1.take = function(array, n, guard) {
      if (array == null) return void 0;
      if (n == null || guard) return array[0];
      return _$1.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    _$1.initial = function(array, n, guard) {
      return slice$1.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    _$1.last = function(array, n, guard) {
      if (array == null) return void 0;
      if (n == null || guard) return array[array.length - 1];
      return _$1.rest(array, Math.max(0, array.length - n));
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array.
    _$1.rest = _$1.tail = _$1.drop = function(array, n, guard) {
      return slice$1.call(array, n == null || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    _$1.compact = function(array) {
      return _$1.filter(array, _$1.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    var flatten$1 = function(input, shallow, strict, startIndex) {
      var output = [], idx = 0;
      for (var i = startIndex || 0, length = getLength$1(input); i < length; i++) {
        var value = input[i];
        if (isArrayLike$1(value) && (_$1.isArray(value) || _$1.isArguments(value))) {
          //flatten current level of array or arguments object
          if (!shallow) value = flatten$1(value, shallow, strict);
          var j = 0, len = value.length;
          output.length += len;
          while (j < len) {
            output[idx++] = value[j++];
          }
        } else if (!strict) {
          output[idx++] = value;
        }
      }
      return output;
    };

    // Flatten out an array, either recursively (by default), or just one level.
    _$1.flatten = function(array, shallow) {
      return flatten$1(array, shallow, false);
    };

    // Return a version of the array that does not contain the specified value(s).
    _$1.without = function(array) {
      return _$1.difference(array, slice$1.call(arguments, 1));
    };

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    _$1.uniq = _$1.unique = function(array, isSorted, iteratee, context) {
      if (!_$1.isBoolean(isSorted)) {
        context = iteratee;
        iteratee = isSorted;
        isSorted = false;
      }
      if (iteratee != null) iteratee = cb$1(iteratee, context);
      var result = [];
      var seen = [];
      for (var i = 0, length = getLength$1(array); i < length; i++) {
        var value = array[i],
            computed = iteratee ? iteratee(value, i, array) : value;
        if (isSorted) {
          if (!i || seen !== computed) result.push(value);
          seen = computed;
        } else if (iteratee) {
          if (!_$1.contains(seen, computed)) {
            seen.push(computed);
            result.push(value);
          }
        } else if (!_$1.contains(result, value)) {
          result.push(value);
        }
      }
      return result;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _$1.union = function() {
      return _$1.uniq(flatten$1(arguments, true, true));
    };

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    _$1.intersection = function(array) {
      var result = [];
      var argsLength = arguments.length;
      for (var i = 0, length = getLength$1(array); i < length; i++) {
        var item = array[i];
        if (_$1.contains(result, item)) continue;
        for (var j = 1; j < argsLength; j++) {
          if (!_$1.contains(arguments[j], item)) break;
        }
        if (j === argsLength) result.push(item);
      }
      return result;
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    _$1.difference = function(array) {
      var rest = flatten$1(arguments, true, true, 1);
      return _$1.filter(array, function(value){
        return !_$1.contains(rest, value);
      });
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    _$1.zip = function() {
      return _$1.unzip(arguments);
    };

    // Complement of _.zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices
    _$1.unzip = function(array) {
      var length = array && _$1.max(array, getLength$1).length || 0;
      var result = Array(length);

      for (var index = 0; index < length; index++) {
        result[index] = _$1.pluck(array, index);
      }
      return result;
    };

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    _$1.object = function(list, values) {
      var result = {};
      for (var i = 0, length = getLength$1(list); i < length; i++) {
        if (values) {
          result[list[i]] = values[i];
        } else {
          result[list[i][0]] = list[i][1];
        }
      }
      return result;
    };

    // Generator function to create the findIndex and findLastIndex functions
    function createPredicateIndexFinder$1(dir) {
      return function(array, predicate, context) {
        predicate = cb$1(predicate, context);
        var length = getLength$1(array);
        var index = dir > 0 ? 0 : length - 1;
        for (; index >= 0 && index < length; index += dir) {
          if (predicate(array[index], index, array)) return index;
        }
        return -1;
      };
    }

    // Returns the first index on an array-like that passes a predicate test
    _$1.findIndex = createPredicateIndexFinder$1(1);
    _$1.findLastIndex = createPredicateIndexFinder$1(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    _$1.sortedIndex = function(array, obj, iteratee, context) {
      iteratee = cb$1(iteratee, context, 1);
      var value = iteratee(obj);
      var low = 0, high = getLength$1(array);
      while (low < high) {
        var mid = Math.floor((low + high) / 2);
        if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
      }
      return low;
    };

    // Generator function to create the indexOf and lastIndexOf functions
    function createIndexFinder$1(dir, predicateFind, sortedIndex) {
      return function(array, item, idx) {
        var i = 0, length = getLength$1(array);
        if (typeof idx == 'number') {
          if (dir > 0) {
              i = idx >= 0 ? idx : Math.max(idx + length, i);
          } else {
              length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
          }
        } else if (sortedIndex && idx && length) {
          idx = sortedIndex(array, item);
          return array[idx] === item ? idx : -1;
        }
        if (item !== item) {
          idx = predicateFind(slice$1.call(array, i, length), _$1.isNaN);
          return idx >= 0 ? idx + i : -1;
        }
        for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
          if (array[idx] === item) return idx;
        }
        return -1;
      };
    }

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _$1.indexOf = createIndexFinder$1(1, _$1.findIndex, _$1.sortedIndex);
    _$1.lastIndexOf = createIndexFinder$1(-1, _$1.findLastIndex);

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    _$1.range = function(start, stop, step) {
      if (stop == null) {
        stop = start || 0;
        start = 0;
      }
      step = step || 1;

      var length = Math.max(Math.ceil((stop - start) / step), 0);
      var range = Array(length);

      for (var idx = 0; idx < length; idx++, start += step) {
        range[idx] = start;
      }

      return range;
    };

    // Function (ahem) Functions
    // ------------------

    // Determines whether to execute a function as a constructor
    // or a normal function with the provided arguments
    var executeBound$1 = function(sourceFunc, boundFunc, context, callingContext, args) {
      if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
      var self = baseCreate$1(sourceFunc.prototype);
      var result = sourceFunc.apply(self, args);
      if (_$1.isObject(result)) return result;
      return self;
    };

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _$1.bind = function(func, context) {
      if (nativeBind$1 && func.bind === nativeBind$1) return nativeBind$1.apply(func, slice$1.call(arguments, 1));
      if (!_$1.isFunction(func)) throw new TypeError('Bind must be called on a function');
      var args = slice$1.call(arguments, 2);
      var bound = function() {
        return executeBound$1(func, bound, context, this, args.concat(slice$1.call(arguments)));
      };
      return bound;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder, allowing any combination of arguments to be pre-filled.
    _$1.partial = function(func) {
      var boundArgs = slice$1.call(arguments, 1);
      var bound = function() {
        var position = 0, length = boundArgs.length;
        var args = Array(length);
        for (var i = 0; i < length; i++) {
          args[i] = boundArgs[i] === _$1 ? arguments[position++] : boundArgs[i];
        }
        while (position < arguments.length) args.push(arguments[position++]);
        return executeBound$1(func, bound, this, this, args);
      };
      return bound;
    };

    // Bind a number of an object's methods to that object. Remaining arguments
    // are the method names to be bound. Useful for ensuring that all callbacks
    // defined on an object belong to it.
    _$1.bindAll = function(obj) {
      var i, length = arguments.length, key;
      if (length <= 1) throw new Error('bindAll must be passed function names');
      for (i = 1; i < length; i++) {
        key = arguments[i];
        obj[key] = _$1.bind(obj[key], obj);
      }
      return obj;
    };

    // Memoize an expensive function by storing its results.
    _$1.memoize = function(func, hasher) {
      var memoize = function(key) {
        var cache = memoize.cache;
        var address = '' + (hasher ? hasher.apply(this, arguments) : key);
        if (!_$1.has(cache, address)) cache[address] = func.apply(this, arguments);
        return cache[address];
      };
      memoize.cache = {};
      return memoize;
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    _$1.delay = function(func, wait) {
      var args = slice$1.call(arguments, 2);
      return setTimeout(function(){
        return func.apply(null, args);
      }, wait);
    };

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    _$1.defer = _$1.partial(_$1.delay, _$1, 1);

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time. Normally, the throttled function will run
    // as much as it can, without ever going more than once per `wait` duration;
    // but if you'd like to disable the execution on the leading edge, pass
    // `{leading: false}`. To disable execution on the trailing edge, ditto.
    _$1.throttle = function(func, wait, options) {
      var context, args, result;
      var timeout = null;
      var previous = 0;
      if (!options) options = {};
      var later = function() {
        previous = options.leading === false ? 0 : _$1.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      };
      return function() {
        var now = _$1.now();
        if (!previous && options.leading === false) previous = now;
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          previous = now;
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        } else if (!timeout && options.trailing !== false) {
          timeout = setTimeout(later, remaining);
        }
        return result;
      };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    _$1.debounce = function(func, wait, immediate) {
      var timeout, args, context, timestamp, result;

      var later = function() {
        var last = _$1.now() - timestamp;

        if (last < wait && last >= 0) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) {
            result = func.apply(context, args);
            if (!timeout) context = args = null;
          }
        }
      };

      return function() {
        context = this;
        args = arguments;
        timestamp = _$1.now();
        var callNow = immediate && !timeout;
        if (!timeout) timeout = setTimeout(later, wait);
        if (callNow) {
          result = func.apply(context, args);
          context = args = null;
        }

        return result;
      };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    _$1.wrap = function(func, wrapper) {
      return _$1.partial(wrapper, func);
    };

    // Returns a negated version of the passed-in predicate.
    _$1.negate = function(predicate) {
      return function() {
        return !predicate.apply(this, arguments);
      };
    };

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    _$1.compose = function() {
      var args = arguments;
      var start = args.length - 1;
      return function() {
        var i = start;
        var result = args[start].apply(this, arguments);
        while (i--) result = args[i].call(this, result);
        return result;
      };
    };

    // Returns a function that will only be executed on and after the Nth call.
    _$1.after = function(times, func) {
      return function() {
        if (--times < 1) {
          return func.apply(this, arguments);
        }
      };
    };

    // Returns a function that will only be executed up to (but not including) the Nth call.
    _$1.before = function(times, func) {
      var memo;
      return function() {
        if (--times > 0) {
          memo = func.apply(this, arguments);
        }
        if (times <= 1) func = null;
        return memo;
      };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _$1.once = _$1.partial(_$1.before, 2);

    // Object Functions
    // ----------------

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    var hasEnumBug$1 = !{toString: null}.propertyIsEnumerable('toString');
    var nonEnumerableProps$1 = ['valueOf', 'isPrototypeOf', 'toString',
                        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

    function collectNonEnumProps$1(obj, keys) {
      var nonEnumIdx = nonEnumerableProps$1.length;
      var constructor = obj.constructor;
      var proto = (_$1.isFunction(constructor) && constructor.prototype) || ObjProto$1;

      // Constructor is a special case.
      var prop = 'constructor';
      if (_$1.has(obj, prop) && !_$1.contains(keys, prop)) keys.push(prop);

      while (nonEnumIdx--) {
        prop = nonEnumerableProps$1[nonEnumIdx];
        if (prop in obj && obj[prop] !== proto[prop] && !_$1.contains(keys, prop)) {
          keys.push(prop);
        }
      }
    }

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _$1.keys = function(obj) {
      if (!_$1.isObject(obj)) return [];
      if (nativeKeys$1) return nativeKeys$1(obj);
      var keys = [];
      for (var key in obj) if (_$1.has(obj, key)) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug$1) collectNonEnumProps$1(obj, keys);
      return keys;
    };

    // Retrieve all the property names of an object.
    _$1.allKeys = function(obj) {
      if (!_$1.isObject(obj)) return [];
      var keys = [];
      for (var key in obj) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug$1) collectNonEnumProps$1(obj, keys);
      return keys;
    };

    // Retrieve the values of an object's properties.
    _$1.values = function(obj) {
      var keys = _$1.keys(obj);
      var length = keys.length;
      var values = Array(length);
      for (var i = 0; i < length; i++) {
        values[i] = obj[keys[i]];
      }
      return values;
    };

    // Returns the results of applying the iteratee to each element of the object
    // In contrast to _.map it returns an object
    _$1.mapObject = function(obj, iteratee, context) {
      iteratee = cb$1(iteratee, context);
      var keys =  _$1.keys(obj),
            length = keys.length,
            results = {},
            currentKey;
        for (var index = 0; index < length; index++) {
          currentKey = keys[index];
          results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Convert an object into a list of `[key, value]` pairs.
    _$1.pairs = function(obj) {
      var keys = _$1.keys(obj);
      var length = keys.length;
      var pairs = Array(length);
      for (var i = 0; i < length; i++) {
        pairs[i] = [keys[i], obj[keys[i]]];
      }
      return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    _$1.invert = function(obj) {
      var result = {};
      var keys = _$1.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        result[obj[keys[i]]] = keys[i];
      }
      return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    _$1.functions = _$1.methods = function(obj) {
      var names = [];
      for (var key in obj) {
        if (_$1.isFunction(obj[key])) names.push(key);
      }
      return names.sort();
    };

    // Extend a given object with all the properties in passed-in object(s).
    _$1.extend = createAssigner$1(_$1.allKeys);

    // Assigns a given object with all the own properties in the passed-in object(s)
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    _$1.extendOwn = _$1.assign = createAssigner$1(_$1.keys);

    // Returns the first key on an object that passes a predicate test
    _$1.findKey = function(obj, predicate, context) {
      predicate = cb$1(predicate, context);
      var keys = _$1.keys(obj), key;
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (predicate(obj[key], key, obj)) return key;
      }
    };

    // Return a copy of the object only containing the whitelisted properties.
    _$1.pick = function(object, oiteratee, context) {
      var result = {}, obj = object, iteratee, keys;
      if (obj == null) return result;
      if (_$1.isFunction(oiteratee)) {
        keys = _$1.allKeys(obj);
        iteratee = optimizeCb$1(oiteratee, context);
      } else {
        keys = flatten$1(arguments, false, false, 1);
        iteratee = function(value, key, obj) { return key in obj; };
        obj = Object(obj);
      }
      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
      return result;
    };

     // Return a copy of the object without the blacklisted properties.
    _$1.omit = function(obj, iteratee, context) {
      if (_$1.isFunction(iteratee)) {
        iteratee = _$1.negate(iteratee);
      } else {
        var keys = _$1.map(flatten$1(arguments, false, false, 1), String);
        iteratee = function(value, key) {
          return !_$1.contains(keys, key);
        };
      }
      return _$1.pick(obj, iteratee, context);
    };

    // Fill in a given object with default properties.
    _$1.defaults = createAssigner$1(_$1.allKeys, true);

    // Creates an object that inherits from the given prototype object.
    // If additional properties are provided then they will be added to the
    // created object.
    _$1.create = function(prototype, props) {
      var result = baseCreate$1(prototype);
      if (props) _$1.extendOwn(result, props);
      return result;
    };

    // Create a (shallow-cloned) duplicate of an object.
    _$1.clone = function(obj) {
      if (!_$1.isObject(obj)) return obj;
      return _$1.isArray(obj) ? obj.slice() : _$1.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    _$1.tap = function(obj, interceptor) {
      interceptor(obj);
      return obj;
    };

    // Returns whether an object has a given set of `key:value` pairs.
    _$1.isMatch = function(object, attrs) {
      var keys = _$1.keys(attrs), length = keys.length;
      if (object == null) return !length;
      var obj = Object(object);
      for (var i = 0; i < length; i++) {
        var key = keys[i];
        if (attrs[key] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };


    // Internal recursive comparison function for `isEqual`.
    var eq$1 = function(a, b, aStack, bStack) {
      // Identical objects are equal. `0 === -0`, but they aren't identical.
      // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
      if (a === b) return a !== 0 || 1 / a === 1 / b;
      // A strict comparison is necessary because `null == undefined`.
      if (a == null || b == null) return a === b;
      // Unwrap any wrapped objects.
      if (a instanceof _$1) a = a._wrapped;
      if (b instanceof _$1) b = b._wrapped;
      // Compare `[[Class]]` names.
      var className = toString$1.call(a);
      if (className !== toString$1.call(b)) return false;
      switch (className) {
        // Strings, numbers, regular expressions, dates, and booleans are compared by value.
        case '[object RegExp]':
        // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
        case '[object String]':
          // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
          // equivalent to `new String("5")`.
          return '' + a === '' + b;
        case '[object Number]':
          // `NaN`s are equivalent, but non-reflexive.
          // Object(NaN) is equivalent to NaN
          if (+a !== +a) return +b !== +b;
          // An `egal` comparison is performed for other numeric values.
          return +a === 0 ? 1 / +a === 1 / b : +a === +b;
        case '[object Date]':
        case '[object Boolean]':
          // Coerce dates and booleans to numeric primitive values. Dates are compared by their
          // millisecond representations. Note that invalid dates with millisecond representations
          // of `NaN` are not equivalent.
          return +a === +b;
      }

      var areArrays = className === '[object Array]';
      if (!areArrays) {
        if (typeof a != 'object' || typeof b != 'object') return false;

        // Objects with different constructors are not equivalent, but `Object`s or `Array`s
        // from different frames are.
        var aCtor = a.constructor, bCtor = b.constructor;
        if (aCtor !== bCtor && !(_$1.isFunction(aCtor) && aCtor instanceof aCtor &&
                                 _$1.isFunction(bCtor) && bCtor instanceof bCtor)
                            && ('constructor' in a && 'constructor' in b)) {
          return false;
        }
      }
      // Assume equality for cyclic structures. The algorithm for detecting cyclic
      // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

      // Initializing stack of traversed objects.
      // It's done here since we only need them for objects and arrays comparison.
      aStack = aStack || [];
      bStack = bStack || [];
      var length = aStack.length;
      while (length--) {
        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        if (aStack[length] === a) return bStack[length] === b;
      }

      // Add the first object to the stack of traversed objects.
      aStack.push(a);
      bStack.push(b);

      // Recursively compare objects and arrays.
      if (areArrays) {
        // Compare array lengths to determine if a deep comparison is necessary.
        length = a.length;
        if (length !== b.length) return false;
        // Deep compare the contents, ignoring non-numeric properties.
        while (length--) {
          if (!eq$1(a[length], b[length], aStack, bStack)) return false;
        }
      } else {
        // Deep compare objects.
        var keys = _$1.keys(a), key;
        length = keys.length;
        // Ensure that both objects contain the same number of properties before comparing deep equality.
        if (_$1.keys(b).length !== length) return false;
        while (length--) {
          // Deep compare each member
          key = keys[length];
          if (!(_$1.has(b, key) && eq$1(a[key], b[key], aStack, bStack))) return false;
        }
      }
      // Remove the first object from the stack of traversed objects.
      aStack.pop();
      bStack.pop();
      return true;
    };

    // Perform a deep comparison to check if two objects are equal.
    _$1.isEqual = function(a, b) {
      return eq$1(a, b);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _$1.isEmpty = function(obj) {
      if (obj == null) return true;
      if (isArrayLike$1(obj) && (_$1.isArray(obj) || _$1.isString(obj) || _$1.isArguments(obj))) return obj.length === 0;
      return _$1.keys(obj).length === 0;
    };

    // Is a given value a DOM element?
    _$1.isElement = function(obj) {
      return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _$1.isArray = nativeIsArray$1 || function(obj) {
      return toString$1.call(obj) === '[object Array]';
    };

    // Is a given variable an object?
    _$1.isObject = function(obj) {
      var type = typeof obj;
      return type === 'function' || type === 'object' && !!obj;
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
    _$1.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
      _$1['is' + name] = function(obj) {
        return toString$1.call(obj) === '[object ' + name + ']';
      };
    });

    // Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    if (!_$1.isArguments(arguments)) {
      _$1.isArguments = function(obj) {
        return _$1.has(obj, 'callee');
      };
    }

    // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
    // IE 11 (#1621), and in Safari 8 (#1929).
    if (typeof /./ != 'function' && typeof Int8Array != 'object') {
      _$1.isFunction = function(obj) {
        return typeof obj == 'function' || false;
      };
    }

    // Is a given object a finite number?
    _$1.isFinite = function(obj) {
      return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    _$1.isNaN = function(obj) {
      return _$1.isNumber(obj) && obj !== +obj;
    };

    // Is a given value a boolean?
    _$1.isBoolean = function(obj) {
      return obj === true || obj === false || toString$1.call(obj) === '[object Boolean]';
    };

    // Is a given value equal to null?
    _$1.isNull = function(obj) {
      return obj === null;
    };

    // Is a given variable undefined?
    _$1.isUndefined = function(obj) {
      return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _$1.has = function(obj, key) {
      return obj != null && hasOwnProperty$1.call(obj, key);
    };

    // Utility Functions
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    _$1.noConflict = function() {
      root._ = previousUnderscore;
      return this;
    };

    // Keep the identity function around for default iteratees.
    _$1.identity = function(value) {
      return value;
    };

    // Predicate-generating functions. Often useful outside of Underscore.
    _$1.constant = function(value) {
      return function() {
        return value;
      };
    };

    _$1.noop = function(){};

    _$1.property = property$1;

    // Generates a function for a given object that returns a given property.
    _$1.propertyOf = function(obj) {
      return obj == null ? function(){} : function(key) {
        return obj[key];
      };
    };

    // Returns a predicate for checking whether an object has a given set of
    // `key:value` pairs.
    _$1.matcher = _$1.matches = function(attrs) {
      attrs = _$1.extendOwn({}, attrs);
      return function(obj) {
        return _$1.isMatch(obj, attrs);
      };
    };

    // Run a function **n** times.
    _$1.times = function(n, iteratee, context) {
      var accum = Array(Math.max(0, n));
      iteratee = optimizeCb$1(iteratee, context, 1);
      for (var i = 0; i < n; i++) accum[i] = iteratee(i);
      return accum;
    };

    // Return a random integer between min and max (inclusive).
    _$1.random = function(min, max) {
      if (max == null) {
        max = min;
        min = 0;
      }
      return min + Math.floor(Math.random() * (max - min + 1));
    };

    // A (possibly faster) way to get the current timestamp as an integer.
    _$1.now = Date.now || function() {
      return new Date().getTime();
    };

     // List of HTML entities for escaping.
    var escapeMap$1 = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '`': '&#x60;'
    };
    var unescapeMap$1 = _$1.invert(escapeMap$1);

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    var createEscaper$1 = function(map) {
      var escaper = function(match) {
        return map[match];
      };
      // Regexes for identifying a key that needs to be escaped
      var source = '(?:' + _$1.keys(map).join('|') + ')';
      var testRegexp = RegExp(source);
      var replaceRegexp = RegExp(source, 'g');
      return function(string) {
        string = string == null ? '' : '' + string;
        return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
      };
    };
    _$1.escape = createEscaper$1(escapeMap$1);
    _$1.unescape = createEscaper$1(unescapeMap$1);

    // If the value of the named `property` is a function then invoke it with the
    // `object` as context; otherwise, return it.
    _$1.result = function(object, property, fallback) {
      var value = object == null ? void 0 : object[property];
      if (value === void 0) {
        value = fallback;
      }
      return _$1.isFunction(value) ? value.call(object) : value;
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter$1 = 0;
    _$1.uniqueId = function(prefix) {
      var id = ++idCounter$1 + '';
      return prefix ? prefix + id : id;
    };

    // By default, Underscore uses ERB-style template delimiters, change the
    // following template settings to use alternative delimiters.
    _$1.templateSettings = {
      evaluate    : /<%([\s\S]+?)%>/g,
      interpolate : /<%=([\s\S]+?)%>/g,
      escape      : /<%-([\s\S]+?)%>/g
    };

    // When customizing `templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch$1 = /(.)^/;

    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes$1 = {
      "'":      "'",
      '\\':     '\\',
      '\r':     'r',
      '\n':     'n',
      '\u2028': 'u2028',
      '\u2029': 'u2029'
    };

    var escaper$1 = /\\|'|\r|\n|\u2028|\u2029/g;

    var escapeChar$1 = function(match) {
      return '\\' + escapes$1[match];
    };

    // JavaScript micro-templating, similar to John Resig's implementation.
    // Underscore templating handles arbitrary delimiters, preserves whitespace,
    // and correctly escapes quotes within interpolated code.
    // NB: `oldSettings` only exists for backwards compatibility.
    _$1.template = function(text, settings, oldSettings) {
      if (!settings && oldSettings) settings = oldSettings;
      settings = _$1.defaults({}, settings, _$1.templateSettings);

      // Combine delimiters into one regular expression via alternation.
      var matcher = RegExp([
        (settings.escape || noMatch$1).source,
        (settings.interpolate || noMatch$1).source,
        (settings.evaluate || noMatch$1).source
      ].join('|') + '|$', 'g');

      // Compile the template source, escaping string literals appropriately.
      var index = 0;
      var source = "__p+='";
      text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
        source += text.slice(index, offset).replace(escaper$1, escapeChar$1);
        index = offset + match.length;

        if (escape) {
          source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
        } else if (interpolate) {
          source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
        } else if (evaluate) {
          source += "';\n" + evaluate + "\n__p+='";
        }

        // Adobe VMs need the match returned to produce the correct offest.
        return match;
      });
      source += "';\n";

      // If a variable is not specified, place data values in local scope.
      if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

      source = "var __t,__p='',__j=Array.prototype.join," +
        "print=function(){__p+=__j.call(arguments,'');};\n" +
        source + 'return __p;\n';

      try {
        var render = new Function(settings.variable || 'obj', '_', source);
      } catch (e) {
        e.source = source;
        throw e;
      }

      var template = function(data) {
        return render.call(this, data, _$1);
      };

      // Provide the compiled source as a convenience for precompilation.
      var argument = settings.variable || 'obj';
      template.source = 'function(' + argument + '){\n' + source + '}';

      return template;
    };

    // Add a "chain" function. Start chaining a wrapped Underscore object.
    _$1.chain = function(obj) {
      var instance = _$1(obj);
      instance._chain = true;
      return instance;
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // Helper function to continue chaining intermediate results.
    var result$1 = function(instance, obj) {
      return instance._chain ? _$1(obj).chain() : obj;
    };

    // Add your own custom functions to the Underscore object.
    _$1.mixin = function(obj) {
      _$1.each(_$1.functions(obj), function(name) {
        var func = _$1[name] = obj[name];
        _$1.prototype[name] = function() {
          var args = [this._wrapped];
          push$1.apply(args, arguments);
          return result$1(this, func.apply(_$1, args));
        };
      });
    };

    // Add all of the Underscore functions to the wrapper object.
    _$1.mixin(_$1);

    // Add all mutator Array functions to the wrapper.
    _$1.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
      var method = ArrayProto$1[name];
      _$1.prototype[name] = function() {
        var obj = this._wrapped;
        method.apply(obj, arguments);
        if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
        return result$1(this, obj);
      };
    });

    // Add all accessor Array functions to the wrapper.
    _$1.each(['concat', 'join', 'slice'], function(name) {
      var method = ArrayProto$1[name];
      _$1.prototype[name] = function() {
        return result$1(this, method.apply(this._wrapped, arguments));
      };
    });

    // Extracts the result from a wrapped and chained object.
    _$1.prototype.value = function() {
      return this._wrapped;
    };

    // Provide unwrapping proxy for some methods used in engine operations
    // such as arithmetic and JSON stringification.
    _$1.prototype.valueOf = _$1.prototype.toJSON = _$1.prototype.value;

    _$1.prototype.toString = function() {
      return '' + this._wrapped;
    };

    // AMD registration happens at the end for compatibility with AMD loaders
    // that may not enforce next-turn semantics on modules. Even though general
    // practice for AMD registration is to be anonymous, underscore registers
    // as a named module because, like jQuery, it is a base library that is
    // popular enough to be bundled in a third party lib, but not be part of
    // an AMD load request. Those cases could generate an error when an
    // anonymous define() is called outside of a loader request.
    if (typeof define === 'function' && define.amd) {
      define('underscore', [], function() {
        return _$1;
      });
    }
  // }.call(this));

  /*-----------------------------------------------------------------------------
  | Each line is made of:
  |
  | - some text in single quotes  <= The internal code used by the app. Leave it.
  |                                  (Usually it is the wylie transliteration)
  |
  | - a colon                     <= If you forget any colon, the app won't work.
  |
  | - some text in single         <= How it will be converted in the end.
  |   or double quotes               If the text includes single quotes,
  |                                  then it is wrapped in double quotes.
  |
  | - a comma                     <= If you forget any comma, the app won't work.
  |
  | For instance, ཁྱེན will be converted by replacing each part one by one,
  | using these rules:
  |
  | - khaYata         => 'khy'
  | - drengbuMaNaRa   => 'e'
  | - naSuffix        => 'n'
  |
  | Resulting in 'khyen'.
  -----------------------------------------------------------------------------*/

  const baseRules = {

    // End equals start (sang-gyé, tak-ki, ...)
      // Value can be 'merge', 'dash', 'space', or 'leave'
    'endEqualsStart': 'dash',

    // End link char (as in pa-o or be-u)
    'endLinkChar': '-',

    // Vowels
    'a': 'a',                // འ
    'i': 'i',                // འི
    'o': 'o',                // འོ
    'u': 'u',                // འུ
    'ü': 'ü',                // འུས
    'ö': 'ö',                // འོས
    'drengbu': 'é',          // འེ
    'drengbuMaNaRa': 'e',    // མཁྱེན་ / drengbu and suffix ma, na, ra
    'drengbuGaBaLaNga': 'e', // འཕྲེང་ / drengbu and suffix ga, ba, la, nga
    'aNa': 'e',              // རྒྱན་  / no vowel and suffix na
    'aLa': 'e',              // རྒྱལ་  / no vowel and suffix la
    'aKikuI': "a'i",         // པའི

    // Regular consonants
    'ka': 'k',               // ཀ
    'kha': 'kh',             // ཁ
    'ga': 'k',               // ག
    'nga': 'ng',             // ང
    'ca': 'ch',              // ཅ
    'cha': "ch'",            // ཆ
    'ja': 'ch',              // ཇ
    'nya': 'ny',             // ཉ
    'ta': 't',               // ཏ
    'tha': 'th',             // ཐ
    'da': 't',               // ད
    'na': 'n',               // ན
    'pa': 'p',               // པ
    'pha': "p'",             // ཕ
    'ba': 'p',               // བ
    'ma': 'm',               // མ
    'tsa': 'ts',             // ཙ
    'tsha': "ts'",           // ཚ
    'dza': 'dz',             // ཛ
    'wa': 'w',               // ཝ
    'zha': 'zh',             // ཞ
    'za': 's',               // ཟ
    'ya': 'y',               // ཡ
    'ra': 'r',               // ར
    'la': 'l',               // ལ
    'sha': 'sh',             // ཤ
    'sa': 's',               // ས
    'ha': 'h',               // ཧ

    // Modified consonants (with prefix or superscribed)
    'gaMod': 'g',            // རྒ
    'jaMod': 'j',            // རྗ
    'daMod': 'd',            // རྡ
    'baMod': 'b',            // རྦ
    'zaMod': 'z',            // བཟའ

    // Ratas
    'rata1': 'tr',           // ཏྲ  / 1st col with rata
    'rata2': "tr'",          // ཁྲ  / 2nd col with rata
    'rata3': 'tr',           // བྲ  / 3rd col with rata
    'rata3Mod': 'dr',        // སྒྲ / 3rd col with rata and prefix/superscribed
    'hra': 'hr',             // ཧྲ

    // Yatas
    'kaYata': 'ky',          // ཀྱ
    'khaYata': 'khy',        // ཁྱ
    'gaYata': 'ky',          // གྱ
    'gaModYata': 'gy',       // སྒྱ / ga with yata and prefix/superscribed
    'paYata': 'ch',          // པྱ
    'phaYata': "ch'",        // ཕྱ
    'baYata': 'ch',          // བྱ
    'baModYata': 'j',        // སྦྱ / ba with yata and prefix/superscribed
    'daoWaYata': 'y',        // དབྱ

    // Latas
    'lata': 'l',             // གླ
    'lataDa': 'd',           // ཟླ

    // Special cases
    'lha': 'lh',             // ལྷ
    'baAsWa': 'w',           // དགའ་བ་

    // Suffixes
    'kaSuffix': 'k',         // དག
    'ngaSuffix': 'ng',       // དང
    'naSuffix': 'n',         // དན
    'baSuffix': 'p',         // དབ
    'maSuffix': 'm',         // དམ
    'raSuffix': 'r',         // དར
    'laSuffix': 'l',         // དལ

  };

  /*-----------------------------------------------------------------------------
  | Each line is made of:
  |
  | - some text in single quotes  <= The internal code used by the app. Leave it.
  |                                  (Usually it is the wylie transliteration)
  |
  | - a colon                     <= If you forget any colon, the app won't work.
  |
  | - some text in single         <= How it will be converted in the end.
  |   or double quotes               If the text includes single quotes,
  |                                  then it is wrapped in double quotes.
  |
  | - a comma                     <= If you forget any comma, the app won't work.
  |
  | For instance, ཁྱེན will be converted by replacing each part one by one,
  | using these rules:
  |
  | - khaYata         => 'khy'
  | - drengbuMaNaRa   => 'e'
  | - naSuffix        => 'n'
  |
  | Resulting in 'khyen'.
  -----------------------------------------------------------------------------*/

  const englishLoose = {

    id: 'english-loose',
    name: 'English (loose)',

    rules: {

      // Linking char (as in pa-o or pe-u)
      'endLinkChar': "'",

      // Vowels
      'aKikuI': 'é',              // པའི

      // Regular consonants
      'ga': 'g',                  // ག
      'cha': 'ch',                // ཆ
      'ba': 'p',                  // བ
      'tsha': 'ts',               // ཚ
      'ja': 'j',                  // ཇ
      'da': 'd',                  // ད
      'pha': 'p',                 // ཕ
      'ba': 'b',                  // བ
      'zha': 'sh',                // ཞ

      // Ratas
      'rata2': 'tr',              // ཁྲ  // 2nd column with rata
      'rata3': 'dr',              // བྲ  // 3rd column with rata

      // Yatas
      'gaYata': 'gy',             // གྱ
      'phaYata': 'ch',            // ཕྱ
      'baYata': 'ch',             // བྱ

    },

    exceptions: {

    }

  };

  /*-----------------------------------------------------------------------------
  | Each line is made of:
  |
  | - some text in single quotes  <= The internal code used by the app. Leave it.
  |                                  (Usually it is the wylie transliteration)
  |
  | - a colon                     <= If you forget any colon, the app won't work.
  |
  | - some text in single         <= How it will be converted in the end.
  |   or double quotes               If the text includes single quotes,
  |                                  then it is wrapped in double quotes.
  |
  | - a comma                     <= If you forget any comma, the app won't work.
  |
  | For instance, ཁྱེན will be converted by replacing each part one by one,
  | using these rules:
  |
  | - khaYata         => 'khy'
  | - drengbuMaNaRa   => 'e'
  | - naSuffix        => 'n'
  |
  | Resulting in 'khyen'.
  -----------------------------------------------------------------------------*/

  const englishSemiStrict = {

    id: 'english-semi-strict',
    name: 'English (semi-strict)',

    rules: {

      // Vowels
      'aKikuI': 'é',           // པའི

      // Regular consonants
      'cha': 'ch',             // ཆ
      'tsha': 'ts',            // ཚ

      // Yatas
      'phaYata': 'ch',         // ཕྱ
      'baYata': 'ch',          // བྱ

    },

    exceptions: {

    }

  };

  /*-----------------------------------------------------------------------------
  | Each line is made of:
  |
  | - some text in single quotes  <= The internal code used by the app. Leave it.
  |                                  (Usually it is the wylie transliteration)
  |
  | - a colon                     <= If you forget any colon, the app won't work.
  |
  | - some text in single         <= How it will be converted in the end.
  |   or double quotes               If the text includes single quotes,
  |                                  then it is wrapped in double quotes.
  |
  | - a comma                     <= If you forget any comma, the app won't work.
  |
  | For instance, ཁྱེན will be converted by replacing each part one by one,
  | using these rules:
  |
  | - khaYata         => 'khy'
  | - drengbuMaNaRa   => 'e'
  | - naSuffix        => 'n'
  |
  | Resulting in 'khyen'.
  -----------------------------------------------------------------------------*/

  const englishStrict = {

    id: 'english-strict',
    name: 'English (strict)',

    rules: {

    },

    exceptions: {

    }

  };

  /*-----------------------------------------------------------------------------
  | Each line is made of:
  |
  | - some text in single quotes  <= The internal code used by the app. Leave it.
  |                                  (Usually it is the wylie transliteration)
  |
  | - a colon                     <= If you forget any colon, the app won't work.
  |
  | - some text in single         <= How it will be converted in the end.
  |   or double quotes               If the text includes single quotes,
  |                                  then it is wrapped in double quotes.
  |
  | - a comma                     <= If you forget any comma, the app won't work.
  |
  | For instance, ཁྱེན will be converted by replacing each part one by one,
  | using these rules:
  |
  | - khaYata         => 'khy'
  | - drengbuMaNaRa   => 'e'
  | - naSuffix        => 'n'
  |
  | Resulting in 'khyen'.
  -----------------------------------------------------------------------------*/

  const french = {

    id: 'french',
    name: 'French',

    rules: {

      'doubleS': true,

      // Vowels
      'u': 'ou',               // འུ
      'ü': 'u',                // འུས
      'ö': 'eu',               // འོས
      'aKikuI': 'é',           // པའི

      // Regular consonants
      'ca': 'tch',             // ཅ
      'cha': "tch'",           // ཆ
      'ja': 'dj',              // ཇ
      'tha': "t'",             // ཐ
      'ba': 'p',               // བ
      'tsha': "ts'",           // ཚ
      'sha': 'ch',             // ཤ
      'zha': 'sh',             // ཞ

      // Modified consonants (with prefix or superscribed)
      'jaMod': 'dj',           // རྗ
      'gaMod': 'gu',           // རྒ

      // Ratas
      'rata2': "t'r",          // ཁྲ  / 2nd col with rata

      // Yatas
      'gaModYata': 'gui',      // སྒྱ / ga with yata and prefix/superscribed
      'paYata': 'tch',         // པྱ
      'phaYata': "tch'",       // ཕྱ
      'baYata': "tch'",        // བྱ
      'baModYata': 'dj',       // སྦྱ / ba with yata and prefix/superscribed

    },

    exceptions: {

    }

  };

  /*-----------------------------------------------------------------------------
  | Each line is made of:
  |
  | - some text in single quotes  <= The internal code used by the app. Leave it.
  |                                  (Usually it is the wylie transliteration)
  |
  | - a colon                     <= If you forget any colon, the app won't work.
  |
  | - some text in single         <= How it will be converted in the end.
  |   or double quotes               If the text includes single quotes,
  |                                  then it is wrapped in double quotes.
  |
  | - a comma                     <= If you forget any comma, the app won't work.
  |
  | For instance, ཁྱེན will be converted by replacing each part one by one,
  | using these rules:
  |
  | - khaYata         => 'khy'
  | - drengbuMaNaRa   => 'e'
  | - naSuffix        => 'n'
  |
  | Resulting in 'khyen'.
  -----------------------------------------------------------------------------*/

  const spanish = {

    id: 'spanish',
    name: 'Spanish',

    rules: {

      // Vowels
      'ü': 'u',                // འུས
      'ö': 'o',                // འོས
      'drengbu': 'e',          // འེ
      'aKikuI': 'e',           // འི

      // Regular consonants
      'kha': 'k',              // ཁ
      'cha': 'ch',             // ཆ
      'nya': 'ñ',              // ཉ
      'tha': 't',              // ཐ
      'pha': 'p',              // ཕ
      'ba': 'p',               // བ
      'tsha': 'ts',            // ཚ
      'dza': 'ds',             // ཛ
      'zha': 'sh',             // ཞ

      // Modified consonants (with prefix or superscribed)
      'gaMod': 'gu',           // གཇ
      'jaMod': 'y',            // རྗ
      'zaMod': 's',            // བཟ

      // Ratas
      'rata2': 'tr',           // ཁྲ  / 2nd col with rata

      // Yatas
      'gaModYata': 'gui',      // སྒྱ / ga with yata and prefix/superscribed
      'paYata': 'ch',          // པྱ
      'phaYata': 'ch',         // ཕྱ
      'baYata': 'ch',          // བྱ
      'baModYata': 'y',        // སྦྱ / ba with yata and prefix/superscribed

    },

    exceptions: {
      'ཁ་ཊྭཾ་ག': 'kat_vam_ga'
    }

  };

  //  ka  / kha  / ga  become ka
  //  bha / cha  / ja  become cha
  //  ta  / tha  / da  become ta
  //  pa  / pha  / ba  become pa
  //  kya / khya / gya become kya
  //  sa  / za         become sa
  //  tra / dra        become tra

  const englishSuperLoose = {

    id: 'english-super-loose',
    name: 'English SuperLoose (for phonetic search)',

    rules: {

      // End equals start (sang-gyé, tak-ki, ...)
      // Value can be 'merge', 'dash', 'space', or 'leave'
      'endEqualsStart': 'merge',

      // Linking char (as in pa-o or pe-u)
      'endLinkChar': "'",

      // Vowels
      'ü': 'u',                // འུས
      'ö': 'o',                // འོས
      'drengbu': 'e',          // འེ
      'drengbuMaNaRa': 'e',    // མཁྱེན་ / drengbu and suffix ma, na, ra
      'drengbuGaBaLaNga': 'e', // འཕྲེང་ / drengbu and suffix ga, ba, la, nga
      'aNa': 'e',              // རྒྱན་  / no vowel and suffix na
      'aLa': 'e',              // རྒྱལ་  / no vowel and suffix la
      'aKikuI': "e",           // པའི

      // Regular consonants
      'kha': 'k',               // ཁ
      'tha': 't',               // ཁ
      'ga': 'k',               // ག
      'ba': 'p',               // བ
      'cha': 'ch',             // ཆ
      'tsha': 'ts',            // ཚ
      'da': 't',               // ད
      'pha': 'p',              // ཕ
      'zha': 'sh',             // ཞ
      'dza': 'ts',             // ཞ

      // Modified consonants (with prefix or superscribed)
      'gaMod': 'k',            // རྒ
      'jaMod': 'ch',           // རྗ
      'daMod': 't',            // རྡ
      'baMod': 'p',            // རྦ
      'zaMod': 's',            // བཟ

      // Ratas
      'rata1': 'tr',           // ཏྲ  / 1st col with rata
      'rata2': 'tr',           // ཁྲ  / 2nd col with rata
      'rata3': 'tr',           // བྲ  / 3rd col with rata
      'rata3Mod': 'tr',        // སྒྲ / 3rd col with rata and prefix/superscribed
      'hra': 'hr',             // ཧྲ

      // Yatas
      'kaYata': 'k',           // ཀྱ
      'khaYata': 'k',          // ཁྱ
      'gaYata': 'k',           // གྱ
      'gaModYata': 'k',        // སྒྱ / ga with yata and prefix/superscribed
      'paYata': 'ch',          // པྱ
      'phaYata': 'ch',         // ཕྱ
      'baYata': 'ch',          // བྱ
      'baModYata': 'ch',       // སྦྱ / ba with yata and prefix/superscribed
      'daoWaYata': 'y',        // དབྱ

      // Latas
      'lata': 'l',             // གླ
      'lataDa': 't',           // ཟླ

      // Special cases
      'lha': 'l',              // ལྷ
      'baAsWa': 'p'

    },

    exceptions: {

    }

  };

  var defaultSettings = [];

  defaultSettings.push(englishLoose);
  defaultSettings.push(englishSemiStrict);
  defaultSettings.push(englishStrict);
  defaultSettings.push(french);
  defaultSettings.push(spanish);
  defaultSettings.push(englishSuperLoose);

  const defaultSettingId = 'english-semi-strict';

  const defaultsMissingRulesToBaseRules = function(setting) {
    setting.isDefault = true;
    _$1(setting.rules).defaults(baseRules);
    return setting;
  };

  const defaultSettings$1 =
    defaultSettings.map((setting) => defaultsMissingRulesToBaseRules(setting));

  const Settings = {
    defaultSettings: defaultSettings$1,
    defaultSettingId: defaultSettingId,
    settings: defaultSettings$1,
    all () {
      return this.settings;
    },
    default() {
      return this.find(this.defaultSettingId);
    },
    originalDefault() {
      return this.findOriginal(this.defaultSettingId);
    },
    find: function(settingId, options = {}) {
      if (!settingId) return;
      if (settingId.toString().match(/^\d*$/)) settingId = parseInt(settingId);
      return _$1(this.settings).findWhere({ id: settingId });
    },
    findOriginal: function(settingId, options = {}) {
      var setting = _$1(defaultSettings$1).findWhere({ id: settingId });
      return defaultsMissingRulesToBaseRules(setting);
    },
    update(settingId, name, rules, exceptions) {
      var setting = this.find(settingId);
      setting.name = name;
      setting.rules = rules;
      setting.exceptions = exceptions;
      this.updateStore();
    },
    create (fromSetting, name) {
      var id = this.maxId() + 1;
      this.settings.push({
        id: id,
        isCustom: true,
        isEditable: true,
        name: name || 'Rule set ' + id,
        rules: _$1(fromSetting && fromSetting.rules || {}).defaults(baseRules),
        exceptions: fromSetting && fromSetting.exceptions || {}
      });
      this.updateStore();
    },
    copy(setting) {
      this.create(setting, 'Copy of ' + setting.name);
    },
    import(setting) {
      this.create(setting, setting.name);
    },
    delete(setting) {
      this.settings = _$1(this.settings).without(setting);
      this.updateStore();
      Storage.get('selectedSettingId', undefined, (value) => {
        if (value == setting.id)
          Storage.set('selectedSettingId', defaultSettingId);
      });
    },
    replaceAllWith(newSettings) {
      this.settings = newSettings;
    },
    reset(callback) {
      this.settings = this.defaultSettings;
      this.updateStore(callback);
    },
    maxId () {
      return (
        this.settings
          .filter((setting) => _$1(setting.id).isNumber())
          .max('id') ||
        { id: 0 }
      ).id;
    },
    updateStore(callback) {
      Storage.set('settings', this.settings, (value) => {
        if (callback) callback(value);
      });
    },
    numberOfSpecificRules (setting) {
      return _$1(setting.rules)
        .filter((value, key) => baseRules[key] != value)
        .length;
    }
  };

  /*----------------------------------------------------------------------------
  | Each line defines one exception.
  |
  | If any of the values on the left of the colon is found in the line to be
  | converted, then it will be treated as if it was the value on the right
  | of the colon.
  |
  | Tibetan characters will be converted as they would be normally.
  | Latin characters will be inserted as-is within the transliteration.
  |
  | If using Latin characters, then between each syllable you need to add an
  | underscore to help the system determine how many syllables the word is made
  | of, even if it does not exactly match how the word is composed.
  |
  | For instance if you want to have སངས་རྒྱས་ always converted as 'sangye',
  | you would do:
  |
  | 'སངས་རྒྱས': 'san_gye'
  | but not
  | 'སངས་རྒྱས': 'sang_gye'
  |
  | If a line is defined with a left value that is included in another line with
  | a longer left value, then the longer one will be used.
  |
  | For instance if these two rules are defined:
  |
  | 'སངས': 'SAN'
  | 'སངས་རྒྱས': 'san_GYE'
  |
  | Then སངས་རྒྱས་ would be converted as sanGYE,  ignoring the first rule.
  ----------------------------------------------------------------------------*/

  const defaultGeneralExceptions = {

    // Mute suffixes
    'བདག': 'སྡ',
    'ཤོག': 'ཤོ',

    // Links between syllables
    'ཡ་མཚན': 'ཡམ་མཚན',
    'གོ་འཕང': 'གོམ་འཕང',
    'ཨོ་རྒྱན': 'ཨོར་རྒྱན',
    'རྒྱ་མཚོ': 'རྒྱམ་མཚོ',
    'མཁའ་འགྲོ': 'མཁའn_འགྲོ',
    'མཁའ་འགྲོའི': 'མཁའn_འགྲོའི',
    'མཁའ་འགྲོས': 'མཁའn_འགྲོས',
    'རྗེ་འབངས': 'རྗེམ་འབངས',
    'དགེ་འདུན': 'དགེན་འདུན',
    'འཕྲོ་འདུ': 'འཕྲོn_འདུ',
    'མི་འགྱུར': 'མིན་འགྱུར',
    'རྒྱ་མཚོའི': 'རྒྱམ་མཚོའི',
    'མཆོད་རྟེན': 'མཆོར་རྟེན',
    'སྤྲོ་བསྡུ': 'སྤྲོn_འདུ',
    'འོད་མཐའ་ཡས': 'འོན་མཐའ་ཡས',
    'རྡོ་རྗེ': 'རྡོར་རྗེ',
    'རྟ་མགྲིན': 'རྟམ་མགྲིན',
    'བཀའ་འགྱུར་': 'བཀའn་འགྱུར་',
    'ན་བཟའ་': 'ནམ་བཟའ་',
    'མ་འགགས་': 'མn་འགགས་',

    // Complicated spacing
    'ལ་གསོལ་བ་འདེབས': 'ལ་ གསོལ་བ་ འདེབས',

    // Mistakes that become so common we keep them
    'རབ་འབྱམས': 'རb_འབྱམས',

    // People and places
    'སྤྱན་རས་གཟིགས': 'སྤྱན་རས་གཟི',
    'ཚེ་དཔག་མེད': 'ཚེ་པ་མེད',

    // Sanskrit stuff
    'ༀ': 'ཨོམ ',
    'ཨཱ': 'འh ',
    'ཧཱུཾ': 'hའུང ',
    'བྷྲཱུཾ': 'bhrའུམ',
    'ཧྲཱི': 'ཧྲི ',
    'མ་ཎི': 'ma_ni',
    'རཾ་ཡཾ་ཁཾ': 'ram yam kham ',
    'ཧ་ཧོ་ཧྲཱི': 'ha ho hri ',
    'ཨ་ཨ་ཨ།': 'a a a ',
    'ཀྲི་ཡ': 'kri_ya',
    'ཨུ་པ': 'u_pa',
    'ཡོ་ག': 'yo_ga',
    'མ་ཧཱ': 'ma_ha',
    'ཨ་ནུ': 'a_nu',
    'ཨ་ཏི': 'a_ti',
    'བཾ': 'bam ',
    'ཨཾ': 'ang ',
    'ཀརྨ': 'ཀར་མ',
    'དྷུ': 'dhའུ',
    'དྷི': 'dhའི',
    'དྷ': 'dhའ',
    'བྷ': 'bh',
    'བྷ་ག': 'bhའ_རྒ',
    'བཛྲ': 'va_jra',
    'ཏནྟྲ': 'tan_tra',
    'སིདྡྷི': 'sid_dhi',
    'ཛྙཱ': 'རྒྱ',
    'པདྨ': 'པd_མ',
    'པདྨོ': 'པd_མོ',
    'པདྨེ': 'པd_མེ',
    'པཎྜི': 'པn_སྡི',
    'པཎྜིཏ': 'པn_སྡི_ཏ',
    'བཾ་རོ': 'བམ་རོ',
    'ཤྲཱི': 'ཤི་རི',
    'གུ་རུ': 'gའུ་རུ',
    'ཨུཏྤལ': 'ཨུt_པལ',
    'ཏདྱཐཱ': 'tའd_ཡ_ཏ',
    'སྭསྟི': 'svའ_stའི',
    'སྭ་སྟི': 'svའ_stའི',
    'ཝཱ་རཱ་ཧཱི': 'ཝ_ར_ཧི',
    'ཁ་ཊྭཾ་ག': 'ཀ_ཏང_ཀ',
    'ཨེ་མ་ཧོ': 'ཨེ_མ_ཧོ',
    'གུ་རུ': 'སྒུ་རུ',
    'སམྦྷ་ཝར': 'སམ_bhའ_ཝར',
    'དིཔྟ་ཙཀྲ': 'dའི_ptའ tsའk_trའ',
    'ཀྲོསྡ': 'krའོ_dhའ',
    'ༀ་ཨ་ར་པ་ཙ་ན་སྡིཿསྡིཿསྡིཿ': 'ༀ ཨ ར པ ཙ ན རྡི རྡི རྡི',
    'སརྦ': 'sའr_wའ',
    'བྷུ': 'bhའུ',
    'ས་པ་རི་ཝཱ་ར': 'ས་པ་རི་ཝ་ར',
    'ས་མ་ཡ': 'ས་མ་ཡ',
    'ས་མ་ཡ་ཛཿ': 'ས་མ་ཡ ཛ',
    'འལ་འོལ': 'འལ_-འོལ',
    'ཏིཥྛ་ལྷན༔': 'tish_tha lhan',
    'ཨ་ཏི་པཱུ་ཧོཿ': 'a_ti_pའུ ho',
    'པྲ་ཏཱིཙྪ་ཧོཿ': 'pra_ti_tsa ho',
    'ཨརྒྷཾ': 'ar_gham',
    'པཱ་དྱཾ': 'pa_dyam',
    'པུཥྤེ': 'pའུsh_པེ',
    'དྷཱུ་པེ': 'dhའུ_པེ',
    'ཨཱ་ལོ་ཀེ': 'a_lo_ཀེ',
    'གནྡྷེ': 'gan_dhཨེ',
    'ནཻ་ཝི་དྱ': 'nai_win_dyའེ',
    'ནཻ་ཝི་ཏྱ': 'nai_win_dyའེ',
    'ཤཔྡ': 'sha_pta',
    'པྲ་ཏཱིཙྪ་': 'pra_ti_tsa ',
    'པྲ་ཏཱིཙྪ་ཡེ': 'pra_ti_tsa_yའེ',
    'སྭཱ་ཧཱ': 'sva_ha',
    'སྭཱཧཱ': 'sva_ha',
    'དྷརྨ': 'dhar_ma',
    'དྷརྨཱ': 'dhar_ma',
    'དྷརྨ་པཱ་ལ': 'dhar_ma_pa_la',
    'དྷརྨཱ་པཱ་ལ': 'dhar_ma_pa_la',
    'ཨི་དཾ': 'i_dam',
    'བ་ལིངྟ': 'ba_ling_ta',
    'བ་ལིཾ་ཏ': 'ba_ling_ta',
    'པཉྩ': 'pañ_tsa',
    'ཨ་མྲྀ་ཏ': 'am_ri_ta',
    'ཨམྲྀ་ཏ': 'am_ri_ta',
    'ཀུཎྜ་ལཱི': 'kའུn_da_li',
    'རཀྟ': 'rak_ta',
    'པཱུ་ཛ': 'pའུ_ja',
    'ཁ་ཁ་ཁཱ་ཧི་ཁཱ་ཧི': 'kha kha kha_hi kha_hi',
    'མཎྜལ': 'man_da_la',
    'མཎྜ་ལ': 'man_da_la',
    'ཤྲཱི': 'shi_ri',
    'དྷེ་ཝ': 'dé_wa',
    'ཤཱནྟ': 'shen_ta',
    'ཀྲོ་དྷ': 'kro_dha',
    'དྷ་ཀ': 'སྡ_ཀ',
    'དྷཱ་ཀི་ནཱི': 'སྡ_ཀི_ནི',
    'ཌཱཀྐི་ནི': 'སྡ_ཀི_ནི',
    'ཌཱ་ཀི་ནཱི་': 'སྡ_ཀི_ནི',
    'དྷཱ་ཀི': 'སྡ_ཀི',
    'ཌཱ་ཀི': 'སྡ_ཀི',
    'ཌཱཀྐི': 'སྡ_ཀི',
    'འོག་མིན': 'འོ་མིན',
    'བ་སུ་དེ་ཝ': 'wa_sའུ dé_wa',
    'ནཱི་དྷི་པ་ཏི': 'ni_dhi_pa_ti',
    'བྷཱུ་མི་པ་ཏི': 'bhའུ_mi_pa_ti',
    'མ་ཧཱ་ཀཱ་ལ': 'ma_ha_ka_la',
    'མ་ཧཱ་ཀཱ་ལཱ': 'ma_ha_ka_la_ya',
    'ཏ་ཐཱ་ག་ཏ': 'ta_tha_ga_ta',
    'བྷྱོ': 'ba_yo',
    'བི་ཤྭ': 'bi_shའུ',
    'མུ་ཁེ་བྷྱ': 'mའུ_ké_bé',
    'ཨུདྒཏེ': 'འུt_ga_té',
    'སྥར': 'sa_par',
    'སྥ་ར་ཎ': 'ས_པ_ར_ན',
    'ག་ག་ན་ཁཾ': 'སྒ_སྒ_ན ཁམ',
    'ཏིཥྛ': 'tish_tha',
    'ཏིཥྛནྟུ': 'tish_then_tའུ',
    'ཀཱ་ཝཱ་ཙི': 'ཀ ཝ ཙི',
    'ཝཱཀ': 'ཝ_ཀ',
    'ཙིཏྟ': 'ཆི_tཏ',
    'རཀྵ': 'རk_ཤ',
    'བོ་དྷི': 'སྦོ_དྷི',
    'པཱཀྵ': 'པཱk_ཤ',
    'པུཎྱཻ་': 'པུ_ཉེ',
    'སྭ་བྷཱ་ཝ': 'so_bha_wa',
    'ཤུདྡྷྭ': 'shའུd_do',
    'ཤུདྡྷོ': 'shའུd_do',
    'ཤུདྡྷོ྅ཧཾ': 'shའུd_do hang',
    'ཀ་མ་ལཱ་ཡེ': 'ka_ma_la yé',
    'སྟྭཾ': 'tam',
    'རཏྣ': 'rat_na',
    'ཨཱརྻ': 'a_rya',
    'ཨཱརྻཱ': 'a_rya',
    'ཨཱརྱ': 'a_rya',
    'ཨཱརྱཱ': 'a_rya',
    'པདྨཱནྟ': 'pad_man_ta',
    'ཀྲྀཏ': 'krit ',
    'ཧྱ་གྲཱྀ་ཝ': 'ha_ya gri_wa',
    'བིགྷྣཱན': 'bi_gha_nen',
    'ཧ་ན་ཧ་ན་': 'hana hana',
    'ཕཊ྄': 'phet',
    'ཕཊ': 'phet',
    'མཉྫུ་གྷོ་ཥ': 'man_ju_go_sha',
    'དྷརྨཱ་ཎཾ': 'dhar_ma nam',
    'ཨ་ཀཱ་རོ': 'a_ka_ro',
    'ཨཱདྱ་ནུཏྤནྣ': 'adi anütpena',
    'ཏོཏྟ': 'to_ta',
    'ཏུཏྟཱ': 'tut_ta',
    'ཏུཏྟཱ་ར': 'tut_ta_ra',
    'རསྟུ': 'ར_sཏུ',
    'བཻ་ཌཱུརྻ': 'ben_du_rya',
    'སེངྒེ': 'སེང་སྒེ',
  };

  var tibetanNormalizer = {

    normalize (text) {
      var normalized = this.normalizeCombinedLetters(text);
      normalized = this.normalizeTsheks(normalized);
      return normalized;
    },

    normalizeTsheks (text) {
      return text
        .replace(/(ཾ)([ཱཱཱེིོིྀུུ])/g, '$2$1') // Malformed: anusvara before vowel
        .replace(/༌/g, '་') // Alternative tshek
        .replace(/་+/g, '་'); // Multiple consecutive tsheks into one
    },

    normalizeCombinedLetters (text) {
      return text
        .replace(/ༀ/g, 'ཨོཾ')
        .replace(/ཀྵ/g, 'ཀྵ')
        .replace(/བྷ/g, 'བྷ')
        .replace(/ཱུ/g, 'ཱུ')
        .replace(/ཱི/g, 'ཱི')
        .replace(/ཱྀ/g, 'ཱྀ')
        .replace(/དྷ/g, 'དྷ')
        .replace(/གྷ/g, 'གྷ')
        .replace(/ཪླ/g, 'རླ')
        .replace(/ྡྷ/g, 'ྡྷ')
        .replace(//g, '࿓༅')
        .replace(//g, 'སྤྲ')
        .replace(//g, 'ུ')
        .replace(//g, 'ག')
        .replace(//g, 'ུ')
        .replace(//g, 'རྒྱ')
        .replace(//g, 'གྲ')
        .replace(//g, 'ུ')
        .replace(//g, 'ི')
        .replace(//g, 'བྱ')
        .replace(//g, 'སྲ')
        .replace(//g, 'སྒྲ')
        .replace(//g, 'ལྷ')
        .replace(//g, 'ོ')
        .replace(//g, 'གྱ')
        .replace(//g, 'རླ')
        .replace(//g, 'ཕྱ')
        .replace(//g, 'སྩ')
        .replace(//g, 'རྡ')
        .replace(//g, 'རྗ')
        .replace(//g, 'དྲྭ')
        .replace(//g, 'ཛྲ')
    }

  };

  const removeMuteCharsAndNormalize = function (tibetan) {
    var normalized = tibetanNormalizer.normalize(tibetan);
    return normalized
      .replace(/[༵\u0F04-\u0F0A\u0F0D-\u0F1F\u0F3A-\u0F3F\u0FBE-\uF269]/g, '').trim()
      .replace(/[༔ཿ]/g, '་')
      .replace(/[ྃྂ]/g, 'ཾ')
      .replace(/་$/g, '');
  };

  // Copied from Sugar

  String.prototype.first = function(num) {
    if (num == undefined) num = 1;
    return this.substr(0, num);
  };

  String.prototype.last = function(num) {
    if (num == undefined) num = 1;
    var start = this.length - num < 0 ? 0 : this.length - num;
    return this.substr(start);
  };

  String.prototype.capitalize = function(all) {
    var lastResponded;
    return this.toLowerCase().replace(all ? /[^']/g : /^\S/, function(lower) {
      var upper = lower.toUpperCase(), result;
      result = lastResponded ? lower : upper;
      lastResponded = upper !== lower;
      return result;
    });
  };

  String.prototype.to = function(num) {
    if(num == undefined) num = this.length;
    return this.slice(0, num);
  };

  String.prototype.pad = function(num, padding) {
    var half, front, back;
    num   = checkRepeatRange(num);
    half  = Math.max(0, num - this.length) / 2;
    front = Math.floor(half);
    back  = Math.ceil(half);
    return padString(front, padding) + this + padString(back, padding);
  };

  function checkRepeatRange(num) {
    num = +num;
    if(num < 0 || num === Infinity) {
      throw new RangeError('Invalid number');
    }
    return num;
  }

  function padString(num, padding) {
    return repeatString(padding !== undefined ? padding : ' ', num);
  }

  function repeatString(str, num) {
    var result = '', str = str.toString();
    while (num > 0) {
      if (num & 1) {
        result += str;
      }
      if (num >>= 1) {
        str += str;
      }
    }
    return result;
  }

  var t;

  const normalize = function (exceptions) {
    return _$1(exceptions).inject((hash, value, key) => {
      if (key.trim().length) {
        var normalizedKey = removeMuteCharsAndNormalize(key);
        var normalizedValue = removeMuteCharsAndNormalize(value);
        if (normalizedKey != normalizedValue)
          hash[normalizedKey] = value;
      }
      return hash;
    }, {});
  };

  var generalExceptions = normalize(defaultGeneralExceptions);

  var Exceptions = function(setting, converter, rulesUsed, exceptionsUsed) {
    t = (key, track = true) => {
      var value = setting.rules[key];
      if (track)
        rulesUsed[key] = value;
      return value;
    };
    return {
      setting: setting,
      converter: converter,
      exceptionsUsed: exceptionsUsed,
      generalExceptions: generalExceptions,
      exceptions:
        _$1(_$1.clone(setting.exceptions)).defaults(generalExceptions),
      find (tibetan) {
        var exception;
        var phonetics;
        var spaceAfter = false;
        var modifiers = ['འོ', 'འི', 'ས', 'ར'];
        var modifier = undefined;
        var i = 0;
        while (!exception && i < modifiers.length) {
          var tibetanWithModifier = tibetan.match(new RegExp(`(.*)${modifiers[i]}$`));
          if (tibetanWithModifier) {
            var tibetanWithoutModifier = tibetanWithModifier[1];
            exception = this.tryException(tibetanWithoutModifier);
            if (exception)
              modifier = modifiers[i];
          }
          i++;
        }
        if (!exception)
          exception = this.tryException(tibetan);
        if (exception) {
          if (modifier) {
            if (modifier.match(/(འི|ས)/)) {
              if (exception.last() == 'a')
                exception = exception.to(-1) + t('drengbu');
              else if (exception.last() == 'o')
                exception = exception.to(-1) + t('ö');
              else if (exception.last() == 'u')
                exception = exception.to(-1) + t('ü');
              else if (!exception.last().match(/[ieéè]/))
                exception += modifier;
            } else if (modifier == 'ར') {
              if (exception.last().match(/[eéè]/))
                exception = exception.to(-1) + 'er';
              else if (exception.last().match(/[aiou]/))
                exception += 'r';
              else
                exception += modifier;
            } else if (modifier == 'འོ') {
                exception = exception + t('endLinkChar') + t('o');
            } else
              exception += modifier;
          }
          phonetics = this.convertTibetanParts(exception);
          phonetics = this.removeDuplicateEndingLetters(phonetics);
          spaceAfter = phonetics.last() == ' ';
          var numberOfSyllables = 1;
          var tsheks = tibetan.match(/་/g);
          var syllableMarkers = phonetics.trim().match(/[_ ]/g);
          if (syllableMarkers) numberOfSyllables = syllableMarkers.length + 1;
          return {
            spaceAfter: spaceAfter,
            numberOfSyllables: numberOfSyllables,
            numberOfShifts: tsheks ? tsheks.length : 0,
            converted: phonetics.trim().replace(/_/g, '')
          }
        }
      },
      tryException (key) {
        var exception = this.exceptions[key];
        if (exception) {
          this.exceptionsUsed[key] = exception;
          return exception;
        }
      },
      removeDuplicateEndingLetters (text) {
        return text.replace(/(.?)\1*$/, '$1');
      },
      convertTibetanParts (text) {
        var nonTibetanChars = new RegExp(/[\-\_\' a-zA-ZⒶＡÀÁÂẦẤẪẨÃĀĂẰẮẴẲȦǠÄǞẢÅǺǍȀȂẠẬẶḀĄȺⱯBⒷＢḂḄḆɃƂƁCⒸＣĆĈĊČÇḈƇȻꜾDⒹＤḊĎḌḐḒḎĐƋƊƉꝹEⒺＥÈÉÊỀẾỄỂẼĒḔḖĔĖËẺĚȄȆẸỆȨḜĘḘḚƐƎFⒻＦḞƑꝻGⒼＧǴĜḠĞĠǦĢǤƓꞠꝽꝾHⒽＨĤḢḦȞḤḨḪĦⱧⱵꞍIⒾＩÌÍÎĨĪĬİÏḮỈǏȈȊỊĮḬƗJⒿＪĴɈKⓀＫḰǨḲĶḴƘⱩꝀꝂꝄꞢLⓁＬĿĹĽḶḸĻḼḺŁȽⱢⱠꝈꝆꞀMⓂＭḾṀṂⱮƜNⓃＮǸŃÑṄŇṆŅṊṈȠƝꞐꞤOⓄＯÒÓÔỒỐỖỔÕṌȬṎŌṐṒŎȮȰÖȪỎŐǑȌȎƠỜỚỠỞỢỌỘǪǬØǾƆƟꝊꝌPⓅＰṔṖƤⱣꝐꝒꝔQⓆＱꝖꝘɊRⓇＲŔṘŘȐȒṚṜŖṞɌⱤꝚꞦꞂSⓈＳẞŚṤŜṠŠṦṢṨȘŞⱾꞨꞄTⓉＴṪŤṬȚŢṰṮŦƬƮȾꞆUⓊＵÙÚÛŨṸŪṺŬÜǛǗǕǙỦŮŰǓȔȖƯỪỨỮỬỰỤṲŲṶṴɄVⓋＶṼṾƲꝞɅWⓌＷẀẂŴẆẄẈⱲXⓍＸẊẌYⓎＹỲÝŶỸȲẎŸỶỴƳɎỾZⓏＺŹẐŻŽẒẔƵȤⱿⱫꝢaⓐａẚàáâầấẫẩãāăằắẵẳȧǡäǟảåǻǎȁȃạậặḁąⱥɐbⓑｂḃḅḇƀƃɓcⓒｃćĉċčçḉƈȼꜿↄdⓓｄḋďḍḑḓḏđƌɖɗꝺeⓔｅèéêềếễểẽēḕḗĕėëẻěȅȇẹệȩḝęḙḛɇɛǝfⓕｆḟƒꝼgⓖｇǵĝḡğġǧģǥɠꞡᵹꝿhⓗｈĥḣḧȟḥḩḫẖħⱨⱶɥiⓘｉìíîĩīĭïḯỉǐȉȋịįḭɨıjⓙｊĵǰɉkⓚｋḱǩḳķḵƙⱪꝁꝃꝅꞣlⓛｌŀĺľḷḹļḽḻſłƚɫⱡꝉꞁꝇmⓜｍḿṁṃɱɯnⓝｎǹńñṅňṇņṋṉƞɲŉꞑꞥoⓞｏòóôồốỗổõṍȭṏōṑṓŏȯȱöȫỏőǒȍȏơờớỡởợọộǫǭøǿɔꝋꝍɵpⓟｐṕṗƥᵽꝑꝓꝕqⓠｑɋꝗꝙrⓡｒŕṙřȑȓṛṝŗṟɍɽꝛꞧꞃsⓢｓśṥŝṡšṧṣṩșşȿꞩꞅẛtⓣｔṫẗťṭțţṱṯŧƭʈⱦꞇuⓤｕùúûũṹūṻŭüǜǘǖǚủůűǔȕȗưừứữửựụṳųṷṵʉvⓥｖṽṿʋꝟʌwⓦｗẁẃŵẇẅẘẉⱳxⓧｘẋẍyⓨｙỳýŷỹȳẏÿỷẙỵƴɏỿzⓩｚźẑżžẓẕƶȥɀⱬꝣǼǢꜺǄǅǽǣꜻǆ]+/);
        var nonTibetanPart = text.match(nonTibetanChars);
        if (nonTibetanPart) {
          var result = this.tr(text.slice(0, nonTibetanPart.index)) + nonTibetanPart[0];
          var rest = text.slice(nonTibetanPart.index + nonTibetanPart[0].length);
          if (rest) return result + this.convertTibetanParts(rest);
          else      return result;
        } else
          return this.tr(text);
      },
      tr (word) {
        if (!word) return '';
        var tsheks = word.match(/་/);
        return (
          this.converter.convert(word).replace(/ /g, '') +
          ''.pad(tsheks ? tsheks.length : 0, '_')
        );
      }
    }
  };

  Exceptions.normalize = normalize;

  Exceptions.reinitializeFromDefaults = function() {
    Exceptions.generalExceptions = Exceptions.normalize(defaultGeneralExceptions);
  };

  Exceptions.generalExceptionsAsArray = function() {
    return _$1(Exceptions.generalExceptions).map(function(value, key) {
      return { key: key, value: value }
    });
  };

  Exceptions.updateGeneralExceptions = function(exceptions, callback) {
    var normalizedExceptions = Exceptions.normalize(exceptions);
    Exceptions.generalExceptions = normalizedExceptions;
    Storage.set('general-exceptions', normalizedExceptions, (value) => {
      if (callback) callback(value);
    });
  };

  Exceptions.resetGeneralExceptions = function(callback) {
    this.updateGeneralExceptions(defaultGeneralExceptions, callback);
  };

  //     Underscore.js 1.8.3
  //     http://underscorejs.org
  //     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
  //     Underscore may be freely distributed under the MIT license.

  // (function() {

    // Baseline setup
    // --------------

    // Establish the root object, `window` in the browser, or `exports` on the server.
    // var root = this;

    // Save the previous value of the `_` variable.
    // var previousUnderscore = root._;

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto$1$1 = Array.prototype, ObjProto$1$1 = Object.prototype, FuncProto$1$1 = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var
      push$1$1             = ArrayProto$1$1.push,
      slice$1$1            = ArrayProto$1$1.slice,
      toString$1$1         = ObjProto$1$1.toString,
      hasOwnProperty$1$1   = ObjProto$1$1.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
      nativeIsArray$1$1      = Array.isArray,
      nativeKeys$1$1         = Object.keys,
      nativeBind$1$1         = FuncProto$1$1.bind,
      nativeCreate$1$1       = Object.create;

    // Naked function reference for surrogate-prototype-swapping.
    var Ctor$1$1 = function(){};

    // Create a safe reference to the Underscore object for use below.
    var _$1$1 = function(obj) {
      if (obj instanceof _$1$1) return obj;
      if (!(this instanceof _$1$1)) return new _$1$1(obj);
      this._wrapped = obj;
    };

    // Current version.
    _$1$1.VERSION = '1.8.3';

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    var optimizeCb$1$1 = function(func, context, argCount) {
      if (context === void 0) return func;
      switch (argCount == null ? 3 : argCount) {
        case 1: return function(value) {
          return func.call(context, value);
        };
        case 2: return function(value, other) {
          return func.call(context, value, other);
        };
        case 3: return function(value, index, collection) {
          return func.call(context, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(context, accumulator, value, index, collection);
        };
      }
      return function() {
        return func.apply(context, arguments);
      };
    };

    // A mostly-internal function to generate callbacks that can be applied
    // to each element in a collection, returning the desired result — either
    // identity, an arbitrary callback, a property matcher, or a property accessor.
    var cb$1$1 = function(value, context, argCount) {
      if (value == null) return _$1$1.identity;
      if (_$1$1.isFunction(value)) return optimizeCb$1$1(value, context, argCount);
      if (_$1$1.isObject(value)) return _$1$1.matcher(value);
      return _$1$1.property(value);
    };
    _$1$1.iteratee = function(value, context) {
      return cb$1$1(value, context, Infinity);
    };

    // An internal function for creating assigner functions.
    var createAssigner$1$1 = function(keysFunc, undefinedOnly) {
      return function(obj) {
        var length = arguments.length;
        if (length < 2 || obj == null) return obj;
        for (var index = 1; index < length; index++) {
          var source = arguments[index],
              keys = keysFunc(source),
              l = keys.length;
          for (var i = 0; i < l; i++) {
            var key = keys[i];
            if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
          }
        }
        return obj;
      };
    };

    // An internal function for creating a new object that inherits from another.
    var baseCreate$1$1 = function(prototype) {
      if (!_$1$1.isObject(prototype)) return {};
      if (nativeCreate$1$1) return nativeCreate$1$1(prototype);
      Ctor$1$1.prototype = prototype;
      var result = new Ctor$1$1;
      Ctor$1$1.prototype = null;
      return result;
    };

    var property$1$1 = function(key) {
      return function(obj) {
        return obj == null ? void 0 : obj[key];
      };
    };

    // Helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object
    // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var MAX_ARRAY_INDEX$1$1 = Math.pow(2, 53) - 1;
    var getLength$1$1 = property$1$1('length');
    var isArrayLike$1$1 = function(collection) {
      var length = getLength$1$1(collection);
      return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX$1$1;
    };

    // Collection Functions
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    _$1$1.each = _$1$1.forEach = function(obj, iteratee, context) {
      iteratee = optimizeCb$1$1(iteratee, context);
      var i, length;
      if (isArrayLike$1$1(obj)) {
        for (i = 0, length = obj.length; i < length; i++) {
          iteratee(obj[i], i, obj);
        }
      } else {
        var keys = _$1$1.keys(obj);
        for (i = 0, length = keys.length; i < length; i++) {
          iteratee(obj[keys[i]], keys[i], obj);
        }
      }
      return obj;
    };

    // Return the results of applying the iteratee to each element.
    _$1$1.map = _$1$1.collect = function(obj, iteratee, context) {
      iteratee = cb$1$1(iteratee, context);
      var keys = !isArrayLike$1$1(obj) && _$1$1.keys(obj),
          length = (keys || obj).length,
          results = Array(length);
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        results[index] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
    };

    // Create a reducing function iterating left or right.
    function createReduce$1$1(dir) {
      // Optimized iterator function as using arguments.length
      // in the main function will deoptimize the, see #1991.
      function iterator(obj, iteratee, memo, keys, index, length) {
        for (; index >= 0 && index < length; index += dir) {
          var currentKey = keys ? keys[index] : index;
          memo = iteratee(memo, obj[currentKey], currentKey, obj);
        }
        return memo;
      }

      return function(obj, iteratee, memo, context) {
        iteratee = optimizeCb$1$1(iteratee, context, 4);
        var keys = !isArrayLike$1$1(obj) && _$1$1.keys(obj),
            length = (keys || obj).length,
            index = dir > 0 ? 0 : length - 1;
        // Determine the initial value if none is provided.
        if (arguments.length < 3) {
          memo = obj[keys ? keys[index] : index];
          index += dir;
        }
        return iterator(obj, iteratee, memo, keys, index, length);
      };
    }

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    _$1$1.reduce = _$1$1.foldl = _$1$1.inject = createReduce$1$1(1);

    // The right-associative version of reduce, also known as `foldr`.
    _$1$1.reduceRight = _$1$1.foldr = createReduce$1$1(-1);

    // Return the first value which passes a truth test. Aliased as `detect`.
    _$1$1.find = _$1$1.detect = function(obj, predicate, context) {
      var key;
      if (isArrayLike$1$1(obj)) {
        key = _$1$1.findIndex(obj, predicate, context);
      } else {
        key = _$1$1.findKey(obj, predicate, context);
      }
      if (key !== void 0 && key !== -1) return obj[key];
    };

    // Return all the elements that pass a truth test.
    // Aliased as `select`.
    _$1$1.filter = _$1$1.select = function(obj, predicate, context) {
      var results = [];
      predicate = cb$1$1(predicate, context);
      _$1$1.each(obj, function(value, index, list) {
        if (predicate(value, index, list)) results.push(value);
      });
      return results;
    };

    // Return all the elements for which a truth test fails.
    _$1$1.reject = function(obj, predicate, context) {
      return _$1$1.filter(obj, _$1$1.negate(cb$1$1(predicate)), context);
    };

    // Determine whether all of the elements match a truth test.
    // Aliased as `all`.
    _$1$1.every = _$1$1.all = function(obj, predicate, context) {
      predicate = cb$1$1(predicate, context);
      var keys = !isArrayLike$1$1(obj) && _$1$1.keys(obj),
          length = (keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        if (!predicate(obj[currentKey], currentKey, obj)) return false;
      }
      return true;
    };

    // Determine if at least one element in the object matches a truth test.
    // Aliased as `any`.
    _$1$1.some = _$1$1.any = function(obj, predicate, context) {
      predicate = cb$1$1(predicate, context);
      var keys = !isArrayLike$1$1(obj) && _$1$1.keys(obj),
          length = (keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = keys ? keys[index] : index;
        if (predicate(obj[currentKey], currentKey, obj)) return true;
      }
      return false;
    };

    // Determine if the array or object contains a given item (using `===`).
    // Aliased as `includes` and `include`.
    _$1$1.contains = _$1$1.includes = _$1$1.include = function(obj, item, fromIndex, guard) {
      if (!isArrayLike$1$1(obj)) obj = _$1$1.values(obj);
      if (typeof fromIndex != 'number' || guard) fromIndex = 0;
      return _$1$1.indexOf(obj, item, fromIndex) >= 0;
    };

    // Invoke a method (with arguments) on every item in a collection.
    _$1$1.invoke = function(obj, method) {
      var args = slice$1$1.call(arguments, 2);
      var isFunc = _$1$1.isFunction(method);
      return _$1$1.map(obj, function(value) {
        var func = isFunc ? method : value[method];
        return func == null ? func : func.apply(value, args);
      });
    };

    // Convenience version of a common use case of `map`: fetching a property.
    _$1$1.pluck = function(obj, key) {
      return _$1$1.map(obj, _$1$1.property(key));
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    _$1$1.where = function(obj, attrs) {
      return _$1$1.filter(obj, _$1$1.matcher(attrs));
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    _$1$1.findWhere = function(obj, attrs) {
      return _$1$1.find(obj, _$1$1.matcher(attrs));
    };

    // Return the maximum element (or element-based computation).
    _$1$1.max = function(obj, iteratee, context) {
      var result = -Infinity, lastComputed = -Infinity,
          value, computed;
      if (iteratee == null && obj != null) {
        obj = isArrayLike$1$1(obj) ? obj : _$1$1.values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value > result) {
            result = value;
          }
        }
      } else {
        iteratee = cb$1$1(iteratee, context);
        _$1$1.each(obj, function(value, index, list) {
          computed = iteratee(value, index, list);
          if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
            result = value;
            lastComputed = computed;
          }
        });
      }
      return result;
    };

    // Return the minimum element (or element-based computation).
    _$1$1.min = function(obj, iteratee, context) {
      var result = Infinity, lastComputed = Infinity,
          value, computed;
      if (iteratee == null && obj != null) {
        obj = isArrayLike$1$1(obj) ? obj : _$1$1.values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value < result) {
            result = value;
          }
        }
      } else {
        iteratee = cb$1$1(iteratee, context);
        _$1$1.each(obj, function(value, index, list) {
          computed = iteratee(value, index, list);
          if (computed < lastComputed || computed === Infinity && result === Infinity) {
            result = value;
            lastComputed = computed;
          }
        });
      }
      return result;
    };

    // Shuffle a collection, using the modern version of the
    // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    _$1$1.shuffle = function(obj) {
      var set = isArrayLike$1$1(obj) ? obj : _$1$1.values(obj);
      var length = set.length;
      var shuffled = Array(length);
      for (var index = 0, rand; index < length; index++) {
        rand = _$1$1.random(0, index);
        if (rand !== index) shuffled[index] = shuffled[rand];
        shuffled[rand] = set[index];
      }
      return shuffled;
    };

    // Sample **n** random values from a collection.
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `map`.
    _$1$1.sample = function(obj, n, guard) {
      if (n == null || guard) {
        if (!isArrayLike$1$1(obj)) obj = _$1$1.values(obj);
        return obj[_$1$1.random(obj.length - 1)];
      }
      return _$1$1.shuffle(obj).slice(0, Math.max(0, n));
    };

    // Sort the object's values by a criterion produced by an iteratee.
    _$1$1.sortBy = function(obj, iteratee, context) {
      iteratee = cb$1$1(iteratee, context);
      return _$1$1.pluck(_$1$1.map(obj, function(value, index, list) {
        return {
          value: value,
          index: index,
          criteria: iteratee(value, index, list)
        };
      }).sort(function(left, right) {
        var a = left.criteria;
        var b = right.criteria;
        if (a !== b) {
          if (a > b || a === void 0) return 1;
          if (a < b || b === void 0) return -1;
        }
        return left.index - right.index;
      }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    var group$1$1 = function(behavior) {
      return function(obj, iteratee, context) {
        var result = {};
        iteratee = cb$1$1(iteratee, context);
        _$1$1.each(obj, function(value, index) {
          var key = iteratee(value, index, obj);
          behavior(result, value, key);
        });
        return result;
      };
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    _$1$1.groupBy = group$1$1(function(result, value, key) {
      if (_$1$1.has(result, key)) result[key].push(value); else result[key] = [value];
    });

    // Indexes the object's values by a criterion, similar to `groupBy`, but for
    // when you know that your index values will be unique.
    _$1$1.indexBy = group$1$1(function(result, value, key) {
      result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _$1$1.countBy = group$1$1(function(result, value, key) {
      if (_$1$1.has(result, key)) result[key]++; else result[key] = 1;
    });

    // Safely create a real, live array from anything iterable.
    _$1$1.toArray = function(obj) {
      if (!obj) return [];
      if (_$1$1.isArray(obj)) return slice$1$1.call(obj);
      if (isArrayLike$1$1(obj)) return _$1$1.map(obj, _$1$1.identity);
      return _$1$1.values(obj);
    };

    // Return the number of elements in an object.
    _$1$1.size = function(obj) {
      if (obj == null) return 0;
      return isArrayLike$1$1(obj) ? obj.length : _$1$1.keys(obj).length;
    };

    // Split a collection into two arrays: one whose elements all satisfy the given
    // predicate, and one whose elements all do not satisfy the predicate.
    _$1$1.partition = function(obj, predicate, context) {
      predicate = cb$1$1(predicate, context);
      var pass = [], fail = [];
      _$1$1.each(obj, function(value, key, obj) {
        (predicate(value, key, obj) ? pass : fail).push(value);
      });
      return [pass, fail];
    };

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    _$1$1.first = _$1$1.head = _$1$1.take = function(array, n, guard) {
      if (array == null) return void 0;
      if (n == null || guard) return array[0];
      return _$1$1.initial(array, array.length - n);
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    _$1$1.initial = function(array, n, guard) {
      return slice$1$1.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    _$1$1.last = function(array, n, guard) {
      if (array == null) return void 0;
      if (n == null || guard) return array[array.length - 1];
      return _$1$1.rest(array, Math.max(0, array.length - n));
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array.
    _$1$1.rest = _$1$1.tail = _$1$1.drop = function(array, n, guard) {
      return slice$1$1.call(array, n == null || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    _$1$1.compact = function(array) {
      return _$1$1.filter(array, _$1$1.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    var flatten$1$1 = function(input, shallow, strict, startIndex) {
      var output = [], idx = 0;
      for (var i = startIndex || 0, length = getLength$1$1(input); i < length; i++) {
        var value = input[i];
        if (isArrayLike$1$1(value) && (_$1$1.isArray(value) || _$1$1.isArguments(value))) {
          //flatten current level of array or arguments object
          if (!shallow) value = flatten$1$1(value, shallow, strict);
          var j = 0, len = value.length;
          output.length += len;
          while (j < len) {
            output[idx++] = value[j++];
          }
        } else if (!strict) {
          output[idx++] = value;
        }
      }
      return output;
    };

    // Flatten out an array, either recursively (by default), or just one level.
    _$1$1.flatten = function(array, shallow) {
      return flatten$1$1(array, shallow, false);
    };

    // Return a version of the array that does not contain the specified value(s).
    _$1$1.without = function(array) {
      return _$1$1.difference(array, slice$1$1.call(arguments, 1));
    };

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    _$1$1.uniq = _$1$1.unique = function(array, isSorted, iteratee, context) {
      if (!_$1$1.isBoolean(isSorted)) {
        context = iteratee;
        iteratee = isSorted;
        isSorted = false;
      }
      if (iteratee != null) iteratee = cb$1$1(iteratee, context);
      var result = [];
      var seen = [];
      for (var i = 0, length = getLength$1$1(array); i < length; i++) {
        var value = array[i],
            computed = iteratee ? iteratee(value, i, array) : value;
        if (isSorted) {
          if (!i || seen !== computed) result.push(value);
          seen = computed;
        } else if (iteratee) {
          if (!_$1$1.contains(seen, computed)) {
            seen.push(computed);
            result.push(value);
          }
        } else if (!_$1$1.contains(result, value)) {
          result.push(value);
        }
      }
      return result;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _$1$1.union = function() {
      return _$1$1.uniq(flatten$1$1(arguments, true, true));
    };

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    _$1$1.intersection = function(array) {
      var result = [];
      var argsLength = arguments.length;
      for (var i = 0, length = getLength$1$1(array); i < length; i++) {
        var item = array[i];
        if (_$1$1.contains(result, item)) continue;
        for (var j = 1; j < argsLength; j++) {
          if (!_$1$1.contains(arguments[j], item)) break;
        }
        if (j === argsLength) result.push(item);
      }
      return result;
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    _$1$1.difference = function(array) {
      var rest = flatten$1$1(arguments, true, true, 1);
      return _$1$1.filter(array, function(value){
        return !_$1$1.contains(rest, value);
      });
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    _$1$1.zip = function() {
      return _$1$1.unzip(arguments);
    };

    // Complement of _.zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices
    _$1$1.unzip = function(array) {
      var length = array && _$1$1.max(array, getLength$1$1).length || 0;
      var result = Array(length);

      for (var index = 0; index < length; index++) {
        result[index] = _$1$1.pluck(array, index);
      }
      return result;
    };

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    _$1$1.object = function(list, values) {
      var result = {};
      for (var i = 0, length = getLength$1$1(list); i < length; i++) {
        if (values) {
          result[list[i]] = values[i];
        } else {
          result[list[i][0]] = list[i][1];
        }
      }
      return result;
    };

    // Generator function to create the findIndex and findLastIndex functions
    function createPredicateIndexFinder$1$1(dir) {
      return function(array, predicate, context) {
        predicate = cb$1$1(predicate, context);
        var length = getLength$1$1(array);
        var index = dir > 0 ? 0 : length - 1;
        for (; index >= 0 && index < length; index += dir) {
          if (predicate(array[index], index, array)) return index;
        }
        return -1;
      };
    }

    // Returns the first index on an array-like that passes a predicate test
    _$1$1.findIndex = createPredicateIndexFinder$1$1(1);
    _$1$1.findLastIndex = createPredicateIndexFinder$1$1(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    _$1$1.sortedIndex = function(array, obj, iteratee, context) {
      iteratee = cb$1$1(iteratee, context, 1);
      var value = iteratee(obj);
      var low = 0, high = getLength$1$1(array);
      while (low < high) {
        var mid = Math.floor((low + high) / 2);
        if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
      }
      return low;
    };

    // Generator function to create the indexOf and lastIndexOf functions
    function createIndexFinder$1$1(dir, predicateFind, sortedIndex) {
      return function(array, item, idx) {
        var i = 0, length = getLength$1$1(array);
        if (typeof idx == 'number') {
          if (dir > 0) {
              i = idx >= 0 ? idx : Math.max(idx + length, i);
          } else {
              length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
          }
        } else if (sortedIndex && idx && length) {
          idx = sortedIndex(array, item);
          return array[idx] === item ? idx : -1;
        }
        if (item !== item) {
          idx = predicateFind(slice$1$1.call(array, i, length), _$1$1.isNaN);
          return idx >= 0 ? idx + i : -1;
        }
        for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
          if (array[idx] === item) return idx;
        }
        return -1;
      };
    }

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _$1$1.indexOf = createIndexFinder$1$1(1, _$1$1.findIndex, _$1$1.sortedIndex);
    _$1$1.lastIndexOf = createIndexFinder$1$1(-1, _$1$1.findLastIndex);

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    _$1$1.range = function(start, stop, step) {
      if (stop == null) {
        stop = start || 0;
        start = 0;
      }
      step = step || 1;

      var length = Math.max(Math.ceil((stop - start) / step), 0);
      var range = Array(length);

      for (var idx = 0; idx < length; idx++, start += step) {
        range[idx] = start;
      }

      return range;
    };

    // Function (ahem) Functions
    // ------------------

    // Determines whether to execute a function as a constructor
    // or a normal function with the provided arguments
    var executeBound$1$1 = function(sourceFunc, boundFunc, context, callingContext, args) {
      if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
      var self = baseCreate$1$1(sourceFunc.prototype);
      var result = sourceFunc.apply(self, args);
      if (_$1$1.isObject(result)) return result;
      return self;
    };

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _$1$1.bind = function(func, context) {
      if (nativeBind$1$1 && func.bind === nativeBind$1$1) return nativeBind$1$1.apply(func, slice$1$1.call(arguments, 1));
      if (!_$1$1.isFunction(func)) throw new TypeError('Bind must be called on a function');
      var args = slice$1$1.call(arguments, 2);
      var bound = function() {
        return executeBound$1$1(func, bound, context, this, args.concat(slice$1$1.call(arguments)));
      };
      return bound;
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. _ acts
    // as a placeholder, allowing any combination of arguments to be pre-filled.
    _$1$1.partial = function(func) {
      var boundArgs = slice$1$1.call(arguments, 1);
      var bound = function() {
        var position = 0, length = boundArgs.length;
        var args = Array(length);
        for (var i = 0; i < length; i++) {
          args[i] = boundArgs[i] === _$1$1 ? arguments[position++] : boundArgs[i];
        }
        while (position < arguments.length) args.push(arguments[position++]);
        return executeBound$1$1(func, bound, this, this, args);
      };
      return bound;
    };

    // Bind a number of an object's methods to that object. Remaining arguments
    // are the method names to be bound. Useful for ensuring that all callbacks
    // defined on an object belong to it.
    _$1$1.bindAll = function(obj) {
      var i, length = arguments.length, key;
      if (length <= 1) throw new Error('bindAll must be passed function names');
      for (i = 1; i < length; i++) {
        key = arguments[i];
        obj[key] = _$1$1.bind(obj[key], obj);
      }
      return obj;
    };

    // Memoize an expensive function by storing its results.
    _$1$1.memoize = function(func, hasher) {
      var memoize = function(key) {
        var cache = memoize.cache;
        var address = '' + (hasher ? hasher.apply(this, arguments) : key);
        if (!_$1$1.has(cache, address)) cache[address] = func.apply(this, arguments);
        return cache[address];
      };
      memoize.cache = {};
      return memoize;
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    _$1$1.delay = function(func, wait) {
      var args = slice$1$1.call(arguments, 2);
      return setTimeout(function(){
        return func.apply(null, args);
      }, wait);
    };

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    _$1$1.defer = _$1$1.partial(_$1$1.delay, _$1$1, 1);

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time. Normally, the throttled function will run
    // as much as it can, without ever going more than once per `wait` duration;
    // but if you'd like to disable the execution on the leading edge, pass
    // `{leading: false}`. To disable execution on the trailing edge, ditto.
    _$1$1.throttle = function(func, wait, options) {
      var context, args, result;
      var timeout = null;
      var previous = 0;
      if (!options) options = {};
      var later = function() {
        previous = options.leading === false ? 0 : _$1$1.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      };
      return function() {
        var now = _$1$1.now();
        if (!previous && options.leading === false) previous = now;
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          previous = now;
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        } else if (!timeout && options.trailing !== false) {
          timeout = setTimeout(later, remaining);
        }
        return result;
      };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    _$1$1.debounce = function(func, wait, immediate) {
      var timeout, args, context, timestamp, result;

      var later = function() {
        var last = _$1$1.now() - timestamp;

        if (last < wait && last >= 0) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) {
            result = func.apply(context, args);
            if (!timeout) context = args = null;
          }
        }
      };

      return function() {
        context = this;
        args = arguments;
        timestamp = _$1$1.now();
        var callNow = immediate && !timeout;
        if (!timeout) timeout = setTimeout(later, wait);
        if (callNow) {
          result = func.apply(context, args);
          context = args = null;
        }

        return result;
      };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    _$1$1.wrap = function(func, wrapper) {
      return _$1$1.partial(wrapper, func);
    };

    // Returns a negated version of the passed-in predicate.
    _$1$1.negate = function(predicate) {
      return function() {
        return !predicate.apply(this, arguments);
      };
    };

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    _$1$1.compose = function() {
      var args = arguments;
      var start = args.length - 1;
      return function() {
        var i = start;
        var result = args[start].apply(this, arguments);
        while (i--) result = args[i].call(this, result);
        return result;
      };
    };

    // Returns a function that will only be executed on and after the Nth call.
    _$1$1.after = function(times, func) {
      return function() {
        if (--times < 1) {
          return func.apply(this, arguments);
        }
      };
    };

    // Returns a function that will only be executed up to (but not including) the Nth call.
    _$1$1.before = function(times, func) {
      var memo;
      return function() {
        if (--times > 0) {
          memo = func.apply(this, arguments);
        }
        if (times <= 1) func = null;
        return memo;
      };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _$1$1.once = _$1$1.partial(_$1$1.before, 2);

    // Object Functions
    // ----------------

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    var hasEnumBug$1$1 = !{toString: null}.propertyIsEnumerable('toString');
    var nonEnumerableProps$1$1 = ['valueOf', 'isPrototypeOf', 'toString',
                        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

    function collectNonEnumProps$1$1(obj, keys) {
      var nonEnumIdx = nonEnumerableProps$1$1.length;
      var constructor = obj.constructor;
      var proto = (_$1$1.isFunction(constructor) && constructor.prototype) || ObjProto$1$1;

      // Constructor is a special case.
      var prop = 'constructor';
      if (_$1$1.has(obj, prop) && !_$1$1.contains(keys, prop)) keys.push(prop);

      while (nonEnumIdx--) {
        prop = nonEnumerableProps$1$1[nonEnumIdx];
        if (prop in obj && obj[prop] !== proto[prop] && !_$1$1.contains(keys, prop)) {
          keys.push(prop);
        }
      }
    }

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _$1$1.keys = function(obj) {
      if (!_$1$1.isObject(obj)) return [];
      if (nativeKeys$1$1) return nativeKeys$1$1(obj);
      var keys = [];
      for (var key in obj) if (_$1$1.has(obj, key)) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug$1$1) collectNonEnumProps$1$1(obj, keys);
      return keys;
    };

    // Retrieve all the property names of an object.
    _$1$1.allKeys = function(obj) {
      if (!_$1$1.isObject(obj)) return [];
      var keys = [];
      for (var key in obj) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug$1$1) collectNonEnumProps$1$1(obj, keys);
      return keys;
    };

    // Retrieve the values of an object's properties.
    _$1$1.values = function(obj) {
      var keys = _$1$1.keys(obj);
      var length = keys.length;
      var values = Array(length);
      for (var i = 0; i < length; i++) {
        values[i] = obj[keys[i]];
      }
      return values;
    };

    // Returns the results of applying the iteratee to each element of the object
    // In contrast to _.map it returns an object
    _$1$1.mapObject = function(obj, iteratee, context) {
      iteratee = cb$1$1(iteratee, context);
      var keys =  _$1$1.keys(obj),
            length = keys.length,
            results = {},
            currentKey;
        for (var index = 0; index < length; index++) {
          currentKey = keys[index];
          results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
        }
        return results;
    };

    // Convert an object into a list of `[key, value]` pairs.
    _$1$1.pairs = function(obj) {
      var keys = _$1$1.keys(obj);
      var length = keys.length;
      var pairs = Array(length);
      for (var i = 0; i < length; i++) {
        pairs[i] = [keys[i], obj[keys[i]]];
      }
      return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    _$1$1.invert = function(obj) {
      var result = {};
      var keys = _$1$1.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        result[obj[keys[i]]] = keys[i];
      }
      return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    _$1$1.functions = _$1$1.methods = function(obj) {
      var names = [];
      for (var key in obj) {
        if (_$1$1.isFunction(obj[key])) names.push(key);
      }
      return names.sort();
    };

    // Extend a given object with all the properties in passed-in object(s).
    _$1$1.extend = createAssigner$1$1(_$1$1.allKeys);

    // Assigns a given object with all the own properties in the passed-in object(s)
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    _$1$1.extendOwn = _$1$1.assign = createAssigner$1$1(_$1$1.keys);

    // Returns the first key on an object that passes a predicate test
    _$1$1.findKey = function(obj, predicate, context) {
      predicate = cb$1$1(predicate, context);
      var keys = _$1$1.keys(obj), key;
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (predicate(obj[key], key, obj)) return key;
      }
    };

    // Return a copy of the object only containing the whitelisted properties.
    _$1$1.pick = function(object, oiteratee, context) {
      var result = {}, obj = object, iteratee, keys;
      if (obj == null) return result;
      if (_$1$1.isFunction(oiteratee)) {
        keys = _$1$1.allKeys(obj);
        iteratee = optimizeCb$1$1(oiteratee, context);
      } else {
        keys = flatten$1$1(arguments, false, false, 1);
        iteratee = function(value, key, obj) { return key in obj; };
        obj = Object(obj);
      }
      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
      return result;
    };

     // Return a copy of the object without the blacklisted properties.
    _$1$1.omit = function(obj, iteratee, context) {
      if (_$1$1.isFunction(iteratee)) {
        iteratee = _$1$1.negate(iteratee);
      } else {
        var keys = _$1$1.map(flatten$1$1(arguments, false, false, 1), String);
        iteratee = function(value, key) {
          return !_$1$1.contains(keys, key);
        };
      }
      return _$1$1.pick(obj, iteratee, context);
    };

    // Fill in a given object with default properties.
    _$1$1.defaults = createAssigner$1$1(_$1$1.allKeys, true);

    // Creates an object that inherits from the given prototype object.
    // If additional properties are provided then they will be added to the
    // created object.
    _$1$1.create = function(prototype, props) {
      var result = baseCreate$1$1(prototype);
      if (props) _$1$1.extendOwn(result, props);
      return result;
    };

    // Create a (shallow-cloned) duplicate of an object.
    _$1$1.clone = function(obj) {
      if (!_$1$1.isObject(obj)) return obj;
      return _$1$1.isArray(obj) ? obj.slice() : _$1$1.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    _$1$1.tap = function(obj, interceptor) {
      interceptor(obj);
      return obj;
    };

    // Returns whether an object has a given set of `key:value` pairs.
    _$1$1.isMatch = function(object, attrs) {
      var keys = _$1$1.keys(attrs), length = keys.length;
      if (object == null) return !length;
      var obj = Object(object);
      for (var i = 0; i < length; i++) {
        var key = keys[i];
        if (attrs[key] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };


    // Internal recursive comparison function for `isEqual`.
    var eq$1$1 = function(a, b, aStack, bStack) {
      // Identical objects are equal. `0 === -0`, but they aren't identical.
      // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
      if (a === b) return a !== 0 || 1 / a === 1 / b;
      // A strict comparison is necessary because `null == undefined`.
      if (a == null || b == null) return a === b;
      // Unwrap any wrapped objects.
      if (a instanceof _$1$1) a = a._wrapped;
      if (b instanceof _$1$1) b = b._wrapped;
      // Compare `[[Class]]` names.
      var className = toString$1$1.call(a);
      if (className !== toString$1$1.call(b)) return false;
      switch (className) {
        // Strings, numbers, regular expressions, dates, and booleans are compared by value.
        case '[object RegExp]':
        // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
        case '[object String]':
          // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
          // equivalent to `new String("5")`.
          return '' + a === '' + b;
        case '[object Number]':
          // `NaN`s are equivalent, but non-reflexive.
          // Object(NaN) is equivalent to NaN
          if (+a !== +a) return +b !== +b;
          // An `egal` comparison is performed for other numeric values.
          return +a === 0 ? 1 / +a === 1 / b : +a === +b;
        case '[object Date]':
        case '[object Boolean]':
          // Coerce dates and booleans to numeric primitive values. Dates are compared by their
          // millisecond representations. Note that invalid dates with millisecond representations
          // of `NaN` are not equivalent.
          return +a === +b;
      }

      var areArrays = className === '[object Array]';
      if (!areArrays) {
        if (typeof a != 'object' || typeof b != 'object') return false;

        // Objects with different constructors are not equivalent, but `Object`s or `Array`s
        // from different frames are.
        var aCtor = a.constructor, bCtor = b.constructor;
        if (aCtor !== bCtor && !(_$1$1.isFunction(aCtor) && aCtor instanceof aCtor &&
                                 _$1$1.isFunction(bCtor) && bCtor instanceof bCtor)
                            && ('constructor' in a && 'constructor' in b)) {
          return false;
        }
      }
      // Assume equality for cyclic structures. The algorithm for detecting cyclic
      // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

      // Initializing stack of traversed objects.
      // It's done here since we only need them for objects and arrays comparison.
      aStack = aStack || [];
      bStack = bStack || [];
      var length = aStack.length;
      while (length--) {
        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        if (aStack[length] === a) return bStack[length] === b;
      }

      // Add the first object to the stack of traversed objects.
      aStack.push(a);
      bStack.push(b);

      // Recursively compare objects and arrays.
      if (areArrays) {
        // Compare array lengths to determine if a deep comparison is necessary.
        length = a.length;
        if (length !== b.length) return false;
        // Deep compare the contents, ignoring non-numeric properties.
        while (length--) {
          if (!eq$1$1(a[length], b[length], aStack, bStack)) return false;
        }
      } else {
        // Deep compare objects.
        var keys = _$1$1.keys(a), key;
        length = keys.length;
        // Ensure that both objects contain the same number of properties before comparing deep equality.
        if (_$1$1.keys(b).length !== length) return false;
        while (length--) {
          // Deep compare each member
          key = keys[length];
          if (!(_$1$1.has(b, key) && eq$1$1(a[key], b[key], aStack, bStack))) return false;
        }
      }
      // Remove the first object from the stack of traversed objects.
      aStack.pop();
      bStack.pop();
      return true;
    };

    // Perform a deep comparison to check if two objects are equal.
    _$1$1.isEqual = function(a, b) {
      return eq$1$1(a, b);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _$1$1.isEmpty = function(obj) {
      if (obj == null) return true;
      if (isArrayLike$1$1(obj) && (_$1$1.isArray(obj) || _$1$1.isString(obj) || _$1$1.isArguments(obj))) return obj.length === 0;
      return _$1$1.keys(obj).length === 0;
    };

    // Is a given value a DOM element?
    _$1$1.isElement = function(obj) {
      return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _$1$1.isArray = nativeIsArray$1$1 || function(obj) {
      return toString$1$1.call(obj) === '[object Array]';
    };

    // Is a given variable an object?
    _$1$1.isObject = function(obj) {
      var type = typeof obj;
      return type === 'function' || type === 'object' && !!obj;
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
    _$1$1.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
      _$1$1['is' + name] = function(obj) {
        return toString$1$1.call(obj) === '[object ' + name + ']';
      };
    });

    // Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    if (!_$1$1.isArguments(arguments)) {
      _$1$1.isArguments = function(obj) {
        return _$1$1.has(obj, 'callee');
      };
    }

    // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
    // IE 11 (#1621), and in Safari 8 (#1929).
    if (typeof /./ != 'function' && typeof Int8Array != 'object') {
      _$1$1.isFunction = function(obj) {
        return typeof obj == 'function' || false;
      };
    }

    // Is a given object a finite number?
    _$1$1.isFinite = function(obj) {
      return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    _$1$1.isNaN = function(obj) {
      return _$1$1.isNumber(obj) && obj !== +obj;
    };

    // Is a given value a boolean?
    _$1$1.isBoolean = function(obj) {
      return obj === true || obj === false || toString$1$1.call(obj) === '[object Boolean]';
    };

    // Is a given value equal to null?
    _$1$1.isNull = function(obj) {
      return obj === null;
    };

    // Is a given variable undefined?
    _$1$1.isUndefined = function(obj) {
      return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _$1$1.has = function(obj, key) {
      return obj != null && hasOwnProperty$1$1.call(obj, key);
    };

    // Utility Functions
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    _$1$1.noConflict = function() {
      root._ = previousUnderscore;
      return this;
    };

    // Keep the identity function around for default iteratees.
    _$1$1.identity = function(value) {
      return value;
    };

    // Predicate-generating functions. Often useful outside of Underscore.
    _$1$1.constant = function(value) {
      return function() {
        return value;
      };
    };

    _$1$1.noop = function(){};

    _$1$1.property = property$1$1;

    // Generates a function for a given object that returns a given property.
    _$1$1.propertyOf = function(obj) {
      return obj == null ? function(){} : function(key) {
        return obj[key];
      };
    };

    // Returns a predicate for checking whether an object has a given set of
    // `key:value` pairs.
    _$1$1.matcher = _$1$1.matches = function(attrs) {
      attrs = _$1$1.extendOwn({}, attrs);
      return function(obj) {
        return _$1$1.isMatch(obj, attrs);
      };
    };

    // Run a function **n** times.
    _$1$1.times = function(n, iteratee, context) {
      var accum = Array(Math.max(0, n));
      iteratee = optimizeCb$1$1(iteratee, context, 1);
      for (var i = 0; i < n; i++) accum[i] = iteratee(i);
      return accum;
    };

    // Return a random integer between min and max (inclusive).
    _$1$1.random = function(min, max) {
      if (max == null) {
        max = min;
        min = 0;
      }
      return min + Math.floor(Math.random() * (max - min + 1));
    };

    // A (possibly faster) way to get the current timestamp as an integer.
    _$1$1.now = Date.now || function() {
      return new Date().getTime();
    };

     // List of HTML entities for escaping.
    var escapeMap$1$1 = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '`': '&#x60;'
    };
    var unescapeMap$1$1 = _$1$1.invert(escapeMap$1$1);

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    var createEscaper$1$1 = function(map) {
      var escaper = function(match) {
        return map[match];
      };
      // Regexes for identifying a key that needs to be escaped
      var source = '(?:' + _$1$1.keys(map).join('|') + ')';
      var testRegexp = RegExp(source);
      var replaceRegexp = RegExp(source, 'g');
      return function(string) {
        string = string == null ? '' : '' + string;
        return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
      };
    };
    _$1$1.escape = createEscaper$1$1(escapeMap$1$1);
    _$1$1.unescape = createEscaper$1$1(unescapeMap$1$1);

    // If the value of the named `property` is a function then invoke it with the
    // `object` as context; otherwise, return it.
    _$1$1.result = function(object, property, fallback) {
      var value = object == null ? void 0 : object[property];
      if (value === void 0) {
        value = fallback;
      }
      return _$1$1.isFunction(value) ? value.call(object) : value;
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter$1$1 = 0;
    _$1$1.uniqueId = function(prefix) {
      var id = ++idCounter$1$1 + '';
      return prefix ? prefix + id : id;
    };

    // By default, Underscore uses ERB-style template delimiters, change the
    // following template settings to use alternative delimiters.
    _$1$1.templateSettings = {
      evaluate    : /<%([\s\S]+?)%>/g,
      interpolate : /<%=([\s\S]+?)%>/g,
      escape      : /<%-([\s\S]+?)%>/g
    };

    // When customizing `templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch$1$1 = /(.)^/;

    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes$1$1 = {
      "'":      "'",
      '\\':     '\\',
      '\r':     'r',
      '\n':     'n',
      '\u2028': 'u2028',
      '\u2029': 'u2029'
    };

    var escaper$1$1 = /\\|'|\r|\n|\u2028|\u2029/g;

    var escapeChar$1$1 = function(match) {
      return '\\' + escapes$1$1[match];
    };

    // JavaScript micro-templating, similar to John Resig's implementation.
    // Underscore templating handles arbitrary delimiters, preserves whitespace,
    // and correctly escapes quotes within interpolated code.
    // NB: `oldSettings` only exists for backwards compatibility.
    _$1$1.template = function(text, settings, oldSettings) {
      if (!settings && oldSettings) settings = oldSettings;
      settings = _$1$1.defaults({}, settings, _$1$1.templateSettings);

      // Combine delimiters into one regular expression via alternation.
      var matcher = RegExp([
        (settings.escape || noMatch$1$1).source,
        (settings.interpolate || noMatch$1$1).source,
        (settings.evaluate || noMatch$1$1).source
      ].join('|') + '|$', 'g');

      // Compile the template source, escaping string literals appropriately.
      var index = 0;
      var source = "__p+='";
      text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
        source += text.slice(index, offset).replace(escaper$1$1, escapeChar$1$1);
        index = offset + match.length;

        if (escape) {
          source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
        } else if (interpolate) {
          source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
        } else if (evaluate) {
          source += "';\n" + evaluate + "\n__p+='";
        }

        // Adobe VMs need the match returned to produce the correct offest.
        return match;
      });
      source += "';\n";

      // If a variable is not specified, place data values in local scope.
      if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

      source = "var __t,__p='',__j=Array.prototype.join," +
        "print=function(){__p+=__j.call(arguments,'');};\n" +
        source + 'return __p;\n';

      try {
        var render = new Function(settings.variable || 'obj', '_', source);
      } catch (e) {
        e.source = source;
        throw e;
      }

      var template = function(data) {
        return render.call(this, data, _$1$1);
      };

      // Provide the compiled source as a convenience for precompilation.
      var argument = settings.variable || 'obj';
      template.source = 'function(' + argument + '){\n' + source + '}';

      return template;
    };

    // Add a "chain" function. Start chaining a wrapped Underscore object.
    _$1$1.chain = function(obj) {
      var instance = _$1$1(obj);
      instance._chain = true;
      return instance;
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // Helper function to continue chaining intermediate results.
    var result$1$1 = function(instance, obj) {
      return instance._chain ? _$1$1(obj).chain() : obj;
    };

    // Add your own custom functions to the Underscore object.
    _$1$1.mixin = function(obj) {
      _$1$1.each(_$1$1.functions(obj), function(name) {
        var func = _$1$1[name] = obj[name];
        _$1$1.prototype[name] = function() {
          var args = [this._wrapped];
          push$1$1.apply(args, arguments);
          return result$1$1(this, func.apply(_$1$1, args));
        };
      });
    };

    // Add all of the Underscore functions to the wrapper object.
    _$1$1.mixin(_$1$1);

    // Add all mutator Array functions to the wrapper.
    _$1$1.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
      var method = ArrayProto$1$1[name];
      _$1$1.prototype[name] = function() {
        var obj = this._wrapped;
        method.apply(obj, arguments);
        if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
        return result$1$1(this, obj);
      };
    });

    // Add all accessor Array functions to the wrapper.
    _$1$1.each(['concat', 'join', 'slice'], function(name) {
      var method = ArrayProto$1$1[name];
      _$1$1.prototype[name] = function() {
        return result$1$1(this, method.apply(this._wrapped, arguments));
      };
    });

    // Extracts the result from a wrapped and chained object.
    _$1$1.prototype.value = function() {
      return this._wrapped;
    };

    // Provide unwrapping proxy for some methods used in engine operations
    // such as arithmetic and JSON stringification.
    _$1$1.prototype.valueOf = _$1$1.prototype.toJSON = _$1$1.prototype.value;

    _$1$1.prototype.toString = function() {
      return '' + this._wrapped;
    };

    // AMD registration happens at the end for compatibility with AMD loaders
    // that may not enforce next-turn semantics on modules. Even though general
    // practice for AMD registration is to be anonymous, underscore registers
    // as a named module because, like jQuery, it is a base library that is
    // popular enough to be bundled in a third party lib, but not be part of
    // an AMD load request. Those cases could generate an error when an
    // anonymous define() is called outside of a loader request.
    if (typeof define === 'function' && define.amd) {
      define('underscore', [], function() {
        return _$1$1;
      });
    }
  // }.call(this));

  const TibetanSyllableParser = function(syllable, options = {}) {
    var normalizedSyllable = syllable
      .replace(/ཱུ/g, 'ཱུ')
      .replace(/ཱི/g, 'ཱི')
      .replace(/ཱྀ/g, 'ཱྀ');
    return {
      options: _$1$1(options).defaults({
        keepMainAsSuperscribed: false
      }),
      prefix: undefined,
      suffix: undefined,
      secondSuffix: undefined,
      syllable: normalizedSyllable,
      aKikuI: false,
      completionU: false,
      // Returns the syllable without either wasur, achung, anusvara, honorific or chego
      simplifiedSyllable: function() {
        return this.syllable.replace(/[ྭཱཾ༵ྃྂ༸]/g, '');
      },
      length: function() {
        return this.simplifiedSyllable().length;
      },
      at: function(element, delta, options = {}) {
        var index;
        var syllable = this.simplifiedSyllable();
        if (options.fromEnd) index = _$1$1(syllable).lastIndexOf(element);
        else                 index = _$1$1(syllable).indexOf(element);
        return (index >= 0) ? syllable[index+delta] : undefined;
      },
      vowel: function() {
        var match = this.syllable.match(/[ིྀེཻོཽུ]/);
        return match ? match[0] : undefined;
      },
      superscribed: function() {
        var match = this.syllable.match(/[ྐྒྔྗྙྟྡྣྦྨྩྫྕྤྷ]/);
        return match ? this.at(match[0], -1) : undefined;
      },
      subscribed: function() {
        var match = this.syllable.match(/[ྱྲླ]/);
        return match ? match[0] : undefined;
      },
      figureOutPrefixAndSuffixes: function() {
        this.figureOutPrefix();
        this.figureOutSuffixes();
      },
      figureOutPrefix: function() {
        if (this.superscribed()) this.prefix = this.at(this.superscribed(), -1);
        else                     this.prefix = this.at(this.root,           -1);
      },
      figureOutSuffixes: function() {
        if      (this.vowel()     ) this.suffix = this.at(this.vowel(),      1);
        else if (this.subscribed()) this.suffix = this.at(this.subscribed(), 1);
        else                        this.suffix = this.at(this.root,         1);
        this.secondSuffix = this.at(this.suffix, 1, { fromEnd: true });
      },
      convertMainAsRegularChar: function() {
        switch(this.root) {
          case 'ྐ': this.root = 'ཀ'; break;
          case 'ྒ': this.root = 'ག'; break;
          case 'ྔ': this.root = 'ང'; break;
          case 'ྗ': this.root = 'ཇ'; break;
          case 'ྙ': this.root = 'ཉ'; break;
          case 'ྟ': this.root = 'ཏ'; break;
          case 'ྡ': this.root = 'ད'; break;
          case 'ྣ': this.root = 'ན'; break;
          case 'ྦ': this.root = 'བ'; break;
          case 'ྨ': this.root = 'མ'; break;
          case 'ྩ': this.root = 'ཙ'; break;
          case 'ྫ': this.root = 'ཛ'; break;
          case 'ྕ': this.root = 'ཅ'; break;
          case 'ྤ': this.root = 'པ'; break;
          case 'ྷ': this.root = 'ཧ'; break;
        }
      },
      isAnExceptionNowHandled: function() {
        switch(this.syllable) {
          case 'དབ':   this.prefix = 'ད'; this.root = 'བ';                                            return true;        case 'དགས':  this.prefix = 'ད'; this.root = 'ག'; this.suffix = 'ས';                          return true;        case 'དྭགས':                    this.root = 'ད'; this.suffix = 'ག'; this.secondSuffix = 'ས'; return true;        case 'དམས':  this.prefix = 'ད'; this.root = 'མ'; this.suffix = 'ས';                          return true;        case 'འགས':  this.prefix = 'འ'; this.root = 'ག'; this.suffix = 'ས';                          return true;        case 'མངས':  this.prefix = 'མ'; this.root = 'ང'; this.suffix = 'ས';                          return true;        default: return false;
        }
      },
      returnObject: function() {
        return {
          prefix: this.prefix,
          superscribed: this.superscribed(),
          root: this.root,
          subscribed: this.subscribed(),
          vowel: this.vowel(),
          suffix: this.suffix,
          secondSuffix: this.secondSuffix,
          wasur: this.wasur(),
          achung: this.achung(),
          anusvara: this.anusvara(),
          honorificMarker: this.honorificMarker(),
          chego: this.chego()
        }
      },
      secondLetterIsGaNgaBaMa: function() {
        return this.syllable[1].match(/[གངབམ]/);
      },
      handleDreldraAi: function() {
        if (this.length() > 2 && this.syllable.match(/འི$/)) {
          if (this.length() <= 3) this.syllable = this.syllable.replace(/འི$/, '');
          else                    this.syllable = this.syllable.replace(/འི$/,  'འ');
          this.aKikuI = true;
        }
      },
      handleEndingO: function() {
        if (this.length() > 2 && this.syllable.match(/འོ$/)) {
          this.syllable = this.syllable.replace(/འོ$/, 'འ');
          this.completionO = true;
        }
      },
      handleEndingU: function() {
        if (this.length() > 2 && this.syllable.match(/འུ$/)) {
          this.syllable = this.syllable.replace(/འུ$/, '');
          this.completionU = true;
        }
      },
      handleAndOrParticleAAng: function() {
        if (this.length() > 2 && this.syllable.match(/འང$/)) {
          this.syllable = this.syllable.replace(/འང$/, '');
          this.andOrParticleAAng = true;
        }
      },
      handleConcessiveParticleAAm: function() {
        if (this.length() > 2 && this.syllable.match(/འམ$/)) {
          this.syllable = this.syllable.replace(/འམ$/, '');
          this.concessiveParticleAAm = true;
        }
      },
      wasur: function() {
        var match = this.syllable.match('ྭ');
        if (match) return match[0];
      },
      achung: function() {
        var match = this.syllable.match(/[ཱྰ]/);
        if (match) return match[0];
      },
      anusvara: function() {
        var match = this.syllable.match(/[ཾྃྂ]/);
        if (match) return match[0];
      },
      honorificMarker: function() {
        var match = this.syllable.match('༵');
        if (match) return match[0];
      },
      chego: function() {
        var match = this.syllable.match('༸');
        if (match) return match[0];
      },
      parse: function() {
        if (this.isAnExceptionNowHandled()) return this.returnObject();
        this.handleDreldraAi();
        this.handleEndingU();
        this.handleEndingO();
        this.handleAndOrParticleAAng();
        this.handleConcessiveParticleAAm();
        if (this.length() == 1) this.root = _$1$1(this.simplifiedSyllable()).first();
        if (this.vowel()) this.root = this.at(this.vowel(), -1);
        if (this.wasur()) this.root = this.syllable[this.syllable.replace(/[ྲྱཱཾ༵ྃྂ]/g, '').indexOf(this.wasur()) - 1];
        else if (this.subscribed()) this.root = this.at(this.subscribed(), -1);
        else if (this.superscribed()) this.root = this.at(this.superscribed(), 1);
        if (!this.root) {
          if (this.length() == 2) {
            this.root = this.syllable[0];
            this.suffix = this.syllable[1];
          } else if (this.length() == 4) {
            this.prefix = this.syllable[0];
            this.root = this.syllable[1];
            this.suffix = this.syllable[2];
            this.secondSuffix = this.syllable[3];
          } else if (this.length() == 3) {
            if (!(_$1$1(this.syllable).last() == 'ས')) this.root = this.syllable[1];
            else if (!this.secondLetterIsGaNgaBaMa()) this.root = this.syllable[1];
            else if ( this.secondLetterIsGaNgaBaMa()) this.root = this.syllable[0];
            else alert("There has been an error:\n\nThe syllable "+this.syllable+" could not be parsed.\n\nAre you sure it's correct?");
          }
        }
        this.figureOutPrefixAndSuffixes();
        if (this.aKikuI) this.suffix = 'འི';
        if (this.andOrParticleAAng) this.suffix = 'འང';
        if (this.concessiveParticleAAm) this.suffix = 'འམ';
        if (this.completionU) this.suffix = 'འུ';
        if (this.completionO) this.suffix = 'འོ';
        if (this.superscribed() && !this.options.keepMainAsSuperscribed) this.convertMainAsRegularChar();
        return this.returnObject();
      }
    }
  };

  var t$1, findException;

  const TibetanToPhonetics = function(options = {}) {
    var setting = assignValidSettingOrThrowException(options.setting);
    var rulesUsed = {};
    var exceptionsUsed = {};
    t$1 = (key, track = true) => {
      var value = setting.rules[key];
      if (track)
        rulesUsed[key] = value;
      return value;
    };
    var converter = {
      setting: setting,
      options: options,
      rulesUsed: rulesUsed,
      exceptionsUsed: exceptionsUsed,
      resetRulesUsed () {
        this.rulesUsed = rulesUsed = {};
      },
      resetExceptionsUsed () {
        this.exceptionsUsed = exceptionsUsed = {};
      },
      convert: function(tibetan, options) {
        tibetan = removeMuteCharsAndNormalize(tibetan);
        tibetan = this.substituteWordsWith7AsCheGo(tibetan);
        tibetan = this.substituteNumbers(tibetan);
        var groups = this.splitBySpacesOrNumbers(tibetan);
        return groups.map((tibetanGroup, index) => {
          if (tibetanGroup.match(/^\d+$/))
            return tibetanGroup;
          else {
            var group = new Group(tibetanGroup, rulesUsed).convert();
            if (options && options.capitalize || this.options.capitalize)
              group = group.capitalize();
            return group;
          }
        }).join(' ');
      },
      splitBySpacesOrNumbers (text) {
        return _$1(text.split(/(\d+)| /)).compact();
      },
      substituteNumbers (text) {
        _$1({
          '༠': '0', '༡': '1', '༢': '2', '༣': '3', '༤': '4',
          '༥': '5', '༦': '6', '༧': '7', '༨': '8', '༩': '9'
        }).each((arabic, tibetan) => {
          text = text.replace(new RegExp(tibetan, 'g'), arabic);
        });
        return text;
      },
      substituteWordsWith7AsCheGo (text) {
        return text.
          replace(/༧ཞབས/g, 'ཞབས').
          replace(/༧སྐྱབས/g, 'སྐྱབས');
      }
    };
    var exceptions = new Exceptions(setting, converter, rulesUsed, exceptionsUsed);
    findException = (text) => exceptions.find(text);
    return converter;
  };

  var Group = function(tibetan, rulesUsed) {
    return {
      tibetan: tibetan,
      group: '',
      convert: function() {
        var syllable;
        this.syllables = _$1.compact(tibetan.trim().split('་'));
        this.groupNumberOfSyllables = this.syllables.length;
        while (syllable = this.syllables.shift()) {
          var exception = this.findLongestException(syllable, this.syllables);
          if (exception) {
            this.group += exception.converted;
            if (exception.numberOfSyllables == 1) {
              if (exception.spaceAfter) this.group += ' ';
              this.handleSecondSyllable();
            } else
              this.group += ' ';
            this.shiftSyllables(exception.numberOfShifts);
          } else {
            if (this.isLastSyllableAndStartsWithBa(syllable))
              this.group += this.BaAsWaWhenSecondSyllable(syllable);
            else {
              var firstSyllableConverted = new Syllable(syllable).convert();
              if (this.handleSecondSyllable(firstSyllableConverted, syllable));
              else this.group += firstSyllableConverted;
            }
          }
        }
        return this.group.trim();
      },
      handleSecondSyllable: function(firstSyllableConverted, firstSyllableTibetan) {
        var secondSyllable = this.syllables.shift();
        if (secondSyllable) {
          var secondSyllableConverted;
          var secondException = this.findLongestException(secondSyllable, this.syllables);
          if (secondException) {
            this.shiftSyllables(secondException.numberOfShifts);
            secondSyllableConverted = secondException.converted;
          } else {
            var BaAsWaSyllableConverted;
            if (BaAsWaSyllableConverted = this.BaAsWaWhenSecondSyllable(secondSyllable))
              secondSyllableConverted = BaAsWaSyllableConverted;
            else
              secondSyllableConverted = new Syllable(secondSyllable).convert();
          }
          if (firstSyllableConverted) {
            if (this.AngOrAm(firstSyllableTibetan) || new Syllable(firstSyllableTibetan).endingO()) {
              this.group += firstSyllableConverted + ' ';
              // Because *-am is two syllables, we add back the second syllable
              // to the array and return so that it gets processed as the first
              // syllable of the next pair.
              this.syllables.unshift(secondSyllable);
              return true;
            }
            firstSyllableConverted = this.connectWithDashIfNecessaryForReadability(firstSyllableConverted, secondSyllableConverted);
            firstSyllableConverted = this.handleDuplicateConnectingLetters(firstSyllableConverted, secondSyllableConverted);
            firstSyllableConverted = this.handleDoubleS(firstSyllableConverted, secondSyllableConverted);
            this.group += firstSyllableConverted;
          }
          this.group += secondSyllableConverted + ' ';
          return true;
        }
      },
      findLongestException: function(syllable) {
        var restOfSyllables = this.syllables;
        if (!restOfSyllables.length)
          return findException(syllable);
        else {
          var exception;
          for (var index = restOfSyllables.length; index >= 0; index--) {
            var subset = [syllable].concat(restOfSyllables.slice(0, index));
            if (!exception) exception = findException(subset.join('་'));
          }
          return exception;
        }
      },
      isLastSyllableAndStartsWithBa (syllable) {
        if (this.groupNumberOfSyllables > 1 && this.syllables.length == 0)
          return this.BaAsWaWhenSecondSyllable(syllable);
      },
      BaAsWaWhenSecondSyllable (syllable) {
        if      (syllable == 'བ')   return t$1('baAsWa') + t$1('a');
        else if (syllable == 'བར')  return t$1('baAsWa') + t$1('a') + t$1('raSuffix');
        else if (syllable == 'བས')  return t$1('baAsWa') + t$1('drengbu');
        else if (syllable == 'བའི') return t$1('baAsWa') + t$1('aKikuI');
        else if (syllable == 'བའོ') return t$1('baAsWa') + t$1('a') + t$1('endLinkChar') + t$1('o');
        else if (syllable == 'བོ')  return t$1('baAsWa') + t$1('o');
        else if (syllable == 'བོར')  return t$1('baAsWa') + t$1('o') + t$1('raSuffix');
        else if (syllable == 'བོས') return t$1('baAsWa') + t$1('ö');
        else if (syllable == 'བོའི') return t$1('baAsWa') + t$1('ö');
        else if (syllable == 'བའམ') return t$1('baAsWa') + t$1('a') + t$1('endLinkChar') + t$1('a') + t$1('maSuffix');
        else if (syllable == 'བའང') return t$1('baAsWa') + t$1('a') + t$1('endLinkChar') + t$1('a') + t$1('ngaSuffix');
      },
      AngOrAm (tibetan) {
        return tibetan.match(/.+འ[ངམ]$/);
      },
      connectWithDashIfNecessaryForReadability: function(firstSyllable, secondSyllable) {
        var twoVowels = this.endsWithVowel(firstSyllable) && this.startsWithVowel(secondSyllable);
        var aFollowedByN = firstSyllable.last() == 'a' && secondSyllable.first() == 'n';
        var oFollowedByN = firstSyllable.last() == 'o' && secondSyllable.first() == 'n';
        var gFollowedByN = firstSyllable.last() == 'g' && secondSyllable.first() == 'n';
        if (twoVowels || aFollowedByN || oFollowedByN || gFollowedByN)
          return firstSyllable + '-';
        else
          return firstSyllable;
      },
      handleDuplicateConnectingLetters: function(firstSyllable, secondSyllable) {
        var sameLetter = firstSyllable.last() == secondSyllable.first();
        var endEqualsStartRule = t$1('endEqualsStart', false);
        if (sameLetter) {
          if (endEqualsStartRule == 'dash')
            return firstSyllable + '-';
          else if (endEqualsStartRule == 'space')
            return firstSyllable + ' ';
          else if (endEqualsStartRule == 'merge')
            return firstSyllable.slice(0, firstSyllable.length-1);
        }
        return firstSyllable;
      },
      handleDoubleS: function(firstSyllable, secondSyllable) {
        if (
          t$1('doubleS', false) &&
          this.endsWithVowel(firstSyllable) &&
          secondSyllable.match(/^s[^h]/)
        ) {
          rulesUsed['doubleS'] = true;
          return firstSyllable + 's';
        } else
          return firstSyllable;
      },
      shiftSyllables: function(numberOfShifts) {
        var that = this;
        _$1(numberOfShifts).times(function() { that.syllables.shift(); });
      },
      startsWithVowel: function(string) {
        return string.match(/^[eo]?[aeiouéiöü]/);
      },
      endsWithVowel: function(string) {
        return string.match(/[eo]?[aeiouéiöü]$/);
      }
    }
  };

  var Syllable = function(syllable) {
    var parsed = new TibetanSyllableParser(syllable).parse();
    var object = _$1.omit(parsed, (_$1.functions(parsed)));
    return _$1(object).extend({
      syllable: syllable,
      convert: function() {
        var consonant = this.consonant();
        if (consonant == undefined) {
          return '࿗';
        }
        return consonant + this.getVowel() + this.getSuffix() + this.endingO() + this.endingU()
      },
      consonant: function() {
        if (this.lata()) {
          if (this.root == 'ཟ')                        return t$1('lataDa');
          else                                         return t$1('lata');
        }
        if (this.daoWa()) {
          if      (this.yata())                        return t$1('daoWaYata');
          else if (this.vowel)                         return '';
          else                                         return t$1('wa');
        }
        switch(this.root) {
          case 'ཀ':
            if      (this.rata())                      return t$1('rata1');
            else if (this.yata())                      return t$1('kaYata');
            else                                       return t$1('ka');        case 'ག':
            if      (this.superscribed || this.prefix) {
              if      (this.rata())                    return t$1('rata3Mod');
              else if (this.yata())                    return t$1('gaModYata');
              else if (t$1('gaMod', false) == 'gu') {                  // Exceptions for french & spanish
                if      (this.getVowel() == 'a')       return 'g';   // 'gage' and not 'guage'
                else if (this.getVowel() == 'o')       return 'g';   // 'gong' and not 'guong'
                else if (this.getVowel() == 'u')       return 'g';   // 'guru' and not 'guuru'
                else if (this.getVowel() == 'ou')      return 'g';   // 'gourou' and not 'guourou'
              }
              return t$1('gaMod');
            }
            else if (this.rata())                      return t$1('rata3');
            else if (this.yata())                      return t$1('gaYata');
            else                                       return t$1('ga');        case 'ཁ':
            if      (this.rata())                      return t$1("rata2");
            else if (this.yata())                      return t$1('khaYata');
            else                                       return t$1('kha');        case 'ང':                                    return t$1('nga');        case 'ཅ':                                    return t$1('ca');        case 'ཆ':                                    return t$1('cha');        case 'ཇ':
            if      (this.superscribed || this.prefix) return t$1('jaMod');
            else                                       return t$1('ja');        case 'ཉ':                                    return t$1('nya');        case 'ཏ':
          case 'ཊ':
            if      (this.rata())                      return t$1('rata1');
            else                                       return t$1('ta');        case 'ད':
            if      (this.superscribed || this.prefix) {
              if      (this.rata())                    return t$1('rata3Mod');
              else                                     return t$1('daMod');
            }
            else if (this.rata())                      return t$1('rata3');
            else                                       return t$1('da');        case 'ཌ': // Experimental, default case based on པཎ་ཌི་ for pandita, check if other cases are correct and/or useful
            if      (this.superscribed || this.prefix) {
              if      (this.rata())                    return t$1('rata3Mod');
              else                                     return t$1('daMod');
            }
            else if (this.rata())                      return t$1('rata3');
            else                                       return t$1('daMod');        case 'ཐ':
            if      (this.rata())                      return t$1('rata2');
            else                                       return t$1('tha');        case 'ན':
          case 'ཎ':                                    return t$1('na');        case 'པ':
            if      (this.rata())                      return t$1('rata1');
            else if (this.yata())                      return t$1('paYata');
            else                                       return t$1('pa');        case 'ཕ':
            if      (this.rata())                      return t$1('rata2');
            else if (this.yata())                      return t$1('phaYata');
            else                                       return t$1('pha');        case 'བ':
            if      (this.superscribed || this.prefix) {
              if      (this.rata())                    return t$1('rata3Mod');
              else if (this.yata())                    return t$1('baModYata');
              else                                     return t$1('baMod');
            }
            else if (this.rata())                      return t$1('rata3');
            else if (this.yata())                      return t$1('baYata');
            else                                       return t$1('ba');        case 'མ':
            if     (this.yata())                       return t$1('nya');
            else                                       return t$1('ma');        case 'ཙ':                                    return t$1('tsa');        case 'ཚ':                                    return t$1('tsha');        case 'ཛ':                                    return t$1('dza');        case 'ཝ':                                    return t$1('wa');        case 'ཞ':                                    return t$1('zha');        case 'ཟ':
            if     (this.superscribed || this.prefix)  return t$1('zaMod');
            else                                       return t$1('za');        case 'འ':                                    return  '';        case 'ཡ':                                    return t$1('ya');        case 'ར':                                    return t$1('ra');        case 'ལ':                                    return t$1('la');        case 'ཤ':
          case 'ཥ':                                    return t$1('sha');        case 'ས':                                    return t$1('sa');        case 'ཧ':
            if      (this.superscribed == 'ལ')         return t$1('lha');
            if      (this.rata())                      return t$1('hra');
            else                                       return t$1('ha');        case 'ཨ':                                    return '';      }
      },
      getVowel: function() {
        switch(this.vowel) {
          case 'ི': return t$1('i');        case 'ེ':
          case 'ཻ':
            if      (this.suffix && this.suffix.match(/[མནཎར]/)) return t$1('drengbuMaNaRa');
            else if (this.suffix && this.suffix.match(/[གབལང]/)) return t$1('drengbuGaBaLaNga');
            else                                                return t$1('drengbu');        case 'ུ':
            if (this.aKikuIOrSuffixIsLaSaDaNa()) return t$1('ü');
            else                                 return t$1('u');        case 'ོ':
          case 'ཽ':
            if (this.aKikuIOrSuffixIsLaSaDaNa()) return t$1('ö');
            else                                 return t$1('o');        default:
            if      (this.aKikuI())                           return t$1('aKikuI');
            else if (this.suffix && this.suffix.match(/[སད]/)) return t$1('drengbu');
            else if (this.suffix && this.suffix.match(/[ནཎ]/)) return t$1('aNa');
            else if (this.suffix && this.suffix == 'ལ')        return t$1('aLa');
            else                                               return t$1('a');      }
      },
      getSuffix: function() {
        if (this.anusvara)
          if (this.root.match(/[ཧ]/))
            return t$1('ngaSuffix');
          else
            return t$1('maSuffix');
        switch(this.suffix) {
          case 'ག': return t$1('kaSuffix');        case 'ང': return t$1('ngaSuffix');        case 'ན': return t$1('naSuffix');        case 'ཎ': return t$1('naSuffix');        case 'བ': return (this.daoWa()) ? '' : t$1('baSuffix');        case 'མ': return t$1('maSuffix');        case 'ར': return t$1('raSuffix');        case 'ལ': return t$1('laSuffix');        case 'འང': return t$1('endLinkChar') + t$1('a') + t$1('ngaSuffix');        case 'འམ': return t$1('endLinkChar') + t$1('a') + t$1('maSuffix');        default: return '';
        }
      },
      suffixIsSaDa: function() {
        return this.aKikuI() || (this.suffix && this.suffix.match(/[སད]/));
      },
      aKikuIOrSuffixIsLaSaDaNa: function() {
        return this.aKikuI() || (this.suffix && this.suffix.match(/[ལསདནཎ]/));
      },
      daoWa: function() {
        return this.syllable.match(/^དབ[ྱ]?[ིེོུ]?[ངསགརལདའབ]?[ིས]?$/);
      },
      aKikuI: function() {
        return this.syllable.match(/འི$/);
      },
      endingO: function() {
        return this.ifMatchesAppendEndingChar(/འོ$/, t$1('o', false));
      },
      endingU: function() {
        return this.ifMatchesAppendEndingChar(/འུ$/, t$1('u', false));
      },
      ifMatchesAppendEndingChar: function(regex, char) {
        return (this.syllable.length > 2 && this.syllable.match(regex)) ? t$1('endLinkChar') + char : '';
      },
      rata: function() {
        return this.subscribed == 'ྲ';
      },
      yata: function() {
        return this.subscribed == 'ྱ';
      },
      lata: function() {
        return this.subscribed == 'ླ';
      }
    });
  };

  const assignValidSettingOrThrowException = function (setting) {
    if (typeof(setting) == 'object') {
      if (
        typeof(setting.rules) == 'object' &&
        typeof(setting.exceptions) == 'object'
      ) {
        _$1(setting.rules).defaults(baseRules);
        return setting;
      } else
        throwBadArgumentsError("You passed an object but it doesn't return " +
          "objects for 'rules' and 'exceptions'.");
    }
    else if (typeof(setting) == 'string') {
      var existingSetting = Settings.find(setting);
      if (existingSetting)
        return existingSetting;
      else
        throwBadArgumentsError("There is no existing setting matching id '" + setting + "'");
    } else if (setting)
      throwBadArgumentsError("You passed " + typeof(setting));
    else
      return Settings.default();
  };

  const throwBadArgumentsError = function(passedMessage) {
    throw new TypeError(
      "Invalid value for 'setting' option\n+" +
      "------------------------------------\n" +
      passedMessage + "\n" +
      "------------------------------------\n" +
      "The 'setting' option accepts either:\n" +
      "- the name of a existing setting\n" +
      "- a setting object itself\n" +
      "- any object that quacks like a setting, meaning it returns objects " +
      "for 'rules' and 'exceptions'\n"
    )
  };

  const phoneticsForGroups = function (setting, groups) {
    return groups.map((group) => {
      return (
        setting == 'strict'
        ? phoneticsStrictFor(group)
        : phoneticsLooseFor(group)
      )
    }).join(' === ')
  };

  const strictAndLoosePhoneticsFor = function (text) {
    var tibetanGroups = text.match(tibetanRegexps.tibetanGroups) || [];
    return [
      phoneticsForGroups('strict', tibetanGroups),
      phoneticsForGroups('loose', tibetanGroups)
    ];
  };

  const phoneticsStrictFor = function(text) {
    var setting = Settings.find('english-semi-strict');
    _.extend(setting.rules, {
      drengbu: 'e',
      aKikuI: 'e',
      baAsWa: 'p'
    });
    return phoneticsFor(setting, text);
  };
  const phoneticsLooseFor = function(text) {
    return phoneticsFor('english-super-loose', text);
  };

  const phoneticsFor = function(setting, text) {
    var phonetics = new TibetanToPhonetics({ setting: setting });
    return syllablesFor(text).map(
      (syllable) => phonetics.convert(syllable)
    ).join(' ')
  };

  const convertWylieButKeepNonTibetanParts = function (text, wylieToUnicode) {
    var result = '';
    var tokenizer = new Tokenizer(
      [
        /{[^}]*}/,        // Everything between {} (rules are inversed in tibetan only dictionaries)
        /\([A-Z:,\d]+\)/, // Things like (1234) or (WP:1,194)
      ],
      (chunk, isSeparator) => {
        if (isSeparator)
          result += chunk;
        else
          result += wylieToUnicode.convert(chunk);
      }
    );
    tokenizer.parse(text);
    return result;
  };

  const tibetanWithPunctuationAsTsheks = function (tibetan) {
    return tibetan.replace(tibetanRegexps.punctuation, '་').replace(/་+/g, '་');
  };

  const replaceTibetanGroups = function (text, handler) {
    return text.replace(tibetanRegexps.tibetanGroups, handler);
  };

  const syllablesFor = function (tibetan) {
    return tibetanWithPunctuationAsTsheks(tibetan).split('་').compact(true);
  };

  const cleanTerm = function (text) {
    return text
      .replace(/\"/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/­/g, '')     // Deletes zero-width non-joiner
      .replace(/\s+/g, ' ') // Removes consecutive spaces
      .trim();
  };

  const withTrailingTshek = function (tibetan) {
    return tibetan.replace(tibetanRegexps.endPunctuation, '') + '་';
  };

  const arrayPositionInArray = function (termArray, array) {
    var firstElement = termArray.first();
    var indexesForFirstElement = array.reduce((indexes, value, index) => {
      if (value == firstElement)
        indexes.push(index);
      return indexes;
    }, []);
    var position = indexesForFirstElement.find((index) => {
      return _.isEqual(
        termArray,
        array.from(index).to(termArray.length)
      );
    });
    if (position >= 0)
      return position;
    else
      return -1;
  };

  const substituteLinksWithATags = function(text) {
    return text.replace(
      /((?:https?:\/\/)|(?:www\.))+([-0-9a-zA-Z\/\.\?=&#%_]+)/g,
      (wholeMatch, httpAndWWW, domain) => {
        if (!httpAndWWW.match(/https?:\/\//))
          httpAndWWW = 'http://' + httpAndWWW;
        return `<a target="_blank" href="${httpAndWWW}${domain}">${domain}</a>`;
      }
    )
  };

  exports.arrayPositionInArray = arrayPositionInArray;
  exports.cleanTerm = cleanTerm;
  exports.convertWylieButKeepNonTibetanParts = convertWylieButKeepNonTibetanParts;
  exports.phoneticsFor = phoneticsFor;
  exports.phoneticsForGroups = phoneticsForGroups;
  exports.phoneticsLooseFor = phoneticsLooseFor;
  exports.phoneticsStrictFor = phoneticsStrictFor;
  exports.replaceTibetanGroups = replaceTibetanGroups;
  exports.strictAndLoosePhoneticsFor = strictAndLoosePhoneticsFor;
  exports.substituteLinksWithATags = substituteLinksWithATags;
  exports.syllablesFor = syllablesFor;
  exports.tibetanWithPunctuationAsTsheks = tibetanWithPunctuationAsTsheks;
  exports.withTrailingTshek = withTrailingTshek;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
