// spawnCreeps.js
// Modul zum Spawnen neuer Creeps mit spezifischen Rollen und Körperkonfigurationen

var logger = require('logger'); // Importiert Logging-Modul

module.exports = {
    // Funktion zum Spawnen eines Creeps mit Rolle, Zielraum und Heimatraum
    spawn: function(spawn, role, targetRoom, homeRoom, subRole) {
        let energyAvailable = spawn.room.energyAvailable; // Verfügbare Energie im Raum
        let body = []; // Körperteile des Creeps

        // Bestimmt den Körper basierend auf Rolle und verfügbarer Energie
        if (role === 'harvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyAvailable / 200), 5)); // WORK-Teile (min 2, max 5)
            let carryParts = 1; // 1 CARRY-Teil
            let moveParts = Math.ceil((workParts + carryParts) / 2); // MOVE-Teile basierend auf Gesamtteilen
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, WORK, CARRY, MOVE]; // Fallback-Body bei zu wenig Energie
        } else if (role === 'hauler') {
            let carryParts = Math.max(4, Math.min(Math.floor(energyAvailable / 100), 8)); // CARRY-Teile (min 4, max 8)
            let moveParts = Math.ceil(carryParts / 2); // MOVE-Teile basierend auf CARRY
            let totalCost = (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(carryParts).fill(CARRY).concat(Array(moveParts).fill(MOVE)) : 
                [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE]; // Fallback-Body (200 Kapazität)
        } else if (role === 'worker') {
            let workParts = Math.max(1, Math.min(Math.floor(energyAvailable / 200), 4)); // WORK-Teile (min 1, max 4)
            let carryParts = Math.max(1, Math.min(Math.floor((energyAvailable - workParts * 100) / 50), 2)); // CARRY-Teile
            let moveParts = Math.ceil((workParts + carryParts) / 2); // MOVE-Teile
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, CARRY, MOVE]; // Fallback-Body
        } else if (role === 'remoteHarvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyAvailable / 200), 5)); // WORK-Teile (min 2, max 5)
            let carryParts = 1; // 1 CARRY-Teil
            let moveParts = Math.ceil((workParts + carryParts) / 2); // MOVE-Teile
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, WORK, CARRY, MOVE]; // Fallback-Body
        } else if (role === 'scout') {
            body = [MOVE]; // Minimaler Körper: Nur MOVE
        }

        let name = role + '_' + Game.time; // Generiert eindeutigen Namen mit Rolle und Zeitstempel
        let memory = { role: role, working: false, homeRoom: homeRoom || spawn.room.name }; // Initialisiert Speicher

        // Rollen-spezifische Speicheranpassungen
        if (role === 'harvester') {
            let sources = spawn.room.find(FIND_SOURCES); // Findet Quellen im Raum
            if (!sources.length) {
                logger.warn('No sources in ' + spawn.room.name + ', skipping spawn'); // Keine Quellen -> überspringen
                return;
            }
            let harvestersPerSource = _.groupBy(_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === spawn.room.name), 'memory.source'); // Harvester pro Quelle
            let unoccupiedSources = sources.filter(s => !(s.id in harvestersPerSource)); // Unbesetzte Quellen
            let targetSource = unoccupiedSources.length > 0 ? unoccupiedSources[0] : _.min(sources, s => (harvestersPerSource[s.id] || []).length); // Wählt Quelle
            memory.source = targetSource.id; // Speichert Quellen-ID
        } else if (role === 'remoteHarvester') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : []; // Remote-Räume aus Heimatraum
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null); // Setzt Zielraum
            if (!memory.targetRoom) {
                logger.warn('No targetRoom for remoteHarvester in ' + homeRoom + ', skipping'); // Kein Zielraum -> überspringen
                return;
            }
            if (!Memory.remoteContainers[memory.targetRoom]) Memory.remoteContainers[memory.targetRoom] = []; // Initialisiert Remote-Container
            let remoteContainers = Memory.remoteContainers[memory.targetRoom];
            let assignedContainer = remoteContainers.find(c => !c.assignedHarvester); // Freier Container
            if (assignedContainer) {
                memory.containerId = assignedContainer.id; // Speichert Container-ID
                assignedContainer.assignedHarvester = name; // Weist Creep zu
            }
        } else if (role === 'scout') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : []; // Remote-Räume
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null); // Setzt Zielraum
            if (!memory.targetRoom) {
                logger.warn('No targetRoom for scout in ' + homeRoom + ', skipping spawn'); // Kein Zielraum -> überspringen
                return;
            }
        } else if (role === 'worker' && subRole) {
            memory.subRole = subRole; // Setzt Unterrolle für Worker
        }

        // Spawnt den Creep
        let result = spawn.spawnCreep(body, name, { memory: memory });
        if (result === OK) {
            logger.info('Spawned ' + name + ' in ' + spawn.room.name + ' with role ' + role + ' and body ' + JSON.stringify(body)); // Erfolg protokollieren
        } else {
            logger.error('Failed to spawn ' + name + ': ' + result); // Fehler protokollieren
        }
    }
};