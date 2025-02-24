var logger = require('logger');

module.exports.run = function (creep) {
    let targetRoom = creep.memory.targetRoom;
    if (!targetRoom || typeof targetRoom !== 'string') {
        logger.warn(creep.name + ': Invalid or undefined targetRoom, using first remote room from home');
        let homeRoom = creep.memory.homeRoom || Object.keys(Game.rooms).find(function(r) { return Memory.rooms[r].isMyRoom; });
        if (!homeRoom || !Memory.rooms[homeRoom]) {
            logger.error(creep.name + ': No valid homeRoom found, skipping');
            return;
        }
        let remoteRooms = Memory.rooms[homeRoom].remoteRooms || [];
        targetRoom = remoteRooms.length > 0 ? remoteRooms[0] : null;
        if (targetRoom) {
            creep.memory.targetRoom = targetRoom;
            logger.info(creep.name + ': Assigned targetRoom ' + targetRoom);
        } else {
            logger.error(creep.name + ': No targetRoom available, skipping');
            return;
        }
    }

    if (!Game.rooms[targetRoom]) {
        logger.warn(creep.name + ': Target room ' + targetRoom + ' not visible, moving blindly');
    }

    if (creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Moving to ' + targetRoom + ' (26,25)');
    } else {
        let newX = 26 + Math.floor(Math.random() * 10 - 5);
        let newY = 25 + Math.floor(Math.random() * 10 - 5);
        creep.moveTo(new RoomPosition(newX, newY, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Patrolling in ' + targetRoom + ' at (' + newX + ',' + newY + ')');
    }
};