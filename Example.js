/*
    This is an example of work done for automated testing refactoring and improvements.
    This file is not complete as the rest was done in collaboration with others and is private to the company.
    It serves simply as an example of my work.

    Built upon node with https://cucumber.io; 

*/


// Example cucumber language

// Old way
Scenario: User is able to request for SetTradingMode
    Given client is connected to endpoint with AdminUserA
    When client requests to SetInternalFeedMode to the system
    Then client receives "SetTradingMode" message with "Successful" status
 

// New way
Scenario: User is able to request for SetTradingMode
    Given client is connected to endpoint with AdminUserA
    When client requests SetTradingMode with parameters: IsTradingEnabled = true
    Then client receives "SetTradingMode" message with "Successful" status

// Generated regex for new method
/^([^\s]*)\s+requests\s+([^\s]*)\s*(?:with\s+parameters:\s+\s*(?:([^\s]*)\s+=\s+"([^"]*)",)?\s*(?:([^\s]*)\s+=\s+"([^"]*)",)?\s*(?:([^\s]*)\s+=\s+"([^"]*)",)?\s*(?:([^\s]*)\s+=\s+"([^"]*)",)?\s*(?:([^\s]*)\s+=\s+"([^"]*)")?\s*(?:([^\s]*)\s+=\s+@\(([^\)]*)\),)?\s*(?:([^\s]*)\s+=\s+@\(([^\)]*)\),)?\s*(?:([^\s]*)\s+=\s+@\(([^\)]*)\),)?\s*(?:([^\s]*)\s+=\s+@\(([^\)]*)\),)?\s*(?:([^\s]*)\s+=\s+@\(([^\)]*)\))?\s*(?:([^\s]*)\s+=\s+(true|false),)?\s*(?:([^\s]*)\s+=\s+(true|false),)?\s*(?:([^\s]*)\s+=\s+(true|false),)?\s*(?:([^\s]*)\s+=\s+(true|false),)?\s*(?:([^\s]*)\s+=\s+(true|false))?)?\s*$/


// Example of old method of writing test cases;

    // Client requests {} 
    that.When(/^([^\s]+)\s+requests\s+to\s+([^\s]+)\s+to\s+the\s+system$/, function (sessionKey, requestName, callback) {
        var session = utils.getSession(sessionKey)
        switch (requestName) {
            case 'SetInternalFeedMode':
                session.setInternalFeedMode(false)
                break
            case 'SetTradingMode':
                session.setTradingMode(true)
                break
            case 'SetAutoExerciseMode':
                session.setAutoExerciseMode(false)
                break
        }
        callback()
    })
  /* 
    Old method provided from before my changes did not allow for optional parameters and required manually setting value per test case.
    New way allows for a single test case function that can be reused for different test definition with a list of parameters set in the definition of the actual test case instead of arbitrarily set in the function
    */

  // New method
  that.When('<client> requests <requestName> [with parameters: <params:paramList>]', function (p, callback) {
            var session = utils.getSession(p.client);
            session.sendRequest(p.requestName, p.params);
            callback();
        });

 this.sendRequest = function (requestName, parameters) {
    var request = {
      ActionId: requestName
    };
    for (var key in parameters) {
      request[key] = parameters[key];
    };
    this._send(request);
  }




var path = require('path');
var arity = require('util-arity');
var ret = {
    init: function (that) {
        that.World = require(path.join(process.cwd(), 'support', 'world.js')).World
        var oldGiven = that.Given;
        var oldWhen = that.When;
        var oldThen = that.Then;
        var parse = function (strPattern, cb, cucumberFn) {

            // Dictionary of parameter types
            var paramTypes = {
                'boolean': '(true|false)',
                'word': '([^\\s]*)',
                'string': '"([^"]*)"',
                'limit': '(min|max|(?:\\d+(?:\\.\\d{1,2})?))',
                'number': '([\\d\\.]+)',
                'json': '@\\(([^\\)]*)\\)'
            };
            var listNames = [];
            var generateOptionalParamList = function (str) {
                var params = '';
                var listName = /<([\w\d]*):paramList>/.exec(str);
                var types = ['string', 'json', 'boolean'];
                if (listName) {
                    listName = listName[1]
                    var i = 0;
                    types.forEach(function (type) {
                        for (var j = 0; j < 5; j++) {
                            if (j < 4) {
                                params += ' [<param_' + listName + i + '> = <value_' + listName + i + ':' + type + '>,]';
                            } else {
                                params += ' [<param_' + listName + i + '> = <value_' + listName + i + ':' + type + '>]';
                            };
                            i++;
                        };
                    });
                    listNames.push(listName);
                };
                return str.replace(/<[\w\d]*:paramList>/gi, params);
            };

            // Backwards compatibility. Normal Cucumber regex will still work
            var regex = strPattern;
            var oldCb = cb;

            if (typeof strPattern === 'string') {
                // Create new base regex. Spaces are replaced with regex characters. Optional groups are created.
                var newPattern = generateOptionalParamList(strPattern);
                newPattern = newPattern.replace(/\s/g, '\\s+')
                    .replace(/(?:\\s\+)?\[/g, '\\s*(?:')
                    .replace(/\]/g, ')?');

                // Pattern for new way of writting variables
                var paramPattern = /<([\w\d]*)(?:\:([\w\d]*))?>/gi
                var params = [];
                var result;
                while ((result = paramPattern.exec(newPattern)) !== null) {
                    params.push(result);
                }
                var paramList = [];
                params.forEach(function (param) {
                    var paramName = param[1];
                    var paramType = param[2] || "word";
                    paramList.push(paramName);
                    var reg = new RegExp(param[0], 'g');
                    newPattern = newPattern.replace(reg, paramTypes[paramType]);
                });

                // Regex is generated
                regex = new RegExp('^' + newPattern + '\\s*$');

                // New callback. Arity allows us to set argument length. This allows cucumber to properly accept our list of arguments
                oldCb = arity(paramList.length + 1, function () {
                    var p = {};
                    var listIndexes = [];
                    listNames.forEach(function (list) {
                        listIndexes.push(paramList.indexOf('param_' + list + '0'));
                    });
                    var inList = false;
                    var currentList = null;
                    var parseValue = function (value, type) {
                        switch (type) {
                            case 'json':
                                value = JSON.parse(value);
                                break;
                            case 'boolean':
                                value = value === 'true';
                                break;
                        }
                        return value;
                    }
                    for (var i = 0; i < paramList.length; i++) {
                        // All defined optional parameters are added to a new object which inherits optional parameter list name
                        var indexOfList = listIndexes.indexOf(i);
                        if (~indexOfList || inList) {
                            if (!inList) {
                                currentList = listNames[indexOfList]
                                p[currentList] = {};
                                inList = true;
                            };
                            // Variable names and values are matched
                            if (arguments[i]) {
                                var arg = arguments[i + 1];
                                p[currentList][arguments[i]] = parseValue(arg, params[i + 1][2]);
                            };
                            i++;
                            if (arguments[i] && !arguments[i].match('param_' + currentList + i)) {
                                inList = false;
                            };
                        } else {
                            p[paramList[i]] = parseValue(arguments[i], params[i][2]);
                        };
                    };
                    cb(p, arguments[arguments.length - 1]);
                });
            };
            cucumberFn(regex, oldCb);
        }

        // Register events
        that.Given = function (strPattern, cb) {
            parse(strPattern, cb, oldGiven);
        }
        that.When = function (strPattern, cb) {
            parse(strPattern, cb, oldWhen);
        }
        that.Then = function (strPattern, cb) {
            parse(strPattern, cb, oldThen);
        }
    }
}