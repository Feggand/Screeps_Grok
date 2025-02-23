var creepManager = require('creepManager');
var roomManager = require('roomManager');
var memoryManager = require('memoryManager');

module.exports.loop = function () {
    console.log('Main loop running');
    memoryManager.initializeMemory();

    if (Game.time % 100 === 0) {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        console.log(`Managing room: ${roomName}, isMyRoom: ${Memory.rooms[roomName]?.isMyRoom}`);
        roomManager.manageRoom(room);
    }

    creepManager.runCreeps();

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            let towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
            towers.forEach(tower => require('tower').run(tower));
        }
    }
};