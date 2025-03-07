// role.scout.js
// Logik für Scout-Creeps, die Remote-Räume erkunden
// Nutzt gecachte Daten, um CPU-Nutzung zu reduzieren und Konsistenz zu wahren

var logger = require('logger'); // Importiert Logging-Modul

module.exports.run = function (creep, cachedData) {
    let targetRoom = creep.memory.targetRoom; // Zielraum aus Speicher
    if (!targetRoom || typeof targetRoom !== 'string') {
        logger.warn(creep.name + ': Invalid or undefined targetRoom, using first remote room from home');
        // Fallback: Erster Remote-Raum aus Heimatraum
        let homeRoom = creep.memory.homeRoom || Object.keys(Game.rooms).find(function(r) { return Memory.rooms[r].isMyRoom; });
        if (!homeRoom || !Memory.rooms[homeRoom]) {
            logger.error(creep.name + ': No valid homeRoom found, skipping'); // Kein Heimatraum -> überspringen
            return;
        }
        let remoteRooms = Memory.rooms[homeRoom].remoteRooms || []; // Liste der Remote-Räume
        targetRoom = remoteRooms.length > 0 ? remoteRooms[0] : null; // Erster Remote-Raum
        if (targetRoom) {
            creep.memory.targetRoom = targetRoom; // Speichert Zielraum
            logger.info(creep.name + ': Assigned targetRoom ' + targetRoom);
        } else {
            logger.error(creep.name + ': No targetRoom available, skipping'); // Kein Zielraum -> überspringen
            return;
        }
    }

    if (!Game.rooms[targetRoom]) {
        logger.warn(creep.name + ': Target room ' + targetRoom + ' not visible, moving blindly'); // Zielraum nicht sichtbar
    }

    if (creep.room.name !== targetRoom) {
        // Bewegt sich zum Zielraum
        creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Moving to ' + targetRoom + ' (26,25)');
    } else {
        // Patrouilliert im Zielraum an zufälliger Position
        let newX = 26 + Math.floor(Math.random() * 10 - 5); // Zufällige X-Koordinate
        let newY = 25 + Math.floor(Math.random() * 10 - 5); // Zufällige Y-Koordinate
        creep.moveTo(new RoomPosition(newX, newY, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Patrolling in ' + targetRoom + ' at (' + newX + ',' + newY + ')');
    }
};