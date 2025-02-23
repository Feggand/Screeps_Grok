module.exports.run = function (creep) {
    if (creep.room.name !== creep.memory.targetRoom) {
        // Startet bei (26, 25), um mindestens einen Schritt rein zu machen
        creep.moveTo(new RoomPosition(26, 25, creep.memory.targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
    } else {
        // Bewegt sich leicht im Raum, um Sicht zu halten
        creep.moveTo(26 + Math.floor(Math.random() * 10 - 5), 25 + Math.floor(Math.random() * 10 - 5), { visualizePathStyle: { stroke: '#ffaa00' } });
    }
};