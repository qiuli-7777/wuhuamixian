distance: {
    updateDistanceMap() {
        const map = {};
        game.countPlayer(current => {
            map[current.playerid] ??= {};
            game.countPlayer(current2 => {
                map[current.playerid][current2.playerid] = current.inRange(current2);
            });
        });
        game.broadcastAll(map => {
            _status.xuehenDistanceMap = map;
        }, map);
        return _status.xuehenDistanceMap;
    },

    // 新增：完整定义，返回所有“脱离你攻击范围”的角色数组
    getOutOfRangePlayers(player) {
        if (!_status.xuehenDistanceMap) {
            get.info("ql_xuehen_distance").updateDistanceMap();
            return [];
        }
        const map = _status.xuehenDistanceMap[player.playerid] || {};
        const players = [];
        game.countPlayer(current => {
            if (
                current.isAlive() &&
                map[current.playerid] === true &&
                !player.inRange(current)
            ) {
                players.push(current);
            }
        });
        return players;
    },

    init(player, skill) {
        get.info(skill).updateDistanceMap();
    },
    trigger: {
        player: "chooseToUseBegin",
        global: ["logSkill", "useSkillAfter", "dieAfter", "changeHp", "equipAfter", "changeSkillsAfter"],
    },
    filter(event, player) {
        if (event.name == "chooseToUse" && event.type != "phase") {
            return false;
        }
        return get.info("ql_xuehen_distance").getOutOfRangePlayers(player).length > 0;
    },
    async cost(event, trigger, player) {
        delete player.getStat("skill")["ql_xuehen"];

        const outOfRangePlayers = get.info("ql_xuehen_distance").getOutOfRangePlayers(player);
        get.info("ql_xuehen_distance").updateDistanceMap(); // 更新快照，避免重复触发

        game.log(player, "有角色脱离其攻击范围，重置了", "#g【狩虎】");

        // outOfRangePlayers 就是你要的数组，可以在这里用
        // outOfRangePlayers.forEach(target => { ... });
    },
},