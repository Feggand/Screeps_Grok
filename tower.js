module.exports.run = function (tower) {
    let closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile) {
        tower.attack(closestHostile);
        return;
    }

    let closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: c => c.hits < c.hitsMax
    });
    if (closestDamagedCreep) {
        tower.heal(closestDamagedCreep);
        return;
    }

    let closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: s => (
            (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) &&
            s.hits < s.hitsMax
        )
    });
    if (closestDamagedStructure) {
        tower.repair(closestDamagedStructure);
        return;
    }
};