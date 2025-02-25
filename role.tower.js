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
                logger.info('Tower in ' + room.name + ' healing creep ' + closestDamagedCreep.name);
                continue;
            }

            // Priorität 3: Straßen und Container reparieren
            let damagedNonWalls = tower.pos.findInRange(FIND_STRUCTURES, 10, {
                filter: (s) => (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) && s.hits < s.hitsMax
            });
            if (damagedNonWalls.length) {
                let target = tower.pos.findClosestByRange(damagedNonWalls);
                tower.repair(target);
                logger.info('Tower in ' + room.name + ' repairing ' + target.structureType + ' at ' + target.pos);
                continue;
            }

            // Priorität 4: Wände nur reparieren, wenn unter 50% Trefferpunkte
            let damagedWalls = tower.pos.findInRange(FIND_STRUCTURES, 10, {
                filter: (s) => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax * 0.0003
            });
            if (damagedWalls.length) {
                let targetWall = _.min(damagedWalls, 'hits'); // Die am meisten beschädigte Wand
                tower.repair(targetWall);
                logger.info('Tower in ' + room.name + ' repairing ' + targetWall.structureType + ' at ' + targetWall.pos);
                continue;
            }
        }
    }
};