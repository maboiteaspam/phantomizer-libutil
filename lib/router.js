
(function(exports) {

  var fs = require("fs");
  var http = require("http");
  var _ = require("underscore");
  var grunt = require("grunt");

  /**
   * Router collects all static urls
   * and provides some methods to match request against
   * the collected urls
   *
   * @param routes Array
   */
  var router = function(routes){

    /*
     // an Array of Route Object
     routes : [
     {
     // public properties
     // there are exclusive
     template:"",
     urls_datasource:"",
     datasource_credentials:"",
     urls_file:"",
     url:"",

     // private property
     urls:[
     // stores the list of urls for that route
     // once it is loaded
     ]
     }
     ]
     */

    /**
     * Loads all Routes urls
     * and execute the callback
     *
     * @param then
     */
    this.load = function(then){
      var n = 0;
      function next(read_urls){
        routes[n].urls = read_urls;
        n++;
        if( n < routes.length ){
          read_routing_urls(routes[n],next);
        }else{
          then();
        }
      }
      if( routes.length > 0 ) read_routing_urls(routes[0],next);
      else then();
    }
    /**
     * Matches an url such /some/url.htm
     * against the loaded routes urls
     * Stops on first match found.
     *
     * @param absolute_url string /some/url.htm
     * @returns bool|Route
     */
    this.match = function(absolute_url){
      for( var n in routes ){
        var route = routes[n];
        if(route.urls &&
          route.urls.indexOf(absolute_url)>-1){
          return route;
        }else if(route.template &&
          route.template == absolute_url){
          return route;
        }
      }
      return false;
    };
    /**
     * Collect all route urls
     * into an Array of urls
     *
     * @param filter_fn
     * @returns {Array}
     */
    this.collect_urls = function(filter_fn){
      var urls = [];
      for( var n in routes ){
        var route = routes[n];
        if(route.urls && route.urls.length > 0){
          for(var t in route.urls){
            if( !filter_fn ){
              urls.push(route.urls[t]);
            }else if(filter_fn(route)){
              urls.push(route.urls[t]);
            }
          }

        }else if(route.template){
          if( !filter_fn ){
            urls.push(route.template);
          }else if(filter_fn(route)){
            urls.push(route.template);
          }

        }
      }
      return urls;
    };
    /**
     * Collect all route urls
     * into an Array of object
     * [
     *  {   url : string,
         *      meta: Route
         *  }
     * ]
     *
     * @returns {Array}
     */
    this.collect_meta_urls = function(filter_fn){
      var urls = [];
      for( var n in routes ){
        var route = routes[n];
        if(route.urls && route.urls.length > 0){
          for(var t in route.urls){
            if( !filter_fn ){
              urls.push({url:route.urls[t], meta:route});
            }else if(filter_fn(route)){
              urls.push({url:route.urls[t], meta:route});
            }
          }
        }else if(route.template){
          if( !filter_fn ){
            urls.push({url:route.template, meta:route});
          }else if(filter_fn(route)){
            urls.push({url:route.template, meta:route});
          }

        }
      }
      return urls;
    };
  };


  // helper functions
  // --------------
  /**
   * Given a route,
   * Identify the kind of datasource (file|string|url)
   * fetch the content and call the callback
   *
   * @param route_options object
   * @param then callback
   */
  function read_routing_urls(route_options,then){
    var urls = [];
    // read urls from a remote http source
    if (route_options.urls_datasource){
      grunt.log.writeln("Reading urls from URL "+route_options.urls_datasource);
      read_url(route_options, function(status,content){
        urls = JSON.parse(content);
        // if the response is in the form {data:[/* absolute urls : /some/url.htm */]}
        if( urls.data && toString.call(urls.data) == '[object Array]' ){
          urls = urls.data;
        }
        // otherwise, the response is in the form [/* absolute urls : /some/url.htm */]
        then(urls);
      });
    }else{
      // source is a local file
      if (route_options.urls_file){
        grunt.log.writeln("Reading urls from file "+route_options.urls_file);
        urls = fs.readFileSync(route_options.urls_file);
        urls = JSON.parse(urls);
        // source is a built in Array of absolute urls : /some/url.htm
      }else if( route_options.urls ){
        urls = route_options.urls;
        grunt.log.writeln("Reading urls inlined from options");
        // source is a built in String, a absolute url : /some/url.htm
      }else if (route_options.url){
        urls = [route_options.url];
        grunt.log.writeln("Reading urls inlined from options");
      }
      then(urls);
    }
  }

  /**
   * Reads a remote url
   * and apply callback when done
   *
   * @param route Route
   * @param then callback
   */
  function read_url(route,then){
    var request = require("request");

    var url = route.urls_datasource;
    var options = {};
    if( route.datasource_credentials ){

      var auth_file = route.datasource_credentials.auth_file || "";
      var user_env_var = route.datasource_credentials.user_env_var || "";
      var pwd_env_var = route.datasource_credentials.pwd_env_var || "";
      var user_in = route.datasource_credentials.user || "";
      var pwd_in = route.datasource_credentials.pwd || "";

      if( auth_file !== "" ){
        console.log("using auth_file " + auth_file);
        var c = grunt.file.read(auth_file).trim().split(":");
        options = {
          auth:{
            'user': c[0],
            'pass': c[1],
            'sendImmediately': false
          }
        };
      }else if( user_env_var
        +pwd_env_var !== "" ){
        console.log("using env var auth " + user_env_var+" "+pwd_env_var);
        options = {
          auth:{
            'user': process.env[user_env_var],
            'pass': process.env[pwd_env_var],
            'sendImmediately': false
          }
        };
      }else if( user_in
        +pwd_in !== "" ){
        console.log("using inlined configuration auth.");
        options = {
          auth:{
            'user': user_in,
            'pass': pwd_in,
            'sendImmediately': false
          }
        };
      }
    }

    request(url, options, function (error, response, body) {
      if( error ){
        then(false,error);
      }else{
        // detected some content with a weird response pattern
        //
        // [0-9]+\n\rCONTENT\n\r[0-9]+\n\r\n\r
        //
        // needs to strip it out
        if( body.match(/^(\d+\s)/i) && body.match(/\S+\s+\d+\s+$/i) ){
          body = body.replace(/^(\d+\s)/i,"")
          body = body.replace(/(\S+)\s+\d+\s+$/i,"$1")
        }
        then(true,body);
      }
    })
  }

  // Expose the constructor function.
  exports.router = router;
}(typeof exports === 'object' && exports || this));

