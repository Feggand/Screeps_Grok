// memoryManager.js
// Modul zur Verwaltung und Initialisierung der Memory-Strukturen für Räume

var logger = require('logger'); // Importiert Logging-Modul

module.exports = {
    // Initialisiert oder aktualisiert die Memory-Strukturen für alle sichtbaren Räume
    initializeMemory: function() {
        // Initialisiert Memory.rooms, wenn nicht vorhanden
        if (!Memory.rooms) {
            Memory.rooms = {};
            logger.info('Initialized Memory.rooms');
        }
        // Initialisiert Memory.remoteContainers, wenn nicht vorhanden
        if (!Memory.remoteContainers) {
            Memory.remoteContainers = {};
            logger.info('Initialized Memory.remoteContainers');
        }

        // Durchläuft alle sichtbaren Räume
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName]; // Zugriff auf das Raum-Objekt
            // Initialisiert Speicher für neuen Raum
            if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = { initialized: true };
                logger.info('Initialized memory for ' + roomName);
            }

            let hasController = !!room.controller; // Prüft, ob ein Controller existiert
            let isMyRoom = hasController && room.controller.my ? true : false; // Prüft, ob der Raum mir gehört
            Memory.rooms[roomName].hasController = hasController; // Speichert Controller-Status
            Memory.rooms[roomName].isMyRoom = isMyRoom; // Speichert Eigentumsstatus
            logger.info('Updated ' + roomName + ': hasController=' + hasController + ', isMyRoom=' + isMyRoom);

            if (isMyRoom) {
                // Setzt Standardwerte für meine Räume, falls nicht bereits vorhanden
                Memory.rooms[roomName].minHarvesters = Memory.rooms[roomName].minHarvesters || room.find(FIND_SOURCES).length; // Min. Harvester basierend auf Quellen
                Memory.rooms[roomName].minHaulers = Memory.rooms[roomName].minHaulers || (room.controller.level === 2 ? 1 : 2); // Min. Hauler basierend auf Level
                Memory.rooms[roomName].minWorkers = Memory.rooms[roomName].minWorkers || 1; // Min. Worker
                Memory.rooms[roomName].minRemoteHarvesters = Memory.rooms[roomName].minRemoteHarvesters || 0; // Min. RemoteHarvester
                Memory.rooms[roomName].harvesterSpawnedThisTick = Memory.rooms[roomName].harvesterSpawnedThisTick || false; // Flag für Harvester-Spawn
                Memory.rooms[roomName].roadsBuilt = Memory.rooms[roomName].roadsBuilt || false; // Flag für Straßenbau
                Memory.rooms[roomName].roadsBuiltExtended = Memory.rooms[roomName].roadsBuiltExtended || false; // Flag für erweiterten Straßenbau
                Memory.rooms[roomName].defensesBuilt = Memory.rooms[roomName].defensesBuilt || false; // Flag für Verteidigungsbau
                Memory.rooms[roomName].remoteContainersBuilt = Memory.rooms[roomName].remoteContainersBuilt || false; // Flag für Remote-Container
                Memory.rooms[roomName].remoteRooms = Memory.rooms[roomName].remoteRooms || []; // Liste der Remote-Räume
            } else {
                // Setzt Informationen für nicht-eigene Räume
                Memory.rooms[roomName].sources = room.find(FIND_SOURCES).length; // Anzahl der Quellen
                Memory.rooms[roomName].containers = room.find(FIND_STRUCTURES, { 
                    filter: function(s) { return s.structureType === STRUCTURE_CONTAINER; } 
                }).length; // Anzahl der Container
                Memory.rooms[roomName].constructionSites = room.find(FIND_CONSTRUCTION_SITES).length; // Anzahl der Baustellen
                Memory.rooms[roomName].needsScout = true; // Flag, dass ein Scout benötigt wird
                Memory.rooms[roomName].needsHarvesters = room.find(FIND_SOURCES).length > 0; // Flag, dass Harvester benötigt werden
            }
        }
    }
};