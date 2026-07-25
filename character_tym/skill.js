import { lib, game, ui, get, ai, _status } from "../../../noname.js";

/** *@type { importCharacterConfig['skill'] } */
const skills = {
    //诺诺
    ql_mingmou: {
        trigger: {
            global: "phaseZhunbeiBegin",
        },
        filter(event, player) {
            return event.player.hp >= player.hp || game.openDoor();
        },
        async cost(event, trigger, player) {
            event.result = await trigger.player.chooseTarget()
            .set("prompt", `选择一名角色并令${get.translation(player)}弃置一张牌并选择一项：①令你本回合使用该颜色的牌没有距离和次数限制；②令你选择的角色不能使用或打出该颜色的手牌。`)
            .set("filterTarget", (card, player, target) => {
                return target != get.event().current;
            })
            .set("ai", target => -get.attitude(get.event().current, target))
            .set("current", trigger.player)
            .forResult();
        },
        async content(event, trigger, player) {
            const { targets: [target], name } = event;
            await player.draw();
            let result = await player.chooseToDiscard("he", "是否弃置一张牌并选择一项").forResult();
            if(result?.bool) {
                const color = get.color(result.cards[0]);
                const choice = ["选项一", "选项二"];
                if(game.openDoor()) {
                    choice.push("选项三");
                }
                result = await player.chooseControl()
                .set("controls", choice)
                .set("choiceList", [`令${get.translation(trigger.player)}使用${get.translation(color)}牌没有距离和次数限制`, `令${get.translation(target)}不能使用或打出${get.translation(color)}手牌`])
                .set("choice", get.rand(0, 1))
                .forResult();
                if(result?.index % 2 == 0) {
                    player.line(trigger.player);
                    trigger.player.addTempSkill(name + "_buff");
                    trigger.player.markAuto(name + "_buff", color);
                }
                if(result?.index > 0){
                    player.line(target);
                    target.addTempSkill(name + "_debuff");
                    target.markAuto(name + "_debuff", color);
                }
                if(result.control == "背水!") {
                    player.tempBanSkill(event.name, { global: "roundEnd" })
                    game.log(player, "的", event.name, "本轮失效了");
                }
            }
        },
        subSkill: {
            buff: {
                charlotte: true,
                onremove: true,
                forced: true,
                intro: {
                    content: "本回合使用$牌没有距离和次数限制",
                },
                mod: {
                    targetInRange(card, player, target) {
                        if(get.color(card) == "unsure" || player.getStorage("ql_mingmou_buff").includes(get.color(card))) {
                            return true;
                        }
                    },
                    cardUsable(card, player, num) {
                        if(get.color(card) == "unsure" || player.getStorage("ql_mingmou_buff").includes(get.color(card))) {
                            return Infinity;
                        }
                    },
                },
                trigger: {
                    player: "useCardAfter",
                },
                filter(event, player) {
                    return player.getHistory("useCard", evt => evt.card.name == "sha").length >= 5 && !game.openDoor();
                },
                async content(event, trigger, player) {
                    player.removeSkill(event.name, true);
                },
            },
            debuff: {
                charlotte: true,
                onremove: true,
                intro: {
                    content: "本回合不能使用或打出$手牌",
                },
                mod: {
                    cardEnabled2(card, player) {
                        if(get.position(card) == "h" && player.getStorage("ql_mingmou_debuff").includes(get.color(card))) {
                            return false;
                        }
                    },
                },
            },
        },
    },
    //希娜
    ql_qiyuan: {
        onremove(player, skill) {
            if(player.getExpansions(skill).length) {
                player.loseToDiscardpile(player.getExpansions(skill));
            }
        },
        intro: {
            markcount: "expansion",
            content: "expansion",
        },
        mod: {
            targetEnabled(card, player, target, now) {
                if(card.name == "sha" && target.getExpansions("ql_qiyuan").length) {
                    return false;
                }
            },
            cardEnabled(card, player) {
                if(card.name == "sha" && player.getExpansions("ql_qiyuan").length) {
                    return false;
                }
            },
        },
        trigger: {
            global: "phaseDrawBegin2",
        },
        filter(event, player) {
            return !event.numFixed;
        },
        async cost(event, trigger, player) {
            if(player.getExpansions(event.skill).length) {
                const result = await player.chooseButton([`${get.translation(event.skill)}:交给${get.translation(trigger.player)}一张牌取消其本次摸牌`, player.getExpansions(event.skill)])
                .set("ai", button => {
                    if(get.attitude(get.event().player, get.event().target) <= 0) {
                        return 6.5 - get.buttonValue(button);
                    }
                    return 0;
                })
                .set("target", trigger.player)
                .forResult();
                if(result?.bool) {
                    event.result = {
                        bool: true,
                        cost_data: result.links,
                    };
                }
            } else {
                event.result = await player.chooseBool(`${get.translation(event.skill)}: 是否摸一张牌令${get.translation(trigger.player)}额外摸一张牌，然后你与其可以分别将一张牌置于你武将牌上称为“祈愿”。`).forResult();
            }
        },
        async content(event, trigger, player) {
            const { cost_data: links } = event;
            if(player.getExpansions(event.name).length) {
                trigger.num = 0;
                await player.give(links, trigger.player);
                await player.draw();
                return;
            }
            await player.draw();
            player.line(trigger.player);
            trigger.num++;
            player.when({ global: "phaseDrawEnd" })
            .filter(evt => evt.player == trigger.player)
            .step(async (event2, trigger2, player2) => {
                await game.doAsyncInOrder([player, trigger.player], async current => {
                    const result = await current.chooseCard("he", 1, `将一张牌置于${get.translation(player)}的武将牌上称为“祈愿”`).forResult();
                    if(result?.bool) {
                        const next = player.addToExpansion(result.cards, "gain2");
                        next.gaintag.add(event.name);
                        await next;
                    }
                })
            })
        },
    },
    ql_sangmo: {
        trigger:{
            global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
        },
        getIndex(event, player) {
            return game.filterPlayer(target => {
                if(target.countCards("h") < target.maxHp) {
                    return event?.getl(target)?.hs?.length;
                }
                return false;
            }).sortBySeat();
        },
        filter(event, player, name, target) {
            return target?.isIn() && player.getExpansions("ql_qiyuan").length;
        },
        logTarget(event, player, name, target) {
            return target;
        },
        async cost(event, trigger, player) {
            const result = await player.chooseButton([`${get.translation(event.skill)}:移去一张“祈愿”牌令${get.translation(event.indexedData)}摸两张牌`, player.getExpansions("ql_qiyuan")])
                .set("ai", button => {
                    if(get.attitude(get.event().player, get.event().target) > 0) {
                        return get.buttonValue(button);
                    }
                    return 0;
                })
                .set("target", event.indexedData)
                .forResult();
            if(result?.bool) {
                event.result = {
                    bool: true,
                    cost_data: result.links,
                };
            }
        },
        async content(event, trigger, player) {
            const { cost_data: links } = event;
            await player.loseToDiscardpile(links);
            await player.draw();
            player.line(event.targets[0]);
            await event.targets[0].draw(2);
        },
    },
    //茯灵
    ql_tuitong: {
        enable: "phaseUse",
        usable: 1,
        filterCard(card){
            if(!ui.selected.cards.length) {
                return true;
            }
            return ui.selected.cards.some(cardx => get.color(card) == get.color(cardx));
        },
        selectCard: () => {
            if(ui.selected.cards.length) {
                return -1;
            }
            return [0, 1];
        },
        manualConfirm: true,
        multitarget: true,
        multiline: true,
        filterTarget(card, player, target) {
            return target.countCards("hej");
        },
        selectTarget: [1, Infinity],
        filterOk: () => {
            return ui.selected.targets.length;
        },
        prompt(event, player) {
            return `你可以弃置一种颜色所有牌或失去一点体力获得任意名角色区域内一张牌。`;
        },
        async content(event, trigger, player) {
            const { cards, targets } = event;
            if(!cards.length) {
                await player.loseHp();
            }
            player.line(targets);
            await game.doAsyncInOrder(targets, async target => {
                await player.gainPlayerCard(target, "hej");
            })
        },
    },
    //水瑶
    ql_chouxin: {
        mod: {
            cardUsable(card, player) {
                if(card.storage.ql_chouxin) {
                    return Infinity;
                }
            },
        },
        enable: "chooseToUse",
        getList(event, player) {
            const slotMap = {
                sha: 1,
                wuzhong: 2,
                guohe: "horse",
                tao: 5,
            };
            return get.inpileVCardList(info => {
                if(!slotMap.hasOwnProperty(info[2])) {
                    return false;
                }
                const vcard = get.autoViewAs({ name: info[2], nature: info[3], isCard: true, storage: { ql_chouxin: true } });
                return event.filterCard(vcard, player, event) && player.hasEnabledSlot(slotMap[info[2]]);
            })
        },
        filter(event, player) {
            return get.info("ql_chouxin").getList(event, player).length > 0;
        },
        chooseButton: {
            dialog(event, player) {
                const list = get.info("ql_chouxin").getList(event, player);
                return ui.create.dialog("筹芯", [list, "vcard"], "hidden");
            },
            check(button) {
                const player = get.player();
                const vcard = get.autoViewAs({ name: info[2], nature: info[3], isCard: true, storage: { ql_chouxin: true } });
                const value = player.getUseValue(card);
                return value;
            },
            backup(links, player) {
                return {
                    viewAs: {
                        name: links[0][2],
                        nature: links[0][3],
                        isCard: true,
                        storage: {
                            ql_chouxin: true,
                        },
                    },
                    links: links,
                    filterCard: () => false,
                    selectCard: -1,
                    popname: true,
                    log: false,
                    async precontent(event, trigger, player) {
                        switch(links[0][2]) {
                            case "sha": {
                                await player.disableEquip(1);
                                break;
                            }
                            case "wuzhong": {
                                await player.disableEquip(2);
                                break;
                            }
                            case "guohe": {
                                await player.disableEquip(3);
                                await player.disableEquip(4);
                                break;
                            }
                            case "tao": {
                                await player.disableEquip(5);
                                break;
                            }
                            default: {
                                player.chat("意料之外的结果");
                                break;
                            }
                        }
                    },
                };
            },
            prompt(links, player) {
                return "请选择" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "的目标";
            },
        },
        hiddenCard(player, name) {
            const slotMap = {
                sha: 1,
                wuzhong: 2,
                guohe: "horse",
                tao: 5,
            };
            if (!slotMap.hasOwnProperty(name)) return false;
            return player.hasEnabledSlot(slotMap[name]);
        },
    },
    ai: {
        order: 6,
    },
    ql_wanjue: {
        enable: "phaseUse",
        filter(event, player) {
            return player.countCards("he", card => {
                if(get.type(card) != "equip") {
                    return false;
                }
                return player.hasDisabledSlot(get.subtype(card));
            })
        },
        filterCard(card) {
            const player = get.player();
            if(get.type(card) != "equip") {
                return false;
            }
            return player.hasDisabledSlot(get.subtype(card));
        },
        selectCard: 1,
        lose: false,
        discard: false,
        async content(event, trigger, player) {
            await player.recast(event.cards);
            const subtype = get.subtype(event.cards[0]);
            if(subtype == "euqip3" || subtype == "equip4") {
                await player.enableEquip(3);
                await player.enableEquip(4);
            } else {
                await player.enableEquip(subtype);
            }
            await player.drawTo(player.maxHp);
        },
        ai: {
            order: 9,
            result: {
                player: 1,
            },
        },
    },
    //庞汐
    ql_shisuo: {
        global: "ql_shisuo_global",
        subSkill: {
            global: {
                enable: "phaseUse",
                filter(event, player) {
                    return game.hasPlayer(current => current.hasSkill("ql_shisuo") && current.isIn()) && player.getStorage("ql_shisuo_used").length < 3;
                },
                chooseButton: {
                    dialog(event, player) {
                        const list = ["basic", "trick", "equip"].map(type => ["", "", `caoying_${type}`]);
                        const dialog = ui.create.dialog("拾索", [list, "vcard"], "hidden");
                        return dialog;
                    },
                    check(button) {
                        return 1 + Math.random();
                    },
                    filter(button) {
                        const player = get.player();
                        return !player.getStorage("ql_shisuo_used").includes(button.link[2].slice(8));
                    },
                    backup(links, player) {
                        return {
                            type: links[0][2].slice("caoying_".length),
                            filterTarget(card, player, target) {
                                return target.hasSkill("ql_shisuo");
                            },
                            filterCard: () => false,
                            selectCard: -1,
                            log: false,
                            async precontent(event, trigger, player) {
                                event.result.targets[0].logSkill("ql_shisuo", player);
                            },
                            async content(event, trigger, player) {
                                const source = event.target;
                                const type = get.info(event.name).type;
                                player.addTempSkill("ql_shisuo_used");
                                player.markAuto("ql_shisuo_used", type);
                                const cards = [];
                                while (cards.length < 2) {
                                    const card = get.cardPile(card => {
                                        if (cards.includes(card)) return false;
                                        return get.type2(card) == type;
                                    });
                                    if (card) {
                                        cards.push(card);
                                    } else {
                                        break;
                                    }
                                }
                                if (cards.length) {
                                    await source.gain(cards, "draw");
                                }
                                if (source.countCards("he")) {
                                    event.result = await source
                                        .chooseCardTarget({
                                            prompt: "请选择交出或弃置两张牌",
                                            forced: true,
                                            filterCard: true,
                                            selectCard: Math.min(2, source.countCards("he")),
                                            position: "he",
                                            filterTarget: (card, player, target) => game.openDoor() ? target != player : (target != player || target == _status.currentPhase),
                                            selectTarget: game.openDoor() ? [0, 1] : 1,
                                            ai1(card) {
                                                return 8 - get.value(card);
                                            },
                                            ai2(target) {
                                                const att = get.attitude(get.player(), target);
                                                return att;
                                            },
                                        })
                                        .forResult();
                                }
                                if (event.result?.targets?.length) {
                                    if (event.result.targets[0] != source) {
                                        await source.give(event.result.cards, event.result.targets[0]);
                                    }
                                } else {
                                    await source.modedDiscard(event.result.cards);
                                }
                                const list = cards.reduce((list, card) => list.add(card.name), []);
                                if (list.length != 1) {
                                    const result2 = await player.chooseBool("选择失去1点体力，或取消本回合该技能失效").forResult();
                                    if (result2.bool) {
                                        await player.loseHp();
                                    } else {
                                        player.tempBanSkill("ql_shisuo_global");
                                    }
                                }
                            },
                            ai: {
                                result: {
                                    target(player, target) {
                                        return 2;
                                    },
                                },
                            },
                        };
                    },
                },
                ai: {
                    order: 13,
                    result: {
                        player: 1,
                    },
                },
            },
            used: {
                charlotte: true,
                onremove: true,
                intro: {
                    content: "本回合已经选择过$",
                },
            },
        },
    },
    ql_culing: {
        trigger: {
            player: "dying",
        },
        filter(event, player) {
            return ["basic", "trick", "equip"].every(item => player.getCards("he").map(card => get.type2(card)).unique().includes(item));
        },
        async cost(event, trigger, player) {
            event.result = await player.chooseCard({
                prompt: "重铸三张类型不同的牌回复体力至一点",
                filterCard: (card) => {
                    return ui.selected.cards.every(cardx => get.type2(card) != get.type2(cardx));
                },
                selectCard: 3,
                position: "he",
            }).forResult();
        },
        async content(event, trigger, player) {
            await player.recast(event.cards);
            await player[game.openDoor() ? 'recoverTo' : 'recover'](1);
        },
    },
    //郭知洁
    ql_guxin: {
        enable: "chooseToUse",
        filter(event, player) {
            return get.inpileVCardList(info => {
                if(info[0] != "basic") {
                    return false;
                }
                const card = get.autoViewAs({ name: info[2], naturn: info[3] }, "unsure");
                return event.filterCard(card, player, event);
            }).length;
        },
        chooseButton: {
            dialog(event, player) {
                const list = get.inpileVCardList(info => {
                    if(info[0] != "basic") {
                        return false;
                    }
                    const card = get.autoViewAs({ name: info[2], naturn: info[3] }, "unsure");
                    return event.filterCard(card, player, event);
                });
                const dialog = ui.create.dialog("固心", [list, "vcard"], "hidden");
                game.players.slice().sortBySeat().forEach(target => {
                    const str = get.translation(target);
                    const hs = target.getCards("h", { type: "basic" });
                    if(hs.length) {
                        dialog.add(`<div class="text center" style="margin: 0px;">${str}的手牌区</div>`);
                        dialog.add(hs);
                    }
                });
                return dialog;
            },
            select: 2,
            check(button) {
                const player = get.player();
                if(Array.isArray(button.link)) {
                    return player.getUseValue(button.link, player);
                }
                const owner = get.owner(button.link);
                return get.attitude(gplayer, owner) > 0 ? 3 : 6;
            },
            filter(button) {
                const player = get.player();
                if(Array.isArray(button.link)) {
                    return ui.selected.buttons.length == 0;
                }
                return ui.selected.buttons.length;
            },
            backup(links, player) {
                return {
                    viewAs: { name: links[0][2], nature: links[0][3], cards: [links[1]] },
                    log: false,
                    filterCard: () => false,
                    selectCard: -1,
                    links: links,
                    async precontent(event, trigger, player) {
                        player.line(get.owner(event.result.card.cards[0]));
                        event.result.cards = event.result.card.cards;
                        if(get.owner(event.result.card.cards[0]) != player) {
                            player.tempBanSkill("ql_guxin");
                        }
                    },
                };
            },
        },
        hiddenCard(player, name) {
            return get.type({name: name}) == "basic";
        },
        ai: {
            order: 5,
            result: {
                player: 2,
            },
        },
    },
    //沈栀
    ql_kenquan: {
        mark: true,
        marktext: "☯",
        zhuanhuanji: true,
        intro: {
            content(storage, player) {
                if(!storage) {
                    return `你成为牌的目标时，可以视为使用一张无距离限制的【推心置腹】`;
                }
                return `你成为牌的目标时，可以视为使用一张无距离限制的【无中生有】`;
            },
        },
        trigger: {
            target: "useCardToTargeted",
        },
        filter(event, player) {
            if(event?.card?.storage?.ql_kenquan) {
                return false;
            }
            const bool = player.storage.ql_kenquan;
            if(!bool) {
                return game.hasPlayer(current => current.isIn() && current.countCards("hej") && current != player) && (game.openDoor() || get.type2(event.card) != "trick");
            }
            return game.openDoor() || get.type2(event.card) == "trick";
        },
        async cost(event, trigger, player) {
            const bool = player.storage.ql_kenquan;
            event.result = bool ? (await player.chooseBool("是否视为使用一张【无中生有】").forResult()) :
                (await player.chooseTarget("选择【推心置腹】的目标")
                    .set("filterTarget", (card, player, target) => {
                        return target != player && target.countCards("hej");
                    })
                    .set("ai", (target) => {
                        return get.effect(target, { name: "tuixinzhifu" }, get.player(), get.player());
                    })
                    .forResult());
        },
        async content(event, trigger, player) {
            const { name, targets: [target = player] = [] } = event;
            const bool = player.storage[name];
            const card = get.autoViewAs({ name: bool ? "wuzhong" : "tuixinzhifu", isCard: true, storage: { [name]: true } });
            player.changeZhuanhuanji(name);
            await player.useCard(card, target, false);
            player
                .when({ global: "useCardAfter" })
                .filter(evt => evt.card == trigger.card)
                .then(async (event, trigger, player) => {
                    const cardList = trigger.cards.slice();
                    const lose_list = [], players = game.filterPlayer();
                    players.forEach((current) => {
                        const cards = current.getCards("hej", card => {
                            const cards = card?.cards?.length ? card.cards : [card];
                            return cardList.containsSome(...cards);
                        });
                        if (cards.length > 0) {
                            current.$throw(cards);
                            lose_list.push([current, cards]);
                            cardList.removeArray(cards);
                        }
                    });
                    if (lose_list.length) {
                        await game.loseAsync({ lose_list }).setContent("chooseToCompareLose");
                        await game.delayx();
                    }
                    if (cardList.length) {
                        await game.cardsDiscard(cardList);
                    }
                });
        },
    },
    ql_guitong: {
        limited: true,
        enable: "phaseUse",
        filter(event, player) {
            return player.countCards("hesj", card => get.is.damageCard(card, true));
        },
        filterCard(card) {
            return get.is.damageCard(card, true);
        },
        selectCard: -1,
        filterTarget(card, player, target) {
            return target != player;
        },
        position: "hesj",
        lose: false,
        discard: false,
        async content(event, trigger, player) {
            const { name, target } = event;
            player.awakenSkill(name);
            const limit = game.openDoor() ? [name + "_feng", "baiban"] : [
                [2, name + "_feng"],
                [3, "baiban"],
            ].reduce((result, [filter, value]) => {
                if(game.roundNumber >= filter) result.push(value);
                return result;
            }, [])
            player.line(target);
            target.addTempSkill(limit);
            let list = player.getCards("hesj", card => get.is.damageCard(card, true));
            while(target.isIn()) {
                if(!list.length) {
                    break;
                }
                const cards = list.randomGets(1);
                const card = get.autoViewAs({ name: "sha", cards: [cards] });
                await player.useCard(card, cards, target, false, false);
                list.removeArray(cards);
            }
            const skills = player.getSkills(null, false, false).filter(skill => !get.info(skill).charlotte && skill != name);
            skills.forEach(skill => {
                if(skill == "ql_kenquan") {
                    get.info(skill).usable = (game.openDoor() ? Infinity : 1);
                }
            });
            while(skills.length) {
                const result = await player.chooseButtonTarget({
                    createDialog: [
                        `归统：分配你的技能`,
                        [skills.map(skill => [skill, player.name]), "skill"],
                    ],
                    selectButton: [1, Infinity],
                    filterTarget(card, player, target) {
                        return target != player;
                    },
                    selectTarget: 1,
                })
                .set("ai", target => get.attitude(player, target))
                .forResult();
                if(result.bool) {
                    const { links, targets: [target] } = result;
                    target.addSkills(links);
                    skills.removeArray(links);
                }
                if(!result.bool) {
                    break;
                }
            }
            await player.die();
        },
        subSkill: {
            feng: {
                mark: true,
                charlotte: true,
                forced: true,
                intro: {
                    content: "本回合不能使用或打出牌",
                },
                mod: {
                    cardEnabled() {
                        return false;
                    },
                    cardRespondable() {
                        return false;
                    },
                    cardSavable() {
                        return false;
                    },
                },
            },
        },
        ai: {
            order: 13,
            result: {
                target: (player, target) => {
                    let numd = player.countCards("hej", (card) => {
                        if(!get.is.damageCard(card, true) || get.effect(target, { name: "sha" }, player, player) <= 0) {
                            return 0;
                        }
                        return 1;
                    }), nums = target.hp + target.hujia + game.countPlayer((current) => {
                        if(get.attitude(current, target) > 0) {
                            return current.countCards("hs") / 8;
                        }
                        return 0;
                    });
                    if(numd >= nums) {
                        return -numd;
                    }
                    return 0;
                },
            },
        },
    },
    ql_bingchuan_gong_skill: {
        equipSkill: true,
        forced: true,
        trigger: {
            player: "useCard",
        },
        filter(event, player) {
            return game.hasPlayer(current => current.isDamaged() && current != player);
        },
        async content(event, trigger, player) {
            game.filterPlayer(current => current.isDamaged() && current != player).forEach(target => {
                target.addTempSkill(event.name + "_effect");
                target.storage.ql_bingchuan_gong_skill_effect.add(trigger.card);
                target.markSkill(event.name + "_effect");
            });
        },
    },
    ql_bingchuan_gong_skill_effect: {
        equipSkill: true,
        charlotte: true,
        forced: true,
        firstDo: true,
        silent: true,
        popup: false,
        init(player, skill) {
            if(!player.storage[skill]) {
                player.storage[skill] = [];
            }
        },
        mod: {
            cardEnabled(card, player) {
                return false;
            },
            cardRespondable(card, player) {
                return false;
            },
            cardSavable(card, player) {
                return false;
            },
        },
        trigger: {
            player: ["damage", "damageCancelled", "damageZero"],
            source: ["damage", "damageCancelled", "damageZero"],
            target: ["shaMiss", "useCardToExcluded", "useCardToEnd", "eventNeutralized"],
            global: ["useCardEnd"],
        },
        filter(event, player) {
            const evt = event.getParent("useCard", true, true);
            if(evt && evt.effectedCount < evt.effectCount) {
                return false;
            }
            return player.storage.ql_bingchuan_gong_skill_effect && event.card && player.storage.ql_bingchuan_gong_skill_effect.includes(event.card) && (event.name != "damage" || event.notLink());
        },
        async content(event, trigger, player) {
            player.storage.ql_bingchuan_gong_skill_effect.remove(trigger.card);
            if(!player.storage.ql_bingchuan_gong_skill_effect.length) {
                player.removeSkill(event.name);
            }
        },
        marktext: "舒",
        intro: {
            content: "不能使用或打出牌",
        },
    },
    ql_bingchuan_ji_skill: {
        equipSkill: true,
        forced: true,
        firstDo: true,
        silent: true,
        popup: false,
        trigger: {
            source: "damageSource",
        },
        filter(event, player) {
            return event.player.hp == 1;
        },
        async content(event, trigger, player) {
            await trigger.player.damage("thunder", "nosource");
        },
    },
    ql_bingchuan_mao_skill: {
        equipSkill: true,
        forced: true,
        firstDo: true,
        silent: true,
        popup: false,
        mod: {
            selectTarget(card, player, range) {
                if(card.name == "sha" && range[1] != -1) {
                    range[1]++;
                }
            },
        },
        trigger: {
            player: "useCardToPlayered",
        },
        filter(event, player) {
            return event.card.name == "sha";
        },
        async content(event, trigger, player) {
            await trigger.target.randomDiscard({ discarder: player, position: "he" });
        },
    },
    ql_bingchuan_ge_skill: {
        equipSkill: true,
        forced: true,
        firstDo: true,
        silent: true,
        popup: false,
        trigger: {
            player: "useCardAfter",
        },
        filter(event, player) {
            return event.card.name == "sha" && event.targets.some(target => !target.hasHistory("damage", evt => evt.card == event.card) && target.isIn());
        },
        async content(event, trigger, player) {
            await game.doAsyncInOrder(trigger.targets.filter(target => !target.hasHistory("damage", evt => evt.card == event.card) && target.isIn()), async target => {
                return target.loseHp();
            })
        },
    },
    ql_bingchuan_shu_skill: {
        enable: ["chooseToUse", "chooseToRespond"],
        prompt: "将一张伤害牌当【闪】， 将一张非伤害牌当【杀】使用或打出。",
        position: "hes",
        filter(event, player) {
            let filter = event.filterCard;
            let storage = player.getStorage("ql_bingchuan_shu_skill_used");
            if(filter(get.autoViewAs({ name: "sha" }, "unsure"), player, event) && player.countCards("hes", card => !get.is.damageCard(card, true)) && !storage.includes("sha")) {
                return true;
            }
            if(filter(get.autoViewAs({ name: "shan" }, "unsure"), player, event) && player.countCards("hes", card => get.is.damageCard(card, true)) && !storage.includes("shan")) {
                return true;
            }
            return false;
        },
        filterCard(card, player, event) {
            event = event || _status.event;
            let filter = event._backup.filterCard;
            let bool = get.is.damageCard(card, true);
            if(!bool && filter({ name: "sha", cards: [card] }, player, event)) {
                return true;
            }
            if(bool && filter({ name: "shan", cards: [card] }, player, event)) {
                return true;
            }
            return false;
        },
        viewAs(cards, player) {
            if(cards.length) {
                let name = false;
                switch(get.is.damageCard(cards[0], true)) {
                    case false:
                        name = "sha";
                        break;
                    case true:
                        name = "shan";
                        break;
                }
                if(name) {
                    return { name: name };
                    player.addTempSkill("ql_bingchuan_shu_skill_used");
                    player.markAuto("ql_bingchuan_shu_skill_used", name);
                }
            }
            return null;
        },
        hiddenCard(player, name) {
            let storage = player.getStorage("ql_bingchuan_shu_skill_used");
            if(name == "sha" && !storage.includes("sha")) {
                return player.countCards("hes", card => !get.is.damageCard(card, true));
            }
            if(name == "shan" && !storage.incldues("shan")) {
                return player.countCards("hes", card => get.is.damageCard(card, true));
            }
        },
        subSkill: {
            used: {
                charlotte: true,
                onremove: true,
                intro: {
                    content: "已经使用过$",
                },
            },
        },
    },
    ql_bingchuan: {
        getList: ["ql_bingchuan_shu", "ql_bingchuan_ge", "ql_bingchuan_mao", "ql_bingchuan_ji", "ql_bingchuan_gong"],
        enable: "phaseUse",
        usable: 1,
        filter(event, player) {
            return _status.currentPhase?.isIn() && _status.currentPhase.countCards("he");
        },
        async content(event, trigger, player) {
            const target = _status.currentPhase;
            if (!target.countCards("he")) {
                return;
            }
            const result = await player
                .choosePlayerCard(target, "he", 2, "visible", button => {
                    if (!get.owner(button.link).getDiscardableCards(get.player(), "he").includes(button.link)) {
                        return false;
                    }
                    return true;
                })
                .set("filterOk", () => {
                    const num = ui.selected.buttons.reduce((sum, button) => sum + get.cardNameLength(button.link), 0);
                    return [2, 3, 5, 6, 9].includes(num);
                })
                .forResult();
            if (result?.bool && result.cards?.length) {
                await target.discard(result.cards).set("discarder", player)
                const result2 = await player
                    .chooseControl("回复1点体力", "出杀次数+1")
                    .set("prompt", "兵传：请选择一项")
                    .set("ai", () => {
                        const player = get.player();
                        if (player.isPhaseUsing() && player.hasSha()) {
                            return 1;
                        }
                        return 0;
                    })
                    .forResult();
                if (result2.index == 0) {
                    await player.recover();
                } else {
                    player.addSkill("ql_bingchuan_buff");
                    player.addMark("ql_bingchuan_buff", 1, false);
                }
                const num2 = result.cards.reduce((sum, card) => sum + get.cardNameLength(card), 0);
                if ([2, 3, 5, 6, 9].includes(num2)) {
                    const name = lib.skill.ql_bingchuan.getList[[2, 3, 5, 6, 9].indexOf(num2)];
                    if (name) {
                        const card = game.createCard(name, lib.suit.randomGet(), get.rand(1, 13));
                        if (card) {
                            await player.equip(card);
                        }
                    }
                }
            }
        },
        ai: {
            order() {
                return get.order({ name: "sha" }) + 0.5;
            },
            result: {
                player(player) {
                    return 1;
                },
            },
        },
        group: ["ql_bingchuan_damage", "ql_bingchuan_lose", "ql_bingchuan_destroy"],
        subSkill: {
            buff: {
                charlotte: true,
                onremove: true,
                mod: {
                    cardUsable(card, player, num) {
                        if (card.name == "sha") {
                            return num + player.countMark("ql_bingchuan_buff");
                        }
                    },
                },
            },
            damage: {
                trigger: {
                    player: "damageEnd",
                },
                filter(event, player) {
                    return _status.currentPhase?.isIn() && _status.currentPhase.countCards("he");
                },
                logTarget(event, player) {
                    return _status.currentPhase;
                },
                prompt2: "你可以观看并弃置当前回合角色两张牌（牌名字数和需为2，3，5，6，9），然后回复一点体力或令你出杀次数+1，然后装备攻击范围为这两张牌牌名字数和的装备。",
                async content(event, trigger, player) {
                    const next = game.createEvent(event.name + "_ql_bingchuan", false);
                    next.player = player;
                    next.setContent(lib.skill.ql_bingchuan.content);
                    await next;
                },
            },
            destroy: {
                trigger: {
                    global: ["loseEnd","equipEnd","addJudgeEnd","gainEnd","loseAsyncEnd","addToExpansionEnd"],
                },
                forced: true,
                locked: false,
                filter(event, player) {
                  return game.hasPlayer((current) => {
                    let evt = event.getl(current);
                    if (evt && evt.es) {
                      return evt.es.some((i) => i.name.indexOf("ql_bingchuan_") == 0);
                    }
                    return false;
                  });
                },
                async content(event, trigger, player) {
                  const cards2 = game.filterPlayer().map((current) => trigger.getl(current)).filter((evt) => Array.isArray(evt?.es)).flatMap((evt) => evt.es.filter((card) => card.name.indexOf("ql_bingchuan_") == 0));
                  await game.cardsGotoSpecial(cards2);
                  game.log(cards2, "被销毁了");
                },
            },
            lose: {
                trigger: {
                    player: "loseAfter",
                    global: ["gainAfter","equipAfter","addJudgeAfter","loseAsyncAfter","addToExpansionAfter"],
                },
                forced: true,
                locked: false,
                filter(event, player) {
                    const evt = event.getl(player);
                    if (!evt) return false;
                    return evt?.cards2.length;
                },
                async content(event, trigger, player) {
                    let num = player.getAllHistory("lose").length;
                    let equip = player.getCards("e", card => get.subtype(card) == "equip1").map(card => Math.abs(get.info(card, false)?.distance?.attackFrom) + 1);
                    equip.forEach(element => {
                        if(typeof element == "number" && element != 1 && num % element == 0) {
                            player.draw(element);
                        }
                    });
                    /*await player.recover();
                    const num = trigger.getl(player).cards2.length;
                    if (num > 0) {
                        player.addMark(event.name, num, false);
                    }
                    while (player.countMark(event.name) >= player.getAttackRange()) {
                        player.removeMark(event.name, player.getAttackRange(), false);
                        await player.draw(player.getAttackRange());
                    }*/
                },
            },
        },
    },
    ql_binghe: {
        trigger: {
            player: "phaseUseBegin",
        },
        limited: true,
        async content(event, trigger, player) {
            player.awakenSkill(event.name);
            const list = lib.skill.ql_bingchuan.getList;
            for (const i of list) {
                await player.expandEquip(1);
            }
            const cards = list.map(name => {
                const card = game.createCard(name, lib.suit.randomGet(), get.rand(1, 13));
                return card;
            });
            player.$gain2(cards);
            await game.delayx();
            for (const card of cards) {
                await player.equip(card);
            }
            player.when("phaseEnd")
                .then(async (event2, trigger2, player2) => {
                    for (const i of list) {
                        player.expandedSlots ??= {};
                        player.expandedSlots["equip1"] ??= 0;
                        if (player.expandedSlots["equip1"] == 0) {
                            break;
                        }
                        player.expandedSlots["equip1"] -= 1;
                    }
                    player.$syncExpand();
                    const cards2 = player.getCards("e", card => cards.includes(card));
                    if (cards2.length) {
                        await player.loseToDiscardpile(cards2);
                    }
                });
        },
    },
    //唐恬
    ql_shenxing: {
        perserveSkill: true,
        forced: true,
        locked: false,
        forceDie: true,
        forceOut: true,
        trigger: {
            player: ["dieAfter", "die"],
        },
        filter(event, player) {
            return !event.reserveOut;
        },
        derivation: ["new_rewusheng"],
        async content(event, trigger, player) {
            if (event.triggername == "dieAfter") {
                player.addSkill(event.name + "_revive");
            } else {
                await player.addSkills(get.info(event.name).derivation).set("forceDie", true);
            }
        },
        subSkill: {
            revive: {
                trigger: {
                    global: "phaseOver",
                },
                filter(event, player) {
                    return lib.skill.jdfengtu.check(event.player, player);
                },
                forced: true,
                charlotte: true,
                forceDie: true,
                forceOut: true,
                async content(event, trigger, player) {
                    player.removeSkill(event.name);
                    await player.reviveEvent();
                    player.addSkill("ql_shenxing_die");
                }
            },
            die: {
                trigger: {
                    player: "phaseEnd",
                },
                forced: true,
                charlotte: true,
                async content(event, trigger, player) {
                    player.removeSkill(event.name);
                    await player.die();
                }
            }
        }
    },
    ql_yijin: {
        trigger: {
            player: "loseAfter",
            global: ["loseAsyncAfter", "equipAfter", "addToExpansionAfter", "addJudgeAfter", "gainAfter"],
        },
        filter(event, player) {
            return event.getl?.(player)?.cards2?.some(card => get.color(card) == "red");
        },
        getIndex(event, player) {
            return event.getl?.(player)?.cards2?.filter(card => get.color(card) == "red");
        },
        forced: true,
        locked: false,
        async content(event, trigger, player) {
            await player.changeHujia(1);
            player.addSkill(event.name + "_nocount");
        },
        group: "ql_yijin_hujia",
        subSkill: {
            hujia: {
                trigger: {
                    player: "changeHujiaAfter",
                },
                filter(event, player) {
                    return player.hujia > player.getHp();
                },
                forced: true,
                locked: false,
                async content(event, trigger, player) {
                    await player.changeHujia(-player.hujia);
                    const num = game.dead.length + 1;
                    const result = await player
                        .chooseTarget({
                            prompt: `义进：请分配${num}点伤害给其他角色`,
                            selectTarget: [num, num + 1],
                            forced: true,
                            filterTarget(card, player, target) {
                                const { targets } = ui.selected;
                                if (targets.length >= get.event().selectTarget[0]) {
                                    return false;
                                }
                                return target != player;
                            },
                            ai(target) {
                                const eff = get.damageEffect(target, get.player(), get.player());
                                if (ui.selected.targets.includes(target)) {
                                    return eff;
                                }
                                return eff + 2;
                            },
                        })
                        .set("promptbar", "none")
                        .set("custom", {
                            add: {},
                            replace: {
                                target(target, e) {
                                    const event = get.event();
                                    if (!event.isMine() || !event.filterTarget(void 0, event.player, target)) {
                                        return;
                                    }
                                    if (target.classList.contains("selectable") == false) {
                                        return;
                                    }
                                    target.unprompt();
                                    target.classList.add("selected");
                                    ui.selected.targets.push(target);
                                    const count = get.numOf(ui.selected.targets, target);
                                    target.prompt(`伤害×${count}`);
                                    game.check();
                                },
                            },
                        })
                        .forResult();
                    const { targets } = result;
                    if (targets?.length) {
                        const list = targets.slice();
                        targets.unique();
                        player.line(targets);
                        await game.doAsyncInOrder(targets, async target => {
                            return target.damage({ num: get.numOf(list, target) });
                        });
                    }
                },
            },
            nocount: {
                mod: {
                    cardUsable(card, player) {
                        return Infinity;
                    }
                },
                charlotte: true,
                forced: true,
                popup: false,
                firstDo: true,
                mark: true,
                intro: {
                    content: "使用的下一张牌无次数限制且不计入次数",
                },
                trigger: { player: "useCard1" },
                filter(event, player) {
                    return event.card.name == "sha";
                },
                async content(event, trigger, player) {
                    player.removeSkill(event.name);
                    if (trigger.addCount !== false) {
                        trigger.addCount = false;
                        const stat = player.getStat().card,
                            name = trigger.card.name;
                        if (typeof stat[name] == "number") {
                            stat[name]--;
                        }
                        game.log(trigger.card, "不计入次数");
                    }
                },
            },
        }
    },
    ql_guanci: {
        forced: true,
        locked: false,
        trigger: {
            player: "phaseBegin",
        },
        logTarget: (event, player) => game.filterPlayer(target => target != player),
        filter(event, player) {
            return game.hasPlayer(target => target != player);
        },
        async content(event, trigger, player) {
            const { targets } = event;
            const noGive = [];
            await game.doAsyncInOrder(targets, async target => {
                if (!target.countGainableCards(player, "hej")) {
                    noGive.push(target);
                    return;
                }
                const result = await target
                    .choosePlayerCard({
                        prompt: `贯刺：请选择要交给${get.translation(player)}的牌`,
                        position: "hej",
                        target,
                        ai(button) {
                            return 6 - get.buttonValue(button);
                        },
                    })
                    .forResult();
                if (result?.bool) {
                    const { cards } = result;
                    await target.give(cards, player);
                } else {
                    noGive.push(target);
                }
            })
            player.addTempSkill(event.name + "_effect");
            if (noGive.length) {
                player.markAuto(event.name + "_effect", noGive);
            }
        },
        subSkill: {
            effect: {
                mod: {
                    targetInRange(card, player, target) {
                        if (player.getStorage("ql_guanci_effect").includes(target)) {
                            return true;
                        }
                    }
                },
                intro: {
                    content(storage = [], player, skill) {
                        let str = "";
                        if (storage.length) {
                            str += `你对${get.translation(storage)}使用牌没有距离限制；`;
                        }
                        str += "使用【杀】可改为刺【杀】且结算后你摸一张牌";
                        return str;
                    }
                },
                charlotte: true,
                onremove: true,
                mark: true,
                trigger: {
                    player: ["useCard1", "useCardAfter"],
                },
                filter(event, player, name) {
                    if (event.card.name != "sha") {
                        return false;
                    }
                    return true;
                },
                async cost(event, trigger, player) {
                    if (event.triggername == "useCard1") {
                        event.result = await player
                            .chooseBool({
                                prompt: get.prompt(event.skill),
                                prompt2: "将" + get.translation(event.card) + "改为刺杀",
                                choice: (() => {
                                    const { targets, card } = trigger;
                                    let eff = 0,
                                        nature = card.nature;
                                    for (let i = 0; i < targets.length; i++) {
                                        eff -= get.effect(targets[i], card, player, player);
                                        trigger.card.nature = "fire";
                                        eff += get.effect(targets[i], card, player, player);
                                        trigger.card.nature = nature;
                                    }
                                    return eff > 0;
                                })
                            })
                            .forResult();
                    } else {
                        event.result = { bool: true };
                    }
                },
                async content(event, trigger, player) {
                    if (event.triggername == "useCard1") {
                        const nature = trigger.card.nature;
                        game.setNature(trigger.card, "stab");
                        if (get.itemtype(trigger.card) == "card") {
                            var next = game.createEvent("ql_guanci_clear");
                            next.nature = nature;
                            next.card = trigger.card;
                            event.next.remove(next);
                            trigger.after.push(next);
                            next.setContent(async function (event, trigger, player) {
                                game.setNature(trigger.card, event.nature);
                            });
                        }
                    } else {
                        await player.draw();
                    }
                }
            }
        },
    },
    ql_chuanshu: {
        enable: "phaseUse",
        usable: 2,
        onChooseToUse(event) {
            if (game.online) {
                return;
            }
            const targets = [];
            event.player.getHistory("useSkill", evt => {
                if (evt.skill != "ql_chuanshu" || !evt.targets?.length) {
                    return false;
                }
                targets.addArray(evt.targets);
            });
            event.set("ql_chuanshu_targets", targets);
        },
        filter(event, player) {
            const { filterCard, filterTarget } = get.info("ql_chuanshu");
            return game.hasPlayer(current => filterTarget(null, player, current)) && player.countCards("he", card => filterCard(card, player));
        },
        position: "he",
        check(card) {
            return 9 - get.value(card);
        },
        filterTarget(card, player, target) {
            const { ql_chuanshu_targets } = get.event();
            return !ql_chuanshu_targets.includes(target);
        },
        filterCard(card, player) {
            return true;
        },
        lose: false,
        discard: false,
        async content(event, trigger, player) {
            const { cards, target, name } = event;
            await player.give(cards, target);
            target.addGaintag(cards, name);
        },
        group: ["ql_chuanshu_show"],
        subSkill: {
            show: {
                trigger: {
                    global: "phaseZhunbeiBegin",
                },
                charlotte: true,
                forced: true,
                filter(event, player) {
                    return event.player.getCards("h", card => card.hasGaintag("ql_chuanshu")).length;
                },
                async content(event, trigger, player) {
                    await trigger.player.showCards(trigger.player.getCards("h", card => card.hasGaintag("ql_chuanshu")));
                    await game.delay();
                    const card = get.cards(1);
                    await trigger.player.showCards(card);
                    await game.delay();
                    if (trigger.player.getCards("h", card => card.hasGaintag("ql_chuanshu")).map(card => get.suit(card)).unique().includes(get.suit(card))) {
                        await game.doAsyncInOrder([player, trigger.player], async current => {
                            await current.recover();
                            await current.draw(2);
                        })
                        player.addMark("ql_chuanshu", false);
                    } else {
                        trigger.player.addTempSkill("ql_chuanshu_debuff");
                    }
                    trigger.player.removeGaintag("ql_chuanshu");
                },
            },
            debuff: {
                intro: {
                    content: "本回合手牌上限为0",
                },
                mod: {
                    maxHandcard(player, num) {
                        return num = 0;
                    },
                },
            },
        },
        ai: {
            order: 8,
            result: {
                target: -1,
            },
        },
    },
    ql_dansuan: {
        intro: {
            content: `本回合已获得#张牌`,
        },
        init(player) {
            player.storage.ql_dansuan = 0;
            player.addMark("ql_chuanshu", false);
        },
        trigger: {
            player: ["phaseZhunbeiBegin", "phaseJieshuBegin", "damageEnd"],
            global: "phaseBefore",
        },
        frequent(event, player, name) {
            if (name == "phaseBefore") {
                return true;
            }
            return false;
        },
        async content(event, trigger, player) {
            if (event.triggername == "phaseBefore") {
                player.storage.ql_dansuan = 0;
                return;
            }
            const next = player.chooseToMove_new("胆算", true)
            next.set("list", [
                ["牌堆顶", get.cards(player.countMark("ql_chuanshu") + 2)],
                ["牌堆底"],
                ["获得牌"],
            ]);
            next.set("filterOk", moved => {
                const player = get.player();
                return moved[2].length <= player.countMark("ql_chuanshu") - player.storage.ql_dansuan;
            });
            next.set("filterMove", (from, to, moved) => {
                const player = get.player();
                if (typeof to != "number" || to != 2) {
                    return true;
                }
                return moved[2].length < player.countMark("ql_chuanshu") - player.storage.ql_dansuan;
            });
            const result = await next.forResult();
            if (!result?.bool || !result.moved?.length) {
                return;
            }
            const [top, bottom, hand] = result.moved;
            if (hand?.length) {
                await player.gain(hand, "gain2");
                player.storage.ql_dansuan += hand.length;
            }
            if (bottom?.length) {
                for (let i = 0; i < bottom.length; i++) {
                    ui.cardPile.appendChild(bottom[i]);
                }
            }
            if (top?.length) {
                for (let i = top.length - 1; i >= 0; i--) {
                    ui.cardPile.insertBefore(top[i], ui.cardPile.firstChild);
                }
            }
        },
    },
    //凌勇
    ql_qunqi: {
        trigger: {
            global: "phaseDrawBegin2",
        },
        filter(event, player) {
            return player.countCards("he", card => get.type2(card) == "equip") && !event.numFixed;
        },
        async cost(event, trigger, player) {
            event.result = await player.chooseCard()
                .set("filterCard", (card) => {
                    return get.type2(card) == "equip";
                })
                .set("position", "he")
                .set("selectCard", [1, Infinity])
                .set("prompt", `弃置任意张装备牌令${get.translation(trigger.player)}额外摸两倍的牌且本回合可以额外使用等量张【杀】`)
                .set("ai", card => {
                    const { player } = get.event();
                    return get.attitude(player, trigger.player) - get.value(card) / 5;
                })
                .forResult();
        },
        async content(event, trigger, player) {
            await player.modedDiscard(event.cards);
            player.line(trigger.player);
            trigger.num += (game.openDoor() ? event.cards.length * 2 : event.cards.length + 1);
            trigger.player.addTempSkill(event.name + "_effect");
            trigger.player.addMark(event.name + "_effect", event.cards.length, false);
            player.when({ player: "phaseEnd" })
                .step(async (event, trigger, player) => {
                    trigger.player.clearMark("ql_qunqi_effect");
                })
        },
        subSkill: {
            effect: {
                mod: {
                    cardUsable(card, player, num) {
                        if (card.name == "sha") {
                            return num + player.countMark("ql_qunqi_effect");
                        }
                    }
                },
                mark: true,
                intro: {
                    content: "本回合可额外使用$张【杀】",
                },
            },
        },
    },
    ql_diance: {
        trigger: {
            player: "phaseZhunbeiBegin",
        },
        forced: true,
        filter(event, player) {
            return !["basic", "trick", "equip"].every(type => player.getCards("h").map(card => get.type2(card, false)).unique().includes(type));
        },
        async content(event, trigger, player) {
            for (let i = 0; i < (game.openDoor() ? 5 : 3); i++) {
                await player.draw();
                if (["basic", "trick", "equip"].every(type => player.getCards("h").map(card => get.type2(card, false)).unique().includes(type))) {
                    break;
                }
            }
        },
    },
    //江雾瞳
    ql_erxiang: {
        intro: {
            content: "本轮$使用或打出牌时需弃置一张同名牌否则无效",
        },
        trigger: {
            global: "roundStart",
        },
        forced: true,
        async content(event, trigger, player) {
            const targeted = player.storage?.ql_erxiang;
            if (!game.hasPlayer(current => current != player && (targeted ? current != targeted : true))) {
                delete player.storage.ql_erxiang;
                return;
            }
            const result = await player.chooseTarget()
                .set("filterTarget", (card, player, target) => {
                    return target != player && (get.event().targeted ? target != get.event().targeted : true);
                })
                .set("prompt", "令一名角色本轮使用或打出牌时需弃置一张同名牌否则无效")
                .set("targeted", targeted)
                .set("ai", (target) => {
                    return -get.attitude(player, target);
                })
                .forResult();
            if(result.bool) {
                const { targets: [target] } = result;
                player.line(target);
                player.storage.ql_erxiang = target;
                target.addTempSkill(event.name + "_debuff", { global: "roundEnd" });
            } else {
                delete player.storage.ql_erxiang;
            }
            
        },
        subSkill: {
            debuff: {
                charlotte: true,
                forced: true,
                trigger: {
                    player: ["useCard", "respond"],
                },
                filter(event, player) {
                    return game.openDoor() || !player.getStorage("ql_erxiang_canceled").includes(get.type2(event.card));
                },
                async content(event, trigger, player) {
                    const cardx = trigger.card;
                    const result = await player.chooseToDiscard()
                        .set("filterCard", (card) => {
                            return card.name == get.event().cardx.name;
                        })
                        .set("prompt", `弃置一张与${get.translation(cardx)}相同牌名的牌否则令${get.translation(cardx)}无效`)
                        .set("cardx", cardx)
                        .set("ai", (card) => 10 - get.useful(card))
                        .forResult();
                    if (!result.bool) {
                        player.addTempSkill("ql_erxiang_canceled");
                        player.markAuto("ql_erxiang_canceled", get.type2(cardx));
                        if (trigger.name == "useCard") {
                            trigger.targets.length = 0;
                            trigger.all_excluded = true;
                        }
                        if (trigger.name == "respond") {
                            trigger.cancel();
                            let evt = trigger.getParent();
                            if (evt.name == "chooseToRespond") {
                                evt.result.bool = false;
                            }
                        }
                    }
                },
            },
            canceled: {
                charlotte: true,
                forced: true,
                onremove: true,
                intro: {
                    content: "本回合已经取消过$",
                },
            },
        },
    },
    ql_jiahui: {
        trigger: {
            source: "damageSource",
            player: "damageEnd",
        },
        check: () => true,
        filter(event, player) {
            return event.player.isIn();
        },
        prompt2(event, player) {
            return `是否令${get.translation(event.player)}摸一张牌，然后你获得其区域内一张牌`;
        },
        async content(event, trigger, player) {
            await trigger.player.draw();
            if (trigger.player != player || trigger.player.countCards("ej") > 0) {
                player.line(trigger.player);
                await player.gainPlayerCard(trigger.player == player ? "ej" : "hej", trigger.player);
            }
        },
    },
    //青九丘
    ql_jiuwei: {
        forced: true,
        perserveSkill: true,
        enable: "chooseToUse",
        hiddenCard(player, name) {
            return name == "tao";
        },
        filter(event, player) {
            return event.filterCard(get.autoViewAs({ name: "tao" }, "unsure"), player, event);
        },
        onChooseToUse(event) {
            if (!game.online) {
                event.set("ql_jiuwei", get.cards(9, true));
            }
        },
        chooseButton: {
            dialog(event, player) {
                const dialog = ui.create.dialog("九尾", "hidden");
                const cards = get.event().ql_jiuwei;
                dialog.add('<div class="text center" style="margin: 0px;">牌堆顶</div>');
                dialog.add(cards);
                game.players.slice().sortBySeat().forEach(target => {
                    const str = get.translation(target);
                    const hs = target.getCards("h", { suit: "heart" });
                    if (hs.length) {
                        dialog.add(`<div class="text center" style="margin: 0px;">${str}的手牌区</div>`);
                        dialog.add(hs);
                    }
                    const es = target.getCards("e", { suit: "heart" });
                    if (es.length) {
                        dialog.add(`<div class="text center" style="margin: 0px;">${str}的装备区</div>`);
                        dialog.add(es);
                    }
                    const js = target.getCards("j", { suit: "heart" });
                    if (js.length) {
                        dialog.add(`<div class="text center" style="margin: 0px;">${str}的判定区</div>`);
                        dialog.add(js);
                    }
                });
                return dialog;
            },
            check(button) {
                const { link: card } = button;
                const owner = get.owner(card);
                if (!owner) {
                    return 5;
                } else {
                    return get.attitude(get.player(), owner) > 0 ? 3 : 6;
                }
            },
            filter(button) {
                const { link: card } = button;
                return get.suit(card) == "heart" && get.event().getParent()._backup.filterCard(get.autoViewAs({ name: "tao" }, [card]), get.player(), get.event().getParent());
            },
            backup(links, player) {
                return {
                    viewAs: { name: "tao", cards: links },
                    selectCard: -1,
                    filterCard: () => false,
                    links,
                    async precontent(event, trigger, player) {
                        event.result.cards = get.info(event.name.slice(4)).links;
                    }
                }
            }
        },
        ai: {
            order: 7,
            result: {
                player(player) {
                    if (_status.event.dying) {
                        return get.attitude(player, _status.event.dying);
                    }
                    return 1;
                },
            },
        },
        group: ["ql_jiuwei_debuff", "ql_jiuwei_add"],
        init(player, skill) {
            game.players.concat(game.dead).forEach(target => {
                target.addSkill("ql_jiuwei_global");
            });
        },
        subSkill: {
            add: {
                silent: true,
                charlotte: true,
                trigger: {
                    global: "addPlayerAfter",
                },
                async content(event, trigger, player) {
                    trigger.result.target.addSkill("ql_jiuwei_global");
                }
            },
            global: {
                mark: true,
                charlotte: true,
                intro: {
                    markcount(storage, player, skill) {
                        return player.countCards("h", { suit: "heart" });
                    },
                    mark(dialog, storage, player) {
                        if (game.me.hasSkill("ql_jiuwei")) {
                            const cards = player.getCards("h", { suit: "heart" });
                            if (cards.length) {
                                dialog.addAuto(cards);
                            } else {
                                dialog.addText("红桃无了");
                            }
                        } else {
                            dialog.addText("雨女无瓜！");
                        }
                    },
                },
                mod: {
                    canBeDiscarded(card, player, target) {
                        if (get.suit(card) == "heart") {
                            return false;
                        }
                    },
                    cardDiscardable(card, player) {
                        if (get.suit(card) == "heart") {
                            return false;
                        }
                    }
                },
                trigger: {
                    player: "enterGame",
                    global: "phaseBefore",
                },
                filter(event, player) {
                    return event.name != "phase" || game.phaseNumber == 0;
                },
                silent: true,
                async content(event, trigger, player) {
                    game.players.concat(game.dead).forEach(target => {
                        target.addSkill("ql_jiuwei_global");
                    });
                },
            },
            debuff: {
                trigger: {
                    global: "phaseBefore",
                    player: ["gainMaxHpBegin", "loseMaxHpBegin", "enterGame"],
                },
                forced: true,
                filter(event, player) {
                    let bool = player.maxHp !== 1;
                    if (event.name === "phase") {
                        return bool && game.phaseNumber === 0;
                    }
                    return true;
                },
                async content(event, trigger, player) {
                    if (["gainMaxHp", "loseMaxHp"].includes(trigger.name)) {
                        trigger.cancel();
                    } else {
                        player.maxHp = 1;
                        player.update();
                    }
                },
            },
        }
    },
    ql_lingbo: {
        enable: "phaseUse",
        usable: 1,
        selectCard: [1, Infinity],
        filterCard: lib.filter.cardDiscardable,
        selectTarget() {
            return ui.selected.cards.length;
        },
        filterTarget: true,
        multitarget: true,
        multiline: true,
        check(card) {
            return 7 - get.value(card);
        },
        async content(event, trigger, player) {
            const { targets } = event;
            let index;
            await game.doAsyncInOrder(targets, async (target, idx) => {
                let result;
                if (targets.length == 1) {
                    result = { index: 2 };
                } else if (idx > 0 && idx == targets.length - 1) {
                    result = { index: index == 0 ? 1 : 0 };
                } else {
                    result = await target
                        .chooseControl({
                            choiceList: [
                                `弃置${idx + 1}张牌`,
                                `受到${idx + 1}点伤害`,
                            ],
                            choice: 0,
                        })
                        .forResult();
                }
                index = result.index;
                if (index % 2 == 0) {
                    await target.chooseToDiscard({
                        selectCard: idx + 1,
                        position: "he",
                        forced: true,
                    });
                }
                if (index > 0) {
                    await target.damage(idx + 1);
                }
            })
        },
        ai: {
            order: 5,
            result: {
                target: -1,
            }
        }
    },
    ql_shepo: {
        forced: true,
        trigger: {
            global: ["loseAfter", "loseAsyncAfter", "gainAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter"],
        },
        getIndex(event, player) {
            if (!game.getGlobalHistory("changeHp", evt => evt.player == player).length || event.getParent().name == "ql_shepo") {
                return [];
            }
            return game.filterPlayer(target => {
                return event.getl?.(target)?.cards2?.length > 0;
            }).sortBySeat();
        },
        filter(event, player, name, target) {
            return target.isIn();
        },
        logTarget(event, player, name, target) {
            return target;
        },
        async content(event, trigger, player) {
            const { targets: [target] } = event;
            let index;
            if (!target.countGainableCards(player, "he")) {
                index = 1;
            } else {
                const result = await player
                    .chooseControl({
                        prompt: "摄魄",
                        choice: get.attitude(player, target) <= 0 ? 0 : 1,
                        choiceList: [
                            `随机获得${get.translation(target)}一张牌`,
                            "摸一张牌"
                        ]
                    })
                    .forResult();
                index = result.index;
            }
            if (index == 0) {
                await player.randomGain(target, "he");
            } else {
                await player.draw();
            }
        }
    },
    //青萝
    ql_wanbu: {
        enable: "phaseUse",
        usable(skill, player) {
            return player.getDamagedHp() + 1;
        },
        filter(event, player) {
            return player.countCards("h");
        },
        map: {
            black: "重铸所有黑色牌",
            red: "重铸所有红色牌",
        },
        chooseButton: {
            dialog(event, player) {
                const skill = "ql_wanbu";
                const { map } = get.info(skill);
                const list = Object.keys(map).map(key => [key, map[key]]);
                return ui.create.dialog("###蔓补###", [list, "tdnodes"], "hidden");
            },
            filter(button) {
                const player = get.player();
                if (button.link == "black" && !player.countCards("h", card => get.color(card) == "black")) {
                    return false;
                }
                if (button.link == "red" && !player.countCards("h", card => get.color(card) == "red")) {
                    return false;
                }
                return true;
            },
            check(button) {
                let player = get.player();
                switch(button.link) {
                    case "black":
                        return player.getCards("h", card => get.color(card) == "black").map(card => get.type2(card)),unique().length;
                    case "red":
                        return player.getCards("h", card => get.color(card) == "red").map(card => get.type2(card)),unique().length;
                }
            },
            backup(links, player) {
                return {
                    filterCard: (card) => {
                        return get.color(card) == links[0];
                    },
                    selectCard: -1,
                    position: "h",
                    link: links[0],
                    discard: false,
                    lose: false,
                    log: false,
                    delay: false,
                    manualConfirm: true,
                    async content(event, trigger, player) {
                        const skill = "ql_wanbu";
                        const { cards, name } = event;
                        const { link } = get.info(name);
                        player.chat("曼波～～～");
                        await player.modedDiscard(cards);
                        await player.draw(cards.length);
                    },
                }
            },
        },
        ai: {
            order: 4,
            result: {
                player: 1,
            },
        },
    },
    ql_meixin: {
        trigger: {
            player: "loseAfter",
            global: "loseAsyncAfter",
        },
        forced: true,
        filter(event, player) {
            return event.type == "discard" && event.getl?.(player)?.cards2?.length > 0;
        },
        async content(event, trigger, player) {
            const colors = trigger.getl?.(player)?.cards2?.map(card => get.color(card)).unique();
            const types = trigger.getl?.(player)?.cards2?.map(card => get.type2(card)).unique();
            if (types.length > 1) {
                const result = await player.chooseTarget()
                    .set("filterTarget", (card, player, target) => {
                        return target.countCards("hej");
                    })
                    .set("selectTarget", () => {
                        return [1, get.event().num];
                    })
                    .set("prompt", `获得至多${get.translation(types.length)}名角色各一张牌`)
                    .set("num", types.length)
                    .set("ai", target => -get.attitude(player, target))
                    .set("forceDie", true)
                    .forResult();
                if (result?.bool) {
                    player.line(result.targets);
                    for (let i of result.targets) {
                        await player.gainPlayerCard(i, "hej");
                    }
                }
            }
            if (colors.length == 1) {
                await player.draw("nodelay");
            }
        },
    },
    //乔思眠
    ql_jishou: {
        trigger: {
            player: "gainAfter",
            global: "loseAsyncAfter",
        },
        frequent: true,
        filter(event, player) {
            return event.getg(player).length != 0 && event.getParent().name != "ql_jishou";
        },
        async content(event, trigger, player) {
            const { name } = event;
            const suits = trigger.getg(player).map(c => get.suit(c));
            const cards = lib.suit.filter(s => !suits.includes(s)).map(s => get.cardPile(c => get.suit(c) == s));
            if (cards.length) {
                await player.gain(cards, "gain2");
                if (player.countMark(name) > 0) {
                    await player.showCards(player.getCards("h"));
                    await player.discardPlayerCard(player, "hej", player.countMark(name), true);
                }
                if (player.countMark(name) < 2) {
                    player.addMark(name, false);
                }
                player.when({ global: "phaseEnd" })
                    .step(async (event, trigger, player) => {
                        player.clearMark(name);
                    })
            }
        },
    },
    ql_fenhuo: {
        enable: "phaseUse",
        trigger: {
            player: "damageEnd",
        },
        usable(skill, player) {
            if (get.event().name == "chooseToUse") {
                return 1;
            } else {
                //return 1;
                return Infinity;
            }
        },
        filterTarget(card, player, target) {
            return target.countCards("h");
        },
        selectTarget: 1,
        prompt: "将一名角色一种花色手牌置于牌堆顶",
        async cost(event, trigger, player) {
            event.result = await player.chooseTarget()
                .set("filterTarget", (card, player, target) => target.countCards("h"))
                .set("prompt", "将一名角色一种花色手牌置于牌堆顶")
                .forResult();
        },
        async content(event, trigger, player) {
            const { targets: [target], name } = event;
            const list = get.addNewRowList(target.getCards("h"), "suit", target);
            let result = await player.chooseButton(
                [
                    [
                        [[`分获：将${get.translation(target)}一种花色的手牌置于牌堆顶`], "addNewRow"],
                        [
                            dialog => {
                                dialog.classList.add("fullheight");
                                dialog.forcebutton = false;
                                dialog._scrollset = false;
                            },
                            "handle",
                        ],
                        list.map(item => [Array.isArray(item) ? item : [item], "addNewRow"]),
                    ],
                ],
                true
            )
                .set("filterButton", button => {
                    const player = get.player();
                    if (!button.links.length || button.links.some(card => !lib.filter.cardDiscardable(card, player, get.event().getParent().name))) {
                        return false;
                    }
                    return true;
                })
                .set("ai", button => {
                    const player = get.player();
                    const target = get.event().getParent().targets[0];
                    if (target == player) {
                        return button.links.reduce((sum, card) => sum + get.value(card, player), 0);
                    } else {
                        return button.links.length;
                    }
                })
                .forResult();
            if (!result?.links?.length) {
                return;
            }
            let cards = target.getCards("h", card => result.links.includes(get.suit(card, target)));
            if (cards?.length) {
                await target.loseToDiscardpile(cards);
                result = await player
                    .chooseToMove(true)
                    .set("list", [["牌堆顶", cards]])
                    .set("prompt", "分获：将其中任意数量牌置于牌堆顶（靠左的接近牌堆顶）")
                    .set("processAI", function (list) {
                        let cards = list[0][1],
                            player = _status.event.player,
                            target = _status.currentPhase || player,
                            name = _status.event.getTrigger()?.name,
                            countWuxie = current => {
                                let num = current.getKnownCards(player, card => {
                                    return get.name(card, current) === "wuxie";
                                });
                                if (num && current !== player) {
                                    return num;
                                }
                                let skills = current.getSkills("invisible").concat(lib.skill.global);
                                game.expandSkills(skills);
                                for (let i = 0; i < skills.length; i++) {
                                    let ifo = get.info(skills[i]);
                                    if (!ifo) {
                                        continue;
                                    }
                                    if (ifo.viewAs && typeof ifo.viewAs != "function" && ifo.viewAs.name == "wuxie") {
                                        if (!ifo.viewAsFilter || ifo.viewAsFilter(current)) {
                                            num++;
                                            break;
                                        }
                                    } else {
                                        let hiddenCard = ifo.hiddenCard;
                                        if (typeof hiddenCard == "function" && hiddenCard(current, "wuxie")) {
                                            num++;
                                            break;
                                        }
                                    }
                                }
                                return num;
                            },
                            top = [];
                        cards.sort((a, b) => {
                            return get.value(b, target) - get.value(a, target);
                        });
                        while (cards.length) {
                            if (get.value(cards[0], target) > 6) {
                                top.push(cards.shift());
                            } else {
                                break;
                            }
                        }
                        return [top, cards];
                    })
                    .forResult();
                if (result?.moved?.length) {
                    const top = result.moved[0];
                    if (top.length) {
                        game.log(player, "将", top, "置于牌堆顶");
                        await game.cardsGotoPile(top.reverse(), "insert");
                        const cardx = get.autoViewAs({ name: "wugu", isCard: true });
                        //result = await player.chooseBool(`是否使用${get.translation(cardx)}`).forResult();
                        if (player.hasUseTarget(cardx)) {
                            await player.chooseUseTarget(cardx, true);
                        }
                    }
                }
            }
            if (target == player) {
                player.addTempSkill(name + "_effect");
            }
        },
        subSkill: {
            effect: {
                charlotte: true,
                forced: true,
                mod: {
                    targetInRange(card, player, target) {
                        return true;
                    },
                    cardUsable(card) {
                        if(game.openDoor()) {
                            return Infinity;
                        }
                    },
                },
                trigger: {
                    player: "useCard",
                },
                ai: {
                    unequip: true,
                },
                async content(event, trigger, player) {
                    trigger.card.ql_fenhuo_unequip = true;
                },
            },
        },
        ai: {
            order: 6,
            result: {
                target(player, target) {
                    if (target === player) {
                        if(_status.currentPhase != player) {
                            return 0;
                        }
                        const shaCount = player.countCards("h", (card) => card.name === "sha");
                        const hs = player.countCards("h");
                        return shaCount - hs / 5;
                    }
                    if (get.attitude(player, target) <= 0) {
                        return -target.countCards("h") / 3;
                    }
                    return -10;
                },
            },
        },
    },
    //姬雨
    ql_qiaojin: {
        trigger: {
            global: ["logSkillBegin"],
        },
        filter(event, player) {
            if (["global", "equip"].includes(event.type)) {
                return false;
            }
            let skill = get.sourceSkillFor(event);
            if (!skill) {
                return false;
            }
            let info = get.info(skill);
            if (!info || info.charlotte || info.equipSkill || !info.comboSkill) {
                return false;
            }
            return true;
        },
        forced: true,
        async content(event, trigger, player) {
            await player.draw(2);
            const skill = get.sourceSkillFor(trigger);
            const evt = trigger.getParent()._trigger;
            if (evt?.name == "useCard" && trigger.skill == skill) {
                if (evt.addCount !== false) {
                    evt.addCount = false;
                    const stat = player.getStat().card, name = evt.card.name;
                    if (typeof stat[name] == "number") {
                        stat[name]--;
                    }
                    game.log(evt.card, "不计入次数");
                }
                const evtx = lib.skill.dcjianying.getLastUsed(player, evt);
                if (evtx && evtx.addCount !== false) {
                    evtx.addCount = false;
                    const stat = player.getStat().card, name = evtx.card.name;
                    if (typeof stat[name] == "number") {
                        stat[name]--;
                    }
                    game.log(evtx.card, "不计入次数");
                }
            }
        },
    },
    ql_jinpo: {
        comboSkill: true,
        mod: {
            aiOrder(player, card, num) {
                if (typeof card == "object") {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //这里要改，一个是技能id另一个是第二张牌的条件
                    if (evt?.card && !evt.ql_jinpo && get.is.damageCard(card)) {
                        return num + 10;
                    }
                }
            },
        },
        //主要效果放主技能
        trigger: {
            player: "useCard",
        },
        filter(event, player) {
            const { card } = event;
            //第二张牌的条件
            if (!get.is.damageCard(card)) {
                return false;
            }
            const evt = lib.skill.dcjianying.getLastUsed(player, event);
            //改id
            if (!evt || !evt.card || evt.ql_jinpo) {
                return false;
            }
            //第一张牌的条件
            return get.is.damageCard(evt.card);
        },
        async cost(event, trigger, player) {
            event.result = await player
                .chooseTarget(get.prompt2(event.skill), (card, player, target) => {
                    return target != player;
                })
                .set("ai", target => {
                    return get.damageEffect(target, get.player(), get.player());
                })
                .forResult();
        },
        async content(event, trigger, player) {
            trigger.set(event.name, true);
            const {
                targets: [target],
            } = event;
            await target.damage(2);
        },
        init(player, skill) {
            player.addSkill(skill + "_mark");
        },
        onremove(player, skill) {
            player.removeSkill(skill + "_mark");
        },
        subSkill: {
            //用来处理标记的子技能
            mark: {
                init(player, skill) {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //第一张牌的条件
                    if (evt?.card && get.is.damageCard(card) && !evt[skill.slice(0, -5)]) {
                        player.addTip(skill, "追讨 可连击");
                    }
                },
                onremove(player, skill) {
                    player.removeTip(skill);
                },
                charlotte: true,
                trigger: {
                    player: ["useCard1", "useCardAfter"],
                },
                forced: true,
                popup: false,
                firstDo: true,
                async content(event, trigger, player) {
                    if (event.triggername == "useCard1") {
                        //第一张牌的条件
                        if (get.is.damageCard(trigger.card)) {
                            player.addTip(event.name, "进破 可连击");
                        } else {
                            player.removeTip(event.name);
                        }
                    } else if (trigger[event.name.slice(0, -5)]) {
                        player.removeTip(event.name);
                    }
                },
            },
        },
    },
    ql_fanci: {
        comboSkill: true,
        mod: {
            aiOrder(player, card, num) {
                if (typeof card == "object") {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //这里要改，一个是技能id另一个是第二张牌的条件
                    if (evt?.card && !evt.ql_fanci && !get.is.damageCard(card)) {
                        return num + 10;
                    }
                }
            },
        },
        //主要效果放主技能
        trigger: {
            player: "useCard",
        },
        filter(event, player) {
            const { card } = event;
            //第二张牌的条件
            if (get.is.damageCard(card)) {
                return false;
            }
            const evt = lib.skill.dcjianying.getLastUsed(player, event);
            //改id
            if (!evt || !evt.card || evt.ql_fanci) {
                return false;
            }
            //第一张牌的条件
            return get.is.damageCard(evt.card);
        },
        async content(event, trigger, player) {
            trigger.set(event.name, true);
            trigger.effectCount += 2;
        },
        init(player, skill) {
            player.addSkill(skill + "_mark");
        },
        onremove(player, skill) {
            player.removeSkill(skill + "_mark");
        },
        subSkill: {
            //用来处理标记的子技能
            mark: {
                init(player, skill) {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //第一张牌的条件
                    if (evt?.card && get.is.damageCard(card) && !evt[skill.slice(0, -5)]) {
                        player.addTip(skill, "追讨 可连击");
                    }
                },
                onremove(player, skill) {
                    player.removeTip(skill);
                },
                charlotte: true,
                trigger: {
                    player: ["useCard1", "useCardAfter"],
                },
                forced: true,
                popup: false,
                firstDo: true,
                async content(event, trigger, player) {
                    if (event.triggername == "useCard1") {
                        //第一张牌的条件
                        if (get.is.damageCard(trigger.card)) {
                            player.addTip(event.name, "反刺 可连击");
                        } else {
                            player.removeTip(event.name);
                        }
                    } else if (trigger[event.name.slice(0, -5)]) {
                        player.removeTip(event.name);
                    }
                },
            },
        },
    },
    ql_youlong: {
        comboSkill: true,
        mod: {
            aiOrder(player, card, num) {
                if (typeof card == "object") {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //这里要改，一个是技能id另一个是第二张牌的条件
                    if (evt?.card && !evt.ql_youlong && get.is.damageCard(card)) {
                        return num + 10;
                    }
                }
            },
        },
        //主要效果放主技能
        trigger: {
            player: "useCard",
        },
        filter(event, player) {
            const { card } = event;
            //第二张牌的条件
            if (!get.is.damageCard(card)) {
                return false;
            }
            const evt = lib.skill.dcjianying.getLastUsed(player, event);
            //改id
            if (!evt || !evt.card || evt.ql_youlong) {
                return false;
            }
            //第一张牌的条件
            return !get.is.damageCard(evt.card);
        },
        async cost(event, trigger, player) {
            event.result = await player
                .chooseTarget(get.prompt2(event.skill), (card, player, target) => {
                    return target != player;
                })
                .set("ai", target => {
                    return get.effect(target, { name: "shunshou_copy2" }, player, player);
                })
                .forResult();
        },
        async content(event, trigger, player) {
            trigger.set(event.name, true);
            const {
                targets: [target],
            } = event;
            await player.gainPlayerCard(target, "hej");
            trigger.directHit.addArray(game.filterPlayer(current => current != player));
        },
        init(player, skill) {
            player.addSkill(skill + "_mark");
        },
        onremove(player, skill) {
            player.removeSkill(skill + "_mark");
        },
        subSkill: {
            //用来处理标记的子技能
            mark: {
                init(player, skill) {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //第一张牌的条件
                    if (evt?.card && !get.is.damageCard(card) && !evt[skill.slice(0, -5)]) {
                        player.addTip(skill, "追讨 可连击");
                    }
                },
                onremove(player, skill) {
                    player.removeTip(skill);
                },
                charlotte: true,
                trigger: {
                    player: ["useCard1", "useCardAfter"],
                },
                forced: true,
                popup: false,
                firstDo: true,
                async content(event, trigger, player) {
                    if (event.triggername == "useCard1") {
                        //第一张牌的条件
                        if (!get.is.damageCard(trigger.card)) {
                            player.addTip(event.name, "游龙 可连击");
                        } else {
                            player.removeTip(event.name);
                        }
                    } else if (trigger[event.name.slice(0, -5)]) {
                        player.removeTip(event.name);
                    }
                },
            },
        },
    },
    ql_yanzi: {
        comboSkill: true,
        mod: {
            aiOrder(player, card, num) {
                if (typeof card == "object") {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //这里要改，一个是技能id另一个是第二张牌的条件
                    if (evt?.card && !evt.ql_yanzi && !get.is.damageCard(card)) {
                        return num + 10;
                    }
                }
            },
        },
        //主要效果放主技能
        trigger: {
            player: "useCard",
        },
        filter(event, player) {
            const { card } = event;
            //第二张牌的条件
            if (get.is.damageCard(card)) {
                return false;
            }
            const evt = lib.skill.dcjianying.getLastUsed(player, event);
            //改id
            if (!evt || !evt.card || evt.ql_yanzi) {
                return false;
            }
            //第一张牌的条件
            return !get.is.damageCard(evt.card);
        },
        async content(event, trigger, player) {
            trigger.set(event.name, true);
            await player.recover();
            await player.turnOver(false);
            await player.link(false);
            const list = [];
            for (let i = 1; i < 6; i++) {
                for (let j = 0; j < player.countDisabledSlot(i); j++) {
                    list.push(i);
                }
            }
            if (list.length > 0) {
                await player.enableEquip(list);
            }
            player.addTempSkill(event.name + "_cancel");
        },
        init(player, skill) {
            player.addSkill(skill + "_mark");
        },
        onremove(player, skill) {
            player.removeSkill(skill + "_mark");
        },
        subSkill: {
            //用来处理标记的子技能
            mark: {
                init(player, skill) {
                    const evt = lib.skill.dcjianying.getLastUsed(player);
                    //第一张牌的条件
                    if (evt?.card && !get.is.damageCard(card) && !evt[skill.slice(0, -5)]) {
                        player.addTip(skill, "追讨 可连击");
                    }
                },
                onremove(player, skill) {
                    player.removeTip(skill);
                },
                charlotte: true,
                trigger: {
                    player: ["useCard1", "useCardAfter"],
                },
                forced: true,
                popup: false,
                firstDo: true,
                async content(event, trigger, player) {
                    if (event.triggername == "useCard1") {
                        //第一张牌的条件
                        if (!get.is.damageCard(trigger.card)) {
                            player.addTip(event.name, "燕姿 可连击");
                        } else {
                            player.removeTip(event.name);
                        }
                    } else if (trigger[event.name.slice(0, -5)]) {
                        player.removeTip(event.name);
                    }
                },
            },
            cancel: {
                charlotte: true,
                forced: true,
                trigger: {
                    player: "damageBegin3",
                },
                filter(event, player) {
                    return event.source != player;
                },
                async content(event, trigger, player) {
                    trigger.cancel();
                },

            },
        },
    },
    //白舒然
    ql_zhuofan: {
        trigger: {
            global: "phaseJieshuBegin",
            player: "useCardAfter",
        },
        filter(event, player) {
            if (event.name == "useCard") {
                return game.hasGlobalHistory("changeHp", evt => {
                    return evt.num && evt.getParent()?.card == event.card;
                })
            }
            return true;
        },
        check(event, player, name) {
            if (name != "phaseJieshuBegin") return true;
            const { player: target } = event;
            if (player == target) return true;
            if (get.attitude(player, target) > 0) {
                return player.hasCard(card => card.hasGaintag("ql_shoudu"), "h");
                if (target.isDamaged() && target.hp <= 2 && player.countCards("h") > target.countCards("h")) return true;
                return false;
            }
            if (get.attitude(player, target) < 0) {
                return player.getCards("h").reduce((sum, card) => sum + get.value(card, player), 0) + 1 < target.countCards("h");
            }
        },
        async content(event, trigger, player) {
            if (trigger.name == "useCard") {
                const result = await player.chooseTarget()
                    .set("filterTarget", (card, player, target) => {
                        return target != player;
                    })
                    .set("ai", target => get.effect(target, { name: "shunshou_copy" }, get.player(), get.player()))
                    .forResult();
                if (result.bool) {
                    const { targets } = result;
                    player.line(targets, "white");
                    const result2 = await player.gainPlayerCard(targets[0], "hej", true).forResult();
                    if (result2.bool) {
                        await player.chooseToGive(targets[0], "he", true);
                    }
                }
                return;
            }
            await player.draw();
            if (player != trigger.player) {
                player.line(trigger.player, "white");
                await player.swapHandcards(trigger.player);
            }
        },
    },
    ql_shoudu: {
        enable: "chooseToUse",
        sunbenSkill: true,
        filter(event, player) {
            return get.inpileVCardList(info => {
                if (info[0] !== "basic") {
                    return false;
                }
                const card = new lib.element.VCard({ name: info[2], nature: info[3], isCard: true });
                return event.filterCard(card, player, event);
            }).length;
        },
        chooseButton: {
            dialog(event, player) {
                const list = get.inpileVCardList(info => {
                    if (info[0] !== "basic") {
                        return false;
                    }
                    const card = new lib.element.VCard({ name: info[2], nature: info[3], isCard: true });
                    return event.filterCard(card, player, event);
                });
                const dialog = ui.create.dialog("守渡", [list, "vcard"], "hidden");
                dialog.direct = true;
                return dialog;
            },
            backup(links, player) {
                return {
                    viewAs: {
                        name: links[0][2],
                        isCard: true,
                    },
                    filterCard: () => false,
                    selectCard: -1,
                    popname: true,
                    log: false,
                    async precontent(event, trigger, player) {
                        const skill = "ql_shoudu";
                        player.awakenSkill(skill);
                        const cards2 = player.getCards("h");
                        if (cards2.length) {
                            player.addGaintag(cards2, skill);
                            player.addSkill(skill + "_restore");
                            //player.getCards("h", card => card.addGaintag(skill));
                        } else {
                            player.when({ global: "roundEnd" })
                            .step(async (event, trigger, player) => {
                                const skill = "ql_shoudu";
                                if (player.hasSkill(skill, null, null, false) && !player.hasSkill(skill)) {
                                    player.popup("守渡");
                                    player.restoreSkill(skill);
                                    game.log(player, "恢复了技能", "#g【守渡】");
                                }
                            })
                        }
                    },
                };
            },
            prompt(links, player) {
                return `视为使用一张${get.translation(links[0][3] || "")}${get.translation(links[0][2])}`;
            },
        },
        hiddenCard(player, name) {
            if (get.type(name) != "basic") {
                return false;
            }
            return true;
        },
        ai: {
            save: true,
            skillTagFilter(player, tag) {
                return player.countCards("h") != 5;
            },
            order: 3,
            respondSha: true,
            respondShan: true,
            result: {
                player(player, target) {
                    if (_status.event.dying) {
                        return get.attitude(player, _status.event.dying);
                    }
                    return 1;
                },
            },
        },
        subSkill: {
            restore: {
                charlotte: true,
                forced: true,
                trigger: {
                    player: ["loseAfter"],
                    global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter", "roundEnd"],
                },
                filter(event, player, name) {
                    if (name == "roundEnd") {
                        return true;
                    }
                    return !player.hasCard(card => card.hasGaintag("ql_shoudu"), "h");
                },
                async content(event, trigger, player) {
                    //game.log(event.triggername);
                    const skill = "ql_shoudu";
                    if (player.hasSkill(skill, null, null, false) && !player.hasSkill(skill)) {
                        player.popup("守渡");
                        player.restoreSkill(skill);
                        game.log(player, "恢复了技能", "#g【守渡】");
                    }
                    player.removeSkill(event.name);
                },
            },
        },
    },
    ql_shuangci: {
        enable: "phaseUse",
        //usable: 1,
        filterCard: true,
        selectCard: () => {
            return get.player().getDamagedHp() + 1;
        },
        position: "h",
        lose: false,
        discard: false,
        allowChooseAll: true,
        delay: 0,
        bloodStain(cards, player, bool) {
            for (let c of cards) {
                if (c && c.classList) {
                    game.broadcastAll(function (c) {
                        //c.destroyed = "discardPile";
                        c.classList.add("ql_bloodStain_tym");
                    }, c);
                }
            }
            if (bool) {
                game.log(`${get.translation(cards)}被${get.translation(player)}染成了血色！`);
            }
        },
        async content(event, trigger, player) {
            const { name, cards } = event;
            await player.loseHp();
            player.addGaintag(cards, "ql_shuangci");
            get.info(name).bloodStain(cards, player, true);
        },
        group: "ql_shuangci_effect",
        subSkill: {
            effect: {
                charlotte: true,
                forced: true,
                mod: {
                    targetInRange(card, player, target) {
                        if (get.color(card) == "black" && card.cards?.some(card => card.hasGaintag("ql_shuangci"))) {
                            return true;
                        }
                    },
                    cardUsable(card) {
                        if (get.color(card) == "red" && card.cards?.some(card => card.hasGaintag("ql_shuangci"))) {
                            return Infinity;
                        }
                    },
                },
                trigger: {
                    player: ["loseAfter", "useCard"],
                    global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
                },
                filter(event, player) {
                    if (event.name != "useCard") {
                        let evt = event.getl(player);
                        if (!evt || !evt.hs || !evt.hs.length) {
                            return false;
                        }
                        if (event.name == "lose") {
                            for (var i in event.gaintag_map) {
                                if (event.gaintag_map[i].includes("ql_shuangci")) {
                                    return true;
                                }
                            }
                            return false;
                        }
                        return player.hasHistory("lose", function (evt2) {
                            if (event != evt2.getParent()) {
                                return false;
                            }
                            for (var i2 in evt2.gaintag_map) {
                                if (evt2.gaintag_map[i2].includes("ql_shuangci")) {
                                    return true;
                                }
                            }
                            return false;
                        });
                    }
                    return true;
                },
                async content(event, trigger, player) {
                    if (trigger.name != "useCard") {
                        let num = 0;
                        const cards = trigger.getl(player).hs;
                        if (trigger.name == "lose") {
                            for (var i in trigger.gaintag_map) {
                                if (trigger.gaintag_map[i].includes("ql_shuangci")) {
                                    num += 3;
                                }
                            }
                        } else {
                            player.getHistory("lose", function (evt) {
                                if (trigger != evt.getParent()) {
                                    return false;
                                }
                                for (var i in evt.gaintag_map) {
                                    if (evt.gaintag_map[i].includes("ql_shuangci")) {
                                        num += (game.openDoor() ? 3 : 2);
                                    }
                                }
                            });
                        }
                        if (num > 0) {
                            player.draw(num);
                        }
                        return;
                    }
                    const list = trigger.cards.map(card => get.color(card));
                    if (list.includes("black")) {
                        trigger.baseDamage++;
                    }
                    if (list.includes("red")) {
                        trigger.directHit.addArray(game.filterPlayer(current => current != player));
                    }
                },
            },
        },
    },
    ql_lianci: {
        trigger: {
            player: "useCardToPlayered",
        },
        filter(event, player) {
            return get.tag(event.card, "damage");
        },
        async cost(event, trigger, player) {
            event.result = await player.choosePlayerCard(trigger.target, "hej").forResult();
        },
        async content(event, trigger, player) {
            const { name, cards: [card1] } = event;
            const { target, card: card2 } = trigger;
            await target.modedDiscard(card1);
            const [type1, type2] = [card1, card2].map(card => get.type2(card));
            if (type1 != type2) {
                trigger.getParent().baseDamage++;
            }
            player.addSkill(name + "_discard");
            if (!player.getStorage(name + "_discard").includes(type1)) {
                await player.draw();
                player.markAuto(name + "_discard", [type1]);
                player.when({ global: "useCard" })
                    .filter(evt => evt.card && get.type2(evt.card) == type1 && evt?.targets.includes(player))
                    .step(async (event, trigger, player) => {
                        await player.draw();
                        player.unmarkAuto("ql_lianci_discard", [type1]);
                    })
            }
        },
        subSkill: {
            discard: {
                charlotte: true,
                onremove: true,
                forced: true,
                intro: {
                    content: "本回合记录的类型：$",
                },
            },
        },
    },
    ql_yingci: {
        trigger: {
            player: "useCardToPlayered",
        },
        usable: 1,
        filter(event, player) {
            return player.isPhaseUsing();
        },
        async content(event, trigger, player) {
            await player.draw(trigger.targets.length);
            if (trigger.targets.every(current => current.countCards("h") <= player.countCards("h"))) {
                trigger.getParent().baseDamage++;
                trigger.getParent().directHit.addArray(trigger.targets);
            }
            player.addTempSkill(event.name + "_fuqi");
            player.markAuto(event.name + "_fuqi", trigger.targets);
        },
        subSkill: {
            fuqi: {
                charlotte: true,
                onremove: true,
                forced: true,
                intro: {
                    content: "$不能响应你的牌",
                },
                trigger: {
                    player: "useCard",
                },
                async content(event, trigger, player) {
                    trigger.directHit.addArray(player.getStorage(event.name))
                },
            },
        },
    },
    ql_jijie: {
        perserveSkill: true,
        forced: true,
        trigger: {
            player: ["damageBegin3", "dieBegin", "loseMaxHpBegin", "enterGame", "gainMaxHp"],
            global: "phaseBefore",
        },
        filter(event, player) {
            if (event.name != "damage" && event.name != "die" && event.name != "loseMaxHp") {
                return event.name != "phase" || game.phaseNumber == 0;
            }
            return true;
        },
        async content(event, trigger, player) {
            if (trigger.name != "damage" && trigger.name != "die" && trigger.name != "loseMaxHp") {
                player.maxHp = 1;
                player.hp = 1;
                player.update();
                return;
            }
            if (trigger.name == "die" || player.hp <= 0) {
                return;
            }
            trigger.cancel();
            if (trigger.name == "damage") {
                if (trigger?.source?.getCards("he")) {
                    player.line(trigger.source);
                    await player.discardPlayerCard(trigger.source, "hej", (game.openDoor() ? [1, 2] : 1));
                }
                await player.loseHp();
            }
        },
        ai: {
            effect: {
                player(card) {
                    if(get.tag(card, "damage")) {
                        return -2;
                    }
                },
            },
        },
    },
    ql_luyou: {
        enable: "chooseToUse",
        filter(event, player) {
            if (player.countCards("h") == (game.openDoor() ? 5 : 3)) {
                return false;
            }
            return get.inpileVCardList(info => {
                if (info[0] !== "basic" && info[2] !== "wuxie") {
                    return false;
                }
                const card = new lib.element.VCard({ name: info[2], nature: info[3], isCard: true });
                return event.filterCard(card, player, event);
            }).length;
        },
        chooseButton: {
            dialog(event, player) {
                const list = get.inpileVCardList(info => {
                    if (info[0] !== "basic" && info[2] !== "wuxie") {
                        return false;
                    }
                    const card = new lib.element.VCard({ name: info[2], nature: info[3], isCard: true });
                    return event.filterCard(card, player, event);
                });
                const dialog = ui.create.dialog("鹿佑", [list, "vcard"], "hidden");
                dialog.direct = true;
                return dialog;
            },
            check(button) {
                const player = get.player(),
                    card = new lib.element.VCard({ name: button.link[2], nature: button.link[3], isCard: true });
                let eff = _status.event.getParent().type == "phase" ? player.getUseValue(card) : 3;
                return eff + (game.openDoor() ? 5 : 3) - player.countCards("h");
            },
            backup(links, player) {
                return {
                    viewAs: {
                        name: links[0][2],
                        nature: links[0][3],
                        suit: "none",
                        number: null,
                        isCard: true,
                    },
                    popname: true,
                    ignoreMod: true,
                    filterCard(card, player) {
                        return player.countCards("h") > (game.openDoor() ? 5 : 3) && lib.filter.cardDiscardable(card, player, "ql_luyou");
                    },
                    position: "h",
                    selectCard() {
                        const player = get.player(),
                            num = player.countCards("h") - (game.openDoor() ? 5 : 3);
                        if (num > 0) {
                            return num;
                        }
                        return -1;
                    },
                    manualConfirm: true,
                    check(card) {
                        return 1 / Math.max(0.1, get.value(card));
                    },
                    async precontent(event, trigger, player) {
                        player.logSkill("ql_luyou");
                        const cards = event.result.cards;
                        if (cards.length) {
                            await player.modedDiscard(cards);
                        } else {
                            await player.drawTo((game.openDoor() ? 5 : 3));
                        }
                        const { name, nature } = event.result.card;
                        event.result.card = new lib.element.VCard({ name, nature, isCard: true });
                        event.result.cards = [];
                    },
                };
            },
            prompt(links, player) {
                const num = player.countCards("h") - (game.openDoor() ? 5 : 3);
                const str = num > 0 ? `弃置${get.cnNumber(num)}张手牌` : `摸${get.cnNumber(-num)}张牌`;
                return `${str}，然后视为使用一张${get.translation(links[0][3] || "")}${get.translation(links[0][2])}`;
            },
        },
        hiddenCard(player, name) {
            if (get.type(name) != "basic" && name != "wuxie") {
                return false;
            }
            return player.countCards("h") != (game.openDoor() ? 5 : 3);
        },
        ai: {
            save: true,
            skillTagFilter(player, tag) {
                return player.countCards("h") != (game.openDoor() ? 5 : 3);
            },
            order: 3,
            result: {
                player(player, target) {
                    if (_status.event.dying) {
                        return get.attitude(player, _status.event.dying);
                    }
                    return 1;
                },
            },
        },
    },
    ql_youren: {
        enable: "chooseToUse",
        usable(skill, player) {
            return player.countCards("ej");
        },
        filter(event, player) {
            if (player.isPhaseUsing()) {
                return false;
            }
            for (var i of lib.inpile) {
                if (get.type(i) == "trick" && i != "wuzhong" && event.filterCard({ name: i, isCard: true }, player, event)) {
                    return true;
                }
            }
            return false;
        },
        chooseButton: {
            dialog(event, player) {
                var list = [];
                for (var i of lib.inpile) {
                    if (get.type(i) == "trick" && i != "wuzhong" && event.filterCard({ name: i, isCard: true }, player, event)) {
                        list.push(["锦囊", "", i]);
                    }
                }
                return ui.create.dialog("游刃", [list, "vcard"]);
            },
            check(button) {
                const player = _status.event.player;
                if ((_status.event.getParent("useCard")?.card?.name == "shunshou" || _status.event.getParent("useCard")?.card?.name == "guohe") && _status.event.getParent("useCard")?.targets.includes(player)) {
                    return button.link[2] == "wuxie" ? 10 : 0;
                }
                return player.getUseValue({ name: button.link[2], isCard: true });
            },
            backup(links, player) {
                return {
                    viewAs: {
                        name: links[0][2],
                        isCard: true,
                    },
                    filterCard: () => false,
                    selectCard: -1,
                    popname: true,
                    log: false,
                    async precontent(event, trigger, player) {
                        player.logSkill("ql_youren");
                    },
                };
            },
            prompt(links, player) {
                return "请选择" + get.translation(links[0][2]) + "的目标";
            },
        },
        hiddenCard(player, name) {
            if (!lib.inpile.includes(name)) {
                return false;
            }
            var type = get.type(name);
            return (type == "trick") && player.countCards("ej") > 0;
        },
        ai: {
            order(item, player) {
                const current = _status.currentPhase;
                if (current) {
                    const history = current.getRoundHistory("useCard");
                    if (!history.length) return 9;
                }
                return 4;
            },
            result: {
                player(player, target) {
                    const evt = _status.event.getParent();
                    if (evt && evt.card && (evt.card.name == "shunshou" || evt.card.name == "guohe")) {
                        return 2;
                    }
                    return 1;
                },
            },
            espose: 0.2,
        },
    },
    ql_fengling: {
        trigger: {
            global: "phaseJieshuBegin",
            player: "gainAfter",
        },
        filter(event, player) {
            if (event.name == "phaseJieshu") {
                return player.hasHistory("useCard");
            }
            return event.getg(player).length > 1;
        },
        async cost(event, trigger, player) {
            if (trigger.name == "phaseJieshu") {
                event.result = await player.chooseBool(player.countCards("h") < player.maxHp ? `是否翻面并摸${get.translation(player.maxHp)}张牌` : "是否移动场上一张牌")
                .forResult();
            } else {
                event.result = {
                    bool: true,
                }
            }
        },
        async content(event, trigger, player) {
            if (trigger.name == "phaseJieshu") {
                if (player.countCards("h") < player.maxHp) {
                    await player.turnOver();
                    await player.draw(player.maxHp);
                } else {
                    if(!game.openDoor()){
                        await player.chooseToDiscard("e", true);
                    }
                    await player.moveCard();
                }
            } else {
                await player.chooseToUse(get.prompt(event.name).slice(0, -1) + "使用一张牌？",).set("logSkill", event.name);
            }
        },
    },
    ql_yingce: {
        trigger: {
            player: "phaseZhunbeiBegin",
        },
        filter(event, player) {
            return true;
        },
        async cost(event, trigger, player) {
            const list = get.inpileVCardList(info => {
                if (info[0] != "trick") {
                    return false;
                }
                const vcard = new lib.element.VCard({ name: info[2], isCard: true });
                return player.hasUseTarget(vcard);
            });
            if (!list?.length) {
                return;
            }
            const result = await player
                .chooseButton([get.prompt2(event.skill), [list, "vcard"]])
                .set("ai", button => {
                    const player = get.player(),
                        link = button.link;
                    const vcard = new lib.element.VCard({ name: link[2], isCard: true });
                    return player.getUseValue(vcard);
                })
                .forResult();
            if (result?.bool && result.links?.length) {
                event.result = {
                    bool: true,
                    cost_data: result.links[0][2],
                };
            }
        },
        async content(event, trigger, player) {
            const { cost_data: name } = event;
            player.addSkill(event.name + "_gain");
            player.when({ player: "useCardAfter" })
                .filter(evt => evt?.card?.storage?.ql_yingce)
                .step(async (event, trigger, player) => {
                    player.removeSkill("ql_yingce_gain");
                })
            const card = new lib.element.VCard({ name, isCard: true, storage: { ql_yingce: true, } });
            if (player.hasUseTarget(card)) {
                await player.chooseUseTarget(card, true);
            }
        },
        group: ["ql_yingce_use"],
        subSkill: {
            gain: {
                charlotte: true,
                forced: true,
                popup: false,
                trigger: {
                    player: "gainBegin",
                },
                async content(event, trigger, player) {
                    trigger.gaintag.add("ql_yingce");
                },
            },
            use: {
                charlotte: true,
                forced: true,
                inherit: "nocount",
                mod: {
                    targetInRange(card, player, target) {
                        if (get.number(card) === "unsure" || card.cards?.every(card => card.hasGaintag("ql_yingce"))) {
                            return true;
                        }
                    },
                    cardUsable(card) {
                        if (get.number(card) === "unsure" || card.cards?.every(card => card.hasGaintag("ql_yingce"))) {
                            return Infinity;
                        }
                    },
                },
                trigger: {
                    player: "useCard1",
                },
                filter(event, player) {
                    return (
                        player.hasHistory("lose", evt => {
                            return (evt.relatedEvent || evt.getParent()) == event && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("ql_yingce");
                        })
                    );
                },
                async content(event, trigger, player) {
                    trigger.directHit.addArray(game.filterPlayer(current => current != player));
                    if (trigger.addCount !== false) {
                        trigger.addCount = false;
                        const stat = player.getStat().card,
                            name = trigger.card.name;
                        if (typeof stat[name] === "number" && stat[name] > 0) {
                            stat[name]--;
                        }
                        game.log(trigger.card, "不计入次数");
                    }
                },
            },
        },
    },
    ql_kaiqu: {
        trigger: {
            global: "phaseEnd",
        },
        check(event, player) {
            let list = [];
            list.addArray(game.filterPlayer(current => current.isMinHandcard() && current.hasHistory("lose")));
            list.push(player);
            return list.reduce((sum, t) => sum + (get.effect(t, { name: "draw" }, player, player) * 2 || 0), 0) > 0;
        },
        prompt2() {
            let list = [];
            list.addArray(game.filterPlayer(current => current.isMinHandcard() && current.hasHistory("lose")));
            return `是否与${get.translation(list)}各摸两张牌`;
        },
        filter(event, player) {
            return game.filterPlayer(current => current.isMinHandcard() && current.hasHistory("lose")).length > 0;
        },
        async content(event, trigger, player) {
            let list = [];
            list.addArray(game.filterPlayer(current => current.isMinHandcard() && current.hasHistory("lose")));
            player.line(list);
            list.push(player);
            await game.asyncDraw(list, 2);
        },
    },
    //桑娅
    ql_pingchou: {
        trigger: {
            global: "damageEnd",
        },
        init(player, skill) {
            const key = skill + "_skills";
            if (!_status[key]) {
                if (!_status.characterlist) {
                    game.initCharacterList();
                }
                _status[key] = _status.characterlist.flatMap(name => get.character(name, 3).filter(i => {
                    const info = get.info(i);
                    if (info.ai && (info.ai.combo || info.ai.notemp || info.ai.neg)) {
                        return false;
                    }
                    return (
                        !info.charlotte &&
                        get.translation(i).includes("仇")
                    );
                })).unique();
            }
        },
        getIndex: event => event.num,
        filter(event, player) {
            return [player, player.getStorage("ql_pingchou", null)].includes(event.player) && event.player.isIn();
        },
        forced: true,
        async content(event, trigger, player) {
            const targets = [player];
            if (player.getStorage(event.name, null)) {
                targets.push(player.getStorage(event.name, null));
            }
            await game.asyncDraw(targets);
            const pre_targets = game.filterPlayer(target => {
                return target.getSkills(null, false, false).filter(i => !get.info(i).charlotte && get.is.zhuanhuanji(i, target)).length > 0;
            });
            let result;
            if (!pre_targets.length) {
                result = { index: 1 };
            } else {
                result = await player
                    .chooseControl()
                    .set("choiceList", [
                        "调整一名角色的转换技的状态",
                        "随机抽取一个技能名含“仇”的技能",
                    ])
                    .set("choice", 1)
                    .forResult();
            }
            if (result.index == 0) {
                const result = await player
                    .chooseTarget("平仇：调整一名角色的转换技的状态", true, (card, player, target) => get.event().targets.includes(target))
                    .set("targets", pre_targets)
                    .set("ai", () => Math.random())
                    .forResult();
                const { targets } = result;
                if (targets?.length) {
                    const [target] = targets;
                    player.line(target);
                    const skills = target.getSkills(null, false, false).filter(i => !get.info(i).charlotte && get.is.zhuanhuanji(i, target));
                    const result = await player
                        .chooseButton([`平仇：选择变更${get.translation(target)}一个技能的状态`, [skills, "skill"]], true)
                        .set("direct", true)
                        .forResult();
                    if (result?.links?.length) {
                        const skill = result.links[0];
                        game.log(target, "的", "#g【" + get.translation(skill) + "】", "发生了状态变更");
                        target.popup(skill, "wood");
                        target.changeZhuanhuanji(skill);
                    }
                }
            }
            if (result.index == 1) {
                const skill = _status[`${event.name}_skills`].filter(i => !player.hasSkill(i, null, false, false)).randomGet();
                if (skill) {
                    await player.addSkills(skill);
                }
            }
        },
        intro: {
            content: "player",
        },
        mod: {
            cardUsable(card, player, num) {
                if (card.name == "sha") {
                    return num + player.getSkills(null, false, false).filter(i => !get.info(i).charlotte).length;
                }
            }
        },
        group: ["ql_pingchou_init"],
        subSkill: {
            init: {
                forced: true,
                trigger: {
                    global: ["phaseBefore"],
                    player: ["enterGame"],
                },
                filter(event, player, name) {
                    return event.name !== "phase" || game.phaseNumber == 0;
                },
                async content(event, trigger, player) {
                    const result = await player
                        .chooseTarget(get.prompt2("ql_pingchou"), true)
                        .set("ai", target => get.player() != target ? get.attitude(get.player(), target) : 0)
                        .forResult();
                    const { targets } = result;
                    if (targets?.length) {
                        const [target] = targets;
                        player.line(target);
                        player.setStorage("ql_pingchou", target, true);
                    }
                }
            }
        }
    },
    ql_fensha: {
        zhuanhuanji: true,
        mark: true,
        marktext: "☯",
        intro: {
            content(storage, player) {
                return `转换技，${!storage ? "你可以从牌堆底摸一张牌，然后视为使用一张【火攻】，此牌结算后，你将一张牌置于牌堆顶" : "出牌阶段，你可以对一名角色造成一点火焰伤害，然后其本回合【杀】只能当做【闪】，非【杀】基本牌只能当做无距离限制的【杀】使用"}`;
            },
        },
        group: ["ql_fensha_yang", "ql_fensha_yin"],
        subSkill: {
            yang: {
                enable: "chooseToUse",
                viewAsFilter(player) {
                    return !player.storage.ql_fensha;
                },
                viewAs: {
                    name: "huogong",
                    isCard: true,
                },
                selectCard: 0,
                filterCard: () => false,
                log: false,
                prompt: "焚沙：从牌堆底摸一张牌，然后视为使用一张【火攻】，此牌结算后，你将一张牌置于牌堆顶",
                async precontent(event, trigger, player) {
                    const skill = "ql_fensha";
                    player.logSkill(skill);
                    player.changeZhuanhuanji(skill);
                    await player.draw("bottom");
                    event.getParent().oncard = () => {
                        const event = get.event();
                        const { player, card } = event;
                        player
                            .when("useCardAfter")
                            .filter(evt => evt.card == card)
                            .then(async (event, trigger, player) => {
                                if (player.countCards("he") > 0) {
                                    const result = await player.chooseCard("he", true, "焚沙：将一张牌置于牌堆顶").forResult();
                                    if (result.cards?.length) {
                                        const { cards: [card] } = result;
                                        game.log(player, "将", get.position(card) == "h" ? "一张牌" : card, "置于牌堆顶");
                                        player.$throw(get.position(card) == "h" ? 1 : card, 1000);
                                        await player.lose(card, ui.cardPile, "insert");
                                        await game.delayx();
                                    }
                                }
                            })
                    }
                }
            },
            yin: {
                enable: "phaseUse",
                filter(event, player) {
                    return player.storage.ql_fensha;
                },
                filterTarget: true,
                line: "fire",
                prompt: "出牌阶段，你可以对一名角色造成一点火焰伤害，然后其本回合【杀】只能当做【闪】，非【杀】基本牌只能当做无距离限制的【杀】使用",
                async content(event, trigger, player) {
                    const skill = "ql_fensha";
                    player.changeZhuanhuanji(skill);
                    const { target } = event;
                    await target.damage("fire");
                    target.addTempSkill(skill + "_debuff");
                },
                ai: {
                    order: 7,
                    result: {
                        target(player, target) {
                            const sgn = get.sgnAttitude(player, target);
                            return sgn * get.damageEffect(target, player, player, "fire");
                        }
                    }
                }
            },
            debuff: {
                charlotte: true,
                mod: {
                    cardname(card, player) {
                        const event = get.event();
                        if (event.name != "chooseToUse") {
                            return;
                        }
                        if (card.name == "sha") {
                            return "shan";
                        }
                        if (card.name != "sha" && lib.card[card.name].type == "basic") {
                            return "sha";
                        }
                    }
                }
            }
        }
    },
    //苏云松
    ql_qizhuan: {
        zhuanhuanji: true,
        mark: true,
        marktext: "☯",
        intro: {
            content(storage, player) {
                return `转换技，你的阶段开始时，${!storage ? "摸已损失体力值张牌，然后你于下个阶段开始时弃置已损失体力值张牌" : "弃置当前体力值张牌，然后你于下个阶段开始时摸当前体力值张牌"}`;
            },
        },
        trigger: {
            player: "phaseAnyBegin",
        },
        priority: 10,
        check: () => true,
        prompt2(event, player) {
            return get.skillInfoTranslation("ql_qizhuan", player, false) + `<br><span class=yellowtext><li>当前阶段：${get.translation(event.name)}<span>`;
        },
        async content(event, trigger, player) {
            const bool = player.storage[event.name];
            player.changeZhuanhuanji(event.name);
            if (!bool) {
                const num = player.getDamagedHp();
                if (num > 0) {
                    await player.draw(num);
                    player.addTempSkill(`${event.name}_yang`, { player: "dieAfter" });
                }
            } else {
                const num = player.getHp();
                if (num > 0) {
                    await player.chooseToDiscard(num, "he", true);
                    player.addTempSkill(`${event.name}_yin`, { player: "dieAfter" });
                }
            }
        },
        subSkill: {
            yang: {
                charlotte: true,
                forced: true,
                priority: 9,
                marktext: "弃",
                mark: true,
                intro: {
                    markcount: (storage, player) => player.getDamagedHp(),
                    content: (storage, player) => `下个阶段开始时弃置${player.getDamagedHp()}张牌`,
                },
                trigger: {
                    player: "phaseAnyBegin",
                },
                async content(event, trigger, player) {
                    const num = player.getDamagedHp();
                    player.removeSkill(event.name);
                    await player.chooseToDiscard(num, "he", true);
                }
            },
            yin: {
                charlotte: true,
                forced: true,
                priority: 9,
                marktext: "摸",
                mark: true,
                intro: {
                    markcount: (storage, player) => player.getHp(),
                    content: (storage, player) => `下个阶段开始时摸${player.getHp()}张牌`,
                },
                trigger: {
                    player: "phaseAnyBegin",
                },
                async content(event, trigger, player) {
                    const num = player.getHp();
                    player.removeSkill(event.name);
                    await player.draw(num);
                }
            }
        }
    },
    //婉文儿
    ql_lintie: {
        intro: {
            content: "已记录：$",
        },
        enable: ["chooseToUse", "chooseToRespond"],
        hiddenCard(player, name) {
            return player.getStorage("ql_lintie").includes(name);
        },
        getList(event, player) {
            const storage = player.getStorage("ql_lintie");
            const list = [];
            const check = info => event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], isCard: true, storage: { ql_lintie: true } }), player, event);
            for (const name of storage) {
                const info = [get.type(name), "", name];
                if (check(info)) {
                    list.push(info);
                }
                if (name == "sha") {
                    for (const nature of lib.inpile_nature) {
                        const info = [get.type(name), "", name, nature];
                        if (check(info)) {
                            list.push(info);
                        }
                    }
                }
            }
            return list;
        },
        filter(event, player) {
            return get.info("ql_lintie").getList(event, player).length > 0;
        },
        chooseButton: {
            dialog(event, player) {
                return ui.create.dialog("临帖", [get.info("ql_lintie").getList(event, player), "vcard"], "hidden");
            },
            check(button) {
                if (_status.event.getParent().type != "phase") {
                    return 1;
                }
                return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true, storage: { ql_lintie: true } }));
            },
            backup(links, player) {
                return {
                    log: false,
                    filterCard: () => false,
                    selectCard: 0,
                    viewAs: {
                        name: links[0][2],
                        nature: links[0][3],
                        isCard: true,
                        storage: {
                            ql_lintie: true,
                        }
                    },
                    async precontent(event, trigger, player) {
                        player.logSkill("ql_lintie");
                        player.unmarkAuto("ql_lintie", event.result.card.name);
                        player.addTempSkill("ql_lintie_nocount");
                    }
                }
            },
            prompt(links, player) {
                return `请选择${get.translation(links[0][3]) || ""}【${get.translation(links[0][2])}】的目标`
            }
        },
        ai: {
            order: 10,
            result: {
                player(player) {
                    if (_status.event.dying) {
                        return get.attitude(player, _status.event.dying);
                    }
                    return 1;
                },
            },
            respondShan: true,
            respondSha: true,
            skillTagFilter(player, tag, arg) {
                const name = tag.slice(7);
                if (!player.getStorage("ql_lintie").includes(name)) {
                    return false;
                }
            },
        },
        locked: false,
        mod: {
            cardUsable(card, player) {
                if (card?.storage?.ql_lintie) {
                    return Infinity;
                }
            }
        },
        group: ["ql_lintie_record"],
        subSkill: {
            backup: {},
            nocount: {
                charlotte: true,
                forced: true,
                popup: false,
                firstDo: true,
                trigger: { player: "useCard1" },
                filter(event, player) {
                    return event.addCount !== false && event.skill == "ql_lintie_backup";
                },
                async content(event, trigger, player) {
                    trigger.addCount = false;
                    const stat = player.getStat().card,
                        name = trigger.card.name;
                    if (typeof stat[name] == "number") {
                        stat[name]--;
                    }
                    game.log(trigger.card, "不计入次数");
                },
            },
            record: {
                forced: true,
                locked: false,
                trigger: {
                    player: ["useCardAfter", "respondAfter"],
                },
                filter(event, player) {
                    return (
                        ["basic", "trick"].includes(get.type(event.card)) &&
                        !player.getStorage("ql_lintie").includes(event.card.name) &&
                        event.skill !== "ql_lintie_backup"
                    )
                },
                async content(event, trigger, player) {
                    player.markAuto("ql_lintie", trigger.card.name);
                }
            }
        }
    },
    ql_bianzhuang: {
        derivation: ["ql_shulan"],
        juexingji: true,
        skillAnimation: true,
        animationColor: "metal",
        forced: true,
        trigger: {
            player: "dying",
        },
        async content(event, trigger, player) {
            player.awakenSkill(event.name);
            await player.gainMaxHp();
            await player.recoverTo(player.maxHp);
            if (!_status.characterlist) {
                game.initCharacterList();
            }
            const list = _status.characterlist.filter(name => get.character(name).sex == "male").randomGets(10);
            const result = await player
                .chooseButton([
                    `弁装：请选择要获得技能的角色`,
                    [list, "character"]
                ], 3, true)
                .set("ai", () => Math.random())
                .forResult();
            const { links } = result;
            const skills = links?.length ? [...links.flatMap(name => get.character(name).skills), ...get.info(event.name).derivation] : get.info(event.name).derivation;
            await player.addSkills(skills);
            const sex = "male";
            if (player.sex !== sex) {
                game.broadcastAll(
                    (player, sex) => {
                        player.sex = sex;
                    },
                    player,
                    sex
                );
                game.log(player, "将性别变为了", "#y" + get.translation(sex) + "性");
            }
        },
    },
    ql_shulan: {
        forced: true,
        onremove(player, skill) {
            player.addSkill(skill + "_remove");
        },
        trigger: {
            global: "phaseJieshuBegin",
        },
        filter(event, player) {
            return player.getSkills(null, false, false).some(i => !get.info(i).charlotte);
        },
        async content(event, trigger, player) {
            const skills = player.getSkills(null, false, false).filter(i => !get.info(i).charlotte);
            const result = await player
                .chooseButton([
                    `书澜：请选择要失去的技能`,
                    [skills.map(i => [i, player.name]), "skill"]
                ], true)
                .set("ai", button => button.link == "ql_shulan" ? 100 : -get.skillRank(button.link, "inout"))
                .forResult();
            const { links } = result;
            if (links?.length) {
                await player.removeSkills(links);
            }
            if (player.getHp() > 0) {
                const result2 = await player
                    .chooseTarget(`书澜：弃置一名角色区域内至多${player.getHp()}张牌`, true, (card, player, target) => {
                        return target.countDiscardableCards(player, "hej") > 0;
                    })
                    .set("ai", target => {
                        return get.effect(target, { name: "guohe_copy" }, get.player(), get.player());
                    })
                    .forResult();
                const { targets } = result2;
                if (targets?.length) {
                    const [target] = targets;
                    player.line(target);
                    await player.discardPlayerCard(target, "hej", [1, player.getHp()], true);
                }
            }
            player.addMark(`${event.name}_draw`, 1, false);
            player.addSkill(`${event.name}_draw`);
        },
        subSkill: {
            draw: {
                charlotte: true,
                forced: true,
                popup: false,
                trigger: { player: "phaseDrawBegin2" },
                filter(event, player) {
                    return !event.numFixed && player.hasMark("ql_shulan_draw");
                },
                async content(event, trigger, player) {
                    trigger.num += player.countMark(event.name);
                },
                intro: {
                    content: "摸牌阶段摸牌数+#",
                }
            },
            remove: {
                charlotte: true,
                forced: true,
                trigger: {
                    player: "changeSkillsAfter",
                },
                filter(event, player) {
                    return event.removeSkill.includes("ql_shulan");
                },
                async content(event, trigger, player) {
                    player.removeSkill(event.name);
                    await player.gainMaxHp();
                    await player.recover();
                    const natures = lib.inpile_nature.slice();
                    for (const nature of natures) {
                        const result = await player
                            .chooseTarget(`书澜：令一名角色受到${get.translation(nature)}属性伤害`, true)
                            .set("nature", nature)
                            .set("ai", target => {
                                return get.damageEffect(target, get.player(), get.player(), get.event().nature);
                            })
                            .forResult();
                        const { targets } = result;
                        if (targets?.length) {
                            const [target] = targets;
                            player.line(target, nature);
                            await target.damage(nature);
                        }
                    }
                }
            }
        }
    },
};

export default skills;
