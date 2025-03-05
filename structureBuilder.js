// structureBuilder.js
// Modul zum Bau von Strukturen in Räumen basierend auf Controller-Level und verfügbarer Energie

var logger = require('logger'); // Importiert Logging-Modul für Protokollierung

module.exports = {
    buildStructures: function(room, cachedData) {
        let roomMemory = Memory.rooms[room.name] || {};
        if (!roomMemory.isMyRoom) {
            this.buildRemoteStructures(room);
            return;
        }

        let spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;

        // Cached Daten aus Memory nutzen, falls verfügbar, oder neu abrufen
        let localCachedData = roomMemory.cachedStructures || {};
        if (!localCachedData.lastUpdate || Game.time - localCachedData.lastUpdate >= 10) { // Aktualisiere alle 10 Ticks
            localCachedData = {
                structures: room.find(FIND_STRUCTURES), // Cached Strukturen im Raum
                constructionSites: room.find(FIND_CONSTRUCTION_SITES), // Cached Baustellen
                sources: room.find(FIND_SOURCES), // Cached Quellen
                lastUpdate: Game.time // Zeitstempel der letzten Aktualisierung
            };
            roomMemory.cachedStructures = localCachedData; // Speichere im Memory
            logger.info(`Updated cached data for ${room.name} at tick ${Game.time}`);
        }

        if (room.controller.level >= 2) {
            this.buildExtensions(room, spawn, localCachedData);
            this.buildContainers(room, localCachedData);
            this.buildControllerContainer(room, localCachedData); // Nutze lokale Cached Daten
            this.buildRoads(room, spawn, localCachedData);
        }
        if (room.controller.level >= 3) {
            this.buildTowers(room, spawn, localCachedData);
            this.buildRemoteContainers(room, localCachedData);
            this.buildDefenses(room, spawn, localCachedData);
        }
        if (room.controller.level >= 4) {
            this.buildStorage(room, spawn, localCachedData);
        }
        if (room.controller.level >= 5) {
            this.buildLinks(room, localCachedData);
        }
        if (room.controller.level >= 6) {
            this.buildExtractor(room, localCachedData);
            this.buildLabs(room, spawn, localCachedData);
            this.buildRemoteExtractors(room, localCachedData);
            this.buildRoadsToExtractors(room, localCachedData);
        }
    },

    buildExtensions: function(room, spawn, cachedData) {
        let extensions = cachedData.structures.filter(s => s.structureType === STRUCTURE_EXTENSION).length; // Nutzt cached Strukturen
        let extensionSites = cachedData.constructionSites.filter(s => s.structureType === STRUCTURE_EXTENSION).length; // Nutzt cached Baustellen
        let maxExtensions;
        switch (room.controller.level) {
            case 2: maxExtensions = 5; break;
            case 3: maxExtensions = 10; break;
            case 4: maxExtensions = 20; break;
            case 5: maxExtensions = 30; break;
            case 6: maxExtensions = 40; break;
            case 7: maxExtensions = 50; break;
            case 8: maxExtensions = 60; break;
            default: maxExtensions = 0;
        }

        logger.info(`Extensions in ${room.name}: ${extensions} built, ${extensionSites} sites, max ${maxExtensions}`);
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
                        if (this.canPlaceStructure(room, x, y, cachedData)) {
                            room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
                            logger.info(`Placed extension at ${x},${y} in ${room.name}`);
                            placed++;
                        } else {
                            logger.warn(`Position ${x},${y} blocked for extension in ${room.name}`);
                        }
                    }
                }
            }

            if (extensions + extensionSites + placed >= maxExtensions) {
                logger.info(`Max extensions reached in ${room.name}`);
            } else if (placed === 0) {
                logger.warn(`No valid positions found for new extensions in ${room.name}`);
            }
        } else {
            logger.info(`No new extensions needed in ${room.name} or insufficient energy`);
        }
    },

    buildStorage: function(room, spawn, cachedData) {
        let storage = cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE); // Nutzt cached Strukturen
        let storageSites = cachedData.constructionSites.filter(s => s.structureType === STRUCTURE_STORAGE).length; // Nutzt cached Baustellen
        logger.info(`Storage in ${room.name}: ${storage ? 1 : 0} built, ${storageSites} sites`);
        if (!storage && storageSites === 0 && room.energyAvailable >= 150) {
            let pos = { x: spawn.pos.x, y: spawn.pos.y + 3 };
            if (this.canPlaceStructure(room, pos.x, pos.y, cachedData)) {
                room.createConstructionSite(pos.x, pos.y, STRUCTURE_STORAGE);
                logger.info(`Placed storage at ${pos.x},${pos.y} in ${room.name}`);
            } else {
                logger.warn(`Storage position ${pos.x},${pos.y} blocked in ${room.name}`);
            }
        }
    },

    buildContainers: function(room, cachedData) {
        let sources = cachedData.sources; // Nutzt cached Quellen
        sources.forEach(source => {
            // Filtert gecachte Strukturen und Baustellen basierend auf der Nähe zu source.pos
            let nearbyContainers = cachedData.structures.filter(s => 
                s.structureType === STRUCTURE_CONTAINER && 
                this.getChebyshevDistance(s.pos, source.pos) <= 1
            );
            let nearbySites = cachedData.constructionSites.filter(s => 
                s.structureType === STRUCTURE_CONTAINER && 
                this.getChebyshevDistance(s.pos, source.pos) <= 1
            );
            let nearbyContainer = nearbyContainers[0]; // Erster passender Container
            let nearbySite = nearbySites[0]; // Erste passende Baustelle
            if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) {
                this.placeContainerNear(room, source.pos, cachedData);
            }
        });
    },

    buildControllerContainer: function(room, cachedData) {
        if (!room.controller || !room.controller.my) return;

        // Fallback, falls cachedData nicht definiert ist
        let structures = cachedData ? cachedData.structures : room.find(FIND_STRUCTURES);
        let constructionSites = cachedData ? cachedData.constructionSites : room.find(FIND_CONSTRUCTION_SITES);

        let containersNearController = room.controller.pos.findInRange(structures, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        let constructionSitesNearController = room.controller.pos.findInRange(constructionSites, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });

        if (containersNearController.length > 0 || constructionSitesNearController.length > 0) {
            logger.info(`Room ${room.name}: Container or construction site already exists near controller`);
            return;
        }

        let pos = null;
        for (let dx = -3; dx <= 3 && !pos; dx++) {
            for (let dy = -3; dy <= 3 && !pos; dy++) {
                let x = room.controller.pos.x + dx;
                let y = room.controller.pos.y + dy;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= 3 && x >= 0 && x < 50 && y >= 0 && y < 50) {
                    if (this.canPlaceStructure(room, x, y, cachedData)) {
                        pos = new RoomPosition(x, y, room.name);
                        break;
                    }
                }
            }
        }

        if (pos && room.energyAvailable >= 50) {
            let result = room.createConstructionSite(pos, STRUCTURE_CONTAINER);
            if (result === OK) {
                logger.info(`Room ${room.name}: Placed controller container construction site at ${pos}`);
            } else {
                logger.error(`Room ${room.name}: Failed to place controller container at ${pos}: ${result}`);
            }
        } else if (!pos) {
            logger.warn(`Room ${room.name}: No valid position found for controller container`);
        } else {
            logger.info(`Room ${room.name}: Insufficient energy for controller container`);
        }
    },

    buildRoads: function(room, spawn, cachedData) {
        let roomMemory = Memory.rooms[room.name];
        if (!roomMemory.roadsBuilt) {
            let containers = cachedData.structures.filter(s => s.structureType === STRUCTURE_CONTAINER); // Nutzt cached Strukturen
            containers.forEach(container => {
                this.buildPath(room, container.pos, spawn.pos, cachedData);
                this.buildPath(room, container.pos, room.controller.pos, cachedData);
            });
            roomMemory.roadsBuilt = true;
            logger.info('Built initial roads in ' + room.name);
        }
        if (room.controller.level >= 3 && !roomMemory.roadsBuiltExtended) {
            let extensions = cachedData.structures.filter(s => s.structureType === STRUCTURE_EXTENSION); // Nutzt cached Strukturen
            extensions.forEach(ext => this.buildPath(room, ext.pos, spawn.pos, cachedData));
            let towers = cachedData.structures.filter(s => s.structureType === STRUCTURE_TOWER); // Nutzt cached Strukturen
            towers.forEach(tower => this.buildPath(room, tower.pos, spawn.pos, cachedData));
            roomMemory.roadsBuiltExtended = true;
            logger.info('Built extended roads in ' + room.name);
        }

        if (room.controller.level >= 4 && !roomMemory.roadsToRemoteBuilt) {
            let storage = cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE); // Nutzt cached Strukturen
            if (storage && roomMemory.remoteRooms && roomMemory.remoteRooms.length > 0) {
                roomMemory.remoteRooms.forEach(remoteRoomName => {
                    let remoteRoom = Game.rooms[remoteRoomName];
                    if (remoteRoom) {
                        let remoteContainers = remoteRoom.find(FIND_STRUCTURES, {
                            filter: s => s.structureType === STRUCTURE_CONTAINER
                        });
                        remoteContainers.forEach(container => {
                            this.buildPathAcrossRooms(room, storage.pos, container.pos, remoteRoomName, cachedData);
                        });
                        logger.info(`Built roads from storage in ${room.name} to containers in ${remoteRoomName}`);
                    } else {
                        logger.warn(`Remote room ${remoteRoomName} not visible, skipping road construction`);
                    }
                });
                roomMemory.roadsToRemoteBuilt = true;
            } else if (!storage) {
                logger.warn(`No storage found in ${room.name}, cannot build roads to remote containers`);
            } else if (!roomMemory.remoteRooms) {
                logger.warn(`No remote rooms defined in ${room.name} memory, skipping remote roads`);
            }
        }
    },

    buildRoadsToExtractors: function(room, cachedData) {
        let roomMemory = Memory.rooms[room.name];
        if (roomMemory.roadsToExtractorsBuilt) return;

        let storage = cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE); // Nutzt cached Strukturen
        if (!storage) {
            logger.warn(`No storage found in ${room.name}, cannot build roads to extractors`);
            return;
        }

        let builtRoads = false;

        // Straßen zu Extractoren im Hauptraum
        let localExtractors = cachedData.structures.filter(s => s.structureType === STRUCTURE_EXTRACTOR); // Nutzt cached Strukturen
        localExtractors.forEach(extractor => {
            this.buildPath(room, storage.pos, extractor.pos, cachedData);
            logger.info(`Built road from storage to extractor at ${extractor.pos} in ${room.name}`);
            builtRoads = true;
        });

        // Straßen zu Extractoren in Nebenräumen
        if (roomMemory.remoteRooms && roomMemory.remoteRooms.length > 0) {
            roomMemory.remoteRooms.forEach(remoteRoomName => {
                let remoteRoom = Game.rooms[remoteRoomName];
                if (remoteRoom) {
                    let remoteExtractors = remoteRoom.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_EXTRACTOR
                    });
                    remoteExtractors.forEach(extractor => {
                        this.buildPathAcrossRooms(room, storage.pos, extractor.pos, remoteRoomName, cachedData);
                        logger.info(`Built road from storage in ${room.name} to extractor at ${extractor.pos} in ${remoteRoomName}`);
                        builtRoads = true;
                    });
                } else {
                    logger.warn(`Remote room ${remoteRoomName} not visible, skipping road construction to extractors`);
                }
            });
        }

        if (builtRoads) {
            roomMemory.roadsToExtractorsBuilt = true;
            logger.info(`Completed building roads to extractors in ${room.name} and its remote rooms`);
        } else {
            logger.info(`No extractors found to build roads to in ${room.name} or its remote rooms`);
        }
    },

    buildTowers: function(room, spawn, cachedData) {
        let towers = cachedData.structures.filter(s => s.structureType === STRUCTURE_TOWER).length; // Nutzt cached Strukturen
        let towerSites = cachedData.constructionSites.filter(s => s.structureType === STRUCTURE_TOWER).length; // Nutzt cached Baustellen
        let maxTowers = room.controller.level >= 5 ? 2 : 1;

        logger.info(`Towers in ${room.name}: ${towers} built, ${towerSites} sites, max ${maxTowers}, energy available: ${room.energyAvailable}`);
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
                        if (this.canPlaceStructure(room, x, y, cachedData)) {
                            room.createConstructionSite(x, y, STRUCTURE_TOWER);
                            logger.info(`Placed tower at ${x},${y} in ${room.name}`);
                            placed = true;
                        } else {
                            logger.warn(`Position ${x},${y} blocked for tower in ${room.name}`);
                        }
                    }
                }
            }

            if (!placed) {
                logger.warn(`No valid position found for new tower in ${room.name}`);
            }
        } else {
            logger.info(`No new towers needed in ${room.name} or insufficient energy/conditions not met`);
        }
    },

    buildLinks: function(room, cachedData) {
        let links = cachedData.structures.filter(s => s.structureType === STRUCTURE_LINK).length; // Nutzt cached Strukturen
        let linkSites = cachedData.constructionSites.filter(s => s.structureType === STRUCTURE_LINK).length; // Nutzt cached Baustellen
        let maxLinks = room.controller.level >= 6 ? 3 : (room.controller.level >= 5 ? 2 : 0);

        logger.info(`Links in ${room.name}: ${links} built, ${linkSites} sites, max ${maxLinks}, energy available: ${room.energyAvailable}`);
        if (links + linkSites < maxLinks && room.energyAvailable >= 300) {
            let placed = false;

            let storage = cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE); // Nutzt cached Strukturen
            if (links + linkSites === 0 && !placed && storage) {
                const storagePos = storage.pos;
                for (let dx = -1; dx <= 1 && !placed; dx++) {
                    for (let dy = -1; dy <= 1 && !placed; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        let x = storagePos.x + dx;
                        let y = storagePos.y + dy;
                        if (x >= 0 && x < 50 && y >= 0 && y < 50 && this.canPlaceStructure(room, x, y, cachedData)) {
                            room.createConstructionSite(x, y, STRUCTURE_LINK);
                            logger.info(`Placed storage link (sender) at ${x},${y} in ${room.name}`);
                            placed = true;
                        } else {
                            logger.warn(`Position ${x},${y} blocked for storage link in ${room.name}`);
                        }
                    }
                }
            }

            if (links + linkSites === 1 && !placed) {
                let controllerContainer = room.controller.pos.findInRange(cachedData.structures, 3, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER
                })[0];
                if (controllerContainer) {
                    const containerPos = controllerContainer.pos;
                    for (let dx = -1; dx <= 1 && !placed; dx++) {
                        for (let dy = -1; dy <= 1 && !placed; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            let x = containerPos.x + dx;
                            let y = containerPos.y + dy;
                            if (x >= 0 && x < 50 && y >= 0 && y < 50 && this.canPlaceStructure(room, x, y, cachedData)) {
                                room.createConstructionSite(x, y, STRUCTURE_LINK);
                                logger.info(`Placed controller link (receiver) at ${x},${y} in ${room.name}`);
                                placed = true;
                            } else {
                                logger.warn(`Position ${x},${y} blocked for controller link in ${room.name}`);
                            }
                        }
                    }
                }
            }

            if (links + linkSites === 2 && room.controller.level >= 6 && !placed) {
                let sources = cachedData.sources; // Nutzt cached Quellen
                for (let source of sources) {
                    let sourceContainer = source.pos.findInRange(cachedData.structures, 2, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    })[0];
                    if (sourceContainer) {
                        const containerPos = sourceContainer.pos;
                        for (let dx = -1; dx <= 1 && !placed; dx++) {
                            for (let dy = -1; dy <= 1 && !placed; dy++) {
                                if (dx === 0 && dy === 0) continue;
                                let x = containerPos.x + dx;
                                let y = containerPos.y + dy;
                                if (x >= 0 && x < 50 && y >= 0 && y < 50 && this.canPlaceStructure(room, x, y, cachedData)) {
                                    room.createConstructionSite(x, y, STRUCTURE_LINK);
                                    logger.info(`Placed source link at ${x},${y} near source ${source.id} in ${room.name}`);
                                    placed = true;
                                    break;
                                } else {
                                    logger.warn(`Position ${x},${y} blocked for source link in ${room.name}`);
                                }
                            }
                        }
                    }
                    if (placed) break;
                }
            }

            if (!placed) {
                logger.warn(`No valid position found for new link in ${room.name}`);
            }
        } else {
            logger.info(`No new links needed in ${room.name} or insufficient energy/conditions not met`);
        }
    },

    buildDefenses: function(room, spawn, cachedData) {
        let roomMemory = Memory.rooms[room.name];
        if (!roomMemory.defensesBuilt) {
            for (let x = spawn.pos.x - 5; x <= spawn.pos.x + 5; x++) {
                for (let y = spawn.pos.y - 5; y <= spawn.pos.y + 5; y++) {
                    if (Math.abs(x - spawn.pos.x) === 5 || Math.abs(y - spawn.pos.y) === 5) {
                        if (this.canPlaceStructure(room, x, y, cachedData)) {
                            room.createConstructionSite(x, y, STRUCTURE_WALL);
                        }
                    }
                }
            }
            let containers = cachedData.structures.filter(s => s.structureType === STRUCTURE_CONTAINER); // Nutzt cached Strukturen
            containers.forEach(container => {
                if (this.canPlaceStructure(room, container.pos.x, container.pos.y, cachedData)) {
                    room.createConstructionSite(container.pos.x, container.pos.y, STRUCTURE_RAMPART);
                }
            });
            roomMemory.defensesBuilt = true;
            logger.info('Built defenses in ' + room.name);
        }
    },

    buildRemoteContainers: function(room, cachedData) {
        let roomMemory = Memory.rooms[room.name];
        if (!roomMemory.remoteContainersBuilt && room.controller.level >= 3) {
            let targetRoomName = roomMemory.remoteRooms[0];
            let targetRoom = Game.rooms[targetRoomName];
            if (targetRoom) {
                let sources = targetRoom.find(FIND_SOURCES);
                sources.forEach(source => {
                    // Filtert gecachte Strukturen und Baustellen basierend auf der Nähe zu source.pos
                    let nearbyContainers = cachedData.structures.filter(s => 
                        s.structureType === STRUCTURE_CONTAINER && 
                        this.getChebyshevDistance(s.pos, source.pos) <= 1
                    );
                    let nearbySites = cachedData.constructionSites.filter(s => 
                        s.structureType === STRUCTURE_CONTAINER && 
                        this.getChebyshevDistance(s.pos, source.pos) <= 1
                    );
                    let nearbyContainer = nearbyContainers[0]; // Erster passender Container
                    let nearbySite = nearbySites[0]; // Erste passende Baustelle
                    if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) {
                        this.placeContainerNear(targetRoom, source.pos, cachedData);
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
                let nearbyContainer = source.pos.findInRange(room.find(FIND_STRUCTURES), 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                let nearbySite = source.pos.findInRange(room.find(FIND_CONSTRUCTION_SITES), 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
                if (!nearbyContainer && !nearbySite) {
                    this.placeContainerNear(room, source.pos);
                }
            });
        }
    },

    buildExtractor: function(room, cachedData) {
        // Suche nach Mineral mit FIND_MINERALS statt RESOURCE_MINERAL
        let mineral = room.find(FIND_MINERALS)[0]; // Direktes Finden des Minerals im Raum
        let extractor = cachedData.structures.find(s => s.structureType === STRUCTURE_EXTRACTOR); // Nutzt cached Strukturen
        let extractorSites = cachedData.constructionSites.filter(s => s.structureType === STRUCTURE_EXTRACTOR).length; // Nutzt cached Baustellen

        logger.info(`Extractor in ${room.name}: ${extractor ? 1 : 0} built, ${extractorSites} sites`);
        if (!extractor && extractorSites === 0 && room.energyAvailable >= 200 && mineral) {
            let result = room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
            if (result === OK) {
                logger.info(`Placed extractor at ${mineral.pos} in ${room.name}`);
            } else {
                logger.warn(`Failed to place extractor at ${mineral.pos} in ${room.name}: ${result}`);
            }
        } else if (!mineral) {
            logger.warn(`No mineral found in ${room.name} to place an extractor`);
        }
    },

    buildLabs: function(room, spawn, cachedData) {
        let labs = cachedData.structures.filter(s => s.structureType === STRUCTURE_LAB).length; // Nutzt cached Strukturen
        let labSites = cachedData.constructionSites.filter(s => s.structureType === STRUCTURE_LAB).length; // Nutzt cached Baustellen
        let maxLabs = room.controller.level >= 6 ? 3 : 0;

        logger.info(`Labs in ${room.name}: ${labs} built, ${labSites} sites, max ${maxLabs}`);
        if (labs + labSites < maxLabs && room.energyAvailable >= 300) {
            let placed = 0;
            let storage = cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE); // Nutzt cached Strukturen
            if (!storage) {
                logger.warn(`No storage found in ${room.name}, skipping lab placement`);
                return;
            }

            const basePos = storage.pos;
            const positions = [
                { x: basePos.x + 1, y: basePos.y + 1 },
                { x: basePos.x + 2, y: basePos.y + 1 },
                { x: basePos.x + 1, y: basePos.y + 2 }
            ];

            for (let pos of positions) {
                if (labs + labSites + placed >= maxLabs) break;
                if (pos.x >= 0 && pos.x < 50 && pos.y >= 0 && pos.y < 50 && this.canPlaceStructure(room, pos.x, pos.y, cachedData)) {
                    let result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_LAB);
                    if (result === OK) {
                        logger.info(`Placed lab at ${pos.x},${pos.y} in ${room.name}`);
                        placed++;
                    } else {
                        logger.warn(`Failed to place lab at ${pos.x},${pos.y} in ${room.name}: ${result}`);
                    }
                }
            }

            if (placed === 0) {
                logger.warn(`No valid positions found for new labs in ${room.name}`);
            }
        } else {
            logger.info(`No new labs needed in ${room.name} or insufficient energy`);
        }
    },

    buildRemoteExtractors: function(room, cachedData) {
        let roomMemory = Memory.rooms[room.name];
        if (!roomMemory.remoteRooms || roomMemory.remoteRooms.length === 0) return;

        let totalExtractors = cachedData.structures.filter(s => s.structureType === STRUCTURE_EXTRACTOR).length; // Nutzt cached Strukturen
        roomMemory.remoteRooms.forEach(remoteRoomName => {
            let remoteRoom = Game.rooms[remoteRoomName];
            if (remoteRoom && room.energyAvailable >= 200 && totalExtractors < (room.controller.level >= 7 ? 2 : 1)) {
                let mineral = remoteRoom.find(FIND_MINERALS)[0];
                let extractor = remoteRoom.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR })[0];
                let extractorSites = remoteRoom.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length;

                if (!extractor && extractorSites === 0 && mineral) {
                    let result = remoteRoom.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
                    if (result === OK) {
                        logger.info(`Placed extractor at ${mineral.pos} in ${remoteRoomName}`);
                        totalExtractors++;
                    } else {
                        logger.warn(`Failed to place extractor at ${mineral.pos} in ${remoteRoomName}: ${result}`);
                    }
                }
            }
        });
    },

    canPlaceStructure: function(room, x, y, cachedData) {
        let terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0]; // Terrain kann nicht gecacht werden, da es sich nicht ändert
        let structures = cachedData ? cachedData.structures.filter(s => s.pos.x === x && s.pos.y === y).length : room.find(FIND_STRUCTURES, { filter: s => s.pos.x === x && s.pos.y === y }).length; // Nutzt cached Strukturen, Fallback auf find
        let sites = cachedData ? cachedData.constructionSites.filter(s => s.pos.x === x && s.pos.y === y).length : room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.pos.x === x && s.pos.y === y }).length; // Nutzt cached Baustellen, Fallback auf find
        return terrain !== 'wall' && !structures && !sites;
    },

    placeContainerNear: function(room, pos, cachedData) {
        let positions = [
            { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 },
            { x: pos.x - 1, y: pos.y }, { x: pos.x + 1, y: pos.y }
        ];
        for (let p of positions) {
            if (this.canPlaceStructure(room, p.x, p.y, cachedData)) {
                room.createConstructionSite(p.x, p.y, STRUCTURE_CONTAINER);
                logger.info(`Placed container at ${p.x},${p.y} in ${room.name}`);
                break;
            }
        }
    },

    buildPath: function(room, fromPos, toPos, cachedData) {
        let path = room.findPath(fromPos, toPos, { ignoreCreeps: true, swampCost: 1 });
        path.forEach(step => {
            if (cachedData.structures.filter(s => s.pos.x === step.x && s.pos.y === step.y).length === 0 &&
                cachedData.constructionSites.filter(s => s.pos.x === step.x && s.pos.y === step.y).length === 0) {
                room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
            }
        });
    },

    buildPathAcrossRooms: function(homeRoom, fromPos, toPos, targetRoomName, cachedData) {
        let path = PathFinder.search(
            fromPos,
            { pos: toPos, range: 1 },
            {
                plainCost: 2,
                swampCost: 10,
                roomCallback: function(roomName) {
                    let room = Game.rooms[roomName];
                    if (!room) return;
                    let costs = new PathFinder.CostMatrix();

                    room.find(FIND_STRUCTURES).forEach(function(struct) {
                        if (struct.structureType === STRUCTURE_ROAD) {
                            costs.set(struct.pos.x, struct.pos.y, 1);
                        } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                                   struct.structureType !== STRUCTURE_RAMPART) {
                            costs.set(struct.pos.x, struct.pos.y, 0xff);
                        }
                    });

                    room.find(FIND_CONSTRUCTION_SITES).forEach(function(site) {
                        if (site.structureType !== STRUCTURE_ROAD) {
                            costs.set(site.pos.x, site.pos.y, 0xff);
                        }
                    });

                    room.find(FIND_CREEPS).forEach(function(creep) {
                        costs.set(creep.pos.x, creep.pos.y, 0xff);
                    });

                    return costs;
                }
            }
        ).path;

        path.forEach(step => {
            let targetRoom = Game.rooms[step.roomName];
            if (targetRoom && cachedData.structures.filter(s => s.pos.x === step.x && s.pos.y === step.y).length === 0 &&
                cachedData.constructionSites.filter(s => s.pos.x === step.x && s.pos.y === step.y).length === 0) {
                targetRoom.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
            }
        });
    },

    // Hilfsfunktion zur Berechnung der Chebyshev-Distanz zwischen zwei Positionen
    getChebyshevDistance: function(pos1, pos2) {
        let dx = Math.abs(pos1.x - pos2.x);
        let dy = Math.abs(pos1.y - pos2.y);
        return Math.max(dx, dy); // Chebyshev-Distanz: maximale Achsenverschiebung
    }
};