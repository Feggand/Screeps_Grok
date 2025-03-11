// role.worker.js
// Logik für Worker-Creeps, die bauen, reparieren und upgraden
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren
// Energiesammeln läuft nun komplett über den Task-Manager mit stärker gewichteten Entfernungsbasierten Prioritäten

var taskManager = require('taskManager'); // Importiert den Task-Manager für Aufgabenverwaltung
var logger = require('logger'); // Importiert das Logging-Modul für Protokollierung

module.exports.run = function (creep, cachedData) {
    // Bestimmt den Heimatraum des Creeps
    let homeRoom = creep.memory.homeRoom || Memory.rooms[creep.room.name].homeRoom || Object.keys(Game.rooms).find(r => Memory.rooms[r].isMyRoom);

    // Überprüfe, ob der Creep im Heimatraum ist
    if (creep.room.name !== homeRoom) {
        // Lösche alle aktuellen Aufgaben, um Schleifen zu vermeiden
        delete creep.memory.task;
        delete creep.memory.targetId;

        // Bewege dich zurück zum Heimatraum mit optimierten Parametern
        creep.moveTo(new RoomPosition(25, 25, homeRoom), {
            visualizePathStyle: { stroke: '#ffaa00' },
            reusePath: 15,    // Längere Wiederverwendung für Stabilität
            maxRooms: null    // Erlaube Bewegung über Raumgrenzen hinweg
        });
        logger.info(`${creep.name}: Bewegt sich zurück zum Heimatraum ${homeRoom} von ${creep.room.name}`);
        return; // Beende die Ausführung
    }

    // Aktualisiert den Arbeitsstatus basierend auf der Energie im Creep
    if (creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.memory.working) {
            creep.memory.working = false; // Setzt den Arbeitsstatus auf Sammeln
            logger.info(creep.name + ': Wechselt zu Energie sammeln (keine Energie).');
            if (creep.memory.task !== 'idle') {
                delete creep.memory.task; // Löscht die aktuelle Aufgabe
                delete creep.memory.targetId; // Löscht das aktuelle Ziel
            }
        }
    } else if (creep.store.getFreeCapacity() === 0) {
        if (!creep.memory.working) {
            creep.memory.working = true; // Setzt den Arbeitsstatus auf Arbeiten
            logger.info(creep.name + ': Wechselt zu Arbeiten (voll mit Energie).');
        }
    } else if (creep.store[RESOURCE_ENERGY] > 0) {
        creep.memory.working = true; // Arbeitet, wenn teilweise Energie vorhanden
        logger.info(creep.name + ': Wechselt zu Arbeiten (Teilenergie).');
    }

    if (creep.memory.working) {
        // Prüft, ob Hauler vorhanden sind
        let haulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.homeRoom === creep.room.name).length;
        if (haulers === 0) {
            // Notfall: Worker transportiert Energie zu Spawn/Extensions
            let target = null;
            if (cachedData && cachedData.structures) {
                target = creep.pos.findClosestByPath(cachedData.structures, {
                    filter: s => s.structureType === STRUCTURE_SPAWN && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                }) || creep.pos.findClosestByPath(cachedData.structures, {
                    filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            } else {
                target = creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
                    filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                }) || creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
                if (cachedData && !cachedData.structures) cachedData.structures = creep.room.find(FIND_STRUCTURES); // Cache Strukturen
            }

            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Ziel
                    logger.info(creep.name + ': Notfall - Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Liefern');
                } else {
                    logger.info(creep.name + ': Notfall - Liefert Energie an ' + target.structureType + ' ' + target.id);
                }
                return; // Beendet die Ausführung nach Notfallaktion
            }
        }

        // Prüft, ob die gespeicherte Aufgabe noch gültig ist
        let taskValid = false;
        let target = Game.getObjectById(creep.memory.targetId);
        if (creep.memory.task && target) {
            if (creep.memory.task === 'repair') {
                taskValid = target.hits < target.hitsMax; // Reparatur gültig, wenn HP nicht voll
            } else if (creep.memory.task === 'construct') {
                taskValid = true; // Baustellen immer gültig
            } else if (creep.memory.task === 'upgrade') {
                taskValid = true; // Upgrade immer gültig
            }
            logger.info(creep.name + ': Aufgabe ' + creep.memory.task + ' validiert, gültig: ' + taskValid);
        } else {
            logger.info(creep.name + ': Keine gültige gespeicherte Aufgabe oder Ziel nicht gefunden (task: ' + creep.memory.task + ', targetId: ' + creep.memory.targetId + ')');
        }

        // Wenn die Aufgabe ungültig ist oder keine Aufgabe existiert, neue zuweisen
        if (!taskValid || !creep.memory.task) {
            let tasks = taskManager.getWorkerTasks(creep.room, cachedData); // Holt Aufgaben vom Task-Manager
            taskManager.assignTask(creep, tasks); // Weist die beste Aufgabe zu
        }

        // Führt die zugewiesene Aufgabe aus
        if (creep.memory.task === 'repair') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target && target.hits < target.hitsMax) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Ziel
                    logger.info(creep.name + ': Bewegt sich zur Reparatur von ' + target.structureType);
                } else {
                    logger.info(creep.name + ': Repariert ' + target.structureType);
                }
            } else {
                logger.info(creep.name + ': Reparatur-Ziel ungültig oder vollständig repariert');
                delete creep.memory.task; // Löscht Aufgabe
                delete creep.memory.targetId; // Löscht Ziel
            }
        } else if (creep.memory.task === 'construct') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target) {
                let result = creep.build(target);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zur Baustelle
                    logger.info(creep.name + ': Bewegt sich zur Baustelle ' + target.id + ' (' + target.structureType + ')');
                } else if (result === OK) {
                    logger.info(creep.name + ': Baut ' + target.structureType + ' (' + target.id + ')');
                } else {
                    logger.error(creep.name + ': Fehler beim Bauen von ' + target.structureType + ' (' + target.id + '): ' + result);
                }
            } else {
                logger.info(creep.name + ': Baustelle ' + creep.memory.targetId + ' nicht gefunden, Aufgabe zurückgesetzt');
                delete creep.memory.task; // Löscht Aufgabe
                delete creep.memory.targetId; // Löscht Ziel
            }
        } else if (creep.memory.task === 'upgrade') {
            let controller = Game.getObjectById(creep.memory.targetId);
            if (controller) {
                if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Controller
                    logger.info(creep.name + ': Bewegt sich zum Controller zum Upgraden');
                } else {
                    logger.info(creep.name + ': Upgraded Controller');
                }
            } else {
                logger.info(creep.name + ': Controller nicht gefunden, Aufgabe zurückgesetzt');
                delete creep.memory.task; // Löscht Aufgabe
                delete creep.memory.targetId; // Löscht Ziel
            }
        } else if (creep.memory.task === 'idle') {
            let spawn = null;
            if (cachedData && cachedData.structures) {
                spawn = creep.pos.findClosestByPath(cachedData.structures, {
                    filter: s => s.structureType === STRUCTURE_SPAWN // Sucht nächsten Spawn
                });
            } else {
                spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
                if (cachedData && !cachedData.structures) cachedData.structures = creep.room.find(FIND_STRUCTURES); // Cache Strukturen
            }
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zum Spawn
                logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn');
            }
        }
    } else { // Energiesammelmodus
        // Prüft, ob die gespeicherte Sammelaufgabe noch gültig ist
        let taskValid = false;
        let target = creep.memory.targetId ? Game.getObjectById(creep.memory.targetId) : null;
        if (creep.memory.task === 'collect' && target) {
            if (target instanceof Resource && target.amount > 0) {
                taskValid = true; // Gültig, wenn Ressource vorhanden
            } else if (target.store && target.store[RESOURCE_ENERGY] > 0) {
                taskValid = true; // Gültig, wenn Energie im Speicher
            }
        }

        // Wenn die Aufgabe ungültig ist oder keine Aufgabe existiert, neue zuweisen
        if (!taskValid || creep.memory.task !== 'collect') {
            let tasks = taskManager.getWorkerCollectTasks(creep, cachedData); // Holt Sammelaufgaben vom Task-Manager
            if (tasks.length > 0) {
                taskManager.assignTask(creep, tasks); // Weist die beste Aufgabe zu
            } else {
                creep.memory.task = 'idle'; // Setzt auf Leerlauf
                creep.memory.targetId = null; // Kein Ziel
                logger.info(creep.name + ': Keine Sammelaufgaben verfügbar, setze auf idle');
            }
        }

        // Führt die Sammelaufgabe aus
        if (creep.memory.task === 'collect') {
            let target = Game.getObjectById(creep.memory.targetId);
            if (target) {
                if (target instanceof Resource) {
                    if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zur Ressource
                        logger.info(creep.name + ': Bewegt sich zu dropped resource ' + target.id);
                    } else if (creep.pickup(target) === OK) {
                        logger.info(creep.name + ': Sammelt dropped resource ' + target.id);
                        if (target.amount === 0) {
                            delete creep.memory.task; // Löscht Aufgabe
                            delete creep.memory.targetId; // Löscht Ziel
                        }
                    } else {
                        logger.warn(creep.name + ': Pickup fehlgeschlagen für ' + target.id);
                        delete creep.memory.task; // Löscht Aufgabe
                        delete creep.memory.targetId; // Löscht Ziel
                    }
                } else if (target.store) {
                    if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zum Speicher
                        logger.info(creep.name + ': Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Sammeln');
                    } else if (creep.withdraw(target, RESOURCE_ENERGY) === OK) {
                        logger.info(creep.name + ': Sammelt Energie aus ' + target.structureType + ' ' + target.id);
                        if (target.store[RESOURCE_ENERGY] === 0) {
                            delete creep.memory.task; // Löscht Aufgabe
                            delete creep.memory.targetId; // Löscht Ziel
                        }
                    } else {
                        logger.warn(creep.name + ': Withdraw fehlgeschlagen für ' + target.structureType + ' ' + target.id);
                        delete creep.memory.task; // Löscht Aufgabe
                        delete creep.memory.targetId; // Löscht Ziel
                    }
                }
            } else {
                logger.info(creep.name + ': Collect-Ziel ungültig, Aufgabe zurückgesetzt');
                delete creep.memory.task; // Löscht Aufgabe
                delete creep.memory.targetId; // Löscht Ziel
            }
        } else if (creep.memory.task === 'idle') {
            let spawn = creep.pos.findClosestByPath((cachedData && cachedData.structures) ?
                cachedData.structures.filter(s => s.structureType === STRUCTURE_SPAWN) :
                FIND_MY_SPAWNS); // Sucht nächsten Spawn
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zum Spawn
                logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn');
            }
        }
    }
};