var logger = require('logger');

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
            let isMyRoom = hasController && room.controller.my ? true : false; // Explizit true oder false
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
            } else {
                Memory.rooms[roomName].sources = room.find(FIND_SOURCES).length;
                Memory.rooms[roomName].containers = room.find(FIND_STRUCTURES, { filter: function(s) { return s.structureType === STRUCTURE_CONTAINER; } }).length;
                Memory.rooms[roomName].constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
                Memory.rooms[roomName].needsScout = true;
                Memory.rooms[roomName].needsHarvesters = room.find(FIND_SOURCES).length > 0;
            }
        }
    }
};