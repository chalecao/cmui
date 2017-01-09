 (function(factory){
 	// AMD
 	if( typeof define !== "undefined" && define["amd"] ){
 		define(["exports", "knockout", "$", "_"], factory);
 	// No module loader
 	}else{
 		factory( window["qpf"] = {}, ko, $, _);
 	}

})(function(_exports, ko, $, _){

/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

var _define = define;
// Here if we directly use define, the app build on it will have some problem when running the optimized version
// I guess the optimizer will use regexp to detemine if the depedencies is defined in the file already
// And it find jQuery, knokcout, underscore is defined in the qpf, even if it is in closure
// and won't affect the outer environment. And optimizer won't add the dependencies file in the final optimized js file.
_define("$", [], function(){
    return $;
});
_define("knockout", [], function(){
    return ko;
});
_define("_", [], function(){
    return _;
});

define('core/mixin/derive',['require','_'],function(require){

var _ = require("_");

/**
 * derive a sub class from base class
 * @makeDefaultOpt [Object|Function] default option of this sub class, 
                        method of the sub can use this.xxx to access this option
 * @initialize [Function](optional) initialize after the sub class is instantiated
 * @proto [Object](optional) prototype methods/property of the sub class
 *
 */
function derive(makeDefaultOpt, initialize/*optional*/, proto/*optional*/){

    if( typeof initialize == "object"){
        proto = initialize;
        initialize = null;
    }

    // extend default prototype method
    var extendedProto = {
        // instanceof operator cannot work well,
        // so we write a method to simulate it
        'instanceof' : function(constructor){
            var selfConstructor = sub;
            while(selfConstructor){
                if( selfConstructor === constructor ){
                    return true;
                }
                selfConstructor = selfConstructor.__super__;
            }
        }
    }

    var _super = this;

    var sub = function(options){

        // call super constructor
        _super.call( this );

        // call defaultOpt generate function each time
        // if it is a function, So we can make sure each 
        // property in the object is fresh
        _.extend( this, typeof makeDefaultOpt == "function" ?
                        makeDefaultOpt.call(this) : makeDefaultOpt );

        _.extend( this, options );

        if( this.constructor == sub){
            // find the base class, and the initialize function will be called 
            // in the order of inherit
            var base = sub,
                initializeChain = [initialize];
            while(base.__super__){
                base = base.__super__;
                initializeChain.unshift( base.__initialize__ );
            }
            for(var i = 0; i < initializeChain.length; i++){
                if( initializeChain[i] ){
                    initializeChain[i].call( this );
                }
            }
        }
    };
    // save super constructor
    sub.__super__ = _super;
    // initialize function will be called after all the super constructor is called
    sub.__initialize__ = initialize;

    // extend prototype function
    _.extend( sub.prototype, _super.prototype, extendedProto, proto);

    sub.prototype.constructor = sub;
    
    // extend the derive method as a static method;
    sub.derive = _super.derive;


    return sub;
}

return {
    derive : derive
}

});
define('core/mixin/event',[],function(){

/**
 * Event interface
 * + on(eventName, handler[, context])
 * + trigger(eventName[, arg1[, arg2]])
 * + off(eventName[, handler])
 */
return{
    trigger : function(){
        if( ! this.__handlers__){
            return;
        }
        var name = arguments[0];
        var params = Array.prototype.slice.call( arguments, 1 );

        var handlers = this.__handlers__[ name ];
        if( handlers ){
            for( var i = 0; i < handlers.length; i+=2){
                var handler = handlers[i],
                    context = handlers[i+1];
                handler.apply(context || this, params);
            }
        }
    },
    
    on : function( target, handler, context/*optional*/ ){

        if( ! target){
            return;
        }
        var handlers = this.__handlers__ || ( this.__handlers__={} );
        if( ! handlers[target] ){
            handlers[target] = [];
        }
        if( handlers[target].indexOf(handler) == -1){
            // structure in list
            // [handler,context,handler,context,handler,context..]
            handlers[target].push( handler );
            handlers[target].push( context );
        }

        return handler;
    },

    off : function( target, handler ){
        
        var handlers = this.__handlers__ || ( this.__handlers__={} );

        if( handlers[target] ){
            if( handler ){
                var arr = handlers[target];
                // remove handler and context
                var idx = arr.indexOf(handler);
                if( idx >= 0)
                    arr.splice( idx, 2 );
            }else{
                handlers[target] = [];
            }
        }

    }
}
});
define('core/clazz',['require','./mixin/derive','./mixin/event','_'],function(require){

    var deriveMixin = require("./mixin/derive");
    var eventMixin = require("./mixin/event");
    var _ = require("_");

    var Clazz = new Function();
    _.extend(Clazz, deriveMixin);
    _.extend(Clazz.prototype, eventMixin);

    return Clazz;
});
//=====================================
// Base class of all components
// it also provides some util methods like
//=====================================
define('base',['require','core/clazz','core/mixin/event','knockout','$','_'],function(require){

var Clazz = require("core/clazz");
var Event = require("core/mixin/event");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var repository = {};    //repository to store all the component instance

var Base = Clazz.derive(function(){
return {    // Public properties
    // Name of component, will be used in the query of the component
    name : "",
    // Tag of wrapper element
    tag : "div",
    // Attribute of the wrapper element
    attr : {},
    // Jquery element as a wrapper
    // It will be created in the constructor
    $el : null,
    // Attribute will be applied to self
    // WARNING: It will be only used in the constructor
    // So there is no need to re-assign a new viewModel when created an instance
    // if property in the attribute is a observable
    // it will be binded to the property in viewModel
    attributes : {},
    
    parent : null,
    // ui skin
    skin : "",
    // Class prefix
    classPrefix : "qpf-ui-",
    // Skin prefix
    skinPrefix : "qpf-skin-",

    id : ko.observable(""),
    width : ko.observable(),
    class : ko.observable(),
    height : ko.observable(),
    visible : ko.observable(true),
    disable : ko.observable(false),
    style : ko.observable(""),

    // If the temporary is set true,
    // It will not be stored in the repository and 
    // will be destroyed when there are no reference any more
    // Maybe a ugly solution to prevent memory leak 
    temporary : false,
    // events list inited at first time
    events : {}
}}, function(){ //constructor

    this.__GUID__ = genGUID();
    // add to repository
    if( ! this.temporary ){
        repository[this.__GUID__] = this;
    }

    if( ! this.$el){
        this.$el = $(document.createElement(this.tag));
    }
    this.$el[0].setAttribute("data-qpf-guid", this.__GUID__);

    this.$el.attr(this.attr);
    if( this.skin ){
        this.$el.addClass( this.withPrefix(this.skin, this.skinPrefix) );
    }

    if( this.css ){
        _.each( _.union(this.css), function(className){
            this.$el.addClass( this.withPrefix(className, this.classPrefix) );
        }, this)
    }
    // Class name of wrapper element is depend on the lowercase of component type
    // this.$el.addClass( this.withPrefix(this.type.toLowerCase(), this.classPrefix) );

    this.width.subscribe(function(newValue){
        this.$el.width(newValue);
        this.onResize();
    }, this);
    this.height.subscribe(function(newValue){
        this.$el.height(newValue);
        this.onResize();
    }, this);
    this.disable.subscribe(function(newValue){
        this.$el[newValue?"addClass":"removeClass"]("qpf-disable");
    }, this);
    this.id.subscribe(function(newValue){
        this.$el.attr("id", newValue);
    }, this);
    this.class.subscribe(function(newValue){
        this.$el.addClass( newValue );
    }, this);
    this.visible.subscribe(function(newValue){
        newValue ? this.$el.show() : this.$el.hide();
    }, this);
    this.style.subscribe(function(newValue){
        var valueSv = newValue;
        var styleRegex = /(\S*?)\s*:\s*(.*)/g;
        // preprocess the style string
        newValue = "{" + _.chain(newValue.split(";"))
                        .map(function(item){
                            return item.replace(/(^\s*)|(\s*$)/g, "") //trim
                                        .replace(styleRegex, '"$1":"$2"');
                        })
                        .filter(function(item){return item;})
                        .value().join(",") + "}";
        try{
            var obj = ko.utils.parseJson(newValue);
            this.$el.css(obj);
        }catch(e){
            console.error("Syntax Error of style: "+ valueSv);
        }
    }, this);

    // register the events before initialize
    for( var name in this.events ){
        var handler = this.events[name];
        if( typeof(handler) == "function"){
            this.on(name, handler);
        }
    }

    // apply attribute 
    this._mappingAttributes( this.attributes );

    this.initialize();
    this.trigger("initialize");
    // Here we removed auto rendering at constructor
    // to support deferred rendering after the $el is attached
    // to the document
    // this.render();

}, {// Prototype
    // Type of component. The className of the wrapper element is
    // depend on the type
    type : "BASE",
    // Template of the component, will be applyed binging with viewModel
    template : "",
    // Declare the events that will be provided 
    // Developers can use on method to subscribe these events
    // It is used in the binding handlers to judge which parameter
    // passed in is events
    eventsProvided : ["click", "mousedown", "mouseup", "mousemove", "resize",
                        "initialize", "beforerender", "render", "dispose"],

    // Will be called after the component first created
    initialize : function(){},
    // set the attribute in the modelView
    set : function(key, value){
        if( typeof(key) == "string" ){
            var source = {};
            source[key] = value;
        }else{
            source = key;
        };
        this._mappingAttributes( source, true );
    },
    // Call to refresh the component
    // Will trigger beforeRender and afterRender hooks
    // beforeRender and afterRender hooks is mainly provide for
    // the subclasses
    render : function(){
        this.beforeRender && this.beforeRender();
        this.trigger("beforerender");

        this.doRender();
        this.afterRender && this.afterRender();

        this.trigger("render");
        // trigger the resize events
        this.onResize();
    },
    // Default render method
    doRender : function(){
        this.$el.children().each(function(){
            Base.disposeDom( this );
        })

        this.$el.html(this.template);
        ko.applyBindings( this, this.$el[0] );
    },
    // Dispose the component instance
    dispose : function(){
        if( this.$el ){
            // remove the dom element
            this.$el.remove()
        }
        // remove from repository
        repository[this.__GUID__] = null;

        this.trigger("dispose");
    },
    resize : function(width, height){
        if( typeof(width) === "number"){
            this.width( width );
        }
        if( typeof(height) == "number"){
            this.height( height );
        }
    },
    onResize : function(){
        this.trigger('resize');
    },
    withPrefix : function(className, prefix){
        if( className.indexOf(prefix) != 0 ){
            return prefix + className;
        }
    },
    withoutPrefix : function(className, prefix){
        if( className.indexOf(prefix) == 0){
            return className.substr(prefix.length);
        }
    },
    _mappingAttributes : function(attributes, onlyUpdate){
        for(var name in attributes){
            var attr = attributes[name];
            var propInVM = this[name];
            // create new attribute when property is not existed, even if it will not be used
            if( typeof(propInVM) === "undefined" ){
                var value = ko.utils.unwrapObservable(attr);
                // is observableArray or plain array
                if( (ko.isObservable(attr) && attr.push) ||
                    attr.constructor == Array){
                    this[name] = ko.observableArray(value);
                }else{
                    this[name] = ko.observable(value);
                }
                propInVM = this[name];
            }
            else if( ko.isObservable(propInVM) ){
                propInVM(ko.utils.unwrapObservable(attr) );
            }else{
                this[name] = ko.utils.unwrapObservable(attr);
            }
            if( ! onlyUpdate){
                // Two-way data binding if the attribute is an observable
                if( ko.isObservable(attr) ){
                    bridge(propInVM, attr);
                }
            }
        }   
    }
})

// register proxy events of dom
var proxyEvents = ["click", "mousedown", "mouseup", "mousemove"];
Base.prototype.on = function(eventName){
    // lazy register events
    if( proxyEvents.indexOf(eventName) >= 0 ){
        this.$el.unbind(eventName, proxyHandler)
        .bind(eventName, {context : this}, proxyHandler);
    }
    Event.on.apply(this, arguments);
}
function proxyHandler(e){
    var context = e.data.context;
    var eventType = e.type;

    context.trigger(eventType);
}


// get a unique component by guid
Base.get = function(guid){
    return repository[guid];
}
Base.getByDom = function(domNode){
    var guid = domNode.getAttribute("data-qpf-guid");
    return Base.get(guid);
}

// dispose all the components attached in the domNode and
// its children(if recursive is set true)
Base.disposeDom = function(domNode, resursive){

    if(typeof(recursive) == "undefined"){
        recursive = true;
    }

    function dispose(node){
        var guid = node.getAttribute("data-qpf-guid");
        var component = Base.get(guid);
        if( component ){
            // do not recursive traverse the children of component
            // element
            // hand over dispose of sub element task to the components
            // it self
            component.dispose();
        }else{
            if( recursive ){
                for(var i = 0; i < node.childNodes.length; i++){
                    var child = node.childNodes[i];
                    if( child.nodeType == 1 ){
                        dispose( child );
                    }
                }
            }
        }
    }

    dispose(domNode);
}

// util function of generate a unique id
var genGUID = (function(){
    var id = 0;
    return function(){
        return id++;
    }
})();

//----------------------------
// knockout extenders
ko.extenders.numeric = function(target, precision) {

    var fixer = ko.computed({
        read : target,
        write : function(newValue){ 
            if( newValue === "" ){
                target("");
                return;
            }else{
                var val = parseFloat(newValue);
            }
            val = isNaN( val ) ? 0 : val;
            var precisionValue = parseFloat( ko.utils.unwrapObservable(precision) );
            if( ! isNaN( precisionValue ) ) {
                var multiplier = Math.pow(10, precisionValue);
                val = Math.round(val * multiplier) / multiplier;
            }
            target(val);
        }
    });

    fixer( target() );

    return fixer;
};

ko.extenders.clamp = function(target, options){
    var min = options.min;
    var max = options.max;

    var clamper = ko.computed({
        read : target,
        write : function(value){
            var minValue = parseFloat( ko.utils.unwrapObservable(min) ),
                maxValue = parseFloat( ko.utils.unwrapObservable(max) );

            if( ! isNaN(minValue) ){
                value = Math.max(minValue, value);
            }
            if( ! isNaN(maxValue) ){
                value = Math.min(maxValue, value);
            }
            target(value);
        }
    })

    clamper( target() );
    return clamper;
}

//-------------------------------------------
// Handle bingings in the knockout template

var bindings = {};
Base.provideBinding = function(name, Component ){
    bindings[name] = Component;
}

Base.create = function(name, config){
    var Constructor = bindings[name];
    if(Constructor){
        return new Constructor(config);
    }
}

// provide bindings to knockout
ko.bindingHandlers["qpf"] = {

    createComponent : function(element, valueAccessor){
        // dispose the previous component host on the element
        var prevComponent = Base.getByDom( element );
        if( prevComponent ){
            prevComponent.dispose();
        }
        var component = createComponentFromDataBinding( element, valueAccessor, bindings );
        return component;
    },

    init : function( element, valueAccessor ){

        var component = ko.bindingHandlers["qpf"].createComponent(element, valueAccessor);

        component.render();
        // not apply bindings to the descendant doms in the UI component
        return { 'controlsDescendantBindings': true };
    },

    update : function( element, valueAccessor ){}
}

// append the element of view in the binding
ko.bindingHandlers["qpf_view"] = {
    init : function(element, valueAccessor){
        var value = valueAccessor();

        var subView = ko.utils.unwrapObservable(value);
        if( subView && subView.$el ){
            Base.disposeDom(element);
            element.parentNode.replaceChild(subView.$el[0], element);
        }
        // PENDING
        // handle disposal (if KO removes by the template binding)
        // ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
        //     subView.dispose();
        // });

        return { 'controlsDescendantBindings': true };
    },

    update : function(element, valueAccessor){
    }
}

//-----------------------------------
// Provide plugins to jquery
$.fn.qpf = function( op, viewModel ){
    op = op || "get";
    if( op === "get"){
        var result = [];
        this.each(function(){
            var item = Base.getByDom(this);
            if( item ){
                result.push(item);
            }
        })
        return result;
    }else if( op === "init"){
        this.each(function(){
            ko.applyBindings(viewModel, this);
        });
        return this.qpf("get");
    }else if(op === "dispose"){
        this.each(function(){
            Base.disposeDom(this);
        })
    }
}

//------------------------------------
// Util functions
var unwrap = ko.utils.unwrapObservable;

function createComponentFromDataBinding(element, valueAccessor){

    var value = valueAccessor();
    
    var options = unwrap(value) || {};
    var type = unwrap(options.type);

    if( type ){
        var Constructor = bindings[type];

        if( Constructor ){
            var component = createComponentFromJSON( options, Constructor)
            if( component ){
                element.innerHTML = "";
                element.appendChild( component.$el[0] );
                
                $(element).addClass("qpf-wrapper");
            }
            // save the guid in the element data attribute
            element.setAttribute("data-qpf-guid", component.__GUID__);
        }else{
            console.error("Unkown UI type, " + type);
        }
    }else{
        console.error("UI type is needed");
    }
    return component;
}

function createComponentFromJSON(options, Constructor){

    var type = unwrap(options.type),
        name = unwrap(options.name),
        attr = _.omit(options, "type", "name");

    var events = {};

    // Find which property is event
    _.each(attr, function(value, key){
        if( key.indexOf("on") == 0 &&
            Constructor.prototype.eventsProvided.indexOf(key.substr("on".length)) >= 0 &&
            typeof(value) == "function"){
            delete attr[key];
            events[key.substr("on".length)] = value;
        }
    })

    var component = new Constructor({
        name : name || "",
        attributes : attr,
        events : events
    });

    return component;
}

// build a bridge of twe observables
// and update the value from source to target
// at first time
function bridge(target, source){
    
    target( source() );

    // Save the previous value with clone method in underscore
    // In case the notification is triggered by push methods of
    // Observable Array and the commonValue instance is same with new value
    // instance
    // Reference : `set` method in backbone
    var commonValue = _.clone( target() );
    target.subscribe(function(newValue){
        // Knockout will always suppose the value is mutated each time it is writted
        // the value which is not primitive type(like array)
        // So here will cause a recurse trigger if the value is not a primitive type
        // We use underscore deep compare function to evaluate if the value is changed
        // PENDING : use shallow compare function?
        try{
            if( ! _.isEqual(commonValue, newValue) ){
                commonValue = _.clone( newValue );
                source(newValue);
            }
        }catch(e){
            // Normally when source is computed value
            // and it don't have a write function
            console.error(e.toString());
        }
    })
    source.subscribe(function(newValue){
        try{
            if( ! _.isEqual(commonValue, newValue) ){
                commonValue = _.clone( newValue );
                target(newValue);
            }
        }catch(e){
            console.error(e.toString());
        }
    })
}

// export the interface
return Base;

});
//============================================
// Base class of all container component
//============================================
define('container/container',['require','../base','knockout','$','_'],function(require){

var Base = require("../base");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Container = Base.derive(function(){
    return {
        // all child components
        children : ko.observableArray()
    }
}, {

    type : "CONTAINER",

    css : 'container',
    
    template : '<div data-bind="foreach:children" class="qpf-children">\
                    <div data-bind="qpf_view:$data"></div>\
                </div>',
    initialize : function(){
        var self = this,
            oldArray = this.children().slice();
        this.children.subscribe(function(newArray){
            var differences = ko.utils.compareArrays( oldArray, newArray );
            _.each(differences, function(item){
                // In case the dispose operation is launched by the child component
                if( item.status == "added"){
                    item.value.on("dispose", _onItemDispose, item.value);
                }else if(item.status == "deleted"){
                    item.value.off("dispose", _onItemDispose);
                }
            }, this);
        });
        function _onItemDispose(){  
            self.remove( this );
        }
    },
    // add child component
    add : function( sub ){
        sub.parent = this;
        this.children.push( sub );
        // Resize the child to fit the parent
        sub.onResize();
    },
    // remove child component
    remove : function( sub ){
        sub.parent = null;
        this.children.remove( sub );
    },
    removeAll : function(){
        _.each(this.children(), function(child){
            child.parent = null;
        }, this);
        this.children([]);
    },
    children : function(){
        return this.children()
    },
    doRender : function(){
        // do render in the hierarchy from parent to child
        // traverse tree in pre-order
        
        Base.prototype.doRender.call(this);

        _.each(this.children(), function(child){
            child.render();
        })

    },
    // resize when width or height is changed
    onResize : function(){
        // stretch the children
        if( this.height() ){
            this.$el.children(".qpf-children").height( this.height() ); 
        }
        // trigger the after resize event in post-order
        _.each(this.children(), function(child){
            child.onResize();
        }, this);
        Base.prototype.onResize.call(this);
    },
    dispose : function(){
        
        _.each(this.children(), function(child){
            child.dispose();
        });

        Base.prototype.dispose.call( this );
    },
    // get child component by name
    get : function( name ){
        if( ! name ){
            return;
        }
        return _.filter( this.children(), function(item){ return item.name === name } )[0];
    }
})

Container.provideBinding = Base.provideBinding;

// modify the qpf bindler
var baseBindler = ko.bindingHandlers["qpf"];
ko.bindingHandlers["qpf"] = {

    init : function(element, valueAccessor, allBindingsAccessor, viewModel){
        
        //save the child nodes before the element's innerHTML is changed in the createComponentFromDataBinding method
        var childNodes = Array.prototype.slice.call(element.childNodes);

        var component = baseBindler.createComponent(element, valueAccessor);

        if( component && component.instanceof(Container) ){
            // hold the renderring of children until parent is renderred
            // If the child renders first, the element is still not attached
            // to the document. So any changes of observable will not work.
            // Even worse, the dependantObservable is disposed so the observable
            // is detached in to the dom
            // https://groups.google.com/forum/?fromgroups=#!topic/knockoutjs/aREJNrD-Miw
            var subViewModel = {
                '__deferredrender__' : true 
            }
            _.extend(subViewModel, viewModel);
            // initialize from the dom element
            for(var i = 0; i < childNodes.length; i++){
                var child = childNodes[i];
                if( ko.bindingProvider.prototype.nodeHasBindings(child) ){
                    // Binding with the container's viewModel
                    ko.applyBindings(subViewModel, child);
                    var sub = Base.getByDom( child );
                    if( sub ){
                        component.add( sub );
                    }
                }
            }
        }
        if( ! viewModel['__deferredrender__']){
            
            component.render();
        }

        return { 'controlsDescendantBindings': true };

    },
    update : function(element, valueAccessor){
        baseBindler.update(element, valueAccessor);
    }
}

Container.provideBinding("container", Container);

return Container;

});
//=============================================================
// application.js
// 
// Container of the whole web app, mainly for monitor the resize
// event of Window and resize all the component in the app
//=============================================================

define('container/application',['require','./container','knockout','$'],function(require){

var Container = require("./container");
var ko = require("knockout");
var $ = require("$");

var Application = Container.derive(function(){

}, {

    type : "APPLICATION",
    
    css : "application",

    initialize : function(){

        $(window).resize( this._resize.bind(this) );
        this._resize();
    },

    _resize : function(){
        this.width( $(window).width() );
        this.height( $(window).height() );
    }
})

Container.provideBinding("application", Application);

return Application;

});
//===============================================
// base class of vbox and hbox
//===============================================

define('container/box',['require','./container','knockout','$','_'],function(require){

var Container = require("./container");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Box = Container.derive(function(){

return {

}}, {

    type : 'BOX',

    css : 'box',

    initialize : function(){

        this.children.subscribe(function(children){
            this.onResize();
            // resize after the child resize happens will cause recursive
            // reszie problem
            // _.each(children, function(child){
            //  child.on('resize', this.onResize, this);
            // }, this)
        }, this);

        this.$el.css("position", "relative");

        Container.prototype.initialize.call(this);
    },

    _getMargin : function($el){
        return {
            left : parseInt($el.css("marginLeft")) || 0,
            top : parseInt($el.css("marginTop")) || 0,
            bottom : parseInt($el.css("marginBottom")) || 0,
            right : parseInt($el.css("marginRight")) || 0,
        }
    },

    _resizeTimeout : 0,

    onResize : function(){

        var self = this;
        // put resize in next tick,
        // if multiple child have triggered the resize event
        // it will do only once;
        if( this._resizeTimeout ){
            clearTimeout( this._resizeTimeout );
        }
        this._resizeTimeout = setTimeout(function(){
            self.resizeChildren();
            Container.prototype.onResize.call(self);
        });

    }

})


// Container.provideBinding("box", Box);

return Box;

});
//===============================================
// hbox layout
// 
// Items of hbox can have flex and prefer two extra properties
// About this tow properties, can reference to flexbox in css3
// http://www.w3.org/TR/css3-flexbox/
// https://github.com/doctyper/flexie/blob/master/src/flexie.js
//===============================================

define('container/hbox',['require','./container','./box','knockout','$','_'],function(require){

var Container = require("./container");
var Box = require("./box");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var hBox = Box.derive(function(){

return {

}}, {

    type : 'HBOX',

    css : 'hbox',

    resizeChildren : function(){

        var flexSum = 0;
        var remainderWidth = this.$el.width();
        var childrenWithFlex = [];

        var marginCache = [];
        var marginCacheWithFlex = [];

        _.each(this.children(), function(child, idx){
            var margin = this._getMargin(child.$el);
            marginCache.push(margin);
            // stretch the height
            // (when align is stretch)
            child.height( this.$el.height()-margin.top-margin.bottom );

            var prefer = ko.utils.unwrapObservable( child.prefer );

            // item has a prefer size;
            if( prefer ){
                // TODO : if the prefer size is lager than vbox size??
                prefer = Math.min(prefer, remainderWidth);
                child.width( prefer );

                remainderWidth -= prefer+margin.left+margin.right;
            }else{
                var flex = parseInt(ko.utils.unwrapObservable( child.flex ) || 1);
                // put it in the next step to compute
                // the height based on the flex property
                childrenWithFlex.push(child);
                marginCacheWithFlex.push(margin);

                flexSum += flex;
            }
        }, this);

        _.each( childrenWithFlex, function(child, idx){
            var margin = marginCacheWithFlex[idx];
            var flex = parseInt(ko.utils.unwrapObservable( child.flex ) || 1);
            var ratio = flex / flexSum;

            child.width( Math.floor(remainderWidth*ratio)-margin.left-margin.right );   
        })

        var prevWidth = 0;
        _.each(this.children(), function(child, idx){
            var margin = marginCache[idx];
            child.$el.css({
                "position" : "absolute",
                "top" : '0px',
                "left" : prevWidth + "px"
            });
            prevWidth += child.width()+margin.left+margin.right;
        })
    }

})


Container.provideBinding("hbox", hBox);

return hBox;

});
//=============================================
// Inline Layout
//=============================================
define('container/inline',['require','./container','knockout','$'],function(require){

var Container = require("./container");
var ko = require("knockout");
var $ = require("$");

var Inline = Container.derive({
}, {

    type : "INLINE",

    css : "inline",

    template : '<div data-bind="foreach:children" class="qpf-children">\
                    <div data-bind="qpf_view:$data"></div>\
                </div>\
                <div style="clear:both"></div>'
})

Container.provideBinding("inline", Inline);

return Inline;

});
//===================================
// Panel
// Container has title and content
//===================================
define('container/panel',['require','./container','knockout','$'],function(require){

var Container = require("./container");
var ko = require("knockout");
var $ = require("$");

var Panel = Container.derive(function(){
    return {
        title : ko.observable("")
    }
}, {

    type : 'PANEL',

    css : 'panel',

    template : '<div class="qpf-panel-header">\
                    <div class="qpf-panel-title" data-bind="html:title"></div>\
                    <div class="qpf-panel-tools"></div>\
                </div>\
                <div class="qpf-panel-body" data-bind="foreach:children" class="qpf-children">\
                    <div data-bind="qpf_view:$data"></div>\
                </div>\
                <div class="qpf-panel-footer"></div>',
    
    afterRender : function(){
        var $el = this.$el;
        this._$header = $el.children(".qpf-panel-header");
        this._$tools = this._$header.children(".qpf-panel-tools");
        this._$body = $el.children(".qpf-panel-body");
        this._$footer = $el.children(".qpf-panel-footer");
    },

    onResize : function(){
        // stretch the body when the panel's height is given
        if( this._$body && this.height() ){
            var headerHeight = this._$header.height();
            var footerHeight = this._$footer.height();

            // PENDING : here use jquery innerHeight method ?because we still 
            // need to consider the padding of body
            this._$body.height( this.$el.height() - headerHeight - footerHeight );
    
        }
        Container.prototype.onResize.call(this);
    }
})

Container.provideBinding("panel", Panel);

return Panel;

})

;
//============================================
// Tab Container
// Children of tab container must be a panel
//============================================
define('container/tab',['require','./container','./panel','knockout','$','_'],function(require){

var Container = require("./container");
var Panel = require("./panel");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Tab = Panel.derive(function(){

    var ret = {
            
        actived : ko.observable(0),

        maxTabWidth : 100,

        minTabWidth : 30

    }

    ret.actived.subscribe(function(idx){
        this._active(idx);
    }, this);

    return ret;
}, {

    type : "TAB",

    css : 'tab',

    add : function(item){
        if( item.instanceof(Panel) ){
            Panel.prototype.add.call(this, item);
        }else{
            console.error("Children of tab container must be instance of panel");
        }
        this._active( this.actived() );
    },

    eventsProvided : _.union('change', Container.prototype.eventsProvided),

    initialize : function(){
        // compute the tab value;
        this.children.subscribe(function(){
            this._updateTabSize();
        }, this);

        Panel.prototype.initialize.call(this);
    },

    template : '<div class="qpf-tab-header">\
                    <ul class="qpf-tab-tabs" data-bind="foreach:children">\
                        <li data-bind="click:$parent.actived.bind($data, $index())">\
                            <a data-bind="html:title"></a>\
                        </li>\
                    </ul>\
                    <div class="qpf-tab-tools"></div>\
                </div>\
                <div class="qpf-tab-body">\
                    <div class="qpf-tab-views" data-bind="foreach:children" class="qpf-children">\
                        <div data-bind="qpf_view:$data"></div>\
                    </div>\
                </div>\
                <div class="qpf-tab-footer"></div>',

    afterRender : function(){
        this._updateTabSize();
        // cache the $element will be used
        var $el = this.$el;
        this._$header = $el.children(".qpf-tab-header");
        this._$tools = this._$header.children(".qpf-tab-tools");
        this._$body = $el.children(".qpf-tab-body");
        this._$footer = $el.children('.qpf-tab-footer');

        this._active( this.actived() );
    },

    onResize : function(){
        this._adjustCurrentSize();
        this._updateTabSize();
        Container.prototype.onResize.call(this);
    },

    _unActiveAll : function(){
        _.each(this.children(), function(child){
            child.$el.css("display", "none");
        });
    },

    _updateTabSize : function(){
        var length = this.children().length,
            tabSize = Math.floor((this.$el.width()-20)/length);
        // clamp
        tabSize = Math.min(this.maxTabWidth, Math.max(this.minTabWidth, tabSize) );

        this.$el.find(".qpf-tab-header>.qpf-tab-tabs>li").width(tabSize);
    },

    _adjustCurrentSize : function(){

        var current = this.children()[ this.actived() ];
        if( current && this._$body ){
            var headerHeight = this._$header.height(),
                footerHeight = this._$footer.height();

            if( this.height() &&
                this.height() !== "auto" ){
                current.height( this.$el.height() - headerHeight - footerHeight );
            }
            // PENDING : compute the width ???
            if( this.width() == "auto" ){
            }
        }
    },

    _active : function(idx){
        this._unActiveAll();
        var current = this.children()[idx];
        if( current ){
            current.$el.css("display", "block");

            // Trigger the resize events manually
            // Because the width and height is zero when the panel is hidden,
            // so the children may not be properly layouted, We need to force the
            // children do layout again when panel is visible;
            this._adjustCurrentSize();
            current.onResize();

            this.trigger('change', idx, current);
        }

        this.$el.find(".qpf-tab-header>.qpf-tab-tabs>li")
                .removeClass("actived")
                .eq(idx).addClass("actived");
    }

})

Container.provideBinding("tab", Tab);

return Tab;

});
//===============================================
// vbox layout
// 
// Items of vbox can have flex and prefer two extra properties
// About this tow properties, can reference to flexbox in css3
// http://www.w3.org/TR/css3-flexbox/
// https://github.com/doctyper/flexie/blob/master/src/flexie.js
// TODO : add flexbox support
//       align 
//      padding ????
//===============================================

define('container/vbox',['require','./container','./box','knockout','$','_'],function(require){

var Container = require("./container");
var Box = require("./box");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var vBox = Box.derive(function(){

    return {
    }
}, {

    type : 'VBOX',

    css : 'vbox',

    resizeChildren : function(){

        var flexSum = 0,
            remainderHeight = this.$el.height(),
            childrenWithFlex = [];

            marginCache = [],
            marginCacheWithFlex = [];

        _.each(this.children(), function(child){
            var margin = this._getMargin(child.$el);
            marginCache.push(margin);
            // stretch the width
            // (when align is stretch)
            child.width( this.$el.width()-margin.left-margin.right );

            var prefer = ko.utils.unwrapObservable( child.prefer );

            // item has a prefer size;
            if( prefer ){
                // TODO : if the prefer size is lager than vbox size??
                prefer = Math.min(prefer, remainderHeight);
                child.height( prefer );

                remainderHeight -= prefer+margin.top+margin.bottom;
            }else{
                var flex = parseInt(ko.utils.unwrapObservable( child.flex ) || 1);
                // put it in the next step to compute
                // the height based on the flex property
                childrenWithFlex.push(child);
                marginCacheWithFlex.push(margin);

                flexSum += flex;
            }
        }, this);

        _.each( childrenWithFlex, function(child, idx){
            var margin = marginCacheWithFlex[idx];
            var flex = parseInt(ko.utils.unwrapObservable( child.flex ) || 1),
                ratio = flex / flexSum;
            child.height( Math.floor(remainderHeight*ratio)-margin.top-margin.bottom ); 
        })

        var prevHeight = 0;
        _.each(this.children(), function(child, idx){
            var margin = marginCache[idx];
            child.$el.css({
                "position" : "absolute",
                "left" : '0px', // still set left to zero, use margin to fix the layout
                "top" : prevHeight + "px"
            })
            prevHeight += child.height()+margin.top+margin.bottom;
        })
    }

})


Container.provideBinding("vbox", vBox);

return vBox;

});
//=================================
// mixin to provide draggable interaction
// support multiple selection
//
// @property    helper
// @property    axis "x" | "y"
// @property    container
// @method      add( target[, handle] )
// @method      remove( target )
//=================================

define('helper/draggable',['require','core/mixin/derive','core/mixin/event','knockout','$','_'],function(require){

var Derive = require("core/mixin/derive");
var Event = require("core/mixin/event");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Clazz = new Function();
_.extend(Clazz, Derive);
_.extend(Clazz.prototype, Event);

//---------------------------------
var DraggableItem = Clazz.derive(function(){
return {

    id : 0,

    target : null,

    handle : null,

    margins : {},

    // original position of the target relative to 
    // its offsetParent, here we get it with jQuery.position method
    originPosition : {},

    // offset of the offsetParent, which is get with jQuery.offset
    // method
    offsetParentOffset : {},
    // cache the size of the draggable target
    width : 0,
    height : 0,
    // save the original css position of dragging target
    // to be restored when stop the drag
    positionType : "",
    //
    // data to be transferred
    data : {},

    // instance of [Draggable]
    host : null
}}, {
    
    setData : function( data ){

    },

    remove : function(){
        this.host.remove( this.target );
    }
});

//--------------------------------
var Draggable = Clazz.derive(function(){
    return {

        items : {}, 

        axis : null,

        // the container where draggable item is limited
        // can be an array of boundingbox or HTMLDomElement or jquery selector
        container : null,

        helper : null,

        //private properties
        // boundingbox of container compatible with getBoundingClientRect method
        _boundingBox : null,

        _mouseStart : {},
        _$helper : null

    }
}, {

add : function( elem, handle ){
    
    var id = genGUID(),
        $elem = $(elem);
    if( handle ){
        var $handle = $(handle);
    }

    $elem.attr( "data-qpf-draggable", id )
        .addClass("qpf-draggable");
    
    (handle ? $(handle) : $elem)
        .unbind("mousedown", this._mouseDown)
        .bind("mousedown", {context:this}, this._mouseDown);

    var newItem = new DraggableItem({
        id : id,
        target : elem,
        host : this,
        handle : handle
    })
    this.items[id] = newItem;

    return newItem;
},

remove : function( elem ){

    if( elem instanceof DraggableItem){
        var item = elem,
            $elem = $(item.elem),
            id = item.id;
    }else{
        var $elem = $(elem),
            id = $elem.attr("data-qpf-draggable");
        
        if( id  ){
            var item = this.items[id];
        }
    }   
    delete this.items[ id ];

    
    $elem.removeAttr("data-qpf-draggable")
        .removeClass("qpf-draggable");
    // remove the events binded to it
    (item.handle ? $(item.handle) : $elem)
        .unbind("mousedown", this._mouseDown);
},

clear : function(){

    _.each(this.items, function(item){
        this.remove( item.target );
    }, this);
},

_save : function(){

    _.each(this.items, function(item){

        var $elem = $(item.target);
        var $offsetParent = $elem.offsetParent();
        var position = $elem.position();
        var offsetParentOffset = $offsetParent.offset();
        var margin = {
                left : parseInt($elem.css("marginLeft")) || 0,
                top : parseInt($elem.css("marginTop")) || 0
            };

        item.margin = margin;
        // fix the position with margin
        item.originPosition = {
            left : position.left - margin.left,
            top : position.top - margin.top
        },
        item.offsetParentOffset = offsetParentOffset;
        // cache the size of the dom element
        item.width = $elem.width(),
        item.height = $elem.height(),
        // save the position info for restoring after drop
        item.positionType = $elem.css("position");

    }, this);

},

_restore : function( restorePosition ){

    _.each( this.items, function(item){

        var $elem = $(item.target);
        var position = $elem.offset();

        $elem.css("position", item.positionType);

        if( restorePosition ){
            $elem.offset({
                left : item.originPosition.left + item.margin.left,
                top : item.originPosition.top + item.margin.top
            })
        }else{
            $elem.offset(position);
        }
    }, this);
},

_mouseDown : function(e){
    
    if( e.which !== 1){
        return;
    }

    var self = e.data.context;
    //disable selection
    e.preventDefault();

    self._save();

    self._triggerProxy("dragstart", e);

    if( ! self.helper ){

        _.each( self.items, function(item){
            
            var $elem = $(item.target);

            $elem.addClass("qpf-draggable-dragging");

            $elem.css({
                "position" : "absolute",
                "left" : (item.originPosition.left)+"px",
                "top" : (item.originPosition.top)+"px"
            });

        }, self);

        if( self.container ){
            self._boundingBox = self._computeBoundingBox( self.container );
        }else{
            self._boundingBox = null;
        }

    }else{

        self._$helper = $(self.helper);
        document.body.appendChild(self._$helper[0]);
        self._$helper.css({
            left : e.pageX,
            top : e.pageY
        })
    }

    $(document.body)
        .unbind("mousemove", self._mouseMove)
        .bind("mousemove", {context:self}, self._mouseMove )
        .unbind("mouseout", self._mouseOut)
        .bind("mouseout", {context:self}, self._mouseOut )
        .unbind('mouseup', self._mouseUp)
        .bind("mouseup", {context:self}, self._mouseUp );

    self._mouseStart = {
        x : e.pageX,
        y : e.pageY
    };

},

_computeBoundingBox : function(container){

    if( _.isArray(container) ){

        return {
            left : container[0][0],
            top : container[0][1],
            right : container[1][0],
            bottom : container[1][1]
        }

    }else if( container.left && 
                container.right &&
                container.top &&
                container.bottom ) {

        return container;
    }else{
        // using getBoundingClientRect to get the bounding box
        // of HTMLDomElement
        try{
            var $container = $(container);
            var offset = $container.offset();
            var bb = {
                left : offset.left + parseInt($container.css("padding-left")) || 0,
                top : offset.top + parseInt($container.css("padding-top")) || 0,
                right : offset.left + $container.width() - parseInt($container.css("padding-right")) || 0,
                bottom : offset.top + $container.height() - parseInt($container.css("padding-bottom")) || 0
            };
            
            return bb;
        }catch(e){
            console.error("Invalid container type");
        }
    }

},

_mouseMove : function(e){

    var self = e.data.context;

    var offset = {
        x : e.pageX - self._mouseStart.x,
        y : e.pageY - self._mouseStart.y
    }

    if( ! self._$helper){

        _.each( self.items, function(item){
            // calculate the offset position to the document
            var left = item.originPosition.left + item.offsetParentOffset.left + offset.x,
                top = item.originPosition.top + item.offsetParentOffset.top + offset.y;
            // constrained in the area of container
            if( self._boundingBox ){
                var bb = self._boundingBox;
                left = left > bb.left ? 
                                (left+item.width < bb.right ? left : bb.right-item.width)
                                 : bb.left;
                top = top > bb.top ? 
                            (top+item.height < bb.bottom ? top : bb.bottom-item.height)
                            : bb.top;
            }

            var axis = ko.utils.unwrapObservable(self.axis);
            if( !axis || axis.toLowerCase() !== "y"){
                $(item.target).css("left", left - item.offsetParentOffset.left + "px");
            }
            if( !axis || axis.toLowerCase() !== "x"){
                $(item.target).css("top", top - item.offsetParentOffset.top + "px");
            }

        }, self );


    }else{

        self._$helper.css({
            "left" : e.pageX,
            "top" : e.pageY
        })
    };

    self._triggerProxy("drag", e);
},

_mouseUp : function(e){

    var self = e.data.context;

    $(document.body).unbind("mousemove", self._mouseMove)
        .unbind("mouseout", self._mouseOut)
        .unbind("mouseup", self._mouseUp)

    if( self._$helper ){

        self._$helper.remove();
    }else{

        _.each(self.items, function(item){

            var $elem = $(item.target);

            $elem.removeClass("qpf-draggable-dragging");

        }, self)
    }
    self._restore();

    self._triggerProxy("dragend", e);
},

_mouseOut : function(e){
    // PENDING
    // this._mouseUp.call(this, e);
},

_triggerProxy : function(){
    var args = arguments;
    _.each(this.items, function(item){
        item.trigger.apply(item, args);
    });

    this.trigger.apply(this, args);
}

});


var genGUID = (function(){
    var id = 1;
    return function(){
        return id++;
    }
}) ();

Draggable.applyTo = function(target, options){
    target.draggable = new Draggable(options);        
}
return Draggable;

});
//===================================
// Window componennt
// Window is a panel wich can be drag
// and close
//===================================
define('container/window',['require','./container','./panel','../helper/draggable','knockout','$','_'],function(require){

var Container = require("./container");
var Panel = require("./panel");
var Draggable = require("../helper/draggable");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Window = Panel.derive(function(){
    return {

        $el : $('<div data-bind="style:{left:_leftPx, top:_topPx}"></div>'),

        children : ko.observableArray(),
        title : ko.observable("Window"),

        left : ko.observable(0),
        top : ko.observable(0),

        _leftPx : ko.computed(function(){
            return this.left()+"px";
        }, this, {
            deferEvaluation : true
        }),
        _topPx : ko.computed(function(){
            return this.top()+"px";
        }, this, {
            deferEvaluation : true
        })
        
    }
}, {

    type : 'WINDOW',

    css : _.union('window', Panel.prototype.css),

    initialize : function(){
        Draggable.applyTo( this );
        
        Panel.prototype.initialize.call( this );
    },

    afterRender : function(){
        
        Panel.prototype.afterRender.call( this );

        this.draggable.add( this.$el, this._$header);
        
    }
})

Container.provideBinding("window", Window);

return Window;

})
;
//===================================================
// Xml Parser
// parse wml and convert it to dom with knockout data-binding
// TODO xml valid checking, 
//      provide xml childNodes Handler in the Components
//===================================================
define('core/xmlparser',['require','exports','module','_'],function(require, exports, module){
    
    var _ = require("_");
    
    // return document fragment converted from the xml
    var parse = function( xmlString, dom ){
        
        if( typeof(xmlString) == "string"){
            var xml = parseXML( xmlString );
        }else{
            var xml = xmlString;
        }
        if( xml ){

            var rootDomNode = dom || document.createElement("div");

            convert( xml, rootDomNode);

            return rootDomNode;
        }
    }

    function parseXML( xmlString ){
        var xml, parser;
        try{
            if( window.DOMParser ){
                xml = (new DOMParser()).parseFromString( xmlString, "text/xml");
            }else{
                xml = new ActiveXObject("Microsoft.XMLDOM");
                xml.async = "false";
                xml.loadXML( xmlString );
            }
            return xml;
        }catch(e){
            console.error("Invalid XML:" + xmlString);
        }
    }

    var customParsers = {};
    // provided custom parser from Compositor
    // parser need to return a plain object which key is attributeName
    // and value is attributeValue
    function provideParser(componentType /*tagName*/, parser){
        customParsers[componentType] = parser;
    }

    function parseXMLNode(xmlNode){
        if( xmlNode.nodeType === 1){
            
            var bindingResults = {
                type : xmlNode.tagName.toLowerCase()
            } 

            var convertedAttr = convertAttributes( xmlNode.attributes );
            var customParser = customParsers[bindingResults.type];
            if( customParser ){
                var result = customParser(xmlNode);
                if( result &&
                    typeof(result) !="object"){
                    console.error("Parser must return an object converted from attributes")
                }else{
                    // data in the attributes has higher priority than
                    // the data from the children
                    _.extend(convertedAttr, result);
                }
            }

            var bindingString = objectToDataBindingFormat( convertedAttr, bindingResults );

            var domNode = document.createElement('div');
            domNode.setAttribute('data-bind',  "qpf:"+bindingString);

            return domNode;
        }else if( xmlNode.nodeType === 8){// comment node, offer for virtual binding in knockout
            // return xmlNode;
            return;
        }else{
            return;
        }
    }

    function convertAttributes(attributes){
        var ret = {};
        for(var i = 0; i < attributes.length; i++){
            var attr = attributes[i];
            ret[attr.nodeName] = attr.nodeValue;
        }
        return ret;
    }

    function objectToDataBindingFormat(attributes, bindingResults){

        bindingResults = bindingResults || {};

        var preProcess = function(attributes, bindingResults){

            _.each(attributes, function(value, name){
                // recursive
                if( value.constructor == Array){
                    bindingResults[name] = [];
                    preProcess(value, bindingResults[name]);
                }else if( value.constructor == Object){
                    bindingResults[name] = {};
                    preProcess(value, bindingResults[name]);
                }else if( typeof(value) !== "undefined" ){
                    // this value is an expression or observable
                    // in the viewModel if it has @binding[] flag
                    var isBinding = /^\s*@binding\[(.*?)\]\s*$/.exec(value);
                    if( isBinding ){
                        // add a tag to remove quotation the afterwards
                        // conveniently, or knockout will treat it as a 
                        // normal string, not expression
                        value = "{{BINDINGSTART" + isBinding[1] + "BINDINGEND}}";

                    }
                    bindingResults[name] = value
                }
            });
        }
        preProcess( attributes, bindingResults );

        var bindingString = JSON.stringify(bindingResults);
        
        bindingString = bindingString.replace(/\"\{\{BINDINGSTART(.*?)BINDINGEND\}\}\"/g, "$1");

        return bindingString;
    }

    function convert(root, parent){

        var children = getChildren(root);

        for(var i = 0; i < children.length; i++){
            var node = parseXMLNode( children[i] );
            if( node ){
                parent.appendChild(node);
                convert( children[i], node);
            }
        }
    }

    function getChildren(parent){
        
        var children = [];
        var node = parent.firstChild;
        while(node){
            children.push(node);
            node = node.nextSibling;
        }
        return children;
    }

    function getChildrenByTagName(parent, tagName){
        var children = getChildren(parent);
        
        return _.filter(children, function(child){
            return child.tagName && child.tagName.toLowerCase() === tagName;
        })
    }


    exports.parse = parse;
    //---------------------------------
    // some util functions provided for the components
    exports.provideParser = provideParser;

    function getTextContent(xmlNode){
        var children = getChildren(xmlNode);
        var text = '';
        _.each(children, function(child){
            if(child.nodeType==3){
                text += child.textContent.replace(/(^\s*)|(\s*$)/g, "");
            }
        })
        return text;
    }

    exports.util = {
        convertAttributes : convertAttributes,
        objectToDataBindingFormat : objectToDataBindingFormat,
        getChildren : getChildren,
        getChildrenByTagName : getChildrenByTagName,
        getTextContent : getTextContent
    }
});
//==================================
// Base class of all meta component
// Meta component is the ui component
// that has no children
//==================================
define('meta/meta',['require','../base','knockout'],function(require){

var Base = require("../base");
var ko = require("knockout");

var Meta = Base.derive(
{
}, {
    type : "META",

    css : 'meta'
});

// Inherit the static methods
Meta.provideBinding = Base.provideBinding;

Meta.provideBinding("meta", Meta);

return Meta;

});
//======================================
// Button component
//======================================
define('meta/button',['require','./meta','core/xmlparser','knockout','$','_'],function(require){

var Meta = require("./meta");
var XMLParser = require("core/xmlparser");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Button = Meta.derive(function(){
return {
    $el : $('<button data-bind="html:text"></button>'),
    
    // value of the button
    text : ko.observable('Button')
    
}}, {

    type : 'BUTTON',

    css : 'button',

    afterRender : function(){
        var me = this;
    }
});

Meta.provideBinding("button", Button);

// provide parser when do xmlparsing
XMLParser.provideParser("button", function(xmlNode){
    
    var text = XMLParser.util.getTextContent(xmlNode);
    if(text){
        return {
            text : text
        }
    }
})

return Button;

});
//======================================
// Checkbox component
//======================================
define('meta/checkbox',['require','./meta','knockout','$','_'],function(require){

var Meta = require("./meta");
var ko = require('knockout');
var $ = require("$");
var _ = require("_");

var Checkbox = Meta.derive(function(){
return {
    
    // value of the button
    checked : ko.observable(false),
    label : ko.observable("")
    
}}, {

    template : '<input type="checkbox" data-bind="checked:checked" />\
                <span data-bind="css:{checked:checked}"></span>\
                <label data-bind="text:label"></label>',

    type : 'CHECKBOX',
    css : 'checkbox',

    // binding events
    afterRender : function(){
        var self = this;
        this.$el.click(function(){
            self.checked( ! self.checked() );
        })
    }
});

Meta.provideBinding("checkbox", Checkbox);

return Checkbox;

})  ;
//===================================
// Combobox component
// 
// @VMProp  value
// @VMProp  items
//          @property   value
//          @property   text
//===================================
define('meta/combobox',['require','./meta','core/xmlparser','knockout','$','_'],function(require){

var Meta = require("./meta");
var XMLParser = require("core/xmlparser");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Combobox = Meta.derive(function(){
return {

    $el : $('<div data-bind="css:{active:active}" tabindex="0"></div>'),

    value : ko.observable(),

    items : ko.observableArray(),   //{value, text}

    defaultText : ko.observable("select"),

    active : ko.observable(false),

}}, {
    
    type : 'COMBOBOX',

    css : 'combobox',

    eventsProvided : _.union(Meta.prototype.eventsProvided, "change"),

    initialize : function(){

        this.selectedText = ko.computed(function(){
            var val = this.value();
            var result =  _.filter(this.items(), function(item){
                return ko.utils.unwrapObservable(item.value) == val;
            })[0];
            if( typeof(result) == "undefined"){
                return this.defaultText();
            }
            return ko.utils.unwrapObservable(result.text);
        }, this);

    },

    template : '<div class="qpf-combobox-selected" data-bind="click:_toggle">\
                    <div class="qpf-left" data-bind="html:selectedText"></div>\
                    <div class="qpf-right qpf-common-button">\
                        <div class="qpf-icon"></div>\
                    </div>\
                </div>\
                <ul class="qpf-combobox-items" data-bind="foreach:items">\
                    <li data-bind="html:text,attr:{\'data-qpf-value\':value},click:$parent._select.bind($parent,value),css:{selected:$parent._isSelected(value)}"></li>\
                </ul>',

    afterRender : function(){

        var self = this;
        this._$selected = this.$el.find(".qpf-combobox-selected");
        this._$items = this.$el.find(".qpf-combobox-items");

        this.$el.blur(function(){
            self._blur();
        })

    },

    //events
    _focus : function(){
        this.active(true);
    },
    _blur : function(){
        this.active(false);
    },
    _toggle : function(){
        this.active( ! this.active() );
    },
    _select : function(value){
        value = ko.utils.unwrapObservable(value);
        this.value(value);
        this._blur();
    },
    _isSelected : function(value){
        return this.value() === ko.utils.unwrapObservable(value);
    }
})

Meta.provideBinding("combobox", Combobox);

XMLParser.provideParser('combobox', function(xmlNode){
    var items = [];
    var nodes = XMLParser.util.getChildrenByTagName(xmlNode, "item");
    _.each(nodes, function(child){
        // Data source can from item tags of the children
        var value = child.getAttribute("value");
        var text = child.getAttribute("text") ||
                    XMLParser.util.getTextContent(child);

        if( value !== null){
            items.push({
                value : value,
                text : text
            })
        }
    })
    if( items.length){
        return {
            items : items
        }
    }
})


return Combobox;

});
;
define("meta/image", function(){});

//======================================
// Label component
//======================================
define('meta/label',['require','./meta','core/xmlparser','knockout','$','_'],function(require){

var Meta = require("./meta");
var XMLParser = require("core/xmlparser");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Label = Meta.derive(function(){
return {
    // value of the Label
    text : ko.observable('Label')
    
} }, {

    template : '<Label data-bind="html:text"></Label>',

    type : 'LABEL',

    css : 'label'
});

Meta.provideBinding("label", Label);

// provide parser when do xmlparsing
XMLParser.provideParser("label", function(xmlNode){

    var text = XMLParser.util.getTextContent(xmlNode);
    if(text){
        return {
            text : text
        }
    }
})

return Label;

});
;
define("meta/overlay", function(){});

;
define("meta/overlaymanager", function(){});

//===================================
// Slider component
// 
// @VMProp value
// @VMProp step
// @VMProp min
// @VMProp max
// @VMProp orientation
// @VMProp format
//
// @method computePercentage
// @method updatePosition   update the slider position manually
// @event change newValue prevValue self[Slider]
//===================================
define('meta/slider',['require','./meta','../helper/draggable','knockout','$','_'],function (require) {

    var Meta = require("./meta");
    var Draggable = require("../helper/draggable");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Slider = Meta.derive(function () {

        var ret = {

            $el: $('<div data-bind="css:orientation"></div>'),

            step: ko.observable(1),

            min: ko.observable(-100),

            max: ko.observable(100),

            orientation: ko.observable("horizontal"), // horizontal | vertical

            precision: ko.observable(2),

            format: "{{value}}",

            _format: function (number) {
                return this.format.replace("{{value}}", number);
            },

            // compute size dynamically when dragging
            autoResize: true
        }

        ret.value = ko.observable(1).extend({
            clamp: {
                max: ret.max,
                min: ret.min
            }
        });

        ret._valueNumeric = ko.computed(function () {
            return ret.value().toFixed(ret.precision());
        })

        ret._percentageStr = ko.computed({
            read: function () {
                var min = ret.min();
                var max = ret.max();
                var value = ret.value();
                var percentage = (value - min) / (max - min);

                return percentage * 100 + "%";
            },
            deferEvaluation: true
        })
        return ret;

    }, {

        type: "SLIDER",

        css: 'slider',

        template: '<div class="qpf-slider-groove-box">\
                    <div class="qpf-slider-groove">\
                        <div class="qpf-slider-percentage" data-bind="style:{width:_percentageStr}"></div>\
                    </div>\
                </div>\
                <div class="qpf-slider-min" data-bind="text:_format(min())"></div>\
                <div class="qpf-slider-max" data-bind="text:_format(max())"></div>\
                <div class="qpf-slider-control" data-bind="style:{left:_percentageStr}">\
                    <div class="qpf-slider-control-inner"></div>\
                    <div class="qpf-slider-value" data-bind="text:_format(_valueNumeric())"></div>\
                </div>',

        eventsProvided: _.union(Meta.prototype.eventsProvided, "change"),

        initialize: function () {
            // add draggable mixin
            Draggable.applyTo(this, {
                axis: ko.computed(function () {
                    return this.orientation() == "horizontal" ? "x" : "y"
                }, this)
            });

            var prevValue = this._valueNumeric();
            this.value.subscribe(function () {
                this.trigger("change", this._valueNumeric(), prevValue, this);
                prevValue = this._valueNumeric();
            }, this);
        },

        afterRender: function () {

            // cache the element;
            this._$groove = this.$el.find(".qpf-slider-groove");
            this._$percentage = this.$el.find(".qpf-slider-percentage");
            this._$control = this.$el.find(".qpf-slider-control");

            this.draggable.container = this._$groove;
            var item = this.draggable.add(this._$control);

            item.on("drag", this._dragHandler, this);

            // disable text selection
            this.$el.mousedown(function (e) {
                e.preventDefault();
            });
            
        },

        onResize: function () {
            Meta.prototype.onResize.call(this);
        },

        computePercentage: function () {

            if (this.autoResize) {
                this._cacheSize();
            }

            var offset = this._computeOffset();
            return offset / (this._grooveSize - this._sliderSize);
        },

        _cacheSize: function () {

            // cache the size of the groove and slider
            var isHorizontal = this._isHorizontal();
            this._grooveSize = isHorizontal ?
                this._$groove.width() :
                this._$groove.height();
            this._sliderSize = isHorizontal ?
                this._$control.width() :
                this._$control.height();
        },

        _computeOffset: function () {

            var isHorizontal = this._isHorizontal();
            var grooveOffset = isHorizontal ?
                this._$groove.offset().left :
                this._$groove.offset().top;
            var sliderOffset = isHorizontal ?
                this._$control.offset().left :
                this._$control.offset().top;

            return sliderOffset - grooveOffset;
        },

        _dragHandler: function () {

            var percentage = this.computePercentage(),
                min = parseFloat(this.min()),
                max = parseFloat(this.max()),
                value = (max - min) * percentage + min;

            this.value(value);
            this.value(this._valueNumeric());
        },

        _isHorizontal: function () {
            return ko.utils.unwrapObservable(this.orientation) == "horizontal";
        },
    })

    Meta.provideBinding("slider", Slider);

    return Slider;

})
;
//===================================
// Spinner component
//
// @VMProp step
// @VMProp value
// @VMProp precision
//
// @event change newValue prevValue self[Spinner]
//===================================
define('meta/spinner',['require','./meta','knockout','$','_'],function(require){

var Meta = require('./meta');
var ko = require("knockout");
var $ = require('$');
var _ = require("_");

function increase(){
	this.value( parseFloat(this.value()) + parseFloat(this.step()) );
}

function decrease(){
	this.value( parseFloat(this.value()) - parseFloat(this.step()) );
}

var Spinner = Meta.derive(function(){
	var ret = {
		step : ko.observable(1),
		valueUpdate : "afterkeydown", //"keypress" "keyup" "afterkeydown"
		precision : ko.observable(2),
		min : ko.observable(null),
		max : ko.observable(null),
		increase : increase,
		decrease : decrease
	}
	ret.value = ko.observable(1).extend({
		numeric : ret.precision,
		clamp : { 
					max : ret.max,
					min : ret.min
				}
	})
	return ret;
}, {
	type : 'SPINNER',

	css : 'spinner',

	initialize : function(){
		var prevValue = this.value() || 0;
		this.value.subscribe(function(newValue){

			this.trigger("change", parseFloat(newValue), parseFloat(prevValue), this);
			prevValue = newValue;
		}, this)
	},

	eventsProvided : _.union(Meta.prototype.eventsProvided, "change"),

	template : '<div class="qpf-left">\
					<input type="text" class="qpf-spinner-value" data-bind="value:value,valueUpdate:valueUpdate" />\
				</div>\
				<div class="qpf-right">\
					<div class="qpf-common-button qpf-increase" data-bind="click:increase">\
					+</div>\
					<div class="qpf-common-button qpf-decrease" data-bind="click:decrease">\
					-</div>\
				</div>',

	afterRender : function(){
		var self = this;
		// disable selection
		this.$el.find('.qpf-increase,.qpf-decrease').mousedown(function(e){
			e.preventDefault();
		})
		this._$value = this.$el.find(".qpf-spinner-value")
		// numeric input only
		this._$value.keydown(function(event){
			// Allow: backspace, delete, tab, escape and dot
			if ( event.keyCode == 46 || event.keyCode == 8 || event.keyCode == 9 || event.keyCode == 27 || event.keyCode == 190 ||
				 // Allow: Ctrl+A
				(event.keyCode == 65 && event.ctrlKey === true) || 
				// Allow: home, end, left, right
				(event.keyCode >= 35 && event.keyCode <= 39)) {
				// let it happen, don't do anything
				return;
			}
			else {
				// Ensure that it is a number and stop the keypress
				if ( event.shiftKey || (event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 96 || event.keyCode > 105 ) ) 
				{
					event.preventDefault(); 
				}
	        }
		})

		this._$value.change(function(){
			// sync the value in the input
			if( this.value !== self.value().toString() ){
				this.value = self.value();
			}
		})

	}
})

Meta.provideBinding('spinner', Spinner);

return Spinner;
});
//===================================
// Textfiled component
//
// @VMProp text
// @VMProp placeholder
//
//===================================
define('meta/textfield',['require','./meta','knockout','_'],function (require) {

    var Meta = require('./meta');
    var ko = require("knockout");
    var _ = require("_");

    var TextField = Meta.derive(function () {
        return {

            tag: "div",

            text: ko.observable(""),

            placeholder: ko.observable("")

        }
    }, {

        type: "TEXTFIELD",

        css: 'textfield',

        template: '<input type="text" data-bind="attr:{placeholder:placeholder}, value:text"/>',
        afterRender: function () {
            var self = this;
            this.$el.keydown(function (event) {
                if (isNaN(+self.text())) {
                    return;
                } else {
                    // up = +  down=-
                    if (event.keyCode == 38) {
                        self.value((+self.text()) + 1);
                    } else if (event.keyCode == 40) {
                        self.value((+self.text()) - 1);
                    }
                }
            });
        },
        onResize: function () {
            this.$el.find("input").width(this.width());
            Meta.prototype.onResize.call(this);
        }
    })

    Meta.provideBinding("textfield", TextField);

    return TextField;
})
;
;
define("meta/texture", function(){});

;
define("meta/tooltip", function(){});

//===================================
// Tree Component
// Example
// ----------------xml---------------
// <tree>
//   <item icon="assets/imgs/file.gif">foo</item>
//   <item css="folder">
//     <item title="bar" icon="assets/imgs/file.gif"></item>
//   </item>
// </tree>
// ----------------------------------
// 
//===================================
define('meta/tree',['require','./meta','knockout','$','_'],function(require){

var Meta = require('./meta');
var ko = require('knockout');
var $ = require('$');
var _ = require("_");

var Tree = Meta.derive(function(){
    return {
        // Example
        // [{
        //    title : "" | ko.observable(),
        //    icon  : "" | ko.observable(),      //icon img url
        //    css   : "" | ko.observable(),      //css class
        //    items : [] | ko.observableArray()  //sub items
        // }]
        items : ko.observableArray(),

        draggable : ko.observable(false),

        renamble : ko.observable(false),

        indent : ko.observable(20),

        // the depth of node, root is 0;
        __depth__ : 0,
        __nodeIndex__ : 0,

        __root__ : this
    }
}, {

    type : "TREE",
    
    css : 'tree',

    template : '<ul data-bind="foreach:items">\
                    <li data-bind="qpf_tree_itemview:$data"></li>\
                </ul>'
})

var itemTemplate = '<li class="qpf-tree-item">\
                        <div class="qpf-tree-item-title"\
                                data-bind="style:{paddingLeft:_paddingLeftPx}">\
                            <!--ko if:items-->\
                            <span class="qpf-tree-unfold"></span>\
                            <!--/ko-->\
                            <span class="qpf-tree-icon" data-bind="css:css"></span>\
                            <a class="qpf-tree-item-caption" data-bind="text:title"></a>\
                        </div>\
                        <!--ko if:items-->\
                        <ul class="qpf-tree-subitems" data-bind="foreach:items">\
                            <li data-bind="qpf_tree_itemview:$data"></li>\
                        </ul>\
                        <!--/ko-->\
                    </li>';

ko.bindingHandlers["qpf_tree_itemview"] = {
    init : function(element, valueAccessor, allBindingAccessor, viewModel, bindingContext){
        var data = bindingContext.$data;
        var parent = bindingContext.$parent;
        var root = parent.__root__;

        var $itemEl = $(itemTemplate);

        // Default properties
        // In case there is no items property in data
        if( ! data.items){  
            data.items = null;
        }
        if( ! data.css){
            data.css = data.items ? "qpf-tree-folder" : "qpf-tree-file";
        }
        // private data
        data.__root__ = root;
        data.__depth__ = parent.__depth__+1;

        data._paddingLeftPx = ko.computed(function(){
            return data.__depth__ * ko.utils.unwrapObservable( root.indent ) + "px";
        });
        data

        element.parentNode.replaceChild($itemEl[0], element);
        ko.applyBindings(data, $itemEl[0]);

        return { 'controlsDescendantBindings': true };

    }
}

Meta.provideBinding("tree", Tree);

return Tree;
});
;
define("meta/video", function(){});

//==========================
// Util.js
// provide util function to operate
// the components
//===========================
define('util',['require','knockout','core/xmlparser','./base'],function(require){

var ko = require("knockout");
var XMLParser = require("core/xmlparser");
var Base = require("./base");
var exports = {};

// Return an array of components created from XML
exports.createComponentsFromXML = function(XMLString, viewModel){

    var dom = XMLParser.parse(XMLString);
    ko.applyBindings(viewModel || {}, dom);
    var ret = [];
    var node = dom.firstChild;
    while(node){
        var component = Base.getByDom(node);
        if( component ){
            ret.push(component);
        }
        node = node.nextSibling;
    }
    return ret;
}

return exports;

})
;
//============================
// view model for color
// supply hsv and rgb color space
// http://en.wikipedia.org/wiki/HSV_color_space.
//============================
define('widget/color_vm',['require','knockout','core/clazz','_'],function(require){

var ko = require("knockout");
var Clazz = require("core/clazz");
var _ = require("_");


function rgbToHsv(r, g, b){
    r = r/255, g = g/255, b = b/255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max == 0 ? 0 : d / max;

    if(max == min){
        h = 0; // achromatic
    }else{
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h*360, s*100, v*100];
}

function hsvToRgb(h, s, v){

    h = h/360;
    s = s/100;
    v = v/100;

    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}


function intToRgb(value){
    var r = (value >> 16) & 0xff,
        g = (value >> 8) & 0xff,
        b = value & 0xff;
    return [r, g, b];
}

function rgbToInt(r, g, b){
    return r << 16 | g << 8 | b;
}

function intToHsv(value){
    var rgb = intToRgb(value);
    return rgbToHsv(rgb[0], rgb[1], rgb[2]);
}

function hsvToInt(h, s, v){
    return rgbToInt(hsvToRgb(h, s, v));
}

// hsv to rgb is multiple to one
// dependency relationship
// h,s,v(w)------->rgb(r)----->r,g,b(w)
// r,g,b(w)------->hex(r)
// hex(w)------->hsv(w)
// hex(rw)<------->hexString(rw)
//
// so writing hsv will not result circular update
//
var Color = Clazz.derive({
    //--------------------rgb color space
    _r : ko.observable().extend({numeric:0}),
    _g : ko.observable().extend({numeric:0}),
    _b : ko.observable().extend({numeric:0}),
    //--------------------hsv color space
    _h : ko.observable().extend({clamp:{min:0,max:360}}),
    _s : ko.observable().extend({clamp:{min:0,max:100}}),
    _v : ko.observable().extend({clamp:{min:0,max:100}}),
    alpha : ko.observable(1).extend({numeric:2, clamp:{min:0, max:1}})
}, function(){

    this.hex = ko.computed({
        read : function(){
            return rgbToInt( this._r(), this._g(), this._b() );
        },
        write : function(value){
            var hsv = intToHsv(value);
            this._h(hsv[0]);
            this._s(hsv[1]);
            this._v(hsv[2]);
        }
    }, this);

    // bridge of hsv to rgb
    this.rgb = ko.computed({
        read : function(){
            var rgb = hsvToRgb(this._h(), this._s(), this._v());
            this._r(rgb[0]);
            this._g(rgb[1]);
            this._b(rgb[2]);

            return rgb;
        }
    }, this);

    this.hsv = ko.computed(function(){
        return [this._h(), this._s(), this._v()];
    }, this);

    // set rgb and hsv from hex manually
    this.set = function(hex){
        var hsv = intToHsv(hex);
        var rgb = intToRgb(hex);
        this._h(hsv[0]);
        this._s(hsv[1]);
        this._v(hsv[2]);
        this._r(rgb[0]);
        this._g(rgb[1]);
        this._b(rgb[2]);
    }
    //---------------string of hex
    this.hexString = ko.computed({
        read : function(){
            var string = this.hex().toString(16),
                fill = [];
            for(var i = 0; i < 6-string.length; i++){
                fill.push('0');
            }
            return fill.join("")+string;
        },
        write : function(){}
    }, this);

    //-----------------rgb color of hue when value and saturation is 100%
    this.hueRGB = ko.computed(function(){
        return "rgb(" + hsvToRgb(this._h(), 100, 100).join(",") + ")";
    }, this);

    //---------------items data for vector(rgb and hsv)
    var vector = ['_r', '_g', '_b'];
    this.rgbVector = [];
    for(var i = 0; i < 3; i++){
        this.rgbVector.push({
            type : "spinner",
            min : 0,
            max : 255,
            step : 1,
            precision : 0,
            value : this[vector[i]]
        })
    }
    var vector = ['_h', '_s', '_v'];
    this.hsvVector = [];
    for(var i = 0; i < 3; i++){
        this.hsvVector.push({
            type : "spinner",
            min : 0,
            max : 100,
            step : 1,
            precision : 0,
            value : this[vector[i]]
        })
    }
    // modify the hue
    this.hsvVector[0].max = 360;

    // set default 0xffffff
    this.set(0xffffff);
});

Color.intToRgb = intToRgb;
Color.rgbToInt = rgbToInt;
Color.rgbToHsv = rgbToHsv;
Color.hsvToRgb = hsvToRgb;
Color.intToHsv = intToHsv;
Color.hsvToInt = hsvToInt;

return Color;
});
//====================================
// Base class of all widget component
// Widget is component mixed with meta 
// ,containers and other HTMLDOMElenents
//====================================
define('widget/widget',['require','../base','../meta/meta','../container/container','knockout','_'],function(require){

var Base = require("../base");
var Meta = require("../meta/meta");
var Container = require("../container/container");
var ko = require("knockout");
var _ = require("_");

var Widget = Base.derive(
{

}, {
    type : "WIDGET",

    css : 'widget'

})

//-------------------------------------------
// Handle bingings in the knockout template
Widget.provideBinding = Base.provideBinding;
Widget.provideBinding("widget", Widget);

return Widget;

});
//===================================
// Vector widget
// 
// @VMProp  items
// @VMProp  constrainProportion
// @VMProp  constrainType
// @VMProp  constrainRatio
//===================================
define('widget/vector',['require','./widget','../base','core/xmlparser','knockout','$','../meta/spinner','../meta/slider','_'],function(require){

var Widget = require("./widget");
var Base = require("../base");
var XMLParser = require("core/xmlparser");
var ko = require("knockout");
var $ = require("$");
var Spinner = require("../meta/spinner");
var Slider = require("../meta/slider");
var _ = require("_");

var Vector = Widget.derive(function(){
return {

    // data source of item can be spinner type
    // or slider type, distinguish with type field
    // @field type  spinner | slider
    items : ko.observableArray(),

    // set true if you want to constrain the proportions
    constrainProportion : ko.observable(false),

    constrainType : ko.observable("diff"),  //diff | ratio

    _toggleConstrain : function(){
        this.constrainProportion( ! this.constrainProportion() );
    },
    
    // Constrain ratio is only used when constrain type is ratio
    _constrainRatio : [],
    // Constrain diff is only uese when constrain type is diff
    _constrainDiff : [],
    // cache all sub spinner or slider components
    _sub : []
}}, {

    type : "VECTOR",

    css : 'vector',

    initialize : function(){
        this.$el.attr("data-bind", 'css:{"qpf-vector-constrain":constrainProportion}')
        // here has a problem that we cant be notified 
        // if the object in the array is updated
        this.items.subscribe(function(item){
            // make sure self has been rendered
            if( this._$list ){
                this._cacheSubComponents();
                this._updateConstraint();
            }
        }, this);

        this.constrainProportion.subscribe(function(constrain){
            if( constrain ){
                this._computeContraintInfo();
            }
        }, this);
    },

    eventsProvided : _.union(Widget.prototype.eventsProvided, "change"),

    template : '<div class="qpf-left">\
                    <div class="qpf-vector-link" data-bind="click:_toggleConstrain"></div>\
                </div>\
                <div class="qpf-right" >\
                    <ul class="qpf-list" data-bind="foreach:items">\
                        <li data-bind="qpf:$data"></li>\
                    </ul>\
                </div>',

    afterRender : function(){
        // cache the list element
        this._$list = this.$el.find(".qpf-list");

        this._cacheSubComponents();
        this._updateConstraint();
    },

    onResize : function(){
        _.each( this._sub, function(item){
            item.onResize();
        } )
        Widget.prototype.onResize.call(this);
    },

    dispose : function(){
        _.each(this._sub, function(item){
            item.dispose();
        });
        Base.prototype.dispose.call( this );
    },

    _cacheSubComponents : function(){

        var self = this;
        self._sub = [];

        this._$list.children().each(function(){
            
            var component = Base.getByDom(this);
            self._sub.push( component );
        });

        this._computeContraintInfo();
    },

    _computeContraintInfo : function(){
        this._constrainDiff = [];
        this._constrainRatio = [];
        _.each(this._sub, function(sub, idx){
            var next = this._sub[idx+1];
            if( ! next){
                return;
            }
            var value = sub.value(),
                nextValue = next.value();
            this._constrainDiff.push( nextValue-value);

            this._constrainRatio.push(value == 0 ? 1 : nextValue/value);

        }, this);
    },

    _updateConstraint : function(){

        _.each(this._sub, function(sub){

            sub.on("change", this._constrainHandler, this);
        }, this)
    },

    _constrainHandler : function(newValue, prevValue, sub){

        if(this.constrainProportion()){

            var selfIdx = this._sub.indexOf(sub),
                constrainType = this.constrainType();

            for(var i = selfIdx; i > 0; i--){
                var current = this._sub[i].value,
                    prev = this._sub[i-1].value;
                if( constrainType == "diff"){
                    var diff = this._constrainDiff[i-1];
                    prev( current() - diff );
                }else if( constrainType == "ratio"){
                    var ratio = this._constrainRatio[i-1];
                    prev( current() / ratio );
                }

            }
            for(var i = selfIdx; i < this._sub.length-1; i++){
                var current = this._sub[i].value,
                    next = this._sub[i+1].value;

                if( constrainType == "diff"){
                    var diff = this._constrainDiff[i];
                    next( current() + diff );
                }else if( constrainType == "ratio"){
                    var ratio = this._constrainRatio[i];
                    next( current() * ratio );
                }
            }
        }
    }
})

Widget.provideBinding("vector", Vector);

XMLParser.provideParser("vector", function(xmlNode){
    var items = [];
    var children = XMLParser.util.getChildren(xmlNode);
    
    _.chain(children).filter(function(child){
        var tagName = child.tagName && child.tagName.toLowerCase();
        return tagName && (tagName === "spinner" ||
                            tagName === "slider");
    }).each(function(child){
        var attributes = XMLParser.util.convertAttributes(child.attributes);
        attributes.type = child.tagName.toLowerCase();
        items.push(attributes);
    })
    if(items.length){
        return {
            items : items
        }
    }
})

return Vector;

});
//=============================================
// Palette
//=============================================
define('widget/palette',['require','./widget','knockout','./color_vm','$','_','widget/vector','meta/textfield','meta/slider'],function (require) {

    var Widget = require("./widget");
    var ko = require("knockout");
    var Color = require("./color_vm");
    var $ = require("$");
    var _ = require("_");

    // component will be used in the widget
    require("widget/vector");
    require("meta/textfield");
    require("meta/slider");

    var Palette = Widget.derive(function () {
        var ret = new Color;
        var self = this;

        _.extend(ret, {
            _recent: ko.observableArray(),
            _recentMax: 5
        })
        return ret;
    }, {

        type: 'PALETTE',

        css: 'palette',

        eventsProvided: _.union(Widget.prototype.eventsProvided, ['change', 'apply']),

        template: '<div class="qpf-palette-adjuster">\
                    <div class="qpf-left">\
                        <div class="qpf-palette-picksv" data-bind="style:{backgroundColor:hueRGB}">\
                            <div class="qpf-palette-saturation">\
                                <div class="qpf-palette-value"></div>\
                            </div>\
                            <div class="qpf-palette-picker"></div>\
                        </div>\
                        <div class="qpf-palette-pickh">\
                            <div class="qpf-palette-picker"></div>\
                        </div>\
                        <div style="clear:both"></div>\
                        <div class="qpf-palette-alpha">\
                            <div class="qpf-palette-alpha-slider" data-bind="qpf:{type:\'slider\', min:0, max:1, value:alpha, precision:2}"></div>\
                        </div>\
                    </div>\
                    <div class="qpf-right">\
                        <div class="qpf-palette-rgb">\
                            <div data-bind="qpf:{type:\'label\', text:\'RGB\'}"></div>\
                            <div data-bind="qpf:{type:\'vector\', items:rgbVector}"></div>\
                        </div>\
                        <div class="qpf-palette-hsv">\
                            <div data-bind="qpf:{type:\'label\', text:\'HSV\'}"></div>\
                            <div data-bind="qpf:{type:\'vector\', items:hsvVector}"></div>\
                        </div>\
                        <div class="qpf-palette-hex">\
                            <div data-bind="qpf:{type:\'label\', text:\'#\'}"></div>\
                            <div data-bind="qpf:{type:\'textfield\',text:hexString}"></div>\
                        </div>\
                    </div>\
                </div>\
                <div style="clear:both"></div>\
                <ul class="qpf-palette-recent" data-bind="foreach:_recent">\
                    <li data-bind="style:{backgroundColor:rgbString},\
                                    attr:{title:hexString},\
                                    click:$parent.hex.bind($parent, hex)"></li>\
                </ul>\
                <div class="qpf-palette-buttons">\
                    <div data-bind="qpf:{type:\'button\', text:\'Cancel\', class:\'small\', onclick:_cancel.bind($data)}"></div>\
                    <div data-bind="qpf:{type:\'button\', text:\'Apply\', class:\'small\', onclick:_apply.bind($data)}"></div>\
                </div>',

        initialize: function () {
            this.hsv.subscribe(function (hsv) {
                this._setPickerPosition();
                this.trigger("change", this.hex());
            }, this);
            // incase the saturation and value is both zero or one, and
            // the rgb value not change when hue is changed
            this._h.subscribe(this._setPickerPosition, this);
        },
        afterRender: function () {
            this._$svSpace = $('.qpf-palette-picksv');
            this._$hSpace = $('.qpf-palette-pickh');
            this._$svPicker = this._$svSpace.children('.qpf-palette-picker');
            this._$hPicker = this._$hSpace.children('.qpf-palette-picker');

            this._svSize = this._$svSpace.height();
            this._hSize = this._$hSpace.height();

            this._setPickerPosition();
            this._setupSvDragHandler();
            this._setupHDragHandler();
        },
        onResize: function () {
            var $slider = this.$el.find(".qpf-palette-alpha-slider");
            if ($slider.length) {
                $slider.qpf("get")[0].onResize();
            }

            Widget.prototype.onResize.call(this);
        },

        _setupSvDragHandler: function () {
            var self = this;

            var _getMousePos = function (e) {
                var offset = self._$svSpace.offset(),
                    left = e.pageX - offset.left,
                    top = e.pageY - offset.top;
                return {
                    left: left,
                    top: top
                }
            };
            var _mouseMoveHandler = function (e) {
                var pos = _getMousePos(e);
                self._computeSV(pos.left, pos.top);
            }
            var _mouseUpHandler = function (e) {
                $(document.body).unbind("mousemove", _mouseMoveHandler)
                    .unbind("mouseup", _mouseUpHandler)
                    .unbind('mousedown', _disableSelect);
            }
            var _disableSelect = function (e) {
                e.preventDefault();
            }
            this._$svSpace.mousedown(function (e) {
                var pos = _getMousePos(e);
                self._computeSV(pos.left, pos.top);

                $(document.body).bind("mousemove", _mouseMoveHandler)
                    .bind("mouseup", _mouseUpHandler)
                    .bind("mousedown", _disableSelect);
            })
        },

        _setupHDragHandler: function () {
            var self = this;

            var _getMousePos = function (e) {
                var offset = self._$hSpace.offset(),
                    top = e.pageY - offset.top;
                return top;
            };
            var _mouseMoveHandler = function (e) {
                self._computeH(_getMousePos(e));
            };
            var _disableSelect = function (e) {
                e.preventDefault();
            }
            var _mouseUpHandler = function (e) {
                $(document.body).unbind("mousemove", _mouseMoveHandler)
                    .unbind("mouseup", _mouseUpHandler)
                    .unbind('mousedown', _disableSelect);
            }

            this._$hSpace.mousedown(function (e) {
                self._computeH(_getMousePos(e));

                $(document.body).bind("mousemove", _mouseMoveHandler)
                    .bind("mouseup", _mouseUpHandler)
                    .bind("mousedown", _disableSelect);
            })

        },

        _computeSV: function (left, top) {
            var saturation = left / this._svSize,
                value = (this._svSize - top) / this._svSize;

            this._s(saturation * 100);
            this._v(value * 100);
        },

        _computeH: function (top) {

            this._h(top / this._hSize * 360);
        },

        _setPickerPosition: function () {
            if (this._$svPicker) {
                var hsv = this.hsv(),
                    hue = hsv[0],
                    saturation = hsv[1],
                    value = hsv[2];

                // set position relitave to space
                this._$svPicker.css({
                    left: Math.round(saturation / 100 * this._svSize) + "px",
                    top: Math.round((100 - value) / 100 * this._svSize) + "px"
                })
                this._$hPicker.css({
                    top: Math.round(hue / 360 * this._hSize) + "px"
                })
            }
        },

        _apply: function () {
            if (this._recent().length > this._recentMax) {
                this._recent.shift();
            }
            this._recent.push({
                rgbString: "rgb(" + this.rgb().join(",") + ")",
                hexString: this.hexString(),
                hex: this.hex()
            });

            this.trigger("apply", this.hex(), this.alpha());
        },

        _cancel: function () {
            this.trigger("cancel")
        }
    })

    Widget.provideBinding("palette", Palette);

    return Palette;
})
;
define('qpf',['require','base','container/application','container/box','container/container','container/hbox','container/inline','container/panel','container/tab','container/vbox','container/window','core/clazz','core/mixin/derive','core/mixin/event','core/xmlparser','helper/draggable','meta/button','meta/checkbox','meta/combobox','meta/image','meta/label','meta/meta','meta/overlay','meta/overlaymanager','meta/slider','meta/spinner','meta/textfield','meta/texture','meta/tooltip','meta/tree','meta/video','util','widget/color_vm','widget/palette','widget/vector','widget/widget'],function(require){
    
    var qpf =  {
	"Base": require('base'),
	"container": {
		"Application": require('container/application'),
		"Box": require('container/box'),
		"Container": require('container/container'),
		"Hbox": require('container/hbox'),
		"Inline": require('container/inline'),
		"Panel": require('container/panel'),
		"Tab": require('container/tab'),
		"Vbox": require('container/vbox'),
		"Window": require('container/window')
	},
	"core": {
		"Clazz": require('core/clazz'),
		"mixin": {
			"Derive": require('core/mixin/derive'),
			"Event": require('core/mixin/event')
		},
		"Xmlparser": require('core/xmlparser')
	},
	"helper": {
		"Draggable": require('helper/draggable')
	},
	"meta": {
		"Button": require('meta/button'),
		"Checkbox": require('meta/checkbox'),
		"Combobox": require('meta/combobox'),
		"Image": require('meta/image'),
		"Label": require('meta/label'),
		"Meta": require('meta/meta'),
		"Overlay": require('meta/overlay'),
		"Overlaymanager": require('meta/overlaymanager'),
		"Slider": require('meta/slider'),
		"Spinner": require('meta/spinner'),
		"Textfield": require('meta/textfield'),
		"Texture": require('meta/texture'),
		"Tooltip": require('meta/tooltip'),
		"Tree": require('meta/tree'),
		"Video": require('meta/video')
	},
	"Util": require('util'),
	"widget": {
		"Color_vm": require('widget/color_vm'),
		"Palette": require('widget/palette'),
		"Vector": require('widget/vector'),
		"Widget": require('widget/widget')
	}
};

    qpf.create = qpf.Base.create;

    return qpf;
})
;
var qpf = require("qpf");

// only export the use method 
_exports.use = function(path){
	return require(path);
}

for(var name in qpf){
    _exports[name] = qpf[name];
}

})