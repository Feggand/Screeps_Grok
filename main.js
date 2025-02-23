var creepManager = require('creepManager');
var roomManager = require('roomManager');
var memoryManager = require('memoryManager');

module.exports.loop = function () {
    console.log('Main loop running');
    memoryManager.initializeMemory();
    console.log('Memory initialized');

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        console.log(`Room: ${roomName}`);
        // Kommentiere den problematischen Aufruf vorerst aus
        // roomManager.manageRoom(room);
        console.log('Room processed');
    }

    creepManager.runCreeps();
    console.log('Creeps run');
};