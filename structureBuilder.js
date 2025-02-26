// structureBuilder.js
var logger = require('logger');

module.exports = {
    buildStructures: function(room) {
        let roomMemory = Memory.rooms[room.name] || {};
        if (!roomMemory.isMyRoom) {
            this.buildRemoteStructures(room);
            return;
        }

        let spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        if (room.controller.level >= 2) {
            this.buildExtensions(room, spawn);
            this.buildContainers(room);
            this.buildControllerContainer(room);
            this.buildRoads(room, spawn);
        }
        if (room.controller.level >= 3) {
            this.buildTowers(room, spawn);
            this.buildRemoteContainers(room);
            this.buildDefenses(room, spawn);
        }
        if (room.controller.level >= 4) {
            this.buildStorage(room, spawn);
        }
        if (room.controller.level >= 5) {
            this.buildLinks(room);
        }
    },

    buildExtensions: function(room, spawn) {
        let extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length;
        let extensionSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length;
        let maxExtensions;
        switch (room.controller.level) {
            case 2: maxExtensions = 5; break;
            case 3: maxExtensions = 10; break;
            case 4: maxExtensions = 20; break;
            case 5: maxExtensions = 30; break;
            default: maxExtensions = 20; // Fallback für höhere Level
        }

        logger.info('Extensions in ' + room.name + ': ' + extensions + ' built, ' + extensionSites + ' sites, max ' + maxExtensions);
        if (extensions + extensionSites < maxExtensions && room.energyAvailable >= 50) {
            let placed = 0;
            const maxDistance = 5;

            for (let dx = -maxDistance; dx <= maxDistance && placed < (maxExtensions - extensions - extensionSites); dx++) {
                for (let dy = -maxDistance; dy <= maxDistance && placed < (maxExtensions - extensions - extensionSites); dy++) {
                    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) continue;

                    let x = spawn.pos.x + dx;
                    let y = spawn.pos.y + dy;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance > 2 && distance <= maxDistance && x >= 0 && x < 50 && y >= 0 && y < 50) {
                        if (this.canPlaceStructure(room, x, y)) {
                            room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
                            logger.info('Placed extension at ' + x + ',' + y + ' in ' + room.name);
                            placed++;
                        } else {
                            logger.warn('Position ' + x + ',' + y + ' blocked for extension in ' + room.name);
                        }
                    }
                }
            }

            if (extensions + extensionSites + placed >= maxExtensions) {
                logger.info('Max extensions reached in ' + room.name);
            } else if (placed === 0) {
                logger.warn('No valid positions found for new extensions in ' + room.name);
            }
        } else {
            logger.info('No new extensions needed in ' + room.name + ' or insufficient energy');
        }
    },

    buildStorage: function(room, spawn) {
        let storage = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0];
        let storageSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_STORAGE }).length;
        logger.info('Storage in ' + room.name + ': ' + (storage ? 1 : 0) + ' built, ' + storageSites + ' sites');
        if (!storage && storageSites === 0 && room.energyAvailable >= 150) {
            let pos = { x: spawn.pos.x, y: spawn.pos.y + 3 };
            if (this.canPlaceStructure(room, pos.x, pos.y)) {
                room.createConstructionSite(pos.x, pos.y, STRUCTURE_STORAGE);
                logger.info('Placed storage at ' + pos.x + ',' + pos.y + ' in ' + room.name);
            } else {
                logger.warn('Storage position ' + pos.x + ',' + pos.y + ' blocked in ' + room.name);
            }
        }
    },

    buildContainers: function(room) {
        let sources = room.find(FIND_SOURCES);
        sources.forEach(source => {
            let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
            let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
            if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) {
                this.placeContainerNear(room, source.pos);
            }
        });
    },

    buildControllerContainer: function(room) {
        if (!room.controller || !room.controller.my) return;

        let containersNearController = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        let constructionSitesNearController = room.controller.pos.findInRange(FIND_CONSTRUCTION_SITES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });

        if (containersNearController.length > 0 || constructionSitesNearController.length > 0) {
            logger.info('Room ' + room.name + ': Container or construction site already exists near controller');
            return;
        }

        let pos = null;
        for (let dx = -3; dx <= 3 && !pos; dx++) {
            for (let dy = -3; dy <= 3 && !pos; dy++) {
                let x = room.controller.pos.x + dx;
                let y = room.controller.pos.y + dy;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= 3 && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    if (this.canPlaceStructure(room, x, y)) {
                        pos = new RoomPosition(x, y, room.name);
                        break;
                    }
                }
            }
        }

        if (pos && room.energyAvailable >= 50) {
            let result = room.createConstructionSite(pos, STRUCTURE_CONTAINER);
            if (result === OK) {
                logger.info('Room ' + room.name + ': Placed controller container construction site at ' + pos);
            } else {
                logger.error('Room ' + room.name + ': Failed to place controller container at ' + pos + ': ' + result);
            }
        } else if (!pos) {
            logger.warn('Room ' + room.name + ': No valid position found for controller container');
        } else {
            logger.info('Room ' + room.name + ': Insufficient energy for controller container');
        }
    },

    buildRoads: function(room, spawn) {
        let roomMemory = Memory.rooms[room.name];
        if (!roomMemory.roadsBuilt) {
            let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            containers.forEach(container => {
                this.buildPath(room, container.pos, spawn.pos);
                this.buildPath(room, container.pos, room.controller.pos);
            });
            roomMemory.roadsBuilt = true;
            logger.info('Built initial roads in ' + room.name);
        }
        if (room.controller.level >= 3 && !roomMemory.roadsBuiltExtended) {
            let extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
            extensions.forEach(ext => this.buildPath(room, ext.pos, spawn.pos));
            let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
            towers.forEach(tower => this.buildPath(room, tower.pos, spawn.pos));
            roomMemory.roadsBuiltExtended = true;
            logger.info('Built extended roads in ' + room.name);
        }
    },

    buildTowers: function(room, spawn) {
        let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;
        let towerSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_TOWER }).length;
        let maxTowers = room.controller.level >= 5 ? 2 : 1;

        logger.info('Towers in ' + room.name + ': ' + towers + ' built, ' + towerSites + ' sites, max ' + maxTowers + ', energy available: ' + room.energyAvailable);
        if (towers + towerSites < maxTowers && room.energyAvailable >= 600) {
            const maxDistance = 5;
            let placed = false;

            for (let dx = -maxDistance; dx <= maxDistance && !placed; dx++) {
                for (let dy = -maxDistance; dy <= maxDistance && !placed; dy++) {
                    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

                    let x = spawn.pos.x + dx;
                    let y = spawn.pos.y + dy;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance >= 2 && distance <= maxDistance && x >= 0 && x < 50 && y >= 0 && y < 50) {
                        if (this.canPlaceStructure(room, x, y)) {
                            room.createConstructionSite(x, y, STRUCTURE_TOWER);
                            logger.info('Placed tower at ' + x + ',' + y + ' in ' + room.name);
                            placed = true;
                        } else {
                            logger.warn('Position ' + x + ',' + y + ' blocked for tower in ' + room.name);
                        }
                    }
                }
            }

            if (!placed) {
                logger.warn('No valid position found for new tower in ' + room.name);
            }
        } else {
            logger.info('No new towers needed in ' + room.name + ' or insufficient energy/conditions not met');
        }
    },

    buildLinks: function(room) {
        let links = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }).length;
        let linkSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_LINK }).length;
        let maxLinks = room.controller.level >= 5 ? 2 : 0;

        logger.info('Links in ' + room.name + ': ' + links + ' built, ' + linkSites + ' sites, max ' + maxLinks + ', energy available: ' + room.energyAvailable);
        if (links + linkSites < maxLinks && room.energyAvailable >= 300) {
            let placed = false;

            // Sender-Link nahe dem Storage
            let storage = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0];
            if (!placed && storage) {
                const storagePos = storage.pos;
                for (let dx = -1; dx <= 1 && !placed; dx++) {
                    for (let dy = -1; dy <= 1 && !placed; dy++) {
                        if (dx === 0 && dy === 0) continue; // Überspringe die Storage-Position selbst
                        let x = storagePos.x + dx;
                        let y = storagePos.y + dy;
                        if (x >= 0 && x < 50 && y >= 0 && y < 50 && this.canPlaceStructure(room, x, y)) {
                            room.createConstructionSite(x, y, STRUCTURE_LINK);
                            logger.info('Placed storage link (sender) at ' + x + ',' + y + ' in ' + room.name);
                            placed = true;
                        } else {
                            logger.warn('Position ' + x + ',' + y + ' blocked for storage link in ' + room.name);
                        }
                    }
                }
            }

            // Receiver-Link nahe dem Controller-Container
            if (links + linkSites === 1 && !placed) { // Nur platzieren, wenn der erste Link existiert
                let controllerContainer = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER
                })[0];
                if (controllerContainer) {
                    const containerPos = controllerContainer.pos;
                    for (let dx = -1; dx <= 1 && !placed; dx++) {
                        for (let dy = -1; dy <= 1 && !placed; dy++) {
                            if (dx === 0 && dy === 0) continue; // Überspringe die Container-Position selbst
                            let x = containerPos.x + dx;
                            let y = containerPos.y + dy;
                            if (x >= 0 && x < 50 && y >= 0 && y < 50 && this.canPlaceStructure(room, x, y)) {
                                room.createConstructionSite(x, y, STRUCTURE_LINK);
                                logger.info('Placed controller link (receiver) at ' + x + ',' + y + ' in ' + room.name);
                                placed = true;
                            } else {
                                logger.warn('Position ' + x + ',' + y + ' blocked for controller link in ' + room.name);
                            }
                        }
                    }
                }
            }

            if (!placed) {
                logger.warn('No valid position found for new link in ' + room.name);
            }
        } else {
            logger.info('No new links needed in ' + room.name + ' or insufficient energy/conditions not met');
        }
    },

    buildDefenses: function(room, spawn) {
        let roomMemory = Memory.rooms[room.name];
        if (!roomMemory.defensesBuilt) {
            for (let x = spawn.pos.x - 5; x <= spawn.pos.x + 5; x++) {
                for (let y = spawn.pos.y - 5; y <= spawn.pos.y + 5; y++) {
                    if (Math.abs(x - spawn.pos.x) === 5 || Math.abs(y - spawn.pos.y) === 5) {
                        if (this.canPlaceStructure(room, x, y)) {
                            room.createConstructionSite(x, y, STRUCTURE_WALL);
                        }
                    }
                }
            }
            let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            containers.forEach(container => {
                if (this.canPlaceStructure(room, container.pos.x, container.pos.y)) {
                    room.createConstructionSite(container.pos.x, container.pos.y, STRUCTURE_RAMPART);
                }
            });
            roomMemory.defensesBuilt = true;
            logger.info('Built defenses in ' + room.name);
        }
    },

    buildRemoteContainers: function(room) {
        let roomMemory = Memory.rooms[room.name];
        if (!roomMemory.remoteContainersBuilt && room.controller.level >= 3) {
            let targetRoomName = roomMemory.remoteRooms[0];
            let targetRoom = Game.rooms[targetRoomName];
            if (targetRoom) {
                let sources = targetRoom.find(FIND_SOURCES);
                sources.forEach(source => {
                    let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                    let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                    if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) {
                        this.placeContainerNear(targetRoom, source.pos);
                    }
                });
                roomMemory.remoteContainersBuilt = true;
                logger.info('Built remote containers in ' + targetRoomName);
            }
        }
    },

    buildRemoteStructures: function(room) {
        let roomMemory = Memory.rooms[room.name];
        if (Game.time % 10 === 0 && roomMemory.needsHarvesters && roomMemory.containers < roomMemory.sources && room.energyAvailable >= 50) {
            let sources = room.find(FIND_SOURCES);
            sources.forEach(source => {
                let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                if (!nearbyContainer && !nearbySite) {
                    this.placeContainerNear(room, source.pos);
                }
            });
        }
    },

    canPlaceStructure: function(room, x, y) {
        let terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0];
        let structures = room.lookForAt(LOOK_STRUCTURES, x, y);
        let sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
        return terrain !== 'wall' && !structures.length && !sites.length;
    },

    placeContainerNear: function(room, pos) {
        let positions = [
            { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 },
            { x: pos.x - 1, y: pos.y }, { x: pos.x + 1, y: pos.y }
        ];
        for (let p of positions) {
            if (this.canPlaceStructure(room, p.x, p.y)) {
                room.createConstructionSite(p.x, p.y, STRUCTURE_CONTAINER);
                logger.info('Placed container at ' + p.x + ',' + p.y + ' in ' + room.name);
                break;
            }
        }
    },

    buildPath: function(room, fromPos, toPos) {
        let path = room.findPath(fromPos, toPos, { ignoreCreeps: true, swampCost: 1 });
        path.forEach(step => {
            if (room.lookForAt(LOOK_STRUCTURES, step.x, step.y).length === 0 &&
                room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y).length === 0) {
                room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
            }
        });
    }
};