module.exports = {
    initializeMemory: function() {
        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            console.log(`Initializing memory for ${roomName}, hasController: ${!!room.controller}, isMyRoom: ${room.controller && room.controller.my}`);
            
            if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = {};
                Memory.rooms[roomName].initialized = true;
            }
            
            // Immer aktuelle Werte setzen, auch für bestehende Räume
            Memory.rooms[roomName].hasController = !!room.controller;
            Memory.rooms[roomName].isMyRoom = room.controller && room.controller.my;

            if (Memory.rooms[roomName].isMyRoom) {
                // Hauptraum mit Spawn
                if (!Memory.rooms[roomName].minHarvesters) Memory.rooms[roomName].minHarvesters = room.find(FIND_SOURCES).length;
                if (!Memory.rooms[roomName].minHaulers) Memory.rooms[roomName].minHaulers = room.controller.level === 2 ? 1 : 2;
                if (!Memory.rooms[roomName].minWorkers) Memory.rooms[roomName].minWorkers = 1;
                if (!Memory.rooms[roomName].minRemoteHarvesters) Memory.rooms[roomName].minRemoteHarvesters = 0;
                if (!Memory.rooms[roomName].hasOwnProperty('harvesterSpawnedThisTick')) Memory.rooms[roomName].harvesterSpawnedThisTick = false;
                if (!Memory.rooms[roomName].hasOwnProperty('roadsBuilt')) Memory.rooms[roomName].roadsBuilt = false;
                if (!Memory.rooms[roomName].hasOwnProperty('roadsBuiltExtended')) Memory.rooms[roomName].roadsBuiltExtended = false;
                if (!Memory.rooms[roomName].hasOwnProperty('defensesBuilt')) Memory.rooms[roomName].defensesBuilt = false;
                if (!Memory.rooms[roomName].hasOwnProperty('remoteContainersBuilt')) Memory.rooms[roomName].remoteContainersBuilt = false;
                if (!Memory.rooms[roomName].remoteRooms) Memory.rooms[roomName].remoteRooms = [];
            } else {
                // Remote-Raum ohne Spawn
                Memory.rooms[roomName].sources = room.find(FIND_SOURCES).length;
                Memory.rooms[roomName].containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }).length;
                Memory.rooms[roomName].constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
                Memory.rooms[roomName].needsScout = true;
                Memory.rooms[roomName].needsHarvesters = room.find(FIND_SOURCES).length > 0;
            }
        }
    }
};