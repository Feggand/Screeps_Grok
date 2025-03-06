// role.remoteWorker.js
// Logik für RemoteWorker-Creeps, die Reparatur- und Bauaufgaben in Nebenräumen übernehmen

var logger = require('logger');

var roleRemoteWorker = {
    run: function(creep, cachedData) {
        logger.info(`${creep.name}: Starting run function`);

        const homeRoom = creep.memory.homeRoom || 'W6N1';
        const targetRoom = creep.memory.targetRoom;

        if (!targetRoom) {
            logger.warn(`${creep.name}: No targetRoom assigned, skipping`);
            return;
        }

        // Zustandswechsel: Sammeln oder Arbeiten
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            logger.info(`${creep.name}: Switching to gathering (no energy)`);
        } else if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            logger.info(`${creep.name}: Switching to working (energy full)`);
        }

        // Prüfe, ob es Aufgaben im Nebenraum gibt
        const targetRoomObj = Game.rooms[targetRoom];
        let hasRemoteTasks = false;
        if (targetRoomObj) {
            const repairTargets = targetRoomObj.find(FIND_STRUCTURES, {
                filter: s => s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
            });
            const constructionSites = targetRoomObj.find(FIND_CONSTRUCTION_SITES);
            hasRemoteTasks = repairTargets.length > 0 || constructionSites.length > 0;
        }

        // Energie sammeln
        if (!creep.memory.working) {
            // Primär: Energie aus Container im Nebenraum, wenn leer, Aufgabe ansteht und Energie verfügbar ist
            if (hasRemoteTasks && creep.room.name === targetRoom) {
                const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                });
                if (container) {
                    if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        logger.info(`${creep.name}: Moving to container ${container.id} in ${targetRoom} to withdraw`);
                        creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                    } else if (creep.withdraw(container, RESOURCE_ENERGY) === OK) {
                        logger.info(`${creep.name}: Withdrawing energy from container ${container.id} in ${targetRoom}`);
                    }
                    return;
                }
            }

            // Sekundär: Energie aus Storage im Hauptraum, wenn keine Aufgaben im Nebenraum oder Container leer
            if (creep.room.name !== homeRoom) {
                logger.info(`${creep.name}: Moving to home room ${homeRoom} to gather energy from storage`);
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            const storage = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
            })[0];

            if (storage) {
                if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to storage ${storage.id} in ${homeRoom} to withdraw`);
                    creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (creep.withdraw(storage, RESOURCE_ENERGY) === OK) {
                    logger.info(`${creep.name}: Withdrawing energy from storage ${storage.id}`);
                }
            } else {
                logger.warn(`${creep.name}: No storage with energy found in ${homeRoom}, idling`);
                creep.moveTo(new RoomPosition(25, 25, homeRoom));
            }
            return;
        }

        // Arbeiten: Prüfe Aufgaben in Nebenräumen und Hauptraum
        if (targetRoomObj && hasRemoteTasks) {
            // Gehe zum Nebenraum, wenn nicht dort
            if (creep.room.name !== targetRoom) {
                logger.info(`${creep.name}: Moving to target room ${targetRoom} for repair or construction`);
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // Priorität 1: Reparaturaufgaben im Nebenraum
            const repairTargets = targetRoomObj.find(FIND_STRUCTURES, {
                filter: s => s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
            });
            if (repairTargets.length > 0) {
                const target = creep.pos.findClosestByPath(repairTargets);
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to repair ${target.structureType} ${target.id}`);
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.repair(target) === OK) {
                    logger.info(`${creep.name}: Repairing ${target.structureType} ${target.id}`);
                }
                return;
            }

            // Priorität 2: Bauaufgaben im Nebenraum
            const constructionSites = targetRoomObj.find(FIND_CONSTRUCTION_SITES);
            if (constructionSites.length > 0) {
                const target = creep.pos.findClosestByPath(constructionSites);
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to build ${target.structureType} at ${target.pos}`);
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.build(target) === OK) {
                    logger.info(`${creep.name}: Building ${target.structureType} at ${target.pos}`);
                }
                return;
            }
        }

        // Keine Aufgaben im Nebenraum -> Arbeiten im Hauptraum
        if (!hasRemoteTasks) {
            if (creep.room.name !== homeRoom) {
                logger.info(`${creep.name}: No remote tasks, moving to home room ${homeRoom}`);
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // Priorität 1: Reparaturaufgaben im Hauptraum
            const homeRepairTargets = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
            });
            if (homeRepairTargets.length > 0) {
                const target = creep.pos.findClosestByPath(homeRepairTargets);
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to repair ${target.structureType} ${target.id} in ${homeRoom}`);
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.repair(target) === OK) {
                    logger.info(`${creep.name}: Repairing ${target.structureType} ${target.id} in ${homeRoom}`);
                }
                return;
            }

            // Priorität 2: Bauaufgaben im Hauptraum
            const homeConstructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (homeConstructionSites.length > 0) {
                const target = creep.pos.findClosestByPath(homeConstructionSites);
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to build ${target.structureType} at ${target.pos} in ${homeRoom}`);
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.build(target) === OK) {
                    logger.info(`${creep.name}: Building ${target.structureType} at ${target.pos} in ${homeRoom}`);
                }
                return;
            }

            // Priorität 3: Upgraden im Hauptraum
            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to upgrade controller in ${homeRoom}`);
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.upgradeController(creep.room.controller) === OK) {
                    logger.info(`${creep.name}: Upgrading controller in ${homeRoom}`);
                }
                return;
            }
        }
    }
};

module.exports = roleRemoteWorker;