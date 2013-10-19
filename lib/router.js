
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
            if( routes.length > 0 )
                read_routing_urls(routes[0],next);
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
    };

    function read_routing_urls(options,then){
        var urls = [];
        if (options.urls_datasource){
            console.log("Reading urls from URL "+options.urls_datasource);
            read_url(options.urls_datasource, function(status,content){
                urls = JSON.parse(content);
                then(urls.data);
            });
        }else{
            if (options.urls_file){
                urls = fs.readFileSync(options.urls_file);
                console.log("Reading urls from file "+options.urls_file);
                urls = JSON.parse(urls);
            }else if( options.urls ){
                urls = options.urls;
                console.log("Reading urls inlined from options");
            }else if (options.url){
                urls = [options.url];
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

