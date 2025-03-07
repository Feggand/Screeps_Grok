// role.reserver.js
// Logik für Creeps, die Remote-Räume reservieren
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren

var logger = require('logger');

var roleReserver = {
    run: function (creep, cachedData) {
        logger.info(`${creep.name}: Starting run function`);

        let targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            logger.warn(`${creep.name}: No targetRoom assigned, skipping`);
            return;
        }

        // Wenn der Creep nicht im Zielraum ist, bewege ihn dorthin
        if (creep.room.name !== targetRoom) {
            logger.info(`${creep.name}: Moving to target room ${targetRoom}`);
            creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        }

        // Überprüfe, ob der Raum sichtbar ist
        const room = Game.rooms[targetRoom];
        if (!room) {
            logger.warn(`${creep.name}: Target room ${targetRoom} not visible, skipping`);
            return;
        }

        // Nutze cachedData, um den Controller zu finden
        let controller = null;
        if (cachedData && cachedData.controller) {
            controller = cachedData.controller;
        } else {
            controller = room.controller;
            if (cachedData) cachedData.controller = controller; // Cache den Controller
        }

        if (!controller) {
            logger.warn(`${creep.name}: No controller in ${targetRoom}, idling`);
            return;
        }

        // Reserviere den Controller oder bewege dich dorthin
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