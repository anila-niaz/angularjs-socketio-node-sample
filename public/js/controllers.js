angular.module('todo')
    .controller('TodoController', [
        '$scope',
        '$rootScope',
        '$q',
        'ConnectionService',
        function($scope, $rootScope, $q, ConnectionService){
            $scope.connected = false;
            $scope.messages = "";

            var socket = ConnectionService.socket;

            socket.on('change', function(obj) {
                $scope.todos = obj;
                $scope.$apply();
            });

            socket.on('users', function(data){
                if (!ConnectionService.acisionSDK)
                    return;

                ConnectionService.addPresentities(data);
            });

            $scope.addTodo = function() {
                $scope.todos.push({text:$scope.todoText, done: false, id: $scope.todos.length + 1});
                $scope.todoText = '';
                socket.emit('change', $scope.todos);
            };

            $scope.remaining = function() {
                var count = 0;
                angular.forEach($scope.todos, function(todo) {
                    count += todo.done ? 0 : 1;
                });
                return count;
            };

            $scope.archive = function() {
                var oldTodos = $scope.todos;
                $scope.todos = [];
                angular.forEach(oldTodos, function(todo) {
                    if (!todo.done) $scope.todos.push(todo);
                });
                socket.emit('change', $scope.todos);
            };

            $scope.change = function() {
                socket.emit('change', $scope.todos);
            };

            $scope.login = function(username, password){
                ConnectionService.connect(username, password);
            }

            $scope.sendMessage = function(){
                ConnectionService.sendMessageToAvailableUsers($scope.users, $scope.message);
            };

            $scope.call = function(address){
                ConnectionService.callUser(address);
            };

            $rootScope.$on(ConnectionService.EVENTS.CONNECTED, function(event, data){
                if(data && data.user)
                    $scope.user = data.user;

                $scope.connected = true;
                $scope.$apply();
            });

            $rootScope.$on(ConnectionService.EVENTS.PRES_ADDED, function(event, data){
                if(data && data.users)
                    $scope.users = data.users;
                $scope.connected = true;
                $scope.$apply();
            });

            $rootScope.$on(ConnectionService.EVENTS.UPDATED, function(event, data){
                if(data.presentities){
                    $scope.users.forEach(function(user){
                        for(var i = 0; i < data.presentities.length; i++)
                            if(user.address == data.presentities[i].user)
                                user.status = data.presentities[i].fields.status;
                    });

                    $scope.$apply();
                }
            });

            $rootScope.$on(ConnectionService.EVENTS.MESSAGE_RECEIVED, function(event, data){
                if(data.message){
                    $scope.messages += '\n' + data.message.from.split('@')[0] + ': ' + data.message.content;
                    $scope.$apply();
                }
            });

            $scope.$watch('user.status', function(){
                if(!$scope.user)
                    return;

                ConnectionService.updateAvailability($scope.user.status);
            });
        }]);
