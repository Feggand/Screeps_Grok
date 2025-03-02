// structureBuilder.js
// Modul zum Bau von Strukturen in Räumen basierend auf Controller-Level und verfügbarer Energie

var logger = require('logger'); // Importiert Logging-Modul für Protokollierung

module.exports = {
    // Hauptfunktion zum Bau von Strukturen in einem Raum
    buildStructures: function(room) {
        let roomMemory = Memory.rooms[room.name] || {}; // Speicher des Raums
        if (!roomMemory.isMyRoom) { // Wenn der Raum nicht mir gehört
            this.buildRemoteStructures(room); // Baut Strukturen in Remote-Räumen
            return;
        }

        let spawn = room.find(FIND_MY_SPAWNS)[0]; // Erster Spawn im Raum
        if (!spawn) return; // Kein Spawn -> Funktion beenden

        // Strukturen basierend auf Controller-Level bauen
        if (room.controller.level >= 2) {
            this.buildExtensions(room, spawn); // Baut Extensions
            this.buildContainers(room); // Baut Container bei Quellen
            this.buildControllerContainer(room); // Baut Container beim Controller
            this.buildRoads(room, spawn); // Baut Straßen
        }
        if (room.controller.level >= 3) {
            this.buildTowers(room, spawn); // Baut Türme
            this.buildRemoteContainers(room); // Baut Container in Remote-Räumen
            this.buildDefenses(room, spawn); // Baut Verteidigungen
        }
        if (room.controller.level >= 4) {
            this.buildStorage(room, spawn); // Baut Storage
        }
        if (room.controller.level >= 5) {
            this.buildLinks(room); // Baut Links
        }
    },

    // Funktion zum Bau von Extensions um den Spawn herum
    buildExtensions: function(room, spawn) {
        let extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length; // Anzahl bestehender Extensions
        let extensionSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTENSION }).length; // Anzahl Baustellen für Extensions
        let maxExtensions; // Maximale Anzahl Extensions basierend auf Controller-Level
        switch (room.controller.level) {
            case 2: maxExtensions = 5; break;
            case 3: maxExtensions = 10; break;
            case 4: maxExtensions = 20; break;
            case 5: maxExtensions = 30; break;
            default: maxExtensions = 20; // Fallback für höhere Level
        }

        logger.info('Extensions in ' + room.name + ': ' + extensions + ' built, ' + extensionSites + ' sites, max ' + maxExtensions);
        if (extensions + extensionSites < maxExtensions && room.energyAvailable >= 50) { // Wenn Platz und Energie vorhanden
            let placed = 0; // Zählt platzierte Extensions
            const maxDistance = 5; // Maximale Entfernung vom Spawn

            // Durchläuft Positionen in einem 5x5-Raster um den Spawn
            for (let dx = -maxDistance; dx <= maxDistance && placed < (maxExtensions - extensions - extensionSites); dx++) {
                for (let dy = -maxDistance; dy <= maxDistance && placed < (maxExtensions - extensions - extensionSites); dy++) {
                    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) continue; // Überspringt nahen Bereich um Spawn

                    let x = spawn.pos.x + dx; // X-Koordinate
                    let y = spawn.pos.y + dy; // Y-Koordinate
                    let distance = Math.sqrt(dx * dx + dy * dy); // Entfernung vom Spawn

                    if (distance > 2 && distance <= maxDistance && x >= 0 && x < 50 && y >= 0 && y < 50) { // Gültige Position
                        if (this.canPlaceStructure(room, x, y)) { // Prüft, ob Platzierbar
                            room.createConstructionSite(x, y, STRUCTURE_EXTENSION); // Erstellt Baustelle
                            logger.info('Placed extension at ' + x + ',' + y + ' in ' + room.name);
                            placed++;
                        } else {
                            logger.warn('Position ' + x + ',' + y + ' blocked for extension in ' + room.name);
                        }
                    }
                }
            }

            if (extensions + extensionSites + placed >= maxExtensions) {
                logger.info('Max extensions reached in ' + room.name); // Maximale Anzahl erreicht
            } else if (placed === 0) {
                logger.warn('No valid positions found for new extensions in ' + room.name); // Keine Position gefunden
            }
        } else {
            logger.info('No new extensions needed in ' + room.name + ' or insufficient energy'); // Kein Bedarf oder zu wenig Energie
        }
    },

    // Funktion zum Bau eines Storage nahe dem Spawn
    buildStorage: function(room, spawn) {
        let storage = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0]; // Bestehendes Storage
        let storageSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_STORAGE }).length; // Baustellen für Storage
        logger.info('Storage in ' + room.name + ': ' + (storage ? 1 : 0) + ' built, ' + storageSites + ' sites');
        if (!storage && storageSites === 0 && room.energyAvailable >= 150) { // Kein Storage vorhanden und genug Energie
            let pos = { x: spawn.pos.x, y: spawn.pos.y + 3 }; // Feste Position südlich des Spawns
            if (this.canPlaceStructure(room, pos.x, pos.y)) { // Prüft, ob Platzierbar
                room.createConstructionSite(pos.x, pos.y, STRUCTURE_STORAGE); // Erstellt Baustelle
                logger.info('Placed storage at ' + pos.x + ',' + pos.y + ' in ' + room.name);
            } else {
                logger.warn('Storage position ' + pos.x + ',' + pos.y + ' blocked in ' + room.name); // Position blockiert
            }
        }
    },

    // Funktion zum Bau von Containern nahe Quellen
    buildContainers: function(room) {
        let sources = room.find(FIND_SOURCES); // Alle Quellen im Raum
        sources.forEach(source => {
            let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0]; // Container in Reichweite 1
            let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0]; // Baustelle in Reichweite 1
            if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) { // Kein Container/Baustelle und genug Energie
                this.placeContainerNear(room, source.pos); // Platziert Container nahe der Quelle
            }
        });
    },

    // Funktion zum Bau eines Containers nahe dem Controller
    buildControllerContainer: function(room) {
        if (!room.controller || !room.controller.my) return; // Kein eigener Controller -> Funktion beenden

        let containersNearController = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER // Container in Reichweite 3
        });
        let constructionSitesNearController = room.controller.pos.findInRange(FIND_CONSTRUCTION_SITES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER // Baustellen in Reichweite 3
        });

        if (containersNearController.length > 0 || constructionSitesNearController.length > 0) { // Bereits Container/Baustelle vorhanden
            logger.info('Room ' + room.name + ': Container or construction site already exists near controller');
            return;
        }

        let pos = null; // Position für neuen Container
        // Durchläuft Positionen in einem 3x3-Raster um den Controller
        for (let dx = -3; dx <= 3 && !pos; dx++) {
            for (let dy = -3; dy <= 3 && !pos; dy++) {
                let x = room.controller.pos.x + dx; // X-Koordinate
                let y = room.controller.pos.y + dy; // Y-Koordinate
                let distance = Math.sqrt(dx * dx + dy * dy); // Entfernung vom Controller
                if (distance <= 3 && x >= 0 && x < 50 && y >= 0 && y < 50) { // Gültige Position
                    if (this.canPlaceStructure(room, x, y)) { // Prüft, ob Platzierbar
                        pos = new RoomPosition(x, y, room.name); // Setzt Position
                        break;
                    }
                }
            }
        }

        if (pos && room.energyAvailable >= 50) { // Gültige Position und genug Energie
            let result = room.createConstructionSite(pos, STRUCTURE_CONTAINER); // Erstellt Baustelle
            if (result === OK) {
                logger.info('Room ' + room.name + ': Placed controller container construction site at ' + pos);
            } else {
                logger.error('Room ' + room.name + ': Failed to place controller container at ' + pos + ': ' + result); // Fehler protokollieren
            }
        } else if (!pos) {
            logger.warn('Room ' + room.name + ': No valid position found for controller container'); // Keine Position gefunden
        } else {
            logger.info('Room ' + room.name + ': Insufficient energy for controller container'); // Zu wenig Energie
        }
    },

    // Funktion zum Bau von Straßen im Raum
    buildRoads: function(room, spawn) {
        let roomMemory = Memory.rooms[room.name]; // Raum-Speicher
        if (!roomMemory.roadsBuilt) { // Wenn noch keine Straßen gebaut
            let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }); // Alle Container
            containers.forEach(container => {
                this.buildPath(room, container.pos, spawn.pos); // Straße von Container zu Spawn
                this.buildPath(room, container.pos, room.controller.pos); // Straße von Container zu Controller
            });
            roomMemory.roadsBuilt = true; // Markiert Straßen als gebaut
            logger.info('Built initial roads in ' + room.name);
        }
        if (room.controller.level >= 3 && !roomMemory.roadsBuiltExtended) { // Erweiterte Straßen ab Level 3
            let extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION }); // Alle Extensions
            extensions.forEach(ext => this.buildPath(room, ext.pos, spawn.pos)); // Straße zu Extensions
            let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }); // Alle Türme
            towers.forEach(tower => this.buildPath(room, tower.pos, spawn.pos)); // Straße zu Türmen
            roomMemory.roadsBuiltExtended = true; // Markiert erweiterte Straßen als gebaut
            logger.info('Built extended roads in ' + room.name);
        }
    },

    // Funktion zum Bau von Türmen nahe dem Spawn
    buildTowers: function(room, spawn) {
        let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }).length; // Anzahl bestehender Türme
        let towerSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_TOWER }).length; // Anzahl Baustellen für Türme
        let maxTowers = room.controller.level >= 5 ? 2 : 1; // Maximale Anzahl Türme

        logger.info('Towers in ' + room.name + ': ' + towers + ' built, ' + towerSites + ' sites, max ' + maxTowers + ', energy available: ' + room.energyAvailable);
        if (towers + towerSites < maxTowers && room.energyAvailable >= 600) { // Platz und Energie vorhanden
            const maxDistance = 5; // Maximale Entfernung vom Spawn
            let placed = false; // Flag für platzierten Turm

            // Durchläuft Positionen in einem 5x5-Raster um den Spawn
            for (let dx = -maxDistance; dx <= maxDistance && !placed; dx++) {
                for (let dy = -maxDistance; dy <= maxDistance && !placed; dy++) {
                    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue; // Überspringt nahen Bereich

                    let x = spawn.pos.x + dx; // X-Koordinate
                    let y = spawn.pos.y + dy; // Y-Koordinate
                    let distance = Math.sqrt(dx * dx + dy * dy); // Entfernung vom Spawn

                    if (distance >= 2 && distance <= maxDistance && x >= 0 && x < 50 && y >= 0 && y < 50) { // Gültige Position
                        if (this.canPlaceStructure(room, x, y)) { // Prüft, ob Platzierbar
                            room.createConstructionSite(x, y, STRUCTURE_TOWER); // Erstellt Baustelle
                            logger.info('Placed tower at ' + x + ',' + y + ' in ' + room.name);
                            placed = true;
                        } else {
                            logger.warn('Position ' + x + ',' + y + ' blocked for tower in ' + room.name);
                        }
                    }
                }
            }

            if (!placed) {
                logger.warn('No valid position found for new tower in ' + room.name); // Keine Position gefunden
            }
        } else {
            logger.info('No new towers needed in ' + room.name + ' or insufficient energy/conditions not met'); // Kein Bedarf oder Bedingungen nicht erfüllt
        }
    },

    // Funktion zum Bau von Links (Sender nahe Storage, Receiver nahe Controller-Container)
    buildLinks: function(room) {
        let links = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }).length; // Anzahl bestehender Links
        let linkSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_LINK }).length; // Anzahl Baustellen für Links
        let maxLinks = room.controller.level >= 5 ? 2 : 0; // Maximale Anzahl Links

        logger.info('Links in ' + room.name + ': ' + links + ' built, ' + linkSites + ' sites, max ' + maxLinks + ', energy available: ' + room.energyAvailable);
        if (links + linkSites < maxLinks && room.energyAvailable >= 300) { // Platz und Energie vorhanden
            let placed = false; // Flag für platzierten Link

            // Sender-Link nahe dem Storage
            let storage = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0]; // Bestehendes Storage
            if (!placed && storage) {
                const storagePos = storage.pos; // Position des Storage
                for (let dx = -1; dx <= 1 && !placed; dx++) {
                    for (let dy = -1; dy <= 1 && !placed; dy++) {
                        if (dx === 0 && dy === 0) continue; // Überspringt Storage-Position selbst
                        let x = storagePos.x + dx; // X-Koordinate
                        let y = storagePos.y + dy; // Y-Koordinate
                        if (x >= 0 && x < 50 && y >= 0 && y < 50 && this.canPlaceStructure(room, x, y)) { // Gültige Position
                            room.createConstructionSite(x, y, STRUCTURE_LINK); // Erstellt Baustelle
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
                    filter: s => s.structureType === STRUCTURE_CONTAINER // Container in Reichweite 3
                })[0];
                if (controllerContainer) {
                    const containerPos = controllerContainer.pos; // Position des Containers
                    for (let dx = -1; dx <= 1 && !placed; dx++) {
                        for (let dy = -1; dy <= 1 && !placed; dy++) {
                            if (dx === 0 && dy === 0) continue; // Überspringt Container-Position selbst
                            let x = containerPos.x + dx; // X-Koordinate
                            let y = containerPos.y + dy; // Y-Koordinate
                            if (x >= 0 && x < 50 && y >= 0 && y < 50 && this.canPlaceStructure(room, x, y)) { // Gültige Position
                                room.createConstructionSite(x, y, STRUCTURE_LINK); // Erstellt Baustelle
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
                logger.warn('No valid position found for new link in ' + room.name); // Keine Position gefunden
            }
        } else {
            logger.info('No new links needed in ' + room.name + ' or insufficient energy/conditions not met'); // Kein Bedarf oder Bedingungen nicht erfüllt
        }
    },

    // Funktion zum Bau von Verteidigungen (Wälle und Ramparts)
    buildDefenses: function(room, spawn) {
        let roomMemory = Memory.rooms[room.name]; // Raum-Speicher
        if (!roomMemory.defensesBuilt) { // Wenn noch keine Verteidigungen gebaut
            // Baut Wände in einem 5x5-Raster um den Spawn
            for (let x = spawn.pos.x - 5; x <= spawn.pos.x + 5; x++) {
                for (let y = spawn.pos.y - 5; y <= spawn.pos.y + 5; y++) {
                    if (Math.abs(x - spawn.pos.x) === 5 || Math.abs(y - spawn.pos.y) === 5) { // Nur äußere Grenze
                        if (this.canPlaceStructure(room, x, y)) { // Prüft, ob Platzierbar
                            room.createConstructionSite(x, y, STRUCTURE_WALL); // Erstellt Wand-Baustelle
                        }
                    }
                }
            }
            let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }); // Alle Container
            containers.forEach(container => {
                if (this.canPlaceStructure(room, container.pos.x, container.pos.y)) { // Prüft, ob Platzierbar
                    room.createConstructionSite(container.pos.x, container.pos.y, STRUCTURE_RAMPART); // Erstellt Rampart-Baustelle
                }
            });
            roomMemory.defensesBuilt = true; // Markiert Verteidigungen als gebaut
            logger.info('Built defenses in ' + room.name);
        }
    },

    // Funktion zum Bau von Containern in Remote-Räumen
    buildRemoteContainers: function(room) {
        let roomMemory = Memory.rooms[room.name]; // Raum-Speicher
        if (!roomMemory.remoteContainersBuilt && room.controller.level >= 3) { // Ab Level 3 und noch nicht gebaut
            let targetRoomName = roomMemory.remoteRooms[0]; // Erster Remote-Raum
            let targetRoom = Game.rooms[targetRoomName]; // Zielraum-Objekt
            if (targetRoom) {
                let sources = targetRoom.find(FIND_SOURCES); // Alle Quellen im Remote-Raum
                sources.forEach(source => {
                    let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0]; // Container in Reichweite 1
                    let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0]; // Baustelle in Reichweite 1
                    if (!nearbyContainer && !nearbySite && room.energyAvailable >= 50) { // Kein Container/Baustelle und genug Energie
                        this.placeContainerNear(targetRoom, source.pos); // Platziert Container nahe der Quelle
                    }
                });
                roomMemory.remoteContainersBuilt = true; // Markiert Remote-Container als gebaut
                logger.info('Built remote containers in ' + targetRoomName);
            }
        }
    },

    // Funktion zum Bau von Strukturen in nicht-eigenen (Remote-)Räumen
    buildRemoteStructures: function(room) {
        let roomMemory = Memory.rooms[room.name]; // Raum-Speicher
        // Alle 10 Ticks prüfen, ob Container benötigt werden
        if (Game.time % 10 === 0 && roomMemory.needsHarvesters && roomMemory.containers < roomMemory.sources && room.energyAvailable >= 50) {
            let sources = room.find(FIND_SOURCES); // Alle Quellen im Raum
            sources.forEach(source => {
                let nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0]; // Container in Reichweite 1
                let nearbySite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0]; // Baustelle in Reichweite 1
                if (!nearbyContainer && !nearbySite) { // Kein Container/Baustelle
                    this.placeContainerNear(room, source.pos); // Platziert Container
                }
            });
        }
    },

    // Hilfsfunktion: Prüft, ob eine Struktur an einer Position platziert werden kann
    canPlaceStructure: function(room, x, y) {
        let terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0]; // Terrain an der Position
        let structures = room.lookForAt(LOOK_STRUCTURES, x, y); // Strukturen an der Position
        let sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y); // Baustellen an der Position
        return terrain !== 'wall' && !structures.length && !sites.length; // Frei, wenn kein Wall, keine Struktur und keine Baustelle
    },

    // Hilfsfunktion: Platziert einen Container nahe einer Position (z. B. Quelle)
    placeContainerNear: function(room, pos) {
        let positions = [ // Mögliche Positionen um die Zielposition
            { x: pos.x, y: pos.y + 1 }, { x: pos.x, y: pos.y - 1 },
            { x: pos.x - 1, y: pos.y }, { x: pos.x + 1, y: pos.y }
        ];
        for (let p of positions) {
            if (this.canPlaceStructure(room, p.x, p.y)) { // Prüft, ob Platzierbar
                room.createConstructionSite(p.x, p.y, STRUCTURE_CONTAINER); // Erstellt Baustelle
                logger.info('Placed container at ' + p.x + ',' + p.y + ' in ' + room.name);
                break; // Nur ein Container pro Quelle
            }
        }
    },

    // Hilfsfunktion: Baut einen Pfad aus Straßen zwischen zwei Positionen
    buildPath: function(room, fromPos, toPos) {
        let path = room.findPath(fromPos, toPos, { ignoreCreeps: true, swampCost: 1 }); // Findet optimalen Pfad (ignoriert Creeps, Sumpf kostet 1)
        path.forEach(step => {
            if (room.lookForAt(LOOK_STRUCTURES, step.x, step.y).length === 0 && // Keine Struktur vorhanden
                room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y).length === 0) { // Keine Baustelle vorhanden
                room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD); // Erstellt Straßen-Baustelle
            }
        });
    }
};