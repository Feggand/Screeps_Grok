// role.mineralHarvester.js
var logger = require('logger');

module.exports.run = function(creep) {
    let targetRoom = creep.memory.targetRoom;
    let mineral = null;
    let extractor = null;
    let storage = creep.room.storage;

    // Prüfe den Zielraum
    if (creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Moving to target room ' + targetRoom);
        return;
    }

    // Finde Mineral und Extractor im aktuellen Raum
    mineral = creep.room.find(FIND_MINERALS)[0];
    extractor = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR })[0];

    if (!mineral || !extractor || !storage) {
        logger.warn(creep.name + ': Missing mineral, extractor, or storage in ' + creep.room.name);
        creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
        return;
    }

    // Wenn der Creep Platz hat und Mineralien verfügbar sind, abbauen
    if (creep.store.getFreeCapacity() > 0 && mineral.mineralAmount > 0) {
        if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
            creep.moveTo(mineral, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(creep.name + ': Moving to mineral ' + mineral.id + ' in ' + creep.room.name);
        } else if (creep.harvest(mineral) === OK) {
            logger.info(creep.name + ': Harvesting mineral ' + mineral.mineralType + ' in ' + creep.room.name);
        } else {
            logger.info(creep.name + ': Waiting at mineral ' + mineral.id + ' (cooldown or no minerals) in ' + creep.room.name);
            creep.moveTo(mineral, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    } 
    // Wenn der Creep voll ist, zum Storage bringen
    else if (creep.store.getFreeCapacity() === 0) {
        let resourceType = Object.keys(creep.store)[0]; // Erster gefundener Ressourcentyp (z. B. 'O')
        if (creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
            logger.info(creep.name + ': Moving to storage to transfer ' + resourceType + ' in ' + creep.room.name);
        } else if (creep.transfer(storage, resourceType) === OK) {
            logger.info(creep.name + ': Transferring ' + resourceType + ' to storage in ' + creep.room.name);
        } else {
            logger.warn(creep.name + ': Transfer failed for ' + resourceType + ' in ' + creep.room.name);
        }
    } 
    // Wenn kein Mineral mehr da ist, warten
    else {
        creep.moveTo(mineral, { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Waiting at mineral ' + mineral.id + ' (no minerals left) in ' + creep.room.name);
    }
};