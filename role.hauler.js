// role.hauler.js
var taskManager = require('taskManager');
var logger = require('logger');

module.exports.run = function(creep) {
    // Arbeitsstatus aktualisieren
    if (creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.memory.working) {
            creep.memory.working = false;
            logger.info(creep.name + ': Wechselt zu Sammeln (keine Energie)');
            if (creep.memory.task === 'deliver') {
                delete creep.memory.task;
                delete creep.memory.targetId;
            }
        }
    } else if (creep.store.getFreeCapacity() === 0) {
        if (!creep.memory.working) {
            creep.memory.working = true;
            logger.info(creep.name + ': Wechselt zu Liefern (voll mit Energie)');
            if (creep.memory.task === 'collect') {
                delete creep.memory.task;
                delete creep.memory.targetId;
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
                    // Sortiere nach Entfernung zum Hauler
                    extensionSpawnTasks.sort((a, b) => {
                        let targetA = Game.getObjectById(a.target);
                        let targetB = Game.getObjectById(b.target);
                        let distA = creep.pos.getRangeTo(targetA);
                        let distB = creep.pos.getRangeTo(targetB);
                        return distA - distB;
                    });
                    taskManager.assignTask(creep, [extensionSpawnTasks[0]]); // Nimm das nächstgelegene Ziel
                } else {
                    // Für andere Ziele (z. B. Türme, Storage) normale Priorität beibehalten
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
                taskManager.assignTask(creep, collectTasks);
            } else {
                creep.memory.task = 'idle';
                creep.memory.targetId = null;
                logger.info(creep.name + ': Keine Sammelquellen verfügbar, setze auf idle');
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