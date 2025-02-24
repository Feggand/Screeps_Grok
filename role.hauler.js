var resourceManager = require('resourceManager');
var logger = require('logger');

module.exports.run = function (creep) {
    if (creep.memory.task || creep.memory.targetId) {
        logger.info(creep.name + ': Clearing worker-specific memory (task, targetId)');
        delete creep.memory.task;
        delete creep.memory.targetId;
    }

    if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }

    let homeRoom = creep.memory.homeRoom || Memory.rooms[creep.room.name].homeRoom || Object.keys(Game.rooms).find(function(r) { return Memory.rooms[r].isMyRoom; });
    let homeRoomMemory = Memory.rooms[homeRoom];
    let targetRoom = homeRoomMemory && homeRoomMemory.remoteRooms && homeRoomMemory.remoteRooms.length > 0 ? homeRoomMemory.remoteRooms[0] : null;

    if (creep.memory.working) {
        let primaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: function(s) {
                return (
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                );
            }
        });
        if (primaryTarget) {
            if (creep.transfer(primaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(primaryTarget, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
            }
            return;
        }

        let secondaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: function(s) {
                return (
                    s.structureType === STRUCTURE_TOWER &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                );
            }
        });
        if (secondaryTarget) {
            if (creep.transfer(secondaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(secondaryTarget, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
            }
            return;
        }

        let storage = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0; }
        })[0];
        if (storage) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
            }
            return;
        }

        resourceManager.collectEnergy(creep, homeRoom, targetRoom);
    } else {
        resourceManager.collectEnergy(creep, homeRoom, targetRoom);
    }
};