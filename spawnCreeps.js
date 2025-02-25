// spawnCreeps.js
var logger = require('logger');

module.exports = {
    spawn: function(spawn, role, targetRoom, homeRoom, subRole) {
        let energyAvailable = spawn.room.energyAvailable;
        let body = [];

        if (role === 'harvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyAvailable / 200), 5));
            let carryParts = 1;
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, WORK, CARRY, MOVE];
        } else if (role === 'hauler') {
            let carryParts = Math.max(4, Math.min(Math.floor(energyAvailable / 100), 8)); // Mehr CARRY-Teile für Effizienz
            let moveParts = Math.ceil(carryParts / 2);
            let totalCost = (carryParts * 50) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(carryParts).fill(CARRY).concat(Array(moveParts).fill(MOVE)) : 
                [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE]; // Mindestens 200 Kapazität
        } else if (role === 'worker') {
            let workParts = Math.max(1, Math.min(Math.floor(energyAvailable / 200), 4));
            let carryParts = Math.max(1, Math.min(Math.floor((energyAvailable - workParts * 100) / 50), 2));
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, CARRY, MOVE];
        } else if (role === 'remoteHarvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyAvailable / 200), 5));
            let carryParts = 1;
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, WORK, CARRY, MOVE];
        } else if (role === 'scout') {
            body = [MOVE];
        }

        let name = role + '_' + Game.time;
        let memory = { role: role, working: false, homeRoom: homeRoom || spawn.room.name };

        if (role === 'harvester') {
            let sources = spawn.room.find(FIND_SOURCES);
            if (!sources.length) {
                logger.warn('No sources in ' + spawn.room.name + ', skipping spawn');
                return;
            }
            let harvestersPerSource = _.groupBy(_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === spawn.room.name), 'memory.source');
            let unoccupiedSources = sources.filter(s => !(s.id in harvestersPerSource));
            let targetSource = unoccupiedSources.length > 0 ? unoccupiedSources[0] : _.min(sources, s => (harvestersPerSource[s.id] || []).length);
            memory.source = targetSource.id;
        } else if (role === 'remoteHarvester') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : [];
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null);
            if (!memory.targetRoom) {
                logger.warn('No targetRoom for remoteHarvester in ' + homeRoom + ', skipping');
                return;
            }
            if (!Memory.remoteContainers[memory.targetRoom]) Memory.remoteContainers[memory.targetRoom] = [];
            let remoteContainers = Memory.remoteContainers[memory.targetRoom];
            let assignedContainer = remoteContainers.find(c => !c.assignedHarvester);
            if (assignedContainer) {
                memory.containerId = assignedContainer.id;
                assignedContainer.assignedHarvester = name;
            }
        } else if (role === 'scout') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : [];
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null);
            if (!memory.targetRoom) {
                logger.warn('No targetRoom for scout in ' + homeRoom + ', skipping spawn');
                return;
            }
        } else if (role === 'worker' && subRole) {
            memory.subRole = subRole;
        }

        let result = spawn.spawnCreep(body, name, { memory: memory });
        if (result === OK) {
            logger.info('Spawned ' + name + ' in ' + spawn.room.name + ' with role ' + role + ' and body ' + JSON.stringify(body));
        } else {
            logger.error('Failed to spawn ' + name + ': ' + result);
        }
    }
};