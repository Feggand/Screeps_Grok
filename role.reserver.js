// role.reserver.js
// Logik für Creeps, die Remote-Räume reservieren

var logger = require('logger');

var roleReserver = {
    run: function(creep) {
        logger.info(`${creep.name}: Starting run function`);

        let targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            logger.warn(`${creep.name}: No targetRoom assigned, skipping`);
            return;
        }

        if (creep.room.name !== targetRoom) {
            logger.info(`${creep.name}: Moving to target room ${targetRoom}`);
            creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        }

        const room = Game.rooms[targetRoom];
        if (!room) {
            logger.warn(`${creep.name}: Target room ${targetRoom} not visible, skipping`);
            return;
        }

        const controller = room.controller;
        if (!controller) {
            logger.warn(`${creep.name}: No controller in ${targetRoom}, idling`);
            return;
        }

        if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
            logger.info(`${creep.name}: Moving to controller in ${targetRoom}`);
            creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffaa00' } });
        } else if (creep.reserveController(controller) === OK) {
            logger.info(`${creep.name}: Reserving controller in ${targetRoom}`);
        } else {
            logger.warn(`${creep.name}: Reserving controller in ${targetRoom} failed with code ${creep.reserveController(controller)}`);
        }
    }
};

module.exports = roleReserver;