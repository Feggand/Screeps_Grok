// role.harvester.js
var logger = require('logger');
var taskManager = require('taskManager');

module.exports.run = function(creep) {
    // Prüfe, ob eine Aufgabe existiert und gültig ist
    let taskValid = false;
    let target = Game.getObjectById(creep.memory.targetId);
    if (creep.memory.task && target) {
        if (creep.memory.task === 'harvest') {
            let container = Game.getObjectById(creep.memory.containerId);
            taskValid = target.energy > 0 && container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        } else if (creep.memory.task === 'constructContainer') {
            taskValid = !target.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
        } else if (creep.memory.task === 'repair') {
            taskValid = target.hits < target.hitsMax;
        }
    } else if (!target && creep.memory.task) {
        logger.info(creep.name + ': Ziel ungültig (task: ' + creep.memory.task + ', targetId: ' + creep.memory.targetId + '), Aufgabe zurückgesetzt');
        delete creep.memory.task;
        delete creep.memory.targetId;
        delete creep.memory.containerId;
    }

    // Wenn keine gültige Aufgabe, neue zuweisen
    if (!taskValid || !creep.memory.task) {
        let tasks = taskManager.getHarvesterTasks(creep.room);
        taskManager.assignTask(creep, tasks);
    }

    // Aufgabe ausführen
    if (creep.memory.task === 'harvest') {
        let source = Game.getObjectById(creep.memory.targetId);
        let container = Game.getObjectById(creep.memory.containerId);
        if (!source || !container) {
            logger.warn(creep.name + ': Ungültige Quelle oder Container, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
            delete creep.memory.containerId;
            return;
        }

        if (creep.store.getFreeCapacity() > 0) {
            if (creep.pos.isEqualTo(container.pos)) {
                let result = creep.harvest(source);
                if (result === OK) {
                    logger.info(creep.name + ': Harvesting source ' + source.id);
                } else {
                    logger.warn(creep.name + ': Harvesting failed: ' + result);
                }
            } else {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Moving to container at ' + container.pos);
            }
        } else {
            let result = creep.transfer(container, RESOURCE_ENERGY);
            if (result === OK) {
                logger.info(creep.name + ': Transferring to container ' + container.id);
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } });
            } else {
                logger.warn(creep.name + ': Transfer failed: ' + result);
            }
        }
    } else if (creep.memory.task === 'constructContainer') {
        let source = Game.getObjectById(creep.memory.targetId);
        if (!source) {
            logger.warn(creep.name + ': Ungültige Quelle, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
            return;
        }

        let site = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
        if (!site && creep.store[RESOURCE_ENERGY] > 0) {
            let result = creep.room.createConstructionSite(source.pos.x, source.pos.y + 1, STRUCTURE_CONTAINER);
            if (result === OK) {
                logger.info(creep.name + ': Creating container construction site near source ' + source.id);
            } else {
                logger.warn(creep.name + ': Failed to create container site: ' + result);
            }
        } else if (site) {
            if (creep.build(site) === ERR_NOT_IN_RANGE) {
                creep.moveTo(site, { visualizePathStyle: { stroke: '#0000ff' } });
                logger.info(creep.name + ': Moving to build container at ' + site.pos);
            } else {
                logger.info(creep.name + ': Building container at ' + site.pos);
            }
        } else {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Moving to source ' + source.id + ' to gather energy');
            } else {
                logger.info(creep.name + ': Harvesting source ' + source.id + ' for construction');
            }
        }
    } else if (creep.memory.task === 'repair') {
        let target = Game.getObjectById(creep.memory.targetId);
        if (!target) {
            logger.warn(creep.name + ': Ungültiges Reparaturziel, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
            return;
        }

        if (creep.store[RESOURCE_ENERGY] > 0) {
            if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                logger.info(creep.name + ': Moving to repair ' + target.structureType + ' at ' + target.pos);
            } else {
                logger.info(creep.name + ': Repairing ' + target.structureType + ' at ' + target.pos);
            }
        } else {
            let source = creep.pos.findClosestByPath(FIND_SOURCES);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Moving to source ' + source.id + ' for energy');
            }
        }
    } else if (creep.memory.task === 'idle') {
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(creep.name + ': Idle, moving to spawn ' + spawn.id);
        }
    }
};