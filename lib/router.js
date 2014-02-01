
(function(exports) {

    var fs = require("fs")
    var http = require("http")

    var router = function(routes){
        //-

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
        this.match = function(url){
            for( var n in routes ){
                var route = routes[n];
                if(route.urls && route.urls.indexOf(url)>-1){
                    return route;
                }else if( route.pattern && route.pattern.match(url) ){
                    return route;
                }else if(route.template && route.template == url){
                    return route;
                }
            }
            return false;
        };
        this.collect_urls = function(){
            var urls = [];
            for( var n in routes ){
                var route = routes[n];
                if(route.urls && route.urls.length > 0){
                    for(var t in route.urls)
                        urls.push(route.urls[t]);
                }else if(route.template){
                    urls.push(route.template);
                }
            }
            return urls;
        };
        this.collect_meta_urls = function(){
            var urls = [];
            for( var n in routes ){
                var route = routes[n];
                if(route.urls && route.urls.length > 0){
                    for(var t in route.urls)
                        urls.push({url:route.urls[t], meta:route});
                }else if(route.template){
                    urls.push({url:route.template, meta:route});
                }
            }
            return urls;
        };
    };

    function read_routing_urls(route_options,then){
        var urls = [];
        if (route_options.urls_datasource){
            console.log("Reading urls from URL "+route_options.urls_datasource);
            read_url(route_options.urls_datasource, function(status,content){
                urls = JSON.parse(content);
                if( urls.data && toString.call(urls.data) == '[object Array]' ){
                    then(urls.data);
                }else if ( toString.call(urls) == '[object Array]' ){
                    then(urls);
                }
            });
        }else{
            if (route_options.urls_file){
                urls = fs.readFileSync(route_options.urls_file);
                console.log("Reading urls from file "+route_options.urls_file);
                urls = JSON.parse(urls);
            }else if( route_options.urls ){
                urls = route_options.urls;
                console.log("Reading urls inlined from options");
            }else if (route_options.url){
                urls = [route_options.url];
                console.log("Reading urls inlined from options");
            }
            then(urls);
        }
    }
    function read_url(url,then){
        var content = '';
        http.get(url, function(res) {
            console.log("Got response: " + res.statusCode);
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                if( content.length == 0 && chunk.match(/^[a-z0-9]+\s+[{]/igm) )
                    content+=chunk.substr(chunk.indexOf("\n"));
                else
                    content+=chunk;
                console.log('BODY: ' + chunk.length);
            });
            res.on('end', function() {
                content = content.trim();
                if( content.match(/[}]\s+[0-9]+$/) )
                    content = content.substr(0,content.length-1)
                if( then) then(true,content);
            });
        }).on('error', function(e) {
            console.log("Got error: " + e.message);
            if( then) then(false,content);
        });
    }

    // Expose the constructor function.
    exports.router = router;
}(typeof exports === 'object' && exports || this));

