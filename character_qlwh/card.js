import { lib, game, ui, get, ai, _status } from '../../../noname.js'

const cards = {
	ql_tongbi: {
		derivation: "ql_efeiliusi",
		type: "equip",
		fullskin: true,
		subtype: "equip1",
		distance: { attackFrom: -4 },
		skills: ["ql_mingyong"],
		destroy: true,
		ai: {
			equipValue: 7,
		},
	},
	ql_duanpo: {
		derivation: "ql_efeiliusi",
		type: "equip",
		fullskin: true,
		subtype: "equip1",
		distance: { attackFrom: -2 },
		skills: ["ql_duiying"],
		destroy: true,
		ai: {
			equipValue: 7,
		},
	},
	ql_zhuiming: {
		derivation: "ql_efeiliusi",
		type: "equip",
		fullskin: true,
		subtype: "equip1",
		distance: { attackFrom: -2 },
		skills: ["ql_dishuanganshi"],
		destroy: true,
		ai: {
			equipValue: 7,
		},
	},
	ql_anyizhigong: {
		derivation: "ql_weilusi",
		cardcolor: "diamond",
		type: "equip",
		fullskin: true,
		subtype: "equip1",
		distance: { attackFrom: -4 },
		skills: ["ql_anyizhigong_skill"],
		ai: {
			equipValue: 7,
		},
	},
	ql_anyizhidao: {
		derivation: "ql_zhaoxin",
		cardcolor: "spade",
		type: "equip",
		fullskin: true,
		subtype: "equip1",
		distance: { attackFrom: -2 },
		skills: ["ql_anyizhidao_skill"],
		ai: {
			equipValue: 7,
		},
		async onLose(event, trigger, player) {
			const skill = "ql_anyizhidao_skill";
			player.clearMark(skill, false);
		},
	},
	ql_anyizhijian: {
		derivation: "ql_jianmo",
		cardcolor: "heart",
		type: "equip",
		fullskin: true,
		subtype: "equip1",
		distance: { attackFrom: -1 },
		skills: ["ql_cisix"],
		ai: {
			equipValue: 7,
		},
	},
	qlyuewanggoujianjian: {
		derivation: "qlgoujian",
		//image: "ext:五花米线/"
		cardcolor: "club",
		type: "equip",
		fullskin: true,
		subtype: "equip1",
		distance: { attackFrom: -3 },
		skills: ["qlyuewanggoujianjian"],
		ai: {
			equipValue: 6.7,
		},
	},
};
export default cards;
