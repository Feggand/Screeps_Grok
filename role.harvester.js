var logger = require('logger');

module.exports.run = function (creep) {
    if (creep.store.getFreeCapacity() > 0) {
        let source = Game.getObjectById(creep.memory.source);
        if (!source) {
            let newSource = creep.pos.findClosestByPath(FIND_SOURCES);
            if (newSource) {
                creep.memory.source = newSource.id;
                logger.info(creep.name + ': Assigned new source ' + newSource.id);
            } else {
                logger.warn(creep.name + ': No source found');
                return;
            }
        }
        source = Game.getObjectById(creep.memory.source);
        if (!source) {
            logger.error(creep.name + ': Invalid source ID ' + creep.memory.source);
            return;
        }

        let container = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0];
        let constructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0];

        if (container) {
            if (container.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                logger.info(creep.name + ': Container at ' + container.pos + ' is full');
                return;
            }
            if (creep.pos.x === container.pos.x && creep.pos.y === container.pos.y) {
                creep.harvest(source);
                logger.info(creep.name + ': Harvesting source at ' + source.pos);
            } else {
                creep.moveTo(container.pos.x, container.pos.y, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Moving to container at ' + container.pos);
            }
        } else if (constructionSite) {
            if (creep.store.getFreeCapacity() > 0) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                    logger.info(creep.name + ': Moving to source at ' + source.pos);
                } else {
                    logger.info(creep.name + ': Harvesting source at ' + source.pos + ' for construction');
                }
            } else {
                if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionSite, { visualizePathStyle: { stroke: '#0000ff' } });
                    logger.info(creep.name + ': Moving to build container at ' + constructionSite.pos);
                } else {
                    logger.info(creep.name + ': Building container at ' + constructionSite.pos);
                }
            }
        } else {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                logger.info(creep.name + ': Moving to source at ' + source.pos);
            } else {
                logger.info(creep.name + ': Harvesting source at ' + source.pos);
            }
        }
    } else {
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_CONTAINER) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                logger.info(creep.name + ': Moving to transfer energy to ' + target.structureType + ' at ' + target.pos);
            } else {
                logger.info(creep.name + ': Transferring energy to ' + target.structureType + ' at ' + target.pos);
            }
        } else {
            logger.warn(creep.name + ': No valid energy target found');
        }
    }
};