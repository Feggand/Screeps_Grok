var spawnCreeps = require('spawnCreeps');
var logger = require('logger');

module.exports = {
    manageSpawns: function(room) {
        let roomMemory = Memory.rooms[room.name] || {};
        if (!roomMemory.isMyRoom) return;

        let containers = room.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType === STRUCTURE_CONTAINER; } });
        let fullestContainerEnergy = containers.length ? _.max(containers, function(c) { return c.store[RESOURCE_ENERGY]; }).store[RESOURCE_ENERGY] : 0;
        
        roomMemory.minHaulers = Math.min((roomMemory.minHaulers || 2) + Math.floor(fullestContainerEnergy / 1000), 4);
        let extraWorkers = (room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 1 : 0) + 
                          (room.find(FIND_STRUCTURES, { filter: function(s) { return s.hits < s.hitsMax; } }).length > 0 ? 1 : 0);
        if (!roomMemory.minWorkers || Game.time % 100 === 0) {
            roomMemory.minWorkers = fullestContainerEnergy < 500 ? 4 : Math.min(Math.max(6, 1 + extraWorkers + Math.floor(fullestContainerEnergy / 500)), 8);
        }

        let creeps = _.filter(Game.creeps, function(c) { return c.memory.homeRoom === room.name || (!c.memory.homeRoom && c.room.name === room.name); });
        let harvesters = _.countBy(creeps, 'memory.role').harvester || 0;
        let haulers = _.countBy(creeps, 'memory.role').hauler || 0;
        let workers = _.countBy(creeps, 'memory.role').worker || 0;
        let remoteHarvesters = _.filter(Game.creeps, function(c) { return c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name; }).length;

        logger.info('Room ' + room.name + ': Harvesters=' + harvesters + '/' + roomMemory.minHarvesters + ', Haulers=' + haulers + '/' + roomMemory.minHaulers + ', Workers=' + workers + '/' + roomMemory.minWorkers + ', RemoteHarvesters=' + remoteHarvesters + '/' + roomMemory.minRemoteHarvesters + ', Energy=' + room.energyAvailable);

        let spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) return;

        if (room.controller.level >= 3 && room.energyAvailable >= 50) {
            let remoteRooms = roomMemory.remoteRooms || [];
            for (let i = 0; i < remoteRooms.length; i++) {
                let remoteRoomName = remoteRooms[i];
                let remoteRoomMemory = Memory.rooms[remoteRoomName] || {};
                let scouts = _.filter(Game.creeps, function(c) { return c.memory.role === 'scout' && c.memory.targetRoom === remoteRoomName; });
                if (remoteRoomMemory.needsScout && (scouts.length === 0 || (scouts.length === 1 && scouts[0].ticksToLive < 60))) {
                    spawnCreeps.spawn(spawn, 'scout', remoteRoomName, room.name);
                }
            }
        }

        if (harvesters < roomMemory.minHarvesters && room.energyAvailable >= 150) {
            spawnCreeps.spawn(spawn, 'harvester', null, room.name);
            logger.info('Spawning new harvester in ' + room.name);
            return;
        } else if (haulers < roomMemory.minHaulers && room.energyAvailable >= 100) {
            spawnCreeps.spawn(spawn, 'hauler', null, room.name);
        } else if (workers < roomMemory.minWorkers && room.energyAvailable >= 150) {
            let workerRoles = ['upgrader', 'repairer', 'wallRepairer', 'flexible'];
            let existingWorkers = _.filter(Game.creeps, function(c) { return c.memory.role === 'worker' && c.memory.homeRoom === room.name; });
            let roleCounts = _.countBy(existingWorkers, 'memory.subRole');
            let nextRole = workerRoles.find(function(role) { return !roleCounts[role] || roleCounts[role] < 1; }) || 'flexible';

            // Dynamische Worker-Größe basierend auf verfügbarer Energie
            let energyAvailable = room.energyAvailable;
            let workParts = Math.min(Math.floor(energyAvailable / 200), 4); // Max 4 WORK
            let carryParts = Math.min(Math.floor((energyAvailable - workParts * 100) / 50), 2); // Max 2 CARRY
            let moveParts = Math.ceil((workParts + carryParts) / 2); // Genug MOVE für die Last
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            let body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, CARRY, MOVE]; // Minimaler Body als Fallback

            let memory = { role: 'worker', subRole: nextRole, working: false, homeRoom: room.name };
            let result = spawn.spawnCreep(body, 'worker_' + Game.time, { memory: memory });
            if (result === OK) {
                logger.info('Spawned worker with subRole ' + nextRole + ' in ' + room.name + ' with body ' + JSON.stringify(body));
            } else {
                logger.error('Failed to spawn worker with subRole ' + nextRole + ': ' + result);
            }
        } else if (remoteHarvesters < roomMemory.minRemoteHarvesters && room.energyAvailable >= 150) {
            let remoteRooms = roomMemory.remoteRooms || [];
            let targetRoom = remoteRooms.length > 0 ? remoteRooms[0] : null;
            spawnCreeps.spawn(spawn, 'remoteHarvester', targetRoom, room.name);
        }

        roomMemory.harvesterSpawnedThisTick = false;
    }
};