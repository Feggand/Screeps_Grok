// role.hauler.js
var taskManager = require('taskManager');
var logger = require('logger');

module.exports.run = function(creep) {
    // Arbeitsstatus aktualisieren
    const minEnergyThreshold = 0.8; // Mindestens 80% des Laderaums für andere Ziele (außer Extensions/Spawns)
    const haulerCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

    if (creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.memory.working) {
            creep.memory.working = false;
            logger.info(creep.name + ': Wechselt zu Sammeln (keine Energie)');
            if (creep.memory.task === 'deliver') {
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        }
    } else {
        // Prüfe, ob es deliver-Aufgaben für Extensions oder Spawns gibt
        let tasks = taskManager.getHaulerTasks(creep.room);
        let deliverTasks = tasks.filter(t => t.type === 'deliver');
        let hasExtensionSpawnTask = deliverTasks.some(t => {
            let target = Game.getObjectById(t.target);
            return target && (target.structureType === STRUCTURE_EXTENSION || target.structureType === STRUCTURE_SPAWN);
        });

        if (hasExtensionSpawnTask && creep.store[RESOURCE_ENERGY] > 0) {
            // Sofort liefern, wenn Extensions oder Spawns verfügbar sind und Energie vorhanden ist
            if (!creep.memory.working) {
                creep.memory.working = true;
                logger.info(creep.name + ': Wechselt zu Liefern (Energie für Extensions/Spawn verfügbar)');
                if (creep.memory.task === 'collect') {
                    delete creep.memory.task;
                    delete creep.memory.targetId;
                }
            }
        } else if (creep.store.getFreeCapacity() === 0 || 
                   (creep.store[RESOURCE_ENERGY] >= haulerCapacity * minEnergyThreshold && creep.memory.working)) {
            // Für andere Ziele nur bei vollem Laderaum oder über Schwellwert liefern
            if (!creep.memory.working) {
                creep.memory.working = true;
                logger.info(creep.name + ': Wechselt zu Liefern (voll oder über Schwellwert)');
                if (creep.memory.task === 'collect') {
                    delete creep.memory.task;
                    delete creep.memory.targetId;
                }
            }
        }
    }

    // Prüfe, ob eine gespeicherte Aufgabe existiert und zum Arbeitsstatus passt
    let taskValid = false;
    let target = Game.getObjectById(creep.memory.targetId);
    if (creep.memory.task && target) {
        if (creep.memory.task === 'collect' && !creep.memory.working) {
            taskValid = (target instanceof Resource && target.amount > 0) ||
                        (target.store && target.store[RESOURCE_ENERGY] > 0);
        } else if (creep.memory.task === 'deliver' && creep.memory.working) {
            taskValid = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    } else if (!creep.memory.task) {
        logger.info(creep.name + ': Keine gespeicherte Aufgabe');
    } else {
        logger.info(creep.name + ': Ungültiges Ziel (task: ' + creep.memory.task + ', targetId: ' + creep.memory.targetId + ')');
    }

    // Wenn die Aufgabe ungültig ist oder nicht zum Status passt, neue Aufgabe berechnen
    if (!taskValid || (creep.memory.working && creep.memory.task !== 'deliver') || (!creep.memory.working && creep.memory.task !== 'collect')) {
        let tasks = taskManager.getHaulerTasks(creep.room);
        if (!Array.isArray(tasks)) {
            logger.error(creep.name + ': getHaulerTasks returned invalid data: ' + JSON.stringify(tasks));
            creep.memory.task = 'idle';
            creep.memory.targetId = null;
            return;
        }

        if (creep.memory.working) {
            let deliverTasks = tasks.filter(t => t.type === 'deliver');
            if (deliverTasks.length > 0) {
                // Spezielle Behandlung für Extensions und Spawns: Nächstgelegenes Ziel wählen
                let extensionSpawnTasks = deliverTasks.filter(t => {
                    let target = Game.getObjectById(t.target);
                    return target && (target.structureType === STRUCTURE_EXTENSION || target.structureType === STRUCTURE_SPAWN);
                });
                
                if (extensionSpawnTasks.length > 0) {
                    extensionSpawnTasks.sort((a, b) => {
                        let targetA = Game.getObjectById(a.target);
                        let targetB = Game.getObjectById(b.target);
                        let distA = creep.pos.getRangeTo(targetA);
                        let distB = creep.pos.getRangeTo(targetB);
                        return distA - distB;
                    });
                    taskManager.assignTask(creep, [extensionSpawnTasks[0]]);
                } else {
                    taskManager.assignTask(creep, deliverTasks);
                }
            } else {
                creep.memory.task = 'idle';
                creep.memory.targetId = null;
                logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
            }
        } else {
            let collectTasks = tasks.filter(t => t.type === 'collect');
            if (collectTasks.length > 0) {
                let assignedHaulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.task === 'collect' && c.memory.targetId);
                let haulerCapacity = creep.store.getCapacity(RESOURCE_ENERGY);

                // Spezielle Behandlung für Dropped Resources und Tombsones
                let lootTasks = collectTasks.filter(t => {
                    let target = Game.getObjectById(t.target);
                    return target && (target instanceof Resource || target instanceof Tombstone);
                });

                if (lootTasks.length > 0) {
                    let selectedTask = null;
                    for (let task of lootTasks) {
                        let target = Game.getObjectById(task.target);
                        if (!target) continue;

                        let energyAmount = (target instanceof Resource) ? target.amount : target.store[RESOURCE_ENERGY];
                        let haulersNeeded = Math.ceil(energyAmount / haulerCapacity);
                        let haulersAssigned = assignedHaulers.filter(c => c.memory.targetId === task.target).length;

                        if (haulersAssigned < haulersNeeded) {
                            selectedTask = task;
                            break;
                        }
                    }

                    if (selectedTask) {
                        taskManager.assignTask(creep, [selectedTask]);
                    } else {
                        // Wenn kein Loot-Ziel mehr benötigt wird, prüfe Quellen-Container
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
                                taskManager.assignTask(creep, [selectedContainerTask]);
                            } else {
                                // Wenn kein Quellen-Container mehr benötigt wird, andere Collect-Aufgaben nutzen
                                let otherCollectTasks = collectTasks.filter(t => {
                                    let target = Game.getObjectById(t.target);
                                    return target && !(target instanceof Resource || target instanceof Tombstone) && 
                                           target.pos.findInRange(FIND_SOURCES, 1).length === 0;
                                });
                                if (otherCollectTasks.length > 0) {
                                    taskManager.assignTask(creep, otherCollectTasks);
                                } else {
                                    // Wenn keine Collect-Aufgaben mehr verfügbar sind, aber Energie vorhanden, sofort liefern
                                    if (creep.store[RESOURCE_ENERGY] > 0) {
                                        creep.memory.working = true;
                                        let deliverTasks = tasks.filter(t => t.type === 'deliver');
                                        if (deliverTasks.length > 0) {
                                            taskManager.assignTask(creep, deliverTasks);
                                        } else {
                                            creep.memory.task = 'idle';
                                            creep.memory.targetId = null;
                                            logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                                        }
                                    } else {
                                        creep.memory.task = 'idle';
                                        creep.memory.targetId = null;
                                        logger.info(creep.name + ': Keine weiteren Sammelquellen verfügbar, setze auf idle');
                                    }
                                }
                            }
                        } else {
                            // Andere Collect-Aufgaben (z. B. Storage)
                            let otherCollectTasks = collectTasks.filter(t => {
                                let target = Game.getObjectById(t.target);
                                return target && !(target instanceof Resource || target instanceof Tombstone);
                            });
                            if (otherCollectTasks.length > 0) {
                                taskManager.assignTask(creep, otherCollectTasks);
                            } else {
                                // Wenn keine Collect-Aufgaben mehr verfügbar sind, aber Energie vorhanden, sofort liefern
                                if (creep.store[RESOURCE_ENERGY] > 0) {
                                    creep.memory.working = true;
                                    let deliverTasks = tasks.filter(t => t.type === 'deliver');
                                    if (deliverTasks.length > 0) {
                                        taskManager.assignTask(creep, deliverTasks);
                                    } else {
                                        creep.memory.task = 'idle';
                                        creep.memory.targetId = null;
                                        logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                                    }
                                } else {
                                    creep.memory.task = 'idle';
                                    creep.memory.targetId = null;
                                    logger.info(creep.name + ': Keine weiteren Sammelquellen verfügbar, setze auf idle');
                                }
                            }
                        }
                    }
                } else {
                    // Keine Loot-Ziele, prüfe Quellen-Container direkt
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
                            taskManager.assignTask(creep, [selectedContainerTask]);
                        } else {
                            let otherCollectTasks = collectTasks.filter(t => {
                                let target = Game.getObjectById(t.target);
                                return target && target.pos.findInRange(FIND_SOURCES, 1).length === 0;
                            });
                            if (otherCollectTasks.length > 0) {
                                taskManager.assignTask(creep, otherCollectTasks);
                            } else {
                                // Wenn keine Collect-Aufgaben mehr verfügbar sind, aber Energie vorhanden, sofort liefern
                                if (creep.store[RESOURCE_ENERGY] > 0) {
                                    creep.memory.working = true;
                                    let deliverTasks = tasks.filter(t => t.type === 'deliver');
                                    if (deliverTasks.length > 0) {
                                        taskManager.assignTask(creep, deliverTasks);
                                    } else {
                                        creep.memory.task = 'idle';
                                        creep.memory.targetId = null;
                                        logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                                    }
                                } else {
                                    creep.memory.task = 'idle';
                                    creep.memory.targetId = null;
                                    logger.info(creep.name + ': Keine weiteren Sammelquellen verfügbar, setze auf idle');
                                }
                            }
                        }
                    } else {
                        taskManager.assignTask(creep, collectTasks);
                    }
                }
            } else {
                // Wenn keine Collect-Aufgaben mehr verfügbar sind, aber Energie vorhanden, sofort liefern
                if (creep.store[RESOURCE_ENERGY] > 0) {
                    creep.memory.working = true;
                    let deliverTasks = tasks.filter(t => t.type === 'deliver');
                    if (deliverTasks.length > 0) {
                        taskManager.assignTask(creep, deliverTasks);
                    } else {
                        creep.memory.task = 'idle';
                        creep.memory.targetId = null;
                        logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
                    }
                } else {
                    creep.memory.task = 'idle';
                    creep.memory.targetId = null;
                    logger.info(creep.name + ': Keine Sammelquellen verfügbar, setze auf idle');
                }
            }
        }
    }

    // Führe die gespeicherte Aufgabe aus
    if (creep.memory.task === 'deliver' && creep.memory.working) {
        let target = Game.getObjectById(creep.memory.targetId);
        if (target && target.store) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                logger.info(creep.name + ': Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Liefern');
            } else if (creep.transfer(target, RESOURCE_ENERGY) === OK) {
                logger.info(creep.name + ': Liefert Energie an ' + target.structureType + ' ' + target.id);
                if (target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    delete creep.memory.task;
                    delete creep.memory.targetId;
                }
            } else {
                logger.warn(creep.name + ': Transfer fehlgeschlagen für ' + target.structureType + ' ' + target.id);
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        } else {
            logger.info(creep.name + ': Deliver-Ziel ungültig, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
        }
    } else if (creep.memory.task === 'collect' && !creep.memory.working) {
        let target = Game.getObjectById(creep.memory.targetId);
        if (target) {
            if (target instanceof Resource) {
                if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    logger.info(creep.name + ': Bewegt sich zu dropped resource ' + target.id);
                } else if (creep.pickup(target) === OK) {
                    logger.info(creep.name + ': Sammelt dropped resource ' + target.id);
                    if (target.amount === 0) {
                        delete creep.memory.task;
                        delete creep.memory.targetId;
                    }
                } else {
                    logger.warn(creep.name + ': Pickup fehlgeschlagen für ' + target.id);
                    delete creep.memory.task;
                    delete creep.memory.targetId;
                }
            } else if (target.store) {
                if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    logger.info(creep.name + ': Bewegt sich zu ' + target.structureType + ' ' + target.id + ' zum Sammeln');
                } else if (creep.withdraw(target, RESOURCE_ENERGY) === OK) {
                    logger.info(creep.name + ': Sammelt Energie aus ' + target.structureType + ' ' + target.id);
                    if (target.store[RESOURCE_ENERGY] === 0) {
                        delete creep.memory.task;
                        delete creep.memory.targetId;
                    }
                } else {
                    logger.warn(creep.name + ': Withdraw fehlgeschlagen für ' + target.structureType + ' ' + target.id);
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
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn ' + spawn.id);
        }
    } else {
        logger.info(creep.name + ': Ungültiger Zustand (working: ' + creep.memory.working + ', task: ' + creep.memory.task + ')');
    }
};