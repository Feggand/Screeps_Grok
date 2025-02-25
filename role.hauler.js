var resourceManager = require('resourceManager');
var logger = require('logger');

module.exports.run = function (creep) {
    // Alte Aufgaben zurücksetzen
    if (creep.memory.task || creep.memory.targetId) {
        logger.info(creep.name + ': Alte Aufgaben zurückgesetzt.');
        delete creep.memory.task;
        delete creep.memory.targetId;
    }

    // Arbeitsstatus aktualisieren
    if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }

    let homeRoom = creep.memory.homeRoom || Memory.rooms[creep.room.name].homeRoom || Object.keys(Game.rooms).find(r => Memory.rooms[r].isMyRoom);
    let homeRoomMemory = Memory.rooms[homeRoom];
    let targetRoom = homeRoomMemory && homeRoomMemory.remoteRooms && homeRoomMemory.remoteRooms.length > 0 ? homeRoomMemory.remoteRooms[0] : null;

    if (creep.memory.working) {
        // Notfall: Türme mit wenig Energie
        let criticalTowers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER && s.store[RESOURCE_ENERGY] < s.store.getCapacity(RESOURCE_ENERGY) * 0.5
        });
        if (criticalTowers.length > 0) {
            let target = creep.pos.findClosestByPath(criticalTowers);
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
                    logger.info(creep.name + ': Kritisch! Bewegt sich zu Turm ' + target.id + ' mit wenig Energie.');
                } else {
                    logger.info(creep.name + ': Liefert Energie an Turm ' + target.id);
                }
                return;
            }
        }

        // Priorität 1: Spawns und Extensions
        let primaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (primaryTarget) {
            if (creep.transfer(primaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(primaryTarget, { visualizePathStyle: { stroke: '#ffffff' } });
                logger.info(creep.name + ': Bewegt sich zu ' + primaryTarget.structureType + ' ' + primaryTarget.id);
            } else {
                logger.info(creep.name + ': Liefert Energie an ' + primaryTarget.structureType + ' ' + primaryTarget.id);
            }
            return;
        }

        // Priorität 2: Türme (nicht kritisch)
        let secondaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (secondaryTarget) {
            if (creep.transfer(secondaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(secondaryTarget, { visualizePathStyle: { stroke: '#ffffff' } });
                logger.info(creep.name + ': Bewegt sich zu Turm ' + secondaryTarget.id);
            } else {
                logger.info(creep.name + ': Liefert Energie an Turm ' + secondaryTarget.id);
            }
            return;
        }

        // Priorität 3: Storage
        let storage = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
        if (storage) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
                logger.info(creep.name + ': Bewegt sich zu Storage ' + storage.id);
            } else {
                logger.info(creep.name + ': Liefert Energie an Storage ' + storage.id);
            }
            return;
        }

        // Fallback: Zum Spawn bewegen
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn ' + spawn.id);
        }
    } else {
        // Energie sammeln
        resourceManager.collectEnergy(creep, homeRoom, targetRoom);
    }
};