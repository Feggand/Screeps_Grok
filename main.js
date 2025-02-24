var creepManager = require('creepManager');
var roomManager = require('roomManager');
var memoryManager = require('memoryManager');

console.log('roomManager loaded:', roomManager);

module.exports.loop = function () {
    console.log('Main loop running');
    memoryManager.initializeMemory();
    console.log('Memory initialized');

    // Bereinigung von Memory.creeps
    if (Game.time % 100 === 0) { // Nur alle 100 Ticks, um Performance zu sparen
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                console.log(`Removing dead creep ${name} from Memory`);
                delete Memory.creeps[name];
            } else if (Memory.creeps[name] === undefined || Object.keys(Memory.creeps[name]).length === 0) {
                console.log(`Removing invalid creep ${name} (undefined or empty) from Memory`);
                delete Memory.creeps[name];
            }
        }
    }

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        let isMyRoom = Memory.rooms[roomName] && Memory.rooms[roomName].isMyRoom ? Memory.rooms[roomName].isMyRoom : 'undefined';
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