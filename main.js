var creepManager = require('creepManager');
var roomManager = require('roomManager');

module.exports.loop = function () {
    if (!Memory.rooms) Memory.rooms = {};

    if (Game.time % 100 === 0) {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            roomManager.manageRoom(room);
        }
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