var creepManager = require('creepManager');
var roomManager = require('roomManager');
var memoryManager = require('memoryManager');

console.log('roomManager loaded:', roomManager);

module.exports.loop = function () {
    console.log('Main loop running');
    memoryManager.initializeMemory();
    console.log('Memory initialized');

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        let isMyRoom = Memory.rooms[roomName] && Memory.rooms[roomName].isMyRoom ? Memory.rooms[roomName].isMyRoom : false;
        console.log(`Room: ${roomName}, isMyRoom: ${isMyRoom}`);
        if (roomManager && typeof roomManager.manageRoom === 'function') {
            console.log(`Calling manageRoom for ${roomName}`);
            roomManager.manageRoom(room);
        } else {
            console.log(`Error: roomManager not defined or manageRoom not a function`);
        }
        console.log(`Room ${roomName} processed`);
    }

    creepManager.runCreeps();
    console.log('Creeps run');
};