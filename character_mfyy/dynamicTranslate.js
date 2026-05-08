import { lib, game, ui, get, ai, _status } from "../../../noname.js";

const dynamicTranslates = {
	mfyy_caoli(player, skill) {
		const bool = player.storage[skill];
		let yang = "视为使用一张【酒】",
			yin = "视为使用一张【杀】";
		if (bool) {
			yin = `<span class="bluetext">${yin}</span>`;
		} else {
			yang = `<span class="firetext">${yang}</span>`;
		}
		const start = `锁定技，转换技，游戏开始时，你将手牌标记为“草隶”牌。当你使用“草隶”牌时，摸两张牌并，`,
			end = "。你的【酒】的效果不会因回合结束失去。";
		return `${start}阳：${yang}；阴：${yin}${end}`;
	},
    mfyy_shucheng(player, skill) {
		const storage = player.getStorage(`${skill}_selected`);
		const list = [
			"1.摸两张牌，然后交给你一张手牌",
			"2.令你将至多两张手牌标记为“兼体”牌",
			"3.恢复1点体力值并复原武将牌",
			"4.视为使用一张普通锦囊牌且下次造成的伤害+1",
		];
		for (const i of storage) {
			list[i - 1] = `<span style="text-decoration:line-through;">${list[i - 1]}</span>`;
		}
		return `出牌阶段，你可交给一名其他角色一张“兼体”牌，然后其选择一项执行并令此项失效：${list.join("；")}。全部被选择后恢复所有选项。`
	},
};
export default dynamicTranslates;
