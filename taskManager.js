// taskManager.js
var logger = require('logger');

var taskManager = {
    getWorkerTasks: function(room) {
        let tasks = [];
        let damagedWalls = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003
        });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair',
                target: wall.id,
                priority: 10 - (wall.hits / (wall.hitsMax * 0.5)) * 10
            });
        });

        let damagedRoads = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax
        });
        damagedRoads.forEach(road => {
            tasks.push({
                type: 'repair',
                target: road.id,
                priority: 5
            });
        });

        let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        constructionSites.forEach(site => {
            let priority = 10;
            if (site.structureType === STRUCTURE_CONTAINER && site.pos.getRangeTo(room.controller) <= 3) {
                priority = 14;
            }
            tasks.push({
                type: 'construct',
                target: site.id,
                priority: priority
            });
        });

        let controllerProgress = room.controller.progress / room.controller.progressTotal;
        let upgradePriority = 7 + (1 - controllerProgress) * 3;
        tasks.push({
            type: 'upgrade',
            target: room.controller.id,
            priority: upgradePriority
        });

        tasks.sort((a, b) => b.priority - a.priority);
        logger.info('Worker tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks;
    },

    getHaulerTasks: function(room) {
        let tasks = [];

        // Energie liefern an Controller-Container
        let controllerContainer = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
        if (controllerContainer) {
            tasks.push({
                type: 'deliver',
                target: controllerContainer.id,
                priority: 12
            });
        }

        // Energie liefern an Spawns, Extensions und Türme
        let energyTargets = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_TOWER) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        energyTargets.forEach(target => {
            let priority = 0;
            if (target.structureType === STRUCTURE_TOWER && target.store[RESOURCE_ENERGY] < target.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
                priority = 14;
            } else if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
                priority = 13;
            } else {
                priority = 5;
            }
            tasks.push({
                type: 'deliver',
                target: target.id,
                priority: priority
            });
        });

        // Energie liefern an Storage
        let storageDeliver = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        storageDeliver.forEach(store => {
            tasks.push({
                type: 'deliver',
                target: store.id,
                priority: 4
            });
        });

        // Energie sammeln aus Containern (Controller-Container ausgeschlossen)
        let containers = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && 
                                   structure.store[RESOURCE_ENERGY] > 0 && 
                                   (!room.controller || structure.pos.getRangeTo(room.controller) > 3)
        });
        containers.forEach(container => {
            let energyPercentage = container.store[RESOURCE_ENERGY] / container.store.getCapacity(RESOURCE_ENERGY);
            tasks.push({
                type: 'collect',
                target: container.id,
                priority: 7 + energyPercentage * 3
            });
        });

        // Energie sammeln aus abgeworfenen Ressourcen
        let droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY
        });
        droppedEnergy.forEach(resource => {
            tasks.push({
                type: 'collect',
                target: resource.id,
                priority: 9
            });
        });

        // Energie sammeln aus Tombstones
        let tombstones = room.find(FIND_TOMBSTONES, {
            filter: (tombstone) => tombstone.store[RESOURCE_ENERGY] > 0
        });
        tombstones.forEach(tombstone => {
            tasks.push({
                type: 'collect',
                target: tombstone.id,
                priority: 9
            });
        });

        // Energie sammeln aus Storage
        let storageForCollect = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 0
        });
        storageForCollect.forEach(store => {
            tasks.push({
                type: 'collect',
                target: store.id,
                priority: 6
            });
        });

        tasks.sort((a, b) => b.priority - a.priority);
        logger.info('Hauler tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks;
    },

    getHarvesterTasks: function(room) {
        let tasks = [];
        let assignedSources = _.map(_.filter(Game.creeps, c => c.memory.role === 'harvester' && c.memory.task === 'harvest'), 'memory.targetId');

        let sources = room.find(FIND_SOURCES);
        sources.forEach(source => {
            let container = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            })[0];
            if (container) {
                let harvestersAssigned = assignedSources.filter(id => id === source.id).length;
                let priority = harvestersAssigned === 0 ? 10 : 5;
                tasks.push({
                    type: 'harvest',
                    target: source.id,
                    containerId: container.id,
                    priority: priority
                });
            }
        });

        sources.forEach(source => {
            let container = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: (structure) => structure.structureType === STRUCTURE_CONTAINER })[0];
            let site = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: (site) => site.structureType === STRUCTURE_CONTAINER })[0];
            if (!container && !site) {
                tasks.push({
                    type: 'constructContainer',
                    target: source.id,
                    priority: 8
                });
            }
        });

        let containers = room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.hits < structure.hitsMax
        });
        containers.forEach(container => {
            tasks.push({
                type: 'repair',
                target: container.id,
                priority: 6
            });
        });

        tasks.sort((a, b) => b.priority - a.priority);
        logger.info('Harvester tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks;
    },

    getTowerTasks: function(room) {
        let tasks = [];

        // Angriff auf Feinde
        let hostiles = room.find(FIND_HOSTILE_CREEPS);
        hostiles.forEach(hostile => {
            tasks.push({
                type: 'attack',
                target: hostile.id,
                priority: 20 - hostile.pos.getRangeTo(room.controller)
            });
        });

        // Heilung verletzter Creeps
        let damagedCreeps = room.find(FIND_MY_CREEPS, { filter: (creep) => creep.hits < creep.hitsMax });
        damagedCreeps.forEach(creep => {
            tasks.push({
                type: 'heal',
                target: creep.id,
                priority: 15 - (creep.hits / creep.hitsMax) * 10
            });
        });

        // Reparatur von Straßen und Containern
        let damagedNonWalls = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) && structure.hits < structure.hitsMax
        });
        damagedNonWalls.forEach(structure => {
            tasks.push({
                type: 'repair',
                target: structure.id,
                priority: 10 - (structure.hits / structure.hitsMax) * 5
            });
        });

        // Reparatur von Wänden
        let damagedWalls = room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) && structure.hits < structure.hitsMax * 0.0003
        });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair',
                target: wall.id,
                priority: 5
            });
        });

        tasks.sort((a, b) => b.priority - a.priority);
        logger.info('Tower tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks;
    },

    assignTask: function(creep, tasks) {
        if (tasks.length > 0) {
            creep.memory.task = tasks[0].type;
            creep.memory.targetId = tasks[0].target;
            if (tasks[0].containerId) creep.memory.containerId = tasks[0].containerId;
            logger.info(creep.name + ': Aufgabe zugewiesen - ' + tasks[0].type + ' auf ' + tasks[0].target);
        } else {
            creep.memory.task = 'idle';
            creep.memory.targetId = null;
            delete creep.memory.containerId;
            logger.info(creep.name + ': Keine Aufgaben verfügbar, idle');
        }
    }
};

module.exports = taskManager;