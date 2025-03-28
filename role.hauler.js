// role.hauler.js
// Logik für Hauler-Creeps, die Energie transportieren
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren

var taskManager = require('taskManager');
var logger = require('logger');

module.exports.run = function (creep, cachedData) {
    // Arbeitsstatus aktualisieren basierend auf Energie im Creep
    const minEnergyThreshold = 0.8; // Mindestens 80% des Laderaums für niedrigere Prioritäten
    const haulerCapacity = creep.store.getCapacity(RESOURCE_ENERGY);
    const minContainerEnergy = haulerCapacity * 0.5; // Mindestens 50% der Kapazität als Schwellwert

    if (creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.memory.working) {
            creep.memory.working = false;
            logger.info(creep.name + ': Wechselt zu Sammeln (keine Energie)');
            if (creep.memory.task === 'deliver') {
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        }
    } else if (creep.store.getFreeCapacity() === 0 ||
        (creep.store[RESOURCE_ENERGY] >= haulerCapacity * minEnergyThreshold && creep.memory.working)) {
        if (!creep.memory.working) {
            creep.memory.working = true;
            logger.info(creep.name + ': Wechselt zu Liefern (voll oder über Schwellwert)');
            if (creep.memory.task === 'collect') {
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        }
    } else if (creep.store[RESOURCE_ENERGY] > 0) {
        if (!creep.memory.working) {
            creep.memory.working = true;
            logger.info(creep.name + ': Wechselt zu Liefern (Energie vorhanden)');
            if (creep.memory.task === 'collect') {
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        }
    }

    // Prüft, ob ein Receiver-Link in der Nähe des Controllers existiert (nutzt cachedData)
    const hasReceiverLink = (cachedData && cachedData.structures) ?
        cachedData.structures.some(s => s.structureType === STRUCTURE_LINK && s.store.getCapacity(RESOURCE_ENERGY) > 0 && s.pos.getRangeTo(creep.room.controller) <= 5) :
        creep.room.controller.pos.findInRange(FIND_STRUCTURES, 5, {
            filter: s => s.structureType === STRUCTURE_LINK && s.store.getCapacity(RESOURCE_ENERGY) > 0
        }).length > 0;

    // Prüft, ob die gespeicherte Aufgabe noch gültig ist
    let taskValid = false;
    let target = creep.memory.targetId ? Game.getObjectById(creep.memory.targetId) : null;
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

    // Wenn die Aufgabe ungültig ist oder nicht zum Status passt, neue zuweisen
    if (!taskValid || (creep.memory.working && creep.memory.task !== 'deliver') || (!creep.memory.working && creep.memory.task !== 'collect')) {
        let tasks = taskManager.getHaulerTasks(creep.room, cachedData); // Übergibt cachedData an taskManager
        if (!Array.isArray(tasks)) {
            logger.error(creep.name + ': getHaulerTasks returned invalid data: ' + JSON.stringify(tasks));
            creep.memory.task = 'idle';
            creep.memory.targetId = null;
            return;
        }

        if (creep.memory.working) { // Liefermodus
            let deliverTasks = tasks.filter(t => t.type === 'deliver');

            // Ausschluss des Controller-Containers, wenn ein Receiver-Link existiert
            if (hasReceiverLink) {
                deliverTasks = deliverTasks.filter(t => {
                    let target = Game.getObjectById(t.target);
                    return target && target.structureType !== STRUCTURE_CONTAINER;
                });
            }

            // Priorität 1: Spawn (nutzt cachedData)
            let spawn = creep.pos.findClosestByPath((cachedData && cachedData.structures) ?
                cachedData.structures.filter(s => s.structureType === STRUCTURE_SPAWN && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) :
                FIND_MY_SPAWNS, {
                filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            if (spawn) {
                let spawnTask = deliverTasks.find(t => t.target === spawn.id);
                if (spawnTask) {
                    taskManager.assignTask(creep, [spawnTask]);
                    return;
                }
            }

            // Priorität 2: Extensions (nutzt cachedData)
            let extensions = (cachedData && cachedData.structures) ?
                cachedData.structures.filter(s => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) :
                creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            if (extensions.length > 0) {
                let closestExtension = creep.pos.findClosestByPath(extensions);
                let extensionTask = deliverTasks.find(t => t.target === closestExtension.id);
                if (extensionTask) {
                    taskManager.assignTask(creep, [extensionTask]);
                    return;
                }
            }

            // Priorität 3: Türme, wenn unter 75%
            let towerTask = deliverTasks.find(t => {
                let target = Game.getObjectById(t.target);
                return target && target.structureType === STRUCTURE_TOWER && target.store[RESOURCE_ENERGY] < target.store.getCapacity(RESOURCE_ENERGY) * 0.75;
            });
            if (towerTask) {
                taskManager.assignTask(creep, [towerTask]);
                return;
            }

            // Priorität 4: Sender-Link
            let linkTask = deliverTasks.find(t => {
                let target = Game.getObjectById(t.target);
                return target && target.structureType === STRUCTURE_LINK;
            });
            if (linkTask) {
                taskManager.assignTask(creep, [linkTask]);
                return;
            }

            // Fallback: Storage nur, wenn keine anderen Ziele verfügbar
            let storageTask = deliverTasks.find(t => {
                let target = Game.getObjectById(t.target);
                return target && target.structureType === STRUCTURE_STORAGE;
            });
            if (storageTask) {
                taskManager.assignTask(creep, [storageTask]);
            } else {
                creep.memory.task = 'idle';
                creep.memory.targetId = null;
                logger.info(creep.name + ': Keine Lieferziele verfügbar, setze auf idle');
            }
        } else { // Sammelmodus
            let collectTasks = tasks.filter(t => t.type === 'collect');
            if (collectTasks.length > 0) {
                let assignedHaulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.task === 'collect' && c.memory.targetId);

                // Prüfe Container-Energie und priorisiere Storage, wenn Container fast leer (nutzt cachedData)
                let containers = (cachedData && cachedData.structures) ?
                    cachedData.structures.filter(s => s.structureType === STRUCTURE_CONTAINER) :
                    creep.room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    });
                let totalContainerEnergy = containers.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0);
                if (totalContainerEnergy < haulerCapacity) {
                    let storageTask = collectTasks.find(t => {
                        let target = Game.getObjectById(t.target);
                        return target && target.structureType === STRUCTURE_STORAGE && target.store[RESOURCE_ENERGY] >= minContainerEnergy;
                    });
                    if (storageTask) {
                        taskManager.assignTask(creep, [storageTask]);
                        return;
                    }
                }

                // Priorität 1: Abgeworfene Ressourcen und Tombstones (nutzt keine cachedData, da dynamisch)
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
                        return;
                    }
                }

                // Priorität 2: Container mit ausreichend Energie (nutzt cachedData)
                let viableContainerTasks = collectTasks.filter(t => {
                    let target = Game.getObjectById(t.target);
                    return target && target.structureType === STRUCTURE_CONTAINER && target.store[RESOURCE_ENERGY] >= minContainerEnergy;
                });

                if (viableContainerTasks.length > 0) {
                    let selectedContainerTask = null;
                    for (let task of viableContainerTasks) {
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
                        return;
                    }
                }

                // Fallback auf Storage, wenn Container nicht genug Energie haben
                let storageTask = collectTasks.find(t => {
                    let target = Game.getObjectById(t.target);
                    return target && target.structureType === STRUCTURE_STORAGE && target.store[RESOURCE_ENERGY] >= minContainerEnergy;
                });
                if (storageTask) {
                    taskManager.assignTask(creep, [storageTask]);
                    return;
                }

                creep.memory.task = 'idle';
                creep.memory.targetId = null;
                logger.info(creep.name + ': Keine Sammelquellen mit ausreichend Energie, setze auf idle');
            } else {
                creep.memory.task = 'idle';
                creep.memory.targetId = null;
                logger.info(creep.name + ': Keine Sammelquellen verfügbar, setze auf idle');
            }
        }
    }

    // Führt die gespeicherte Aufgabe aus
    if (creep.memory.task === 'deliver' && creep.memory.working) {
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
        if (!target) {
            logger.info(creep.name + ': Collect-Ziel ungültig, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
            return;
        }

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
    } else if (creep.memory.task === 'idle') {
        let spawn = creep.pos.findClosestByPath((cachedData && cachedData.structures) ?
            cachedData.structures.filter(s => s.structureType === STRUCTURE_SPAWN) :
            FIND_MY_SPAWNS);
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(creep.name + ': Keine Aufgaben, bewegt sich zum Spawn ' + spawn.id);
        }
    } else {
        logger.info(creep.name + ': Ungültiger Zustand (working: ' + creep.memory.working + ', task: ' + creep.memory.task + ')');
    }
};