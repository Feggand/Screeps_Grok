// taskManager.js
// Modul zur Verwaltung und Zuweisung von Aufgaben für Creeps und Türme

var logger = require('logger'); // Importiert Logging-Modul für Protokollierung

var taskManager = {
    // Funktion: Erstellt eine Liste von Aufgaben für Worker-Creeps
    getWorkerTasks: function(room) {
        let tasks = []; // Liste der Aufgaben

        // Reparatur von Wänden und Ramparts mit sehr niedrigen HP
        let damagedWalls = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003 // Weniger als 0.03% HP
        });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: wall.id, // Ziel-ID
                priority: 10 - (wall.hits / (wall.hitsMax * 0.5)) * 10 // Priorität: Höher bei geringerer HP
            });
        });

        // Reparatur von Straßen
        let damagedRoads = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax // Beschädigte Straßen
        });
        damagedRoads.forEach(road => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: road.id, // Ziel-ID
                priority: 5 // Mittlere Priorität
            });
        });

        // Bau von Baustellen
        let constructionSites = room.find(FIND_CONSTRUCTION_SITES); // Alle Baustellen im Raum
        constructionSites.forEach(site => {
            let priority = 10; // Standard-Priorität für Baustellen
            if (site.structureType === STRUCTURE_CONTAINER && site.pos.getRangeTo(room.controller) <= 3) { // Container nahe Controller
                priority = 14; // Höchste Priorität
            }
            tasks.push({
                type: 'construct', // Aufgabentyp: Bau
                target: site.id, // Ziel-ID
                priority: priority // Priorität je nach Typ
            });
        });

        // Upgrade des Controllers
        let controllerProgress = room.controller.progress / room.controller.progressTotal; // Fortschritt des Controllers
        let upgradePriority = 7 + (1 - controllerProgress) * 3; // Priorität steigt bei geringerem Fortschritt
        tasks.push({
            type: 'upgrade', // Aufgabentyp: Upgrade
            target: room.controller.id, // Ziel-ID
            priority: upgradePriority // Dynamische Priorität
        });

        tasks.sort((a, b) => b.priority - a.priority); // Sortiert Aufgaben nach absteigender Priorität
        logger.info('Worker tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks; // Gibt sortierte Aufgaben zurück
    },

    // Funktion: Erstellt eine Liste von Aufgaben für Hauler-Creeps
    getHaulerTasks: function(room) {
        let tasks = []; // Liste der Aufgaben

        // Energie liefern an Spawns, Extensions, Türme und Sender-Link
        let energyTargets = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_SPAWN || 
                                    structure.structureType === STRUCTURE_EXTENSION || 
                                    structure.structureType === STRUCTURE_TOWER || 
                                    (structure.structureType === STRUCTURE_LINK && structure.pos.getRangeTo(room.storage) <= 2)) && 
                                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 // Strukturen mit freier Kapazität
        });
        energyTargets.forEach(target => {
            let priority = 0; // Standard-Priorität
            if (target.structureType === STRUCTURE_TOWER && target.store[RESOURCE_ENERGY] < target.store.getCapacity(RESOURCE_ENERGY) * 0.75) { // Türme unter 75%
                priority = 14; // Höchste Priorität
            } else if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) { // Spawns und Extensions
                priority = 13; // Hohe Priorität
            } else if (target.structureType === STRUCTURE_LINK) { // Sender-Link
                priority = 12.5; // Zwischen Spawns und Controller-Container
            } else {
                priority = 5; // Niedrige Priorität
            }
            tasks.push({
                type: 'deliver', // Aufgabentyp: Liefern
                target: target.id, // Ziel-ID
                priority: priority // Priorität je nach Typ
            });
        });

        // Energie liefern an Controller-Container
        let controllerContainer = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 // Container mit freier Kapazität
        })[0];
        if (controllerContainer) {
            tasks.push({
                type: 'deliver', // Aufgabentyp: Liefern
                target: controllerContainer.id, // Ziel-ID
                priority: 12 // Hohe Priorität
            });
        }

        // Energie liefern an Storage
        let storageDeliver = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 // Storage mit freier Kapazität
        });
        storageDeliver.forEach(store => {
            tasks.push({
                type: 'deliver', // Aufgabentyp: Liefern
                target: store.id, // Ziel-ID
                priority: 4 // Niedrige Priorität
            });
        });

        // Energie sammeln aus Containern (außer Controller-Container)
        let containers = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && 
                                   structure.store[RESOURCE_ENERGY] > 0 && 
                                   (!room.controller || structure.pos.getRangeTo(room.controller) > 3) // Container außerhalb Controller-Reichweite
        });
        containers.forEach(container => {
            let energyPercentage = container.store[RESOURCE_ENERGY] / container.store.getCapacity(RESOURCE_ENERGY); // Energieanteil im Container
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: container.id, // Ziel-ID
                priority: 7 + energyPercentage * 3 // Priorität steigt mit Füllstand
            });
        });

        // Energie sammeln aus abgeworfenen Ressourcen
        let droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY // Nur Energie-Ressourcen
        });
        droppedEnergy.forEach(resource => {
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: resource.id, // Ziel-ID
                priority: 9 // Hohe Priorität für Loot
            });
        });

        // Energie sammeln aus Tombstones
        let tombstones = room.find(FIND_TOMBSTONES, {
            filter: (tombstone) => tombstone.store[RESOURCE_ENERGY] > 0 // Tombstones mit Energie
        });
        tombstones.forEach(tombstone => {
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: tombstone.id, // Ziel-ID
                priority: 9 // Hohe Priorität für Loot
            });
        });

        // Energie sammeln aus Storage
        let storageForCollect = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 0 // Storage mit Energie
        });
        storageForCollect.forEach(store => {
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: store.id, // Ziel-ID
                priority: 6 // Mittlere Priorität
            });
        });

        tasks.sort((a, b) => b.priority - a.priority); // Sortiert Aufgaben nach absteigender Priorität
        logger.info('Hauler tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks; // Gibt sortierte Aufgaben zurück
    },

    // Funktion: Erstellt eine Liste von Aufgaben für Harvester-Creeps
    getHarvesterTasks: function(room) {
        let tasks = []; // Liste der Aufgaben
        let assignedSources = _.map(_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.memory.task === 'harvest'), 'memory.targetId'); // Bereits zugewiesene Quellen

        // Energie ernten von Quellen mit Containern
        let sources = room.find(FIND_SOURCES); // Alle Quellen im Raum
        sources.forEach(source => {
            let container = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 // Container mit freier Kapazität
            })[0];
            if (container) {
                let harvestersAssigned = assignedSources.filter(id => id === source.id).length; // Anzahl zugewiesener Harvester
                let priority = harvestersAssigned === 0 ? 10 : 5; // Höhere Priorität für unbesetzte Quellen
                tasks.push({
                    type: 'harvest', // Aufgabentyp: Ernten
                    target: source.id, // Ziel-ID (Quelle)
                    containerId: container.id, // Container-ID
                    priority: priority // Priorität
                });
            }
        });

        // Container bauen bei Quellen ohne Container
        sources.forEach(source => {
            let container = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: (structure) => structure.structureType === STRUCTURE_CONTAINER })[0]; // Bestehender Container
            let site = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: (site) => site.structureType === STRUCTURE_CONTAINER })[0]; // Bestehende Baustelle
            if (!container && !site) { // Kein Container/Baustelle
                tasks.push({
                    type: 'constructContainer', // Aufgabentyp: Container bauen
                    target: source.id, // Ziel-ID (Quelle)
                    priority: 8 // Hohe Priorität
                });
            }
        });

        // Reparatur von Containern
        let containers = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.hits < structure.hitsMax // Beschädigte Container
        });
        containers.forEach(container => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: container.id, // Ziel-ID
                priority: 6 // Mittlere Priorität
            });
        });

        tasks.sort((a, b) => b.priority - a.priority); // Sortiert Aufgaben nach absteigender Priorität
        logger.info('Harvester tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks; // Gibt sortierte Aufgaben zurück
    },

    // Funktion: Erstellt eine Liste von Aufgaben für Türme
    getTowerTasks: function(room) {
        let tasks = []; // Liste der Aufgaben

        // Angriff auf feindliche Creeps
        let hostiles = room.find(FIND_HOSTILE_CREEPS); // Alle feindlichen Creeps
        hostiles.forEach(hostile => {
            tasks.push({
                type: 'attack', // Aufgabentyp: Angriff
                target: hostile.id, // Ziel-ID
                priority: 20 - hostile.pos.getRangeTo(room.controller) // Höhere Priorität bei Nähe zum Controller
            });
        });

        // Heilung von beschädigten eigenen Creeps
        let damagedCreeps = room.find(FIND_MY_CREEPS, { filter: (creep) => creep.hits < creep.hitsMax }); // Beschädigte Creeps
        damagedCreeps.forEach(creep => {
            tasks.push({
                type: 'heal', // Aufgabentyp: Heilung
                target: creep.id, // Ziel-ID
                priority: 15 - (creep.hits / creep.hitsMax) * 10 // Höhere Priorität bei geringerer HP
            });
        });

        // Reparatur von Straßen und Containern
        let damagedNonWalls = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) && structure.hits < structure.hitsMax // Beschädigte Strukturen
        });
        damagedNonWalls.forEach(structure => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: structure.id, // Ziel-ID
                priority: 10 - (structure.hits / structure.hitsMax) * 5 // Priorität basierend auf Schaden
            });
        });

        // Reparatur von Wänden und Ramparts mit sehr niedrigen HP
        let damagedWalls = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003 // Weniger als 0.03% HP
        });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: wall.id, // Ziel-ID
                priority: 5 // Niedrige Priorität
            });
        });

        tasks.sort((a, b) => b.priority - a.priority); // Sortiert Aufgaben nach absteigender Priorität
        logger.info('Tower tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks; // Gibt sortierte Aufgaben zurück
    },

    // Funktion: Weist einem Creep die höchstpriorisierte Aufgabe aus einer Liste zu
    assignTask: function(creep, tasks) {
        if (tasks.length > 0) { // Wenn Aufgaben verfügbar
            creep.memory.task = tasks[0].type; // Setzt Aufgabentyp
            creep.memory.targetId = tasks[0].target; // Setzt Ziel-ID
            if (tasks[0].containerId) creep.memory.containerId = tasks[0].containerId; // Setzt Container-ID (falls vorhanden)
            logger.info(creep.name + ': Aufgabe zugewiesen - ' + tasks[0].type + ' auf ' + tasks[0].target);
        } else { // Keine Aufgaben
            creep.memory.task = 'idle'; // Setzt auf Leerlauf
            creep.memory.targetId = null; // Kein Ziel
            delete creep.memory.containerId; // Löscht Container-ID
            logger.info(creep.name + ': Keine Aufgaben verfügbar, idle');
        }
    }
};

module.exports = taskManager; // Exportiert das taskManager-Objekt