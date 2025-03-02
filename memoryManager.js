// memoryManager.js
// Modul zur Verwaltung und Initialisierung der Memory-Strukturen für Räume

var logger = require('logger'); // Importiert Logging-Modul

module.exports = {
    initializeMemory: function() {
        if (!Memory.rooms) {
            Memory.rooms = {};
            logger.info('Initialized Memory.rooms');
        }
        if (!Memory.remoteContainers) {
            Memory.remoteContainers = {};
            logger.info('Initialized Memory.remoteContainers');
        }

        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = { initialized: true };
                logger.info('Initialized memory for ' + roomName);
            }

            let hasController = !!room.controller;
            let isMyRoom = hasController && room.controller.my ? true : false;
            Memory.rooms[roomName].hasController = hasController;
            Memory.rooms[roomName].isMyRoom = isMyRoom;
            logger.info('Updated ' + roomName + ': hasController=' + hasController + ', isMyRoom=' + isMyRoom);

            if (isMyRoom) {
                Memory.rooms[roomName].minHarvesters = Memory.rooms[roomName].minHarvesters || room.find(FIND_SOURCES).length;
                Memory.rooms[roomName].minHaulers = Memory.rooms[roomName].minHaulers || (room.controller.level === 2 ? 1 : 2);
                Memory.rooms[roomName].minWorkers = Memory.rooms[roomName].minWorkers || 1;
                Memory.rooms[roomName].minRemoteHarvesters = Memory.rooms[roomName].minRemoteHarvesters || 0;
                Memory.rooms[roomName].harvesterSpawnedThisTick = Memory.rooms[roomName].harvesterSpawnedThisTick || false;
                Memory.rooms[roomName].roadsBuilt = Memory.rooms[roomName].roadsBuilt || false;
                Memory.rooms[roomName].roadsBuiltExtended = Memory.rooms[roomName].roadsBuiltExtended || false;
                Memory.rooms[roomName].defensesBuilt = Memory.rooms[roomName].defensesBuilt || false;
                Memory.rooms[roomName].remoteContainersBuilt = Memory.rooms[roomName].remoteContainersBuilt || false;
                Memory.rooms[roomName].remoteRooms = Memory.rooms[roomName].remoteRooms || [];

                this.detectAdjacentRooms(roomName);
            } else {
                Memory.rooms[roomName].sources = room.find(FIND_SOURCES).length;
                Memory.rooms[roomName].containers = room.find(FIND_STRUCTURES, { 
                    filter: function(s) { return s.structureType === STRUCTURE_CONTAINER; } 
                }).length;
                Memory.rooms[roomName].constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
                Memory.rooms[roomName].needsScout = Memory.rooms[roomName].needsScout !== false;
                Memory.rooms[roomName].needsHarvesters = room.find(FIND_SOURCES).length > 0;
            }
        }
    },

    // Funktion: Erkennt direkt zugängliche Nebenräume basierend auf begehbaren Exits
    detectAdjacentRooms: function(mainRoomName) {
        const room = Game.rooms[mainRoomName];
        if (!room) {
            logger.error(`Room ${mainRoomName} not visible, cannot detect adjacent rooms`);
            return;
        }

        // Zerlegt den Raumnamen in Richtung und Koordinaten
        const regex = /^([EW])(\d+)([NS])(\d+)$/;
        const match = mainRoomName.match(regex);
        if (!match) {
            logger.error(`Invalid room name format: ${mainRoomName}`);
            return;
        }

        const [_, ewDir, ewNum, nsDir, nsNum] = match;
        const x = parseInt(ewNum);
        const y = parseInt(nsNum);

        // Korrigierte Zuordnung der Nebenräume
        const adjacentRooms = {
            left: `${ewDir === 'W' ? 'W' : 'E'}${Math.abs(x + 1)}${nsDir}${y}`,   // W7N1 (Westen, höhere Zahl bei W)
            right: `${ewDir === 'W' ? 'W' : 'E'}${Math.abs(x - 1)}${nsDir}${y}`,  // W5N1 (Osten, niedrigere Zahl bei W)
            bottom: `${ewDir}${x}${nsDir === 'N' ? 'N' : 'S'}${Math.abs(y - 1)}`, // W6N0 (Süden)
            top: `${ewDir}${x}${nsDir === 'N' ? 'N' : 'S'}${Math.abs(y + 1)}`     // W6N2 (Norden)
        };

        // Findet tatsächliche Exits
        const exits = {
            left: room.find(FIND_EXIT_LEFT),   // Westen (zu W7N1)
            right: room.find(FIND_EXIT_RIGHT), // Osten (zu W5N1)
            bottom: room.find(FIND_EXIT_BOTTOM), // Süden (zu W6N0)
            top: room.find(FIND_EXIT_TOP)      // Norden (zu W6N2)
        };

        // Debugging: Loggt die genauen Exit-Positionen
        logger.info(`Exit positions for ${mainRoomName}: left=${JSON.stringify(exits.left)}, right=${JSON.stringify(exits.right)}, bottom=${JSON.stringify(exits.bottom)}, top=${JSON.stringify(exits.top)}`);

        // Prüft, ob Exits tatsächlich begehbar sind
        const accessibleExits = {
            left: exits.left.length > 0 && this.isExitAccessible(room, exits.left),
            right: exits.right.length > 0 && this.isExitAccessible(room, exits.right),
            bottom: exits.bottom.length > 0 && this.isExitAccessible(room, exits.bottom),
            top: exits.top.length > 0 && this.isExitAccessible(room, exits.top)
        };

        logger.info(`Exits for ${mainRoomName}: left=${accessibleExits.left} (${adjacentRooms.left}), right=${accessibleExits.right} (${adjacentRooms.right}), bottom=${accessibleExits.bottom} (${adjacentRooms.bottom}), top=${accessibleExits.top} (${adjacentRooms.top})`);

        // Verarbeitet nur begehbare Exits
        const accessibleRooms = [];
        if (accessibleExits.left) accessibleRooms.push(adjacentRooms.left);   // W7N1
        if (accessibleExits.right) accessibleRooms.push(adjacentRooms.right); // W5N1
        if (accessibleExits.bottom) accessibleRooms.push(adjacentRooms.bottom); // W6N0
        if (accessibleExits.top) accessibleRooms.push(adjacentRooms.top);     // W6N2

        // Löscht needsScout für nicht zugängliche Räume
        const allAdjacent = [adjacentRooms.left, adjacentRooms.right, adjacentRooms.bottom, adjacentRooms.top];
        allAdjacent.forEach(roomName => {
            if (!accessibleRooms.includes(roomName) && Memory.rooms[roomName] && Memory.rooms[roomName].needsScout) {
                Memory.rooms[roomName].needsScout = false;
                logger.info(`Cleared needsScout for inaccessible room ${roomName}`);
            }
        });

        // Verarbeitet zugängliche Räume
        accessibleRooms.forEach(adjacentRoomName => {
            if (!Memory.rooms[adjacentRoomName]) {
                Memory.rooms[adjacentRoomName] = { initialized: true };
                logger.info(`Initialized memory for adjacent room ${adjacentRoomName}`);
            }

            if (Memory.rooms[adjacentRoomName].isMyRoom) {
                logger.info(`Adjacent room ${adjacentRoomName} is my room, no scouting needed`);
                return;
            }

            const isVisible = !!Game.rooms[adjacentRoomName];
            if (isVisible) {
                const adjacentRoom = Game.rooms[adjacentRoomName];
                const hasSources = adjacentRoom.find(FIND_SOURCES).length > 0;
                if (hasSources && Memory.rooms[adjacentRoomName].needsScout !== false) {
                    Memory.rooms[adjacentRoomName].needsScout = true;
                    logger.info(`Set needsScout to true for accessible adjacent room ${adjacentRoomName} with sources`);
                } else if (!hasSources) {
                    Memory.rooms[adjacentRoomName].needsScout = false;
                    logger.info(`Marked ${adjacentRoomName} as not needing scout (no sources)`);
                }
            } else {
                if (Memory.rooms[adjacentRoomName].needsScout !== false) {
                    Memory.rooms[adjacentRoomName].needsScout = true;
                    logger.info(`Set needsScout to true for unsighted accessible room ${adjacentRoomName}`);
                }
            }

            if (!Memory.rooms[mainRoomName].remoteRooms.includes(adjacentRoomName)) {
                Memory.rooms[mainRoomName].remoteRooms.push(adjacentRoomName);
                logger.info(`Added ${adjacentRoomName} to remoteRooms of ${mainRoomName}`);
            }
        });
    },

    // Hilfsfunktion: Prüft, ob ein Exit tatsächlich begehbar ist (keine Wände davor)
    isExitAccessible: function(room, exitPositions) {
        for (let pos of exitPositions) {
            const terrain = room.lookForAt(LOOK_TERRAIN, pos.x, pos.y)[0];
            const structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
            const hasWall = terrain === 'wall' || structures.some(s => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART);
            if (!hasWall) return true; // Mindestens ein Exit ist begehbar
        }
        return false; // Alle Exits sind blockiert
    }
};