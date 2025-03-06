// role.remoteHauler.js
// Logik für RemoteHauler-Creeps, die Energie aus Remote-Räumen zum Hauptraum transportieren
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren

var logger = require('logger');

var roleRemoteHauler = {
    run: function (creep, cachedData) {
        logger.info(`${creep.name}: Starting run function`);

        // Zustandswechsel basierend auf Energie
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            logger.info(`${creep.name}: Wechselt zu Sammeln (keine Energie)`);
        } else if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            logger.info(`${creep.name}: Wechselt zu Liefern (Energie voll)`);
        }

        const homeRoom = creep.memory.homeRoom || 'W6N1'; // Hauptraum ist W6N1
        const targetRoom = creep.memory.targetRoom;

        if (!targetRoom) {
            logger.warn(`${creep.name}: No targetRoom assigned, skipping`);
            return;
        }

        // Sammeln in targetRoom
        if (!creep.memory.working) {
            if (creep.room.name !== targetRoom) {
                logger.info(`${creep.name}: Moving to target room ${targetRoom}`);
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            // Finde alle Container mit Energie im targetRoom (nutzt cachedData)
            const containers = (cachedData && cachedData.structures) ?
                cachedData.structures.filter(s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0) :
                creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                });
            if (cachedData && !cachedData.structures) cachedData.structures = creep.room.find(FIND_STRUCTURES); // Cache Strukturen

            logger.info(`${creep.name}: Found ${containers.length} containers with energy in ${targetRoom}`);

            if (containers.length > 0) {
                // Wähle den Container mit der meisten Energie
                const targetContainer = containers.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY])[0];

                if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to container ${targetContainer.id} in ${targetRoom} to collect`);
                    creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === OK) {
                    logger.info(`${creep.name}: Collecting energy from container ${targetContainer.id} in ${targetRoom}`);
                } else {
                    logger.warn(`${creep.name}: Withdraw from ${targetContainer.id} failed with code ${creep.withdraw(targetContainer, RESOURCE_ENERGY)}`);
                }
            } else {
                logger.info(`${creep.name}: No energy containers found in ${targetRoom}, returning to home room`);
                creep.memory.working = true; // Wechsle in den Liefermodus, um zum homeRoom zurückzukehren
            }
        }
        // Liefern zum Storage in homeRoom
        else {
            if (creep.room.name !== homeRoom) {
                logger.info(`${creep.name}: Moving to home room ${homeRoom}`);
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // Finde Storage im homeRoom (nutzt cachedData)
            let storage = null;
            if (cachedData && cachedData.structures) {
                storage = cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE);
            } else {
                storage = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_STORAGE
                })[0];
                if (cachedData && !cachedData.structures) cachedData.structures = creep.room.find(FIND_STRUCTURES); // Cache Strukturen
            }

            if (storage) {
                if (creep.store[RESOURCE_ENERGY] > 0) {
                    if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        logger.info(`${creep.name}: Moving to storage ${storage.id} in ${homeRoom} to deliver`);
                        creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
                    } else if (creep.transfer(storage, RESOURCE_ENERGY) === OK) {
                        logger.info(`${creep.name}: Delivering energy to storage ${storage.id} in ${homeRoom}`);
                    } else {
                        logger.warn(`${creep.name}: Transfer to ${storage.id} failed with code ${creep.transfer(storage, RESOURCE_ENERGY)}`);
                    }
                } else {
                    logger.info(`${creep.name}: No energy to deliver, switching to collect mode`);
                    creep.memory.working = false; // Wechsle zurück in den Sammelmodus
                }
            } else {
                logger.warn(`${creep.name}: No storage found in ${homeRoom}, dropping energy`);
                creep.drop(RESOURCE_ENERGY);
                creep.memory.working = false; // Wechsle zurück in den Sammelmodus
            }
        }
    }
};

module.exports = roleRemoteHauler;