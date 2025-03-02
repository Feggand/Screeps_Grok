// logger.js
// Einfaches Logging-Modul für Screeps zur Protokollierung von Ereignissen

module.exports = {
    // Allgemeine Log-Funktion mit Typ und Zeitstempel
    log: function(type, message) {
        if (Memory.debug) { // Prüft, ob Debugging aktiviert ist
            console.log(`${type.toUpperCase()}|${Game.time}|${message}`); // Ausgabe: TYP|ZEIT|NACHRICHT
        }
    },
    // Loggt eine Info-Nachricht
    info: function(message) { 
        this.log('INFO', message); // Ruft log mit Typ 'INFO' auf
    },
    // Loggt eine Warnung
    warn: function(message) { 
        this.log('WARN', message); // Ruft log mit Typ 'WARN' auf
    },
    // Loggt einen Fehler
    error: function(message) { 
        this.log('ERROR', message); // Ruft log mit Typ 'ERROR' auf
    }
};