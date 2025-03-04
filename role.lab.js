// role.lab.js
var logger = require('logger');

module.exports.run = function() {
    let room = Game.rooms['W6N1'];
    let labs = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });
    if (labs.length < 3) return;

    let lab1 = labs[0]; // Für Z (Zynthium)
    let lab2 = labs[1]; // Für O (Sauerstoff)
    let lab3 = labs[2]; // Für ZO (Zynthiumoxid)

    // Prüft, ob genug Rohstoffe vorhanden sind
    if (lab1.store['Z'] >= 5 && lab2.store['O'] >= 5 && lab3.store.getFreeCapacity('ZO') >= 5) {
        let result = lab3.runReaction(lab1, lab2);
        if (result === OK) {
            logger.info('Producing ZO in ' + room.name);
        } else {
            logger.warn('Failed to produce ZO: ' + result);
        }
    }
};