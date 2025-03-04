// spawnManager.js
var spawnCreeps = require('spawnCreeps');
var logger = require('logger');

module.exports = {
    manageSpawns: function(room) {
        let roomMemory = Memory.rooms[room.name] || {};
        if (!roomMemory.isMyRoom) return;

        let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
        let totalContainerEnergy = containers.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0);
        let sources = room.find(FIND_SOURCES);
        let storage = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0];

        roomMemory.minHarvesters = sources.length;
        roomMemory.minHaulers = Math.min(3, Math.max(2, Math.ceil(totalContainerEnergy / 1000)));
        
        let extraWorkers = (room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 1 : 0) + 
                          (room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }).length > 0 ? 1 : 0);
        let baseWorkers = 2 + extraWorkers + Math.floor(totalContainerEnergy / 500);
        let storageFillPercentage = storage && storage.store[RESOURCE_ENERGY] > 0 ? (storage.store[RESOURCE_ENERGY] / storage.store.getCapacity(RESOURCE_ENERGY)) : 0;
        let additionalWorkers = storageFillPercentage >= 0.65 ? Math.floor((storageFillPercentage - 0.65) * 40) : 0;
        roomMemory.minWorkers = Math.min(12, Math.max(2, baseWorkers + additionalWorkers));

        let totalRemoteSources = 0;
        const remoteRooms = roomMemory.remoteRooms || [];
        const remoteRoomNeeds = {};
        remoteRooms.forEach(remoteRoomName => {
            const remoteRoom = Game.rooms[remoteRoomName];
            let sourceCount = 0;
            if (remoteRoom) {
                const sources = remoteRoom.find(FIND_SOURCES);
                sourceCount = sources.length;
            } else {
                sourceCount = 2; // Annahme für unsichtbare Räume
            }
            totalRemoteSources += sourceCount;
            remoteRoomNeeds[remoteRoomName] = sourceCount;
        });
        roomMemory.minRemoteHarvesters = Math.min(totalRemoteSources, remoteRooms.length * 2);
        roomMemory.minRemoteHaulers = remoteRooms.length * 2;
        roomMemory.minRemoteWorkers = remoteRooms.length;

        // Mineral-Harvester-Anforderungen basierend auf verfügbaren Extractoren
        let extractorCount = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length;
        remoteRooms.forEach(remoteRoomName => {
            const remoteRoom = Game.rooms[remoteRoomName];
            if (remoteRoom) {
                extractorCount += remoteRoom.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length;
            }
        });
        roomMemory.minMineralHarvesters = room.controller.level >= 6 ? Math.min(extractorCount, 2) : 0; // Maximal 2, abhängig von Extractoren

        let creeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name || (!c.memory.homeRoom && c.room.name === room.name));
        let harvesters = _.countBy(creeps, 'memory.role').harvester || 0;
        let haulers = _.countBy(creeps, 'memory.role').hauler || 0;
        let workers = _.countBy(creeps, 'memory.role').worker || 0;
        let remoteHarvesters = _.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name).length;
        let remoteHaulers = _.filter(Game.creeps, c => c.memory.role === 'remoteHauler' && c.memory.homeRoom === room.name).length;
        let remoteWorkers = _.filter(Game.creeps, c => c.memory.role === 'remoteWorker' && c.memory.homeRoom === room.name).length;
        let reservers = _.filter(Game.creeps, c => c.memory.role === 'reserver' && c.memory.homeRoom === room.name).length;
        let mineralHarvesters = _.filter(Game.creeps, c => c.memory.role === 'mineralHarvester' && c.memory.homeRoom === room.name).length;

        logger.info('Room ' + room.name + ': Harvesters=' + harvesters + '/' + roomMemory.minHarvesters + 
                    ', Haulers=' + haulers + '/' + roomMemory.minHaulers + 
                    ', Workers=' + workers + '/' + roomMemory.minWorkers + 
                    ', RemoteHarvesters=' + remoteHarvesters + '/' + roomMemory.minRemoteHarvesters + 
                    ', RemoteHaulers=' + remoteHaulers + '/' + roomMemory.minRemoteHaulers +
                    ', RemoteWorkers=' + remoteWorkers + '/' + roomMemory.minRemoteWorkers +
                    ', Reservers=' + reservers + '/' + remoteRooms.length +
                    ', MineralHarvesters=' + mineralHarvesters + '/' + roomMemory.minMineralHarvesters +
                    ', Energy=' + room.energyAvailable + ', TotalContainerEnergy=' + totalContainerEnergy +
                    ', StorageFill=' + (storageFillPercentage * 100).toFixed(1) + '%');

        let spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) {
            if (spawn && spawn.spawning) {
                logger.info('Spawn in ' + room.name + ' is busy spawning: ' + spawn.spawning.name);
            }
            return;
        }

        // Notfall-Spawn: Harvester und Hauler haben höchste Priorität
        if (harvesters < roomMemory.minHarvesters && room.energyAvailable >= 300) {
            spawnCreeps.spawn(spawn, 'harvester', null, room.name);
            logger.info('Spawning new harvester in ' + room.name + ' (emergency)');
            return;
        }

        if (haulers < roomMemory.minHaulers && room.energyAvailable >= 300) {
            spawnCreeps.spawn(spawn, 'hauler', null, room.name);
            logger.info('Spawning new hauler in ' + room.name + ' (emergency)');
            return;
        }

        // Prüfe Aufgaben in Nebenräumen für remoteWorker
        let remoteTasksExist = false;
        let targetRoomForWorker = null;
        for (let remoteRoomName of remoteRooms) {
            const remoteRoom = Game.rooms[remoteRoomName];
            const currentWorkers = _.filter(Game.creeps, c => c.memory.role === 'remoteWorker' && c.memory.targetRoom === remoteRoomName).length;
            if (currentWorkers >= 1) continue;

            if (remoteRoom) {
                const repairTasks = remoteRoom.find(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
                }).length;
                const constructionTasks = remoteRoom.find(FIND_CONSTRUCTION_SITES).length;
                if (repairTasks > 0 || constructionTasks > 0) {
                    remoteTasksExist = true;
                    targetRoomForWorker = remoteRoomName;
                    break;
                }
            }
        }

        if (workers < roomMemory.minWorkers && room.energyAvailable >= 200) {
            let workerRoles = ['upgrader', 'repairer', 'wallRepairer', 'flexible'];
            let existingWorkers = _.filter(Game.creeps, c => c.memory.role === 'worker' && c.memory.homeRoom === room.name);
            let roleCounts = _.countBy(existingWorkers, 'memory.subRole');
            let nextRole = workerRoles.find(role => !roleCounts[role] || roleCounts[role] < 1) || 'flexible';
            spawnCreeps.spawn(spawn, 'worker', null, room.name, nextRole);
            logger.info('Spawning new worker with subRole ' + nextRole + ' in ' + room.name);
            return;
        }

        if (room.controller.level >= 4 && room.energyAvailable >= 650) {
            for (let i = 0; i < remoteRooms.length; i++) {
                let remoteRoomName = remoteRooms[i];
                let reserversInRoom = _.filter(Game.creeps, c => c.memory.role === 'reserver' && c.memory.targetRoom === remoteRoomName);
                let roomVisible = Game.rooms[remoteRoomName];
                let needsReserver = !roomVisible || (roomVisible && roomVisible.controller && !roomVisible.controller.my && (!roomVisible.controller.reservation || roomVisible.controller.reservation.ticksToEnd < 2000));
                if (needsReserver && (reserversInRoom.length === 0 || (reserversInRoom.length === 1 && reserversInRoom[0].ticksToLive < 60))) {
                    spawnCreeps.spawn(spawn, 'reserver', remoteRoomName, room.name);
                    logger.info(`Spawning new reserver for ${remoteRoomName} in ${room.name}`);
                    return;
                }
            }
        }

        if (remoteHarvesters < roomMemory.minRemoteHarvesters && room.energyAvailable >= 300) {
            let targetRoom = null;
            let minHarvesterCount = Infinity;
            for (let remoteRoomName of remoteRooms) {
                const currentHarvesters = _.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.targetRoom === remoteRoomName).length;
                if (currentHarvesters < 2 && currentHarvesters < minHarvesterCount) {
                    targetRoom = remoteRoomName;
                    minHarvesterCount = currentHarvesters;
                }
            }
            if (targetRoom) {
                let idleCreep = _.find(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name && (!c.memory.targetRoom || remoteRoomNeeds[c.memory.targetRoom] === 0));
                if (idleCreep) {
                    idleCreep.memory.targetRoom = targetRoom;
                    logger.info(`Reassigned ${idleCreep.name} to ${targetRoom}`);
                } else {
                    spawnCreeps.spawn(spawn, 'remoteHarvester', targetRoom, room.name);
                    logger.info('Spawning new remoteHarvester for ' + targetRoom + ' in ' + room.name);
                }
                return;
            } else {
                logger.info('No suitable remote room with unassigned sources found');
            }
        } else if (remoteHaulers < roomMemory.minRemoteHaulers && room.energyAvailable >= 300) {
            let targetRoom = null;
            let minHaulerCount = Infinity;
            for (let remoteRoomName of remoteRooms) {
                const currentHaulers = _.filter(Game.creeps, c => c.memory.role === 'remoteHauler' && c.memory.targetRoom === remoteRoomName).length;
                if (currentHaulers < 2 && currentHaulers < minHaulerCount) {
                    targetRoom = remoteRoomName;
                    minHaulerCount = currentHaulers;
                }
            }
            if (targetRoom) {
                spawnCreeps.spawn(spawn, 'remoteHauler', targetRoom, room.name);
                logger.info('Spawning new remoteHauler for ' + targetRoom + ' in ' + room.name);
                return;
            } else {
                logger.info('No suitable remote room needing hauler found');
            }
        } else if (remoteWorkers < roomMemory.minRemoteWorkers && remoteTasksExist && room.energyAvailable >= 200) {
            spawnCreeps.spawn(spawn, 'remoteWorker', targetRoomForWorker, room.name);
            logger.info('Spawning new remoteWorker for ' + targetRoomForWorker + ' in ' + room.name);
            return;
        } else if (mineralHarvesters < roomMemory.minMineralHarvesters && room.energyAvailable >= 350) {
            let targetRoom = null;
            if (mineralHarvesters === 0 && room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length > 0) {
                targetRoom = room.name; // W6N1, wenn Extractor vorhanden
            } else if (mineralHarvesters === 1) {
                for (let remoteRoomName of remoteRooms) {
                    let remoteRoom = Game.rooms[remoteRoomName];
                    if (remoteRoom && remoteRoom.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length > 0) {
                        targetRoom = remoteRoomName; // Erster Nebenraum mit Extractor
                        break;
                    }
                }
            }
            if (targetRoom) {
                spawnCreeps.spawn(spawn, 'mineralHarvester', targetRoom, room.name);
                logger.info('Spawning new mineralHarvester for ' + targetRoom + ' in ' + room.name);
                return;
            } else {
                logger.info('No suitable room with extractor found for mineralHarvester in ' + room.name);
            }
        } else {
            logger.info('No spawning needed in ' + room.name + ': All minimum requirements met or exceeded');
        }

        roomMemory.harvesterSpawnedThisTick = false;
    }
};