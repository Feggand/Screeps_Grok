// spawnCreeps.js (angepasst)
var logger = require('logger');

module.exports = {
    spawn: function(spawn, role, targetRoom, homeRoom, subRole) {
        let energyAvailable = spawn.room.energyAvailable;
        let energyCapacity = spawn.room.energyCapacityAvailable;
        let haulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.homeRoom === spawn.room.name).length;

        let minEnergyRequired = 0;
        if (role === 'harvester' || role === 'remoteHarvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyCapacity / 200), 5));
            let carryParts = 1;
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            minEnergyRequired = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
        } else if (role === 'hauler' || role === 'remoteHauler') {
            let carryParts = Math.max(4, Math.min(Math.floor(energyCapacity / 100), 8));
            let moveParts = Math.ceil(carryParts / 2);
            minEnergyRequired = (carryParts * 50) + (moveParts * 50);
        } else if (role === 'worker' || role === 'remoteWorker') {
            let workParts = Math.max(1, Math.min(Math.floor(energyCapacity / 200), 4));
            let carryParts = Math.max(1, Math.min(Math.floor((energyCapacity - workParts * 100) / 50), 2));
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            minEnergyRequired = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
        } else if (role === 'scout') {
            minEnergyRequired = 50;
        } else if (role === 'reserver') {
            let claimParts = Math.max(1, Math.min(Math.floor(energyCapacity / 650), 2));
            let moveParts = claimParts;
            minEnergyRequired = (claimParts * 600) + (moveParts * 50);
        }

        if (haulers > 0 && energyAvailable < minEnergyRequired) {
            logger.info(`Waiting for required energy (${energyAvailable}/${minEnergyRequired}) in ${spawn.room.name} for ${role}`);
            return;
        }

        let body = [];
        if (role === 'harvester' || role === 'remoteHarvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyAvailable / 200), 5));
            let carryParts = 1;
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, WORK, CARRY, MOVE];
        } else if (role === 'hauler' || role === 'remoteHauler') {
            let carryParts = Math.max(4, Math.min(Math.floor(energyAvailable / 100), 8));
            let moveParts = Math.ceil(carryParts / 2);
            let totalCost = (carryParts * 50) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(carryParts).fill(CARRY).concat(Array(moveParts).fill(MOVE)) : 
                [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
        } else if (role === 'worker' || role === 'remoteWorker') {
            let workParts = Math.max(1, Math.min(Math.floor(energyAvailable / 200), 4));
            let carryParts = Math.max(1, Math.min(Math.floor((energyAvailable - workParts * 100) / 50), 2));
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, CARRY, MOVE];
        } else if (role === 'scout') {
            body = [MOVE];
        } else if (role === 'reserver') {
            let claimParts = Math.max(1, Math.min(Math.floor(energyAvailable / 650), 2));
            let moveParts = claimParts;
            let totalCost = (claimParts * 600) + (moveParts * 50);
            body = totalCost <= energyAvailable ? 
                Array(claimParts).fill(CLAIM).concat(Array(moveParts).fill(MOVE)) : 
                [CLAIM, MOVE];
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
        } else if (role === 'remoteHarvester' || role === 'remoteHauler' || role === 'remoteWorker') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : [];
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null);
            if (!memory.targetRoom) {
                logger.warn(`No targetRoom for ${role} in ${homeRoom}, skipping`);
                return;
            }
            if (role === 'remoteHarvester') {
                if (!Memory.remoteContainers[memory.targetRoom]) Memory.remoteContainers[memory.targetRoom] = [];
                let remoteContainers = Memory.remoteContainers[memory.targetRoom];
                let assignedContainer = remoteContainers.find(c => !c.assignedHarvester);
                if (assignedContainer) {
                    memory.containerId = assignedContainer.id;
                    assignedContainer.assignedHarvester = name;
                }
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
        } else if (role === 'reserver') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : [];
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null);
            if (!memory.targetRoom) {
                logger.warn('No targetRoom for reserver in ' + homeRoom + ', skipping spawn');
                return;
            }
        }

        let result = spawn.spawnCreep(body, name, { memory: memory });
        if (result === OK) {
            logger.info('Spawned ' + name + ' in ' + spawn.room.name + ' with role ' + role + ' and body ' + JSON.stringify(body));
        } else {
            logger.error('Failed to spawn ' + name + ': ' + result);
        }
    }
};