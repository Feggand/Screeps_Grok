module.exports.run = function (creep) {
    if (creep.room.name !== creep.memory.targetRoom) {
        // Zielposition knapp innerhalb des Raums (26, 25 statt 25, 25)
        creep.moveTo(new RoomPosition(26, 25, creep.memory.targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
    }
};