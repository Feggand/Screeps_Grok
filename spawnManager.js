// spawnManager.js
var spawnCreeps = require('spawnCreeps');
var logger = require('logger');

module.exports = {
    manageSpawns: function(room) {
        let roomMemory = Memory.rooms[room.name] || {};
        if (!roomMemory.isMyRoom) return;

        // Container-Energie und Quellen überprüfen
        let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
        let totalContainerEnergy = containers.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0);
        let sources = room.find(FIND_SOURCES);

        // Dynamische Anpassung der Creep-Anzahl
        roomMemory.minHarvesters = sources.length; // Eine pro Quelle (typisch 2 in W6N1)
        roomMemory.minHaulers = Math.min(3, Math.max(1, Math.floor(totalContainerEnergy / 500))); // 1-3 Hauler
        let extraWorkers = (room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 1 : 0) + 
                          (room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }).length > 0 ? 1 : 0);
        roomMemory.minWorkers = Math.min(8, Math.max(2, 1 + extraWorkers + Math.floor(totalContainerEnergy / 1000))); // 2-8 Worker
        roomMemory.minRemoteHarvesters = roomMemory.minRemoteHarvesters || 0;

        let creeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name || (!c.memory.homeRoom && c.room.name === room.name));
        let harvesters = _.countBy(creeps, 'memory.role').harvester || 0;
        let haulers = _.countBy(creeps, 'memory.role').hauler || 0;
        let workers = _.countBy(creeps, 'memory.role').worker || 0;
        let remoteHarvesters = _.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name).length;

        logger.info('Room ' + room.name + ': Harvesters=' + harvesters + '/' + roomMemory.minHarvesters + 
                    ', Haulers=' + haulers + '/' + roomMemory.minHaulers + 
                    ', Workers=' + workers + '/' + roomMemory.minWorkers + 
                    ', RemoteHarvesters=' + remoteHarvesters + '/' + roomMemory.minRemoteHarvesters + 
                    ', Energy=' + room.energyAvailable + ', TotalContainerEnergy=' + totalContainerEnergy);

        let spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) {
            if (spawn && spawn.spawning) {
                logger.info('Spawn in ' + room.name + ' is busy spawning: ' + spawn.spawning.name);
            }
            return;
        }

        // Spawn Scouts für Remote-Räume ab Level 3
        if (room.controller.level >= 3 && room.energyAvailable >= 50) {
            let remoteRooms = roomMemory.remoteRooms || [];
            for (let i = 0; i < remoteRooms.length; i++) {
                let remoteRoomName = remoteRooms[i];
                let remoteRoomMemory = Memory.rooms[remoteRoomName] || {};
                let scouts = _.filter(Game.creeps, c => c.memory.role === 'scout' && c.memory.targetRoom === remoteRoomName);
                if (remoteRoomMemory.needsScout && (scouts.length === 0 || (scouts.length === 1 && scouts[0].ticksToLive < 60))) {
                    spawnCreeps.spawn(spawn, 'scout', remoteRoomName, room.name);
                    return;
                }
            }
        }

        // Spawn-Priorität
        if (harvesters < roomMemory.minHarvesters && room.energyAvailable >= 300) {
            spawnCreeps.spawn(spawn, 'harvester', null, room.name);
            logger.info('Spawning new harvester in ' + room.name);
            return;
        } else if (haulers < roomMemory.minHaulers && room.energyAvailable >= 200) {
            spawnCreeps.spawn(spawn, 'hauler', null, room.name);
            logger.info('Spawning new hauler in ' + room.name);
            return;
        } else if (workers < roomMemory.minWorkers && room.energyAvailable >= 200) {
            let workerRoles = ['upgrader', 'repairer', 'wallRepairer', 'flexible'];
            let existingWorkers = _.filter(Game.creeps, c => c.memory.role === 'worker' && c.memory.homeRoom === room.name);
            let roleCounts = _.countBy(existingWorkers, 'memory.subRole');
            let nextRole = workerRoles.find(role => !roleCounts[role] || roleCounts[role] < 1) || 'flexible';
            spawnCreeps.spawn(spawn, 'worker', null, room.name, nextRole);
            logger.info('Spawning new worker with subRole ' + nextRole + ' in ' + room.name);
            return;
        } else if (remoteHarvesters < roomMemory.minRemoteHarvesters && room.energyAvailable >= 300) {
            let remoteRooms = roomMemory.remoteRooms || [];
            let targetRoom = remoteRooms.length > 0 ? remoteRooms[0] : null;
            spawnCreeps.spawn(spawn, 'remoteHarvester', targetRoom, room.name);
            logger.info('Spawning new remoteHarvester in ' + room.name);
            return;
        } else {
            logger.info('No spawning needed in ' + room.name + ': All minimum requirements met or exceeded');
        }

        roomMemory.harvesterSpawnedThisTick = false;
    }
};