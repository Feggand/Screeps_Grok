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
                Memory.rooms[roomName].hasController = !!room.controller;
                Memory.rooms[roomName].isMyRoom = room.controller && room.controller.my;
                
                if (Memory.rooms[roomName].isMyRoom) {
                    Memory.rooms[roomName].minHarvesters = room.find(FIND_SOURCES).length;
                    Memory.rooms[roomName].minHaulers = room.controller.level === 2 ? 1 : 2;
                    Memory.rooms[roomName].minWorkers = 1;
                    Memory.rooms[roomName].minRemoteHarvesters = 0;
                    Memory.rooms[roomName].harvesterSpawnedThisTick = false;
                    Memory.rooms[roomName].roadsBuilt = false;
                    Memory.rooms[roomName].roadsBuiltExtended = false;
                    Memory.rooms[roomName].defensesBuilt = false;
                    Memory.rooms[roomName].remoteContainersBuilt = false;
                    Memory.rooms[roomName].remoteRooms = [];
                } else {
                    Memory.rooms[roomName].sources = room.find(FIND_SOURCES).length;
                    Memory.rooms[roomName].containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }).length;
                    Memory.rooms[roomName].constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
                    Memory.rooms[roomName].needsScout = true;
                    Memory.rooms[roomName].needsHarvesters = room.find(FIND_SOURCES).length > 0;
                }
            } else {
                if (!Memory.rooms[roomName].isMyRoom) {
                    Memory.rooms[roomName].sources = room.find(FIND_SOURCES).length;
                    Memory.rooms[roomName].containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }).length;
                    Memory.rooms[roomName].constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
                }
            }
        }
    }
};