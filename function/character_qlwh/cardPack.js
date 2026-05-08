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
        ql_xiuyangshengxi:{
            singleCard: true,
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
				return game.countPlayer()>1;
			},
            targetprompt: ["可选择选项", "被动选择选项"],
			complexSelect: true,
			complexTarget: true,
			filterAddedTarget(card, player, target, preTarget) {
				return target !== preTarget;
			},
			content(){
			    "step 0"
			    target.chooseControlList(["恢复1点体力，不能使用伤害类牌直到回合结束", "摸两张牌，直到下一个回合开始时不能于濒死状态外恢复体力"], true).set("ai", function (event, player ,target) {
					return 1;
				});
				"step 1"
				if (result.index == 0) {
			      	target.recover();
			      	target.addTempSkill("ql_xiuyangshengxi_recover",{player:"phaseEnd"});
			      	event.addedTarget.draw(2);
			      	event.addedTarget.addTempSkill("ql_xiuyangshengxi_draw",{player:"phaseBegin"});
			      	event.finish();
		    	} 
		    	else {
			    	target.draw(2);
			      	target.addTempSkill("ql_xiuyangshengxi_draw",{player:"phaseBegin"});
			      	event.addedTarget.recover();
			      	event.addedTarget.addTempSkill("ql_xiuyangshengxi_recover",{player:"phaseEnd"});
			      	event.finish();
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
        ql_mingjue:{
            fullskin: true,
            type: "trick",
            wuxieable: false,
            enable(card, player ,dying) {
				return dying == player;
	    	},
	    	savable(card, player, dying) {
					return dying == player;
			},
            prompt() {
                return "处于濒死状态使用，指定一个目标，你与其展示手牌，其中杀的数量不大于对方的角色失去一点体力，大于对方的角色回复体力至上限。";
            },
            filterTarget(card, player, target) {
                return target != player;
            },
            selectTarget: 1,
            content(){
                "step 0"
                player.chooseTarget("请选择你要【命决】的目标",true,1,function(card,player,target){
                return target!=player;
                });
                "step 1"
                if(result.bool){
                var cards1=player.getCards("h");
                event.cards1=cards1;
                var target=result.targets[0];
                event.target=target;
                var cards2=target.getCards("h");
                event.cards2=cards2;
                }
                "step 2"
                var num1=0;
                event.num1=num1;
                var num2=0;
                event.num2=num2;
                player.showCards(event.cards1);
                var shapai1=[];
                var shapai2=[];
                for(var i=0;i<event.cards1.length;i++){
                    if(event.cards1[i].name=="sha"){
                          shapai1.add(event.cards1[i]);
                    }
                }
                event.num1+=shapai1.length;
                target.showCards(event.cards2);
                for(var i=0;i<event.cards2.length;i++){
                    if(event.cards2[i].name=="sha"){
                          shapai2.add(event.cards2[i]);
                    }
                }
                event.num2+=shapai2.length;
                "step 3"
                if(event.num1>event.num2){
                   player.recover(player.maxHp-player.hp);
                   target.loseHp();
                }
                if(event.num1<event.num2){
                   target.recover(player.maxHp-player.hp);
                   player.loseHp();
                }
                if(event.num1==event.num2){
                   player.loseHp();
                   target.loseHp();
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
        ql_shenxianshizu:{
            fullskin: true,
            type: "trick",
            wuxieable: true,
            /*enable(card,player){
                return player.countCards("h",{color:"black"})>1;
            },*/
            enable: true,
			selectTarget: -1,
			toself: true,
			filterTarget(card, player, target) {
				return target === player;
			},
            prompt() {
                return "弃置你所有黑色手牌，本回合造成伤害+1";
            },
            async content(event, trigger, player) {
               var cards = player.getCards('h', {color:"black"});
               player.discard(cards);
               if(cards.length) {
                   player.addTempSkill("ql_shenxianshizu_skill");
               }
            },
            ai: {
                basic: {
                    order: 7,
                    useful: [6, 4],
                    value: [6, 4],
                },
                result: {
                    player: 1,
                },
            },
        },
        ql_jianbiqingye: {
            fullskin: true,
            type: "trick",
            wuxieable: true,
            enable: true,
            prompt() {
                return "选择一名其他角色，你与其跳过下一个摸牌阶段，你摸三张牌。";
            },
            filterTarget(card, player, target) {
                return target != player;
            },
            selectTarget: 1,
            async content(event, trigger, player) {
                await player.draw(_status.connectMode ? 1 : 3);
                game.doAsyncInOrder([player, event.target], async current => {
                    current.addTempSkill("ql_jianbiqingye_skip",{player:"die"});
                });
            },
            ai: {
                basic: {
                    order: 6,
                    useful: [6, 4],
                    value: [6, 4],
                },
                result: {
                    target:-1,
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
       ql_xiuyangshengxi_recover:{
           mark:true,
           marktext:"休养",
           intro:{
              name:"休养生息",
              content:"不能使用伤害类牌",
           },
            mod: {
			cardEnabled(card) {
				if (get.tag(card,"damage")) {
					return false;
				}
			},
		},
		charlotte: true,
       },
       ql_xiuyangshengxi_draw:{
           trigger:{
               player:"recoverBegin",
           },
           forced:true,
           mark:true,
           marktext:"生息",
           intro:{
              name:"休养生息",
              content:"不能于濒死状态外恢复体力",
           },
           filter:function(event,player){
               return !player.isDying();
           },
           content:function(){
               trigger.cancel();
           },
       },
        ql_jianbiqingye_skip:{
            trigger:{
               player:"phaseDrawBegin",
            },
            forced:true,
            content:function(){
                trigger.cancel();
                player.removeSkill("ql_jianbiqingye_skip");
            },
        },
        ql_shenxianshizu_skill:{
            trigger:{
               source:"damageBegin",
            },
            forced:true,
            content:function(){
                 trigger.num++;
            },
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
        ql_xiuyangshengxi:"休养生息",
        ql_xiuyangshengxi_info:"出牌阶段，对两名角色使用，第一名角色选择一项，第二名角色执行另一项：①恢复1点体力，然后令其不可使用伤害牌直到其回合结束；②摸两张牌，然后令其处于非濒死状态时不可恢复体力，直到其回合开始。",
        ql_mingjue:"命决",
        ql_mingjue_info:"处于濒死状态使用，指定一个目标，你与其展示手牌，其中杀的数量不大于对方的角色失去一点体力，大于对方的角色回复体力至上限。",
        ql_shenxianshizu:"身先士卒",
        ql_shenxianshizu_info:"出牌阶段，对自己使用，你弃置所有黑色手牌，本回合造成伤害时，伤害值+1。",
        qlwh_card: "<span style='color:#FF00FF;font-weight:bold'>五花米线</span>",
        ql_weidiandayuan: "围点打援",
        ql_weidiandayuan_info: "一名角色使用【桃】时，你可以使用此牌获得对应【桃】的实体牌，若没有对应实体牌你取消此【桃】的目标。",
        ql_jianbiqingye: "坚壁清野",
        ql_jianbiqingye_info: "出牌阶段使用，选择一名其他角色，你摸一张牌然后与其跳过下一个摸牌阶段。",
    },
    //卡牌加入牌堆是的信息
    list: [
        ["spade", 13, "ql_weidiandayuan"],
        ["heart", 13, "ql_weidiandayuan"],
        ["club", 4, "ql_jianbiqingye"],
        ["club", 3, "ql_jianbiqingye"],
        ["spade", 1,"ql_shenxianshizu"],
        ["spade",6,"ql_mingjue"],
        ["diamond",1,"ql_xiuyangshengxi"],
        ["club",1,"ql_xiuyangshengxi"],
        ["heart",1,"ql_xiuyangshengxi"],
        ["spade",1,"ql_xiuyangshengxi"],
        ["club", 4, "ql_weiye"],
    ]
}

export { cardPack };