// role.remoteWorker.js
// Logik für RemoteWorker-Creeps, die Reparatur- und Bauaufgaben in Nebenräumen übernehmen
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren

var logger = require('logger');

var roleRemoteWorker = {
    run: function (creep, cachedData) {
        logger.info(`${creep.name}: Starting run function`);

        const homeRoom = creep.memory.homeRoom || 'W6N1';
        const targetRoom = creep.memory.targetRoom;

        if (!targetRoom) {
            logger.warn(`${creep.name}: No targetRoom assigned, skipping`);
            return;
        }
        logger.info(`${creep.name}: Target room is ${targetRoom}, current room is ${creep.room.name}`);

        // Zustandswechsel: Sammeln oder Arbeiten
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            logger.info(`${creep.name}: Switching to gathering (no energy)`);
        } else if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            logger.info(`${creep.name}: Switching to working (energy full)`);
        }

        // Zugriff auf cachedData des Zielraums
        const targetRoomObj = Game.rooms[targetRoom];
        let targetCachedData = cachedData && cachedData.roomName === targetRoom ? cachedData : null;
        if (!targetCachedData && targetRoomObj) {
            targetCachedData = {
                structures: targetRoomObj.find(FIND_STRUCTURES),
                constructionSites: targetRoomObj.find(FIND_CONSTRUCTION_SITES)
            };
        }

        // Prüfe, ob es Aufgaben im Nebenraum gibt
        let hasRemoteTasks = false;
        let repairTargets = [];
        let constructionSites = [];
        if (targetRoomObj) {
            repairTargets = targetCachedData ?
                targetCachedData.structures.filter(s => {
                    if (s.structureType === STRUCTURE_ROAD) {
                        return s.hits < 4500; // Straßen unter 4500 Hits reparieren
                    } else {
                        return s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART;
                    }
                }) :
                targetRoomObj.find(FIND_STRUCTURES, {
                    filter: s => {
                        if (s.structureType === STRUCTURE_ROAD) {
                            return s.hits < 4500; // Straßen unter 4500 Hits reparieren
                        } else {
                            return s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART;
                        }
                    }
                });

            constructionSites = targetCachedData ? targetCachedData.constructionSites : targetRoomObj.find(FIND_CONSTRUCTION_SITES);

            hasRemoteTasks = repairTargets.length > 0 || constructionSites.length > 0;
            logger.info(`${creep.name}: Has remote tasks in ${targetRoom}: ${hasRemoteTasks} (repair: ${repairTargets.length}, construction: ${constructionSites.length})`);
        } else {
            logger.warn(`${creep.name}: Target room ${targetRoom} not visible`);
        }

        // Arbeiten im Nebenraum, wenn Aufgaben vorhanden
        if (creep.memory.working && targetRoomObj && hasRemoteTasks) {
            if (creep.room.name !== targetRoom) {
                logger.info(`${creep.name}: Moving to target room ${targetRoom} for repair or construction`);
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // Priorität 1: Reparaturaufgaben im Nebenraum
            if (repairTargets.length > 0) {
                logger.info(`${creep.name}: Found ${repairTargets.length} repair targets in ${targetRoom}`);
                const target = creep.pos.findClosestByPath(repairTargets);
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to repair ${target.structureType} ${target.id}`);
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.repair(target) === OK) {
                    logger.info(`${creep.name}: Repairing ${target.structureType} ${target.id}`);
                }
                return;
            } else {
                logger.info(`${creep.name}: No repair targets found in ${targetRoom}`);
            }

            // Priorität 2: Bauaufgaben im Nebenraum
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

        // Energie sammeln
        if (!creep.memory.working) {
            // Primär: Energie aus Container im Nebenraum, wenn der Creep dort ist
            if (targetRoomObj && creep.room.name === targetRoom) {
                const containers = targetCachedData ?
                    targetCachedData.structures.filter(s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0) :
                    creep.room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                    });
                const container = creep.pos.findClosestByPath(containers);
                if (container) {
                    if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        logger.info(`${creep.name}: Moving to container ${container.id} in ${targetRoom} to withdraw`);
                        creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                    } else if (creep.withdraw(container, RESOURCE_ENERGY) === OK) {
                        logger.info(`${creep.name}: Withdrawing energy from container ${container.id} in ${targetRoom}`);
                    }
                    return;
                } else {
                    logger.info(`${creep.name}: No containers with energy in ${targetRoom}, returning to home room`);
                }
            }

            // Sekundär: Energie aus Storage im Hauptraum
            if (creep.room.name !== homeRoom) {
                logger.info(`${creep.name}: Moving to home room ${homeRoom} to gather energy from storage`);
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            const storage = cachedData ?
                cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0) :
                creep.room.find(FIND_STRUCTURES, {
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
                const spawn = creep.pos.findClosestByPath(cachedData ?
                    cachedData.structures.filter(s => s.structureType === STRUCTURE_SPAWN) :
                    FIND_MY_SPAWNS);
                if (spawn) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
                    logger.info(`${creep.name}: Moving to spawn ${spawn.id} to idle`);
                }
            }
            return;
        }

        // Arbeiten im Hauptraum, wenn keine Nebenraum-Aufgaben oder Creep im Hauptraum
        if ((!hasRemoteTasks && targetRoomObj) || creep.room.name === homeRoom) {
            // Wenn nicht im Hauptraum, dorthin bewegen
            if (creep.room.name !== homeRoom) {
                logger.info(`${creep.name}: No remote tasks, moving to home room ${homeRoom}`);
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // Zugriff auf cachedData des Hauptraums
            let homeCachedData = cachedData && cachedData.roomName === homeRoom ? cachedData : {
                structures: creep.room.find(FIND_STRUCTURES),
                constructionSites: creep.room.find(FIND_CONSTRUCTION_SITES)
            };

            // Reparaturaufgaben im Hauptraum
            const homeRepairTargets = homeCachedData ?
                homeCachedData.structures.filter(s => {
                    if (s.structureType === STRUCTURE_ROAD) {
                        return s.hits < 4500; // Straßen unter 4500 Hits reparieren
                    } else {
                        return s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART;
                    }
                }) :
                creep.room.find(FIND_STRUCTURES, {
                    filter: s => {
                        if (s.structureType === STRUCTURE_ROAD) {
                            return s.hits < 4500; // Straßen unter 4500 Hits reparieren
                        } else {
                            return s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART;
                        }
                    }
                });

            if (creep.memory.working && homeRepairTargets.length > 0) {
                logger.info(`${creep.name}: Found ${homeRepairTargets.length} repair targets in ${homeRoom}`);
                const target = creep.pos.findClosestByPath(homeRepairTargets);
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to repair ${target.structureType} ${target.id} in ${homeRoom}`);
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.repair(target) === OK) {
                    logger.info(`${creep.name}: Repairing ${target.structureType} ${target.id} in ${homeRoom}`);
                }
                return;
            } else {
                logger.info(`${creep.name}: No repair targets found in ${homeRoom}`);
            }

            // Bauaufgaben im Hauptraum
            const homeConstructionSites = homeCachedData ? homeCachedData.constructionSites : creep.room.find(FIND_CONSTRUCTION_SITES);
            if (creep.memory.working && homeConstructionSites.length > 0) {
                const target = creep.pos.findClosestByPath(homeConstructionSites);
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to build ${target.structureType} at ${target.pos} in ${homeRoom}`);
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.build(target) === OK) {
                    logger.info(`${creep.name}: Building ${target.structureType} at ${target.pos} in ${homeRoom}`);
                }
                return;
            }

            // Upgraden im Hauptraum
            if (creep.memory.working && creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to upgrade controller in ${homeRoom}`);
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (creep.upgradeController(creep.room.controller) === OK) {
                    logger.info(`${creep.name}: Upgrading controller in ${homeRoom}`);
                }
                return;
            }
        }

        // Fallback: Wenn nichts zu tun ist, zum Hauptraum bewegen
        if (creep.room.name !== homeRoom) {
            logger.info(`${creep.name}: No tasks, moving to home room ${homeRoom}`);
            creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    }
};

module.exports = roleRemoteWorker;