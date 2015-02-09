var connect = require('connect'),
    socketio = require('socket.io');

var port = process.env.PORT || 3000;
var server = connect(
    connect.static(__dirname + '/public')
).listen(port);

var data = [
    {text:'learn angular', done:true, id: 1},
    {text:'build an angular app', done:false, id: 2}];

var io = socketio.listen(server);
var users = [];

io.sockets.on('connection', function(socket) {
    var user = {
        socket: socket
    };

    users.push(user);

    socket.on('newUser', function(data){
        var userName = data.name;
        var otherUsers = [];

        for(var i = 0; i < users.length; i++){
            if(users[i].socket == socket)
                users[i].name = userName;
        }

        console.log(users);

        for(var i = 0; i < users.length; i++){
            var otherUsers = users.filter(notCurrent)
                .map(toName);

            users[i].socket.emit('users', otherUsers);

            function notCurrent(user){
                return (users[i].socket != user.socket) && users[i].name;
            }

            function toName(user){
                return user.name
            }
        }

    });

    socket.on('disconnect', function(){
        for(var i = 0; i < users.length; i++){
            if(users[i].socket == socket)
                users.splice(i, 1);
        }
        for(var i = 0; i < users.length; i++){
            var otherUsers = users.filter(notCurrent)
                .map(toName);

            users[i].socket.emit('users', otherUsers);

            function notCurrent(user){
                return (users[i].socket != user.socket) && users[i].name;
            }

            function toName(user){
                return user.name
            }
        }
    });

    socket.emit('change', data);

    socket.on('change', function(obj) {
        console.log(obj);
        data = obj;
        socket.broadcast.emit('change', data);
    });
});