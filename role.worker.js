// role.worker.js
var resourceManager = require('resourceManager');
var taskManager = require('taskManager');
var logger = require('logger');

module.exports.run = function(creep) {
    // Arbeitsstatus basierend auf Energie aktualisieren
    if (creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.memory.working) {
            creep.memory.working = false;
            logger.info(creep.name + ': Wechselt zu Energie sammeln (keine Energie).');
            if (creep.memory.task !== 'idle') {
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        }
    } else if (creep.store.getFreeCapacity() === 0) {
        if (!creep.memory.working) {
            creep.memory.working = true;
            logger.info(creep.name + ': Wechselt zu Arbeiten (voll mit Energie).');
        }
    } else if (creep.store[RESOURCE_ENERGY] > 0) {
        creep.memory.working = true;
        logger.info(creep.name + ': Wechselt zu Arbeiten (Teilenergie).');
    }

    let homeRoom = creep.memory.homeRoom || Memory.rooms[creep.room.name].homeRoom || Object.keys(Game.rooms).find(r => Memory.rooms[r].isMyRoom);

    if (creep.memory.working) {
        // Prüfe, ob eine gespeicherte Aufgabe existiert und gültig ist
        let taskValid = false;
        let target = Game.getObjectById(creep.memory.targetId);
        if (creep.memory.task && target) {
            if (creep.memory.task === 'repair') {
                taskValid = target.hits < target.hitsMax;
            } else if (creep.memory.task === 'construct') {
                taskValid = true;
            } else if (creep.memory.task === 'upgrade') {
                taskValid = true;
            }
            logger.info(creep.name + ': Aufgabe ' + creep.memory.task + ' validiert, gültig: ' + taskValid);
        } else {
            logger.info(creep.name + ': Keine gültige gespeicherte Aufgabe oder Ziel nicht gefunden (task: ' + creep.memory.task + ', targetId: ' + creep.memory.targetId + ')');
        }

        // Wenn keine gültige Aufgabe existiert, neue berechnen
        if (!taskValid || !creep.memory.task) {
            let tasks = taskManager.getWorkerTasks(creep.room);
            taskManager.assignTask(creep, tasks);
        }

        // Führe die zugewiesene Aufgabe aus
        if (creep.memory.task === 'repair') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target && target.hits < target.hitsMax) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(creep.name + ': Bewegt sich zur Reparatur von ' + target.structureType);
                } else {
                    logger.info(creep.name + ': Repariert ' + target.structureType);
                }
            } else {
                logger.info(creep.name + ': Reparatur-Ziel ungültig oder vollständig repariert');
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        } else if (creep.memory.task === 'construct') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target) {
                let result = creep.build(target);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(creep.name + ': Bewegt sich zur Baustelle ' + target.id + ' (' + target.structureType + ')');
                } else if (result === OK) {
                    logger.info(creep.name + ': Baut ' + target.structureType + ' (' + target.id + ')');
                } else {
                    logger.error(creep.name + ': Fehler beim Bauen von ' + target.structureType + ' (' + target.id + '): ' + result);
                }
            } else {
                logger.info(creep.name + ': Baustelle ' + creep.memory.targetId + ' nicht gefunden, Aufgabe zurückgesetzt');
                delete creep.memory.task;
                delete creep.memory.targetId;
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
            } else {
                logger.info(creep.name + ': Controller nicht gefunden, Aufgabe zurückgesetzt');
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        } else if (creep.memory.task === 'idle') {
            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn');
            }
        }
    } else {
        // Wähle die nächstgelegene Energiequelle: Receiver-Link, Controller-Container oder Storage
        let controllerContainer = creep.room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        })[0];
        let storage = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
        })[0];
        let receiverLink = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK && s.pos.getRangeTo(controllerContainer) <= 2 && s.store[RESOURCE_ENERGY] > 0
        })[0];

        let energySource = null;
        if (receiverLink) {
            // Receiver-Link hat höchste Priorität
            energySource = receiverLink;
        } else if (controllerContainer && storage) {
            let distToController = creep.pos.getRangeTo(controllerContainer);
            let distToStorage = creep.pos.getRangeTo(storage);
            energySource = (distToController < distToStorage) ? controllerContainer : storage;
        } else if (controllerContainer) {
            energySource = controllerContainer;
        } else if (storage) {
            energySource = storage;
        }

        if (energySource) {
            if (creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(energySource, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Bewegt sich zu ' + energySource.structureType + ' ' + energySource.id + ' zum Sammeln');
            } else {
                logger.info(creep.name + ': Sammelt Energie aus ' + energySource.structureType + ' ' + energySource.id);
            }
        } else {
            // Wenn keine direkte Quelle verfügbar, sammle via resourceManager
            logger.info(creep.name + ': Keine direkte Energiequelle verfügbar, sammelt via resourceManager');
            resourceManager.collectEnergy(creep, homeRoom);
            // Nach dem Energiesammeln Aufgabe neu prüfen
            if (creep.store[RESOURCE_ENERGY] > 0) {
                let tasks = taskManager.getWorkerTasks(creep.room);
                taskManager.assignTask(creep, tasks);
            }
        }
    }
};