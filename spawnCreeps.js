// spawnCreeps.js
// Modul zum Spawnen von Creeps mit dynamischen Körpern basierend auf Rolle und verfügbarer Energie

var logger = require('logger'); // Importiert das Logging-Modul für Protokollierung
var _ = require('lodash'); // Importiert Lodash für Array-Funktionen

module.exports = {
    /**
     * Funktion zum Spawnen eines Creeps mit spezifischer Rolle und Eigenschaften
     * @param {StructureSpawn} spawn - Der Spawn, der den Creep erzeugen soll
     * @param {string} role - Die Rolle des Creeps (z.B. 'harvester', 'defender')
     * @param {string|null} targetRoom - Der Zielraum für den Creep (falls zutreffend)
     * @param {string} homeRoom - Der Heimatraum des Creeps
     * @param {string|null} subRole - Eine Unterrolle (falls zutreffend, z.B. für Worker)
     */
    spawn: function(spawn, role, targetRoom, homeRoom, subRole) {
        let energyAvailable = spawn.room.energyAvailable; // Verfügbare Energie im Raum
        let energyCapacity = spawn.room.energyCapacityAvailable; // Maximale Energiekapazität im Raum
        let haulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.memory.homeRoom === spawn.room.name).length; // Anzahl der Hauler im Raum

        let minEnergyRequired = 0; // Minimale Energie, die für den Creep benötigt wird
        if (role === 'harvester' || role === 'remoteHarvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyCapacity / 200), 5)); // WORK-Teile basierend auf Kapazität (2-5)
            let carryParts = 1; // 1 CARRY-Teil
            let moveParts = Math.ceil((workParts + carryParts) / 2); // MOVE-Teile für Mobilität
            minEnergyRequired = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Kosten berechnen
        } else if (role === 'hauler' || role === 'remoteHauler') {
            let carryParts = Math.max(4, Math.min(Math.floor(energyCapacity / 100), 8)); // CARRY-Teile (4-8)
            let moveParts = Math.ceil(carryParts / 2); // MOVE-Teile
            minEnergyRequired = (carryParts * 50) + (moveParts * 50); // Kosten berechnen
        } else if (role === 'worker' || role === 'remoteWorker') {
            let workParts = Math.max(1, Math.min(Math.floor(energyCapacity / 200), 4)); // WORK-Teile (1-4)
            let carryParts = Math.max(1, Math.min(Math.floor((energyCapacity - workParts * 100) / 50), 2)); // CARRY-Teile (1-2)
            let moveParts = Math.ceil((workParts + carryParts) / 2); // MOVE-Teile
            minEnergyRequired = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Kosten berechnen
        } else if (role === 'scout') {
            minEnergyRequired = 50; // Nur 1 MOVE-Teil
        } else if (role === 'reserver') {
            let claimParts = Math.max(1, Math.min(Math.floor(energyCapacity / 650), 2)); // CLAIM-Teile (1-2)
            let moveParts = claimParts; // MOVE-Teile gleich CLAIM
            minEnergyRequired = (claimParts * 600) + (moveParts * 50); // Kosten berechnen
        } else if (role === 'mineralHarvester') {
            let workParts = Math.max(3, Math.min(Math.floor((energyCapacity - 100) / 100), 6)); // WORK-Teile (3-6)
            let carryParts = 1; // 1 CARRY-Teil
            let moveParts = 1; // 1 MOVE-Teil
            minEnergyRequired = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Kosten berechnen
        } else if (role === 'defender') {
            minEnergyRequired = 300; // Minimal 2 ATTACK + 2 MOVE (300 Energie)
        }

        // Prüft, ob genug Energie verfügbar ist (außer bei Haulern)
        if (haulers > 0 && energyAvailable < minEnergyRequired) {
            logger.info(`Waiting for required energy (${energyAvailable}/${minEnergyRequired}) in ${spawn.room.name} for ${role}`);
            return;
        }

        let body = []; // Körper des Creeps
        if (role === 'harvester' || role === 'remoteHarvester') {
            let workParts = Math.max(2, Math.min(Math.floor(energyAvailable / 200), 5)); // WORK-Teile
            let carryParts = 1; // 1 CARRY-Teil
            let moveParts = Math.ceil((workParts + carryParts) / 2); // MOVE-Teile
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, WORK, CARRY, MOVE]; // Fallback bei zu wenig Energie
        } else if (role === 'hauler' || role === 'remoteHauler') {
            let carryParts = Math.max(4, Math.min(Math.floor(energyAvailable / 100), 8)); // CARRY-Teile
            let moveParts = Math.ceil(carryParts / 2); // MOVE-Teile
            let totalCost = (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(carryParts).fill(CARRY).concat(Array(moveParts).fill(MOVE)) : 
                [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE]; // Fallback
        } else if (role === 'worker' || role === 'remoteWorker') {
            let workParts = Math.max(1, Math.min(Math.floor(energyAvailable / 200), 4)); // WORK-Teile
            let carryParts = Math.max(1, Math.min(Math.floor((energyAvailable - workParts * 100) / 50), 2)); // CARRY-Teile
            let moveParts = Math.ceil((workParts + carryParts) / 2); // MOVE-Teile
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, CARRY, MOVE]; // Fallback
        } else if (role === 'scout') {
            body = [MOVE]; // Einfacher Körper
        } else if (role === 'reserver') {
            let claimParts = Math.max(1, Math.min(Math.floor(energyAvailable / 650), 2)); // CLAIM-Teile
            let moveParts = claimParts; // MOVE-Teile
            let totalCost = (claimParts * 600) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(claimParts).fill(CLAIM).concat(Array(moveParts).fill(MOVE)) : 
                [CLAIM, MOVE]; // Fallback
        } else if (role === 'mineralHarvester') {
            let workParts = Math.max(3, Math.min(Math.floor((energyAvailable - 100) / 100), 6)); // WORK-Teile
            let carryParts = 1; // 1 CARRY-Teil
            let moveParts = 1; // 1 MOVE-Teil
            let totalCost = (workParts * 100) + (carryParts * 50) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(workParts).fill(WORK).concat(Array(carryParts).fill(CARRY)).concat(Array(moveParts).fill(MOVE)) : 
                [WORK, WORK, WORK, CARRY, MOVE]; // Fallback
        } else if (role === 'defender') {
            let attackParts = Math.max(2, Math.min(Math.floor(energyAvailable / 130), 4)); // ATTACK-Teile (80 Energie pro Teil)
            let moveParts = Math.ceil(attackParts / 2); // MOVE-Teile (50 Energie pro Teil)
            let totalCost = (attackParts * 80) + (moveParts * 50); // Gesamtkosten
            body = totalCost <= energyAvailable ? 
                Array(attackParts).fill(ATTACK).concat(Array(moveParts).fill(MOVE)) : 
                [ATTACK, ATTACK, MOVE, MOVE]; // Fallback: 300 Energie
        }

        let name = role + '_' + Game.time; // Eindeutiger Name mit Zeitstempel
        let memory = { role: role, working: false, homeRoom: homeRoom || spawn.room.name }; // Basis-Memory

        // Spezifische Memory-Anpassungen je nach Rolle
        if (role === 'harvester') {
            let sources = spawn.room.find(FIND_SOURCES);
            if (!sources.length) {
                logger.warn('No sources in ' + spawn.room.name + ', skipping spawn');
                return;
            }
            let harvestersPerSource = _.groupBy(_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.room.name === spawn.room.name), 'memory.source');
            let unoccupiedSources = sources.filter(s => !(s.id in harvestersPerSource));
            let targetSource = unoccupiedSources.length > 0 ? unoccupiedSources[0] : _.min(sources, s => (harvestersPerSource[s.id] || []).length);
            memory.source = targetSource.id; // Weise eine Quelle zu
        } else if (role === 'remoteHarvester' || role === 'remoteHauler' || role === 'remoteWorker') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : [];
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null); // Zielraum
            if (!memory.targetRoom) {
                logger.warn(`No targetRoom for ${role} in ${homeRoom}, skipping`);
                return;
            }
            if (role === 'remoteHarvester') {
                if (!Memory.remoteContainers[memory.targetRoom]) Memory.remoteContainers[memory.targetRoom] = [];
                let remoteContainers = Memory.remoteContainers[memory.targetRoom];
                let assignedContainer = remoteContainers.find(c => !c.assignedHarvester);
                if (assignedContainer) {
                    memory.containerId = assignedContainer.id;
                    assignedContainer.assignedHarvester = name; // Weise Container zu
                }
            }
        } else if (role === 'scout') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : [];
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null); // Zielraum
            if (!memory.targetRoom) {
                logger.warn('No targetRoom for scout in ' + homeRoom + ', skipping spawn');
                return;
            }
        } else if (role === 'worker' && subRole) {
            memory.subRole = subRole; // Unterrolle für Worker
        } else if (role === 'reserver') {
            let homeRoomMemory = Memory.rooms[homeRoom];
            let remoteRooms = homeRoomMemory && homeRoomMemory.remoteRooms ? homeRoomMemory.remoteRooms : [];
            memory.targetRoom = targetRoom || (remoteRooms.length > 0 ? remoteRooms[0] : null); // Zielraum
            if (!memory.targetRoom) {
                logger.warn('No targetRoom for reserver in ' + homeRoom + ', skipping spawn');
                return;
            }
        } else if (role === 'mineralHarvester') {
            memory.targetRoom = targetRoom || spawn.room.name; // Zielraum
        } else if (role === 'defender') {
            memory.targetRoom = targetRoom; // Zielraum für Verteidiger
        }

        // Versucht, den Creep zu spawnen
        let result = spawn.spawnCreep(body, name, { memory: memory });
        if (result === OK) {
            logger.info('Spawned ' + name + ' in ' + spawn.room.name + ' with role ' + role + ' and body ' + JSON.stringify(body));
        } else {
            logger.error('Failed to spawn ' + name + ': ' + result);
        }
    }
};