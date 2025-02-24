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
        logger.info(creep.name + ': Switching to collecting energy (no energy left)');
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        logger.info(creep.name + ': Switching to working (full energy)');
    } else if (creep.store[RESOURCE_ENERGY] > 0) {
        creep.memory.working = true;
        logger.info(creep.name + ': Switching to working (partial energy)');
    }

    let homeRoom = creep.memory.homeRoom || Memory.rooms[creep.room.name].homeRoom || Object.keys(Game.rooms).find(function(r) { return Memory.rooms[r].isMyRoom; });
    let homeRoomMemory = Memory.rooms[homeRoom];
    let targetRoom = homeRoomMemory && homeRoomMemory.remoteRooms && homeRoomMemory.remoteRooms.length > 0 ? homeRoomMemory.remoteRooms[0] : null;

    if (creep.memory.working) {
        let constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (constructionSite) {
            if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSite, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                logger.info(creep.name + ': Moving to build ' + constructionSite.structureType + ' at ' + constructionSite.pos);
            } else {
                logger.info(creep.name + ': Building ' + constructionSite.structureType + ' at ' + constructionSite.pos);
            }
            return;
        } else {
            logger.info(creep.name + ': No construction sites, checking subRole tasks');
        }

        if (creep.memory.subRole === 'upgrader') {
            if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                logger.info(creep.name + ': Moving to controller for upgrade');
            } else if (creep.room.controller) {
                logger.info(creep.name + ': Upgrading controller');
            }
            return;
        } else if (creep.memory.subRole === 'repairer') {
            let damagedStructure = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: function(s) {
                    return (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) && s.hits < s.hitsMax;
                }
            });
            if (damagedStructure) {
                if (creep.repair(damagedStructure) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(damagedStructure, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                    logger.info(creep.name + ': Moving to repair ' + damagedStructure.structureType + ' at ' + damagedStructure.pos);
                } else {
                    logger.info(creep.name + ': Repairing ' + damagedStructure.structureType + ' at ' + damagedStructure.pos);
                }
                return;
            }
        } else if (creep.memory.subRole === 'wallRepairer') {
            let damagedWalls = creep.room.find(FIND_STRUCTURES, {
                filter: function(s) {
                    return (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax;
                }
            });
            if (damagedWalls.length) {
                let targetWall = _.min(damagedWalls, 'hits');
                if (creep.repair(targetWall) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetWall, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                    logger.info(creep.name + ': Moving to repair ' + targetWall.structureType + ' at ' + targetWall.pos);
                } else {
                    logger.info(creep.name + ': Repairing ' + targetWall.structureType + ' at ' + targetWall.pos);
                }
                return;
            }
        } else { // Flexible Worker
            let damagedNonWalls = creep.room.find(FIND_STRUCTURES, {
                filter: function(s) {
                    return (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) && s.hits < s.hitsMax;
                }
            });
            let damagedWalls = creep.room.find(FIND_STRUCTURES, {
                filter: function(s) {
                    return (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax;
                }
            });
            logger.info(creep.name + ': Flexible worker checking: ' + damagedNonWalls.length + ' non-walls, ' + damagedWalls.length + ' walls damaged');
            if (damagedNonWalls.length > 5) { // Unterstützung für repairer
                let targetStructure = creep.pos.findClosestByPath(damagedNonWalls);
                if (creep.repair(targetStructure) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetStructure, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                    logger.info(creep.name + ': Moving to repair ' + targetStructure.structureType + ' at ' + targetStructure.pos);
                } else {
                    logger.info(creep.name + ': Repairing ' + targetStructure.structureType + ' at ' + targetStructure.pos);
                }
                return;
            } else if (damagedWalls.length > 10) { // Unterstützung für wallRepairer
                let targetWall = _.min(damagedWalls, 'hits');
                if (creep.repair(targetWall) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetWall, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                    logger.info(creep.name + ': Moving to repair ' + targetWall.structureType + ' at ' + targetWall.pos);
                } else {
                    logger.info(creep.name + ': Repairing ' + targetWall.structureType + ' at ' + targetWall.pos);
                }
                return;
            } else { // Standard: Controller upgraden
                if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                    logger.info(creep.name + ': Moving to controller for upgrade');
                } else if (creep.room.controller) {
                    logger.info(creep.name + ': Upgrading controller');
                }
                return;
            }
        }

        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            logger.info(creep.name + ': No tasks, moving to spawn at ' + spawn.pos);
        }
    } else {
        logger.info(creep.name + ': Collecting energy');
        resourceManager.collectEnergy(creep, homeRoom, targetRoom);
    }
};