// spawnManager.js
var spawnCreeps = require('spawnCreeps'); // Importiert das Modul zum Spawnen von Creeps
var logger = require('logger'); // Importiert das Logging-Modul

module.exports = {
    manageSpawns: function(room) {
        // Verwaltet das Spawnen von Creeps im übergebenen Raum
        let roomMemory = Memory.rooms[room.name] || {}; // Zugriff auf den Speicher des Raums, falls nicht vorhanden leerer Fallback
        if (!roomMemory.isMyRoom) return; // Beendet die Funktion, wenn der Raum nicht mir gehört

        // Ermittelt Container und deren Energie
        let containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
        let totalContainerEnergy = containers.reduce((sum, c) => sum + c.store[RESOURCE_ENERGY], 0); // Summiert Energie in Containern
        let sources = room.find(FIND_SOURCES); // Findet alle Energiequellen im Raum
        let storage = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0]; // Findet das Storage im Raum

        // Setzt Mindestanforderungen für Harvester und Hauler
        roomMemory.minHarvesters = sources.length; // Mindestens ein Harvester pro Quelle
        roomMemory.minHaulers = Math.min(3, Math.max(2, Math.ceil(totalContainerEnergy / 1000))); // Hauler basierend auf Containerenergie (2-3)
        
        // Berechnet Mindestanforderungen für Worker
        let extraWorkers = (room.find(FIND_CONSTRUCTION_SITES).length > 0 ? 1 : 0) + 
                          (room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }).length > 0 ? 1 : 0); // Zusätzliche Worker bei Baustellen/Reparaturen
        let baseWorkers = 2 + extraWorkers + Math.floor(totalContainerEnergy / 500); // Basis-Worker plus Containerenergie
        let storageFillPercentage = storage && storage.store[RESOURCE_ENERGY] > 0 ? (storage.store[RESOURCE_ENERGY] / storage.store.getCapacity(RESOURCE_ENERGY)) : 0; // Füllstand des Storages in Prozent
        let additionalWorkers = storageFillPercentage >= 0.65 ? Math.floor((storageFillPercentage - 0.65) * 40) : 0; // Zusätzliche Worker bei hohem Füllstand
        roomMemory.minWorkers = Math.min(12, Math.max(2, baseWorkers + additionalWorkers)); // Begrenzt Worker auf min 2, max 12

        // Berechnet Anforderungen für Remote-Räume
        let totalRemoteSources = 0;
        const remoteRooms = roomMemory.remoteRooms || []; // Liste der Remote-Räume
        const remoteRoomNeeds = {};
        remoteRooms.forEach(remoteRoomName => {
            const remoteRoom = Game.rooms[remoteRoomName];
            let sourceCount = 0;
            if (remoteRoom) {
                const sources = remoteRoom.find(FIND_SOURCES);
                sourceCount = sources.length; // Anzahl der Quellen im sichtbaren Remote-Raum
            } else {
                sourceCount = 2; // Annahme für unsichtbare Räume
            }
            totalRemoteSources += sourceCount;
            remoteRoomNeeds[remoteRoomName] = sourceCount; // Speichert Bedarf pro Remote-Raum
        });
        roomMemory.minRemoteHarvesters = Math.min(totalRemoteSources, remoteRooms.length * 2); // Max 2 Harvester pro Remote-Raum
        roomMemory.minRemoteHaulers = remoteRooms.length * 2; // 2 Hauler pro Remote-Raum
        roomMemory.minRemoteWorkers = remoteRooms.length; // 1 Worker pro Remote-Raum

        // Mineral-Harvester-Anforderungen basierend auf verfügbaren Extractoren
        let extractorCount = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length; // Extractoren im Hauptraum
        remoteRooms.forEach(remoteRoomName => {
            const remoteRoom = Game.rooms[remoteRoomName];
            if (remoteRoom) {
                extractorCount += remoteRoom.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length; // Extractoren in Remote-Räumen
            }
        });
        roomMemory.minMineralHarvesters = room.controller.level >= 6 ? Math.min(extractorCount, 2) : 0; // Maximal 2, abhängig von Extractoren und Level >= 6

        // Zählt aktuelle Creeps im Raum
        let creeps = _.filter(Game.creeps, c => c.memory.homeRoom === room.name || (!c.memory.homeRoom && c.room.name === room.name));
        let harvesters = _.countBy(creeps, 'memory.role').harvester || 0;
        let haulers = _.countBy(creeps, 'memory.role').hauler || 0;
        let workers = _.countBy(creeps, 'memory.role').worker || 0;
        let remoteHarvesters = _.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name).length;
        let remoteHaulers = _.filter(Game.creeps, c => c.memory.role === 'remoteHauler' && c.memory.homeRoom === room.name).length;
        let remoteWorkers = _.filter(Game.creeps, c => c.memory.role === 'remoteWorker' && c.memory.homeRoom === room.name).length;
        let reservers = _.filter(Game.creeps, c => c.memory.role === 'reserver' && c.memory.homeRoom === room.name).length;
        let mineralHarvesters = _.filter(Game.creeps, c => c.memory.role === 'mineralHarvester' && c.memory.homeRoom === room.name).length;

        // Loggt den aktuellen Status des Raums
        logger.info('Room ' + room.name + ': Harvesters=' + harvesters + '/' + roomMemory.minHarvesters + 
                    ', Haulers=' + haulers + '/' + roomMemory.minHaulers + 
                    ', Workers=' + workers + '/' + roomMemory.minWorkers + 
                    ', RemoteHarvesters=' + remoteHarvesters + '/' + roomMemory.minRemoteHarvesters + 
                    ', RemoteHaulers=' + remoteHaulers + '/' + roomMemory.minRemoteHaulers +
                    ', RemoteWorkers=' + remoteWorkers + '/' + roomMemory.minRemoteWorkers +
                    ', Reservers=' + reservers + '/' + remoteRooms.length +
                    ', MineralHarvesters=' + mineralHarvesters + '/' + roomMemory.minMineralHarvesters +
                    ', Energy=' + room.energyAvailable + ', TotalContainerEnergy=' + totalContainerEnergy +
                    ', StorageFill=' + (storageFillPercentage * 100).toFixed(1) + '%');

        // Prüft, ob ein Spawn verfügbar ist
        let spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn || spawn.spawning) {
            if (spawn && spawn.spawning) {
                logger.info('Spawn in ' + room.name + ' is busy spawning: ' + spawn.spawning.name); // Loggt, wenn Spawn beschäftigt ist
            }
            return; // Beendet Funktion, wenn kein Spawn verfügbar
        }

        // Notfall-Spawn: Harvester und Hauler haben höchste Priorität
        if (harvesters < roomMemory.minHarvesters && room.energyAvailable >= 300) {
            spawnCreeps.spawn(spawn, 'harvester', null, room.name);
            logger.info('Spawning new harvester in ' + room.name + ' (emergency)');
            return;
        }

        if (haulers < roomMemory.minHaulers && room.energyAvailable >= 300) {
            spawnCreeps.spawn(spawn, 'hauler', null, room.name);
            logger.info('Spawning new hauler in ' + room.name + ' (emergency)');
            return;
        }

        // Prüft Aufgaben in Nebenräumen für remoteWorker
        let remoteTasksExist = false;
        let targetRoomForWorker = null;
        for (let remoteRoomName of remoteRooms) {
            const remoteRoom = Game.rooms[remoteRoomName];
            const currentWorkers = _.filter(Game.creeps, c => c.memory.role === 'remoteWorker' && c.memory.targetRoom === remoteRoomName).length;
            if (currentWorkers >= 1) continue; // Überspringt Räume mit bereits einem Worker

            if (remoteRoom) {
                const repairTasks = remoteRoom.find(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
                }).length; // Anzahl Reparaturaufgaben
                const constructionTasks = remoteRoom.find(FIND_CONSTRUCTION_SITES).length; // Anzahl Baustellen
                if (repairTasks > 0 || constructionTasks > 0) {
                    remoteTasksExist = true;
                    targetRoomForWorker = remoteRoomName; // Zielraum für Worker
                    break;
                }
            }
        }

        // Spawn-Logik für Worker
        if (workers < roomMemory.minWorkers && room.energyAvailable >= 200) {
            let workerRoles = ['upgrader', 'repairer', 'wallRepairer', 'flexible']; // Mögliche Unterrollen
            let existingWorkers = _.filter(Game.creeps, c => c.memory.role === 'worker' && c.memory.homeRoom === room.name);
            let roleCounts = _.countBy(existingWorkers, 'memory.subRole');
            let nextRole = workerRoles.find(role => !roleCounts[role] || roleCounts[role] < 1) || 'flexible'; // Wählt nächste freie Rolle
            spawnCreeps.spawn(spawn, 'worker', null, room.name, nextRole);
            logger.info('Spawning new worker with subRole ' + nextRole + ' in ' + room.name);
            return;
        }

        // Spawn-Logik für Reserver
        if (room.controller.level >= 4 && room.energyAvailable >= 650) {
            for (let i = 0; i < remoteRooms.length; i++) {
                let remoteRoomName = remoteRooms[i];
                let reserversInRoom = _.filter(Game.creeps, c => c.memory.role === 'reserver' && c.memory.targetRoom === remoteRoomName);
                let roomVisible = Game.rooms[remoteRoomName];
                let needsReserver = !roomVisible || (roomVisible && roomVisible.controller && !roomVisible.controller.my && (!roomVisible.controller.reservation || roomVisible.controller.reservation.ticksToEnd < 5000));
                if (needsReserver && (reserversInRoom.length === 0 || (reserversInRoom.length === 1 && reserversInRoom[0].ticksToLive < 60))) {
                    spawnCreeps.spawn(spawn, 'reserver', remoteRoomName, room.name);
                    logger.info(`Spawning new reserver for ${remoteRoomName} in ${room.name}`);
                    return;
                }
            }
        }

        // Spawn-Logik für Remote-Harvester
        if (remoteHarvesters < roomMemory.minRemoteHarvesters && room.energyAvailable >= 300) {
            let targetRoom = null;
            let minHarvesterCount = Infinity;
            for (let remoteRoomName of remoteRooms) {
                const currentHarvesters = _.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.targetRoom === remoteRoomName).length;
                if (currentHarvesters < 2 && currentHarvesters < minHarvesterCount) {
                    targetRoom = remoteRoomName;
                    minHarvesterCount = currentHarvesters; // Wählt Raum mit wenigsten Harvestern
                }
            }
            if (targetRoom) {
                let idleCreep = _.find(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.homeRoom === room.name && (!c.memory.targetRoom || remoteRoomNeeds[c.memory.targetRoom] === 0));
                if (idleCreep) {
                    idleCreep.memory.targetRoom = targetRoom;
                    logger.info(`Reassigned ${idleCreep.name} to ${targetRoom}`); // Weist inaktiven Harvester neu zu
                } else {
                    spawnCreeps.spawn(spawn, 'remoteHarvester', targetRoom, room.name);
                    logger.info('Spawning new remoteHarvester for ' + targetRoom + ' in ' + room.name);
                }
                return;
            } else {
                logger.info('No suitable remote room with unassigned sources found');
            }
        } 
        // Spawn-Logik für Remote-Hauler
        else if (remoteHaulers < roomMemory.minRemoteHaulers && room.energyAvailable >= 300) {
            let targetRoom = null;
            let minHaulerCount = Infinity;
            for (let remoteRoomName of remoteRooms) {
                const currentHaulers = _.filter(Game.creeps, c => c.memory.role === 'remoteHauler' && c.memory.targetRoom === remoteRoomName).length;
                if (currentHaulers < 2 && currentHaulers < minHaulerCount) {
                    targetRoom = remoteRoomName;
                    minHaulerCount = currentHaulers; // Wählt Raum mit wenigsten Haulern
                }
            }
            if (targetRoom) {
                spawnCreeps.spawn(spawn, 'remoteHauler', targetRoom, room.name);
                logger.info('Spawning new remoteHauler for ' + targetRoom + ' in ' + room.name);
                return;
            } else {
                logger.info('No suitable remote room needing hauler found');
            }
        } 
        // Spawn-Logik für Remote-Worker
        else if (remoteWorkers < roomMemory.minRemoteWorkers && remoteTasksExist && room.energyAvailable >= 200) {
            spawnCreeps.spawn(spawn, 'remoteWorker', targetRoomForWorker, room.name);
            logger.info('Spawning new remoteWorker for ' + targetRoomForWorker + ' in ' + room.name);
            return;
        } 
        // Spawn-Logik für Mineral-Harvester mit Mineralgrenze von 15.000
        else if (mineralHarvesters < roomMemory.minMineralHarvesters && room.energyAvailable >= 350) {
            let targetRoom = null;
            if (mineralHarvesters === 0 && room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length > 0) {
                targetRoom = room.name; // Hauptraum, wenn Extractor vorhanden und kein Harvester aktiv
            } else if (mineralHarvesters === 1) {
                for (let remoteRoomName of remoteRooms) {
                    let remoteRoom = Game.rooms[remoteRoomName];
                    if (remoteRoom && remoteRoom.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR }).length > 0) {
                        targetRoom = remoteRoomName; // Erster Remote-Raum mit Extractor
                        break;
                    }
                }
            }
            if (targetRoom) {
                // Prüft die Mineralmenge im Storage des Hauptraums
                let mineralType = room.find(FIND_MINERALS)[0].mineralType; // Typ des Minerals im Hauptraum
                let mineralAmountInStorage = storage && storage.store[mineralType] ? storage.store[mineralType] : 0; // Menge des Minerals im Storage
                if (mineralAmountInStorage < 15000) { // Nur spawnen, wenn unter 15.000 Einheiten
                    spawnCreeps.spawn(spawn, 'mineralHarvester', targetRoom, room.name);
                    logger.info('Spawning new mineralHarvester for ' + targetRoom + ' in ' + room.name);
                    return;
                } else {
                    logger.info('Mineral storage limit of 15,000 reached in ' + room.name + ', not spawning mineralHarvester');
                }
            } else {
                logger.info('No suitable room with extractor found for mineralHarvester in ' + room.name);
            }
        } else {
            logger.info('No spawning needed in ' + room.name + ': All minimum requirements met or exceeded');
        }

        roomMemory.harvesterSpawnedThisTick = false; // Setzt Flag zurück
    }
};