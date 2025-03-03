// role.link.js
// Logik für Link-Strukturen, die Energie zwischen Räumen transportieren

var logger = require('logger');

module.exports.run = function() {
    // Durchläuft alle sichtbaren Räume
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue; // Überspringt Räume, die nicht mir gehören

        let links = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
        if (links.length < 2) continue; // Benötigt mindestens 2 Links (Sender und Receiver)

        // Variablen für Sender- und Receiver-Links
        let senderLinks = []; // Array für mehrere Sender
        let receiverLink = null;
        let storage = room.storage;
        let controllerContainer = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0];
        let sources = room.find(FIND_SOURCES);

        // Bestimmt Sender- und Receiver-Links
        links.forEach(link => {
            // Receiver-Link: Nahe dem Controller-Container
            if (controllerContainer && link.pos.getRangeTo(controllerContainer) <= 2) {
                receiverLink = link;
            }
            // Sender-Link 1: Nahe dem Storage
            else if (storage && link.pos.getRangeTo(storage) <= 2) {
                senderLinks.push(link);
            }
            // Sender-Link 2: Nahe einer Quelle mit Container
            else {
                for (let source of sources) {
                    let sourceContainer = source.pos.findInRange(FIND_STRUCTURES, 2, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    })[0];
                    if (sourceContainer && link.pos.getRangeTo(sourceContainer) <= 2) {
                        senderLinks.push(link);
                        break;
                    }
                }
            }
        });

        // Überträgt Energie von Sendern zum Receiver, wenn Bedingungen erfüllt
        if (receiverLink && senderLinks.length > 0) {
            // Sortiere Sender nach Energie (Source-Link prioritär, wenn voll)
            senderLinks.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]);

            for (let senderLink of senderLinks) {
                if (senderLink.store[RESOURCE_ENERGY] >= 200 && senderLink.cooldown === 0) {
                    let result = senderLink.transferEnergy(receiverLink);
                    if (result === OK) {
                        logger.info('Transferred energy from link at ' + senderLink.pos + ' to link at ' + receiverLink.pos + ' in ' + room.name);
                    } else {
                        logger.warn('Failed to transfer energy from link ' + senderLink.id + ' to ' + receiverLink.id + ': ' + result);
                    }
                    break; // Nur ein Link überträgt pro Tick
                }
            }
        } else {
            logger.warn('No valid sender-receiver pair found in ' + room.name);
        }
    }
};