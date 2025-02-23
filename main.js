module.exports.loop = function () {
    if (!Memory.rooms) Memory.rooms = {};

    if (Game.time % 100 === 0) {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            manageRoom(room);
        }
    }

    for (let name in Game.creeps) {
        let creep = Game.creeps[name];
        let role = require('role.' + creep.memory.role);
        role.run(creep);
    }

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            let towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
            towers.forEach(tower => require('tower').run(tower));
        }
    }
};

function manageRoom(room) {
    if (!Memory.rooms[room.name]) {
        Memory.rooms[room.name] = {};
    }

    let sources = room.find(FIND_SOURCES).length;
    //let energyCapacity = room.energyCapacityAvailable;
    let minHarvesters = sources;

    let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
    let fullestContainerEnergy = containers.length ? _.max(containers, c => c.store[RESOURCE_ENERGY]).store[RESOURCE_ENERGY] : 0;
    let containerLoadFactorWorkers = Math.floor(fullestContainerEnergy / 500);
    let containerLoadFactorHaulers = Math.floor(fullestContainerEnergy / 1000);

    let baseMinHaulers = room.controller.level === 2 ? 1 : 2;
    let minHaulers = Math.min(baseMinHaulers + containerLoadFactorHaulers, 4);

    let baseMinWorkers = 1;
    let constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    let damagedStructures = room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax
    }).length;
    let extraWorkersNeeded = (constructionSites > 0 ? 1 : 0) + (damagedStructures > 0 ? 1 : 0);
    let minWorkers = fullestContainerEnergy < 500 ? 4 : Math.max(6, baseMinWorkers + extraWorkersNeeded + containerLoadFactorWorkers);
    minWorkers = Math.min(minWorkers, 8);

    // Remote Harvester nur spawnen, wenn Container in W7N1 fertig sind
    let targetRoom = 'W7N1';
    let remoteSources = Memory.remoteSources && Memory.remoteSources[targetRoom] ? Memory.remoteSources[targetRoom].length : 2;
    let minRemoteHarvesters = 0;
    if (room.controller.level >= 3 && Game.rooms[targetRoom]) {
        let remoteContainers = Game.rooms[targetRoom].find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }).length;
        if (remoteContainers >= remoteSources) { // Erst spawnen, wenn Containeranzahl = Quellenanzahl
            minRemoteHarvesters = remoteSources; // 2 für W7N1
        }
    }

    let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;
    let towerSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;

    Memory.rooms[room.name].minHarvesters = minHarvesters;
    Memory.rooms[room.name].minHaulers = minHaulers;
    Memory.rooms[room.name].minWorkers = minWorkers;
    Memory.rooms[room.name].minRemoteHarvesters = minRemoteHarvesters;

    if (room.controller.level >= 2) {
        let extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length;
        let extensionSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length;
        let maxExtensions = room.controller.level === 2 ? 5 : 10;

        if (extensions + extensionSites < maxExtensions && room.energyAvailable >= 50) {
            let spawn = room.find(FIND_MY_SPAWNS)[0];
            if (spawn) {
                let positions = [
                    { x: spawn.pos.x - 2, y: spawn.pos.y },
                    { x: spawn.pos.x + 2, y: spawn.pos.y },
                    { x: spawn.pos.x, y: spawn.pos.y - 2 },
                    { x: spawn.pos.x, y: spawn.pos.y + 2 },
                    { x: spawn.pos.x - 2, y: spawn.pos.y - 2 },
                    { x: spawn.pos.x + 2, y: spawn.pos.y - 2 },
                    { x: spawn.pos.x - 2, y: spawn.pos.y + 2 },
                    { x: spawn.pos.x + 2, y: spawn.pos.y + 2 },
                    { x: spawn.pos.x - 4, y: spawn.pos.y },
                    { x: spawn.pos.x + 4, y: spawn.pos.y }
                ];

                for (let pos of positions) {
                    let terrain = room.lookForAt(LOOK_TERRAIN, pos.x, pos.y)[0];
                    let structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                    let sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                    if (terrain !== 'wall' && !structures.length && !sites.length && extensions + extensionSites < maxExtensions) {
                        room.createConstructionSite(pos.x, pos.y, STRUCTURE_EXTENSION);
                        extensionSites++;
                    }
                }
            }
        }

        if (room.controller.level >= 3 && extensions === 10 && room.energyAvailable >= 600) {
            if (towers + towerSites < 1) {
                let spawn = room.find(FIND_MY_SPAWNS)[0];
                let towerPositions = [
                    { x: spawn.pos.x - 3, y: spawn.pos.y - 3 },
                    { x: spawn.pos.x + 3, y: spawn.pos.y - 3 },
                    { x: spawn.pos.x - 3, y: spawn.pos.y + 3 },
                    { x: spawn.pos.x + 3, y: spawn.pos.y + 3 }
                ];

                for (let pos of towerPositions) {
                    let terrain = room.lookForAt(LOOK_TERRAIN, pos.x, pos.y)[0];
                    let structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                    let sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                    if (terrain !== 'wall' && !structures.length && !sites.length) {
                        room.createConstructionSite(pos.x, pos.y, STRUCTURE_TOWER);
                        break;
                    }
                }
            }
        }

        if (extensions === 10 && !Memory.rooms[room.name].roadsBuiltExtended) {
            let spawn = room.find(FIND_MY_SPAWNS)[0];
            let extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
            extensions.forEach(ext => {
                let pathToSpawn = room.findPath(ext.pos, spawn.pos, { ignoreCreeps: true, swampCost: 1 });
                pathToSpawn.forEach(step => {
                    if (room.lookForAt(LOOK_STRUCTURES, step.x, step.y).length === 0 &&
                        room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y).length === 0) {
                        room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
                    }
                });
            });
            let towersList = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
            towersList.forEach(tower => {
                let pathToSpawn = room.findPath(tower.pos, spawn.pos, { ignoreCreeps: true, swampCost: 1 });
                pathToSpawn.forEach(step => {
                    if (room.lookForAt(LOOK_STRUCTURES, step.x, step.y).length === 0 &&
                        room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y).length === 0) {
                        room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
                    }
                });
            });
            Memory.rooms[room.name].roadsBuiltExtended = true;
        }

        if (room.controller.level >= 3 && extensions === 10 && towers === 1 && !Memory.rooms[room.name].defensesBuilt) {
            let spawn = room.find(FIND_MY_SPAWNS)[0];
            for (let x = spawn.pos.x - 5; x <= spawn.pos.x + 5; x++) {
                for (let y = spawn.pos.y - 5; y <= spawn.pos.y + 5; y++) {
                    if (Math.abs(x - spawn.pos.x) === 5 || Math.abs(y - spawn.pos.y) === 5) {
                        let terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0];
                        let structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                        let sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                        if (terrain !== 'wall' && !structures.length && !sites.length) {
                            room.createConstructionSite(x, y, STRUCTURE_WALL);
                        }
                    }
                }
            }
            let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            containers.forEach(container => {
                let terrain = room.lookForAt(LOOK_TERRAIN, container.pos.x, container.pos.y)[0];
                let structures = room.lookForAt(LOOK_STRUCTURES, container.pos.x, container.pos.y);
                let sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, container.pos.x, container.pos.y);
                if (terrain !== 'wall' && !structures.length && !sites.length) {
                    room.createConstructionSite(container.pos.x, container.pos.y, STRUCTURE_RAMPART);
                }
            });
            Memory.rooms[room.name].defensesBuilt = true;
        }

        if (room.controller.level >= 3 && Game.rooms['W7N1'] && !Memory.rooms[room.name].remoteContainersBuilt) {
            let targetRoom = Game.rooms['W7N1'];
            let sources = targetRoom.find(FIND_SOURCES);
            sources.forEach(source => {
                let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER
                })[0];
                let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER
                })[0];

                if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) {
                    let positions = [
                        { x: source.pos.x, y: source.pos.y + 1 },
                        { x: source.pos.x, y: source.pos.y - 1 },
                        { x: source.pos.x - 1, y: source.pos.y },
                        { x: source.pos.x + 1, y: source.pos.y },
                        { x: source.pos.x - 1, y: source.pos.y + 1 },
                        { x: source.pos.x + 1, y: source.pos.y + 1 },
                        { x: source.pos.x - 1, y: source.pos.y - 1 },
                        { x: source.pos.x + 1, y: source.pos.y - 1 }
                    ];

                    for (let pos of positions) {
                        let terrain = targetRoom.lookForAt(LOOK_TERRAIN, pos.x, pos.y)[0];
                        let structures = targetRoom.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                        let sites = targetRoom.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);

                        if (terrain !== 'wall' && !structures.length && !sites.length) {
                            targetRoom.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
                            break;
                        }
                    }
                }
            });
            Memory.rooms[room.name].remoteContainersBuilt = true;
        }

        if (extensions === 5 && !Memory.rooms[room.name].roadsBuilt) {
            let spawn = room.find(FIND_MY_SPAWNS)[0];
            let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            containers.forEach(container => {
                let pathToSpawn = room.findPath(container.pos, spawn.pos, { ignoreCreeps: true, swampCost: 1 });
                pathToSpawn.forEach(step => {
                    if (room.lookForAt(LOOK_STRUCTURES, step.x, step.y).length === 0 &&
                        room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y).length === 0) {
                        room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
                    }
                });

                let pathToController = room.findPath(container.pos, room.controller.pos, { ignoreCreeps: true, swampCost: 1 });
                pathToController.forEach(step => {
                    if (room.lookForAt(LOOK_STRUCTURES, step.x, step.y).length === 0 &&
                        room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y).length === 0) {
                        room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
                    }
                });
            });
            Memory.rooms[room.name].roadsBuilt = true;
        }
    }

    if (room.controller.level >= 2) {
        let sources = room.find(FIND_SOURCES);
        sources.forEach(source => {
            let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0];
            let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0];

            if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) {
                let positions = [
                    { x: source.pos.x, y: source.pos.y + 1 },
                    { x: source.pos.x, y: source.pos.y - 1 },
                    { x: source.pos.x - 1, y: source.pos.y },
                    { x: source.pos.x + 1, y: source.pos.y },
                    { x: source.pos.x - 1, y: source.pos.y + 1 },
                    { x: source.pos.x + 1, y: source.pos.y + 1 },
                    { x: source.pos.x - 1, y: source.pos.y - 1 },
                    { x: source.pos.x + 1, y: source.pos.y - 1 }
                ];

                for (let pos of positions) {
                    let terrain = room.lookForAt(LOOK_TERRAIN, pos.x, pos.y)[0];
                    let structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                    let sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);

                    if (terrain !== 'wall' && !structures.length && !sites.length) {
                        room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
                        break;
                    }
                }
            }
        });
    }

    let creeps = _.filter(Game.creeps, (c) => c.room.name === room.name);
    let harvesters = _.countBy(creeps, 'memory.role').harvester || 0;
    let haulers = _.countBy(creeps, 'memory.role').hauler || 0;
    let workers = _.countBy(creeps, 'memory.role').worker || 0;
    let remoteHarvesters = _.countBy(creeps, 'memory.role').remoteHarvester || 0;

    let spawn = room.find(FIND_MY_SPAWNS)[0];
    if (spawn && !spawn.spawning && room.energyAvailable >= 200) {
        let harvestersList = _.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === room.name);
        let dyingHarvester = harvestersList.find(h => h.ticksToLive < 30);
        if (haulers < Memory.rooms[room.name].minHaulers) {
            spawnCreep(spawn, 'hauler');
        } else if (harvesters < minHarvesters && (dyingHarvester || harvesters < minHarvesters) && !Memory.rooms[room.name].harvesterSpawnedThisTick) {
            spawnCreep(spawn, 'harvester');
            Memory.rooms[room.name].harvesterSpawnedThisTick = true;
        } else if (remoteHarvesters < Memory.rooms[room.name].minRemoteHarvesters) {
            spawnCreep(spawn, 'remoteHarvester');
        } else if (workers < Memory.rooms[room.name].minWorkers) {
            spawnCreep(spawn, 'worker');
        }
    }

    Memory.rooms[room.name].harvesterSpawnedThisTick = false;
}

function spawnCreep(spawn, role) {
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
    }

    spawn.spawnCreep(body, name, { memory: memory });
}