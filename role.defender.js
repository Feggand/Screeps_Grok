var logger = require('logger');

var roleDefender = {
    run: function(creep, cachedData) {
        // Überprüfe Feinde im aktuellen Raum
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            const target = creep.pos.findClosestByPath(hostiles);
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            logger.info(`${creep.name} greift ${target.name} in ${creep.room.name} an`);
            return;
        }

        // Überprüfe Nebenräume nur, wenn kein targetRoom gesetzt ist
        if (!creep.memory.targetRoom) {
            const roomsToDefend = Memory.rooms[creep.memory.homeRoom].remoteRooms || [];
            for (let roomName of roomsToDefend) {
                const room = Game.rooms[roomName];
                if (room && room.find(FIND_HOSTILE_CREEPS).length > 0) {
                    creep.memory.targetRoom = roomName;
                    logger.info(`${creep.name} hat ${roomName} als Zielraum festgelegt`);
                    break;
                }
            }
        }

        // Bewege dich zum targetRoom, wenn gesetzt und Feinde vorhanden
        if (creep.memory.targetRoom) {
            const targetRoom = Game.rooms[creep.memory.targetRoom];
            if (targetRoom && targetRoom.find(FIND_HOSTILE_CREEPS).length > 0) {
                if (creep.room.name !== creep.memory.targetRoom) {
                    creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom), { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(`${creep.name} bewegt sich nach ${creep.memory.targetRoom}`);
                    return;
                }
            } else {
                delete creep.memory.targetRoom;
                logger.info(`${creep.name} hat targetRoom gelöscht, da keine Feinde mehr in ${creep.memory.targetRoom} sind`);
            }
        }

        // Wenn keine Feinde und kein targetRoom, gehe zur SafeSpot
        const safeFlag = Game.flags['SafeSpot'];
        if (safeFlag) {
            // Erzwinge Bewegung zur SafeSpot, ignoriere kleine Unterbrechungen
            if (creep.pos.getRangeTo(safeFlag) > 1) {
                creep.moveTo(safeFlag, { 
                    visualizePathStyle: { stroke: '#00ff00' },
                    reusePath: 10, // Wiederverwende Pfad für Stabilität
                    maxRooms: 1    // Bleibe im aktuellen Raum
                });
                logger.info(`${creep.name} bewegt sich zur sicheren Position 'SafeSpot'`);
            } else {
                logger.info(`${creep.name} ist bereits an der sicheren Position 'SafeSpot'`);
            }
        } else {
            logger.warn(`Keine 'SafeSpot'-Flagge für ${creep.name} gefunden`);
        }
    }
};

module.exports = roleDefender;