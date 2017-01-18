const {mapObject} = require('./utils/utils');
const Notifications = require('react-notification-system-redux');

let chatRooms = [];     //all the chat rooms
let fourRooms = [];     //all the four player game rooms
let fourTeamRooms = []; //all the four player team game rooms
let twoRooms = [];      //all the two player game rooms
let clients = {};

function chatRoomExists(name) {
    let foundMatch = false;
    for(let i = 0; i < chatRooms.length; i++) {
        mapObject(chatRooms[i], (key, val) => {
            if(val.name.toUpperCase() === name.toUpperCase()) {
                foundMatch = true;
            }
        });
    }
    return foundMatch;
}

function findChatRoomByName(name) {
    let obj = {};
    for(let i = 0; i < chatRooms.length; i++) {
        mapObject(chatRooms[i], (key, val) => {
            if(val.name.toUpperCase() === name.toUpperCase()) {
                obj = val;
            }
        });
    }

    return obj;
}

function fourRoomExists(name) {

}

function getMemberBySocketId(socketId) {
    return clients[socketId];
}

module.exports = function(io) {

    function getAllRoomMembers(room) {
        var roomMembers = [];
        mapObject(io.sockets.adapter.rooms[room].sockets, (key, val) => {
            roomMembers.push(clients[key].user);
        });
        return roomMembers;
    }

    io.on('connection', (socket) => {
        console.log(chatRooms);
        // console.log('connected clients: ', JSON.stringify(clients, null, 2));
        socket.on('action', (action) => {
            let chatObjName, chatObj, chatUser, roomName = null;
            switch(action.type) {
                case 'server/connected-user':
                    let foundDuplicate = false;
                    mapObject(clients, (key, val) => {
                        if(val.user._id === action.payload.user._id) {
                            //same user
                            foundDuplicate = true;
                        }
                    });
                    if(foundDuplicate) {
                        return socket.emit('action', {
                            type: 'duplicate-login'
                        });
                    } else {
                        //set the clients obj with the user's info
                        clients[socket.id] = action.payload;

                        //maintain a list of all the rooms this user is in.
                        clients[socket.id].rooms = [];
                        socket.username = action.payload.user.username;

                        socket.emit('action', {
                            type: 'connected'
                        })
                    }

                    break;
                case 'server/new-message':
                    io.to(action.payload.thread).emit('action', {
                        type: 'receive-message',
                        payload: action.payload
                    });
                    break;
                case 'server/leave-room':
                    roomName = action.payload;
                    chatUser = clients[socket.id];
                    clients[socket.id].rooms = clients[socket.id].rooms.map((room) => {
                        if(room !== roomName) {
                            return room;
                        }
                    });

                    socket.leave(roomName);

                    socket.emit('action', {
                        type: 'left-room',
                        payload: roomName
                    });

                    //Tell everyone in the room that a new user has connnected
                    io.to(roomName).emit('action', {
                        type: 'user-room-left',
                        payload: {
                            name: roomName,
                            user: chatUser
                        }
                    });

                    break;
                case 'server/join-room':
                    chatObjName = [Object.keys(action.payload)[0]];

                    //Deep copy the Chat object
                    chatObj = JSON.parse(JSON.stringify(action.payload[chatObjName]));

                    if(!chatRoomExists(chatObj.name)) {
                        chatRooms.push(action.payload);
                        io.emit('action', {
                            type: 'all-chatrooms',
                            payload: chatRooms
                        });
                    }

                    //connect this user to this react-notification-system-redux
                    socket.join(chatObj.name);
                    clients[socket.id].rooms.push(chatObj.name);
                    //get the list of all members
                    chatObj.users = getAllRoomMembers(chatObj.name);

                    socket.emit('action', {
                        type: 'joined-room',
                        payload: chatObj
                    });

                    //Tell everyone in the room that a new user has connnected
                    io.to(chatObj.name).emit('action', {
                        type: 'user-room-joined',
                        payload: chatObj
                    });

                    break;
                case 'server/new-room':
                    chatObjName = [Object.keys(action.payload)[0]];
                    chatObj = JSON.parse(JSON.stringify(action.payload[chatObjName]));
                    delete action.payload[chatObjName].user;
                    if(!chatRoomExists(chatObj.name) && chatObj.name !== "Chat Rooms") {
                        socket.join(chatObj.name);
                        chatRooms.push(action.payload);
                        clients[socket.id].rooms.push(chatObj.name);
                        io.emit('action', {
                            type: 'all-chatrooms',
                            payload: chatRooms
                        });
                        chatObj.users = getAllRoomMembers(chatObj.name);
                        socket.emit('action', {
                            type: 'joined-room',
                            payload: chatObj
                        });
                    } else {
                        const notificationOpts = {
                            // uid: 'once-please', // you can specify your own uid if required
                            title: 'oops...',
                            message: `Chat room with name '${chatObj.name}' already exists`,
                            position: 'tc',
                            autoDismiss: 2
                        };

                        io.emit('action', Notifications.error(notificationOpts));
                    }
                    break;
                case 'server/get-chatrooms':
                    io.emit('action', {
                        type: 'all-chatrooms',
                        payload: chatRooms
                    });
                    break;
            }
        });

        socket.on('disconnect', function() {
            if(clients[socket.id]) {
                const {rooms} = clients[socket.id];
                // console.log(rooms)
                mapObject(rooms, (key, val) => {
                    if(io.sockets.adapter.rooms[val]) {
                        let obj = findChatRoomByName(val);
                        obj.users = getAllRoomMembers(val);
                        io.to(val).emit('action', {
                            type: 'user-room-joined',
                            payload: obj
                        })
                    } else {
                        //there are no users in this room
                        delete chatRooms[val];
                    }
                })

            }
            delete clients[socket.id];
        })
    });
};
