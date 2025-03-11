// taskManager.js
// Modul zur Verwaltung und Zuweisung von Aufgaben für Creeps und Türme
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren

var logger = require('logger'); // Importiert Logging-Modul für Protokollierung
var _ = require('lodash'); // Importiert Lodash für Array-Funktionen

var taskManager = {
    // Funktion: Erstellt eine Liste von Aufgaben für Worker-Creeps (Arbeitsmodus)
    getWorkerTasks: function (room, cachedData) {
        let tasks = []; // Liste der Aufgaben

        // Reparatur von Wänden und Ramparts mit sehr niedrigen HP
        let damagedWalls = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003
            });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: wall.id, // Ziel-ID
                priority: 10 - (wall.hits / (wall.hitsMax * 0.5)) * 10 // Priorität: Höher bei geringerer HP
            });
        });

        // Reparatur von Straßen
        let damagedRoads = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax
            });
        damagedRoads.forEach(road => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: road.id, // Ziel-ID
                priority: 5 // Mittlere Priorität
            });
        });

        // Bau von Baustellen
        let constructionSites = (cachedData && cachedData.constructionSites) || room.find(FIND_CONSTRUCTION_SITES); // Nutzt cached constructionSites
        constructionSites.forEach(site => {
            let priority = 15; // Standard-Priorität für Baustellen
            if (site.structureType === STRUCTURE_CONTAINER && site.pos.getRangeTo(room.controller) <= 3) { // Container nahe Controller
                priority = 20; // Höchste Priorität
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
    getHaulerTasks: function (room, cachedData) {
        let tasks = []; // Liste der Aufgaben

        // Energie liefern an Spawns, Extensions, Türme und Sender-Link
        let energyTargets = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => (structure.structureType === STRUCTURE_SPAWN ||
                structure.structureType === STRUCTURE_EXTENSION ||
                structure.structureType === STRUCTURE_TOWER ||
                (structure.structureType === STRUCTURE_LINK && structure.pos.getRangeTo(room.storage) <= 2)) &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType === STRUCTURE_SPAWN ||
                    structure.structureType === STRUCTURE_EXTENSION ||
                    structure.structureType === STRUCTURE_TOWER ||
                    (structure.structureType === STRUCTURE_LINK && structure.pos.getRangeTo(room.storage) <= 2)) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
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
        let controllerContainer = (cachedData && cachedData.structures) ?
            cachedData.structures.find(structure => structure.structureType === STRUCTURE_CONTAINER &&
                structure.pos.getRangeTo(room.controller) <= 3 &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) :
            room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            })[0];
        if (controllerContainer) {
            tasks.push({
                type: 'deliver', // Aufgabentyp: Liefern
                target: controllerContainer.id, // Ziel-ID
                priority: 12 // Hohe Priorität
            });
        }

        // Energie liefern an Storage
        let storageDeliver = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => structure.structureType === STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
        storageDeliver.forEach(store => {
            tasks.push({
                type: 'deliver', // Aufgabentyp: Liefern
                target: store.id, // Ziel-ID
                priority: 4 // Niedrige Priorität
            });
        });

        // Energie sammeln aus Containern (außer Controller-Container)
        let containers = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => structure.structureType === STRUCTURE_CONTAINER &&
                structure.store[RESOURCE_ENERGY] > 0 &&
                (!room.controller || structure.pos.getRangeTo(room.controller) > 3)) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_CONTAINER &&
                    structure.store[RESOURCE_ENERGY] > 0 &&
                    (!room.controller || structure.pos.getRangeTo(room.controller) > 3)
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
                priority: 5 // Hohe Priorität für Loot
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
                priority: 5 // Hohe Priorität für Loot
            });
        });

        // Energie sammeln aus Storage
        let storageForCollect = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => structure.structureType === STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 0) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 0
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
    getHarvesterTasks: function (room, cachedData) {
        let tasks = []; // Liste der Aufgaben
        let assignedSources = _.map(_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.memory.task === 'harvest'), 'memory.targetId'); // Bereits zugewiesene Quellen

        // Energie ernten von Quellen mit Containern
        let sources = (cachedData && cachedData.sources) || room.find(FIND_SOURCES); // Nutzt cached sources
        sources.forEach(source => {
            let containers = (cachedData && cachedData.structures) ?
                cachedData.structures.filter(structure => structure.structureType === STRUCTURE_CONTAINER && structure.pos.inRangeTo(source.pos, 1)) :
                source.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
                });
            let container = containers.find(c => c.store.getFreeCapacity(RESOURCE_ENERGY) > 0); // Wählt einen Container mit freier Kapazität
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
            let containers = (cachedData && cachedData.structures) ?
                cachedData.structures.filter(structure => structure.structureType === STRUCTURE_CONTAINER && structure.pos.inRangeTo(source.pos, 1)) :
                source.pos.findInRange(FIND_STRUCTURES, 1, { filter: (structure) => structure.structureType === STRUCTURE_CONTAINER });
            let site = (cachedData && cachedData.constructionSites) ?
                cachedData.constructionSites.find(s => s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(source.pos, 1)) :
                source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: (site) => site.structureType === STRUCTURE_CONTAINER })[0];
            if (!containers.length && !site) { // Kein Container/Baustelle
                tasks.push({
                    type: 'constructContainer', // Aufgabentyp: Container bauen
                    target: source.id, // Ziel-ID (Quelle)
                    priority: 8 // Hohe Priorität
                });
            }
        });

        // Reparatur von Containern
        let containers = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => structure.structureType === STRUCTURE_CONTAINER && structure.hits < structure.hitsMax) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.hits < structure.hitsMax
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
    getTowerTasks: function (room, cachedData) {
        let tasks = []; // Liste der Aufgaben

        // Angriff auf feindliche Creeps
        let hostiles = room.find(FIND_HOSTILE_CREEPS); // Kein Caching, da dynamisch
        hostiles.forEach(hostile => {
            tasks.push({
                type: 'attack', // Aufgabentyp: Angriff
                target: hostile.id, // Ziel-ID
                priority: 20 - hostile.pos.getRangeTo(room.controller) // Höhere Priorität bei Nähe zum Controller
            });
        });

        // Heilung von beschädigten eigenen Creeps
        let damagedCreeps = room.find(FIND_MY_CREEPS, { filter: (creep) => creep.hits < creep.hitsMax }); // Kein Caching, da dynamisch
        damagedCreeps.forEach(creep => {
            tasks.push({
                type: 'heal', // Aufgabentyp: Heilung
                target: creep.id, // Ziel-ID
                priority: 15 - (creep.hits / creep.hitsMax) * 10 // Höhere Priorität bei geringerer HP
            });
        });

        // Reparatur von Straßen und Containern
        let damagedNonWalls = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) && structure.hits < structure.hitsMax) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) && structure.hits < structure.hitsMax
            });
        damagedNonWalls.forEach(structure => {
            tasks.push({
                type: 'repair', // Aufgabentyp: Reparatur
                target: structure.id, // Ziel-ID
                priority: 10 - (structure.hits / structure.hitsMax) * 5 // Priorität basierend auf Schaden
            });
        });

        // Reparatur von Wänden und Ramparts mit sehr niedrigen HP
        let damagedWalls = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(structure => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003) :
            room.find(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003
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

    // Funktion: Erstellt eine Liste von Sammelaufgaben für Worker-Creeps (Energiesammelmodus)
    // Priorität wird basierend auf Entfernung zum Creep berechnet, Entfernung stärker gewichtet
    getWorkerCollectTasks: function (creep, cachedData) {
        let tasks = []; // Liste der Aufgaben
        let room = creep.room;

        // Priorität 1: Receiver-Link (nahe Controller)
        let receiverLink = (cachedData && cachedData.structures) ?
            cachedData.structures.find(s => s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] > 0 && s.pos.getRangeTo(room.controller) <= 5) :
            room.controller.pos.findInRange(FIND_STRUCTURES, 5, {
                filter: s => s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] > 0
            })[0];
        if (receiverLink) {
            let distance = creep.pos.getRangeTo(receiverLink);
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: receiverLink.id, // Ziel-ID
                priority: 10 - (distance / 5) // Basispriorität 10, Entfernung stärker gewichtet (Teiler 5)
            });
        }

        // Priorität 2: Controller-Container
        let controllerContainer = (cachedData && cachedData.structures) ?
            cachedData.structures.find(s => s.structureType === STRUCTURE_CONTAINER && s.pos.getRangeTo(room.controller) <= 3 && s.store[RESOURCE_ENERGY] > 0) :
            room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
            })[0];
        if (controllerContainer) {
            let distance = creep.pos.getRangeTo(controllerContainer);
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: controllerContainer.id, // Ziel-ID
                priority: 9 - (distance / 5) // Basispriorität 9, Entfernung stärker gewichtet
            });
        }

        // Priorität 3: Storage
        let storage = (cachedData && cachedData.structures) ?
            cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0) :
            room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
            })[0];
        if (storage) {
            let distance = creep.pos.getRangeTo(storage);
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: storage.id, // Ziel-ID
                priority: 8 - (distance / 5) // Basispriorität 8, Entfernung stärker gewichtet
            });
        }

        // Priorität 4: Andere Container (außerhalb Controller-Bereich)
        let otherContainers = (cachedData && cachedData.structures) ?
            cachedData.structures.filter(s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0 && s.pos.getRangeTo(room.controller) > 3) :
            room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0 && s.pos.getRangeTo(room.controller) > 3
            });
        otherContainers.forEach(container => {
            let distance = creep.pos.getRangeTo(container);
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: container.id, // Ziel-ID
                priority: 7 - (distance / 5) // Basispriorität 7, Entfernung stärker gewichtet
            });
        });

        // Priorität 5: Abgeworfene Ressourcen
        let droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY
        });
        droppedEnergy.forEach(resource => {
            let distance = creep.pos.getRangeTo(resource);
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: resource.id, // Ziel-ID
                priority: 6 - (distance / 5) // Basispriorität 6, Entfernung stärker gewichtet
            });
        });

        // Priorität 6: Tombstones
        let tombstones = room.find(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] > 0
        });
        tombstones.forEach(tombstone => {
            let distance = creep.pos.getRangeTo(tombstone);
            tasks.push({
                type: 'collect', // Aufgabentyp: Sammeln
                target: tombstone.id, // Ziel-ID
                priority: 5 - (distance / 5) // Basispriorität 5, Entfernung stärker gewichtet
            });
        });

        tasks.sort((a, b) => b.priority - a.priority); // Sortiert Aufgaben nach absteigender Priorität
        logger.info('Worker collect tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks; // Gibt sortierte Aufgaben zurück
    },

    // Funktion: Weist einem Creep die höchstpriorisierte Aufgabe aus einer Liste zu
    assignTask: function (creep, tasks) {
        if (tasks.length > 0) { // Wenn Aufgaben verfügbar
            creep.memory.task = tasks[0].type; // Setzt Aufgabentyp
            creep.memory.targetId = tasks[0].target; // Setzt Ziel-ID
            if (tasks[0].containerId) creep.memory.containerId = tasks[0].containerId; // Setzt Container-ID (falls vorhanden)
            logger.info(`${creep.name}: Aufgabe zugewiesen - ${tasks[0].type} auf ${tasks[0].target}`);
        } else { // Keine Aufgaben
            creep.memory.task = 'idle'; // Setzt auf Leerlauf
            creep.memory.targetId = null; // Kein Ziel
            delete creep.memory.containerId; // Löscht Container-ID
            logger.info(`${creep.name}: Keine Aufgaben verfügbar, idle`);
        }
    }
};

module.exports = taskManager; // Exportiert das taskManager-Objekt