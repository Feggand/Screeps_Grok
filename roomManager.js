var spawnCreeps = require('spawnCreeps');

module.exports = {
    manageRoom: function(room) {
        let roomMemory = Memory.rooms[room.name];

        if (roomMemory.isMyRoom) {
            // Hauptraum-Management
            let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            let fullestContainerEnergy = containers.length ? _.max(containers, c => c.store[RESOURCE_ENERGY]).store[RESOURCE_ENERGY] : 0;
            let containerLoadFactorWorkers = Math.floor(fullestContainerEnergy / 500);
            let containerLoadFactorHaulers = Math.floor(fullestContainerEnergy / 1000);

            roomMemory.minHaulers = Math.min(roomMemory.minHaulers + containerLoadFactorHaulers, 4);

            let constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
            let damagedStructures = room.find(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax
            }).length;
            let extraWorkersNeeded = (constructionSites > 0 ? 1 : 0) + (damagedStructures > 0 ? 1 : 0);
            roomMemory.minWorkers = fullestContainerEnergy < 500 ? 4 : Math.max(6, 1 + extraWorkersNeeded + containerLoadFactorWorkers);
            roomMemory.minWorkers = Math.min(roomMemory.minWorkers, 8);

            let targetRoom = 'W7N1';
            let remoteSources = Memory.rooms[targetRoom] ? Memory.rooms[targetRoom].sources : 2;
            if (room.controller.level >= 3 && Game.rooms[targetRoom]) {
                let remoteContainers = Game.rooms[targetRoom].find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }).length;
                if (remoteContainers >= remoteSources) {
                    roomMemory.minRemoteHarvesters = remoteSources;
                }
            }
            if (!roomMemory.remoteRooms.includes(targetRoom)) {
                roomMemory.remoteRooms.push(targetRoom);
            }

            let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;
            let towerSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;

            // Creep-Zählung basierend auf homeRoom
            let creeps = _.filter(Game.creeps, (c) => c.memory.homeRoom === room.name || (!c.memory.homeRoom && c.room.name === room.name));
            let harvesters = _.countBy(creeps, 'memory.role').harvester || 0;
            let haulers = _.countBy(creeps, 'memory.role').hauler || 0;
            let workers = _.countBy(creeps, 'memory.role').worker || 0;
            let remoteHarvesters = _.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name).length;

            // Debug-Logs
            console.log(`Room ${room.name}: Harvesters=${harvesters}/${roomMemory.minHarvesters}, Haulers=${haulers}/${roomMemory.minHaulers}, Workers=${workers}/${roomMemory.minWorkers}, RemoteHarvesters=${remoteHarvesters}/${roomMemory.minRemoteHarvesters}, Energy=${room.energyAvailable}`);

            // Scout- und RemoteHarvester-Logik für alle Remote-Räume
            let spawn = room.find(FIND_MY_SPAWNS)[0];
            if (room.controller.level >= 3 && spawn && !spawn.spawning && room.energyAvailable >= 50) {
                for (let remoteRoomName of roomMemory.remoteRooms) {
                    let remoteRoomMemory = Memory.rooms[remoteRoomName];
                    let scouts = _.filter(Game.creeps, c => c.memory.role === 'scout' && c.memory.targetRoom === remoteRoomName);
                    if (remoteRoomMemory.needsScout && (scouts.length === 0 || (scouts.length === 1 && scouts[0].ticksToLive < 60))) {
                        spawnCreeps.spawn(spawn, 'scout', remoteRoomName, room.name);
                    }
                }
            }

            if (spawn && !spawn.spawning && room.energyAvailable >= 200) {
                let harvestersList = _.filter(Game.creeps, c => c.memory.role === 'harvester' && (c.memory.homeRoom === room.name || (!c.memory.homeRoom && c.room.name === room.name)));
                let dyingHarvester = harvestersList.find(h => h.ticksToLive < 30);
                // Priorität: Harvester > Worker > RemoteHarvester > Hauler
                if (harvesters < roomMemory.minHarvesters && (dyingHarvester || harvesters < roomMemory.minHarvesters) && !roomMemory.harvesterSpawnedThisTick) {
                    spawnCreeps.spawn(spawn, 'harvester', null, room.name);
                    roomMemory.harvesterSpawnedThisTick = true;
                    console.log(`Spawning Harvester in ${room.name}`);
                } else if (workers < roomMemory.minWorkers) {
                    spawnCreeps.spawn(spawn, 'worker', null, room.name);
                    console.log(`Spawning Worker in ${room.name}`);
                } else if (remoteHarvesters < roomMemory.minRemoteHarvesters) {
                    spawnCreeps.spawn(spawn, 'remoteHarvester', null, room.name);
                    console.log(`Spawning RemoteHarvester in ${room.name}`);
                } else if (haulers < roomMemory.minHaulers) {
                    spawnCreeps.spawn(spawn, 'hauler', null, room.name);
                    console.log(`Spawning Hauler in ${room.name}`);
                }
            }

            if (room.controller.level >= 2) {
                let extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length;
                let extensionSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length;
                let maxExtensions = room.controller.level === 2 ? 5 : 10;

                if (extensions + extensionSites < maxExtensions && room.energyAvailable >= 50) {
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

                if (extensions === 10 && !roomMemory.roadsBuiltExtended) {
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
                    roomMemory.roadsBuiltExtended = true;
                }

                if (room.controller.level >= 3 && extensions === 10 && towers === 1 && !roomMemory.defensesBuilt) {
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
                    roomMemory.defensesBuilt = true;
                }

                if (room.controller.level >= 3 && Game.rooms['W7N1'] && !roomMemory.remoteContainersBuilt) {
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
                    roomMemory.remoteContainersBuilt = true;
                }

                if (extensions === 5 && !roomMemory.roadsBuilt) {
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
                    roomMemory.roadsBuilt = true;
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

            roomMemory.harvesterSpawnedThisTick = false;
        } else {
            // Remote-Raum-Management
            if (Game.time % 10 === 0 && roomMemory.needsHarvesters && roomMemory.containers < roomMemory.sources && room.energyAvailable >= 50) {
                let sources = room.find(FIND_SOURCES);
                sources.forEach(source => {
                    let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                    let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                    if (!nearbyContainer && !nearbySite) {
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
        }
    }
};