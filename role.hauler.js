// role.hauler.js
var taskManager = require('taskManager');
var logger = require('logger');

module.exports.run = function (creep) {
    // Arbeitsstatus aktualisieren
    if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }

    if (creep.memory.working) {
        // Hole Hauler-Aufgaben
        let tasks = taskManager.getHaulerTasks(creep.room);
        // Filtere auf "deliver"-Aufgaben, da der Creep Energie hat
        let deliverTasks = tasks.filter(t => t.type === 'deliver');
        taskManager.assignTask(creep, deliverTasks);

        // Führe die Aufgabe aus
        if (creep.memory.task === 'deliver') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target && target.store) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(creep.name + ': Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Liefern');
                } else {
                    logger.info(creep.name + ': Liefert Energie an ' + target.structureType + ' ' + target.id);
                }
            } else {
                // Ziel ungültig, Aufgabe zurücksetzen
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        } else if (creep.memory.task === 'idle') {
            // Fallback: Zum Spawn bewegen
            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn ' + spawn.id);
            }
        }
    } else {
        // Hole Hauler-Aufgaben
        let tasks = taskManager.getHaulerTasks(creep.room);
        // Filtere auf "collect"-Aufgaben, da der Creep keine Energie hat
        let collectTasks = tasks.filter(t => t.type === 'collect');
        taskManager.assignTask(creep, collectTasks);

        // Führe die Aufgabe aus
        if (creep.memory.task === 'collect') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target) {
                if (target instanceof Resource) {
                    // Dropped resource
                    if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                        logger.info(creep.name + ': Bewegt sich zu dropped resource ' + target.id);
                    } else {
                        logger.info(creep.name + ': Sammelt dropped resource ' + target.id);
                    }
                } else if (target.store) {
                    // Container, Tombstone, Storage
                    if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                        logger.info(creep.name + ': Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Sammeln');
                    } else {
                        logger.info(creep.name + ': Sammelt Energie aus ' + target.structureType + ' ' + target.id);
                    }
                }
            } else {
                // Ziel ungültig, Aufgabe zurücksetzen
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        } else if (creep.memory.task === 'idle') {
            // Fallback: Zum Spawn bewegen
            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn ' + spawn.id);
            }
        }
    }
};