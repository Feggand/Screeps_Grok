module.exports = {
    spawn: function(spawn, role, targetRoom) {
        let energyAvailable = spawn.room.energyAvailable;
        let body = [];

        if (role === 'harvester') {
            let workParts = Math.min(Math.floor(energyAvailable / 200), 5);
            let carryParts = 1;
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            if (totalCost <= energyAvailable) {
                body = Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE));
            } else {
                body = [WORK, CARRY, MOVE];
            }
        } else if (role === 'hauler') {
            let carryParts = Math.min(Math.floor(energyAvailable / 100), 6);
            let moveParts = Math.ceil(carryParts / 2);
            let totalCost = (carryParts * 50) + (moveParts * 50);
            if (totalCost <= energyAvailable) {
                body = Array(carryParts).fill(CARRY).concat(Array(moveParts).fill(MOVE));
            } else {
                body = [CARRY, CARRY, MOVE, MOVE];
            }
        } else if (role === 'worker') {
            let workParts = Math.min(Math.floor(energyAvailable / 200), 4);
            let carryParts = Math.min(Math.floor((energyAvailable - workParts * 100) / 50), 2);
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            if (totalCost <= energyAvailable) {
                body = Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE));
            } else {
                body = [WORK, CARRY, MOVE];
            }
        } else if (role === 'remoteHarvester') {
            let workParts = Math.min(Math.floor(energyAvailable / 200), 5);
            let carryParts = 1;
            let moveParts = Math.ceil((workParts + carryParts) / 2);
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50);
            if (totalCost <= energyAvailable) {
                body = Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE));
            } else {
                body = [WORK, CARRY, MOVE];
            }
        } else if (role === 'scout') {
            body = [MOVE]; // Minimaler Scout, kostet 50 Energie
        }

        let name = role + Game.time;
        let memory = { role: role, working: false };

        if (role === 'harvester') {
            let sources = spawn.room.find(FIND_SOURCES);
            if (!sources.length) return;
            let harvestersPerSource = _.groupBy(_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === spawn.room.name), 'memory.source');
            let unoccupiedSources = sources.filter(source => !(source.id in harvestersPerSource));
            let targetSource;
            if (unoccupiedSources.length > 0) {
                targetSource = unoccupiedSources[0];
            } else {
                let minHarvesters = Infinity;
                for (let source of sources) {
                    let count = (harvestersPerSource[source.id] || []).length;
                    if (count < minHarvesters) {
                        minHarvesters = count;
                        targetSource = source;
                    }
                }
            }
            memory.source = targetSource.id;
        } else if (role === 'remoteHarvester') {
            memory.targetRoom = 'W7N1';
            if (!Memory.remoteContainers || !Memory.remoteContainers['W7N1']) {
                Memory.remoteContainers = Memory.remoteContainers || {};
                Memory.remoteContainers['W7N1'] = [];
            }
            let remoteContainers = Memory.remoteContainers['W7N1'];
            let assignedContainer = remoteContainers.find(c => !c.assignedHarvester);
            if (assignedContainer) {
                memory.containerId = assignedContainer.id;
                assignedContainer.assignedHarvester = name;
            }
        } else if (role === 'scout') {
            memory.targetRoom = targetRoom || 'W7N1'; // Dynamisches Ziel
        }

        spawn.spawnCreep(body, name, { memory: memory });
    }
};