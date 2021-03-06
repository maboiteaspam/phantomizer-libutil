
'use strict';

(function(exports) {

  var os = require('os')
  var fs = require("fs")
  var http = require('http')

  var dirlisting = require("phantomizer-html-dirlisting").html_dirlisting;

  var http_utils = require("./http_utils").http_utils;
  var file_utils = require("./file_utils").file_utils;
  var phantomizer_helper = require("./phantomizer_helper").phantomizer_helper;
  var delivery_queue = require("./delivery_queue").delivery_queue;

  var webserver = function(router,optimizer,meta_manager, grunt, web_paths){


    // requirejs options
    var user_config = grunt.config();

    var rjs_config = user_config.scripts.requirejs||null;

    // Server side Bandwidth and congestion manager
    var deliverer = new delivery_queue();

    // HTML Document injection and manipulation
    var is_phantom = false;
    var is_in_build_process = false;
    var dashboard_enabled = true;
    var build_enabled = true;
    var assets_injection_enabled = true;
    var globals_injected = null;

    // logs the query that was identified as a file
    var log_query = false;
    var query_logged = [];

    // new connect web server
    var express = require('express');
    var app = express();
    app.use(express.query());
    app.use(express.urlencoded());

    // active requests logging
    if( user_config.log ){
      app.use(express.logger('dev'));
    }
    app.use(app.router);



    var write_handler = function(){
      return function(code, headers, buf, res){
        res.writeHead(code, headers);
        deliverer.enqueue(buf, res);
      };
    };

    // Built-in routes
    // --------------

    // **JSON Pong responder**
    /**
     * req is an object representing the response to send
     * {
     *  response_code:xx
     *  response_body:xx
     * }
     *
     * @param req
     * @param res
     * @param next
     */
    function pong_response(req, res){
      var headers = {
        'Content-Type': 'application/json'
      };
      res.writeHead(req.body.response_code || 404, headers);
      res.end(req.body.response_body);
    }
    // use this route to respond what you send
    // useful for ajax mocking purpose
    app.use("/pong",pong_response);

    // **dashboard management**
    /**
     * @param req
     * @param res
     * @param next
     */
    function enable_dashboard(req, res){
      dashboard_enabled = true;
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end( "ok" );
    }
    app.get("/enable_dashboard", enable_dashboard);
    /**
     * @param req
     * @param res
     * @param next
     */
    function disable_dashboard(req, res){
      dashboard_enabled = false;
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end( "ok" );
    }
    app.get("/disable_dashboard", disable_dashboard);

    // **Latency management**
    /**
     * Returns the current
     * maximum latency
     * configuration : [0-9]+ms
     *
     * route is in the form
     *  /stryke_get_max_congestion
     *
     * @param req
     * @param res
     * @param next
     */
    function max_latency_getter(req, res){

      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end( deliverer.get_congestion()[1] );
    }
    app.get("/stryke_get_max_congestion", max_latency_getter);

    /**
     * Sets the maximum latency
     * configuration
     *
     * route is in the form
     *  /stryke_max_congestion/[0-9]+(ms|s)
     *
     * @param req
     * @param res
     * @param next
     */
    function max_latency_setter(req, res){

      deliverer.set_max_congestion( req.param("congestion") );
      console.log("Set maximum latency to "+req.param("congestion") );

      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end("ok");
    }
    app.get("/stryke_max_congestion/:congestion", max_latency_setter);

    /**
     * Returns the current
     * minimum latency
     * configuration : [0-9]+ms
     *
     * route is in the form
     *  /get_stryke_min_congestion
     *
     * @param req
     * @param res
     * @param next
     */
    function min_latency_getter(req, res){
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end( deliverer.get_congestion()[0] );
    }
    app.get("/get_stryke_min_congestion", min_latency_getter);


    /**
     * Sets the minimum latency
     * configuration
     *
     * route is in the form
     *  /stryke_min_congestion/[0-9]+(ms|s)
     *
     * @param req
     * @param res
     * @param next
     */
    function min_latency_setter(req, res){

      deliverer.set_min_congestion( req.param("congestion") );
      console.log("Set minimum latency to "+req.param("congestion"));

      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end("ok");
    }
    app.get("/stryke_min_congestion/:congestion", min_latency_setter);

    // **Bandwidth management**
    /**
     * Returns the current
     * bandwidth
     * configuration : [0-9]+k
     *
     * route is in the form
     *  /stryke_get_bdw
     *
     * @param req
     * @param res
     * @param next
     */
    function bdw_getter(req, res, next){
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end( deliverer.get_bdw() );
    }
    app.get("/stryke_get_bdw", bdw_getter);

    /**
     * Sets the minimum latency
     * configuration
     *
     * route is in the form
     *  /stryke_bdw/[0-9]+(b|kb|mb)
     *
     * @param req
     * @param res
     * @param next
     */
    function bdw_setter(req, res){

      deliverer.set_bdw(req.param("bdw"));
      console.log("Set bandwidth to "+req.param("bdw"));

      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end("ok");
    }
    app.get("/stryke_bdw/:bdw", bdw_setter);

    // **Cache management**
    // ensure the build cache is empty
    /**
     * ensure the build cache is empty
     *
     * route is in the form
     *  /stryke_clean
     *
     * @param req
     * @param res
     * @param next
     */
    function clean_cache(req, res){

      file_utils.deleteFolderRecursive(user_config.out_dir);
      grunt.file.mkdir(user_config.out_dir);

      file_utils.deleteFolderRecursive(user_config.meta_dir);
      grunt.file.mkdir(user_config.meta_dir);

      var headers = {
        'Content-Type': 'text/html'
      };
      res.writeHead(200, headers);
      res.end("ok");
    }
    app.get("/stryke_clean", clean_cache);

    // **Documentation management**
    /**
     * Invoke grunt task for documentation
     *
     * @param req
     * @param res
     * @param next
     */
    function invoke_documentation_tasks(req, res){
      var headers = {
        'Content-Type': 'text/html'
      };
      grunt.tasks(["phantomizer-docco","phantomizer-styledocco"], {}, function(){
        res.writeHead(200, headers);
        res.end("ok");
      });
    }
    app.get("/sryke_generate_documentation", invoke_documentation_tasks);

    /**
     * lists a documentation directory
     * in an html fashion
     *
     * @param req
     * @param res
     * @param next
     */
    function list_documentation_dir(req, res, next){
      var request_path = req.path;

      if( request_path.match(/^\/stryke_doc(.*)/) ){
        request_path = request_path.match(/^\/stryke_doc(.*)/)[1];
        var path = user_config.documentation_dir+request_path;

        if( grunt.file.isDir(path) ){
          var items = http_utils.merged_dirs([user_config.documentation_dir], request_path);
          for(var i in items) {
            items[i].path = "/stryke_doc"+items[i].path;
          }
          dirlisting.generate_directory_listing(items, function(err, html){
            res.end(html);
          });
        }else{
          next();
        }
      }else{
        next();
      }
    }
    app.get("/stryke_doc/*", list_documentation_dir);

    /**
     * reads a documentation file
     * in an html fashion
     *
     * @param req
     * @param res
     * @param next
     */
    function read_documentation_file(req, res, next){
      var request_path = req.path;

      if( request_path.match(/^\/stryke_doc(.*)/) ){
        request_path = request_path.match(/^\/stryke_doc(.*)/)[1];
        var path = user_config.documentation_dir+request_path;

        if( grunt.file.isFile(path) ){
          var headers = {
            'Content-Type': http_utils.header_content_type(request_path)
          };
          res.writeHead(200, headers);
          res.end( fs.readFileSync(path));
        }else{
          next();
        }
      }else{
        next();
      }
    }
    app.get("/stryke_doc/*", read_documentation_file);

    // **Base64 support**
    /**
     * Returns base64 encoded version
     * of a file
     *
     * route is in the form
     *  /stryke_b64/some/file.ext
     *
     * @param req
     * @param res
     * @param next
     */
    function read_b64_file(req, res, next){
      var request_path = req.path;

      if(request_path.match(/^\/stryke_b64/) ){
        request_path = request_path.replace( /^\/stryke_b64/, "" );

        var file = file_utils.find_file(web_paths, request_path);

        if( file ){
          var buf = fs.readFileSync(file).toString('base64');
          var headers = {
            'Content-Type': http_utils.header_content_type(file)
          };
          res.writeHead(200, headers);
          res.end("data:"+headers['Content-Type']+";base64,"+ buf );
        }else{
          next();
        }
      }else{
        next();
      }
    }
    app.get("/stryke_b64/*", read_b64_file);


    // **Phantomizer build support**

    // render optimized html route
    function optimize_routed_url(req, res, next){
      var request_path = req.path;

      // only if build is enabled and requested in GET params
      if( build_enabled && is_build_required(req) ){

        // catch for html route directory
        var route = router.match(request_path);
        if( route != false ){
          grunt.verbose.ok("found routable url", request_path);

          var headers = {
            'Content-Type': http_utils.header_content_type(request_path)
          };

          var respond = write_handler();

          // profile to use for optimization
          var tgt_build_profile = buidl_profile(req);

          // check cache status
          var is_already_build = optimizer.is_built(tgt_build_profile, request_path);
          var is_fresh_build = optimizer.is_build_fresh(tgt_build_profile, request_path);

          if( is_already_build && is_fresh_build ){
            // read built file
            grunt.log.ok("is_built and is_fresh",request_path);
            optimizer.read_fresh_build(tgt_build_profile, request_path, function(path, buf){
              buf = inject_extras(req, buf, is_phantom,rjs_config);
              if( log_query ) query_logged[request_path] = path;
              respond(200, headers, buf, res);
            })
          }else if(is_already_build){
            // regen the build
            grunt.verbose.ok("is_built and is_not_fresh",request_path);
            optimizer.regen_build(tgt_build_profile, request_path, function(path, buf){
              buf = inject_extras(req, buf, is_phantom,rjs_config);
              if( log_query ) query_logged[request_path] = path;
              respond(200, headers, buf, res);
            });
          }else{
            // make the build
            grunt.verbose.ok("is_not_built and is_not_fresh",request_path);
            optimizer.do_build(tgt_build_profile, request_path, function(path, buf){
              buf = inject_extras(req, buf, is_phantom,rjs_config);
              if( log_query ) query_logged[request_path] = path;
              respond(200, headers, buf, res);
            });
          }
        }else{
          next();
        }
      }else{
        next();
      }
    }
    app.use(optimize_routed_url);

    // render non optimized html route
    function template_routed_url(req, res, next){
      var request_path = req.path;

      // catch for html route directory
      var route = router.match(request_path);
      if( route != false ){
        grunt.verbose.ok("found routable url", request_path);

        var headers = {
          'Content-Type': http_utils.header_content_type(request_path)
        };

        var respond = write_handler();

// look up for response file within many directories
        var file = file_utils.find_file(web_paths, route.template);
        if(!file){
          grunt.log.writeln("request "+request_path +" was matching a router but has a missing file "+route.template);
          next();
        }else{
          var buf = fs.readFileSync(file).toString();
          if( assets_injection_enabled ){
// inject (prepend / append) assets (scripts / css) into the html tree
            var base_url = request_path.substring(0,request_path.lastIndexOf("/")) || "/";
            if( user_config.scripts ){
              grunt.verbose.ok("injecting scripts", request_path);
              create_combined_assets(optimizer, user_config.scripts, user_config.build_run_paths);
              buf = phantomizer_helper.apply_scripts(user_config.scripts, base_url, buf);
            }
            if( user_config.css ){
              grunt.verbose.ok("injecting css", request_path);
              create_combined_assets(optimizer, user_config.css, user_config.build_run_paths);
              buf = phantomizer_helper.apply_styles(user_config.css, base_url, buf);
            }
          }
          buf = inject_extras(req, buf, is_phantom,rjs_config);
          // if the build occurs,
          // add the stryke variable
          // to tell webclient to stop display sooner
          if( is_in_build_process ){
            var stryke = "";
            stryke = stryke+"<script>";
            stryke = stryke+    "var phantomatic = true;";
            stryke = stryke+"</script>";
            buf = buf.replace("</head>", stryke+"</head>");
          }
          if( log_query ) query_logged[request_path] = file;
          respond(200, headers, buf, res);
        }
      }else{
        next();
      }
    }
    app.use(template_routed_url);

    // render combined css/js assets
    function render_combined_asset(req, res, next){
      var request_path = req.path;

      var headers = {
        'Content-Type': http_utils.header_content_type(request_path)
      };
      // look up for non html files
      if( assets_injection_enabled && headers["Content-Type"].indexOf("text/html") == -1 ){

        var is_a_combined_script = optimizer.is_combined_asset(user_config.scripts, request_path);
        var is_a_combined_style = optimizer.is_combined_asset(user_config.css, request_path);

        if( is_a_combined_script || is_a_combined_style ){

          var respond = write_handler();

          var file = file_utils.find_file([user_config.out_dir], request_path);
          var is_fresh_build = optimizer.is_build_fresh(buidl_profile(req), request_path);

          if( file == null || !is_fresh_build ){
            if( is_a_combined_script ){
              create_combined_assets(optimizer, user_config.scripts, user_config.build_run_paths);
            }else{
              create_combined_assets(optimizer, user_config.css, user_config.build_run_paths);
            }
          }
          file = file_utils.find_file([user_config.out_dir], request_path); // we must look up again
          if( log_query ) query_logged[request_path] = file;
          respond(200, headers, fs.readFileSync(file), res);
        }else{
          next();
        }
      }else{
        next();
      }
    }
    app.use(render_combined_asset);

    // render built img/css/js assets
    function render_built_asset(req, res, next){
      var request_path = req.path;

      var headers = {
        'Content-Type': http_utils.header_content_type(request_path)
      };
      // look up for non html files
      if( headers["Content-Type"].indexOf("text/html") == -1 ){

        // profile to use for optimization
        var tgt_build_profile = buidl_profile(req);
        var is_already_build = optimizer.is_built(tgt_build_profile, request_path);

        if( is_already_build ){
          var file = file_utils.find_file([user_config.out_dir], request_path);
          if( file ){
            var respond = write_handler();
            respond(200, headers, fs.readFileSync(file), res);
          }else{
            next();
          }
        }else{
          next();
        }
      }else{
        next();
      }
    }
    app.use(render_built_asset);

    // render any file assets text / binary
    app.use(function(req, res, next){
      var request_path = req.path;

      var headers = {
        'Content-Type': http_utils.header_content_type(request_path)
      };
      var file = file_utils.find_file(web_paths,request_path);

      if( file != null ){
        var respond = write_handler();
        var buf = fs.readFileSync(file);
        respond(200, headers, buf, res);
      }else{
        next();
      }
    });

    // render directory listing
    app.use(function(req, res, next){
      var request_path = req.path;
      var headers = {
        'Content-Type': 'text/html'
      };
      if( request_path != "/" ){
        var file = file_utils.find_dir(web_paths, request_path);
        if( file == null ){
          request_path = null;
        }
      }

      if( request_path !== null ){
        var respond = write_handler();
        var items = http_utils.merged_dirs(web_paths, request_path);
        dirlisting.generate_directory_listing(items, function(err, html){
          respond(200, headers, html, res);
        });
      }else{
        next();
      }
    })

    // render 404 response
    app.use(function(req, res){
      var headers = {
        'Content-Type': 'text/html'
      };
      res.writeHead(404, headers);
      res.end("not found");
    })


    // instance methods
    // ------------

    var wserver = null;
    var wsserver = null;
    /**
     * Starts a web server
     *  eventually also over ssl
     *
     * @param port
     * @param ssl_port
     * @param host
     */
    this.start = function(port, ssl_port, host){
      wserver = http.createServer(app).listen(port, host);
      if( ssl_port ){
        wsserver = http.createServer(app).listen(ssl_port, host);
      }
    };
    /**
     * Stops a web server if started
     *  eventually also ssl
     */
    this.stop = function(done){
      var count = 0;
      var total = 0;
      if( wserver !== null ){
        count++;
        wserver.close(function(){
          total++;
          if( count == total && done) done();
        });
      }
      if( wsserver !== null ){
        count++;
        wsserver.close(function(){
          total++;
          if( count == total && done) done();
        });
      }
      if( count == 0 ){
        done();
      }
    };

    /**
     * Instructs the web server
     *  to inject is_phantom=true; variable
     *
     * @param is_phantom
     */
    this.is_phantom = function( is ){
      is_phantom = is;
    };

    /**
     * Instructs the web server
     *  to inject is_phantomizing=true; variable
     *
     *  it tells the build process occurs
     *
     * @param is_in_build_process
     */
    this.is_in_build_process = function( is ){
      is_in_build_process = is;
    };

    /**
     * Instructs the web server
     *  to enabled the dashboard
     *  could still be overridden by GET variable
     *
     * @param enabled
     */
    this.enable_dashboard = function(enabled){
      dashboard_enabled = !!enabled;
    };

    /**
     * Instructs the web server
     *  to add globals to the DOM
     *
     * @param injected_var
     */
    this.inject_globals = function(injected_var){
      globals_injected = injected_var;
    };

    /**
     * Instructs the web server
     *  to apply the build if GET.build_profile=.+
     *
     * @param enabled
     */
    this.enable_build = function(enabled){
      build_enabled = !!enabled;
    };

    /**
     * Instructs the web server
     *  to build/refresh/inject combined assets
     *
     * @param enabled
     */
    this.enable_assets_inject = function(enabled){
      assets_injection_enabled = !!enabled;
    };



    /**
     * Instructs the web server
     *  to logs queries that was identified as real files
     *
     * @param enabled
     */
    this.enable_query_logs = function(enabled){
      log_query = !!enabled;
    };
    this.clear_query_logs = function(){
      query_logged = [];
    };
    /**
     * Returns an query_logged
     *  [ request ] => file_path
     * @returns {Array}
     */
    this.get_query_logs = function(){
      return query_logged;;
    };

    // helper functions
    // ----------

    function buidl_profile(req){
      return req.query.build_profile || "";
    }
    function is_build_required(req){
      return req.query.build_profile
        || false;
    }


    function create_combined_assets(optimizer, assets_combination, source_paths){
      if( assets_combination.append ){
        for( var target_merge in assets_combination.append ){
          if( target_merge.length > 1 ){
            var asset_deps = assets_combination.append[target_merge];
            optimizer.merge_files(target_merge, asset_deps, source_paths);
            grunt.verbose.ok("merged "+target_merge+"")
          }
        }
      }
      if( assets_combination.prepend ){
        for( var target_merge in assets_combination.prepend ){
          if( target_merge.length > 1 ){
            var asset_deps = assets_combination.prepend[target_merge]
            optimizer.merge_files(target_merge, asset_deps, source_paths);
            grunt.verbose.ok("merged "+target_merge+"")
          }
        }
      }
    }

    // inject extra html content within routed request
    function inject_extras(req,buf, is_phantom,rjs_config){

      if( rjs_config ){
        buf = phantomizer_helper.inject_requirejs(rjs_config.baseUrl, rjs_config.src, rjs_config.paths, buf, null);
      }

      if( is_phantom ){
        buf = phantomizer_helper.inject_phantom(buf);
      }

      var inject = false;
      if( (req.query.device || req.query.spec_files || (dashboard_enabled && req.query.no_dashboard!=="true") ) ){
        inject = true;
      }

      if( globals_injected ){
        buf = buf.replace("</head>","<script>window.phantomizer_globals="+JSON.stringify(globals_injected)+"</script></head>");
      }

      if( inject ){
        var injected = '/js/vendors/go-phantomizer/extras-loader.js';
        buf = phantomizer_helper.inject_after_requirejs(rjs_config.baseUrl, rjs_config.src, rjs_config.paths, buf, injected);
      }
      return buf;
    };

  };


  // Expose the constructor function.
  exports.webserver = webserver;
}(typeof exports === 'object' && exports || this));




