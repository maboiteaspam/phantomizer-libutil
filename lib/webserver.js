
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

  var webserver = function(router,optimizer,meta_manager,working_dir, user_config,grunt){

    // requirejs options
    var requirejs_src = user_config.scripts.requirejs.src;
    var requirejs_baseUrl = user_config.scripts.requirejs.baseUrl;
    var requirejs_paths = user_config.scripts.requirejs.paths;


    // Server side Bandwidth and congestion manager
    var min_congestion = 0;
    var max_congestion = 0;
    var cur_bdw = 0;
    var deliverer = new delivery_queue();

    // HTML Document injection and manipulation
    var is_phantomizing = false;
    var dashboard_enabled = true;
    var build_enabled = true;
    var assets_injection_enabled = true;

    // new connect web server
    var connect = require('connect');
    var app = connect();
    app.use(connect.query());
    app.use(connect.urlencoded());

    // active requests logging
    if( user_config.log ){
      app.use(connect.logger('dev'));
    }


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
    function pong_response(req, res, next){
      var headers = {
        'Content-Type': 'application/json'
      };
      res.writeHead(req.body.response_code || 404, headers);
      res.end(req.body.response_body);
    }
    // use this route to respond what you send
    // useful for ajax mocking purpose
    app.use("/pong",pong_response);

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
    function max_latency_getter(req, res, next){
      var headers = {
        'Content-Type': 'text/html'
      };
      res.writeHead(200, headers);
      res.end(max_congestion+"ms");
    }
    app.use("/stryke_get_max_congestion", max_latency_getter);

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
    function max_latency_setter(req, res, next){
      var request_path = get_request_path( req.originalUrl );
      if( request_path.match(/^\/stryke_max_congestion\/(.*)[ms|s]$/) ){
        var n = request_path.match(/^\/stryke_max_congestion\/(.*)[ms|s]$/)[1]
        max_congestion = parseInt(n);

        var headers = {
          'Content-Type': 'text/html'
        };
        res.writeHead(200, headers);
        res.end("ok");
      }
    }
    app.use("/stryke_max_congestion", max_latency_setter);

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
    function min_latency_getter(req, res, next){
      var headers = {
        'Content-Type': 'text/html'
      };
      res.writeHead(200, headers);
      res.end(min_congestion+"ms");
    }
    app.use("/get_stryke_min_congestion", min_latency_getter);


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
    function min_latency_setter(req, res, next){
      var request_path = get_request_path( req.originalUrl );
      if( request_path.match(/^\/stryke_min_congestion\/(.*)[ms|s]$/) ){
        var n = request_path.match(/^\/stryke_min_congestion\/(.*)[ms|s]$/)[1];
        min_congestion = parseInt(n);

        cur_bdw = parseInt(n);
        var headers = {
          'Content-Type': 'text/html'
        };
        res.writeHead(200, headers);
        res.end("ok");
      }
    }
    app.use("/stryke_min_congestion", min_latency_setter);

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
      var headers = {
        'Content-Type': 'text/html'
      };
      res.writeHead(200, headers);
      res.end(cur_bdw+"k");
    }
    app.use("/stryke_get_bdw", bdw_getter);

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
    function bdw_setter(req, res, next){
      var request_path = get_request_path( req.originalUrl );
      if( request_path.match(/^\/stryke_bdw\/(.*)[b|kb,mb]$/) ){
        var n = request_path.match(/^\/stryke_bdw\/(.*)[b|kb,mb]/)[1];

        cur_bdw = parseInt(n);
        deliverer.set_bdw( n );
        var headers = {
          'Content-Type': 'text/html'
        };
        res.writeHead(200, headers);
        res.end("ok");
      }
    }
    app.use("/stryke_bdw", bdw_setter);

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
    function clean_cache(req, res, next){

      var grunt = require('grunt');

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
    app.use("/stryke_clean", clean_cache);

    // **Documentation management**
    /**
     * Invoke grunt task for documentation
     *
     * @param req
     * @param res
     * @param next
     */
    function invoke_documentation_tasks(req, res, next){
      var headers = {
        'Content-Type': 'text/html'
      };
      grunt.config.init(user_config);
      grunt.tasks(["phantomizer-docco","phantomizer-styledocco"], {}, function(){
        res.writeHead(200, headers);
        res.end("ok");
      });
    }
    app.use("/sryke_generate_documentation", invoke_documentation_tasks);

    /**
     * lists a documentation directory
     * in an html fashion
     *
     * @param req
     * @param res
     * @param next
     */
    function list_documentation_dir(req, res, next){
      var request_path = get_request_path( req.originalUrl );
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
    app.use("/stryke_doc", list_documentation_dir);

    /**
     * reads a documentation file
     * in an html fashion
     *
     * @param req
     * @param res
     * @param next
     */
    function read_documentation_file(req, res, next){
      var request_path = get_request_path( req.originalUrl );

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
    app.use("/stryke_doc", read_documentation_file);

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
      var request_path = get_request_path( req.originalUrl );

      if(request_path.match(/^\/stryke_b64/) ){
        request_path = request_path.replace( /^\/stryke_b64/, "" );

        var file = file_utils.find_file(user_config.web_paths, request_path);

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
    app.use("/stryke_b64", read_b64_file);


// serve routed request
    app.use(function(req, res, next){
      var request_path = get_request_path( req.originalUrl )

// catch for html route directory
      var route = router.match(request_path);
      if( route != false ){
        grunt.verbose.ok("found routable url", request_path);

        var headers = {
          'Content-Type': http_utils.header_content_type(request_path)
        };
        var respond = write_handler(max_congestion,min_congestion,deliverer);
// if there s a build= GET argument
        if( build_enabled && is_build_required(req) ){
          var tgt_build_profile = buidl_profile(req);
          var is_already_build = optimizer.is_built(tgt_build_profile, request_path);
          var is_fresh_build = optimizer.is_build_fresh(tgt_build_profile, request_path);

          if( is_already_build && is_fresh_build ){
// read built file
            grunt.log.ok("is_built and is_fresh",request_path);
            optimizer.read_fresh_build(tgt_build_profile, request_path, function(path, buf){
              buf = inject_extras(req, buf)
              respond(200, headers, buf, res)
            })
          }else if(is_already_build){
// regen the build
            grunt.verbose.ok("is_built and is_not_fresh",request_path);
            optimizer.regen_build(tgt_build_profile, request_path, function(path, buf){
              buf = inject_extras(req, buf)
              respond(200, headers, buf, res)
            });
          }else{
// make the build
            grunt.verbose.ok("is_not_built and is_not_fresh",request_path);
            optimizer.do_build(tgt_build_profile, request_path, function(path, buf){
              buf = inject_extras(req, buf)
              respond(200, headers, buf, res)
            });
          }
        }else{
// look up for response file within many directories
          var file = file_utils.find_file(user_config.web_paths, route.template);
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
          buf = phantomizer_helper.inject_requirejs(requirejs_baseUrl, requirejs_src, requirejs_paths, buf, null);
          buf = inject_extras(req, buf)
          respond(200, headers, buf, res)
        }
      }else{
        next();
      }
    });

// serve combined/merged/build assets
    app.use(function(req, res, next){
      var request_path = get_request_path( req.originalUrl )

      var headers = {
        'Content-Type': http_utils.header_content_type(request_path)
      };
// look up for non html files
      if( headers["Content-Type"].indexOf("text/html") == -1 ){

        var file = file_utils.find_file([user_config.out_dir], request_path);
        var respond = write_handler(max_congestion,min_congestion,deliverer);
        if( file != null ){
          var buf = null;

          var is_already_build = optimizer.is_built(buidl_profile(req), request_path);
          var is_fresh_build = optimizer.is_build_fresh(buidl_profile(req), request_path);

          if( build_enabled && is_already_build ){
            if( is_fresh_build ){
              buf = fs.readFileSync(file)
              respond(200, headers, buf, res)
            }else if( assets_injection_enabled ){
              var is_a_combined_script = optimizer.is_combined_asset(user_config.scripts, request_path);
              var is_a_combined_style = optimizer.is_combined_asset(user_config.css, request_path);
// check for combined scripts
              if( is_a_combined_script ){
                create_combined_assets(optimizer, user_config.scripts, user_config.build_run_paths);
                file = file_utils.find_file([user_config.out_dir], request_path); // we must look up again
                buf = fs.readFileSync(file);
                respond(200, headers, buf, res);
// check for combined styles
              }else if( is_a_combined_style ){
                create_combined_assets(optimizer, user_config.css, user_config.build_run_paths);
                file = file_utils.find_file([user_config.out_dir], request_path); // we must look up again
                buf = fs.readFileSync(file);
                respond(200, headers, buf, res);
              }else{
                // @todo replace with next if possible
                buf = fs.readFileSync(file)
                respond(200, headers, buf, res)
              }
            }else{
              // @todo replace with next if possible
              buf = fs.readFileSync(file);
              respond(200, headers, buf, res);
            }
          }else{
            // @todo replace with next if possible
            buf = fs.readFileSync(file);
            respond(200, headers, buf, res);
          }
// combined scripts does not exists yet
        }else if( assets_injection_enabled && optimizer.is_combined_asset(user_config.scripts, request_path) ){
          create_combined_assets(optimizer, user_config.scripts, user_config.build_run_paths);
          file = file_utils.find_file([user_config.out_dir], request_path);
          buf = fs.readFileSync(file);
          respond(200, headers, buf, res);
// combined css does not exists yet
        }else if( assets_injection_enabled && optimizer.is_combined_asset(user_config.css, request_path) ){
          create_combined_assets(optimizer, user_config.css, user_config.build_run_paths);
          file = file_utils.find_file([user_config.out_dir], request_path);
          buf = fs.readFileSync(file);
          respond(200, headers, buf, res);
        }else{
          next()
        }
      }else{
        next()
      }
    });
// server any assets text / binary
    app.use(function(req, res, next){
      var request_path = get_request_path( req.originalUrl );

      grunt.verbose.writeln(request_path);

      var headers = {
        'Content-Type': http_utils.header_content_type(request_path)
      };
      var file = file_utils.find_file(user_config.web_paths,request_path);

      if( file != null ){
        var respond = write_handler(max_congestion,min_congestion,deliverer);
        var buf = fs.readFileSync(file);
        respond(200, headers, buf, res);
      }else{
        next();
      }

    });
// server directory listing
    app.use(function(req, res, next){
      var request_path = get_request_path( req.originalUrl )
      var headers = {
        'Content-Type': 'text/html'
      };
      var items = [];
      var respond = write_handler(max_congestion,min_congestion,deliverer);
      if( request_path == "/" ){
        items = http_utils.merged_dirs(user_config.web_paths, "/");
        dirlisting.generate_directory_listing(items, function(err, html){
          respond(200, headers, html, res);
        });
      }else{
        var file = file_utils.find_dir(user_config.web_paths, request_path);
        if( file != null ){
          items = http_utils.merged_dirs(user_config.web_paths, request_path);
          dirlisting.generate_directory_listing(items, function(err, html){
            respond(200, headers, html, res);
          });
        }else{
          next();
        }
      }
    })
// serve 404 response
    app.use(function(req, res){
      var headers = {
        'Content-Type': 'text/html'
      };
      res.writeHead(404, headers)
      res.end("not found")
    })


    this.is_phantom = function( is_phantom ){
      is_phantomizing = is_phantom;
    };
    var wserver = null;
    var wsserver = null;
    this.start = function(port, ssl_port, host){
      wserver = http.createServer(app).listen(port, host);
      if( ssl_port )
        wsserver = http.createServer(app).listen(ssl_port, host);
    };
    this.stop = function(){
      if( wserver !== null )
        wserver.close();
      if( wsserver !== null )
        wsserver.close();
    };
    this.enable_dashboard = function(enabled){
      dashboard_enabled = !!enabled;
    };
    this.enable_build = function(enabled){
      build_enabled = !!enabled;
    };
    this.enable_assets_inject = function(enabled){
      assets_injection_enabled = !!enabled;
    };

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
    function inject_extras(req,buf){

      buf = phantomizer_helper.inject_requirejs(requirejs_baseUrl, requirejs_src, requirejs_paths, buf, null);

      if( is_phantomizing ){
        buf = phantomizer_helper.inject_phantom( buf);
      }

      var inject = false;
      if( (req.query.device || req.query.spec_files) ){
        inject = true;
      }else if( !req.query.no_dashboard ){
        inject = true;
      }

      if( inject && req.query.no_dashboard ){
        buf = buf.replace("</head>","<script>window.no_dashboard=true;</script></head>")
      }

      if( inject ){
        var injected = '/js/vendors/go-phantomizer/extras-loader.js';
        buf = phantomizer_helper.inject_after_requirejs(requirejs_baseUrl,requirejs_src, requirejs_paths, buf, injected);
      }
      return buf;
    };

  };

  function write_handler(max_congestion,min_congestion,deliverer){
    return function(code, headers, buf, res){
      res.writeHead(code, headers);

      var congestion = Math.floor((Math.random()*max_congestion)+min_congestion);
      setTimeout(function(){
        deliverer.enqueue(buf, res);
      }, congestion);
    };
  }

  function get_request_path( request_path ){
    if( request_path.indexOf("?")>-1){
      request_path = request_path.substring(0,request_path.indexOf("?"))
    }
    return request_path
  }


  // Expose the constructor function.
  exports.webserver = webserver;
}(typeof exports === 'object' && exports || this));




