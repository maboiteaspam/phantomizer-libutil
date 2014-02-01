
(function(exports) {
	var delivery_f = (function(){
		return function(content, net_socket, id){
			
			var buffer = content
			if( content.substring )
				buffer = new Buffer(content)
				
			var that = this
			that.id = id
			that.net_socket = net_socket
			that.buffer = buffer
			that.size = buffer.length
			that.consumed = 0
			that.has_flushed = false
			that.consume = function(length){
				// return true / false
				if( that.consumed+length > that.size ){
					length = that.size - that.consumed
				}
				
				if( length > 0 ){
					that.net_socket.write( that.buffer.slice(that.consumed, that.consumed+length) )
					that.consumed+=length
				}

				if( that.consumed >= that.size ){
					return false;
				}
				return true
			}
			that.flush = function(){
				if( ! that.has_flushed ){
					that.has_flushed = true
					if( that.consumed <= that.size ){
						that.consume(that.size - that.consumed)
					}
					that.net_socket.end();
					return true
				}
				return false
			}
			that.deliver = function(queue){

				var one_sec = 1000;
				var l = queue.bdw == 0 ? 
						that.size : 
						queue.bdw / ( one_sec) / (queue._count)
				if( that.consume( parseInt(l) ) == false ){
					that.flush();
					queue._count--
				}else{
					var inter = 1;
					setTimeout(function(){
						that.deliver(queue)
					}, inter );
				}
			}
		}
	})()
	
	
	var delivery_queue = function(){
		// purely private..
		var that = this;
		
		that.deliveries = {}
		that._count = 0
		that._id = 0
		
		that.bdw = 0
		that.timeout = null
		// public
		that.enqueue = function(content, net_socket){
			
			that._count++
			that._id++
			
			var delivery = new delivery_f(content, net_socket, that._count)
			
			delivery.deliver(that);
			
			return delivery
		}
		that.set_bdw = function(bdw){
			that.bdw = parseInt(bdw)*1024
		}
		that.get_bdw = function(){
			return that.bdw
		}
	};
	
  // Expose the constructor function.
  exports.delivery_queue = delivery_queue;
}(typeof exports === 'object' && exports || this));
