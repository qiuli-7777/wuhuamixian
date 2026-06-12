import { lib, game, ui, get, ai, _status } from "noname";

const cardPack = {
    name: "qlwh_card",
    connect: true,
    //加入卡牌
    card: {
        ql_weiye: {
            fullskin: true,
            type: "trick",
            wuxieable: false,
            enable(card, player) {
                return !_status.connectMode;
            },
            selectTarget: -1,
            multitarget: true,
            recastable: true,
            filterTarget(card, player, target) {
                return target !== player;
            },
            reverseOrder: true,
            async content(event, trigger, player) {
                await player.gainMaxHp();
                const players = game.players.slice(0).sortBySeat();
                await player.line(players);
                for (var i = 0; i < players.length; i++) {
                    if (players[i] != player) players[i].damage();
                }
                player.insertPhase();
            },
            ai: {
                basic: {
                    order: 1,
                    useful: [6, 4],
                    value: [6, 4],
                },
                result: {
                    player: 7,
                },
                tag: {
                    damage: 1,
                },
            },
        },
        ql_xiuyangshengxi: {
            //singleCard: true,
            fullskin: true,
            type: "trick",
            wuxieable: true,
            enable: true,
            prompt() {
                return "对两名角色使用，第一名角色选择一项，第二名角色执行另一项：①恢复1点体力，然后令其不可使用伤害牌直到其回合结束；②摸两张牌，然后令其处于非濒死状态时不可恢复体力，直到其回合开始。";
            },
            filterTarget(card, player, target) {
                return true;
            },
            multicheck() {
                return game.countPlayer() > 1;
            },
            selectTarget: 2,
            targetprompt: ["可选择选项", "被动选择选项"],
            /*complexSelect: true,
            complexTarget: true,
            filterAddedTarget(card, player, target, preTarget) {
                return target !== preTarget;
            },*/
            async content(event, trigger, player) {
                const { target, targets } = event;
                let result;
                if (targets.indexOf(target) == 0) {
                    result = await target
                        .chooseControl({
                            choiceList: [
                                "恢复1点体力，不能使用伤害类牌直到回合结束",
                                "摸两张牌，直到下一个回合开始时不能于濒死状态外恢复体力"
                            ],
                            forced: true,
                            choice: (() => {
                                const eff1 = get.recoverEffect(target, target, target);
                                const eff2 = get.effect(target, { name: "draw" }, target, target) * 2;
                                if (eff1 > 0 && (target.hp == 1 || target.needsToDiscard() || target.hasSkillTag("maixie_hp"))) {
                                    return 0;
                                }
                                if (eff2 > 0) {
                                    return 1;
                                }
                                return get.rand(0, 1);
                            })()
                        })
                        .forResult();
                    const { index } = result;
                    event.getParent().set("ql_xiuyangshengxi_choice", index);
                } else if (typeof event.getParent()?.ql_xiuyangshengxi_choice == "number") {
                    result = { index: event.getParent()?.ql_xiuyangshengxi_choice == 0 ? 1 : 0 };
                }
                if (typeof result.index == "number") {
                    const { index } = result;
                    if (index == 0) {
                        await target.recover();
                        target.addTempSkill("ql_xiuyangshengxi_recover", { player: "phaseAfter" });
                    } else {
                        await target.draw(2);
                        target.addTempSkill("ql_xiuyangshengxi_draw", { player: "phaseBeginStart" });
                    }
                }
            },
            ai: {
                basic: {
                    order: 1,
                    useful: [6, 4],
                    value: [6, 4],
                },
                result: {
                    player: 1,
                    target: 2,
                },
            },
        },
        ql_mingjue: {
            fullskin: true,
            type: "trick",
            wuxieable: false,
            recastable: true,
            enable(card, player, event) {
                return event?.type == "dying" && event?.dying == player && player.hasCards("h") && game.hasPlayer(target => target != player && target.hasCards("h"));
            },
            savable(card, player, dying) {
                return dying == player;
            },
            toself: true,
            selectTarget: -1,
            filterTarget(card, player, target) {
                return target === player;
            },
            modTarget: false,
            prompt() {
                return "濒死状态下对自己使用，选择一名其他角色，依次展示你与其的手牌，手牌中【杀】较多的角色回复体力至上限，另一名角色失去一点体力。";
            },
            async content(event, trigger, player) {
                const { target } = event;
                const result = await target
                    .chooseTarget({
                        prompt: "请选择你要【命决】的目标",
                        forced: true,
                        filterTarget(card, player, target) {
                            return target != player && target.hasCards("h");
                        },
                        ai(target) {
                            const player = get.player();
                            if (get.attitude(player, target) > 0) {
                                return 0;
                            }
                            const known = target.getKnownCards(player, { name: "sha" });
                            if (known.length < player.countCards("h", { name: "sha" })) {
                                return 114514 - target.countCards("h") + 2;
                            }
                            return 114514 - target.countCards("h");
                        },
                    })
                    .forResult();
                const { targets } = result;
                if (targets?.length) {
                    target.line(targets);
                    await target.showHandcards();
                    await targets[0].showHandcards();
                    const sha1 = target.countCards("h", { name: "sha" });
                    const sha2 = targets[0].countCards("h", { name: "sha" });
                    if (sha1 == sha2) {
                        return;
                    }
                    const targetsx = [target, targets[0]];
                    if (sha1 < sha2) {
                        targetsx.reverse();
                    }
                    await targetsx[0].recoverTo(targetsx[0].maxHp);
                    await targetsx[1].loseHp();
                }
            },
            ai: {
                basic: {
                    useful: 2,
                    value: 6,
                },
                result: {
                    player(player, target) {
                        if (
                            !game.hasPlayer(target => (
                                target != player &&
                                get.attitude(player, target) < 0 &&
                                player.countCards("h") >= target.countCards("h")
                            )) ||
                            !player.hasCards("h", { name: "sha" })
                        ) {
                            return 0;
                        }
                        return 1;
                    },
                },
            },
        },
        ql_shenxianshizu: {
            fullskin: true,
            type: "trick",
            enable: true,
            selectTarget: -1,
            toself: true,
            filterTarget(card, player, target) {
                return target === player;
            },
            prompt() {
                return "对自己使用，若手牌中有黑色牌，你弃置这些牌本回合造成伤害+1，否则你摸一张牌。";
            },
            async content(event, trigger, player) {
                const cards = player.getCards('h', { color: "black" });
                if (cards.length) {
                    await player.modedDiscard({ cards });
                    player.addTempSkill("ql_shenxianshizu_skill");
                    player.addMark("ql_shenxianshizu_skill", 1, false);
                } else {
                    await player.draw();
                }
            },
            ai: {
                basic: {
                    order: 6,
                    useful: [6, 4],
                    value: [6, 4],
                },
                result: {
                    player(player, target) {
                        if (player.hasCard(card => get.color(card) != "black" && get.is.damageCard(card), "h")) {
                            return 3;
                        }
                        if (!player.countCards("h", { color: "black" })) {
                            if (player.countCards("h") < 3) {
                                return 5;
                            }
                            return 2;
                        }
                        return 0;
                    },
                },
            },
        },
        ql_jianbiqingye: {
            fullskin: true,
            type: "trick",
            enable: true,
            prompt() {
                return "对其他角色使用，你摸一张牌并与目标跳过下一个摸牌阶段。";
            },
            filterTarget: lib.filter.notMe,
            selectTarget: 1,
            async content(event, trigger, player) {
                await player.draw();
                player.skip("phaseDraw");
                event.target.skip("phaseDraw");
            },
            ai: {
                wuxie(target, card, player, viewer) {
                    if (get.attitude(viewer, player._trueMe || player) > 0 || target.skipList.includes("phaseUse")) {
                        return 0;
                    }
                },
                basic: {
                    order: 6,
                    useful: (card, i) => 8 / (3 + i),
                    value: 6.5,
                },
                result: {
                    target(player, target) {
                        if (target.skipList.includes("phaseDraw")) {
                            return 0;
                        }
                        return -1;
                    }
                },
                tag: {
                    draw: 1,
                    skip: "phaseDraw",
                },
            },
        },
        ql_weidiandayuan: {
            fullskin: true,
            type: "trick",
            wuxieable: true,
            global: ["ql_weidiandayuan_skill"],
            notarget: true,
            async content(event, trigger, player) {
                const evt = event.getParent(3)._trigger;
                if (evt.cards?.length) {
                    await player.gain(evt.cards.filterInD(), "gain2");
                } else {
                    game.log(player, "取消了", evt.card, "的所有目标");
                    evt.targets.length = 0;
                }
            },
            ai: {
                basic: {
                    useful: [6, 4],
                    value: [6, 4],
                },
                result: {
                    player: 1,
                },
            },
        },
    },
    //卡牌的技能
    skill: {
        ql_xiuyangshengxi_recover: {
            mark: true,
            marktext: "休",
            intro: {
                name: "休养生息",
                content: "下次使用的伤害类牌无效",
            },
            forced: true,
            popup: false,
            cardSkill: true,
            charlotte: true,
            trigger: {
                player: "useCard",
            },
            filter(event, player) {
                return get.is.damageCard(event.card);
            },
            async content(event, trigger, player) {
                player.removeSkill(event.name);
                trigger.all_excluded = true;
                game.log(trigger.card, "被无效了");
            }
        },
        ql_xiuyangshengxi_draw: {
            mark: true,
            marktext: "生",
            intro: {
                name: "休养生息",
                content: "处于非濒死状态时下一次回复体力时取消之",
            },
            trigger: {
                player: "recoverBegin",
            },
            forced: true,
            popup: false,
            cardSkill: true,
            charlotte: true,
            filter(event, player) {
                return !player.isDying();
            },
            async content(event, trigger, player) {
                player.removeSkill(event.name);
                trigger.cancel();
            },
        },
        /*ql_jianbiqingye_skip: {
            trigger: {
                player: "phaseDrawBegin",
            },
            forced: true,
            content: function () {
                trigger.cancel();
                player.removeSkill("ql_jianbiqingye_skip");
            },
        },*/
        ql_shenxianshizu_skill: {
            trigger: {
                source: "damageBegin1",
            },
            onremove: true,
            forced: true,
            async content(event, trigger, player) {
                trigger.num += player.countMark(event.name);
            },
            marktext: "士",
            intro: {
                content: "本回合造成的伤害+#",
            }
        },
        //围点打援
        ql_weidiandayuan_skill: {
            trigger: {
                global: "useCard",
            },
            forced: true,
            priority: 6,
            filter(event, player) {
                if (event.directHit?.includes(player) || get.name(event.card) != "tao") {
                    return false;
                }
                return player.hasUsableCard("ql_weidiandayuan");
            },
            async content(event, trigger, player) {
                await player
                    .chooseToUse("是否使用【围点打援】响应" + get.translation(trigger.player) + "使用的" + get.translation(trigger.card) + "？")
                    .set("filterCard", function (card, player) {
                        if (get.name(card) != "ql_weidiandayuan") {
                            return false;
                        }
                        return lib.filter.cardEnabled(card, player, "forceEnable");
                    })
                    .set("respondTo", [trigger.player, trigger.card])
                    .set("goon", (() => {
                        const eff = trigger.targets.reduce((sum, target) => sum + get.effect(target, trigger.card, trigger.player, player));
                        if (trigger.cards?.length) {
                            return true;
                        }
                        return -eff;
                    })())
                    .set("ai1", function (card) {
                        return _status.event.goon;
                    });
            }
        },
    },
    //卡牌翻译
    translate: {
        ql_weiye: "伟业",
        ql_weiye_info: "出牌阶段，增加一点体力上限并对所有其他角色造成一点伤害，最后你获得一个额外回合。",
        ql_xiuyangshengxi: "休养生息",
        ql_xiuyangshengxi_info: "出牌阶段，对两名角色使用，第一名角色选择一项，第二名角色执行另一项：①恢复1点体力，然后令其使用的下一张伤害牌无效，直到其回合结束；②摸两张牌，然后令其处于非濒死状态时下一次回复体力时取消之，直到其回合开始。",
        ql_mingjue: "命决",
        ql_mingjue_info: "可重铸，不可被无懈，濒死状态下对自己使用，选择一名其他角色，依次展示你与其的手牌，手牌中【杀】较多的角色回复体力至上限，另一名角色失去一点体力。",
        ql_shenxianshizu: "身先士卒",
        ql_shenxianshizu_skill: "身先士卒",
        ql_shenxianshizu_info: "出牌阶段对自己使用，若手牌中有黑色牌，你弃置这些牌本回合造成伤害+1，否则你摸一张牌。",
        qlwh_card: "<span style='color:#FF00FF;font-weight:bold'>五花米线</span>",
        ql_weidiandayuan: "围点打援",
        ql_weidiandayuan_info: "一名角色使用【桃】时，你可以使用此牌获得对应【桃】的实体牌，若没有对应实体牌你取消此【桃】的目标。",
        ql_jianbiqingye: "坚壁清野",
        ql_jianbiqingye_info: "出牌阶段对其他角色使用，你摸一张牌并与目标跳过下一个摸牌阶段。",
    },
    //卡牌加入牌堆是的信息
    list: [
        ["spade", 13, "ql_weidiandayuan"],
        ["heart", 13, "ql_weidiandayuan"],
        ["club", 4, "ql_jianbiqingye"],
        ["club", 3, "ql_jianbiqingye"],
        ["spade", 1, "ql_shenxianshizu"],
        ["spade", 6, "ql_mingjue"],
        ["diamond", 1, "ql_xiuyangshengxi"],
        ["club", 1, "ql_xiuyangshengxi"],
        ["heart", 1, "ql_xiuyangshengxi"],
        ["spade", 1, "ql_xiuyangshengxi"],
        ["club", 4, "ql_weiye"],
    ]
}

export { cardPack };