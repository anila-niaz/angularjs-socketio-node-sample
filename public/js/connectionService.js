/**
 * Created with IntelliJ IDEA.
 * User: Anila
 * Date: 08/02/15
 * Time: 23:27
 */
angular.module('todo')
    .service('ConnectionService', [
        '$q',
        '$rootScope',
        '$document',
        function($q, $rootScope, $document) {
            var API_KEY; //Enter you API key here
            var STATUS_AVAILABLE = "available";
            var STATUS_UNAVAILABLE = "unavailable";

            var acisionSDK;
            var session;
            var socket = io.connect();
            var users = [];

            var ConnectionService = {
                get socket(){
                    return socket;
                },
                get acisionSDK(){
                    return acisionSDK;
                },
                get users(){
                    return users;
                }
            };

            ConnectionService.EVENTS = {
                CONNECTED: 'connected',
                UPDATED: 'updated',
                MESSAGE_RECEIVED: 'messageReceived',
                PRES_ADDED: 'presentitiesAdded'
            };

            ConnectionService.getAcision = function(){
                return acisionSDK;
            };

            /*
             Connects a user to acision sdk and registers for messages and audio calls
             */
            ConnectionService.connect = function(username, password, authenticationSuccessCallback, messageReceivedCallback){
                acisionSDK = new AcisionSDK(API_KEY, {
                    onConnected: function() {
                        console.log("Authentication succeded");

                        /*
                         Listening for incoming audio call
                         */
                        acisionSDK.webrtc.setCallbacks({
                            onIncomingSession: function(event) {
                                session = event.session;
                                var element = angular.element(document.querySelector('#remote-audio'))[0];
                                session.remoteAudioElement = element;
                                session.accept();
                            }
                        });

                        /*
                         Listening for incoming messages
                         */
                        acisionSDK.messaging.setCallbacks({
                            onMessage: function(message){
                                $rootScope.$emit(ConnectionService.EVENTS.MESSAGE_RECEIVED, {message: message});
                            }
                        });

                        /*
                         Setting own status
                         */
                        acisionSDK.presence.setOwnPresentity({
                            status: STATUS_AVAILABLE
                        });

                        socket.emit('newUser', {name: acisionSDK.getAddress()});
                        $rootScope.$emit(ConnectionService.EVENTS.CONNECTED, {user: {name: username, status: STATUS_AVAILABLE}});
                    },
                    onAuthFailure: function() {
                        console.warn("Authentication failed");
                    }
                }, {
                    username: username,
                    password: password,
                    persistent: true
                });
            };

            /*
             Gets presentities for users provided in parameter
             Starts listening to presentity updated (state change) for these users
             */
            ConnectionService.addPresentities = function(userData){
                acisionSDK.presence.getAllPresentities(userData, ["status"], {
                    onSuccess: function(pre){
                        /*
                         Listen to presentity updates for users
                         */
                        acisionSDK.presence.subscribe(userData, ["status"], {
                            onSuccess: function(){
                                acisionSDK.presence.setCallbacks({
                                    onPresentity: function(presentities){
                                        $rootScope.$emit(ConnectionService.EVENTS.UPDATED, {presentities: presentities});
                                    }
                                });

                                $rootScope.$emit(ConnectionService.EVENTS.PRES_ADDED, {users: pre.reduce(toPresUser, [])});
                                users = pre.reduce(toPresUser, []);

                                function toPresUser(result, presentity){
                                    for(var i = 0; i < userData.length; i++){
                                        if(presentity.user == userData[i]){
                                            result.push({
                                                name: userData[i].split('@')[0],
                                                address: userData[i],
                                                status: presentity.fields.status
                                            });
                                        }
                                    }

                                    return result;
                                }
                            }
                        });

                    },
                    onError: function(code, message){
                        console.log(code, message);
                        return null;
                    }
                });
            };

            ConnectionService.updateAvailability = function(value){
                acisionSDK.presence.setOwnPresentity({
                    status: (value == STATUS_AVAILABLE)? STATUS_AVAILABLE : STATUS_UNAVAILABLE
                });
            };

            /*
             Sends messages to groups.
             Once messages are sent the group is deleted.
             */
            ConnectionService.sendMessageToGroups = function(groups, message){
                if(!message || message.length == 0)
                    return;

                acisionSDK.messaging.sendToGroup(groups, message, null, {
                    onAcknowledged: function(){
                        groups.forEach(function(group){
                            acisionSDK.contacts.deleteGroup(group);
                        });
                    },
                    onError: function(code, message){
                        groups.forEach(function(group){
                            acisionSDK.contacts.deleteGroup(group);
                        });
                    }
                });
            };

            /*
             Creates a temporary group with available users it it.
             */
            ConnectionService.sendMessageToAvailableUsers = function(users, message){
                if(!message || message.length == 0)
                    return;

                var availableUsers = users.filter(isAvailable)
                    .map(toAddress);

                var group = "message";

                /*
                 Creating a temporary group with available users it it.
                 */

                acisionSDK.contacts.addToGroup(group, availableUsers, {
                    onSuccess: function(){
                        ConnectionService.sendMessageToGroups([group], message);
                    },
                    onError: function(code, message){
                        console.log('Group creation failed');
                    }
                });

                function isAvailable(user){
                    return user.status == STATUS_AVAILABLE;
                }

                function toAddress(user){
                    return user.address;
                }
            };

            ConnectionService.callUser = function(userAddress){
                if(session){
                    session.close('normal');
                    return session = undefined;
                }
                session = acisionSDK.webrtc.connect(userAddress);
                var element = angular.element(document.querySelector('#remote-audio'))[0];
                session.remoteAudioElement = element;
            };

            return ConnectionService;
        }]);