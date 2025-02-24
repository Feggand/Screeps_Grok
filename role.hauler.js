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
        // Priorität 1: Spawn/Extensions füllen
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
                logger.info(creep.name + ': Moving to transfer energy to ' + primaryTarget.structureType + ' at ' + primaryTarget.pos);
            } else {
                logger.info(creep.name + ': Transferring energy to ' + primaryTarget.structureType + ' at ' + primaryTarget.pos);
            }
            return;
        }

        // Priorität 2: Tower
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
                logger.info(creep.name + ': Moving to transfer energy to tower at ' + secondaryTarget.pos);
            } else {
                logger.info(creep.name + ': Transferring energy to tower at ' + secondaryTarget.pos);
            }
            return;
        }

        // Priorität 3: Storage, wenn Spawn/Extensions voll
        let storage = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0; }
        })[0];
        if (storage) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                logger.info(creep.name + ': Moving to transfer energy to storage at ' + storage.pos);
            } else {
                logger.info(creep.name + ': Transferring energy to storage at ' + storage.pos);
            }
            return;
        }

        // Fallback: Zum Spawn bewegen
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            logger.info(creep.name + ': No tasks, moving to spawn at ' + spawn.pos);
        }
    } else {
        // Prüfen, ob Container genug Energie haben
        let containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 50; } // Mindestens 50 Energie
        });
        if (containers.length) {
            let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
            if (!targetContainer || !targetContainer.store || targetContainer.store[RESOURCE_ENERGY] === 0) {
                targetContainer = _.max(containers, function(c) { return c.store[RESOURCE_ENERGY]; });
                creep.memory.containerId = targetContainer.id;
                logger.info(creep.name + ': Assigned to container ' + targetContainer.id + ' at ' + targetContainer.pos);
            }
            if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                logger.info(creep.name + ': Moving to container ' + targetContainer.id + ' at ' + targetContainer.pos);
            } else {
                logger.info(creep.name + ': Withdrawing energy from container ' + targetContainer.id);
            }
            return;
        }

        // Wenn Container leer, aber Storage voll, Energie aus Storage nehmen
        let storage = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 50; }
        })[0];
        if (storage) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                logger.info(creep.name + ': Moving to storage at ' + storage.pos + ' for energy');
            } else {
                logger.info(creep.name + ': Withdrawing energy from storage at ' + storage.pos);
            }
            return;
        }

        // Fallback: Zum Spawn bewegen, wenn nichts verfügbar
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            logger.info(creep.name + ': No resources, moving to spawn');
        }
    }
};