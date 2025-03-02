// spawnManager.js
// Modul zur Verwaltung der Spawns und Entscheidung, welche Creeps gespawnt werden

var spawnCreeps = require('spawnCreeps'); // Importiert Modul zum Spawnen von Creeps
var logger = require('logger'); // Importiert Logging-Modul

module.exports = {
    // Hauptfunktion zur Verwaltung der Spawns in einem Raum
    manageSpawns: function(room) {
        let roomMemory = Memory.rooms[room.name] || {}; // Speicher des Raums
        if (!roomMemory.isMyRoom) return; // Nur eigene Räume verwalten

        let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }); // Alle Container im Raum
        let totalContainerEnergy = containers.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0); // Gesamte Energie in Containern
        let sources = room.find(FIND_SOURCES); // Alle Quellen im Raum

        // Dynamische Anpassung der minimalen Creep-Anzahl
        roomMemory.minHarvesters = sources.length; // Eine Harvester pro Quelle
        roomMemory.minHaulers = Math.min(3, Math.max(1, Math.ceil(totalContainerEnergy / 1000))); // 1-3 Hauler basierend auf Container-Energie
        let extraWorkers = (room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 1 : 0) + // Zusätzlicher Worker bei Baustellen
                          (room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }).length > 0 ? 1 : 0); // Zusätzlicher Worker bei beschädigten Strukturen
        roomMemory.minWorkers = Math.min(8, Math.max(2, 1 + extraWorkers + Math.floor(totalContainerEnergy / 1000))); // 2-8 Worker
        roomMemory.minRemoteHarvesters = roomMemory.minRemoteHarvesters || 0; // Standardmäßig 0 RemoteHarvester

        // Zählt aktuelle Creeps im Raum
        let creeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name || (!c.memory.homeRoom && c.room.name === room.name));
        let harvesters = _.countBy(creeps, 'memory.role').harvester || 0; // Anzahl Harvester
        let haulers = _.countBy(creeps, 'memory.role').hauler || 0; // Anzahl Hauler
        let workers = _.countBy(creeps, 'memory.role').worker || 0; // Anzahl Worker
        let remoteHarvesters = _.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name).length; // Anzahl RemoteHarvester

        // Protokolliert aktuellen Status
        logger.info('Room ' + room.name + ': Harvesters=' + harvesters + '/' + roomMemory.minHarvesters + 
                    ', Haulers=' + haulers + '/' + roomMemory.minHaulers + 
                    ', Workers=' + workers + '/' + roomMemory.minWorkers + 
                    ', RemoteHarvesters=' + remoteHarvesters + '/' + roomMemory.minRemoteHarvesters + 
                    ', Energy=' + room.energyAvailable + ', TotalContainerEnergy=' + totalContainerEnergy);

        let spawn = room.find(FIND_MY_SPAWNS)[0]; // Erster Spawn im Raum
        if (!spawn || spawn.spawning) { // Kein Spawn oder Spawn beschäftigt
            if (spawn && spawn.spawning) {
                logger.info('Spawn in ' + room.name + ' is busy spawning: ' + spawn.spawning.name); // Protokolliert aktuellen Spawn
            }
            return;
        }

        // Priorität 1: Scouts für Remote-Räume ab Level 3
        if (room.controller.level >= 3 && room.energyAvailable >= 50) {
            let remoteRooms = roomMemory.remoteRooms || []; // Liste der Remote-Räume
            for (let i = 0; i < remoteRooms.length; i++) {
                let remoteRoomName = remoteRooms[i];
                let remoteRoomMemory = Memory.rooms[remoteRoomName] || {};
                let scouts = _.filter(Game.creeps, c => c.memory.role === 'scout' && c.memory.targetRoom === remoteRoomName); // Scouts im Remote-Raum
                if (remoteRoomMemory.needsScout && (scouts.length === 0 || (scouts.length === 1 && scouts[0].ticksToLive < 60))) {
                    spawnCreeps.spawn(spawn, 'scout', remoteRoomName, room.name); // Spawnt Scout
                    return;
                }
            }
        }

        // Priorität 2: Harvester, wenn unter Minimum
        if (harvesters < roomMemory.minHarvesters && room.energyAvailable >= 300) {
            spawnCreeps.spawn(spawn, 'harvester', null, room.name); // Spawnt Harvester
            logger.info('Spawning new harvester in ' + room.name);
            return;
        } 
        // Priorität 3: Hauler, wenn unter Minimum
        else if (haulers < roomMemory.minHaulers && room.energyAvailable >= 300) {
            spawnCreeps.spawn(spawn, 'hauler', null, room.name); // Spawnt Hauler
            logger.info('Spawning new hauler in ' + room.name);
            return;
        } 
        // Priorität 4: Worker, wenn unter Minimum
        else if (workers < roomMemory.minWorkers && room.energyAvailable >= 200) {
            let workerRoles = ['upgrader', 'repairer', 'wallRepairer', 'flexible']; // Mögliche Unterrollen
            let existingWorkers = _.filter(Game.creeps, c => c.memory.role === 'worker' && c.memory.homeRoom === room.name); // Bestehende Worker
            let roleCounts = _.countBy(existingWorkers, 'memory.subRole'); // Zählt Unterrollen
            let nextRole = workerRoles.find(role => !roleCounts[role] || roleCounts[role] < 1) || 'flexible'; // Wählt nächste benötigte Unterrolle
            spawnCreeps.spawn(spawn, 'worker', null, room.name, nextRole); // Spawnt Worker mit Unterrolle
            logger.info('Spawning new worker with subRole ' + nextRole + ' in ' + room.name);
            return;
        } 
        // Priorität 5: RemoteHarvester, wenn unter Minimum
        else if (remoteHarvesters < roomMemory.minRemoteHarvesters && room.energyAvailable >= 300) {
            let remoteRooms = roomMemory.remoteRooms || []; // Liste der Remote-Räume
            let targetRoom = remoteRooms.length > 0 ? remoteRooms[0] : null; // Erster Remote-Raum
            spawnCreeps.spawn(spawn, 'remoteHarvester', targetRoom, room.name); // Spawnt RemoteHarvester
            logger.info('Spawning new remoteHarvester in ' + room.name);
            return;
        } else {
            logger.info('No spawning needed in ' + room.name + ': All minimum requirements met or exceeded'); // Kein Spawn nötig
        }

        roomMemory.harvesterSpawnedThisTick = false; // Setzt Flag zurück
    }
};