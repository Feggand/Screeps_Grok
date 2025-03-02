// role.hauler.js
// Logik für Hauler-Creeps, die Energie transportieren

var taskManager = require('taskManager'); // Importiert Task-Manager-Modul
var logger = require('logger'); // Importiert Logging-Modul

module.exports.run = function(creep) {
    // Arbeitsstatus aktualisieren basierend auf Energie im Creep
    const minEnergyThreshold = 0.8; // Mindestens 80% des Laderaums für niedrigere Prioritäten
    const haulerCapacity = creep.store.getCapacity(RESOURCE_ENERGY); // Kapazität des Creeps

    if (creep.store[RESOURCE_ENERGY] === 0) { // Keine Energie
        if (creep.memory.working) {
            creep.memory.working = false; // Wechselt zu Sammelmodus
            logger.info(creep.name + ': Wechselt zu Sammeln (keine Energie)');
            if (creep.memory.task === 'deliver') {
                delete creep.memory.task; // Löscht Lieferaufgabe
                delete creep.memory.targetId;
            }
        }
    } else if (creep.store.getFreeCapacity() === 0 || 
               (creep.store[RESOURCE_ENERGY] >= haulerCapacity * minEnergyThreshold && creep.memory.working)) {
        // Voll oder über Schwellwert im Liefermodus
        if (!creep.memory.working) {
            creep.memory.working = true; // Wechselt zu Liefermodus
            logger.info(creep.name + ': Wechselt zu Liefern (voll oder über Schwellwert)');
            if (creep.memory.task === 'collect') {
                delete creep.memory.task; // Löscht Sammelaufgabe
                delete creep.memory.targetId;
            }
        }
    } else if (creep.store[RESOURCE_ENERGY] > 0) {
        // Sofort liefern, wenn Energie vorhanden (für hohe Prioritäten)
        if (!creep.memory.working) {
            creep.memory.working = true; // Wechselt zu Liefermodus
            logger.info(creep.name + ': Wechselt zu Liefern (Energie vorhanden)');
            if (creep.memory.task === 'collect') {
                delete creep.memory.task; // Löscht Sammelaufgabe
                delete creep.memory.targetId;
            }
        }
    }

    // Prüft, ob die gespeicherte Aufgabe noch gültig ist
    let taskValid = false;
    let target = Game.getObjectById(creep.memory.targetId); // Holt Ziel der Aufgabe
    if (creep.memory.task && target) {
        if (creep.memory.task === 'collect' && !creep.memory.working) {
            // Sammelaufgabe gültig, wenn Ziel Energie hat
            taskValid = (target instanceof Resource && target.amount > 0) ||
                        (target.store && target.store[RESOURCE_ENERGY] > 0);
        } else if (creep.memory.task === 'deliver' && creep.memory.working) {
            // Lieferaufgabe gültig, wenn Ziel Platz hat
            taskValid = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    } else if (!creep.memory.task) {
        logger.info(creep.name + ': Keine gespeicherte Aufgabe');
    } else {
        logger.info(creep.name + ': Ungültiges Ziel (task: ' + creep.memory.task + ', targetId: ' + creep.memory.targetId + ')');
    }

    // Wenn die Aufgabe ungültig ist oder nicht zum Status passt, neue zuweisen
    if (!taskValid || (creep.memory.working && creep.memory.task !== 'deliver') || (!creep.memory.working && creep.memory.task !== 'collect')) {
        let tasks = taskManager.getHaulerTasks(creep.room); // Holt verfügbare Hauler-Aufgaben
        if (!Array.isArray(tasks)) {
            logger.error(creep.name + ': getHaulerTasks returned invalid data: ' + JSON.stringify(tasks));
            creep.memory.task = 'idle'; // Fallback auf idle
            creep.memory.targetId = null;
            return;
        }

        if (creep.memory.working) { // Liefermodus
            let deliverTasks = tasks.filter(t => t.type === 'deliver'); // Filtert Lieferaufgaben
            if (deliverTasks.length > 0) {
                taskManager.assignTask(creep, deliverTasks); // Weist höchstpriorisierte Lieferaufgabe zu
            } else {
                creep.memory.task = 'idle'; // Keine Lieferziele -> idle
                creep.memory.targetId = null;
                logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
            }
        } else { // Sammelmodus
            let collectTasks = tasks.filter(t => t.type === 'collect'); // Filtert Sammelaufgaben
            if (collectTasks.length > 0) {
                let assignedHaulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.task === 'collect' && c.memory.targetId); // Bereits zugewiesene Hauler

                // Priorität 1: Abgeworfene Ressourcen und Tombstones
                let lootTasks = collectTasks.filter(t => {
                    let target = Game.getObjectById(t.target);
                    return target && (target instanceof Resource || target instanceof Tombstone);
                });

                if (lootTasks.length > 0) {
                    let selectedTask = null;
                    for (let task of lootTasks) {
                        let target = Game.getObjectById(task.target);
                        if (!target) continue;

                        let energyAmount = (target instanceof Resource) ? target.amount : target.store[RESOURCE_ENERGY]; // Energie im Ziel
                        let haulersNeeded = Math.ceil(energyAmount / haulerCapacity); // Benötigte Hauler
                        let haulersAssigned = assignedHaulers.filter(c => c.memory.targetId === task.target).length; // Zugewiesene Hauler

                        if (haulersAssigned < haulersNeeded) { // Wenn noch Hauler benötigt
                            selectedTask = task;
                            break;
                        }
                    }

                    if (selectedTask) {
                        taskManager.assignTask(creep, [selectedTask]); // Weist spezifische Aufgabe zu
                    } else {
                        // Priorität 2: Container nahe Quellen
                        let sourceContainerTasks = collectTasks.filter(t => {
                            let target = Game.getObjectById(t.target);
                            return target && target.structureType === STRUCTURE_CONTAINER && 
                                   target.pos.findInRange(FIND_SOURCES, 1).length > 0;
                        });

                        if (sourceContainerTasks.length > 0) {
                            let selectedContainerTask = null;
                            for (let task of sourceContainerTasks) {
                                let target = Game.getObjectById(task.target);
                                if (!target) continue;

                                let energyAmount = target.store[RESOURCE_ENERGY];
                                let haulersNeeded = Math.ceil(energyAmount / haulerCapacity);
                                let haulersAssigned = assignedHaulers.filter(c => c.memory.targetId === task.target).length;

                                if (haulersAssigned < haulersNeeded) {
                                    selectedContainerTask = task;
                                    break;
                                }
                            }

                            if (selectedContainerTask) {
                                taskManager.assignTask(creep, [selectedContainerTask]); // Weist Container-Aufgabe zu
                            } else {
                                // Priorität 3: Andere Container
                                let otherCollectTasks = collectTasks.filter(t => {
                                    let target = Game.getObjectById(t.target);
                                    return target && !(target instanceof Resource || target instanceof Tombstone) && 
                                           target.pos.findInRange(FIND_SOURCES, 1).length === 0;
                                });
                                if (otherCollectTasks.length > 0) {
                                    taskManager.assignTask(creep, otherCollectTasks); // Weist andere Sammelaufgabe zu
                                } else {
                                    if (creep.store[RESOURCE_ENERGY] > 0) {
                                        creep.memory.working = true; // Wechselt zu Liefermodus
                                        let deliverTasks = tasks.filter(t => t.type === 'deliver');
                                        if (deliverTasks.length > 0) {
                                            taskManager.assignTask(creep, deliverTasks); // Weist Lieferaufgabe zu
                                        } else {
                                            creep.memory.task = 'idle'; // Keine Lieferziele -> idle
                                            creep.memory.targetId = null;
                                            logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                                        }
                                    } else {
                                        creep.memory.task = 'idle'; // Keine Sammelquellen -> idle
                                        creep.memory.targetId = null;
                                        logger.info(creep.name + ': Keine weiteren Sammelquellen verfügbar, setze auf idle');
                                    }
                                }
                            }
                        } else {
                            let otherCollectTasks = collectTasks.filter(t => {
                                let target = Game.getObjectById(t.target);
                                return target && !(target instanceof Resource || target instanceof Tombstone);
                            });
                            if (otherCollectTasks.length > 0) {
                                taskManager.assignTask(creep, otherCollectTasks); // Weist andere Sammelaufgabe zu
                            } else {
                                if (creep.store[RESOURCE_ENERGY] > 0) {
                                    creep.memory.working = true; // Wechselt zu Liefermodus
                                    let deliverTasks = tasks.filter(t => t.type === 'deliver');
                                    if (deliverTasks.length > 0) {
                                        taskManager.assignTask(creep, deliverTasks); // Weist Lieferaufgabe zu
                                    } else {
                                        creep.memory.task = 'idle'; // Keine Lieferziele -> idle
                                        creep.memory.targetId = null;
                                        logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                                    }
                                } else {
                                    creep.memory.task = 'idle'; // Keine Sammelquellen -> idle
                                    creep.memory.targetId = null;
                                    logger.info(creep.name + ': Keine weiteren Sammelquellen verfügbar, setze auf idle');
                                }
                            }
                        }
                    }
                } else {
                    // Keine Loot-Aufgaben, direkt zu Container nahe Quellen
                    let sourceContainerTasks = collectTasks.filter(t => {
                        let target = Game.getObjectById(t.target);
                        return target && target.structureType === STRUCTURE_CONTAINER && 
                               target.pos.findInRange(FIND_SOURCES, 1).length > 0;
                    });

                    if (sourceContainerTasks.length > 0) {
                        let selectedContainerTask = null;
                        for (let task of sourceContainerTasks) {
                            let target = Game.getObjectById(task.target);
                            if (!target) continue;

                            let energyAmount = target.store[RESOURCE_ENERGY];
                            let haulersNeeded = Math.ceil(energyAmount / haulerCapacity);
                            let haulersAssigned = assignedHaulers.filter(c => c.memory.targetId === task.target).length;

                            if (haulersAssigned < haulersNeeded) {
                                selectedContainerTask = task;
                                break;
                            }
                        }

                        if (selectedContainerTask) {
                            taskManager.assignTask(creep, [selectedContainerTask]); // Weist Container-Aufgabe zu
                        } else {
                            let otherCollectTasks = collectTasks.filter(t => {
                                let target = Game.getObjectById(t.target);
                                return target && target.pos.findInRange(FIND_SOURCES, 1).length === 0;
                            });
                            if (otherCollectTasks.length > 0) {
                                taskManager.assignTask(creep, otherCollectTasks); // Weist andere Sammelaufgabe zu
                            } else {
                                if (creep.store[RESOURCE_ENERGY] > 0) {
                                    creep.memory.working = true; // Wechselt zu Liefermodus
                                    let deliverTasks = tasks.filter(t => t.type === 'deliver');
                                    if (deliverTasks.length > 0) {
                                        taskManager.assignTask(creep, deliverTasks); // Weist Lieferaufgabe zu
                                    } else {
                                        creep.memory.task = 'idle'; // Keine Lieferziele -> idle
                                        creep.memory.targetId = null;
                                        logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                                    }
                                } else {
                                    creep.memory.task = 'idle'; // Keine Sammelquellen -> idle
                                    creep.memory.targetId = null;
                                    logger.info(creep.name + ': Keine weiteren Sammelquellen verfügbar, setze auf idle');
                                }
                            }
                        }
                    } else {
                        taskManager.assignTask(creep, collectTasks); // Weist beliebige Sammelaufgabe zu
                    }
                }
            } else {
                if (creep.store[RESOURCE_ENERGY] > 0) {
                    creep.memory.working = true; // Wechselt zu Liefermodus
                    let deliverTasks = tasks.filter(t => t.type === 'deliver');
                    if (deliverTasks.length > 0) {
                        taskManager.assignTask(creep, deliverTasks); // Weist Lieferaufgabe zu
                    } else {
                        creep.memory.task = 'idle'; // Keine Lieferziele -> idle
                        creep.memory.targetId = null;
                        logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                    }
                } else {
                    creep.memory.task = 'idle'; // Keine Sammelquellen -> idle
                    creep.memory.targetId = null;
                    logger.info(creep.name + ': Keine Sammelquellen verfügbar, setze auf idle');
                }
            }
        }
    }

    // Führt die gespeicherte Aufgabe aus
    if (creep.memory.task === 'deliver' && creep.memory.working) {
        let target = Game.getObjectById(creep.memory.targetId); // Lieferziel
        if (target && target.store) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Ziel
                logger.info(creep.name + ': Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Liefern');
            } else if (creep.transfer(target, RESOURCE_ENERGY) === OK) {
                logger.info(creep.name + ': Liefert Energie an ' + target.structureType + ' ' + target.id); // Liefert Energie
                if (target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    delete creep.memory.task; // Ziel voll -> Aufgabe löschen
                    delete creep.memory.targetId;
                }
            } else {
                logger.warn(creep.name + ': Transfer fehlgeschlagen für ' + target.structureType + ' ' + target.id); // Fehler protokollieren
                delete creep.memory.task; // Aufgabe zurücksetzen
                delete creep.memory.targetId;
            }
        } else {
            logger.info(creep.name + ': Deliver-Ziel ungültig, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
        }
    } else if (creep.memory.task === 'collect' && !creep.memory.working) {
        let target = Game.getObjectById(creep.memory.targetId); // Sammelziel
        if (target) {
            if (target instanceof Resource) { // Abgeworfene Ressource
                if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zur Ressource
                    logger.info(creep.name + ': Bewegt sich zu dropped resource ' + target.id);
                } else if (creep.pickup(target) === OK) {
                    logger.info(creep.name + ': Sammelt dropped resource ' + target.id); // Sammelt Ressource
                    if (target.amount === 0) {
                        delete creep.memory.task; // Ressource aufgebraucht -> Aufgabe löschen
                        delete creep.memory.targetId;
                    }
                } else {
                    logger.warn(creep.name + ': Pickup fehlgeschlagen für ' + target.id); // Fehler protokollieren
                    delete creep.memory.task;
                    delete creep.memory.targetId;
                }
            } else if (target.store) { // Struktur mit Speicher (z. B. Container)
                if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zur Struktur
                    logger.info(creep.name + ': Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Sammeln');
                } else if (creep.withdraw(target, RESOURCE_ENERGY) === OK) {
                    logger.info(creep.name + ': Sammelt Energie aus ' + target.structureType + ' ' + target.id); // Entnimmt Energie
                    if (target.store[RESOURCE_ENERGY] === 0) {
                        delete creep.memory.task; // Keine Energie mehr -> Aufgabe löschen
                        delete creep.memory.targetId;
                    }
                } else {
                    logger.warn(creep.name + ': Withdraw fehlgeschlagen für ' + target.structureType + ' ' + target.id); // Fehler protokollieren
                    delete creep.memory.task;
                    delete creep.memory.targetId;
                }
            }
        } else {
            logger.info(creep.name + ': Collect-Ziel ungültig, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
        }
    } else if (creep.memory.task === 'idle') {
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS); // Nächstgelegener Spawn
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zum Spawn
            logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn ' + spawn.id);
        }
    } else {
        logger.info(creep.name + ': Ungültiger Zustand (working: ' + creep.memory.working + ', task: ' + creep.memory.task + ')');
    }
};