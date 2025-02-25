var resourceManager = require('resourceManager');
var taskManager = require('taskManager');
var logger = require('logger');

module.exports.run = function (creep) {
    // Arbeitsstatus basierend auf Energie aktualisieren
    if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        logger.info(creep.name + ': Wechselt zu Energie sammeln (keine Energie).');
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        logger.info(creep.name + ': Wechselt zu Arbeiten (voll mit Energie).');
    } else if (creep.store[RESOURCE_ENERGY] > 0) {
        creep.memory.working = true;
        logger.info(creep.name + ': Wechselt zu Arbeiten (Teilenergie).');
    }

    let homeRoom = creep.memory.homeRoom || Memory.rooms[creep.room.name].homeRoom || Object.keys(Game.rooms).find(r => Memory.rooms[r].isMyRoom);

    if (creep.memory.working) {
        // Hole Aufgabenliste
        let tasks = taskManager.getTasks(creep.room);
        // Weise die dringendste Aufgabe zu
        taskManager.assignTask(creep, tasks);

        // Führe die zugewiesene Aufgabe aus
        if (creep.memory.task === 'repair') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(creep.name + ': Bewegt sich zur Reparatur von ' + target.structureType);
                } else {
                    logger.info(creep.name + ': Repariert ' + target.structureType);
                }
            }
        } else if (creep.memory.task === 'upgrade') {
            let controller = Game.getObjectById(creep.memory.targetId);
            if (controller) {
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(creep.name + ': Bewegt sich zum Controller zum Upgraden');
                } else {
                    logger.info(creep.name + ': Upgraded Controller');
                }
            }
        } else if (creep.memory.task === 'construct') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target) {
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(creep.name + ': Bewegt sich zur Baustelle ' + target.id);
                } else {
                    logger.info(creep.name + ': Baut ' + target.structureType);
                }
            } else {
                // Baustelle existiert nicht mehr, Aufgabe zurücksetzen
                delete creep.memory.task;
                delete creep.memory.targetId;
                logger.info(creep.name + ': Baustelle abgeschlossen oder nicht gefunden, Aufgabe zurückgesetzt');
            }
        } else if (creep.memory.task === 'idle') {
            // Fallback: Zum Spawn bewegen
            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn');
            }
        }
    } else {
        logger.info(creep.name + ': Sammelt Energie');
        resourceManager.collectEnergy(creep, homeRoom);
    }
};