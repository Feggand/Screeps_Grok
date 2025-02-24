module.exports = {
    log: function(type, message) {
        if (Memory.debug) {
            console.log(`${type.toUpperCase()}|${Game.time}|${message}`);
        }
    },
    info: function(message) { this.log('INFO', message); },
    warn: function(message) { this.log('WARN', message); },
    error: function(message) { this.log('ERROR', message); }
};