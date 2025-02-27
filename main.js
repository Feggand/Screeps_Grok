var creepManager = require('creepManager');
var spawnManager = require('spawnManager');
var structureBuilder = require('structureBuilder');
var memoryManager = require('memoryManager');
var logger = require('logger');
var roleTower = require('role.tower');
var roleLink = require('role.link');

module.exports.loop = function () {
    logger.info('Main loop running');
    memoryManager.initializeMemory();
    logger.info('Memory initialized');

    if (Game.time % 100 === 0) {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                logger.info(`Removing dead creep ${name} from Memory`);
                delete Memory.creeps[name];
            } else if (Memory.creeps[name] === undefined || Object.keys(Memory.creeps[name]).length === 0) {
                logger.warn(`Removing invalid creep ${name} (undefined or empty) from Memory`);
                delete Memory.creeps[name];
            }
        }
    }

    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        let roomMemory = Memory.rooms[roomName] || {};
        let isMyRoom = roomMemory.isMyRoom || false;
        logger.info(`Processing room ${roomName}, isMyRoom: ${isMyRoom}`);

        spawnManager.manageSpawns(room);
        structureBuilder.buildStructures(room);
        structureBuilder.buildControllerContainer(room); // Neue Zeile für Container-Platzierung
        logger.info(`Room ${roomName} processed`);
    }

    for (var roomName in Game.rooms) {
        var room = Game.rooms[roomName];
        structureBuilder.buildStructures(room);
        roleLink.run(); // Füge dies hinzu
    }

    creepManager.runCreeps();
    roleTower.run();
    logger.info('Creeps run');
};