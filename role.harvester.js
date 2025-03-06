// role.harvester.js
// Logik für Harvester-Creeps, die Energie abbauen und in Container oder Links lagern
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren, mit verbessertem Logging und Fehlerbehandlung

var logger = require('logger'); // Importiert das Logging-Modul für Debugging und Protokollierung
var taskManager = require('taskManager'); // Importiert das Task-Manager-Modul für Aufgabenverwaltung

module.exports.run = function(creep, cachedData) {
    // Prüft, ob die aktuelle Aufgabe noch gültig ist
    let taskValid = false;
    let target = creep.memory.targetId ? Game.getObjectById(creep.memory.targetId) : null; // Direktes Laden nur bei Bedarf

    // Überprüfe Sichtbarkeit der Quelle unabhängig von der Aufgabe
    if (creep.memory.targetId && !target) {
        target = creep.room.find(FIND_SOURCES, { filter: s => s.id === creep.memory.targetId })[0];
        if (!target) {
            // Bewege den Harvester zur letzten bekannten Position der Quelle
            let roomName = creep.memory.targetId.split('_')[0]; // Extrahiert den Raumnamen aus der ID
            let targetPos = new RoomPosition(25, 25, roomName); // Annähernde Mitte des Raums
            creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#ff0000' } });
            return; // Warte auf nächste Tick, um Sichtbarkeit zu aktualisieren
        }
    }

    if (creep.memory.task && target) {
        if (creep.memory.task === 'harvest') {
            let container = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
            // Nutzt cachedData für Container, falls verfügbar
            if (!container && cachedData && cachedData.containers) {
                container = cachedData.containers.find(c => c.id === creep.memory.containerId);
            }
            taskValid = target.energy > 0 && container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            if (!taskValid) {
                logger.warn(`${creep.name}: Task 'harvest' invalid - source.energy: ${target.energy || 'N/A'}, container: ${container ? 'exists' : 'null'}, container capacity: ${container ? container.store.getFreeCapacity(RESOURCE_ENERGY) : 'N/A'}`);
            }
        } else if (creep.memory.task === 'constructContainer') {
            taskValid = !target.pos.findInRange(cachedData ? cachedData.structures : FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0]; // Nutzt cached structures, falls verfügbar
        } else if (creep.memory.task === 'repair') {
            taskValid = target.hits < target.hitsMax;
        }
    }

    // Wenn die Aufgabe ungültig ist oder keine existiert, neue zuweisen
    if (!taskValid || !creep.memory.task) {
        let tasks = taskManager.getHarvesterTasks(creep.room, cachedData); // Übergibt cachedData an taskManager
        taskManager.assignTask(creep, tasks);
        // Sofortige Überprüfung nach Aufgabe zuweisung
        target = creep.memory.targetId ? Game.getObjectById(creep.memory.targetId) : null;
        if (creep.memory.targetId && !target) {
            target = creep.room.find(FIND_SOURCES, { filter: s => s.id === creep.memory.targetId })[0];
            if (!target) {
                let roomName = creep.memory.targetId.split('_')[0]; // Extrahiert den Raumnamen aus der ID
                let targetPos = new RoomPosition(25, 25, roomName); // Annähernde Mitte des Raums
                creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#ff0000' } });
                return; // Warte auf nächste Tick, um Sichtbarkeit zu aktualisieren
            }
        }
    }

    // Führt die zugewiesene Aufgabe aus
    if (creep.memory.task === 'harvest') {
        let source = target; // target ist bereits geladen oder neu gesucht
        let container = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
        // Nutzt cachedData für Container, falls verfügbar
        if (!container && cachedData && cachedData.containers) {
            container = cachedData.containers.find(c => c.id === creep.memory.containerId);
        }
        if (!source) {
            logger.warn(`${creep.name}: Ungültige Quelle ${creep.memory.targetId} nach erneuter Suche, Aufgabe zurückgesetzt`);
            delete creep.memory.task;
            delete creep.memory.targetId;
            delete creep.memory.containerId;
            return;
        }
        if (!container) {
            logger.warn(`${creep.name}: Ungültiger Container ${creep.memory.containerId}, Aufgabe zurückgesetzt`);
            delete creep.memory.task;
            delete creep.memory.targetId;
            delete creep.memory.containerId;
            return;
        }

        if (creep.store.getFreeCapacity() > 0) { // Wenn Creep Platz für Energie hat
            if (creep.pos.isEqualTo(container.pos)) { // Bereits auf Container-Position
                let result = creep.harvest(source);
                if (result === OK) {
                    logger.info(`${creep.name}: Harvesting source ${source.id}`);
                } else {
                    logger.warn(`${creep.name}: Harvesting failed: ${result}`);
                }
            } else {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(`${creep.name}: Moving to container at ${container.pos}`);
            }
        } else { // Creep ist voll
            // Prüft auf einen Link in Reichweite 1 mit cachedData
            let nearbyLink = creep.pos.findInRange(cachedData ? cachedData.structures : FIND_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_LINK && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            })[0];

            if (nearbyLink) { // Wenn ein Link in Reichweite ist und Platz hat
                let result = creep.transfer(nearbyLink, RESOURCE_ENERGY);
                if (result === OK) {
                    logger.info(`${creep.name}: Transferring to link ${nearbyLink.id}`);
                } else if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(nearbyLink, { visualizePathStyle: { stroke: '#ffffff' } });
                    logger.info(`${creep.name}: Moving to link ${nearbyLink.id} to transfer`);
                } else {
                    logger.warn(`${creep.name}: Transfer to link failed: ${result}`);
                }
            } else { // Kein Link oder Link voll, Energie in Container übertragen
                let result = creep.transfer(container, RESOURCE_ENERGY);
                if (result === OK) {
                    logger.info(`${creep.name}: Transferring to container ${container.id}`);
                } else if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } });
                } else {
                    logger.warn(`${creep.name}: Transfer failed: ${result}`);
                }
            }
        }
    } else if (creep.memory.task === 'constructContainer') {
        let source = target; // target ist bereits geladen oder neu gesucht
        if (!source) {
            logger.warn(`${creep.name}: Ungültige Quelle, Aufgabe zurückgesetzt`);
            delete creep.memory.task;
            delete creep.memory.targetId;
            return;
        }

        let site = source.pos.findInRange(cachedData ? cachedData.constructionSites : FIND_CONSTRUCTION_SITES, 1, { 
            filter: s => s.structureType === STRUCTURE_CONTAINER 
        })[0]; // Nutzt cached constructionSites, falls verfügbar
        if (!site && creep.store[RESOURCE_ENERGY] > 0) {
            let result = creep.room.createConstructionSite(source.pos.x, source.pos.y + 1, STRUCTURE_CONTAINER);
            if (result === OK) {
                logger.info(`${creep.name}: Creating container construction site near source ${source.id}`);
            } else {
                logger.warn(`${creep.name}: Failed to create container site: ${result}`);
            }
        } else if (site) {
            if (creep.build(site) === ERR_NOT_IN_RANGE) {
                creep.moveTo(site, { visualizePathStyle: { stroke: '#0000ff' } });
                logger.info(`${creep.name}: Moving to build container at ${site.pos}`);
            } else {
                logger.info(`${creep.name}: Building container at ${site.pos}`);
            }
        } else {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(`${creep.name}: Moving to source ${source.id} to gather energy`);
            } else {
                logger.info(`${creep.name}: Harvesting source ${source.id} for construction`);
            }
        }
    } else if (creep.memory.task === 'repair') {
        let target = Game.getObjectById(creep.memory.targetId); // Direktes Laden, da target dynamisch sein kann
        if (!target) {
            logger.warn(`${creep.name}: Ungültiges Reparaturziel, Aufgabe zurückgesetzt`);
            delete creep.memory.task;
            delete creep.memory.targetId;
            return;
        }

        if (creep.store[RESOURCE_ENERGY] > 0) {
            if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                logger.info(`${creep.name}: Moving to repair ${target.structureType} at ${target.pos}`);
            } else {
                logger.info(`${creep.name}: Repairing ${target.structureType} at ${target.pos}`);
            }
        } else {
            // Nutzt cachedData für die nächste Quelle
            let source = creep.pos.findClosestByPath(cachedData ? cachedData.sources : FIND_SOURCES);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(`${creep.name}: Moving to source ${source.id} for energy`);
            }
        }
    } else if (creep.memory.task === 'idle') {
        let spawn = creep.pos.findClosestByPath(cachedData ? cachedData.structures : FIND_MY_SPAWNS, {
            filter: s => s.structureType === STRUCTURE_SPAWN
        });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(`${creep.name}: Idle, moving to spawn ${spawn.id}`);
        }
    }
};