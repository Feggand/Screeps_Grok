var logger = require('logger');

module.exports.run = function() {
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        let towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        for (let tower of towers) {
            // Priorität 1: Feinde angreifen
            let closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile) {
                tower.attack(closestHostile);
                logger.info('Tower in ' + room.name + ' attacking hostile at ' + closestHostile.pos);
                continue;
            }

            // Priorität 2: Verletzte Creeps heilen
            let closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (creep) => creep.hits < creep.hitsMax
            });
            if (closestDamagedCreep) {
                tower.heal(closestDamagedCreep);
                logger.info('Tower in ' + room.name + ' healing creep ' + closestDamagedCreep.name + ' at ' + closestDamagedCreep.pos);
                continue;
            }

            // Priorität 3: Strukturen reparieren
            // Straßen und Container
            let damagedNonWalls = tower.pos.findInRange(FIND_STRUCTURES, 10, {
                filter: (s) => (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) && s.hits < s.hitsMax
            });
            if (damagedNonWalls.length) {
                let target = tower.pos.findClosestByRange(damagedNonWalls);
                tower.repair(target);
                logger.info('Tower in ' + room.name + ' repairing ' + target.structureType + ' at ' + target.pos);
                continue;
            }

            // Wände und Ramparts (gleichmäßig)
            let damagedWalls = tower.pos.findInRange(FIND_STRUCTURES, 10, {
                filter: (s) => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax
            });
            if (damagedWalls.length) {
                let targetWall = _.min(damagedWalls, 'hits');
                tower.repair(targetWall);
                logger.info('Tower in ' + room.name + ' repairing ' + targetWall.structureType + ' at ' + targetWall.pos);
                continue;
            }
        }
    }
};