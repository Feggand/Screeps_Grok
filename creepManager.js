module.exports = {
    runCreeps: function() {
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            let role = require('role.' + creep.memory.role);
            role.run(creep);
        }
    }
};