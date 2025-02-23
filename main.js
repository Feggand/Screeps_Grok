var creepManager = require('creepManager');
var roomManager = require('roomManager');
var memoryManager = require('memoryManager');

console.log('roomManager loaded:', roomManager);

module.exports.loop = function () {
    console.log('Main loop running');
    memoryManager.initializeMemory();
    console.log('Memory initialized');
    console.log('Memory.rooms[W6N1]:', JSON.stringify(Memory.rooms['W6N1']));

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        console.log(`Room: ${roomName}, isMyRoom: ${Memory.rooms[roomName].isMyRoom}`);
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