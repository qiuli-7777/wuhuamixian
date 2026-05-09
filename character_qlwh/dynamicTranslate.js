import { lib, game, ui, get, ai, _status } from "../../../noname.js";
const dynamicTranslates = {
	ql_zhujia(player, skill) {
		let str = lib.translate[skill + "_info"];
		str = str.replace(/（[^）]*）/g, "");
		const prefix = str.substring(0, str.indexOf("："));
		let infix, suffix, skillName;
		if(get.info(skill).derivation.every(skillx => player.getSkills(null, false, false).filter(i => !get.info(i).charlotte).includes(skillx))) {
			infix = "摸两张牌";
		} else {
			for(let i of get.info(skill).derivation) {
				if(!player.hasSkill(i)) {
					skillName = i;
					break;
				}
			}
			infix = `获得『${get.translation(skillName)}』`
		}
		const count = player.storage[skill + "_count"] || 0;
		if(count < 2) {
			suffix = "增加一点体力上限";
		} else {
			suffix = "回复一点体力";
		}
		return prefix + infix + "并" + suffix;
	},
	ql_yanchu(player, skill) {
		const str = lib.translate[skill + "_info"];
		const list = str.split("。");
		return !player.storage[skill] ? str : list.slice(0, -2).join("。") + "。";
	},
	ql_chuntao(player, skill) {
		const bool = player.storage[skill];
		let yang = "你需要使用普通锦囊牌时，若你手牌数大于1，你可以令一名其他角色将手牌调整至一张，然后你将你手牌数-1张牌当一张普通锦囊牌使用",
			yin = "你需要使用基本牌时，若你手牌数小于体力上限，你可以与一名其他角色将手牌调整至你体力上限，然后你视为使用之";
		if (bool) {
			yin = `<span class="bluetext">${yin}</span>`;
		} else {
			yang = `<span class="firetext">${yang}</span>`;
		}
		const start = `持恒技，转换技，每回合每项限一次，`,
			end = "。";
		return `${start}阳：${yang}；阴：${yin}${end}`;
	},
	ql_wangxiang(player, skill) {
		const bool = player.storage[skill];
		const list = ["弃一张牌并令其交给你一张牌", "摸一张牌并交给其一张牌"];
		if (bool) list.reverse();
		return `持恒技，一名角色出牌阶段开始时，你可以摸［${list[0]}］；一名角色成为【杀】的目标时，你可以摸［${list[1]}］。你使用或成为转化牌或虚拟牌的目标后，你可以为此牌增加或减少一个目标，然后交换两个［］中的内容。`
	},
	ql_duanyuan(player, skill) {
		let info = lib.translate[`${skill}_info`];
		const num = player.countMark(skill);
		if (num > 0) {
			info = info.replace("限一次", `限${get.cnNumber(num + 1)}次`);
		}
		return info;
	},
	ql_fanzhan(player, skill) {
		let info = lib.translate[`${skill}_info`];
		const num = player.countMark(skill);
		if (num > 0) {
			info = info.replace("[0]", `[${num}]`);
		}
		return info;
	},
	qljili(player, skill) {
		const bool = player.storage[skill];
		let yang = "受到一点无来源伤害",
			yin = "回复一点体力";
		if (bool) {
			yin = `<span class="bluetext">${yin}</span>`;
		} else {
			yang = `<span class="firetext">${yang}</span>`;
		}
		const start = `转换技，出牌阶段限一次，你可以令一名角色摸两张牌并令其，`,
			end = "。然后其获得你对应的三音标记和对应效果，最后你对另一名角色造成一点伤害。";
		return `${start}阳：${yang}；阴：${yin}${end}`;
	},
	qlchousi(player, skill) {
		let info = lib.translate[`${skill}_info`],
			bool = player.getStorage(skill, false);
		if (bool) {
			return info.replace("非伤害", "伤害");
		}
		return info;
	},
	qlbojian(player, skill) {
		let info = lib.translate[`${skill}_info`],
			bool = player.getStorage(skill, false);
		if (bool) {
			return info.replace("伤害", "非伤害");
		}
		return info;
	},
	qlcangfeng(player, skill) {
		if (game.openHuanzhang()) {
			return `转换技，一名角色的回合开始时，你可以令其失去一点体力或弃置其区域内一张牌，若如此做，其本回合使用的第一张牌不可被响应，且本回合其对失去过牌的角色：①使用牌无次数限制②使用杀额外结算一次且回复一点体力；使用伤害牌可以额外指定一个目标。`
		}
		const bool = player.storage[skill];
		let yang = `其对失去过牌的角色①使用牌无次数限制②使用杀额外结算一次且回复一点体力`,
			yin = `使用伤害牌可以额外指定一个目标`;
		if (!bool) {
			yang = `<span class = "firetext">${yang}</span>`;
		} else {
			yin = `<span class = "bluetext">${yin}</span>`;
		}
		const start = `转换技，一名角色的回合开始时，你可以令其失去一点体力或弃置其区域内一张牌，若如此做，其本回合使用的第一张牌不可被响应，且本回合，`,
			end = `。`;
		return `${start}阳：${yang}；阴：${yin}${end}`;
	},
	qljichi(player, skill) {
		const bool = player.getStorage(skill, false);
		let yang = "摸两张牌且获得〖隐夜〗本轮你受到伤害+1，你造成或受到伤害后失去〖隐夜〗",
			yin = "摸两张牌且本轮你无视防具，造成伤害+1";
		if (player.hasSkill("qljichi_delete")) {
			yang = "摸两张牌且本轮你受到伤害+1";
		}
		if (bool) {
			yin = `<span class='bluetext'>${yin}</span>`;
		} else {
			yang = `<span class='firetext'>${yang}</span>`;
		}
		return `转换技，每轮开始时，你可以：阳，${yang}；阴：${yin}。`;
	},
	qlwoxin(player) {
		let str = "锁定技，你造成伤害调整为一点。";
		if (player.storage.qlwoxin_damage) {
			str = `<span style="text-decoration:line-through;">${str}</span>`;
		}
		return "持恒技，" + str + "你造成伤害后获得等量“剑鸣”，你使用【杀】获得一枚“蛰伏”。你计算与其他角色距离-X（X为剑鸣数）。";
	},
	qlxuezao(player, skill) {
		const list = player.getStorage(skill);
		let yang = "失去1点体力，然后将手牌摸至体力值（未以此法获得牌则摸两张牌）",
			yin = "回复1点体力，然后将手牌弃至体力值（未以此法失去牌则弃置两张牌）";
		if (list?.length && list[0] === "yin") {
			yin = `<span class='bluetext'>${yin}</span>`;
		} else {
			yang = `<span class='firetext'>${yang}</span>`;
		}
		if (list?.length == 1) {
			return `锁定技，转换技，你于出牌阶段内使用牌时，${list[0] === "yang" ? yang : yin}`;
		}
		return `锁定技，转换技，你于出牌阶段内使用牌时，阳：${yang}；阴：${yin}。`;
	},
	qlaige(player, skill) {
		const [start, controls] = lib.translate[`${skill}_info`].slice(0, -1).split("："),
			list = player.getStorage(skill);
		return `${start}：${controls
			.split("；")
			.map(control => {
				const [index, translation] = control.split(".");
				if (list.includes(index)) {
					return `${index}.<span style="text-decoration: line-through; opacity:0.5; ">${translation}</span>`;
				}
				return `${index}.${translation}`;
			})
			.join("；")}。`;
	},
};
export default dynamicTranslates;
