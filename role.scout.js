module.exports.run = function (creep) {
    let targetRoom = creep.memory.targetRoom;
    if (!targetRoom || typeof targetRoom !== 'string') {
        console.log(`${creep.name}: Invalid or undefined targetRoom, setting to 'W7N1' as fallback`);
        creep.memory.targetRoom = 'W7N1'; // Fallback für fehlerhafte targetRoom
        targetRoom = 'W7N1';
    }

    if (creep.room.name !== targetRoom) {
        // Zielposition knapp innerhalb des Raums (26, 25 statt 25, 25)
        creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        console.log(`${creep.name}: Moving to ${targetRoom} (26,25)`);
    } else {
        // Bewegt sich leicht im Raum, um Sicht zu halten
        let newX = 26 + Math.floor(Math.random() * 10 - 5);
        let newY = 25 + Math.floor(Math.random() * 10 - 5);
        creep.moveTo(new RoomPosition(newX, newY, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        console.log(`${creep.name}: Patrolling in ${targetRoom} at (${newX},${newY})`);
    }
};