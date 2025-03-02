// role.worker.js
// Logik für Worker-Creeps, die bauen, reparieren und upgraden

var resourceManager = require('resourceManager'); // Importiert Resource-Manager-Modul
var taskManager = require('taskManager'); // Importiert Task-Manager-Modul
var logger = require('logger'); // Importiert Logging-Modul

module.exports.run = function(creep) {
    // Aktualisiert den Arbeitsstatus basierend auf der Energie im Creep
    if (creep.store[RESOURCE_ENERGY] === 0) { // Keine Energie
        if (creep.memory.working) {
            creep.memory.working = false; // Wechselt zu Energiesammeln
            logger.info(creep.name + ': Wechselt zu Energie sammeln (keine Energie).');
            if (creep.memory.task !== 'idle') {
                delete creep.memory.task; // Löscht aktuelle Aufgabe
                delete creep.memory.targetId;
            }
        }
    } else if (creep.store.getFreeCapacity() === 0) { // Voll mit Energie
        if (!creep.memory.working) {
            creep.memory.working = true; // Wechselt zu Arbeiten
            logger.info(creep.name + ': Wechselt zu Arbeiten (voll mit Energie).');
        }
    } else if (creep.store[RESOURCE_ENERGY] > 0) { // Einige Energie vorhanden
        creep.memory.working = true; // Wechselt zu Arbeiten
        logger.info(creep.name + ': Wechselt zu Arbeiten (Teilenergie).');
    }

    // Bestimmt den Heimatraum des Creeps
    let homeRoom = creep.memory.homeRoom || Memory.rooms[creep.room.name].homeRoom || Object.keys(Game.rooms).find(r => Memory.rooms[r].isMyRoom);

    if (creep.memory.working) { // Arbeitsmodus
        // Prüft, ob die gespeicherte Aufgabe noch gültig ist
        let taskValid = false;
        let target = Game.getObjectById(creep.memory.targetId); // Holt Ziel der Aufgabe
        if (creep.memory.task && target) {
            if (creep.memory.task === 'repair') {
                taskValid = target.hits < target.hitsMax; // Reparatur gültig, wenn Ziel beschädigt
            } else if (creep.memory.task === 'construct') {
                taskValid = true; // Baustelle immer gültig, solange sie existiert
            } else if (creep.memory.task === 'upgrade') {
                taskValid = true; // Upgrade immer gültig, solange Controller existiert
            }
            logger.info(creep.name + ': Aufgabe ' + creep.memory.task + ' validiert, gültig: ' + taskValid);
        } else {
            logger.info(creep.name + ': Keine gültige gespeicherte Aufgabe oder Ziel nicht gefunden (task: ' + creep.memory.task + ', targetId: ' + creep.memory.targetId + ')');
        }

        // Wenn die Aufgabe ungültig ist, neue zuweisen
        if (!taskValid || !creep.memory.task) {
            let tasks = taskManager.getWorkerTasks(creep.room); // Holt verfügbare Worker-Aufgaben
            taskManager.assignTask(creep, tasks); // Weist höchstpriorisierte Aufgabe zu
        }

        // Führt die zugewiesene Aufgabe aus
        if (creep.memory.task === 'repair') {
            let target = Game.getObjectById(creep.memory.targetId); // Reparaturziel
            if (target && target.hits < target.hitsMax) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Ziel
                    logger.info(creep.name + ': Bewegt sich zur Reparatur von ' + target.structureType);
                } else {
                    logger.info(creep.name + ': Repariert ' + target.structureType); // Repariert Struktur
                }
            } else {
                logger.info(creep.name + ': Reparatur-Ziel ungültig oder vollständig repariert');
                delete creep.memory.task; // Aufgabe zurücksetzen
                delete creep.memory.targetId;
            }
        } else if (creep.memory.task === 'construct') {
            let target = Game.getObjectById(creep.memory.targetId); // Baustelle
            if (target) {
                let result = creep.build(target); // Baut an der Baustelle
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zur Baustelle
                    logger.info(creep.name + ': Bewegt sich zur Baustelle ' + target.id + ' (' + target.structureType + ')');
                } else if (result === OK) {
                    logger.info(creep.name + ': Baut ' + target.structureType + ' (' + target.id + ')'); // Baut Struktur
                } else {
                    logger.error(creep.name + ': Fehler beim Bauen von ' + target.structureType + ' (' + target.id + '): ' + result); // Fehler protokollieren
                }
            } else {
                logger.info(creep.name + ': Baustelle ' + creep.memory.targetId + ' nicht gefunden, Aufgabe zurückgesetzt');
                delete creep.memory.task; // Aufgabe zurücksetzen
                delete creep.memory.targetId;
            }
        } else if (creep.memory.task === 'upgrade') {
            let controller = Game.getObjectById(creep.memory.targetId); // Controller
            if (controller) {
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Controller
                    logger.info(creep.name + ': Bewegt sich zum Controller zum Upgraden');
                } else {
                    logger.info(creep.name + ': Upgraded Controller'); // Upgradet Controller
                }
            } else {
                logger.info(creep.name + ': Controller nicht gefunden, Aufgabe zurückgesetzt');
                delete creep.memory.task; // Aufgabe zurücksetzen
                delete creep.memory.targetId;
            }
        } else if (creep.memory.task === 'idle') {
            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS); // Nächstgelegener Spawn
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zum Spawn
                logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn');
            }
        }
    } else { // Energiesammelmodus
        // Bevorzugte Energiequellen: Receiver-Link, Controller-Container, Storage
        let controllerContainer = creep.room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        })[0]; // Container nahe Controller
        let storage = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
        })[0]; // Storage mit Energie
        let receiverLink = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK && s.pos.getRangeTo(controllerContainer) <= 2 && s.store[RESOURCE_ENERGY] > 0
        })[0]; // Receiver-Link nahe Controller-Container

        let energySource = null;
        if (receiverLink) {
            energySource = receiverLink; // Höchste Priorität: Receiver-Link
        } else if (controllerContainer && storage) {
            // Wählt nähere Quelle zwischen Controller-Container und Storage
            let distToController = creep.pos.getRangeTo(controllerContainer);
            let distToStorage = creep.pos.getRangeTo(storage);
            energySource = (distToController < distToStorage) ? controllerContainer : storage;
        } else if (controllerContainer) {
            energySource = controllerContainer; // Nur Controller-Container
        } else if (storage) {
            energySource = storage; // Nur Storage
        }

        if (energySource) {
            if (creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(energySource, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zur Quelle
                logger.info(creep.name + ': Bewegt sich zu ' + energySource.structureType + ' ' + energySource.id + ' zum Sammeln');
            } else {
                logger.info(creep.name + ': Sammelt Energie aus ' + energySource.structureType + ' ' + energySource.id); // Entnimmt Energie
            }
        } else {
            // Keine direkte Quelle -> ResourceManager verwenden
            logger.info(creep.name + ': Keine direkte Energiequelle verfügbar, sammelt via resourceManager');
            resourceManager.collectEnergy(creep, homeRoom);
            // Nach Energiesammeln Aufgaben neu prüfen
            if (creep.store[RESOURCE_ENERGY] > 0) {
                let tasks = taskManager.getWorkerTasks(creep.room);
                taskManager.assignTask(creep, tasks); // Weist neue Aufgabe zu
            }
        }
    }
};