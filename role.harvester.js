module.exports.run = function (creep) {
    if (creep.store.getFreeCapacity() > 0) {
        let source = Game.getObjectById(creep.memory.source);
        if (!source) {
            let newSource = creep.pos.findClosestByPath(FIND_SOURCES);
            creep.memory.source = newSource ? newSource.id : null;
        }
        source = Game.getObjectById(creep.memory.source);
        if (!source) return;

        let container = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0];
        let constructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0];

        if (container) {
            if (container.store.getFreeCapacity(RESOURCE_ENERGY) === 0) return;
            if (creep.pos.x === container.pos.x && creep.pos.y === container.pos.y) {
                creep.harvest(source);
            } else {
                creep.moveTo(container.pos.x, container.pos.y, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else if (!container && constructionSite) {
            if (creep.store.getFreeCapacity() > 0) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(constructionSite, { visualizePathStyle: { stroke: '#0000ff' } });
                }
            }
        } else {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    } else {
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_CONTAINER) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }
};