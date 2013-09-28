
(function(exports) {
    var router = function(routes){
        //-
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
    };


    // Expose the constructor function.
    exports.router = router;
}(typeof exports === 'object' && exports || this));

