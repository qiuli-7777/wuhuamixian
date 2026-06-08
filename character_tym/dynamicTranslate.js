import { lib, game, ui, get, ai, _status } from "../../../noname.js";

const dynamicTranslates = {
	ql_kenquan(player, skill) {
		const bool = player.storage[skill];
		let yang = "【推心置腹】",
			yin = "【无中生有】";
		if (!bool) {
			yang = `<span class=firetext>${yang}</span>`;
		} else {
			yin = `<span class=bluetext>${yin}</span>`;
		}
		const start = "转换技，你不因该技能成为牌的目标时，可以视为使用一张无距离限制的，",
			end = "。";
		return `${start}阳：${yang}；阴：${yin}${end}`;
	},
	ql_dansuan(player, skill) {
		let info = lib.translate[`${skill}_info`];
		const num = player.countMark("ql_chuanshu");
		if (num > 0) {
			info = info.replace("卜算X", `卜算${get.cnNumber(num + 2)}`).replace("X-2张牌", `${get.cnNumber(num)}张牌`);
		}
		return info;
	},
	ql_fensha(player, skill) {
		const bool = player.storage[skill];
		let yang = "你可以从牌堆底摸一张牌，然后视为使用一张【火攻】，此牌结算后，你将一张牌置于牌堆顶",
			yin = "出牌阶段，你可以对一名角色造成一点火焰伤害，然后其本回合【杀】只能当做【闪】，非【杀】基本牌只能当做无距离限制的【杀】使用";
		if (!bool) {
			yang = `<span class=firetext>${yang}</span>`;
		} else {
			yin = `<span class=bluetext>${yin}</span>`;
		}
		const start = "转换技，",
			end = "。";
		return `${start}阳：${yang}；阴：${yin}${end}`;
	},

	ql_qizhuan(player, skill) {
		const bool = player.storage[skill];
		let yang = "摸已损失体力值张牌，然后你于下个阶段开始时弃置已损失体力值张牌",
			yin = "弃置当前体力值张牌，然后你于下个阶段开始时摸当前体力值张牌";
		if (!bool) {
			yang = `<span class=firetext>${yang}</span>`;
		} else {
			yin = `<span class=bluetext>${yin}</span>`;
		}
		const start = "转换技，你的阶段开始时，",
			end = "。";
		return `${start}阳：${yang}；阴：${yin}${end}`;
	},
};
export default dynamicTranslates;
